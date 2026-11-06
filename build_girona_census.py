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
HO_CARTERAS_FILE = os.path.join(BASE_DIR, "ho_carteras_cache.json")
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

from bajas_empresa_service import es_baja_empresa, registrar_baja_empresa, load_bajas_empresa

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

def build_census(gestor_id='00062620', include_all_carteras=False):
    """
    Construye el Censo Maestro Oficial de Trabajadores de Girona.
    Por defecto filtra exclusivamente la cartera de ALEJANDRO COSCOLIN PEREGRIN ('00062620').
    """
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
                    # Excluir BCL
                    if '08184' in direccion or 'BCL' in row_context:
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

                            # Filtrar bajas definitivas de empresa (ex-empleados que ya no siguen en SIFU)
                            if es_baja_empresa(dni, part)[0]:
                                continue
                            if sap and (sap.get('id_status') == '0' or sap.get('nom_status') == 'Dado de baja' or sap.get('cerrado') is True):
                                continue

                            # Autonomía: Si fue suplente temporal en Excel, validar que siga perteneciendo a este gestor
                            if person == suplente and sap:
                                sap_resp = str(sap.get('id_responsable') or '').strip()
                                if sap_resp and gestor_id and gestor_id != 'ALL' and sap_resp != gestor_id:
                                    # Pertenecía orgánicamente a otro gestor (ej. Sonia Cañete) y su suplencia ha finalizado
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
    # IMPORTANTE: Solo incluir trabajadores que tengan turnos o días asignados en el cuadrante del mes,
    # NUNCA la bolsa histórica o empleados_proyecto inactivos.
    if os.path.exists(HO_CUADRANTES_FILE):
        try:
            with open(HO_CUADRANTES_FILE, 'r', encoding='utf-8') as f:
                cuad = json.load(f)

            for p_code, p_data in cuad.get('projects', {}).items():
                p_str = json.dumps(p_data).upper()
                if 'JARDIN' in p_str or 'BCL' in p_str:
                    continue

                # Extraer trabajadores activos en el cuadrante del mes
                activos_mes = []
                for fila in p_data.get('filas_cuadrante', []):
                    # Trabajadores con días asignados o presentes en cuadrante
                    if fila.get('dias_activos', 0) > 0 or fila.get('turno') or fila.get('en_baja'):
                        activos_mes.append(fila)

                for turno in p_data.get('turnos_activos', []):
                    for emp in turno.get('empleados', []):
                        activos_mes.append(emp)

                # Deduplicar por id_empleado o nombre
                vistos_p = set()
                for emp in activos_mes:
                    eid = emp.get('id_empleado')
                    enom = emp.get('nombre')
                    if not enom or len(enom.strip()) < 4:
                        continue
                    key_p = eid or enom
                    if key_p in vistos_p:
                        continue
                    vistos_p.add(key_p)

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

                    # Filtrar bajas definitivas de empresa (ex-empleados que ya no siguen en SIFU)
                    if es_baja_empresa(dni, enom)[0]:
                        continue
                    if sap and (sap.get('id_status') == '0' or sap.get('nom_status') == 'Dado de baja' or sap.get('cerrado') is True):
                        continue

                    if dni not in candidates:
                        sector = 'OPERACIONES SIFU (HO)'
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

    # 4b. Incluir todos los trabajadores que tengan asignado de responsable a ALEJANDRO COSCOLIN en ficha
    # SIEMPRE que sigan activos en plantilla (no dados de baja)
    if os.path.exists(HO_EMPLOYEES_FILE):
        try:
            with open(HO_EMPLOYEES_FILE, 'r', encoding='utf-8') as f:
                sap_emp = json.load(f)
            for dni, sinfo in sap_emp.get('by_dni', {}).items():
                cdni = normalize_dni(dni)
                if not cdni or cdni in DNIS_JARDINERIA:
                    continue

                # Filtrar bajas definitivas de empresa o dadas de baja en SAP
                if es_baja_empresa(cdni, sinfo.get('nombre_completo'))[0]:
                    continue
                if sinfo.get('id_status') == '0' or sinfo.get('nom_status') == 'Dado de baja' or sinfo.get('cerrado') is True:
                    continue

                resp_id = str(sinfo.get('id_responsable') or '').strip()
                resp_nom = str(sinfo.get('nom_responsable') or '').upper()
                if resp_id in ['00062620', '46468278'] or 'COSCOLIN' in resp_nom:
                    if cdni not in candidates:
                        candidates[cdni] = {
                            'dni': cdni,
                            'name': sinfo.get('nombre_completo', ''),
                            'servicio': sinfo.get('nom_centro', 'SERVICIO ASIGNADO HO'),
                            'sector': 'OPERACIONES SIFU (HO)',
                            'id_empleado': sinfo.get('id_empleado', ''),
                            'telefono': sinfo.get('telefono', ''),
                            'email': sinfo.get('email', ''),
                            'fuente': 'ho_responsable_coscolin'
                        }
        except Exception as e:
            print("Error incorporando responsables directos al censo:", e)

    # 4c. Incorporar cartera de ho_carteras_cache.json (filtrada a Alejandro Coscolin '00062620')
    if os.path.exists(HO_CARTERAS_FILE):
        try:
            with open(HO_CARTERAS_FILE, 'r', encoding='utf-8') as f:
                carteras_data = json.load(f)
            trabajadores_carteras = carteras_data.get('trabajadores', [])
            for w in trabajadores_carteras:
                cdni = normalize_dni(w.get('dni'))
                if not cdni:
                    continue
                w_gid = str(w.get('gestor_id') or '').strip()
                if gestor_id and gestor_id != 'ALL' and w_gid != gestor_id:
                    continue

                wnom = w.get('nombre') or ''
                # Filtrar bajas definitivas de empresa
                if es_baja_empresa(cdni, wnom)[0]:
                    continue

                # Si es censo exclusivo de Alejandro Coscolin ('00062620'), aplicar blacklist de jardinería
                if gestor_id == '00062620' and (cdni in DNIS_JARDINERIA or any(ap in wnom.upper() for ap in APELLIDOS_JARDINERIA)):
                    continue

                proy_nom = w.get('proyecto_principal_nombre') or ''
                cli_nom = w.get('cliente_principal') or ''
                serv_str = f"{proy_nom} ({cli_nom})" if proy_nom and cli_nom else (proy_nom or w.get('nom_centro') or 'SERVICIO GIRONA')
                sec_str = 'AUXILIARES' if ('(AUX)' in proy_nom.upper() or 'CONSERJ' in proy_nom.upper()) else 'LIMPIEZA'
                if 'CASTILLO' in serv_str.upper():
                    sec_str = 'CASTILLO FIGUERES'
                elif 'ALBERGUE' in serv_str.upper() or 'JOVENTUT' in serv_str.upper():
                    sec_str = 'ALBERGUES'
                elif 'JARDIN' in serv_str.upper() or 'B171' in str(w.get('centro') or ''):
                    sec_str = 'JARDINERÍA / MEDIO AMBIENTE'

                w_item = {
                    'dni': cdni,
                    'name': wnom,
                    'servicio': serv_str,
                    'sector': sec_str,
                    'id_empleado': w.get('id', ''),
                    'telefono': w.get('telefono', ''),
                    'email': w.get('email', ''),
                    'gestor_id': w_gid,
                    'gestor_nombre': w.get('responsable_rrhh', ''),
                    'gestor_corto': w.get('responsable_corto', ''),
                    'empresa_badge': w.get('empresa_badge', '🏢 SIFU'),
                    'empresa_grupo': w.get('empresa_grupo', 'SIFU'),
                    'fuente': 'ho_carteras_multi'
                }

                if cdni not in candidates:
                    candidates[cdni] = w_item
                else:
                    # Enriquecer datos existentes con los del gestor
                    for k in ('gestor_id', 'gestor_nombre', 'gestor_corto', 'empresa_badge', 'empresa_grupo'):
                        if not candidates[cdni].get(k):
                            candidates[cdni][k] = w_item[k]
                    if not candidates[cdni].get('telefono') and w_item.get('telefono'):
                        candidates[cdni]['telefono'] = w_item['telefono']
        except Exception as e:
            print("Error incorporando ho_carteras_cache.json al censo:", e)

    # 5. Overrides manuales si existen
    if os.path.exists(MANUAL_FILE):
        try:
            with open(MANUAL_FILE, 'r', encoding='utf-8') as f:
                manual = json.load(f)
            for m in manual:
                dni = normalize_dni(m.get("dni"))
                if dni:
                    if gestor_id == '00062620' and dni in DNIS_JARDINERIA:
                        continue
                    if dni in candidates:
                        candidates[dni].update(m)
        except Exception as e:
            print("Error en manual overrides:", e)

    # Filtrar por gestor_id si fue especificado y no es 'ALL'
    for w in candidates.values():
        if not w.get('gestor_id'):
            w['gestor_id'] = '00062620'
            w['gestor_nombre'] = 'ALEJANDRO COSCOLIN PEREGRIN'
            w['gestor_corto'] = 'Alejandro Coscolin'
    if gestor_id and gestor_id != 'ALL':
        census_list = [w for w in candidates.values() if w.get('gestor_id') == gestor_id]
    else:
        census_list = list(candidates.values())

    census_list = sorted(census_list, key=lambda x: x.get("name", ""))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(census_list, f, ensure_ascii=False, indent=2)

    g_label = f"GESTOR {gestor_id}" if gestor_id else "MULTI-GESTOR GIRONA"
    print(f"Censo Maestro Oficial {g_label} generado: {len(census_list)} trabajadores en {OUTPUT_FILE}")
    return census_list

if __name__ == "__main__":
    import sys
    gid_arg = sys.argv[1] if len(sys.argv) > 1 else '00062620'
    build_census(gestor_id=gid_arg)
