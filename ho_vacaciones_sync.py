# -*- coding: utf-8 -*-
"""
HO VACACIONES SYNC — Motor de Extracción 100% Tiempo Real SAP S/4HANA HO (Sección 2.4)
Delegación Barcelona (0801) · 9 Gestores Oficiales:
  1. SONIA CAÑETE CÁRDENAS PERAL (00066957)
  2. ADRIÀ SERRANO VIU (00063967)
  3. LIANA GARAYSHINA (00065945)
  4. JORDI GIMÉNEZ FERRER (00060598)
  5. JOSÉ GARCÍA QUESADA (00010085)
  6. ALBA VALVERDE CEREZO (00027631)
  7. JULIO ORTIZ SÁNCHEZ (00001370)
  8. ALBERT SÁNCHEZ PADROSA (00015251)
  9. ALEJANDRO COSCOLIN PEREGRÍN (00062620)
"""

import os
import sys
import json
import time
from datetime import datetime, timezone, date, timedelta
from concurrent.futures import ThreadPoolExecutor
import threading
import re

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', line_buffering=True, errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_JSON_PATH = os.path.join(BASE_DIR, "ho_vacaciones_cache.json")
DATA_JS_PATH = os.path.join(BASE_DIR, "ho_vacaciones_data.js")
CARTERAS_JSON_PATH = os.path.join(BASE_DIR, "ho_carteras_cache.json")
MANUAL_PLANS_PATH = os.path.join(BASE_DIR, "ho_vacaciones_planes_manuales.json")

from ho_service import HOService, HO_ODATA_ROOT
from ho_carteras_sync import KNOWN_GESTORES_BCN, _fetch_bcn_employees

GESTORES_MAP_BY_ID = {g["id"]: g for g in KNOWN_GESTORES_BCN}
GESTORES_MAP_BY_EMP = {g["id_responsable_empleado"]: g["id"] for g in KNOWN_GESTORES_BCN if g.get("id_responsable_empleado")}
GESTORES_MAP_BY_PROY = {g["id_responsable_proyecto"]: g["id"] for g in KNOWN_GESTORES_BCN if g.get("id_responsable_proyecto")}

MESES_NOMBRES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def parse_sap_date(date_str):
    if not date_str:
        return None
    m = re.search(r"\d+", str(date_str))
    if m:
        try:
            return datetime.fromtimestamp(int(m.group(0)) / 1000).date()
        except Exception:
            return None
    return None


def compute_kpis_from_workers(trabajadores):
    """Calcula los KPIs reales consolidados a partir de la lista de trabajadores."""
    total_dias_anuales = sum(t.get("vacTotales", t.get("vac_totales", 0)) for t in trabajadores)
    total_dias_tomados = sum(t.get("vacTomados", t.get("vac_tomados", 0)) for t in trabajadores)
    total_dias_pendientes = sum(t.get("vacRestantes", t.get("vac_restantes", 0)) for t in trabajadores)
    sin_baja = [t for t in trabajadores if not t.get("en_baja_it_actual")]
    con_baja = [t for t in trabajadores if t.get("en_baja_it_actual")]

    dias_anuales_sin_baja = sum(t.get("vacTotales", t.get("vac_totales", 0)) for t in sin_baja)
    dias_tomados_sin_baja = sum(t.get("vacTomados", t.get("vac_tomados", 0)) for t in sin_baja)
    dias_pendientes_sin_baja = sum(t.get("vacRestantes", t.get("vac_restantes", 0)) for t in sin_baja)
    dias_pendientes_con_baja = sum(t.get("vacRestantes", t.get("vac_restantes", 0)) for t in con_baja)

    return {
        "total_asignados_directos": len(trabajadores),
        "total_activos_directos": len(trabajadores),
        "total_sin_baja_it": len(sin_baja),
        "total_con_baja_it": len(con_baja),
        "total_bajas_directos": len(con_baja),
        "total_apoyos_externos": 0,
        "total_dias_anuales_ho": total_dias_anuales,
        "total_dias_imputados_ho": total_dias_tomados,
        "total_dias_pendientes_ho": total_dias_pendientes,
        "dias_anuales_sin_baja_ho": dias_anuales_sin_baja,
        "dias_imputados_sin_baja_ho": dias_tomados_sin_baja,
        "dias_pendientes_sin_baja_ho": dias_pendientes_sin_baja,
        "dias_pendientes_con_baja_ho": dias_pendientes_con_baja,
        "pct_global_disfrutado": round((total_dias_tomados / total_dias_anuales) * 100, 1) if total_dias_anuales > 0 else 0,
        "pct_sin_baja_disfrutado": round((dias_tomados_sin_baja / dias_anuales_sin_baja) * 100, 1) if dias_anuales_sin_baja > 0 else 0,
        "trabajadores_con_pendientes": sum(1 for t in trabajadores if t.get("vacRestantes", 0) > 0),
        "trabajadores_sin_imputar": sum(1 for t in trabajadores if t.get("vacTomados", 0) == 0),
        "trabajadores_parciales": sum(1 for t in trabajadores if t.get("vacTomados", 0) > 0 and t.get("vacRestantes", 0) > 0),
        "trabajadores_completados": sum(1 for t in trabajadores if t.get("vacRestantes", 0) <= 0),
        "trabajadores_con_fechas_cuadrante": sum(1 for t in trabajadores if len(t.get("periodos_vacaciones", [])) > 0),
        "trabajadores_en_vacaciones_hoy": sum(1 for t in trabajadores if any(p.get("estado") == "EN_CURSO" for p in t.get("periodos_vacaciones", []))),
        "trabajadores_con_vacaciones_futuras": sum(1 for t in trabajadores if any(p.get("estado") == "PROGRAMADO" for p in t.get("periodos_vacaciones", [])))
    }


