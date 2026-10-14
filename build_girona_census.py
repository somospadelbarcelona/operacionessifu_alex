# -*- coding: utf-8 -*-
"""
Constructor del Censo Maestro de Trabajadores de SIFU Girona.
SOLO incluye trabajadores asignados a ALEJANDRO COSCOLIN en GIRONA.
Excluye permanentemente:
- Personal de BCL (Barcelona / fuera de la cartera de Girona Coscolin)
- Personal de Jardinería
Genera fichajes_censo_girona.json deduplicado y normalizado.
"""

import os
import json
import re
import unicodedata
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HO_EMPLOYEES_FILE = os.path.join(BASE_DIR, "ho_employees_cache.json")
EXCEL_FILE = os.path.join(BASE_DIR, "MASTER GENERAL GIRONA OKK.xlsx")
GIRONA_DATA_FILE = os.path.join(BASE_DIR, "girona_data.json")
MANUAL_FILE = os.path.join(BASE_DIR, "fichajes_censo_manual.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "fichajes_censo_girona.json")

# Lista negra permanente de Jardinería y BCL
DNIS_EXCLUIDOS = {
    'X1368710A', '40437050Z', '40345869M', '40437178G', '40441302B',
    '41559902Y', '23274238D', '41551869T', '40433702R', '40443871G',
    '77606815P', '40441589C', '42389334Z', '41538356Z', '40336214C',
    '46798028Z', '40325492J', '40348705C', '30588235H', '40321262F'
}
APELLIDOS_JARDINERIA = [
    'BEN MOUSSA', 'SANCHEZ PEREZ', 'OSORIO VACA', 'CIFUENTES BOSCH',
    'SALVADOR VILANOVA', 'ESPINAS DEL FRESNO', 'FELIU LOPEZ',
    'MARTI BARTIS', 'BELLAPART', 'ALDAMIZ', 'SIMO CASTELLS'
]

def normalize_text(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFD', str(text))
    text = re.sub(r'[\u0300-\u036f]', '', text)
    return re.sub(r'[^A-Z0-9 ]', '', text.upper()).strip()

def normalize_dni(dni):
    if not dni:
        return ""
    return re.sub(r'[\s\-_.]', '', str(dni)).upper()

def build_census():
    # 1. Recopilar trabajadores asignados a Alejandro Coscolin (titulares y suplentes)
    coscolin_workers = {} # norm_name -> {nombre_raw, servicio, sector}

    # Desde el Excel Maestro
    if os.path.exists(EXCEL_FILE):
        try:
            wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
            if 'SEGUIMIENTO' in wb.sheetnames:
                ws = wb['SEGUIMIENTO']
                for r in range(2, ws.max_row + 1):
                    tipo_s = str(ws.cell(row=r, column=2).value or '').strip()
                    tipo_serv = str(ws.cell(row=r, column=3).value or '').strip()
                    servicio = str(ws.cell(row=r, column=4).value or '').strip()
                    direccion = str(ws.cell(row=r, column=5).value or '').strip()
                    titular = str(ws.cell(row=r, column=8).value or '').strip()
                    suplente = str(ws.cell(row=r, column=10).value or '').strip()

                    row_text = f"{tipo_s} {tipo_serv} {servicio} {direccion}".upper()

                    # Excluir BCL o Barcelona explícitamente
                    if 'BCL' in row_text or '08184' in row_text or 'BARCELONA' in direccion.upper() or 'HOSPITALET' in direccion.upper():
                        continue
                    # Excluir jardinería
                    if 'JARDIN' in row_text:
                        continue

                    sector = tipo_serv if tipo_serv else 'LIMPIEZA'
                    if 'ALBERGUE' in tipo_s.upper() or 'ALBERGUE' in tipo_serv.upper() or 'CASTILLO' in tipo_s.upper():
                        sector = 'AUXILIARES'

                    for person in [titular, suplente]:
                        p_upper = person.upper().strip()
                        if not p_upper or p_upper in ['NONE', 'VACANTE', 'DESCUBIERTO', 'POR ASIGNAR', 'SIN CUBRIR', '0', 'VUELVE EL JUEVES']:
                            continue
                        # Si viene con barra (ej. titular / suplente)
                        parts = [p.strip() for p in p_upper.split('/')] if '/' in p_upper else [p_upper]
                        for part in parts:
                            if len(part) < 4 or part.startswith('BLAS'):
                                continue
                            if any(ap in part for ap in APELLIDOS_JARDINERIA):
                                continue
                            p_norm = normalize_text(part)
                            if p_norm not in coscolin_workers:
                                coscolin_workers[p_norm] = {
                                    'nombre': part,
                                    'servicio': servicio if servicio else 'GIRONA SIFU',
                                    'sector': sector
                                }
        except Exception as e:
            print("Error leyendo Excel maestro:", e)

    # Desde girona_data.json
    if os.path.exists(GIRONA_DATA_FILE):
        try:
            with open(GIRONA_DATA_FILE, 'r', encoding='utf-8') as f:
                gd = json.load(f)
            for s in gd.get('services', []):
                tipo_s = str(s.get('TIPO S') or '').strip()
                tipo_serv = str(s.get('TIPO SERVICIO') or '').strip()
                servicio = str(s.get('SERVICIO') or '').strip()
                direccion = str(s.get('S DIRECCION') or '').strip()
                row_text = f"{tipo_s} {tipo_serv} {servicio} {direccion}".upper()

                if 'BCL' in row_text or '08184' in row_text or 'BARCELONA' in direccion.upper() or 'HOSPITALET' in direccion.upper():
                    continue
                if 'JARDIN' in row_text:
                    continue

                sector = tipo_serv if tipo_serv else 'LIMPIEZA'
                if 'ALBERGUE' in tipo_s.upper() or 'ALBERGUE' in tipo_serv.upper() or 'CASTILLO' in tipo_s.upper():
                    sector = 'AUXILIARES'

                for k in ['TITULAR', 'SUPL']:
                    person = str(s.get(k) or '').strip()
                    p_upper = person.upper()
                    if not p_upper or p_upper in ['NONE', 'VACANTE', 'DESCUBIERTO', 'POR ASIGNAR', 'SIN CUBRIR', '0', 'VUELVE EL JUEVES']:
                        continue
                    parts = [p.strip() for p in p_upper.split('/')] if '/' in p_upper else [p_upper]
                    for part in parts:
                        if len(part) < 4 or part.startswith('BLAS'):
                            continue
                        if any(ap in part for ap in APELLIDOS_JARDINERIA):
                            continue
                        p_norm = normalize_text(part)
                        if p_norm not in coscolin_workers:
                            coscolin_workers[p_norm] = {
                                'nombre': part,
                                'servicio': servicio if servicio else 'GIRONA SIFU',
                                'sector': sector
                            }
        except Exception as e:
            print("Error leyendo girona_data.json:", e)

    # 2. Cargar base de datos SAP para enriquecer con DNI oficial, id_empleado, tel y email
    sap_by_dni = {}
    if os.path.exists(HO_EMPLOYEES_FILE):
        try:
            with open(HO_EMPLOYEES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            sap_by_dni = data.get('by_dni', {})
        except Exception as e:
            print("Error leyendo ho_employees_cache.json:", e)

    census_by_dni = {}

    for norm_name, w_info in coscolin_workers.items():
        matched_dni = None
        matched_sap = None

        for dni_raw, s_info in sap_by_dni.items():
            dni_clean = normalize_dni(dni_raw)
            if dni_clean in DNIS_EXCLUIDOS:
                continue
            sap_name_norm = normalize_text(s_info.get('nombre_completo', ''))
            if norm_name == sap_name_norm or norm_name in sap_name_norm or sap_name_norm in norm_name:
                matched_dni = dni_clean
                matched_sap = s_info
                break

        if matched_dni:
            census_by_dni[matched_dni] = {
                "dni": matched_dni,
                "name": matched_sap.get("nombre_completo", w_info["nombre"]),
                "servicio": w_info["servicio"],
                "sector": w_info["sector"],
                "id_empleado": matched_sap.get("id_empleado", ""),
                "telefono": matched_sap.get("telefono", ""),
                "email": matched_sap.get("email", ""),
                "fuente": "cartera_coscolin"
            }

    # 3. Aplicar overrides manuales si existen
    if os.path.exists(MANUAL_FILE):
        try:
            with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
                manual = json.load(f)
            for m in manual:
                dni = normalize_dni(m.get("dni"))
                if dni and dni not in DNIS_EXCLUIDOS:
                    if dni in census_by_dni:
                        census_by_dni[dni].update(m)
        except Exception as e:
            print("Error en manual overrides:", e)

    census_list = sorted(list(census_by_dni.values()), key=lambda x: x.get("name", ""))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(census_list, f, ensure_ascii=False, indent=2)

    print(f"Censo Maestro Exclusivo ALEJANDRO COSCOLIN generado con éxito: {len(census_list)} trabajadores en {OUTPUT_FILE}")
    return census_list

if __name__ == "__main__":
    build_census()
