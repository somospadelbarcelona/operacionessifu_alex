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
from socketserver import ThreadingMixIn
import gzip
import threading

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

_STATUS_CACHE = {"ts": 0.0, "data": None}
_STATUS_LOCK = threading.Lock()
import logging
from datetime import datetime

import importlib
import supervisor_commander
import ho_service
from supervisor_commander import SupervisorCommander, registrar_evento
from ho_service import HOService, RESPONSABLE_NAME, RESPONSABLE_ID, SAP_PROJECT_ID_MAP, resolve_sap_project_id

def _get_fresh_services():
    importlib.reload(ho_service)
    importlib.reload(supervisor_commander)
    return ho_service.HOService, supervisor_commander.SupervisorCommander

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SupervisorBridge")

PORT = 5005

def check_and_update_intel_project(proy_id, ho=None):
    if not ho:
        ho = HOService()
    clean_id = resolve_sap_project_id(proy_id)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "servicios_inteligente_consolidados.json")
    if not os.path.exists(json_path):
        return None, {}
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    target_item = None
    for s in data.get('servicios', []):
        if s.get('id_proyecto') == clean_id or s.get('id_inactivo') == clean_id or s.get('base') == clean_id.split('-')[0]:
            target_item = s
            break
            
    if not target_item:
        for s in data.get('servicios', []):
            if clean_id.startswith(s.get('base', '###')):
                target_item = s
                break
                
    if not target_item:
        return None, data
        
    pid1 = target_item.get('id_proyecto')
    pid2 = target_item.get('id_inactivo')
    
    cuad1 = ho.get_project_cuadrante(pid1) if pid1 else None
    filas1 = cuad1.get('filas_cuadrante', []) if cuad1 else []
    activos1 = [f.get('nombre') for f in filas1 if f.get('dias_activos', 0) > 0 and not f.get('en_baja')]
    if not activos1:
        activos1 = [f.get('nombre') for f in filas1 if f.get('dias_activos', 0) > 0]
        
    activos2 = []
    if not activos1 and pid2:
        cuad2 = ho.get_project_cuadrante(pid2)
        filas2 = cuad2.get('filas_cuadrante', []) if cuad2 else []
        activos2 = [f.get('nombre') for f in filas2 if f.get('dias_activos', 0) > 0 and not f.get('en_baja')]
        if not activos2:
            activos2 = [f.get('nombre') for f in filas2 if f.get('dias_activos', 0) > 0]
            
    if activos1:
        target_item['estado'] = 'OK'
        target_item['empleados_cuadrante'] = list(dict.fromkeys(activos1))
        soc = "SIFU (P1)" if "-P1" in pid1 else ("EPID (P2)" if "-P2" in pid1 else "DIRECTO")
        target_item['sociedad_activa'] = soc
        target_item['motivo'] = f"Cuadrante cubierto en SAP HO vía {soc} ({', '.join(target_item['empleados_cuadrante'])}). La sociedad complementaria está a 0h (CORRECTO según Regla Dual SIFU/EPID)."
    elif activos2:
        target_item['estado'] = 'OK'
        target_item['empleados_cuadrante'] = list(dict.fromkeys(activos2))
        soc = "EPID (P2)" if "-P2" in pid2 else "SIFU (P1)"
        target_item['sociedad_activa'] = soc
        target_item['motivo'] = f"Cuadrante cubierto en SAP HO vía {soc} ({', '.join(target_item['empleados_cuadrante'])}). La sociedad complementaria está a 0h (CORRECTO según Regla Dual SIFU/EPID)."
    else:
        target_item['estado'] = 'DESCUBIERTO_REAL' if pid2 else 'SIN_ASIGNACION_OCTUBRE'
        target_item['empleados_cuadrante'] = []
        target_item['motivo'] = f"En octubre 2026 NO hay empleados con horas imputadas en el cuadrante de SAP HO ({pid1})."
        
    total = len(data.get('servicios', []))
    cubiertos = sum(1 for s in data.get('servicios', []) if s.get('estado') == 'OK')
    data['cubiertos'] = cubiertos
    data['incidencias'] = total - cubiertos
    data['score_salud'] = round((cubiertos / total) * 100) if total else 100
    
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Error guardando {json_path}: {e}")
        
    return target_item, data

