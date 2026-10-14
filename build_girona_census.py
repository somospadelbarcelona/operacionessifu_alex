# -*- coding: utf-8 -*-
"""
Constructor Oficial del Censo Maestro de Trabajadores de SIFU Girona.
Combina y cruza:
1. Todos los trabajadores de la Master (MASTER GENERAL GIRONA OKK.xlsx - SEGUIMIENTO y DESCUBIERTOS)
2. Todos los trabajadores asignados en la sincronización de SAP HO al responsable ALEJANDRO COSCOLIN (46468278)
3. Excluye estrictamente BCL y Jardinería
4. Resuelve DNI oficial con SAP S171 y fichajes reales de Girona
Genera fichajes_censo_girona.json deduplicado y normalizado.
"""

import os
import json
import re
import unicodedata
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HO_EMPLOYEES_FILE = os.path.join(BASE_DIR, "ho_employees_cache.json")
HO_CUADRANTES_FILE = os.path.join(BASE_DIR, "ho_cuadrantes_cache.json")
EXCEL_FILE = os.path.join(BASE_DIR, "MASTER GENERAL GIRONA OKK.xlsx")
FICHAJES_DATA_FILE = os.path.join(BASE_DIR, "fichajes_data.js")
MANUAL_FILE = os.path.join(BASE_DIR, "fichajes_censo_manual.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "fichajes_censo_girona.json")

# Blacklist permanente de Jardinería
DNIS_JARDINERIA = {
    'X1368710A', '40437050Z', '40345869M', '40437178G', '40441302B',
    '41559902Y', '23274238D', '41551869T', '40433702R', '40443871G',
    '77606815P', '40441589C', '42389334Z', '41538356Z', '40336214C',
    '46798028Z', '40325492J', '40348705C', '30588235H', '40321262F',
    '53332983P'
}
APELLIDOS_JARDINERIA = [
    'BEN MOUSSA', 'SANCHEZ PEREZ', 'OSORIO VACA', 'CIFUENTES BOSCH',
    'SALVADOR VILANOVA', 'ESPINAS DEL FRESNO', 'FELIU LOPEZ',
    'MARTI BARTIS', 'BELLAPART', 'ALDAMIZ', 'SIMO CASTELLS', 'CHAMIZO'
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
    # 1. Base de datos SAP S171 Girona
    name_to_sap = {}
    id_to_sap = {}
    if os.path.exists(HO_EMPLOYEES_FILE):
        try:
            with open(HO_EMPLOYEES_FILE, 'r', encoding='utf-8') as f:
                sap_emp = json.load(f)
            for dni, sinfo in sap_emp.get('by_dni', {}).items():
                cdni = normalize_dni(dni)
                sname = sinfo.get('nombre_completo', '')
                eid = sinfo.get('id_empleado', '')
                data = {**sinfo, 'dni': cdni}
                if cdni:
                    name_to_sap[normalize_text(sname)] = data
                if eid:
                    id_to_sap[eid] = data
        except Exception as e:
            print("Error cargando ho_employees_cache.json:", e)

    # 2. Respaldo de fichajes reales de Girona para completar mapeos de DNI
    if os.path.exists(FICHAJES_DATA_FILE):
        try:
            with open(FICHAJES_DATA_FILE, 'r', encoding='utf-8') as f:
                ftxt = f.read()
            fdata = json.loads(ftxt[ftxt.find('{'):ftxt.rfind('}')+1])
            for fich in fdata.get('fichajes', []):
                fdni = normalize_dni(fich.get('USERDNI'))
                fnom = fich.get('USERNOM')
                if fdni and fnom:
                    fnorm = normalize_text(fnom)
                    if fnorm not in name_to_sap:
                        name_to_sap[fnorm] = {
                            'dni': fdni,
                            'nombre_completo': fnom,
                            'id_empleado': fich.get('USERCOD', ''),
                            'nom_centro': fich.get('DENO', 'GIRONA')
                        }
        except Exception as e:
            print("Error cargando fichajes_data.js:", e)

    candidates = {}

    # 3. Extraer de la Master (SEGUIMIENTO y DESCUBIERTOS)
    if os.path.exists(EXCEL_FILE):
        try:
            wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
            for sheetname in ['SEGUIMIENTO', 'DESCUBIERTOS']:
                if sheetname not in wb.sheetnames:
                    continue
                ws = wb[sheetname]
                for r in range(2, ws.max_row + 1):
                    tipo_s = str(ws.cell(row=r, column=2).value or '').strip()
                    tipo_serv = str(ws.cell(row=r, column=3).value or '').strip()
                    servicio = str(ws.cell(row=r, column=4).value or '').strip()
                    direccion = str(ws.cell(row=r, column=5).value or '').strip()
                    proy = str(ws.cell(row=r, column=6).value or '').strip()
                    titular = str(ws.cell(row=r, column=8).value or '').strip()
                    suplente = str(ws.cell(row=r, column=10).value or '').strip()

                    row_context = f"{tipo_s} {tipo_serv} {servicio} {direccion} {proy}".upper()

                    # Excluir jardinería
                    if 'JARDIN' in row_context:
                        continue
                    # Excluir BCL / Barcelona estricto si no es de Girona
                    if '08184' in direccion or ('BARCELONA' in direccion.upper() and 'GIRONA' not in row_context and 'COSTA BRAVA' not in row_context):
                        continue

                    sector = tipo_serv if tipo_serv else 'LIMPIEZA'
                    if 'CASTILLO' in row_context:
                        sector = 'CASTILLO FIGUERES'
                    elif 'ALBERGUE' in row_context or 'JOVENTUT' in row_context or 'NURIA' in row_context or 'MOLINA' in row_context:
                        sector = 'ALBERGUES'

                    for person in [titular, suplente]:
                        p_up = person.upper().strip()
                        if not p_up or p_up in ['NONE', 'VACANTE', 'DESCUBIERTO', 'POR ASIGNAR', 'SIN CUBRIR', '0', 'VUELVE EL JUEVES', 'FALTA TITULAR']:
                            continue
                        parts = [x.strip() for x in p_up.split('/')] if '/' in p_up else [p_up]
                        for part in parts:
                            if len(part) < 4 or part.startswith('BLAS'):
                                continue
                            if any(ap in part for ap in APELLIDOS_JARDINERIA):
                                continue

                            p_norm = normalize_text(part)
                            sap = name_to_sap.get(p_norm)
                            if not sap:
                                for sn, sdata in name_to_sap.items():
                                    if p_norm == sn or p_norm in sn or sn in p_norm:
                                        sap = sdata
                                        break

                            dni = sap.get('dni') if sap else None
                            if dni and dni in DNIS_JARDINERIA:
                                continue

                            if dni:
                                if dni not in candidates:
                                    candidates[dni] = {
                                        'dni': dni,
                                        'name': sap.get('nombre_completo', part),
                                        'servicio': servicio if servicio else 'GIRONA SIFU',
                                        'sector': sector,
                                        'id_empleado': sap.get('id_empleado', ''),
                                        'telefono': sap.get('telefono', ''),
                                        'email': sap.get('email', ''),
                                        'fuente': f"master_{sheetname}"
                                    }
                                else:
                                    if 'GIRONA SIFU' in candidates[dni]['servicio'] and servicio:
                                        candidates[dni]['servicio'] = servicio
        except Exception as e:
            print("Error procesando Master Excel:", e)

    # 4. Extraer de los proyectos de SAP HO asignados al responsable ALEJANDRO COSCOLIN
    if os.path.exists(HO_CUADRANTES_FILE):
        try:
            with open(HO_CUADRANTES_FILE, 'r', encoding='utf-8') as f:
                cuad = json.load(f)

            for p_code, p_data in cuad.get('projects', {}).items():
                p_str = json.dumps(p_data).upper()
                if 'JARDIN' in p_str or 'BCL' in p_str:
                    continue

                for emp in p_data.get('empleados_proyecto', []):
                    eid = emp.get('id_empleado')
                    enom = emp.get('nombre')
                    if not enom or len(enom.strip()) < 4:
                        continue
                    if any(ap in enom.upper() for ap in APELLIDOS_JARDINERIA):
                        continue

                    enorm = normalize_text(enom)
                    sap = id_to_sap.get(eid) or name_to_sap.get(enorm)
                    if not sap:
                        for sn, sdata in name_to_sap.items():
                            if enorm == sn or enorm in sn or sn in enorm:
                                sap = sdata
                                break

                    dni = sap.get('dni') if sap else None
                    if not dni or dni in DNIS_JARDINERIA:
                        continue

                    nom_centro = sap.get('nom_centro', '').upper()
                    if 'GIRONA' in nom_centro or sap.get('id_centro') == 'S171' or dni in candidates:
                        if dni not in candidates:
                            sector = 'OPERACIONES GIRONA (HO)'
                            if 'CASTILLO' in p_str:
                                sector = 'CASTILLO FIGUERES'
                            elif 'ALBERGUE' in p_str or 'JOVENTUT' in p_str or 'NURIA' in p_str:
                                sector = 'ALBERGUES'

                            candidates[dni] = {
                                'dni': dni,
                                'name': sap.get('nombre_completo', enom),
                                'servicio': f"Proyecto HO ({p_code})",
                                'sector': sector,
                                'id_empleado': sap.get('id_empleado', eid),
                                'telefono': sap.get('telefono', ''),
                                'email': sap.get('email', ''),
                                'fuente': 'ho_cuadrante_coscolin'
                            }
        except Exception as e:
            print("Error procesando ho_cuadrantes_cache.json:", e)

    # 5. Overrides manuales si existen
    if os.path.exists(MANUAL_FILE):
        try:
            with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
                manual = json.load(f)
            for m in manual:
                dni = normalize_dni(m.get("dni"))
                if dni and dni not in DNIS_JARDINERIA:
                    if dni in candidates:
                        candidates[dni].update(m)
        except Exception as e:
            print("Error en manual overrides:", e)

    census_list = sorted(list(candidates.values()), key=lambda x: x.get("name", ""))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(census_list, f, ensure_ascii=False, indent=2)

    print(f"Censo Maestro Oficial ALEJANDRO COSCOLIN generado: {len(census_list)} trabajadores en {OUTPUT_FILE}")
    return census_list

if __name__ == "__main__":
    build_census()