def fetch_single_worker_vacation_data(worker_raw, p_map=None, year=2026, ho_instance=None):
    """Extrae en tiempo real de SAP HO los datos de vacaciones de un único operario."""
    eid = str(worker_raw.get("IdEmpleado") or "").strip().zfill(8)
    ho = ho_instance if ho_instance is not None else HOService()
    if not ho.is_connected:
        ho.connect()

    # 1. Extraer cupo canónico oficial de vacaciones desde SAP S/4HANA EmpleadoSet('{eid}')
    url_emp = f"{HO_ODATA_ROOT}/EmpleadoSet('{eid}')"
    emp_detail = {}
    sap_vt = 0
    sap_vtom = 0
    sap_vrest = 0
    try:
        r_emp = ho.session.get(url_emp, params={"$format": "json"}, timeout=12)
        if r_emp.status_code == 200:
            emp_detail = r_emp.json().get("d", {})
            sap_vt = int(emp_detail.get("vacTotales") or 0)
            sap_vtom = int(emp_detail.get("vacTomados") or 0)
            sap_vrest = int(emp_detail.get("vacRestantes") or 0)
    except Exception:
        pass

    # Combinar metadatos de worker_raw con emp_detail para garantizar ficha 100% completa
    merged_raw = dict(worker_raw)
    if emp_detail:
        for k, v in emp_detail.items():
            if v and not merged_raw.get(k):
                merged_raw[k] = v
        if sap_vt > 0:
            merged_raw["vacTotales"] = sap_vt
            merged_raw["vacTomados"] = sap_vtom
            merged_raw["vacRestantes"] = sap_vrest
    worker_raw = merged_raw

    filter_q = f"IdEmpleado eq '{eid}' and (Fecha ge datetime'{year}-01-01T00:00:00' and Fecha le datetime'{year}-12-31T23:59:59')"
    url = f"{HO_ODATA_ROOT}/ExcelEmpleadoSet"
    rows = []
    try:
        res = ho.session.get(url, params={"$format": "json", "$filter": filter_q}, timeout=15)
        if res.status_code == 200:
            rows = res.json().get("d", {}).get("results", [])
    except Exception:
        pass

    now_d = datetime.now().date()
    today = now_d if now_d.year == year else date(year, 12, 31)
    ventana_baja_ini = today - timedelta(days=2)
    ventana_baja_fin = today + timedelta(days=5)

    full_name = (worker_raw.get("NombreCompleto") or f"{worker_raw.get('Nombre','')} {worker_raw.get('Apellido1','')} {worker_raw.get('Apellido2','')}".strip() or f"Operario {eid}").strip()
    nombre = (worker_raw.get("Nombre") or "").strip()
    ap1 = (worker_raw.get("Apellido1") or "").strip()
    ap2 = (worker_raw.get("Apellido2") or "").strip()
    dni = (worker_raw.get("DNI") or worker_raw.get("Dni") or worker_raw.get("Nif") or "").strip()
    tel = (worker_raw.get("Telefono") or worker_raw.get("Movil") or "600000000").strip()
    email = (worker_raw.get("Email") or f"{eid}@gruposifu.com").strip()

    id_resp = (worker_raw.get("IdResponsable") or "").strip()
    gid = GESTORES_MAP_BY_EMP.get(id_resp, "00060598")
    g_obj = GESTORES_MAP_BY_ID.get(gid, KNOWN_GESTORES_BCN[0])

    proys_emp_ids = set()
    baja_dates = set()
    vac_by_date = {}
    permisos_count = 0

    for r in rows:
        d = parse_sap_date(r.get("Fecha"))
        if not d:
            continue
        ta = (r.get("TipoAsignacion") or "").strip()
        ta_lower = ta.lower()
        pid = (r.get("IdProyecto") or "").strip()
        if pid:
            proys_emp_ids.add(pid)

        if "vac" in ta_lower or ta in ["VC", "VD", "VE", "VN"]:
            cod = "VN" if ("anterior" in ta_lower or ta == "VN") else ("VD" if ("exceso" in ta_lower or ta in ["VD", "VE"]) else "VC")
            vac_by_date[d] = {
                "fecha": d,
                "ta": ta,
                "codigo_tipo": cod,
                "horario": r.get("Horario") or "",
                "proyecto": pid
            }
        elif "baja" in ta_lower or ta == "BJ":
            baja_dates.add(d)
        elif "permiso" in ta_lower or ta in ["AP", "PE"]:
            permisos_count += 1

    es_baja_it_actual = any(ventana_baja_ini <= d <= ventana_baja_fin for d in baja_dates)

    proyectos_asignados = []
    for pid in sorted(proys_emp_ids):
        p_denom = (p_map and p_map.get(pid)) or pid
        proyectos_asignados.append({
            "id_proyecto": pid,
            "denominacion": p_denom,
            "cliente": p_denom,
            "poblacion": "BARCELONA",
            "origen": "Cuadrante 2026",
            "dias_trabajados": 22
        })
    if not proyectos_asignados:
        proyectos_asignados.append({
            "id_proyecto": "PROY-BCN-01",
            "denominacion": "BARCELONA",
            "cliente": "SIFU BARCELONA",
            "poblacion": "BARCELONA",
            "origen": "Cuadrante 2026",
            "dias_trabajados": 22
        })

    sorted_vac_dates = sorted(vac_by_date.keys())
    periodos_list = []
    fechas_detalle = []

    if sorted_vac_dates:
        grupos = []
        curr_grupo = [sorted_vac_dates[0]]
        for d in sorted_vac_dates[1:]:
            prev = curr_grupo[-1]
            gap = (d - prev).days
            if gap == 1 or (gap <= 3 and prev.weekday() >= 4 and d.weekday() <= 1):
                curr_grupo.append(d)
            else:
                grupos.append(curr_grupo)
                curr_grupo = [d]
        if curr_grupo:
            grupos.append(curr_grupo)

        for idx, grp in enumerate(grupos, 1):
            d_start = grp[0]
            d_fin = grp[-1]
            codigos = [vac_by_date[d]["codigo_tipo"] for d in grp]
            cod_dom = "VN" if "VN" in codigos else ("VD" if "VD" in codigos else "VC")

            dias_periodo = []
            curr = d_start
            lab_cnt = 0
            while curr <= d_fin:
                es_lab = curr.weekday() < 5
                info = vac_by_date.get(curr, {})
                cod = info.get("codigo_tipo", cod_dom)
                if es_lab:
                    lab_cnt += 1

                st_dia = "DISFRUTADO" if curr <= today else "PROGRAMADO"
                etiqueta = "Vacaciones Año Anterior" if cod == "VN" else ("Vacaciones Exceso Cuadrante" if cod == "VD" else "Vacaciones Anuales")
                dia_obj = {
                    "fecha": curr.strftime("%Y-%m-%d"),
                    "fecha_es": curr.strftime("%d/%m/%Y"),
                    "dia_semana": DIAS_SEMANA[curr.weekday()],
                    "mes_nombre": MESES_NOMBRES[curr.month],
                    "mes_num": curr.month,
                    "codigo_tipo": cod,
                    "etiqueta_tipo": etiqueta,
                    "es_laborable": es_lab,
                    "estado": st_dia
                }
                dias_periodo.append(dia_obj)
                fechas_detalle.append(dia_obj)
                curr += timedelta(days=1)

            st_per = "DISFRUTADO" if d_fin <= today else ("EN_CURSO" if d_start <= today <= d_fin else "PROGRAMADO")
            st_label = "DISFRUTADO" if st_per == "DISFRUTADO" else ("EN CURSO" if st_per == "EN_CURSO" else "PROGRAMADO")
            concepto = "Vacaciones Año Anterior" if cod_dom == "VN" else ("Vacaciones Exceso de Cuadrante" if cod_dom == "VD" else "Vacaciones Anuales Disfrutadas")
            etiqueta = "Vacaciones Año Anterior" if cod_dom == "VN" else ("Vacaciones Exceso Cuadrante" if cod_dom == "VD" else "Vacaciones Anuales")

            proys_periodo = list(set(vac_by_date[d]["proyecto"] for d in grp if vac_by_date[d].get("proyecto"))) or [proyectos_asignados[0]["id_proyecto"]]

            periodos_list.append({
                "id": f"PER-{eid}-{idx}",
                "id_periodo": f"PER-{eid}-P{idx:02d}",
                "tipo": cod_dom,
                "codigo_tipo": cod_dom,
                "concepto": concepto,
                "etiqueta_tipo": etiqueta,
                "fecha_inicio": d_start.strftime("%d/%m/%Y"),
                "fecha_fin": d_fin.strftime("%d/%m/%Y"),
                "rango_texto": f"{d_start.strftime('%d/%m/%Y')} - {d_fin.strftime('%d/%m/%Y')}",
                "dias_habiles": lab_cnt,
                "dias_naturales": len(dias_periodo),
                "dias_laborables_cuadrante": lab_cnt,
                "mes_inicio": MESES_NOMBRES[d_start.month],
                "mes_num": d_start.month,
                "estado": st_per,
                "estado_label": st_label,
                "proyectos": proys_periodo,
                "dias": dias_periodo
            })

    dias_vc_lab = sum(p["dias_habiles"] for p in periodos_list if p["codigo_tipo"] in ["VC", "VD"])
    dias_vc_nat = sum(p["dias_naturales"] for p in periodos_list if p["codigo_tipo"] in ["VC", "VD"])
    dias_vn_lab = sum(p["dias_habiles"] for p in periodos_list if p["codigo_tipo"] == "VN")
    dias_vn_nat = sum(p["dias_naturales"] for p in periodos_list if p["codigo_tipo"] == "VN")

    if sap_vt > 0:
        vt = sap_vt
        vtom = sap_vtom
        vrest = max(0, sap_vrest)
    else:
        vtom = dias_vc_lab + dias_vn_lab
        vt = max(25, vtom)
        vrest = max(0, vt - vtom)

    return {
        "id_empleado": eid,
        "nombre_completo": full_name,
        "nombre": nombre,
        "apellido1": ap1,
        "apellido2": ap2,
        "dni": dni,
        "telefono": tel,
        "email": email,
        "id_responsable": gid,
        "nom_responsable": g_obj["nombre"],
        "gestor_corto": g_obj["nombre_corto"],
        "es_asignado_directo": True,
        "id_status": "3",
        "nom_status": "Activo",
        "es_activo": True,
        "en_baja_it_actual": es_baja_it_actual,
        "id_centro": worker_raw.get("IdCentro") or "S081",
        "nom_centro": worker_raw.get("NomCentro") or "BARCELONA",
        "id_sociedad": worker_raw.get("IdSociedad") or "C017",
        "nom_sociedad": worker_raw.get("NomSociedad") or "SIFU BARCELONA",
        "vacTotales": vt,
        "vacTomados": vtom,
        "vacRestantes": vrest,
        "vac_totales": vt,
        "vac_tomados": vtom,
        "vac_restantes": vrest,
        "pctDisfrutado": round((vtom / vt) * 100, 1) if vt > 0 else 0,
        "tienePendientes": vrest > 0,
        "total_periodos": len(periodos_list),
        "proyectos_asignados": proyectos_asignados,
        "periodos_vacaciones": periodos_list,
        "dias_vc_naturales_2026": dias_vc_nat,
        "dias_vc_laborables_2026": dias_vc_lab,
        "dias_vn_naturales_2026": dias_vn_nat,
        "dias_vn_laborables_2026": dias_vn_lab,
        "tipo_contrato": worker_raw.get("DenTipoContrato") or "Indefinido",
        "fin_contrato": "Indefinido",
        "horas_semana": float(worker_raw.get("HorasSemana") or 38.5),
        "dias_detalle_cuadrante": fechas_detalle,
        "fechas_detalle": fechas_detalle,
        "otras_ausencias_2026": {
            "Baja": len(baja_dates),
            "Permisos": permisos_count
        }
    }


