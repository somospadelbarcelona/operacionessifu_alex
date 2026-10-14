# -*- coding: utf-8 -*-
"""
SERVIDOR EN TIEMPO REAL Y CENTINELA DE FICHAJES - SIFU GIRONA
Puerto: 5006
Funciones:
- Servidor Web HTTP estático + API REST + SSE (Server-Sent Events) en vivo.
- GET  /api/fichajes        -> Retorna JSON actualizado de fichajes
- GET  /api/fichajes/stream -> Server-Sent Events en tiempo real
- POST /api/fichajes/sync   -> Lanza sincronización inmediata bajo demanda
- GET  /api/fichajes/health -> Comprobación de salud y tiempos
- Scheduler en segundo plano (cada 15 min de 06:00 a 23:00, cada 60 min de noche).
"""

import http.server
import socketserver
import os
import sys
import json
import time
import threading
import subprocess
from datetime import datetime, timedelta

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = 5006
HOST = "0.0.0.0"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(BASE_DIR, "fichajes_contraste_girona.json")
LOCK_FILE = os.path.join(BASE_DIR, ".fichajes_sync.lock")
PY_SYNC_SCRIPT = os.path.join(BASE_DIR, "fichajes_sync_gcalidad_app.py")

START_TIME = datetime.now()
sse_subscribers = []
sse_lock = threading.Lock()
sync_running = False
sync_status_lock = threading.Lock()

def get_last_modified():
    if os.path.exists(JSON_FILE):
        return os.path.getmtime(JSON_FILE)
    return 0

def broadcast_sse(data_json):
    with sse_lock:
        dead = []
        msg = f"event: update\ndata: {json.dumps(data_json, ensure_ascii=False)}\n\n".encode("utf-8")
        for client in sse_subscribers:
            try:
                client.wfile.write(msg)
                client.wfile.flush()
            except Exception:
                dead.append(client)
        for d in dead:
            if d in sse_subscribers:
                sse_subscribers.remove(d)

def run_sync_task():
    global sync_running
    with sync_status_lock:
        if sync_running:
            return False, "Ya hay una sincronización en curso."
        sync_running = True

    def _sync():
        global sync_running
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando proceso de sincronización en segundo plano...")
            # Usar sys.executable para garantizar el mismo entorno Python
            cmd = [sys.executable, PY_SYNC_SCRIPT]
            proc = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
            if proc.returncode == 0:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sincronización completada con éxito.")
                # Leer y emitir SSE
                if os.path.exists(JSON_FILE):
                    try:
                        with open(JSON_FILE, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        broadcast_sse(data)
                    except Exception as ex:
                        print("Error notificando SSE:", ex)
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Error en sync: {proc.stderr[:300]}")
        except Exception as e:
            print("Excepción ejecutando sync:", e)
        finally:
            with sync_status_lock:
                sync_running = False

    t = threading.Thread(target=_sync, daemon=True)
    t.start()
    return True, "Sincronización iniciada en segundo plano."

def background_scheduler():
    """Centinela que ejecuta la sincronización periódica automática."""
    while True:
        try:
            now = datetime.now()
            # Horario laboral: 06:00 a 23:00 -> cada 15 min; noche -> cada 60 min
            if 6 <= now.hour <= 23:
                wait_seconds = 15 * 60
            else:
                wait_seconds = 60 * 60

            time.sleep(wait_seconds)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Disparo automático del scheduler de fichajes.")
            run_sync_task()
        except Exception as e:
            print("Error en scheduler:", e)
            time.sleep(60)

class FichajesLiveHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Cabeceras CORS universales
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0]

        if clean_path == "/api/fichajes":
            if os.path.exists(JSON_FILE):
                try:
                    with open(JSON_FILE, "r", encoding="utf-8") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(content.encode("utf-8"))
                    return
                except Exception as e:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                    return
            else:
                self.send_response(404)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Datos aún no generados. Ejecuta una sincronización."}).encode("utf-8"))
                return

        elif clean_path == "/api/fichajes/health":
            uptime_sec = (datetime.now() - START_TIME).total_seconds()
            last_mtime = get_last_modified()
            last_mtime_str = datetime.fromtimestamp(last_mtime).strftime("%d/%m/%Y %H:%M:%S") if last_mtime > 0 else "Nunca"

            health = {
                "status": "healthy",
                "uptime_seconds": round(uptime_sec, 1),
                "started_at": START_TIME.strftime("%d/%m/%Y %H:%M:%S"),
                "sync_en_curso": sync_running,
                "ultima_modificacion_fichero": last_mtime_str,
                "clientes_sse_conectados": len(sse_subscribers),
                "scheduler": "Activo (cada 15 min)",
                "puerto": PORT
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(health, ensure_ascii=False, indent=2).encode("utf-8"))
            return

        elif clean_path == "/api/fichajes/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            with sse_lock:
                sse_subscribers.append(self)

            # Enviar saludo inicial y datos actuales
            try:
                self.wfile.write(f"event: connected\ndata: {json.dumps({'message': 'Conectado al bus en vivo SIFU Girona'})}\n\n".encode("utf-8"))
                if os.path.exists(JSON_FILE):
                    with open(JSON_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.wfile.write(f"event: update\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()

                # Mantener conexión viva con pings periódicos
                while True:
                    time.sleep(15)
                    self.wfile.write(f": ping {datetime.now().isoformat()}\n\n".encode("utf-8"))
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                with sse_lock:
                    if self in sse_subscribers:
                        sse_subscribers.remove(self)
            return

        # Servir estáticos normales (index.html, js, css, etc.)
        return super().do_GET()

    def do_POST(self):
        clean_path = self.path.split("?")[0]
        if clean_path == "/api/fichajes/sync":
            ok, msg = run_sync_task()
            status_code = 200 if ok else 409
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": ok, "message": msg, "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S")}).encode("utf-8"))
            return
        else:
            self.send_response(404)
            self.end_headers()

def main():
    print("=" * 60)
    print(f"🚀 SERVIDOR LIVE DE FICHAJES SIFU GIRONA v2.0")
    print(f"   URL Local:    http://localhost:{PORT}/")
    print(f"   API Fichajes: http://localhost:{PORT}/api/fichajes")
    print(f"   SSE Stream:   http://localhost:{PORT}/api/fichajes/stream")
    print(f"   Health Check: http://localhost:{PORT}/api/fichajes/health")
    print("=" * 60)

    # Iniciar scheduler automático
    sched_thread = threading.Thread(target=background_scheduler, daemon=True)
    sched_thread.start()

    class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    server = ThreadedHTTPServer((HOST, PORT), FichajesLiveHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
