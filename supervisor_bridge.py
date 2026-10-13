# -*- coding: utf-8 -*-
"""
SUPERVISOR BRIDGE - Servidor de Comunicación en Tiempo Real
Permite que el Dashboard Web ejecute comandos directos sobre SAP HO,
reciba los datos en milisegundos y los muestre en pantalla en vivo sin alertas molestas.
"""

import os
import sys
import json
import time
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import logging
from datetime import datetime

from supervisor_commander import SupervisorCommander, registrar_evento
from ho_service import HOService, RESPONSABLE_NAME, RESPONSABLE_ID, SAP_PROJECT_ID_MAP, resolve_sap_project_id

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SupervisorBridge")

PORT = 5005

class BridgeHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            if parsed.path == '/cmd':
                cmd_text = params.get('q', [''])[0]
                commander = SupervisorCommander()
                res = commander.ejecutar_comando_in_situ(cmd_text)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/tramitar':
                params_flat = {k: v[0] for k, v in params.items()}
                commander = SupervisorCommander()
                res = commander.ejecutar_tramite_operativo(params_flat)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/status':
                ho = HOService()
                connected = ho.connect()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                data = {
                    "ho_connected": connected,
                    "responsable": RESPONSABLE_NAME,
                    "responsable_id": RESPONSABLE_ID
                }
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/sync_ho_master':
                from ho_master_sync import HOMasterSynchronizer
                syncer = HOMasterSynchronizer()
                ok = syncer.sync(update_excel_file=True)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                res = {
                    "status": "ok" if ok else "error",
                    "mensaje": "Sincronización en tiempo real completada entre SAP HO y Excel Maestro.",
                    "total_empleados_ho": len(syncer.ho_employees),
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/sync_fichajes':
                from fichajes_sync import extraer_fichajes
                import asyncio
                desde = params.get('desde', ['01/10/2026'])[0]
                hasta = params.get('hasta', ['31/10/2026'])[0]
                try:
                    payload = asyncio.run(extraer_fichajes(fecha_desde=desde, fecha_hasta=hasta))
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "ok",
                        "mensaje": f"Sincronizados {payload.get('total_registros', 0)} fichajes de Girona en tiempo real.",
                        "total_registros": payload.get('total_registros', 0),
                        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }, ensure_ascii=False).encode('utf-8'))
                except Exception as ex:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
            elif parsed.path == '/sync_contraste':
                from fichajes_sync_gcalidad_app import sync_all_workers
                import asyncio
                try:
                    payload = asyncio.run(sync_all_workers())
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "ok",
                        "mensaje": f"Sincronizados {payload.get('total_trabajadores', 0)} trabajadores de Girona en tiempo real desde la app.",
                        "total_trabajadores": payload.get('total_trabajadores', 0),
                        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }, ensure_ascii=False).encode('utf-8'))
                except Exception as ex:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "error": str(ex)}, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/fichajes_data':
                fichajes_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fichajes_girona.json")
                data = {}
                if os.path.exists(fichajes_file):
                    with open(fichajes_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_employees':
                from ho_master_sync import CACHE_FILE
                data = {}
                if os.path.exists(CACHE_FILE):
                    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/proy_url':
                raw_id = params.get('id', [''])[0].strip()
                proy_id = resolve_sap_project_id(raw_id)
                encoded_param = urllib.parse.quote(json.dumps({"value": proy_id, "type": "Edm.String"}, separators=(',', ':')))
                url = f"http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#/projectDetail/{encoded_param}" if proy_id else "http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#/Projects"
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"url": url, "proyecto": proy_id}, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/empleados_proyecto':
                raw_id = params.get('id', [''])[0].strip()
                proy_id = resolve_sap_project_id(raw_id)
                if not proy_id:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "ID de proyecto requerido"}).encode('utf-8'))
                    return

                ho = HOService()
                cuad_info = ho.get_project_cuadrante(proy_id) or {}
                empleados = cuad_info.get("empleados_proyecto") or ho.query_entity_set("EmpleadoProyectoSet", filter_query=f"IdProyecto eq '{proy_id}'") or []
                bajas = ho.get_employee_bajas() or []
                bajas_ids = {str(b.get('IdEmpleado')).strip().zfill(8) for b in bajas}

                commander = SupervisorCommander()
                servicios_m = [
                    s for s in commander.supervisor.master_services
                    if resolve_sap_project_id(s.get('PROYECTO', '')).upper() == proy_id.upper()
                ]

                res_list = []
                for emp in empleados:
                    emp_id = str(emp.get('id_empleado') or emp.get('IdEmpleado') or '').strip().zfill(8)
                    nombre = (emp.get('nombre') or emp.get('Nombre') or '').strip()
                    es_baja = emp_id in bajas_ids
                    es_titular = any(str(s.get('TITULAR', '')).strip().upper() in nombre.upper() for s in servicios_m)

                    res_list.append({
                        "id": emp_id,
                        "nombre": nombre,
                        "dni": emp.get('dni') or emp.get('DNI') or '',
                        "familia": emp.get('familia') or emp.get('IdFamilia') or '',
                        "estado": "BAJA IT" if es_baja else "ACTIVO",
                        "es_titular": es_titular
                    })

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "proyecto": proy_id,
                    "total": len(res_list),
                    "empleados": res_list,
                    "turnos": cuad_info.get("turnos", []),
                    "filas_cuadrante": cuad_info.get("filas_cuadrante", [])
                }, ensure_ascii=False).encode('utf-8'))

            else:
                self.send_response(404)
                self.end_headers()
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            logger.error(f"Error procesando petición HTTP GET: {e}")

    def do_POST(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == '/tramitar':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                commander = SupervisorCommander()
                res = commander.ejecutar_tramite_operativo(data)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
            elif parsed.path == '/verify_cmh_excel':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                from cmh_service import verificar_registros_excel_cmh
                filename = data.get('filename', 'Excel Subido')
                records = data.get('records', [])
                huerfanos = data.get('huerfanos', None)
                informe = verificar_registros_excel_cmh(records, nombre_archivo=filename, huerfanos_entrantes=huerfanos)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(informe, ensure_ascii=False).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            logger.error(f"Error procesando petición HTTP POST: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "mensaje": str(e)}).encode('utf-8'))

    def log_message(self, format, *args):
        pass

def run_server():
    while True:
        try:
            server = HTTPServer(('127.0.0.1', PORT), BridgeHandler)
            logger.info(f"Supervisor Bridge Server activo en http://127.0.0.1:{PORT}")
            server.serve_forever()
        except KeyboardInterrupt:
            logger.info("Deteniendo Supervisor Bridge Server...")
            break
        except Exception as e:
            logger.warning(f"Excepción en el servidor: {e}. Reintentando en 2 segundos...")
            time.sleep(2)

if __name__ == '__main__':
    run_server()