def sync_all_ho_vacaciones(year=2026, gestor_id="todos", save_files=True):
    """
    Sincroniza en directo desde SAP S/4HANA HO todas las vacaciones de los trabajadores
    de la Delegación Barcelona (0801) para los 9 gestores oficiales a partir de ExcelEmpleadoSet.
    """
    t_start = time.time()
    ho = HOService()
    connected = ho.connect()

    if not connected:
        if os.path.exists(CACHE_JSON_PATH):
            with open(CACHE_JSON_PATH, "r", encoding="utf-8") as f:
                cached = json.load(f)
            cached["ho_connected"] = False
            cached["from_cache"] = True
            return cached
        return {"status": "error", "ho_connected": False, "mensaje": "Sin conexión con SAP HO"}

    cart_bajas_map = {}
    if os.path.exists(CARTERAS_JSON_PATH):
        try:
            with open(CARTERAS_JSON_PATH, "r", encoding="utf-8") as f:
                c_data = json.load(f)
                for item in c_data.get("trabajadores", []):
                    cart_bajas_map[item.get("id")] = bool(item.get("en_baja"))
        except Exception:
            pass

    print("[1/4] Descargando proyectos y empleados oficiales de Barcelona desde SAP HO...")
    proyectos_raw = ho.get_bcn_projects()
    proys_dict = {p.get("IdProyecto"): p for p in proyectos_raw if p.get("IdProyecto")}
    empleados_raw = _fetch_bcn_employees()
    print(f"  Proyectos cargados: {len(proyectos_raw)}, Empleados BCN: {len(empleados_raw)}")

    # 2. Descargar en paralelo tanto el cupo oficial de EmpleadoSet('{eid}') como el histórico de ExcelEmpleadoSet
    print(f"[2/4] Extrayendo en tiempo real cupo oficial SAP HO y cuadrante anual {year} para {len(empleados_raw)} operarios...")
    local = threading.local()

    def _fetch_emp_full_data(eid):
        if not getattr(local, "s", None):
            local.s = HOService()
            local.s.connect()

        # A) Cupo oficial canónico de vacaciones desde SAP HO EmpleadoSet('{eid}')
        official_quota = {"vacTotales": 0, "vacTomados": 0, "vacRestantes": 0}
        emp_detail = {}
        try:
            url_emp = f"{HO_ODATA_ROOT}/EmpleadoSet('{eid}')"
            r_emp = local.s.session.get(url_emp, params={"$format": "json"}, timeout=12)
            if r_emp.status_code == 200:
                emp_detail = r_emp.json().get("d", {})
                vt = int(emp_detail.get("vacTotales") or 0)
                vtom = int(emp_detail.get("vacTomados") or 0)
                vrest = int(emp_detail.get("vacRestantes") or 0)
                official_quota = {
                    "vacTotales": vt,
                    "vacTomados": vtom,
                    "vacRestantes": vrest
                }
        except Exception:
            pass

        # B) Histórico de cuadrante y ausencias desde ExcelEmpleadoSet
        filter_q = f"IdEmpleado eq '{eid}' and (Fecha ge datetime'{year}-01-01T00:00:00' and Fecha le datetime'{year}-12-31T23:59:59')"
        url_excel = f"{HO_ODATA_ROOT}/ExcelEmpleadoSet"
        rows = []
        try:
            res = local.s.session.get(url_excel, params={"$format": "json", "$filter": filter_q}, timeout=20)
            if res.status_code == 200:
                rows = res.json().get("d", {}).get("results", [])
        except Exception:
            pass

        return eid, official_quota, emp_detail, rows

    emp_data_map = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        for eid, quota, emp_detail, rows in pool.map(_fetch_emp_full_data, list(empleados_raw.keys())):
            emp_data_map[eid] = {
                "quota": quota,
                "emp_detail": emp_detail,
                "rows": rows
            }

    print(f"  Históricos y saldos canónicos descargados en {time.time() - t_start:.2f}s")

    # 3. Procesar datos reales de cada trabajador
    print("[3/4] Consolidando vacaciones reales, ausencias y cuadrantes...")
    now_d = datetime.now().date()
    today = now_d if now_d.year == year else date(year, 12, 31)
    ventana_baja_ini = today - timedelta(days=2)
    ventana_baja_fin = today + timedelta(days=5)
    trabajadores = []

    for eid, e in empleados_raw.items():
        id_resp = (e.get("IdResponsable") or "").strip()
        nom_resp = (e.get("NomResponsable") or "").strip()
        gid = GESTORES_MAP_BY_EMP.get(id_resp)
        if not gid:
            for g in KNOWN_GESTORES_BCN:
                if g["nombre_corto"].upper() in nom_resp.upper() or g["nombre"].upper() in nom_resp.upper():
                    gid = g["id"]
                    break
        if not gid:
            gid = "00060598"
        g_obj = GESTORES_MAP_BY_ID.get(gid, KNOWN_GESTORES_BCN[0])

        full_name = (e.get("NombreCompleto") or f"{e.get('Nombre','')} {e.get('Apellido1','')} {e.get('Apellido2','')}".strip() or f"Operario {eid}").strip()
        nombre = (e.get("Nombre") or "").strip()
        ap1 = (e.get("Apellido1") or "").strip()
        ap2 = (e.get("Apellido2") or "").strip()
        dni = (e.get("DNI") or e.get("Dni") or e.get("Nif") or "").strip()
        tel = (e.get("Telefono") or e.get("Movil") or "600000000").strip()
        email = (e.get("Email") or f"{eid}@gruposifu.com").strip()

        info_emp = emp_data_map.get(eid, {})
        quota = info_emp.get("quota", {})
        emp_det = info_emp.get("emp_detail", {})
        rows = info_emp.get("rows", [])

        # Enriquecer campos con detalle individual si faltaban en la lista masiva
        if emp_det:
            full_name = (emp_det.get("NombreCompleto") or full_name).strip()
            dni = (emp_det.get("DNI") or emp_det.get("Dni") or dni).strip()
            tel = (emp_det.get("Telefono") or emp_det.get("Movil") or tel).strip()
            email = (emp_det.get("Email") or email).strip()

        proys_emp_ids = set()
        baja_dates = set()
        vac_by_date = {}
        permisos_count = 0

        for r in rows:
            d = parse_sap_date(r.get("Fecha"))
            if not d:
                continue
            ta = (r.get("TipoAsignacion") or "").strip()
            ta_lower = ta.lower()
            pid = (r.get("IdProyecto") or "").strip()
            if pid:
                proys_emp_ids.add(pid)

            if "vac" in ta_lower or ta in ["VC", "VD", "VE", "VN"]:
                cod = "VN" if ("anterior" in ta_lower or ta == "VN") else ("VD" if ("exceso" in ta_lower or ta in ["VD", "VE"]) else "VC")
                vac_by_date[d] = {
                    "fecha": d,
                    "ta": ta,
                    "codigo_tipo": cod,
                    "horario": r.get("Horario") or "",
                    "proyecto": pid
                }
            elif "baja" in ta_lower or ta == "BJ":
                baja_dates.add(d)
            elif "permiso" in ta_lower or ta in ["AP", "PE"]:
                permisos_count += 1

        if eid in cart_bajas_map:
            es_baja_it_actual = cart_bajas_map[eid]
        else:
            es_baja_it_actual = any(ventana_baja_ini <= d <= ventana_baja_fin for d in baja_dates)

        proyectos_asignados = []
        for pid in sorted(proys_emp_ids):
            p_info = proys_dict.get(pid, {})
            proyectos_asignados.append({
                "id_proyecto": pid,
                "denominacion": p_info.get("Denominacion") or p_info.get("NomCliente") or pid,
                "cliente": p_info.get("NomCliente") or "",
                "poblacion": p_info.get("Poblacion") or "BARCELONA",
                "origen": "Cuadrante 2026",
                "dias_trabajados": 22
            })
        if not proyectos_asignados:
            proyectos_asignados.append({
                "id_proyecto": "PROY-BCN-01",
                "denominacion": "BARCELONA",
                "cliente": "SIFU BARCELONA",
                "poblacion": "BARCELONA",
                "origen": "Cuadrante 2026",
                "dias_trabajados": 22
            })

        sorted_vac_dates = sorted(vac_by_date.keys())
        periodos_list = []
        fechas_detalle = []

        if sorted_vac_dates:
            grupos = []
            curr_grupo = [sorted_vac_dates[0]]
            for d in sorted_vac_dates[1:]:
                prev = curr_grupo[-1]
                gap = (d - prev).days
                if gap == 1 or (gap <= 3 and prev.weekday() >= 4 and d.weekday() <= 1):
                    curr_grupo.append(d)
                else:
                    grupos.append(curr_grupo)
                    curr_grupo = [d]
            if curr_grupo:
                grupos.append(curr_grupo)

            for idx, grp in enumerate(grupos, 1):
                d_start = grp[0]
                d_fin = grp[-1]
                codigos = [vac_by_date[d]["codigo_tipo"] for d in grp]
                cod_dom = "VN" if "VN" in codigos else ("VD" if "VD" in codigos else "VC")

                dias_periodo = []
                curr = d_start
                lab_cnt = 0
                while curr <= d_fin:
                    es_lab = curr.weekday() < 5
                    info = vac_by_date.get(curr, {})
                    cod = info.get("codigo_tipo", cod_dom)
                    if es_lab:
                        lab_cnt += 1

                    st_dia = "DISFRUTADO" if curr <= today else "PROGRAMADO"
                    etiqueta = "Vacaciones Año Anterior" if cod == "VN" else ("Vacaciones Exceso Cuadrante" if cod == "VD" else "Vacaciones Anuales")
                    dia_obj = {
                        "fecha": curr.strftime("%Y-%m-%d"),
                        "fecha_es": curr.strftime("%d/%m/%Y"),
                        "dia_semana": DIAS_SEMANA[curr.weekday()],
                        "mes_nombre": MESES_NOMBRES[curr.month],
                        "mes_num": curr.month,
                        "codigo_tipo": cod,
                        "etiqueta_tipo": etiqueta,
                        "es_laborable": es_lab,
                        "estado": st_dia
                    }
                    dias_periodo.append(dia_obj)
                    fechas_detalle.append(dia_obj)
                    curr += timedelta(days=1)

                st_per = "DISFRUTADO" if d_fin <= today else ("EN_CURSO" if d_start <= today <= d_fin else "PROGRAMADO")
                st_label = "DISFRUTADO" if st_per == "DISFRUTADO" else ("EN CURSO" if st_per == "EN_CURSO" else "PROGRAMADO")
                concepto = "Vacaciones Año Anterior" if cod_dom == "VN" else ("Vacaciones Exceso de Cuadrante" if cod_dom == "VD" else "Vacaciones Anuales Disfrutadas")
                etiqueta = "Vacaciones Año Anterior" if cod_dom == "VN" else ("Vacaciones Exceso Cuadrante" if cod_dom == "VD" else "Vacaciones Anuales")

                proys_periodo = list(set(vac_by_date[d]["proyecto"] for d in grp if vac_by_date[d].get("proyecto"))) or [proyectos_asignados[0]["id_proyecto"]]

                periodos_list.append({
                    "id": f"PER-{eid}-{idx}",
                    "id_periodo": f"PER-{eid}-P{idx:02d}",
                    "tipo": cod_dom,
                    "codigo_tipo": cod_dom,
                    "concepto": concepto,
                    "etiqueta_tipo": etiqueta,
                    "fecha_inicio": d_start.strftime("%d/%m/%Y"),
                    "fecha_fin": d_fin.strftime("%d/%m/%Y"),
                    "rango_texto": f"{d_start.strftime('%d/%m/%Y')} - {d_fin.strftime('%d/%m/%Y')}",
                    "dias_habiles": lab_cnt,
                    "dias_naturales": len(dias_periodo),
                    "dias_laborables_cuadrante": lab_cnt,
                    "mes_inicio": MESES_NOMBRES[d_start.month],
                    "mes_num": d_start.month,
                    "estado": st_per,
                    "estado_label": st_label,
                    "proyectos": proys_periodo,
                    "dias": dias_periodo
                })

        dias_vc_lab = sum(p["dias_habiles"] for p in periodos_list if p["codigo_tipo"] in ["VC", "VD"])
        dias_vc_nat = sum(p["dias_naturales"] for p in periodos_list if p["codigo_tipo"] in ["VC", "VD"])
        dias_vn_lab = sum(p["dias_habiles"] for p in periodos_list if p["codigo_tipo"] == "VN")
        dias_vn_nat = sum(p["dias_naturales"] for p in periodos_list if p["codigo_tipo"] == "VN")

        sap_vt = quota.get("vacTotales", 0)
        sap_vtom = quota.get("vacTomados", 0)
        sap_vrest = quota.get("vacRestantes", 0)

        # Asignación canónica de vacaciones desde SAP S/4HANA HO
        if sap_vt > 0:
            vt = sap_vt
            vtom = sap_vtom
            vrest = max(0, sap_vrest)
        else:
            vtom = dias_vc_lab + dias_vn_lab
            vt = max(25, vtom)
            vrest = max(0, vt - vtom)

        trabajadores.append({
            "id_empleado": eid,
            "nombre_completo": full_name,
            "nombre": nombre,
            "apellido1": ap1,
            "apellido2": ap2,
            "dni": dni,
            "telefono": tel,
            "email": email,
            "id_responsable": gid,
            "nom_responsable": g_obj["nombre"],
            "gestor_corto": g_obj["nombre_corto"],
            "es_asignado_directo": True,
            "id_status": "3",
            "nom_status": "Activo",
            "es_activo": True,
            "en_baja_it_actual": es_baja_it_actual,
            "id_centro": e.get("IdCentro") or "S081",
            "nom_centro": e.get("NomCentro") or "BARCELONA",
            "id_sociedad": e.get("IdSociedad") or "C017",
            "nom_sociedad": e.get("NomSociedad") or "SIFU BARCELONA",
            "vacTotales": vt,
            "vacTomados": vtom,
            "vacRestantes": vrest,
            "vac_totales": vt,
            "vac_tomados": vtom,
            "vac_restantes": vrest,
            "pctDisfrutado": round((vtom / vt) * 100, 1) if vt > 0 else 0,
            "tienePendientes": vrest > 0,
            "total_periodos": len(periodos_list),
            "proyectos_asignados": proyectos_asignados,
            "periodos_vacaciones": periodos_list,
            "dias_vc_naturales_2026": dias_vc_nat,
            "dias_vc_laborables_2026": dias_vc_lab,
            "dias_vn_naturales_2026": dias_vn_nat,
            "dias_vn_laborables_2026": dias_vn_lab,
            "tipo_contrato": e.get("DenTipoContrato") or "Indefinido",
            "fin_contrato": "Indefinido",
            "horas_semana": float(e.get("HorasSemana") or 38.5),
            "dias_detalle_cuadrante": fechas_detalle,
            "fechas_detalle": fechas_detalle,
            "otras_ausencias_2026": {
                "Baja": len(baja_dates),
                "Permisos": permisos_count
            }
        })

    # 4. KPIs Reales Globales
    print("[4/4] Calculando KPIs reales globales y guardando payload...")
    kpis_payload = compute_kpis_from_workers(trabajadores)

    payload = {
        "status": "ok",
        "ho_connected": True,
        "from_cache": False,
        "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "elapsed_seconds": round(time.time() - t_start, 2),
        "year": year,
        "responsable": {
            "nombre": "DELEGACIÓN BARCELONA (0801)",
            "id_responsable_empleado": "0801",
            "usuario_sap": "acoscolin",
            "delegacion": "0801 - Barcelona"
        },
        "kpis": kpis_payload,
        "trabajadores": trabajadores
    }

    if save_files:
        try:
            with open(CACHE_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)

            with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
                f.write("// Vacaciones 100% Tiempo Real SAP HO · Delegación Barcelona (0801)\n")
                f.write("window.HO_VACACIONES_PAYLOAD = " + json.dumps(payload, ensure_ascii=False) + ";\n")
        except Exception as e:
            print(f"[ERROR] Guardando archivos de vacaciones: {e}")

    print("===========================================================")
    print(f"[OK] Sincronizacion HO 100% Tiempo Real completada en {time.time() - t_start:.2f}s")
    print(f"Total operarios: {len(trabajadores)} | Bajas IT: {kpis_payload['total_con_baja_it']} | Sin Baja: {kpis_payload['total_sin_baja_it']}")
    print(f"Con fechas de vacaciones en cuadrante: {kpis_payload['trabajadores_con_fechas_cuadrante']}")
    print(f"Total dias imputados en HO: {kpis_payload['total_dias_imputados_ho']}d | Pendientes: {kpis_payload['total_dias_pendientes_ho']}d")
    print("===========================================================")
    return payload


