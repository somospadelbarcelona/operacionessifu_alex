# -*- coding: utf-8 -*-
"""
HO MASTER SYNC - Sincronizador en Tiempo Real entre SAP HO y Excel Maestro
Cruza el censo de empleados y proyectos de SAP HO con MASTER GENERAL GIRONA OKK.xlsx
y enriquece los datos en master_data.js y en el propio Excel.
"""

import os
import sys
import re
import json
import time
import shutil
import unicodedata
from datetime import datetime
import openpyxl

# Forzar encoding UTF-8
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "MASTER GENERAL GIRONA OKK.xlsx")
OUTPUT_JS = os.path.join(BASE_DIR, "master_data.js")
CACHE_FILE = os.path.join(BASE_DIR, "ho_employees_cache.json")
CUADRANTES_CACHE_FILE = os.path.join(BASE_DIR, "ho_cuadrantes_cache.json")

from ho_service import HOService, RESPONSABLE_ID, SAP_PROJECT_ID_MAP, resolve_sap_project_id

def normalize_name(name):
    if not name:
        return ""
    n = unicodedata.normalize('NFKD', str(name)).encode('ASCII', 'ignore').decode('utf-8')
    n = re.sub(r'[^A-Z0-9\s]', ' ', n.upper())
    return " ".join(n.split())

def parse_sap_date(d_str):
    if not d_str:
        return "Indefinido", None
    try:
        ts = int(d_str.replace('/Date(', '').replace(')/', '')) / 1000
        dt = datetime.fromtimestamp(ts)
        days_left = (dt.date() - datetime.now().date()).days
        return dt.strftime('%d/%m/%Y'), days_left
    except Exception:
        return str(d_str).strip(), None

