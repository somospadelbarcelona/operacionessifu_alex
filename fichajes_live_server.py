# -*- coding: utf-8 -*-
"""
SERVIDOR EN TIEMPO REAL Y CENTINELA DE FICHAJES - SIFU GIRONA v2.2 (gzip + ETag)
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

PORT = 5006
HOST = "0.0.0.0"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
SERVER_LOG_FILE = os.path.join(LOG_DIR, "fichajes_live_server.log")

# Escritor seguro para entornos sin consola (ej. pythonw.exe)
class SafeLogWriter:
    def __init__(self, log_path):
        self.log_path = log_path
        self._fp = None

    def _get_fp(self):
        if self._fp is None:
            try:
                self._fp = open(self.log_path, "a", encoding="utf-8", buffering=1)
            except Exception:
                pass
        return self._fp

    def write(self, s):
        if not s:
            return
        fp = self._get_fp()
        if fp:
            try:
                fp.write(s)
            except Exception:
                pass

    def flush(self):
        fp = self._get_fp()
        if fp:
            try:
                fp.flush()
            except Exception:
                pass

_safe_writer = SafeLogWriter(SERVER_LOG_FILE)
if sys.stdout is None:
    sys.stdout = _safe_writer
if sys.stderr is None:
    sys.stderr = _safe_writer

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

JSON_FILE = os.path.join(BASE_DIR, "fichajes_contraste_girona.json")
LOCK_FILE = os.path.join(BASE_DIR, ".fichajes_sync.lock")
PY_SYNC_SCRIPT = os.path.join(BASE_DIR, "fichajes_sync_gcalidad_app.py")

START_TIME = datetime.now()
sse_subscribers = []
sse_lock = threading.Lock()
sync_running = False
sync_status_lock = threading.Lock()

def log_server(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    _safe_writer.write(line + "\n")

def get_last_modified():
    if os.path.exists(JSON_FILE):
        return os.path.getmtime(JSON_FILE)
    return 0

def broadcast_sse(data_json, event_name="update"):
    with sse_lock:
        dead = []
        msg = f"event: {event_name}\ndata: {json.dumps(data_json, ensure_ascii=False)}\n\n".encode("utf-8")
        for client in list(sse_subscribers):
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

    # Notificar a todos los navegadores que la sincronización ha iniciado
    broadcast_sse({
        "status": "running",
        "mensaje": "Sincronización en directo iniciada con gruposifuapp...",
        "started_at": datetime.now().strftime("%H:%M:%S")
    }, event_name="sync_status")

    def _sync():
        global sync_running
        try:
            log_server("Iniciando proceso de sincronización en segundo plano...")
            # Resolver python.exe en caso de estar corriendo bajo pythonw.exe
            py_exe = sys.executable
            if "pythonw.exe" in py_exe.lower():
                candidate = py_exe.lower().replace("pythonw.exe", "python.exe")
                if os.path.exists(candidate):
                    py_exe = candidate

            cmd = [py_exe, PY_SYNC_SCRIPT, "--concurrency", "8", "--gestor", "00062620"]
            creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            proc = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True, creationflags=creationflags)
            if proc.returncode == 0:
                log_server("Sincronización completada con éxito.")
                # Leer y emitir SSE
                if os.path.exists(JSON_FILE):
                    try:
                        with open(JSON_FILE, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        broadcast_sse({
                            "status": "completed",
                            "fecha": data.get("fecha_sincronizacion"),
                            "total": data.get("total_trabajadores", 0)
                        }, event_name="sync_status")
                        # Ya no se emiten los ~6 MB completos por SSE: al recibir "completed"
                        # el cliente descarga el JSON por HTTP (comprimido). Antes había
                        # doble descarga y doble repintado en cada sincronización.
                    except Exception as ex:
                        log_server(f"Error emitiendo SSE tras sync: {ex}")
            else:
                err_text = proc.stderr[:300] if proc.stderr else "Error desconocido en sync"
                log_server(f"Error en sync: {err_text}")
                broadcast_sse({
                    "status": "error",
                    "error": err_text
                }, event_name="sync_status")
        except Exception as e:
            log_server(f"Excepción ejecutando sync: {e}")
            broadcast_sse({
                "status": "error",
                "error": str(e)
            }, event_name="sync_status")
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
            log_server("Disparo automático del scheduler de fichajes.")
            run_sync_task()
        except Exception as e:
            log_server(f"Error en scheduler: {e}")
            time.sleep(60)

import urllib.request
import urllib.error
import gzip

# ─── OPTIMIZACIÓN DE TRANSMISIÓN (v2.2) ─────────────────────────────────────────
# Compresión gzip + ETag/304 para estáticos y JSON. Antes se enviaba todo con
# "no-store" y sin comprimir: ~12 MB re-descargados en cada carga de página.
COMPRESSIBLE_EXT = {".js", ".json", ".css", ".html", ".htm", ".svg", ".txt", ".map"}
_gzip_cache = {}          # path -> (etag, gz_bytes)
_gzip_cache_lock = threading.Lock()

def _file_etag(st):
    return f'"{st.st_mtime_ns:x}-{st.st_size:x}"'

def _get_gzipped(path, st):
    """Devuelve (etag, bytes_gzip) cacheado en memoria; recomprime solo si cambia el fichero."""
    etag = _file_etag(st)
    with _gzip_cache_lock:
        cached = _gzip_cache.get(path)
        if cached and cached[0] == etag:
            return cached
    with open(path, "rb") as f:
        raw = f.read()
    gz = gzip.compress(raw, compresslevel=6)
    with _gzip_cache_lock:
        _gzip_cache[path] = (etag, gz)
    return etag, gz

def send_file_optimized(handler, path, content_type=None):
    """Sirve un fichero con ETag (304 si no cambió) y gzip si el cliente lo acepta."""
    st = os.stat(path)
    etag = _file_etag(st)
    handler._cache_control = "no-cache"  # revalida siempre, pero permite 304 sin re-descarga

    if handler.headers.get("If-None-Match") == etag:
        handler.send_response(304)
        handler.send_header("ETag", etag)
        handler.end_headers()
        return

    ctype = content_type or handler.guess_type(path)
    ext = os.path.splitext(path)[1].lower()
    accepts_gzip = "gzip" in (handler.headers.get("Accept-Encoding") or "")

    if ext in COMPRESSIBLE_EXT and accepts_gzip and st.st_size > 1024:
        etag, body = _get_gzipped(path, st)
        handler.send_response(200)
        handler.send_header("Content-Type", ctype)
        handler.send_header("Content-Encoding", "gzip")
        handler.send_header("Vary", "Accept-Encoding")
    else:
        with open(path, "rb") as f:
            body = f.read()
        handler.send_response(200)
        handler.send_header("Content-Type", ctype)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("ETag", etag)
    handler.end_headers()
    handler.wfile.write(body)

HO_BRIDGE_GET_PATHS = {
    "/sync_carteras", "/carteras", "/sync_ho_master", "/ho_live_refresh",
    "/ho_vacaciones_data", "/ho_vacaciones_live", "/ho_vacaciones_worker",
    "/ho_intel_servicios", "/ho_check_project", "/ho_refresh_all_intel",
    "/status", "/cmd", "/tramitar", "/empleados_proyecto", "/snapshot",
    "/verify_cmh_excel", "/sync_contraste", "/sync_fichajes"
}

HO_BRIDGE_POST_PATHS = {
    "/marcar_baja_empresa", "/ho_execute_action", "/update_service", "/tramitar", "/ho_vacaciones_planificar"
}

def ensure_supervisor_bridge():
    """Comprueba y asegura que supervisor_bridge.py esté corriendo en el puerto 5005."""
    try:
        req = urllib.request.Request("http://127.0.0.1:5005/status")
        with urllib.request.urlopen(req, timeout=1.2) as res:
            if res.status == 200:
                return True
    except Exception:
        pass

    try:
        log_server("Auto-iniciando Supervisor Bridge SAP HO (puerto 5005)...")
        bridge_script = os.path.join(BASE_DIR, "supervisor_bridge.py")
        py_exe = sys.executable
        if "pythonw.exe" in py_exe.lower():
            cand = py_exe.lower().replace("pythonw.exe", "python.exe")
            if os.path.exists(cand):
                py_exe = cand
        cflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        subprocess.Popen([py_exe, bridge_script], cwd=BASE_DIR, creationflags=cflags)
        time.sleep(1.2)
        return True
    except Exception as ex:
        log_server(f"Aviso iniciando bridge 5005: {ex}")
        return False

def proxy_to_bridge(handler, method="GET", body=None):
    """Puente transparente para peticiones HO al puerto 5005."""
    ensure_supervisor_bridge()
    url = f"http://127.0.0.1:5005{handler.path}"
    try:
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("User-Agent", "FichajesLiveProxy/2.0")
        if body:
            ct = handler.headers.get("Content-Type", "application/json")
            req.add_header("Content-Type", ct)
        with urllib.request.urlopen(req, timeout=35) as res:
            res_body = res.read()
            handler.send_response(res.status)
            handler.send_header("Content-Type", res.headers.get("Content-Type", "application/json; charset=utf-8"))
            handler.end_headers()
            handler.wfile.write(res_body)
            return True
    except urllib.error.HTTPError as he:
        try:
            err_body = he.read()
            handler.send_response(he.code)
            handler.send_header("Content-Type", "application/json; charset=utf-8")
            handler.end_headers()
            handler.wfile.write(err_body)
            return True
        except Exception:
            return False
    except Exception as ex:
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.end_headers()
        handler.wfile.write(json.dumps({"error": f"Bridge HO 5005 no respondió: {ex}"}).encode("utf-8"))
        return True

class FichajesLiveHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Override para evitar fallo de sys.stderr en Windows / pythonw
        try:
            msg = "%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args)
            _safe_writer.write(msg)
        except Exception:
            pass

    def end_headers(self):
        # Cabeceras CORS universales
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Cache-Control, Pragma")
        # Estáticos/JSON optimizados usan "no-cache" (revalidación con ETag → 304).
        # El resto (API dinámica, proxy HO, SSE) mantiene el comportamiento original.
        self.send_header("Cache-Control", getattr(self, "_cache_control", "no-cache, no-store, must-revalidate"))
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0]

        # Puente automático y transparente hacia SAP HO
        if clean_path in HO_BRIDGE_GET_PATHS:
            if proxy_to_bridge(self, method="GET"):
                return

        if clean_path == "/api/fichajes":
            if os.path.exists(JSON_FILE):
                try:
                    # gzip + ETag: ~6 MB → ~0,4 MB por petición
                    send_file_optimized(self, JSON_FILE, "application/json; charset=utf-8")
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

            # Enviar saludo inicial ligero sin saturar el socket
            try:
                hello_info = {
                    'message': 'Conectado al bus en vivo SIFU Girona',
                    'timestamp': datetime.now().strftime("%H:%M:%S"),
                    'status': 'connected'
                }
                self.wfile.write(f"event: connected\ndata: {json.dumps(hello_info)}\n\n".encode("utf-8"))
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

        # Servir estáticos con gzip + ETag (index.html, js, css, json...)
        try:
            fs_path = self.translate_path(clean_path)
            if os.path.isdir(fs_path) and clean_path.endswith("/"):
                idx = os.path.join(fs_path, "index.html")
                if os.path.isfile(idx):
                    fs_path = idx
            if os.path.isfile(fs_path):
                send_file_optimized(self, fs_path)
                return
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as ex:
            log_server(f"Aviso sirviendo estático optimizado {clean_path}: {ex}")
        
        # Fallback a handler estándar despojando query params
        orig_path = self.path
        try:
            self.path = clean_path
            return super().do_GET()
        finally:
            self.path = orig_path

    def do_POST(self):
        clean_path = self.path.split("?")[0]

        if clean_path in HO_BRIDGE_POST_PATHS:
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len) if content_len > 0 else None
            if proxy_to_bridge(self, method="POST", body=body):
                return
        if clean_path == "/api/fichajes/sync":
            ok, msg = run_sync_task()
            status_code = 200 if ok else 409
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": ok,
                "sync_en_curso": True if ok else sync_running,
                "message": msg,
                "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            }).encode("utf-8"))
            return
        else:
            self.send_response(404)
            self.end_headers()

def main():
    log_server("=" * 60)
    log_server(f"🚀 SERVIDOR LIVE DE FICHAJES SIFU GIRONA v2.1")
    log_server(f"   URL Local:    http://localhost:{PORT}/")
    log_server(f"   API Fichajes: http://localhost:{PORT}/api/fichajes")
    log_server(f"   SSE Stream:   http://localhost:{PORT}/api/fichajes/stream")
    log_server(f"   Health Check: http://localhost:{PORT}/api/fichajes/health")
    log_server("=" * 60)

    # Asegurar que el Supervisor Bridge de SAP HO esté activo
    ensure_supervisor_bridge()

    # Iniciar scheduler automático
    sched_thread = threading.Thread(target=background_scheduler, daemon=True)
    sched_thread.start()

    class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

        def handle_error(self, request, client_address):
            exc_type, exc_val, _ = sys.exc_info()
            if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                return
            super().handle_error(request, client_address)

    server = ThreadedHTTPServer((HOST, PORT), FichajesLiveHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log_server("\nServidor detenido por el usuario.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
