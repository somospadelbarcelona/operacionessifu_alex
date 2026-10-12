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

from ho_service import HOService, RESPONSABLE_ID

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

class HOMasterSynchronizer:
    def __init__(self):
        self.ho = HOService()
        self.ho_connected = False
        self.ho_employees = {} # norm_name -> emp_dict
        self.ho_dni_map = {}   # dni -> emp_dict

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
        """Ejecuta la sincronización completa cruzando SAP HO y Master Excel."""
        self.fetch_ho_employees()

        if not os.path.exists(EXCEL_PATH):
            print(f"[ERROR] Archivo Excel no encontrado: {EXCEL_PATH}")
            return False

        wb = openpyxl.load_workbook(EXCEL_PATH, data_only=False)
        ws = wb['SEGUIMIENTO']

        # Paso A: Recolectar datos de vacaciones existentes en Excel a nivel de empleado
        # para propagarlos a todas las filas del mismo titular (ej. Josué Castillo)
        employee_vacations_excel = {}
        for r in range(2, ws.max_row + 1):
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

        # Paso B: Actualizar celdas del Excel si update_excel_file=True
        actualizados = 0
        if update_excel_file:
            for r in range(2, ws.max_row + 1):
                tit = str(ws.cell(r, 8).value or '').strip()
                emp = self.find_employee(tit)
                norm = normalize_name(tit)

                # 1. Fin de contrato
                curr_fin = ws.cell(r, 13).value
                if not curr_fin:
                    if emp and emp.get('fin_contrato'):
                        ws.cell(r, 13, emp['fin_contrato'])
                        actualizados += 1
                    elif norm in employee_vacations_excel and employee_vacations_excel[norm]['fin_contrato']:
                        ws.cell(r, 13, employee_vacations_excel[norm]['fin_contrato'])
                        actualizados += 1

                # 2. Número de días de vacaciones
                curr_num_vac = ws.cell(r, 14).value
                if not curr_num_vac:
                    if emp and emp.get('vac_restantes', 0) > 0:
                        ws.cell(r, 14, emp['vac_restantes'])
                        actualizados += 1
                    elif norm in employee_vacations_excel and employee_vacations_excel[norm]['num_vac']:
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
                # Backup de seguridad antes de guardar
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
        """Inyecta el mapa completo de empleados HO en master_data.js para consulta instantánea."""
        if not os.path.exists(OUTPUT_JS):
            return

        try:
            with open(OUTPUT_JS, 'r', encoding='utf-8') as f:
                content = f.read()

            ho_payload = json.dumps(self.ho_employees, ensure_ascii=False)
            extra_js = (
                f"\n// Sincronizacion SAP HO en tiempo real\n"
                f"window.HO_EMPLOYEES_MAP = {ho_payload};\n"
                f"window.HO_SYNC_TIMESTAMP = '{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}';\n"
            )

            # Reemplazar si ya existe o anexar
            if "window.HO_EMPLOYEES_MAP =" in content:
                content = re.sub(r'window\.HO_EMPLOYEES_MAP\s*=\s*\{.*?\};', f'window.HO_EMPLOYEES_MAP = {ho_payload};', content, flags=re.DOTALL)
                content = re.sub(r"window\.HO_SYNC_TIMESTAMP\s*=\s*'.*?';", f"window.HO_SYNC_TIMESTAMP = '{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}';", content)
            else:
                content += extra_js

            with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
                f.write(content)

            print("[OK] master_data.js enriquecido con censo en tiempo real de SAP HO.")
        except Exception as e:
            print(f"[ERROR] Error enriqueciendo master_data.js: {e}")

if __name__ == "__main__":
    syncer = HOMasterSynchronizer()
    syncer.sync(update_excel_file=True)
