# -*- coding: utf-8 -*-
"""
APLICAR CORRECCIONES OFICIALES SAP HO SOBRE MASTER GENERAL GIRONA OKK.xlsx
Modifica y perfecciona el Excel Maestro para que coincida exactamente
con la información corporativa en tiempo real de SAP S/4HANA HO.
"""

import os
import sys
import shutil
import unicodedata
import re
from datetime import datetime
import openpyxl

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "MASTER GENERAL GIRONA OKK.xlsx")
BACKUP_PATH = os.path.join(BASE_DIR, f"MASTER GENERAL GIRONA OKK_BACKUP_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx")

from ho_service import HOService, RESPONSABLE_ID

def normalize_text(text):
    if not text:
        return ""
    n = unicodedata.normalize('NFKD', str(text)).encode('ASCII', 'ignore').decode('utf-8')
    n = re.sub(r'[^A-Z0-9\s]', ' ', n.upper())
    return " ".join(n.split())

def parse_sap_date(d_str):
    if not d_str:
        return "Indefinido"
    try:
        ts = int(d_str.replace('/Date(', '').replace(')/', '')) / 1000
        return datetime.fromtimestamp(ts).strftime('%d/%m/%Y')
    except Exception:
        return str(d_str).strip()

def aplicar_correcciones():
    print("=" * 70)
    print("INICIANDO ACTUALIZACIÓN PERFECTA: SAP HO -> MASTER GENERAL EXCEL")
    print("=" * 70)

    # 1. Conectar a SAP HO
    ho = HOService()
    if not ho.connect():
        print("[ERROR] No se pudo conectar a SAP HO. Abortando.")
        return False

    # 2. Descargar censo de proyectos y empleados
    print("[1/5] Descargando censo completo de proyectos y empleados de SAP HO...")
    ho_projects_list = ho.get_girona_projects(max_results=500)
    ho_projects = {p.get('IdProyecto'): p for p in ho_projects_list if p.get('IdProyecto')}

    ho_employees_by_id = {}
    ho_employees_by_norm = {}
    for c in ['S171', 'S172', 'B171']:
        res = ho.query_entity_set("EmpleadoSet", filter_query=f"IdCentro eq '{c}'", top=500)
        for e in res or []:
            emp_id = e.get('IdEmpleado')
            nom_oficial = (e.get('NombreCompleto') or '').strip()
            nom_norm = normalize_text(nom_oficial)
            processed = {
                "id": emp_id,
                "nombre": nom_oficial,
                "dni": (e.get('DNI') or '').strip(),
                "telefono": (e.get('Telefono') or '').strip(),
                "centro": e.get('IdCentro'),
                "tipo_contrato": e.get('DenTipoContrato') or 'Fijo',
                "fin_contrato": parse_sap_date(e.get('FinContrato')),
                "vac_restantes": int(e.get('vacRestantes') or 0),
                "vac_tomados": int(e.get('vacTomados') or 0),
                "vac_totales": int(e.get('vacTotales') or 0),
                "horas_semana": e.get('HorasSemana')
            }
            ho_employees_by_id[emp_id] = processed
            if nom_norm:
                ho_employees_by_norm[nom_norm] = processed

    # Descargar asignaciones oficiales de bitácora
    print("[2/5] Descargando asignaciones operativas oficiales de SAP HO...")
    ho_asig = {}
    for proy_id in ho_projects.keys():
        asigs = ho.query_entity_set("EmpleadoAsigProySet", filter_query=f"IdProyecto eq '{proy_id}'")
        if asigs:
            ho_asig[proy_id] = [
                {"id": a.get('IdEmpleado'), "nombre": (a.get('Nombre') or '').strip(), "dni": (a.get('DNI') or '').strip()}
                for a in asigs
            ]

    # 3. Crear Backup de Seguridad del Excel
    print(f"[3/5] Creando copia de seguridad: {os.path.basename(BACKUP_PATH)}")
    shutil.copy2(EXCEL_PATH, BACKUP_PATH)

    # 4. Modificar el Excel Maestro
    print("[4/5] Aplicando correcciones en MASTER GENERAL GIRONA OKK.xlsx...")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb['SEGUIMIENTO']

    cambios_realizados = []

    # Mapa de correcciones de nombres habituales/apodos
    CORRECCION_NOMBRES = {
        "CARMEN SALSINA MENA": "CARMEN ALSINA MENA",
        "NADIA JULIANA GOAGA SUCEVEANU": "NADIA IULIANA GOAGA SUCEVEANU",
        "CARLA MASSANET": "CARLA MASSANELLAS SAURA",
        "ANUAR": "ANWAR EL KHABBAZI RIFI",
        "MOHA Y MOHAMED": "MOHAMMED ETTMALAH",
        "MOHAMED . MOHA": "MOHAMMED ETTMALAH",
        "MOHAMED Y MOHA": "MOHAMMED ETTMALAH"
    }

    # Corrección de códigos de proyecto con erratas en Excel
    CORRECCION_PROYECTOS = {
        "PROY0187080-P1": "PROY018780-P1",
        "PROY018708-P1": "PROY018780-P1",
        "PROY08324-P2-C001": "PROY008324-P1",
        "SVO09390-P1-C017": "SVO10033-P1-C017",
        "SVO09390-P2-C018": "SVO10033-P2-C018",
        "SVO14670-P1-C018": "PROY017304-P1",
        "PROY018171L": "PGOC018171L",
        "PROY01817J": "PGOC018171J",
    }

    for r in range(2, ws.max_row + 1):
        proy_cell = ws.cell(r, 6)
        tit_cell = ws.cell(r, 8)
        serv_cell = ws.cell(r, 4)
        tipo_s_cell = ws.cell(r, 2)
        dir_cell = ws.cell(r, 5)
        estado_cell = ws.cell(r, 7)
        fin_cell = ws.cell(r, 13)
        num_vac_cell = ws.cell(r, 14)

        proy_val = str(proy_cell.value or '').strip()
        tit_val = str(tit_cell.value or '').strip()

        if not proy_val and not tit_val:
            continue

        # A. Corregir código de proyecto si tenía errata
        if proy_val in CORRECCION_PROYECTOS:
            nuevo_proy = CORRECCION_PROYECTOS[proy_val]
            proy_cell.value = nuevo_proy
            cambios_realizados.append(f"Fila {r}: Proyecto corregido de '{proy_val}' a '{nuevo_proy}'")
            proy_val = nuevo_proy

        # B. Corregir nombre del titular si tenía errata o apodo
        tit_norm = normalize_text(tit_val)
        if tit_val in CORRECCION_NOMBRES:
            nombre_corregido = CORRECCION_NOMBRES[tit_val]
            tit_cell.value = nombre_corregido
            cambios_realizados.append(f"Fila {r}: Nombre corregido de '{tit_val}' a '{nombre_corregido}'")
            tit_val = nombre_corregido
            tit_norm = normalize_text(tit_val)

        ho_proy = ho_projects.get(proy_val)
        asigs_proy = ho_asig.get(proy_val, [])

        if ho_proy:
            # C. Corregir Dirección con la oficial de SAP HO
            calle_ho = (ho_proy.get('Calle') or '').strip()
            cp_ho = (ho_proy.get('CodPostal') or '').strip()
            pob_ho = (ho_proy.get('Poblacion') or '').strip()
            dir_oficial = f"{calle_ho}  {cp_ho}  {pob_ho}".strip()

            dir_actual = str(dir_cell.value or '').strip()
            # Si la dirección en Excel contiene el código de proyecto o está incompleta
            if calle_ho and (proy_val in dir_actual or len(dir_actual) < 10 or 'apartat' in dir_oficial.lower()):
                dir_cell.value = dir_oficial
                cambios_realizados.append(f"Fila {r} ({proy_val}): Dirección actualizada a '{dir_oficial}'")

            # D. Corregir Cliente / Denominación oficial
            cli_oficial = (ho_proy.get('NomCliente') or ho_proy.get('Denominacion') or '').strip()
            serv_actual = str(serv_cell.value or '').strip()
            if not serv_actual or serv_actual == str(tipo_s_cell.value or '').strip():
                if cli_oficial:
                    serv_cell.value = cli_oficial
                    cambios_realizados.append(f"Fila {r} ({proy_val}): Cliente oficial completado como '{cli_oficial}'")

            # E. Titular: Regularizar casos como Dipsalut y falsos descubiertos
            if proy_val == "PROY017209-P1":
                # En PROY017209-P1 las asignadas oficiales en HO son Mercè Planas, Lidia Jordà, María del Pilar Díaz
                if tit_val == "JOSUE RAMON CASTILLO MOLINA":
                    # Josué está en SVO11110-P1-C018. En PROY017209-P1 la titular es Mercè Planas / Lidia Jordà
                    tit_cell.value = "LIDIA JORDA I MARQUEZ"
                    cambios_realizados.append(f"Fila {r}: Regularizada titular de PROY017209-P1 a LIDIA JORDA I MARQUEZ (Josué asignado a SVO11110)")
                    tit_val = "LIDIA JORDA I MARQUEZ"
                    tit_norm = normalize_text(tit_val)

            elif tit_val in ["FALTA TITULAR", "SIN TITULAR", ""] and asigs_proy:
                # Si en Excel ponía FALTA TITULAR pero en SAP HO SÍ está asignado
                primer_asignado = asigs_proy[0]['nombre']
                tit_cell.value = primer_asignado
                if str(estado_cell.value or '').upper() == 'DESCUBIERTO':
                    estado_cell.value = 'CUBIERTO'
                cambios_realizados.append(f"Fila {r} ({proy_val}): Titular cubierto según SAP HO -> '{primer_asignado}' (Estado: CUBIERTO)")
                tit_val = primer_asignado
                tit_norm = normalize_text(tit_val)

            # F. Fin de Contrato oficial de SAP HO
            emp_ho = ho_employees_by_norm.get(tit_norm)
            if not emp_ho:
                # Búsqueda difusa
                words = set(tit_norm.split())
                for k, v in ho_employees_by_norm.items():
                    k_words = set(k.split())
                    if len(words.intersection(k_words)) >= 2:
                        emp_ho = v
                        break

            if emp_ho:
                fin_oficial = emp_ho['fin_contrato']
                fin_actual = str(fin_cell.value or '').strip()

                # Si el contrato en SAP HO es Indefinido pero en Excel ponía "5 dias" o "faltan 10 dias"
                if fin_oficial == "Indefinido" and fin_actual != "Indefinido":
                    fin_cell.value = "Indefinido"
                    cambios_realizados.append(f"Fila {r} ({tit_val}): Fin contrato actualizado a 'Indefinido' (SAP oficial)")
                # Si en SAP HO tiene fecha exacta y en Excel estaba vacío o con texto informal
                elif fin_oficial != "Indefinido" and fin_actual != fin_oficial:
                    fin_cell.value = fin_oficial
                    cambios_realizados.append(f"Fila {r} ({tit_val}): Fin contrato actualizado a fecha exacta SAP '{fin_oficial}'")

                # G. Vacaciones: Saldo de días si está disponible
                if emp_ho['vac_restantes'] > 0 and not num_vac_cell.value:
                    num_vac_cell.value = emp_ho['vac_restantes']
                    cambios_realizados.append(f"Fila {r} ({tit_val}): Días de vacaciones asignados según SAP: {emp_ho['vac_restantes']}")

    # Guardar Excel
    try:
        wb.save(EXCEL_PATH)
        print(f"[OK] Master Excel guardado con éxito. Total de modificaciones aplicadas: {len(cambios_realizados)}")
    except PermissionError:
        print("[ERROR] El archivo Excel está bloqueado o abierto por otra aplicación.")
        return False

    # 5. Sincronizar hacia master_data.js y cache
    print("[5/5] Sincronizando hacia master_data.js y actualizando vistas...")
    from ho_master_sync import HOMasterSynchronizer
    syncer = HOMasterSynchronizer()
    syncer.sync(update_excel_file=False)

    print("\n" + "="*70)
    print("DETALLE DE MODIFICACIONES APLICADAS SEGÚN SAP HO:")
    print("=" * 70)
    for c in cambios_realizados:
        print(f" -> {c}")
    print("=" * 70)
    print(f"¡Sincronización y perfección completada al 100%! ({len(cambios_realizados)} mejoras)")
    return True

if __name__ == "__main__":
    aplicar_correcciones()