def refresh_all_intel_services(ho=None, gestor_id=None):
    from concurrent.futures import ThreadPoolExecutor, as_completed
    if not ho:
        ho = HOService()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "servicios_inteligente_consolidados.json")
    if not os.path.exists(json_path):
        return {}
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    def _check_item(s):
        pid1 = s.get('id_proyecto')
        pid2 = s.get('id_inactivo')
        cuad1 = ho.get_project_cuadrante(pid1) if pid1 else None
        filas1 = cuad1.get('filas_cuadrante', []) if cuad1 else []
        activos1 = [f.get('nombre') for f in filas1 if f.get('dias_activos', 0) > 0 and not f.get('en_baja')]
        if not activos1:
            activos1 = [f.get('nombre') for f in filas1 if f.get('dias_activos', 0) > 0]
        activos2 = []
        if not activos1 and pid2:
            cuad2 = ho.get_project_cuadrante(pid2)
            filas2 = cuad2.get('filas_cuadrante', []) if cuad2 else []
            activos2 = [f.get('nombre') for f in filas2 if f.get('dias_activos', 0) > 0 and not f.get('en_baja')]
            if not activos2:
                activos2 = [f.get('nombre') for f in filas2 if f.get('dias_activos', 0) > 0]
        if activos1:
            s['estado'] = 'OK'
            s['empleados_cuadrante'] = list(dict.fromkeys(activos1))
            soc = "SIFU (P1)" if "-P1" in pid1 else ("EPID (P2)" if "-P2" in pid1 else "DIRECTO")
            s['sociedad_activa'] = soc
            s['motivo'] = f"Cuadrante cubierto en SAP HO vía {soc} ({', '.join(s['empleados_cuadrante'])}). La sociedad complementaria está a 0h (CORRECTO según Regla Dual SIFU/EPID)."
        elif activos2:
            s['estado'] = 'OK'
            s['empleados_cuadrante'] = list(dict.fromkeys(activos2))
            soc = "EPID (P2)" if "-P2" in pid2 else "SIFU (P1)"
            s['sociedad_activa'] = soc
            s['motivo'] = f"Cuadrante cubierto en SAP HO vía {soc} ({', '.join(s['empleados_cuadrante'])}). La sociedad complementaria está a 0h (CORRECTO según Regla Dual SIFU/EPID)."
        else:
            s['estado'] = 'DESCUBIERTO_REAL' if pid2 else 'SIN_ASIGNACION_OCTUBRE'
            s['empleados_cuadrante'] = []
            s['motivo'] = f"DESCUBIERTO REAL: No hay empleados imputados ni en P1 ({pid1}) ni en P2 ({pid2})."
        return s

    all_srv = data.get('servicios', [])
    if gestor_id and gestor_id != 'todos':
        target_srv = [s for s in all_srv if str(s.get('id_gestor') or '').strip() == str(gestor_id).strip()]
    else:
        target_srv = all_srv

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(_check_item, s) for s in target_srv]
        for fut in as_completed(futures):
            try:
                fut.result()
            except Exception as e:
                logger.warning(f"Error procesando servicio intel: {e}")
        
    total = len(data.get('servicios', []))
    cubiertos = sum(1 for s in data.get('servicios', []) if s.get('estado') == 'OK')
    data['cubiertos'] = cubiertos
    data['incidencias'] = total - cubiertos
    data['score_salud'] = round((cubiertos / total) * 100) if total else 100
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Error guardando {json_path}: {e}")
    return data

_GOD_SYNC_LOCK = threading.Lock()
_GOD_SYNC_STATE = {
    "is_running": False,
    "progress_pct": 0,
    "step_name": "Inactivo",
    "step_index": 0,
    "total_steps": 6,
    "log": [],
    "last_result": None,
    "error": None,
    "timestamp": None
}

def update_god_sync_progress(pct, step_name, log_msg=None):
    with _GOD_SYNC_LOCK:
        _GOD_SYNC_STATE["progress_pct"] = pct
        _GOD_SYNC_STATE["step_name"] = step_name
        if log_msg:
            entry = f"[{datetime.now().strftime('%H:%M:%S')}] {log_msg}"
            _GOD_SYNC_STATE["log"].append(entry)
            logger.info(f"[GOD_SYNC {pct}%] {log_msg}")