def save_manual_vacation_plan(emp_id, action="add", period_data=None, period_id=None, updated_worker=None):
    """
    Guarda en tiempo real una planificación o ajuste de vacaciones hecho por el Gestor
    tanto en ho_vacaciones_planes_manuales.json como en ho_vacaciones_cache.json y ho_vacaciones_data.js.
    """
    emp_id = str(emp_id or "").strip().zfill(8)
    manual_map = {}
    if os.path.exists(MANUAL_PLANS_PATH):
        try:
            with open(MANUAL_PLANS_PATH, "r", encoding="utf-8") as f:
                manual_map = json.load(f)
        except Exception:
            manual_map = {}

    if updated_worker and isinstance(updated_worker, dict):
        manual_map[emp_id] = {
            "updated_at": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "periodos_vacaciones": updated_worker.get("periodos_vacaciones", []),
            "fechas_detalle": updated_worker.get("fechas_detalle", []),
            "vac_totales": updated_worker.get("vac_totales", 25),
            "vac_tomados": updated_worker.get("vac_tomados", 0),
            "vac_restantes": updated_worker.get("vac_restantes", 25),
            "notas_gestor": updated_worker.get("notas_gestor", ""),
            "cobertura_suplencia": updated_worker.get("cobertura_suplencia", "")
        }
        try:
            with open(MANUAL_PLANS_PATH, "w", encoding="utf-8") as f:
                json.dump(manual_map, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    if os.path.exists(CACHE_JSON_PATH):
        try:
            with open(CACHE_JSON_PATH, "r", encoding="utf-8") as f:
                cached = json.load(f)
            t_list = cached.get("trabajadores", [])
            for idx, w in enumerate(t_list):
                if str(w.get("id_empleado", "")).zfill(8) == emp_id:
                    if updated_worker and isinstance(updated_worker, dict):
                        t_list[idx] = updated_worker
                    break
            cached["kpis"] = compute_kpis_from_workers(t_list)
            cached["timestamp"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            with open(CACHE_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(cached, f, ensure_ascii=False, indent=2)
            with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
                f.write("// Vacaciones 100% Tiempo Real SAP HO · Delegación Barcelona (0801)\n")
                f.write("window.HO_VACACIONES_PAYLOAD = " + json.dumps(cached, ensure_ascii=False) + ";\n")
            return {"status": "ok", "kpis": cached["kpis"], "timestamp": cached["timestamp"]}
        except Exception as e:
            return {"status": "error", "mensaje": str(e)}
    return {"status": "ok"}


if __name__ == "__main__":
    res = sync_all_ho_vacaciones(year=2026, save_files=True)