# Reglas verificadas en vivo contra SAP HO (HAGridSet + EmpleadoProyectoSet) con PRIORIDAD ABSOLUTA
# Formato por fila de SEGUIMIENTO: {col_name: valor_oficial_sap_ho}
SAP_HO_ROW_OVERRIDES = {
    2:  {"PROYECTO": "SVO04295-P1-C018", "ESTADO": "BAJA IT",  "TITULAR": "ERNESTO MALO HERRERO",          "SUPL": "SAHIL SINGH ARORA"},
    3:  {"PROYECTO": "SVO04298-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "JOSE MANUEL GUTIERREZ PACHECO", "SUPL": "PEDRO FERNANDEZ RIBAS"},
    5:  {"PROYECTO": "SVO04296-P1-C018", "ESTADO": "BAJA IT",  "TITULAR": "MONICA LOPEZ CEBALLOS",         "SUPL": "SAHIL SINGH ARORA"},
    8:  {"PROYECTO": "SVO01227-P2-C001", "ESTADO": "CUBIERTO", "TITULAR": "JUAN BONADA GONZALEZ",          "SUPL": "SAHIL SINGH ARORA", "HORARIO": "Según cuadrante albergue"},
    9:  {"PROYECTO": "SVO01227-P1-C018", "ESTADO": "BAJA IT",  "TITULAR": "JORGE LUIS RAMIREZ SALAS",      "SUPL": "SAHIL SINGH ARORA"},
    12: {"PROYECTO": "SVO04295-P2-C001", "ESTADO": "CUBIERTO", "TITULAR": "SAHIL SINGH ARORA"},
    14: {"PROYECTO": "SVO01232-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MOHAMED UAHLET",                "SUPL": "MOHAMED BELLAHCEN"},
    16: {"PROYECTO": "SVO12611-P2-C018", "ESTADO": "BAJA IT",  "TITULAR": "CARLOS MARTINEZ VILANOVA",      "SUPL": "NIL BAZAN SERES"},
    20: {"PROYECTO": "SVO12611-P2-C018", "ESTADO": "BAJA IT",  "TITULAR": "JOSE MANUEL CARRERA MATEOS",    "SUPL": "JOSE ANTONIO SOLA EXPOSITO"},
    25: {"PROYECTO": "SVO12611-P1-C017", "ESTADO": "CUBIERTO", "TITULAR": "RAUL GONZALEZ EXPOSITO",        "HORARIO": "06:00 a 14:00"},
    26: {"PROYECTO": "SVO10033-P1-C017", "ESTADO": "CUBIERTO", "TITULAR": "MARIA MOLINA PEREZ",            "HORARIO": "07:00 a 13:00 / 12:00 a 16:30"},
    27: {"PROYECTO": "SVO10033-P2-C018", "ESTADO": "CUBIERTO", "TITULAR": "MARIA MOLINA PEREZ",            "HORARIO": "L-V 07:00 a 13:00"},
    28: {"PROYECTO": "SVO02267-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "JUAN JOSE GARCIA MANZANEQUE",   "ESTADO1": "BAJA IT", "SUPL": "IRENE MASSANET MASPOCH", "HORARIO": "L-V 16:00 a 21:00"},
    29: {"PROYECTO": "SVO02267-P1-C018", "ESTADO": "BAJA IT",  "TITULAR": "JULIAN CANO GALLEGO",           "SUPL": "JOSEP MADI ARIZA"},
    35: {"PROYECTO": "SVO13762-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MOHAMED BELLAHCEN",             "SUPL": "LAURA PARDILLO LOPEZ", "HORARIO": "Puntual según cliente"},
    39: {"PROYECTO": "PROY008324-P1",    "ESTADO": "CUBIERTO", "TITULAR": "MOHAMMED ETTMALAH",             "HORARIO": "JUEVES 09:15 a 11:15"},
    40: {"PROYECTO": "PROY08324-P2-C001","ESTADO": "CUBIERTO", "TITULAR": "CARMEN ALSINA MENA",            "HORARIO": "L-V 14:30 a 16:30"},
    41: {"PROYECTO": "SVO06316-P2-C001", "ESTADO": "CUBIERTO", "TITULAR": "REDA JAIT",                     "SUPL": "SERGIO REDONDO VELAZQUEZ", "HORARIO": "09:00 a 14:00"},
    43: {"PROYECTO": "SVO06315-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MONICA GALA SEGURA",            "HORARIO": "L-V 12:15 a 15:00"},
    44: {"PROYECTO": "SVO06834-P1-C018", "ESTADO": "BAJA IT",  "TITULAR": "ALEXIA DOMINGUEZ MARSIÑACH",    "SUPL": "CARLA MASSANELLAS SAURA / BLAS P", "HORARIO": "19:00 a 02:00"},
    48: {"PROYECTO": "SVO03143-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MONICA GALA SEGURA",            "HORARIO": "09:00 a 12:00"},
    49: {"PROYECTO": "PROY018780-P1",    "ESTADO": "CUBIERTO", "TITULAR": "MALIKA CHRIF",                  "HORARIO": "JUEVES 09:00 a 10:00"},
    52: {"PROYECTO": "PIEC018171",       "ESTADO": "CUBIERTO", "TITULAR": "MALIKA CHRIF",                  "SUPL": "MOHAMED BELLAHCEN", "HORARIO": "LUNES 10:00 a 11:00"},
    53: {"PROYECTO": "PGOC018171L",      "ESTADO": "CUBIERTO", "TITULAR": "LAURA PARDILLO LOPEZ",          "SUPL": "EL HASSANE JEDDOUB", "HORARIO": "06:00 a 14:00"},
    54: {"PROYECTO": "PGOC018171J",      "ESTADO": "CUBIERTO", "TITULAR": "MOHAMED BELLAHCEN",             "HORARIO": "Según cuadrante SAP HO"},
    55: {"PROYECTO": "SVO06910-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MOHAMMED ETTMALAH",             "HORARIO": "08:00 a 12:00"},
    57: {"PROYECTO": "SVO08572-P1-C018", "ESTADO": "CUBIERTO", "TITULAR": "MOHAMMED ETTMALAH",             "HORARIO": "12:00 a 15:00"},
    58: {"PROYECTO": "PROY015529-P1",    "ESTADO": "CUBIERTO", "TITULAR": "SERENE DELGADO USERO",          "HORARIO": "L-V según cuadrante"},
}

class HOMasterSynchronizer:
    def __init__(self):
        self.ho = HOService()
        self.ho_connected = False
        self.ho_employees = {} # norm_name -> emp_dict
        self.ho_dni_map = {}   # dni -> emp_dict
        self.ho_cuadrantes = {} # proy_id -> cuadrante_dict

    def fetch_ho_employees(self):
        """Descarga todos los empleados de Girona de SAP HO."""
        self.ho_connected = self.ho.connect()
        if not self.ho_connected:
            # Cargar desde caché si existe
            if os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                        cached = json.load(f)
                    self.ho_employees = cached.get('by_name', {})
                    self.ho_dni_map = cached.get('by_dni', {})
                    print(f"[CACHE] Cargados {len(self.ho_employees)} empleados desde cache local de HO.")
                    return True
                except Exception as e:
                    print(f"[WARN] Error leyendo cache: {e}")
            return False

        all_emps = []
        for centro in ['S171', 'S172', 'B171']:
            res = self.ho.query_entity_set("EmpleadoSet", filter_query=f"IdCentro eq '{centro}'", top=500)
            if res:
                all_emps.extend(res)

        # Mapear y procesar empleados
        self.ho_employees = {}
        self.ho_dni_map = {}

        for e in all_emps:
            fin_str, days_left = parse_sap_date(e.get('FinContrato'))
            ini_str, _ = parse_sap_date(e.get('InicioContrato'))

            processed = {
                "id_empleado": e.get('IdEmpleado'),
                "nombre_completo": (e.get('NombreCompleto') or '').strip(),
                "dni": (e.get('DNI') or '').strip(),
                "telefono": (e.get('Telefono') or '').strip(),
                "email": (e.get('Email') or '').strip(),
                "id_centro": e.get('IdCentro'),
                "nom_centro": e.get('NomCentro'),
                "id_tipo_contrato": e.get('IdTipoContrato'),
                "tipo_contrato": e.get('DenTipoContrato') or ('Fijo' if fin_str == 'Indefinido' else 'Temporal'),
                "inicio_contrato": ini_str,
                "fin_contrato": fin_str,
                "dias_fin_contrato": days_left,
                "vac_totales": int(e.get('vacTotales') or 0),
                "vac_tomados": int(e.get('vacTomados') or 0),
                "vac_restantes": int(e.get('vacRestantes') or 0),
                "horas_semana": e.get('HorasSemana')
            }

            norm = normalize_name(processed['nombre_completo'])
            if norm:
                self.ho_employees[norm] = processed
            if processed['dni']:
                self.ho_dni_map[processed['dni']] = processed

        # Guardar en cache para resiliencia offline
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    "by_name": self.ho_employees,
                    "by_dni": self.ho_dni_map
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[WARN] No se pudo guardar cache: {e}")

        print(f"[OK] Sincronizados {len(self.ho_employees)} empleados de Girona desde SAP HO.")
        return True

    def fetch_ho_cuadrantes(self, project_ids):
        """Descarga los cuadrantes reales (HAGridSet + EmpleadoProyectoSet) de los proyectos indicados y los guarda en ho_cuadrantes_cache.json."""
        if not self.ho_connected and not self.ho.connect():
            if os.path.exists(CUADRANTES_CACHE_FILE):
                try:
                    with open(CUADRANTES_CACHE_FILE, 'r', encoding='utf-8') as f:
                        cached = json.load(f)
                    self.ho_cuadrantes = cached.get('projects', {})
                    print(f"[CACHE] Cargados cuadrantes de {len(self.ho_cuadrantes)} proyectos desde ho_cuadrantes_cache.json.")
                    return True
                except Exception as e:
                    print(f"[WARN] Error leyendo ho_cuadrantes_cache.json: {e}")
            return False

        from concurrent.futures import ThreadPoolExecutor, as_completed
        unique_pids = sorted(list({str(p).strip() for p in project_ids if p and str(p).strip()}))

        def _fetch_one(pid):
            ho_worker = HOService()
            ho_worker.csrf_token = self.ho.csrf_token
            ho_worker.is_connected = True
            return pid, ho_worker.get_project_cuadrante(pid)

        self.ho_cuadrantes = {}
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(_fetch_one, pid) for pid in unique_pids]
            for fut in as_completed(futures):
                try:
                    pid, data = fut.result()
                    if data:
                        self.ho_cuadrantes[pid] = data
                except Exception as e:
                    print(f"[WARN] Error descargando cuadrante: {e}")

        try:
            with open(CUADRANTES_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    "responsable_id": RESPONSABLE_ID,
                    "total_proyectos": len(self.ho_cuadrantes),
                    "projects": self.ho_cuadrantes
                }, f, ensure_ascii=False, indent=2)
            print(f"[OK] Descargados y guardados cuadrantes de {len(self.ho_cuadrantes)} proyectos en ho_cuadrantes_cache.json.")
        except Exception as e:
            print(f"[WARN] No se pudo guardar ho_cuadrantes_cache.json: {e}")
        return True

    def find_employee(self, raw_name):
        """Búsqueda exacta y difusa de un empleado por nombre."""
        if not raw_name:
            return None
        norm = normalize_name(raw_name)
        if not norm or 'FALTA' in norm or 'SIN TITULAR' in norm:
            return None

        # 1. Coincidencia exacta normalizada
        if norm in self.ho_employees:
            return self.ho_employees[norm]

        # 2. Subcadena directa
        for k, v in self.ho_employees.items():
            if norm == k or norm in k or k in norm:
                return v

        # 3. Coincidencia por conjunto de palabras (apellidos + nombre)
        words = set(norm.split())
        for k, v in self.ho_employees.items():
            k_words = set(k.split())
            common = words.intersection(k_words)
            if len(common) >= 2 and len(common) >= len(words) - 1:
                return v

        return None

    def sync(self, update_excel_file=True):
        """Ejecuta la sincronización completa cruzando SAP HO (HAGridSet, EmpleadoProyectoSet, EmpleadoSet) y Master Excel."""
        self.fetch_ho_employees()

        if not os.path.exists(EXCEL_PATH):
            print(f"[ERROR] Archivo Excel no encontrado: {EXCEL_PATH}")
            return False

        wb = openpyxl.load_workbook(EXCEL_PATH, data_only=False)
        ws = wb['SEGUIMIENTO']

        # Paso 0: Aplicar prioridad absoluta de SAP HO (cuadrantes HAGridSet y EmpleadoProyectoSet) y limpiar filas basura
        cambios_ho = 0
        if update_excel_file:
            col_map = {"PROYECTO": 6, "ESTADO": 7, "TITULAR": 8, "ESTADO1": 9, "SUPL": 10, "HORARIO": 11}
            for row_idx, overrides in SAP_HO_ROW_OVERRIDES.items():
                for col_key, new_val in overrides.items():
                    c_idx = col_map[col_key]
                    curr_val = ws.cell(row_idx, c_idx).value
                    if str(curr_val or '').strip() != str(new_val).strip():
                        ws.cell(row_idx, c_idx).value = new_val
                        cambios_ho += 1

            # Limpiar saltos de línea residuales en filas válidas (2..59) y limpiar filas basura (>= 60 o vacías con caracteres sueltos)
            for r in range(2, ws.max_row + 1):
                proy_v = str(ws.cell(r, 6).value or '').strip()
                tit_v = str(ws.cell(r, 8).value or '').strip()
                if not proy_v and not tit_v:
                    # Fila vacía o basura (como fila 755 con 'u' o filas 65, 66, 69, 71 con espacios)
                    for c in range(1, ws.max_column + 1):
                        if ws.cell(r, c).value is not None:
                            ws.cell(r, c).value = None
                            cambios_ho += 1
                else:
                    # Limpiar saltos de línea en texto de celdas principales
                    for c in range(1, 17):
                        v = ws.cell(r, c).value
                        if isinstance(v, str) and ('\n' in v or '\r' in v):
                            ws.cell(r, c).value = " ".join(v.split())
                            cambios_ho += 1
                    # Asegurar que ningún código antiguo quede sin resolver (salvo PROY08324-P2-C001 que tiene cuadrante propio)
                    if proy_v in SAP_PROJECT_ID_MAP and r != 40:
                        ws.cell(r, 6).value = SAP_PROJECT_ID_MAP[proy_v]
                        cambios_ho += 1

        # Recolectar IDs de proyectos activos para descargar sus cuadrantes en vivo
        project_ids_excel = set()
        for r in range(2, 60):
            pv = str(ws.cell(r, 6).value or '').strip()
            if pv:
                project_ids_excel.add(pv)
        if self.ho_connected:
            for p in self.ho.get_girona_projects():
                if p.get("IdProyecto"):
                    project_ids_excel.add(p.get("IdProyecto"))
        self.fetch_ho_cuadrantes(project_ids_excel)

        # Paso A: Recolectar datos de vacaciones existentes en Excel a nivel de empleado
        employee_vacations_excel = {}
        for r in range(2, 60):
            tit = str(ws.cell(r, 8).value or '').strip()
            norm = normalize_name(tit)
            if not norm or 'FALTA' in norm:
                continue

            num_vac = ws.cell(r, 14).value
            vac_26 = ws.cell(r, 15).value
            vac_2026 = ws.cell(r, 16).value
            fin_manual = ws.cell(r, 13).value

            if norm not in employee_vacations_excel:
                employee_vacations_excel[norm] = {
                    'num_vac': None,
                    'vac_26': None,
                    'vac_2026': None,
                    'fin_contrato': None
                }

            if num_vac and not employee_vacations_excel[norm]['num_vac']:
                employee_vacations_excel[norm]['num_vac'] = str(num_vac).strip()
            if vac_26 and not employee_vacations_excel[norm]['vac_26']:
                employee_vacations_excel[norm]['vac_26'] = str(vac_26).strip()
            if vac_2026 and not employee_vacations_excel[norm]['vac_2026']:
                employee_vacations_excel[norm]['vac_2026'] = str(vac_2026).strip()
            if fin_manual and not employee_vacations_excel[norm]['fin_contrato']:
                employee_vacations_excel[norm]['fin_contrato'] = str(fin_manual).strip()

        # Paso B: Actualizar celdas del Excel (Fin de contrato y vacaciones con prioridad SAP HO)
        actualizados = cambios_ho
        if update_excel_file:
            for r in range(2, 60):
                proy_v = str(ws.cell(r, 6).value or '').strip()
                tit = str(ws.cell(r, 8).value or '').strip()
                if not proy_v and not tit:
                    continue
                emp = self.find_employee(tit)
                norm = normalize_name(tit)

                # 1. Fin de contrato (priorizando siempre SAP HO si el empleado existe en SAP HO)
                curr_fin = str(ws.cell(r, 13).value or '').strip()
                if emp and emp.get('fin_contrato'):
                    if curr_fin != emp['fin_contrato']:
                        ws.cell(r, 13, emp['fin_contrato'])
                        actualizados += 1
                elif not curr_fin and norm in employee_vacations_excel and employee_vacations_excel[norm]['fin_contrato']:
                    ws.cell(r, 13, employee_vacations_excel[norm]['fin_contrato'])
                    actualizados += 1

                # 2. Número de días de vacaciones
                curr_num_vac = ws.cell(r, 14).value
                if emp and emp.get('vac_restantes', 0) > 0:
                    if str(curr_num_vac or '').strip() != str(emp['vac_restantes']):
                        ws.cell(r, 14, emp['vac_restantes'])
                        actualizados += 1
                elif not curr_num_vac and norm in employee_vacations_excel and employee_vacations_excel[norm]['num_vac']:
                    ws.cell(r, 14, employee_vacations_excel[norm]['num_vac'])
                    actualizados += 1

                # 3. Vacaciones planificadas (propagación)
                curr_vac26 = ws.cell(r, 15).value
                curr_vac2026 = ws.cell(r, 16).value
                if norm in employee_vacations_excel:
                    if not curr_vac26 and employee_vacations_excel[norm]['vac_26']:
                        ws.cell(r, 15, employee_vacations_excel[norm]['vac_26'])
                    if not curr_vac2026 and employee_vacations_excel[norm]['vac_2026']:
                        ws.cell(r, 16, employee_vacations_excel[norm]['vac_2026'])

            try:
                bak_path = EXCEL_PATH + ".bak"
                if not os.path.exists(bak_path):
                    shutil.copy2(EXCEL_PATH, bak_path)
                wb.save(EXCEL_PATH)
                print(f"[EXCEL] Master Excel actualizado con {actualizados} datos sincronizados de SAP HO.")
            except PermissionError:
                print("[AVISO] El archivo Excel está abierto por el usuario. Los datos se sincronizan en caliente en la memoria web.")
            except Exception as e:
                print(f"[WARN] No se pudo guardar el Excel directamente: {e}")

        # Paso C: Extraer y generar master_data.js enriquecido al 100%
        from extract_excel import extract
        extract(EXCEL_PATH)

        # Paso D: Inyectar datos completos de SAP HO en master_data.js
        self.enrich_master_data_js()

        print(f"[EXITO] Sincronizacion en tiempo real completada. HO ↔ Excel ↔ Web.")
        return True

    def enrich_master_data_js(self):
        """Inyecta el mapa completo de empleados HO y cuadrantes HO en master_data.js para consulta instantánea."""
        if not os.path.exists(OUTPUT_JS):
            return

        try:
            with open(OUTPUT_JS, 'r', encoding='utf-8') as f:
                content = f.read()

            ho_payload = json.dumps(self.ho_employees, ensure_ascii=False)
            cuad_payload = json.dumps(self.ho_cuadrantes, ensure_ascii=False)
            now_ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            extra_js = (
                f"\n// Sincronizacion SAP HO en tiempo real\n"
                f"window.HO_EMPLOYEES_MAP = {ho_payload};\n"
                f"window.HO_CUADRANTES_MAP = {cuad_payload};\n"
                f"window.HO_SYNC_TIMESTAMP = '{now_ts}';\n"
            )

            if "window.HO_EMPLOYEES_MAP =" in content:
                content = re.sub(r'window\.HO_EMPLOYEES_MAP\s*=\s*\{.*?\};', f'window.HO_EMPLOYEES_MAP = {ho_payload};', content, flags=re.DOTALL)
                if "window.HO_CUADRANTES_MAP =" in content:
                    content = re.sub(r'window\.HO_CUADRANTES_MAP\s*=\s*\{.*?\};', f'window.HO_CUADRANTES_MAP = {cuad_payload};', content, flags=re.DOTALL)
                else:
                    content += f"\nwindow.HO_CUADRANTES_MAP = {cuad_payload};\n"
                content = re.sub(r"window\.HO_SYNC_TIMESTAMP\s*=\s*'.*?';", f"window.HO_SYNC_TIMESTAMP = '{now_ts}';", content)
            else:
                content += extra_js

            with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
                f.write(content)

            print("[OK] master_data.js enriquecido con censo y cuadrantes en tiempo real de SAP HO.")
        except Exception as e:
            print(f"[ERROR] Error enriqueciendo master_data.js: {e}")

if __name__ == "__main__":
    syncer = HOMasterSynchronizer()
    syncer.sync(update_excel_file=True)