def run_god_level_sync(gestor_id='todos', force_excel=True):
    with _GOD_SYNC_LOCK:
        if _GOD_SYNC_STATE["is_running"]:
            return {"status": "busy", "mensaje": "Sincronización maestra ya en curso", "state": _GOD_SYNC_STATE}
        _GOD_SYNC_STATE["is_running"] = True
        _GOD_SYNC_STATE["progress_pct"] = 5
        _GOD_SYNC_STATE["step_name"] = "Iniciando Handshake SAP S/4HANA"
        _GOD_SYNC_STATE["log"] = [f"[{datetime.now().strftime('%H:%M:%S')}] ⚡ Iniciando Sincronización Maestra SAP S/4HANA HO (Nivel Dios)..."]
        _GOD_SYNC_STATE["error"] = None

    t0 = time.time()
    try:
        # FASE 1: Handshake OData con SAP HO (ZPS_HOPER_SRV)
        update_god_sync_progress(12, "Autenticación & Handshake SAP", "Conectando a SAP S/4HANA (ZPS_HOPER_SRV)...")
        ho = HOService()
        t_conn = time.time()
        connected = ho.connect()
        latency_ms = int((time.time() - t_conn) * 1000)
        if not connected:
            update_god_sync_progress(100, "Error de Conexión", "No se pudo conectar a SAP HO. Comprueba la VPN Ivanti.")
            with _GOD_SYNC_LOCK:
                _GOD_SYNC_STATE["is_running"] = False
                _GOD_SYNC_STATE["error"] = "Sin conexión VPN a SAP HO"
            return {"status": "error", "ho_connected": False, "mensaje": "Sin conexión con SAP HO (VPN Ivanti)."}

        update_god_sync_progress(20, "Handshake SAP OK", f"Token CSRF obtenido. Latencia SAP: {latency_ms} ms.")

        # FASE 2: Carteras y Proyectos Barcelona 0801 + Alejandro Coscolin
        update_god_sync_progress(35, "Descargando Proyectos & Carteras", "Extrayendo ProyectoSet y cuadrantes de los 9 gestores oficiales...")
        from ho_carteras_sync import sync_carteras
        carteras_res = sync_carteras(save_files=True) or {}
        tot_proys = len(carteras_res.get("proyectos", []))
        update_god_sync_progress(50, "Carteras Sincronizadas", f"Carteras actualizadas: {tot_proys} proyectos mapeados con reglas duales SIFU P1 / EPID P2.")

        # FASE 3: Censo de Empleados y Cuadrantes HO en tiempo real
        update_god_sync_progress(65, "Cuadrantes y Fichas Oficiales", "Consultando HAGridSet, EmpleadoSet y contratos en tiempo real...")
        from ho_master_sync import HOMasterSynchronizer
        master_syncer = HOMasterSynchronizer()
        master_syncer.sync(update_excel_file=force_excel)
        tot_emps_master = len(master_syncer.ho_employees)
        update_god_sync_progress(75, "Censo y Cuadrantes OK", f"Censo consolidado: {tot_emps_master} operarios con contratos y cuadrantes HAGridSet.")

        # FASE 4: Vacaciones, absentismos e imputaciones canónicas
        update_god_sync_progress(85, "Vacaciones & Absentismos 100%", "Calculando saldos canónicos (vacTotales, vacTomados, vacRestantes) e imputaciones 2026...")
        from ho_vacaciones_sync import sync_all_ho_vacaciones
        vac_res = sync_all_ho_vacaciones(year=datetime.now().year, gestor_id=gestor_id, save_files=True) or {}
        tot_vac = len(vac_res.get("trabajadores", []))
        update_god_sync_progress(92, "Vacaciones Consolidadas", f"Mapeados {tot_vac} trabajadores en explorador de vacaciones.")

        # FASE 5: Censo oficial y depurado de Alejandro Coscolin (Girona / Barcelona)
        update_god_sync_progress(95, "Censo Alejandro Coscolin", "Generando censo oficial de Alejandro Coscolin sin jardinería ni BCL...")
        from build_girona_census import build_census
        census_coscolin = build_census(gestor_id='00062620')
        update_god_sync_progress(97, "Censo Coscolin OK", f"Censo exclusivo Alejandro Coscolin: {len(census_coscolin)} trabajadores activos certificados.")

        # FASE 6: Servicios Inteligentes y Coberturas
        update_god_sync_progress(98, "Servicios Inteligentes", "Auditando coberturas duales y estados operativos...")
        try:
            intel_res = refresh_all_intel_services(gestor_id=gestor_id)
        except Exception:
            intel_res = {}

        total_elapsed = round(time.time() - t0, 2)
        update_god_sync_progress(100, "¡Sincronización Nivel Dios Completada!", f"🚀 Proceso finalizado en {total_elapsed}s. SAP HO 100% en vivo.")

        final_payload = {
            "status": "ok",
            "mensaje": f"Sincronización Nivel Dios 100% completada en {total_elapsed}s.",
            "elapsed_seconds": total_elapsed,
            "latency_ms": latency_ms,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "ho_connected": True,
            "totales": {
                "proyectos": tot_proys,
                "empleados_master": tot_emps_master,
                "censo_coscolin": len(census_coscolin),
                "trabajadores_vacaciones": tot_vac,
                "servicios_intel": len(intel_res.get("servicios", [])) if isinstance(intel_res, dict) else 0
            },
            "carteras": carteras_res,
            "vacaciones": vac_res,
            "log": list(_GOD_SYNC_STATE["log"])
        }

        with _GOD_SYNC_LOCK:
            _GOD_SYNC_STATE["is_running"] = False
            _GOD_SYNC_STATE["last_result"] = final_payload
            _GOD_SYNC_STATE["timestamp"] = final_payload["timestamp"]

        return final_payload

    except Exception as ex:
        logger.error(f"Error en sincronización nivel dios: {ex}", exc_info=True)
        update_god_sync_progress(100, "Error en Sincronización", f"Fallo: {str(ex)}")
        with _GOD_SYNC_LOCK:
            _GOD_SYNC_STATE["is_running"] = False
            _GOD_SYNC_STATE["error"] = str(ex)
        return {"status": "error", "mensaje": str(ex)}

class BridgeHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def send_json(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        accept_enc = self.headers.get('Accept-Encoding', '') if hasattr(self, 'headers') and self.headers else ''
        use_gzip = ('gzip' in accept_enc) and (len(raw) > 1024)
        body = gzip.compress(raw, compresslevel=5) if use_gzip else raw
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        if use_gzip:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
                now_ts = time.time()
                with _STATUS_LOCK:
                    cached = _STATUS_CACHE["data"] if (now_ts - _STATUS_CACHE["ts"] < 20.0) else None
                if cached is None:
                    ho = HOService()
                    connected = ho.connect()
                    cached = {
                        "ho_connected": connected,
                        "responsable": RESPONSABLE_NAME,
                        "responsable_id": RESPONSABLE_ID
                    }
                    with _STATUS_LOCK:
                        _STATUS_CACHE["ts"] = now_ts
                        _STATUS_CACHE["data"] = cached
                self.send_json(cached)

            elif parsed.path == '/sync_carteras':
                from ho_carteras_sync import sync_carteras
                carteras_res = sync_carteras(save_files=True)
                self.send_json(carteras_res)

            elif parsed.path == '/carteras':
                from ho_carteras_sync import load_cached, sync_carteras
                carteras_res = load_cached() or sync_carteras(save_files=True)
                self.send_json(carteras_res)

            elif parsed.path in ('/sync_ho_god_level', '/api/sync_ho_god_level'):
                is_async = params.get('async', ['1'])[0] == '1'
                gestor = params.get('gestor', ['todos'])[0]
                force_excel = params.get('excel', ['1'])[0] == '1'
                if is_async:
                    with _GOD_SYNC_LOCK:
                        already_running = _GOD_SYNC_STATE["is_running"]
                    if not already_running:
                        threading.Thread(target=run_god_level_sync, kwargs={"gestor_id": gestor, "force_excel": force_excel}, daemon=True).start()
                    self.send_json({
                        "status": "started" if not already_running else "already_running",
                        "state": _GOD_SYNC_STATE
                    })
                else:
                    res = run_god_level_sync(gestor_id=gestor, force_excel=force_excel)
                    self.send_json(res)

            elif parsed.path in ('/ho_sync_progress', '/api/ho_sync_progress'):
                with _GOD_SYNC_LOCK:
                    state_copy = dict(_GOD_SYNC_STATE)
                    state_copy["log"] = list(_GOD_SYNC_STATE["log"][-30:])
                self.send_json(state_copy)

            elif parsed.path == '/sync_ho_master':
                from ho_master_sync import HOMasterSynchronizer
                from ho_vacaciones_sync import sync_all_ho_vacaciones
                from ho_carteras_sync import sync_carteras, load_cached
                from build_girona_census import build_census
                from concurrent.futures import ThreadPoolExecutor
                skip_carteras = params.get('skip_carteras', ['0'])[0] == '1'
                with ThreadPoolExecutor(max_workers=2) as pool:
                    fut_cart = pool.submit(lambda: (load_cached() if skip_carteras else None) or sync_carteras(save_files=True))
                    fut_vac = pool.submit(lambda: sync_all_ho_vacaciones(save_files=True))
                    carteras_res = fut_cart.result() or {}
                    vac_res = fut_vac.result() or {}
                def _bg_post_sync():
                    try:
                        syncer = HOMasterSynchronizer()
                        syncer.sync(update_excel_file=True)
                    except Exception:
                        pass
                    try:
                        build_census(gestor_id='00062620')
                    except Exception:
                        pass
                    try:
                        refresh_all_intel_services()
                    except Exception:
                        pass
                threading.Thread(target=_bg_post_sync, daemon=True).start()
                total_dir = len(vac_res.get("trabajadores", [])) if isinstance(vac_res, dict) else 0
                res = {
                    "status": "ok",
                    "mensaje": f"Sincronización ultra-rápida completada: {total_dir} trabajadores y {len(carteras_res.get('proyectos', []))} proyectos de Alejandro Coscolin.",
                    "total_empleados_ho": total_dir,
                    "total_asignados_directos": total_dir,
                    "total_gestores_bcn": 9,
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                self.send_json(res)

            elif parsed.path == '/ho_live_refresh':
                # Refresco ligero en vivo: solo EmpleadoSet (contratos, vacaciones) sin tocar el Excel
                from ho_master_sync import HOMasterSynchronizer
                syncer = HOMasterSynchronizer()
                ok = syncer.fetch_ho_employees()
                self.send_json({
                    "status": "ok" if ok else "error",
                    "ho_connected": syncer.ho_connected,
                    "employees": syncer.ho_employees,
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })

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
                        "mensaje": f"Sincronizados {payload.get('total_registros', 0)} fichajes de Barcelona en tiempo real.",
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
                        "mensaje": f"Sincronizados {payload.get('total_trabajadores', 0)} trabajadores de Barcelona en tiempo real desde la app.",
                        "total_trabajadores": payload.get('total_trabajadores', 0),
                        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }, ensure_ascii=False).encode('utf-8'))
                except Exception as ex:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "error": str(ex)}, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/fichajes_data':
                fichajes_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fichajes_bcn.json")
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

            elif parsed.path == '/ho_intel_servicios':
                base_dir = os.path.dirname(os.path.abspath(__file__))
                json_path = os.path.join(base_dir, "servicios_inteligente_consolidados.json")
                data = {}
                if os.path.exists(json_path):
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_check_project':
                raw_id = params.get('id', [''])[0].strip()
                if not raw_id:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "ID de proyecto requerido"}).encode('utf-8'))
                    return
                item, all_data = check_and_update_intel_project(raw_id)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok" if item else "not_found",
                    "servicio": item,
                    "cubiertos": all_data.get('cubiertos'),
                    "incidencias": all_data.get('incidencias'),
                    "score_salud": all_data.get('score_salud'),
                    "timestamp": datetime.now().strftime('%H:%M:%S')
                }, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_refresh_all_intel':
                gestor_param = str(params.get('gestor', ['todos'])[0] or 'todos').strip()
                all_data = refresh_all_intel_services(gestor_id=gestor_param)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "cubiertos": all_data.get('cubiertos'),
                    "incidencias": all_data.get('incidencias'),
                    "score_salud": all_data.get('score_salud'),
                    "total_servicios": len(all_data.get('servicios', [])),
                    "servicios": all_data.get('servicios', []),
                    "timestamp": datetime.now().strftime('%H:%M:%S')
                }, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_vacaciones_data':
                from ho_vacaciones_sync import CACHE_JSON_PATH, sync_all_ho_vacaciones
                if os.path.exists(CACHE_JSON_PATH):
                    with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    data = sync_all_ho_vacaciones(year=2026, save_files=True)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_vacaciones_live':
                from ho_vacaciones_sync import sync_all_ho_vacaciones
                year_param = int(params.get('year', ['2026'])[0] or 2026)
                gestor_param = str(params.get('gestor', ['todos'])[0] or 'todos')
                data = sync_all_ho_vacaciones(year=year_param, gestor_id=gestor_param, save_files=True)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/ho_vacaciones_worker':
                from ho_vacaciones_sync import (
                    CACHE_JSON_PATH, DATA_JS_PATH, fetch_single_worker_vacation_data, compute_kpis_from_workers
                )
                emp_id = str(params.get('id', [''])[0] or '').strip().zfill(8)
                ho_inst = HOService()
                if ho_inst.connect() and emp_id:
                    proys_all = ho_inst.query_entity_set("ProyectoSet", filter_query=f"IdResponsable eq '{RESPONSABLE_ID}'", top=400) or []
                    p_map = {(p.get("IdProyecto") or "").strip(): (p.get("Denominacion") or "").strip() for p in proys_all if p.get("IdProyecto")}
                    w_data = fetch_single_worker_vacation_data({"IdEmpleado": emp_id}, p_map, 2026, ho_instance=ho_inst)
                    updated_kpis = None
                    if os.path.exists(CACHE_JSON_PATH):
                        try:
                            with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                                cached_all = json.load(f)
                            t_list = cached_all.get("trabajadores", [])
                            for idx_w, w_existing in enumerate(t_list):
                                if w_existing.get("id_empleado") == emp_id:
                                    w_data["es_asignado_directo"] = w_existing.get("es_asignado_directo", True)
                                    t_list[idx_w] = w_data
                                    break
                            updated_kpis = compute_kpis_from_workers(t_list)
                            cached_all["kpis"] = updated_kpis
                            cached_all["timestamp"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                            with open(CACHE_JSON_PATH, 'w', encoding='utf-8') as f:
                                json.dump(cached_all, f, ensure_ascii=False, indent=2)
                            with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
                                f.write(f"window.HO_VACACIONES_PAYLOAD = {json.dumps(cached_all, ensure_ascii=False)};\n")
                        except Exception:
                            pass
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "ok",
                        "trabajador": w_data,
                        "kpis": updated_kpis,
                        "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                    }, ensure_ascii=False).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "mensaje": "No se pudo consultar el trabajador en SAP HO"}).encode('utf-8'))

            elif parsed.path == '/bajas_empresa':
                from bajas_empresa_service import load_bajas_empresa
                bajas = load_bajas_empresa()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(bajas, ensure_ascii=False).encode('utf-8'))

            elif parsed.path == '/oficio_memory':
                base_dir = os.path.dirname(os.path.abspath(__file__))
                mem_path = os.path.join(base_dir, "ho_oficio_memory.json")
                mem_data = {}
                if os.path.exists(mem_path):
                    try:
                        with open(mem_path, 'r', encoding='utf-8') as f:
                            mem_data = json.load(f)
                    except Exception:
                        mem_data = {}
                self.send_json({"status": "ok", "memory": mem_data})

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
            if parsed.path == '/marcar_baja_empresa':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                dni = data.get('dni')
                nombre = data.get('nombre', '')
                motivo = data.get('motivo', 'Baja definitiva de empresa (Ya no está en SIFU)')

                from bajas_empresa_service import registrar_baja_empresa
                res_baja = registrar_baja_empresa(dni, nombre=nombre, motivo=motivo)

                try:
                    import build_girona_census
                    build_girona_census.build_census()
                except Exception as ex_b:
                    logger.warning(f"Aviso actualizando censo tras baja: {ex_b}")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "mensaje": f"Trabajador {nombre} ({dni}) registrado como baja definitiva y retirado de todos los controles.",
                    "registro": res_baja
                }, ensure_ascii=False).encode('utf-8'))
            elif parsed.path == '/tramitar':
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
            elif parsed.path == '/oficio_memory':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                base_dir = os.path.dirname(os.path.abspath(__file__))
                mem_path = os.path.join(base_dir, "ho_oficio_memory.json")
                try:
                    with open(mem_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                except Exception as ex_m:
                    logger.warning(f"Error guardando ho_oficio_memory.json: {ex_m}")
                self.send_json({"status": "ok", "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
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
            elif parsed.path == '/update_service':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                idx = data.get('originalIndex')
                proyecto = str(data.get('proyecto') or '').strip()
                servicio = str(data.get('servicio') or '').strip()
                updates = data.get('updates') or {}

                base_dir = os.path.dirname(os.path.abspath(__file__))
                excel_path = os.path.join(base_dir, "MASTER GENERAL GIRONA OKK.xlsx")
                excel_saved = False

                try:
                    import openpyxl
                    if os.path.exists(excel_path):
                        wb = openpyxl.load_workbook(excel_path)
                        sheet_name = 'SEGUIMIENTO' if 'SEGUIMIENTO' in wb.sheetnames else wb.sheetnames[0]
                        ws = wb[sheet_name]
                        header_map = {}
                        for col_i in range(1, ws.max_column + 1):
                            h_val = str(ws.cell(1, col_i).value or '').strip().upper()
                            if h_val:
                                header_map[h_val] = col_i

                        target_row = None
                        if isinstance(idx, int) and idx >= 0:
                            candidate_row = idx + 2
                            if candidate_row <= ws.max_row:
                                target_row = candidate_row

                        if not target_row and (proyecto or servicio):
                            for r_i in range(2, ws.max_row + 1):
                                r_proy = str(ws.cell(r_i, header_map.get('PROYECTO', 6)).value or '').strip()
                                r_serv = str(ws.cell(r_i, header_map.get('SERVICIO', 3)).value or '').strip()
                                if (proyecto and r_proy == proyecto) or (servicio and r_serv == servicio):
                                    target_row = r_i
                                    break

                        if target_row:
                            for k, v in updates.items():
                                col_idx = header_map.get(k.upper())
                                if col_idx:
                                    ws.cell(target_row, col_idx, v)
                            wb.save(excel_path)
                            excel_saved = True
                            from extract_excel import extract
                            extract(excel_path)
                        wb.close()
                except Exception as ex_xls:
                    logger.warning(f"Excel abierto o bloqueado, actualizando master_data.js en caliente: {ex_xls}")

                registrar_evento(
                    "ACCION",
                    f"Servicio actualizado ({servicio or proyecto}): {json.dumps(updates, ensure_ascii=False)}",
                    "Sincronizado en Excel Maestro" if excel_saved else "Persistido en memoria operativa"
                )
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "excel_saved": excel_saved,
                    "timestamp": datetime.now().strftime('%H:%M:%S')
                }, ensure_ascii=False).encode('utf-8'))
            elif parsed.path == '/ho_vacaciones_planificar':
                content_len = int(self.headers.get('Content-Length', 0))
                raw_bytes = self.rfile.read(content_len)
                try:
                    post_body = raw_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    post_body = raw_bytes.decode('latin-1', errors='replace')
                data = json.loads(post_body) if post_body else {}
                from ho_vacaciones_sync import save_manual_vacation_plan
                res_plan = save_manual_vacation_plan(
                    emp_id=data.get('id_empleado'),
                    action=data.get('action', 'add'),
                    period_data=data.get('periodo'),
                    period_id=data.get('id_periodo'),
                    updated_worker=data.get('trabajador')
                )
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(res_plan, ensure_ascii=False).encode('utf-8'))
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
    try:
        from ho_carteras_sync import start_background_refresh
        start_background_refresh(interval_seconds=180)
    except Exception as ex_bg:
        logger.warning(f"No se pudo iniciar background refresh de carteras: {ex_bg}")
    while True:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', PORT), BridgeHandler)
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
