# -*- coding: utf-8 -*-
"""
HO CARTERAS SYNC - Motor de Carteras en Tiempo Real por Gestor · Delegación Barcelona (0801) (SAP S/4HANA HO)
==============================================================================================================

Reglas de negocio 100 % basadas en SAP S/4HANA (`ZPS_HOPER_SRV`):
  1. RESPONSABLE DEL CLIENTE / PROYECTO -> `ProyectoSet.IdResponsable` / `ProyectoSet.Responsable`.
  2. RESPONSABLE DEL TRABAJADOR (RRHH)  -> `EmpleadoSet.IdResponsable` / `EmpleadoSet.NomResponsable`.
  3. ASIGNACIÓN REAL EN CUADRANTE       -> `ExcelEmpleadoSet` (imputación diaria real) + `HAGridSet` (fallback mes).
     Jamás se usa `EmpleadoProyectoSet` para asignar cartera porque es un histórico de habilitaciones.
  4. SEPARACIÓN ESTRICTA DE CRUCES:
     - Trabajador propio en cliente propio       -> `RELACION_DIRECTA`
     - Trabajador de otro gestor en cliente mío  -> `APOYO_EXTERNO` (badge explícito)
     - Trabajador mío en cliente de otro gestor  -> `CEDIDO_OTRO_GESTOR` (badge explícito)
  5. PROYECTOS SIN IMPUTACIÓN RECIENTE:
     - Todo proyecto que lleve más de `DIAS_SIN_IMPUTACION` días sin horas trabajadas en SAP HO
       pasa automáticamente a `estado_actividad = 'SIN_IMPUTACION'` (o `'FINALIZADO'`) para no
       alterar la operativa diaria.
"""

import os
import re
import json
import time
import logging
import threading
import unicodedata
from datetime import datetime, date, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

from ho_service import HOService, OFICINA_BCN, DIVISION_BCN, resolve_sap_project_id, OFICINA_GIRONA

logger = logging.getLogger("HO_Carteras")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_JSON = os.path.join(BASE_DIR, "ho_carteras_cache.json")
CACHE_JS = os.path.join(BASE_DIR, "ho_carteras_data.js")
EMP_CACHE_JSON = os.path.join(BASE_DIR, "ho_employees_cache.json")
MASTER_DATA_JS = os.path.join(BASE_DIR, "master_data.js")

CENTROS_BCN = {"S081", "S082", "S083", "B081", "B082"}
CENTROS_GIRONA = CENTROS_BCN  # Retrocompatibilidad
DIAS_SIN_IMPUTACION = 60
VENTANA_DIAS = 120
MAX_WORKERS = 16

# Lista oficial de Gestores de Barcelona (0801) identificados en SAP HO (EmpleadoSet <-> ProyectoSet)
KNOWN_GESTORES_BCN = [
    {
        "id": "00066957",
        "id_responsable_empleado": "00066957",
        "id_responsable_proyecto": "52404278",
        "nombre": "SONIA CAÑETE CÁRDENAS PERAL",
        "nombre_corto": "Sonia Cañete",
        "alias_sap": "CAÑETE CARDENAS PERAL, SO",
        "rol": "Gestora Operaciones Barcelona (Multicliente)",
        "es_principal": True,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00063967",
        "id_responsable_empleado": "00063967",
        "id_responsable_proyecto": "21773898",
        "nombre": "ADRIÀ SERRANO VIU",
        "nombre_corto": "Adrià Serrano",
        "alias_sap": "SERRANO VIU, ADRIA",
        "rol": "Gestor Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00065945",
        "id_responsable_empleado": "00065945",
        "id_responsable_proyecto": "03856780",
        "nombre": "LIANA GARAYSHINA",
        "nombre_corto": "Liana Garayshina",
        "alias_sap": "GARAYSHINA, LIANA",
        "rol": "Gestora Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00060598",
        "id_responsable_empleado": "00060598",
        "id_responsable_proyecto": "47817940",
        "nombre": "JORDI GIMENEZ FERRER",
        "nombre_corto": "Jordi Gimenez",
        "alias_sap": "GIMENEZ FERRER, JORDI",
        "rol": "Gestor Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00010085",
        "id_responsable_empleado": "00010085",
        "id_responsable_proyecto": "33915443",
        "nombre": "JOSE GARCIA QUESADA",
        "nombre_corto": "Jose Garcia",
        "alias_sap": "GARCIA QUESADA, JOSE",
        "rol": "Gestor Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00027631",
        "id_responsable_empleado": "00027631",
        "id_responsable_proyecto": "47782275",
        "nombre": "ALBA VALVERDE CEREZO",
        "nombre_corto": "Alba Valverde",
        "alias_sap": "VALVERDE CEREZO, ALBA",
        "rol": "Gestora Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00001370",
        "id_responsable_empleado": "00001370",
        "id_responsable_proyecto": "34754177",
        "nombre": "JULIO ORTIZ SANCHEZ",
        "nombre_corto": "Julio Ortiz",
        "alias_sap": "ORTIZ SANCHEZ, JULIO",
        "rol": "Gestor Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00015251",
        "id_responsable_empleado": "00015251",
        "id_responsable_proyecto": "47906036",
        "nombre": "ALBERT SANCHEZ PADROSA",
        "nombre_corto": "Albert Sanchez",
        "alias_sap": "SANCHEZ PADROSA, ALBERT",
        "rol": "Gestor Operaciones Barcelona",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
    {
        "id": "00062620",
        "id_responsable_empleado": "00062620",
        "id_responsable_proyecto": "46468278",
        "nombre": "ALEJANDRO COSCOLIN PEREGRIN",
        "nombre_corto": "Alejandro Coscolin",
        "alias_sap": "COSCOLIN PEREGRIN, ALEJAN",
        "rol": "Servicios Barcelona / Responsable",
        "es_principal": False,
        "empresa_grupo": "SIFU",
        "empresa_badge": "🏢 SIFU",
    },
]

KNOWN_GESTORES_GIRONA = KNOWN_GESTORES_BCN  # Retrocompatibilidad

def _detectar_empresa_grupo(sociedad="", centro="", division="", resp=""):
    soc = str(sociedad or "").upper()
    cen = str(centro or "").upper()
    div = str(division or "").upper()
    r = str(resp or "").upper()
    if "BROCOLI" in soc or "BCL" in soc or cen.startswith("B") or "080B" in div or "RAMOS CUETO" in r or "RODRIGUEZ GARCIA" in r or "ARTURO" in r:
        return "BCL"
    return "SIFU"

_sync_lock = threading.Lock()


def _norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^A-Za-z0-9 ]", " ", s).upper()
    return re.sub(r"\s+", " ", s).strip()


def _sap_date(v):
    m = re.search(r"(-?\d+)", str(v or ""))
    if not m:
        return None
    try:
        return datetime.fromtimestamp(int(m.group(1)) / 1000, tz=timezone.utc).date()
    except Exception:
        return None


def _iso(d):
    return d.isoformat() if d else None


def _es(d):
    return d.strftime("%d/%m/%Y") if d else ""


def _to_float(v):
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return 0.0


def _es_trabajo(tipo_norm):
    """True si la celda de ExcelEmpleadoSet representa horas trabajadas reales."""
    if not tipo_norm:
        return False
    return (
        tipo_norm in {"HORA TRABAJADA", "HORAS TRABAJADAS", "TRABAJO", "EXCESO", "HORA EXTRA"}
        or "HORA TRABAJADA" in tipo_norm
        or "HORAS EXTRAS" in tipo_norm
    )


def _es_baja(tipo_norm):
    """True SOLO si la asignación es Baja IT (evita falso positivo con 'HORA TRA-BAJA-DA')."""
    if not tipo_norm:
        return False
    if "TRABAJ" in tipo_norm:
        return False
    return (
        tipo_norm == "BAJA"
        or tipo_norm.startswith("BAJA ")
        or "BAJA IT" in tipo_norm
        or "INCAPACIDAD" in tipo_norm
        or "ACCIDENTE" in tipo_norm
    )


def _es_vacaciones(tipo_norm):
    if not tipo_norm:
        return False
    return "VACACION" in tipo_norm


def _new_session():
    s = HOService()
    s.connect()
    return s


def _load_emp_cache_enrichment():
    """Carga contadores de vacaciones y detalles enriquecidos de ho_employees_cache.json si existe."""
    if not os.path.exists(EMP_CACHE_JSON):
        return {}
    try:
        with open(EMP_CACHE_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        out = {}
        for emp in (data.get("by_name") or {}).values():
            eid = str(emp.get("id_empleado") or "").strip()
            if eid:
                out[eid] = emp
        return out
    except Exception:
        return {}


def _load_master_excel_hints():
    """Lee horarios y observaciones manuales del Master local para no perder notas operativas."""
    if not os.path.exists(MASTER_DATA_JS):
        return {}
    try:
        with open(MASTER_DATA_JS, "r", encoding="utf-8") as f:
            txt = f.read()
        m = re.search(r"INITIAL_MASTER_DATA\s*=\s*(\[[\s\S]*\])\s*;", txt)
        if not m:
            return {}
        rows = json.loads(m.group(1))
        by_proy_tit = {}
        by_proy = {}
        for r in rows:
            pid = resolve_sap_project_id(r.get("PROYECTO") or "")
            tit = _norm(r.get("TITULAR") or "")
            if pid and tit:
                by_proy_tit[(pid, tit)] = r
            if pid and pid not in by_proy:
                by_proy[pid] = r
        return {"by_proy_tit": by_proy_tit, "by_proy": by_proy}
    except Exception:
        return {}


def _fetch_bcn_employees():
    """Descarga la plantilla asignada a los gestores de Barcelona y trabajadores de Barcelona de Alejandro Coscolin."""
    local = threading.local()

    def _fetch_gestor_emps(g_info):
        hr_id = g_info["id_responsable_empleado"]
        if not getattr(local, "s", None):
            local.s = _new_session()
        rows = local.s.query_entity_set("EmpleadoSet", filter_query=f"IdResponsable eq '{hr_id}'", top=1000) or []
        out = {}
        for e in rows:
            eid = str(e.get("IdEmpleado") or "").strip()
            if not eid:
                continue
            if hr_id == "00062620":  # Alejandro Coscolin
                cen = str(e.get("IdCentro") or "").upper()
                if cen.startswith(("S08", "B08")) or eid == "00041438":
                    out[eid] = e
            else:
                out[eid] = e
        return out

    by_id = {}
    with ThreadPoolExecutor(max_workers=len(KNOWN_GESTORES_BCN)) as pool:
        for res_dict in pool.map(_fetch_gestor_emps, KNOWN_GESTORES_BCN):
            by_id.update(res_dict)
    return by_id


_fetch_girona_employees = _fetch_bcn_employees  # Retrocompatibilidad


def _fetch_candidate_projects():
    """
    Descarga los proyectos de Barcelona:
      1. Todos los proyectos con Division eq '0801' (~704 proyectos de Barcelona).
      2. Más los proyectos asignados directamente a ALEJANDRO COSCOLIN (46468278) en Barcelona (ej. PROY015730-P1 / P2).
    """
    s = _new_session()
    # 1. Proyectos de la División 0801
    rows_div = s.query_entity_set("ProyectoSet", filter_query=f"Division eq '{DIVISION_BCN}'", top=1000) or []
    # 2. Proyectos asignados a Alejandro Coscolin
    rows_coscolin = s.query_entity_set("ProyectoSet", filter_query="IdResponsable eq '46468278'", top=300) or []

    by_pid = {}
    for p in rows_div:
        pid = resolve_sap_project_id(p.get("IdProyecto"))
        if pid:
            by_pid[pid] = p

    for p in rows_coscolin:
        pid = resolve_sap_project_id(p.get("IdProyecto"))
        div = str(p.get("Division") or "").strip()
        denom = (p.get("Denominacion") or "").upper()
        if pid and (div == DIVISION_BCN or "ROC BORONAT" in denom or "015730" in pid):
            by_pid[pid] = p

    return by_pid


def _fetch_missing_projects(pids):
    if not pids:
        return {}
    local = threading.local()

    def _one(pid):
        try:
            if not getattr(local, "s", None):
                local.s = _new_session()
            res = local.s.query_entity_set("ProyectoSet", filter_query=f"IdProyecto eq '{pid}'", top=1) or []
            return pid, (res[0] if res else None)
        except Exception:
            return pid, None

    out = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for pid, p in pool.map(_one, pids):
            if p:
                out[pid] = p
            else:
                out[pid] = {
                    "IdProyecto": pid,
                    "Denominacion": f"Proyecto {pid}",
                    "NomCliente": "CLIENTE SIFU",
                    "Poblacion": "Barcelona",
                    "Calle": "",
                    "Division": DIVISION_BCN,
                    "NomNegocio": "Servicios",
                    "HorasContratadas": 0,
                }
    return out


def _fetch_imputaciones(eids, desde, hasta):
    local = threading.local()
    flt_tpl = (
        "IdEmpleado eq '{eid}' and ( Fecha ge datetime'"
        + desde.strftime("%Y-%m-%dT00:00:00")
        + "' and Fecha le datetime'"
        + hasta.strftime("%Y-%m-%dT00:00:00")
        + "' )"
    )

    def _one(eid):
        try:
            if not getattr(local, "s", None):
                local.s = _new_session()
            rows = local.s.query_entity_set("ExcelEmpleadoSet", filter_query=flt_tpl.format(eid=eid)) or []
            return eid, rows
        except Exception as ex:
            logger.warning(f"ExcelEmpleadoSet {eid}: {ex}")
            return eid, []

    out = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for eid, rows in pool.map(_one, eids):
            out[eid] = rows
    return out


def _fetch_assigned_empleado_proyecto(pids):
    """Descarga EmpleadoProyectoSet en paralelo para proyectos que no tengan imputaciones recientes."""
    if not pids:
        return {}, set()
    local = threading.local()

    def _one(pid):
        try:
            if not getattr(local, "s", None):
                local.s = _new_session()
            eps = local.s.query_entity_set("EmpleadoProyectoSet", filter_query=f"IdProyecto eq '{pid}'", top=50) or []
            return pid, eps
        except Exception:
            return pid, []

    by_pid = {}
    all_eids = set()
    with ThreadPoolExecutor(max_workers=8) as pool:
        for pid, eps in pool.map(_one, pids):
            if eps:
                by_pid[pid] = eps
                for ep in eps:
                    eid = str(ep.get("IdEmpleado") or "").strip()
                    if eid:
                        all_eids.add(eid)
    return by_pid, all_eids


def _fetch_missing_employees(eids):
    """Descarga EmpleadoSet individual en paralelo de empleados asignados a proyectos que no estaban en centros base."""
    if not eids:
        return {}
    local = threading.local()

    def _one(eid):
        try:
            if not getattr(local, "s", None):
                local.s = _new_session()
            res = local.s.query_entity_set("EmpleadoSet", filter_query=f"IdEmpleado eq '{eid}'", top=1) or []
            return eid, (res[0] if res else None)
        except Exception:
            return eid, None

    out = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for eid, e in pool.map(_one, eids):
            if e:
                out[eid] = e
    return out


def sync_carteras(save_files=True):
    """Sincroniza en tiempo real todas las carteras de los gestores de Barcelona (División 0801)."""
    if not _sync_lock.acquire(blocking=False):
        return load_cached() or {"status": "busy"}

    t0 = time.time()
    try:
        ho = HOService()
        if not ho.connect():
            cached = load_cached()
            if cached:
                cached["ho_connected"] = False
                cached["from_cache"] = True
                return cached
            return {"status": "error", "ho_connected": False, "mensaje": "Sin conexión con SAP HO (VPN)."}

        hoy = date.today()
        desde = hoy - timedelta(days=VENTANA_DIAS)
        fin_mes = (hoy.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        ini_mes = hoy.replace(day=1)
        umbral_activo = hoy - timedelta(days=DIAS_SIN_IMPUTACION)
        ventana_baja_ini = hoy - timedelta(days=2)
        ventana_baja_fin = hoy + timedelta(days=5)

        emp_cache_extra = _load_emp_cache_enrichment()
        master_hints = _load_master_excel_hints()

        # Mapas de gestores de Barcelona
        gestores_map = {g["id"]: dict(g) for g in KNOWN_GESTORES_BCN}
        gestor_by_hr = {g["id_responsable_empleado"]: g["id"] for g in KNOWN_GESTORES_BCN if g.get("id_responsable_empleado")}
        gestor_by_proy = {g["id_responsable_proyecto"]: g["id"] for g in KNOWN_GESTORES_BCN if g.get("id_responsable_proyecto")}
        gestor_by_alias = {}
        for g in KNOWN_GESTORES_BCN:
            gestor_by_alias[_norm(g["nombre"])] = g["id"]
            if g.get("alias_sap"):
                gestor_by_alias[_norm(g["alias_sap"])] = g["id"]
            if g.get("nombre_corto"):
                gestor_by_alias[_norm(g["nombre_corto"])] = g["id"]

        # 1. Descargar en paralelo empleados de Barcelona + proyectos candidatos de Barcelona
        with ThreadPoolExecutor(max_workers=2) as init_pool:
            fut_emps = init_pool.submit(_fetch_bcn_employees)
            fut_proys = init_pool.submit(_fetch_candidate_projects)
            empleados_raw = fut_emps.result()
            proyectos_cand = fut_proys.result()

        # Filtrar empleados activos en SAP
        activos = {}
        for eid, e in empleados_raw.items():
            st = str(e.get("IdStatus") or "3").strip()
            nst = (e.get("NomStatus") or "").upper()
            if st == "3" or nst == "ACTIVO" or (not st and not nst):
                activos[eid] = e

        # 2. Descargar imputaciones reales (ExcelEmpleadoSet) de los empleados de Barcelona
        imput = _fetch_imputaciones(list(activos.keys()), desde, fin_mes)

        # Identificar todos los proyectos donde algún trabajador tiene actividad
        pids_con_actividad_bcn = set()
        for eid, rows in imput.items():
            for r in rows:
                pid = resolve_sap_project_id(r.get("IdProyecto"))
                if pid:
                    pids_con_actividad_bcn.add(pid)

        # Si algún proyecto con actividad de los trabajadores no estaba en proyectos_cand, descargarlo
        faltantes = [pid for pid in pids_con_actividad_bcn if pid not in proyectos_cand]
        if faltantes:
            proyectos_cand.update(_fetch_missing_projects(faltantes))

        # 2.1 Solo consultar EmpleadoProyectoSet para proyectos sin imputación mes si son pocos (máximo 40)
        pids_sin_imput = [pid for pid in proyectos_cand.keys() if pid not in pids_con_actividad_bcn][:40]
        ep_by_proy, _ = _fetch_assigned_empleado_proyecto(pids_sin_imput) if pids_sin_imput else ({}, set())

        # 3. Construir diccionario maestro de proyectos de Barcelona
        proyectos = {}
        for pid, p in proyectos_cand.items():
            div = str(p.get("Division") or "").strip()
            presp = str(p.get("IdResponsable") or "").strip()
            pnom_raw = p.get("Responsable") or ""
            pnom_norm = _norm(pnom_raw)

            # Resolver el gestor responsable del proyecto
            gid = gestor_by_proy.get(presp)
            if not gid:
                gid = gestor_by_alias.get(pnom_norm)
            if not gid:
                for alias_key, mapped_gid in gestor_by_alias.items():
                    if alias_key and (alias_key in pnom_norm or pnom_norm in alias_key):
                        gid = mapped_gid
                        break

            # Si no coincide con ninguno de los gestores conocidos pero está en 0801, mantener responsable original
            g_obj = gestores_map.get(gid)
            g_nom = g_obj["nombre"] if g_obj else (pnom_raw.strip() or "SIN_GESTOR")
            g_corto = g_obj["nombre_corto"] if g_obj else g_nom

            ffin = _sap_date(p.get("FechaFin"))
            negocio = (p.get("NomNegocio") or "Limpieza").strip()
            sector_norm = "AUXILIARES" if ("AUX" in negocio.upper() or "INTEGRA" in negocio.upper()) else "LIMPIEZA"

            proyectos[pid] = {
                "id": pid,
                "denominacion": (p.get("Denominacion") or pid).strip(),
                "cliente": (p.get("NomCliente") or p.get("Denominacion") or "CLIENTE SIFU").strip(),
                "poblacion": (p.get("Poblacion") or "Barcelona").strip().title(),
                "direccion": (p.get("Calle") or p.get("Poblacion") or "Barcelona").strip(),
                "division": div or DIVISION_BCN,
                "es_division_barcelona": (div == DIVISION_BCN),
                "es_division_girona": (div == DIVISION_BCN),  # Retrocompatibilidad
                "sector": negocio,
                "categoria": sector_norm,
                "sociedad": (p.get("NomSociedad") or "").strip(),
                "gestor_id": gid or presp or "SIN_GESTOR",
                "gestor_nombre": g_nom,
                "gestor_corto": g_corto,
                "id_responsable_proyecto": presp,
                "horas_contratadas": _to_float(p.get("HorasContratadas")),
                "fecha_inicio": _iso(_sap_date(p.get("FechaInicio"))),
                "fecha_fin": _iso(ffin),
                "contacto": (p.get("ContactoOperativo") or "").strip(),
                "telefono_contacto": (p.get("TelefonoOperativo") or "").strip(),
                "_hoy": {},
                "_mes": {},
                "_ventana": {},
                "_ultima": None,
                "_finalizado": bool(ffin and ffin < hoy),
            }

        # 4. Procesar trabajadores de Barcelona y cruzar sus imputaciones reales
        trabajadores = {}
        for eid, e in activos.items():
            extra = emp_cache_extra.get(eid, {})
            hr_id = str(e.get("IdResponsable") or extra.get("id_responsable") or "").strip()
            hr_nom = _norm(e.get("NomResponsable") or extra.get("responsable") or "")
            rows = imput.get(eid, [])

            # Resolver gestor RRHH
            gid = gestor_by_hr.get(hr_id)
            if not gid:
                gid = gestor_by_alias.get(hr_nom)
            if not gid:
                for alias_key, mapped_gid in gestor_by_alias.items():
                    if alias_key and (alias_key in hr_nom or hr_nom in alias_key):
                        gid = mapped_gid
                        break

            # Si es Alejandro Coscolin, verificar que sea de Barcelona (S08*, B08* o Doris Imade o imputado en proy BCN)
            if hr_id == "00062620":
                cen = str(e.get("IdCentro") or extra.get("id_centro") or "").upper()
                trabaja_en_bcn = any(resolve_sap_project_id(r.get("IdProyecto")) in proyectos for r in rows)
                if not cen.startswith(("S08", "B08")) and eid != "00041438" and not trabaja_en_bcn:
                    continue

            g_obj = gestores_map.get(gid)
            nom_resp = g_obj["nombre"] if g_obj else (e.get("NomResponsable") or "GESTOR DESCONOCIDO")
            nom_corto = g_obj["nombre_corto"] if g_obj else nom_resp

            ffin_c = _sap_date(e.get("FinContrato"))
            dias_fin = (ffin_c - hoy).days if ffin_c and ffin_c.year < 9999 else extra.get("dias_fin_contrato")
            fin_str = _es(ffin_c) if (ffin_c and ffin_c.year < 9999) else (extra.get("fin_contrato") or "Indefinido")

            vac_tot = int(e.get("vacTotales") or extra.get("vac_totales") or 30)
            vac_tom = int(e.get("vacTomados") or extra.get("vac_tomados") or 0)
            vac_res = int(e.get("vacRestantes") or extra.get("vac_restantes") or max(0, vac_tot - vac_tom))

            per_proy_mes = {}
            per_proy_ventana = {}
            ultima = None
            estado_hoy = "DESCANSO / SIN TURNO HOY"
            proy_hoy = None
            horario_hoy = ""
            baja_activa = False
            vac_activa = False

            for r in rows:
                f = _sap_date(r.get("Fecha"))
                if not f:
                    continue
                pid = resolve_sap_project_id(r.get("IdProyecto"))
                tipo = (r.get("TipoAsignacion") or "").strip()
                tipo_u = _norm(tipo)
                t_imput = (r.get("TipoImputacion") or "").strip()
                hz = (r.get("Horario") or "").strip()
                tz = (r.get("Turno") or "").strip()

                es_trab = _es_trabajo(tipo_u)
                es_bj = _es_baja(tipo_u)
                es_vc = _es_vacaciones(tipo_u)

                if es_trab and f <= hoy and (not ultima or f > ultima):
                    ultima = f

                if ventana_baja_ini <= f <= ventana_baja_fin and es_bj:
                    baja_activa = True
                if f == hoy and es_vc:
                    vac_activa = True

                if f == hoy:
                    # Priorizar Baja > Vacaciones > Hora trabajada si tiene varios registros hoy
                    if es_bj or (es_vc and not _es_baja(_norm(estado_hoy))) or (es_trab and estado_hoy == "DESCANSO / SIN TURNO HOY"):
                        estado_hoy = tipo or "ASIGNADO"
                        proy_hoy = pid
                        if hz and hz != "00:00 - 00:00":
                            horario_hoy = hz
                    elif proy_hoy is None and pid:
                        proy_hoy = pid
                        if tipo:
                            estado_hoy = tipo

                # Acumular en ventana (120 días)
                if f <= hoy and pid:
                    pv = per_proy_ventana.setdefault(pid, {"dias_trab": 0, "dias_baja": 0, "dias_total": 0, "horarios": set(), "ultima": None})
                    pv["dias_total"] += 1
                    if es_trab:
                        pv["dias_trab"] += 1
                        if not pv["ultima"] or f > pv["ultima"]:
                            pv["ultima"] = f
                    elif es_bj:
                        pv["dias_baja"] += 1
                    if hz and hz != "00:00 - 00:00":
                        pv["horarios"].add(hz)

                # Acumular en mes actual
                if ini_mes <= f <= fin_mes and pid:
                    pm = per_proy_mes.setdefault(pid, {
                        "dias_trab": 0,
                        "dias_baja": 0,
                        "dias_vac": 0,
                        "dias_total": 0,
                        "tipos": set(),
                        "roles": set(),
                        "horarios": set(),
                        "turnos": set(),
                    })
                    pm["dias_total"] += 1
                    if tipo:
                        pm["tipos"].add(tipo)
                    if t_imput:
                        pm["roles"].add(t_imput)
                    if es_trab:
                        pm["dias_trab"] += 1
                    elif es_bj:
                        pm["dias_baja"] += 1
                    elif es_vc:
                        pm["dias_vac"] += 1
                    if hz and hz != "00:00 - 00:00":
                        pm["horarios"].add(hz)
                    if tz:
                        pm["turnos"].add(tz)

                # Volcar al proyecto
                P = proyectos.get(pid)
                if P is not None:
                    if es_trab and f <= hoy and (not P["_ultima"] or f > P["_ultima"]):
                        P["_ultima"] = f
                    if f == hoy:
                        P["_hoy"][eid] = tipo or "ASIGNADO"
                    if f <= hoy:
                        pw = P["_ventana"].setdefault(eid, {"dias_trab": 0, "dias_baja": 0, "horarios": set()})
                        if es_trab:
                            pw["dias_trab"] += 1
                        elif es_bj:
                            pw["dias_baja"] += 1
                        if hz and hz != "00:00 - 00:00":
                            pw["horarios"].add(hz)
                    if ini_mes <= f <= fin_mes:
                        m = P["_mes"].setdefault(eid, {
                            "dias_trab": 0,
                            "dias_baja": 0,
                            "dias_vac": 0,
                            "tipos": set(),
                            "roles": set(),
                            "horarios": set(),
                            "turnos": set(),
                        })
                        if tipo:
                            m["tipos"].add(tipo)
                        if t_imput:
                            m["roles"].add(t_imput)
                        if es_trab:
                            m["dias_trab"] += 1
                        elif es_bj:
                            m["dias_baja"] += 1
                        elif es_vc:
                            m["dias_vac"] += 1
                        if hz and hz != "00:00 - 00:00":
                            m["horarios"].add(hz)
                        if tz:
                            m["turnos"].add(tz)

            if baja_activa and not _es_baja(_norm(estado_hoy)):
                estado_hoy = "Baja IT"

            # Ordenar proyectos del trabajador en el mes actual (o ventana si en el mes está de baja/sin días)
            proys_mes_list = []
            source_map = per_proy_mes if per_proy_mes else per_proy_ventana
            for k, v in source_map.items():
                P_ref = proyectos.get(k)
                peso = (v.get("dias_trab", 0) * 3) + (v.get("dias_baja", 0) * 2) + v.get("dias_total", 0)
                proys_mes_list.append({
                    "id": k,
                    "denominacion": P_ref["denominacion"] if P_ref else k,
                    "cliente": P_ref["cliente"] if P_ref else k,
                    "gestor_proyecto_id": P_ref["gestor_id"] if P_ref else "SIN_GESTOR",
                    "gestor_proyecto_nombre": P_ref["gestor_nombre"] if P_ref else "",
                    "dias_trabajados": v.get("dias_trab", 0),
                    "dias_baja": v.get("dias_baja", 0),
                    "dias_total": v.get("dias_total", 0),
                    "horarios": sorted(v.get("horarios", set()))[:3],
                    "roles": sorted(v.get("roles", set())) if "roles" in v else [],
                    "es_barcelona": k in proyectos,
                    "es_girona": k in proyectos,  # Retrocompatibilidad
                    "_peso": peso,
                })
            proys_mes_list.sort(key=lambda x: (-x["_peso"], -x["dias_trabajados"], x["id"]))
            for x in proys_mes_list:
                x.pop("_peso", None)

            principal = proys_mes_list[0] if proys_mes_list else None
            proy_principal_id = principal["id"] if principal else proy_hoy
            if not proy_principal_id:
                for cand_pid, cand_eps in ep_by_proy.items():
                    if any(str(ep.get("IdEmpleado") or "").strip() == eid for ep in cand_eps):
                        proy_principal_id = cand_pid
                        break
            P_princ = proyectos.get(proy_principal_id) if proy_principal_id else None
            horario_principal = (
                horario_hoy
                or (principal["horarios"][0] if (principal and principal["horarios"]) else "")
                or "Según cuadrante SAP HO"
            )
            if proy_principal_id and not proys_mes_list and P_princ:
                proys_mes_list.append({
                    "id": proy_principal_id,
                    "denominacion": P_princ["denominacion"],
                    "cliente": P_princ["cliente"],
                    "gestor_proyecto_id": P_princ["gestor_id"],
                    "gestor_proyecto_nombre": P_princ["gestor_nombre"],
                    "dias_trabajados": 0,
                    "dias_baja": 0,
                    "dias_total": 0,
                    "horarios": [horario_principal],
                    "roles": ["ASIGNADO EN HO"],
                    "es_barcelona": True,
                    "es_girona": True,
                })

            trabaja_hoy = _es_trabajo(_norm(estado_hoy))
            trabajadores[eid] = {
                "id": eid,
                "nombre": _norm(e.get("NombreCompleto") or extra.get("nombre_completo")),
                "dni": (e.get("DNI") or extra.get("dni") or "").strip(),
                "telefono": (e.get("Telefono") or extra.get("telefono") or "").strip(),
                "email": (e.get("Email") or extra.get("email") or "").strip(),
                "centro": (e.get("IdCentro") or extra.get("id_centro") or "").strip(),
                "nom_centro": (e.get("NomCentro") or extra.get("nom_centro") or "BARCELONA").strip(),
                "gestor_id": gid or "SIN_GESTOR",
                "responsable_rrhh": nom_resp,
                "responsable_corto": nom_corto,
                "tipo_contrato": (e.get("DenTipoContrato") or extra.get("tipo_contrato") or ("Fijo" if dias_fin is None else "Temporal")),
                "horas_semana": _to_float(e.get("HorasSemana") or extra.get("horas_semana")),
                "inicio_contrato": _es(_sap_date(e.get("InicioContrato"))) or extra.get("inicio_contrato") or "",
                "fin_contrato": fin_str,
                "dias_fin_contrato": dias_fin,
                "vac_totales": vac_tot,
                "vac_tomados": vac_tom,
                "vac_restantes": vac_res,
                "estado_hoy": estado_hoy,
                "trabajando_hoy": trabaja_hoy,
                "en_baja": baja_activa,
                "de_vacaciones": vac_activa,
                "proyecto_hoy": proy_hoy,
                "proyecto_principal": proy_principal_id,
                "proyecto_principal_nombre": P_princ["denominacion"] if P_princ else (proy_principal_id or "SIN PROYECTO ACTIVO"),
                "cliente_principal": P_princ["cliente"] if P_princ else "SIN CLIENTE EN CUADRANTE",
                "gestor_proyecto_principal_id": P_princ["gestor_id"] if P_princ else (gid or "SIN_GESTOR"),
                "gestor_proyecto_principal_nombre": P_princ["gestor_nombre"] if P_princ else nom_resp,
                "horario_habitual": horario_principal,
                "proyectos_mes": proys_mes_list,
                "ultima_imputacion": _iso(ultima),
                "dias_sin_imputar": (hoy - ultima).days if ultima else None,
                "empresa_grupo": _detectar_empresa_grupo(
                    sociedad=e.get("NomSociedad") or extra.get("sociedad") or (g_obj.get("empresa_grupo") if g_obj else ""),
                    centro=e.get("IdCentro") or extra.get("id_centro"),
                    division=P_princ.get("division") if P_princ else "",
                    resp=nom_resp,
                ),
                "empresa_badge": "🥦 BCL" if _detectar_empresa_grupo(
                    sociedad=e.get("NomSociedad") or extra.get("sociedad") or (g_obj.get("empresa_grupo") if g_obj else ""),
                    centro=e.get("IdCentro") or extra.get("id_centro"),
                    division=P_princ.get("division") if P_princ else "",
                    resp=nom_resp,
                ) == "BCL" else "🏢 SIFU",
                "sociedad": "BROCOLI, S.L." if _detectar_empresa_grupo(
                    sociedad=e.get("NomSociedad") or extra.get("sociedad") or (g_obj.get("empresa_grupo") if g_obj else ""),
                    centro=e.get("IdCentro") or extra.get("id_centro"),
                    division=P_princ.get("division") if P_princ else "",
                    resp=nom_resp,
                ) == "BCL" else "SIFU, S.L.",
            }

        # 5. Cerrar cada proyecto con su plantilla real del mes actual y clasificar estado de actividad
        for pid, P in proyectos.items():
            plantilla = []
            source_emp_map = P["_mes"]
            for eid, m in source_emp_map.items():
                w = trabajadores.get(eid)
                if not w:
                    continue
                dias_tot_mes = m.get("dias_trab", 0) + m.get("dias_baja", 0) + m.get("dias_vac", 0)
                if dias_tot_mes <= 0:
                    continue
                roles = sorted(m.get("roles", set()))
                es_supl = any("SUPL" in r.upper() or r.upper() in {"SB", "SV", "EM"} for r in roles)
                es_apoyo_puntual = (
                    w["proyecto_principal"] != pid
                    and m.get("dias_trab", 0) <= 3
                    and m.get("dias_baja", 0) == 0
                )
                plantilla.append({
                    "id": eid,
                    "nombre": w["nombre"],
                    "gestor_id": w["gestor_id"],
                    "responsable_rrhh": w["responsable_rrhh"],
                    "responsable_corto": w["responsable_corto"],
                    "dias_trabajados_mes": m.get("dias_trab", 0),
                    "dias_baja_mes": m.get("dias_baja", 0),
                    "dias_vac_mes": m.get("dias_vac", 0),
                    "roles": roles,
                    "es_suplente": es_supl,
                    "es_apoyo_puntual": es_apoyo_puntual,
                    "es_proyecto_principal": (w["proyecto_principal"] == pid),
                    "horarios": sorted(m.get("horarios", set()))[:4],
                    "turnos": sorted(m.get("turnos", set())),
                    "estado_hoy": P["_hoy"].get(eid, w["estado_hoy"]),
                    "en_baja_hoy": w["en_baja"] or (m.get("dias_baja", 0) > 0 and m.get("dias_trab", 0) == 0),
                    "de_vacaciones_hoy": w["de_vacaciones"],
                    "telefono": w["telefono"],
                    "dni": w["dni"],
                    "tipo_contrato": w["tipo_contrato"],
                    "fin_contrato": w["fin_contrato"],
                    "dias_fin_contrato": w["dias_fin_contrato"],
                    "vac_restantes": w["vac_restantes"],
                    "vac_tomados": w["vac_tomados"],
                    "vac_totales": w["vac_totales"],
                    "apoyo_externo": (w["gestor_id"] != P["gestor_id"]) and (P["gestor_id"] != "SIN_GESTOR") and (w["gestor_id"] != "SIN_GESTOR"),
                })

            plantilla.sort(key=lambda x: (x["es_apoyo_puntual"], x["es_suplente"], -(x["dias_trabajados_mes"] + x["dias_baja_mes"]), x["nombre"]))

            if not plantilla:
                candidatos_ep = ep_by_proy.get(pid, [])
                for ep in candidatos_ep:
                    eid_ep = str(ep.get("IdEmpleado") or "").strip()
                    w_ep = trabajadores.get(eid_ep)
                    if not w_ep:
                        continue
                    plantilla.append({
                        "id": eid_ep,
                        "nombre": w_ep["nombre"],
                        "gestor_id": w_ep["gestor_id"],
                        "responsable_rrhh": w_ep["responsable_rrhh"],
                        "responsable_corto": w_ep["responsable_corto"],
                        "dias_trabajados_mes": 0,
                        "dias_baja_mes": 0,
                        "dias_vac_mes": 0,
                        "roles": ["ASIGNADO EN HO"],
                        "es_suplente": False,
                        "es_apoyo_puntual": False,
                        "es_proyecto_principal": True,
                        "horarios": [w_ep.get("horario_habitual") or "Según cuadrante SAP HO"],
                        "turnos": ["01"],
                        "estado_hoy": w_ep["estado_hoy"],
                        "en_baja_hoy": w_ep["en_baja"],
                        "de_vacaciones_hoy": w_ep["de_vacaciones"],
                        "telefono": w_ep["telefono"],
                        "dni": w_ep["dni"],
                        "tipo_contrato": w_ep["tipo_contrato"],
                        "fin_contrato": w_ep["fin_contrato"],
                        "dias_fin_contrato": w_ep["dias_fin_contrato"],
                        "vac_restantes": w_ep["vac_restantes"],
                        "vac_tomados": w_ep["vac_tomados"],
                        "vac_totales": w_ep["vac_totales"],
                        "apoyo_externo": (w_ep["gestor_id"] != P["gestor_id"]) and (P["gestor_id"] != "SIN_GESTOR") and (w_ep["gestor_id"] != "SIN_GESTOR"),
                    })

            ultima = P["_ultima"]
            tiene_imputacion_mes = len(plantilla) > 0
            tiene_imputacion_reciente = tiene_imputacion_mes or bool(ultima and ultima >= umbral_activo)

            if P["_finalizado"] and not tiene_imputacion_reciente:
                estado_act = "FINALIZADO"
            elif tiene_imputacion_reciente or (P.get("horas_contratadas", 0) > 0 and not P["_finalizado"]):
                estado_act = "ACTIVO"
            else:
                estado_act = "SIN_IMPUTACION"

            bajas_hoy = [x["nombre"] for x in plantilla if x["en_baja_hoy"]]
            activos_sin_baja = [x["nombre"] for x in plantilla if not x["en_baja_hoy"] and x["dias_trabajados_mes"] > 0]
            trabajando_hoy = [x["nombre"] for x in plantilla if _es_trabajo(_norm(x["estado_hoy"]))]

            P.update({
                "estado_actividad": estado_act,
                "tiene_imputacion_reciente": (estado_act == "ACTIVO"),
                "ultima_imputacion": _iso(ultima),
                "dias_sin_imputar": (hoy - ultima).days if ultima else None,
                "plantilla": plantilla,
                "n_plantilla": len(plantilla),
                "n_trabajando_hoy": len(trabajando_hoy),
                "bajas_hoy": bajas_hoy,
                "activos_mes": activos_sin_baja,
                "riesgo_descubierto": bool(bajas_hoy) and len(activos_sin_baja) == 0,
                "n_apoyos_externos": sum(1 for x in plantilla if x["apoyo_externo"]),
            })
            for k in ("_hoy", "_mes", "_ventana", "_ultima", "_finalizado"):
                P.pop(k, None)

        # 6. Construir lista unificada de SERVICIOS OPERATIVOS (para la tabla principal de Cartera)
        servicios_operativos = _build_servicios_operativos(proyectos, trabajadores, gestores_map, master_hints)

        # 7. Calcular KPIs exactos por cada Gestor de Barcelona
        gestores_out = []
        for g in KNOWN_GESTORES_BCN:
            gid = g["id"]
            pid_proy = g.get("id_responsable_proyecto")
            valid_ids = {gid}
            if pid_proy:
                valid_ids.add(pid_proy)
            if g.get("id_responsable_empleado"):
                valid_ids.add(g["id_responsable_empleado"])

            proys_gestor = [
                p for p in proyectos.values()
                if p.get("gestor_id") in valid_ids
                or p.get("id_responsable_proyecto") in valid_ids
                or any(x.get("gestor_id") in valid_ids for x in p.get("plantilla", []))
            ]
            mis_p = proys_gestor if proys_gestor else [p for p in proyectos.values() if p.get("gestor_id") in valid_ids]
            mis_w = [w for w in trabajadores.values() if w.get("gestor_id") in valid_ids]
            act_p = [p for p in mis_p if p.get("estado_actividad") == "ACTIVO"]

            cedidos = [
                w for w in mis_w
                if w["proyecto_principal"]
                and w["proyecto_principal"] in proyectos
                and proyectos[w["proyecto_principal"]]["gestor_id"] not in (valid_ids | {"SIN_GESTOR"})
            ]

            mis_srv_activos = [
                s for s in servicios_operativos
                if (s.get("gestor_id") in valid_ids or s.get("gestor_empleado_id") in valid_ids or s.get("gestor_proyecto_id") in valid_ids)
                and s.get("tieneImputacionReciente")
            ]
            mis_srv_hist = [
                s for s in servicios_operativos
                if (s.get("gestor_id") in valid_ids or s.get("gestor_empleado_id") in valid_ids or s.get("gestor_proyecto_id") in valid_ids)
                and not s.get("tieneImputacionReciente")
            ]

            g_copy = dict(g)
            g_copy["kpis"] = {
                "proyectos_total": len(mis_p),
                "proyectos_activos": len(act_p),
                "proyectos_sin_imputacion": sum(1 for p in mis_p if p["estado_actividad"] == "SIN_IMPUTACION"),
                "proyectos_finalizados": sum(1 for p in mis_p if p["estado_actividad"] == "FINALIZADO"),
                "servicios_operativos_activos": len(mis_srv_activos),
                "servicios_historicos": len(mis_srv_hist),
                "horas_contratadas_activas": round(sum(p["horas_contratadas"] for p in act_p), 1),
                "trabajadores": len(mis_w),
                "trabajadores_barcelona": sum(1 for w in mis_w if w["centro"] in CENTROS_BCN or str(w["centro"]).startswith(("S08", "B08"))),
                "trabajadores_girona": sum(1 for w in mis_w if w["centro"] in CENTROS_BCN or str(w["centro"]).startswith(("S08", "B08"))),  # Retrocompatibilidad
                "trabajando_hoy": sum(1 for w in mis_w if w["trabajando_hoy"]),
                "en_baja": sum(1 for w in mis_w if w["en_baja"]),
                "de_vacaciones": sum(1 for w in mis_w if w["de_vacaciones"]),
                "contratos_fin_45d": sum(1 for w in mis_w if w["dias_fin_contrato"] is not None and 0 <= w["dias_fin_contrato"] <= 45),
                "riesgos_descubierto": sum(1 for s in mis_srv_activos if s["esUrgente"]),
                "apoyos_externos": sum(p["n_apoyos_externos"] for p in act_p),
                "cedidos": len(cedidos),
            }
            gestores_out.append(g_copy)

        payload = {
            "status": "ok",
            "ho_connected": True,
            "from_cache": False,
            "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "elapsed_seconds": round(time.time() - t0, 2),
            "fecha_referencia": hoy.isoformat(),
            "division": DIVISION_BCN,
            "dias_sin_imputacion_umbral": DIAS_SIN_IMPUTACION,
            "gestor_principal_id": "00066957",
            "gestor_principal_nombre": "SONIA CAÑETE CÁRDENAS PERAL",
            "gestores": gestores_out,
            "proyectos": sorted(
                proyectos.values(),
                key=lambda p: (p["estado_actividad"] != "ACTIVO", p["gestor_nombre"], p["denominacion"]),
            ),
            "trabajadores": sorted(
                trabajadores.values(),
                key=lambda w: (w["responsable_rrhh"], w["nombre"]),
            ),
            "servicios_operativos": servicios_operativos,
        }

        if save_files:
            _save(payload)

        logger.info(
            f"[CARTERAS BCN] OK en {payload['elapsed_seconds']}s · "
            f"{len(gestores_out)} gestores · {len(proyectos)} proyectos · "
            f"{len(trabajadores)} trabajadores · {len(servicios_operativos)} filas operativas"
        )
        return payload
    finally:
        _sync_lock.release()


def _build_servicios_operativos(proyectos, trabajadores, gestores_map, master_hints):
    """
    Construye las filas operativas desglosadas por Gestor con trazabilidad 100% SAP HO:
      - Para cada proyecto ACTIVO:
        * Empareja automáticamente a los titulares en Baja IT con los operarios de sustitución/refuerzo
          que están cubriendo ese mismo proyecto en el mes actual (`BAJA CUBIERTA`).
        * Evita inflar filas por visitas puntuales de brigada (<= 3 días en el mes cuando el operario
          ya tiene otro centro principal).
      - Para cada proyecto SIN_IMPUTACION / FINALIZADO:
        * Genera 1 fila con `tieneImputacionReciente = False` para la sección 1.5 (Sin Imputación Reciente),
          de modo que nunca altere la operativa diaria.
    """
    by_proy_tit = (master_hints or {}).get("by_proy_tit", {})
    by_proy = (master_hints or {}).get("by_proy", {})
    servicios = []
    idx = 0
    seen_worker_active = set()

    for pid, P in proyectos.items():
        plantilla = P.get("plantilla") or []
        es_activo = P.get("tiene_imputacion_reciente", False)
        hint_p = by_proy.get(pid, {})

        if es_activo and plantilla:
            # Filtrar apoyos puntuales de <=3 días salvo que sean los únicos en el proyecto
            principales = [x for x in plantilla if not x["es_apoyo_puntual"]]
            efectivos = principales if principales else plantilla

            en_baja_list = [x for x in efectivos if x["en_baja_hoy"]]
            activos_list = [x for x in efectivos if not x["en_baja_hoy"]]

            suplentes_usados_ids = set()
            baja_suplente_map = {}

            if en_baja_list and activos_list:
                candidatos_supl = sorted(
                    activos_list,
                    key=lambda x: (not x["es_suplente"], x["dias_trabajados_mes"]),
                )
                for b_emp in en_baja_list:
                    hint_b = by_proy_tit.get((pid, b_emp["nombre"])) or {}
                    supl_hint_norm = _norm(hint_b.get("SUPL") or "")
                    elegido = None
                    if supl_hint_norm:
                        elegido = next((c for c in candidatos_supl if c["nombre"] == supl_hint_norm and c["id"] not in suplentes_usados_ids), None)
                    if not elegido and candidatos_supl:
                        elegido = next((c for c in candidatos_supl if c["id"] not in suplentes_usados_ids), None)
                    if elegido:
                        baja_suplente_map[b_emp["id"]] = elegido
                        if elegido["es_suplente"] or len(en_baja_list) >= len(activos_list):
                            suplentes_usados_ids.add(elegido["id"])

            filas_proyecto = [x for x in efectivos if x["id"] not in suplentes_usados_ids]

            for t in filas_proyecto:
                seen_worker_active.add(t["id"])
                supl_obj = baja_suplente_map.get(t["id"])
                if supl_obj:
                    seen_worker_active.add(supl_obj["id"])

                hint = by_proy_tit.get((pid, t["nombre"])) or hint_p
                horario = (
                    (t["horarios"][0] if t["horarios"] else "")
                    or (supl_obj["horarios"][0] if (supl_obj and supl_obj.get("horarios")) else "")
                    or (hint.get("HORARIO") if hint else "")
                    or "Según cuadrante SAP HO"
                )

                if t["en_baja_hoy"]:
                    if supl_obj:
                        estado = "BAJA CUBIERTA"
                        badge = "warning"
                        urgente = False
                    else:
                        estado = "BAJA SIN SUPLENTE"
                        badge = "danger"
                        urgente = True
                elif t["de_vacaciones_hoy"]:
                    estado = "VACACIONES"
                    badge = "purple"
                    urgente = False
                else:
                    estado = "CUBIERTO"
                    badge = "ok"
                    urgente = False

                gestor_emp_id = t["gestor_id"] if t["gestor_id"] != "SIN_GESTOR" else P["gestor_id"]
                gestor_proy_id = P["gestor_id"] if P["gestor_id"] != "SIN_GESTOR" else gestor_emp_id
                es_cruce = (
                    gestor_emp_id != "SIN_GESTOR"
                    and gestor_proy_id != "SIN_GESTOR"
                    and gestor_emp_id != gestor_proy_id
                )

                fila_gestor_id = gestor_proy_id if gestor_proy_id != "SIN_GESTOR" else gestor_emp_id
                g_fila = gestores_map.get(fila_gestor_id)

                servicios.append({
                    "id": f"ho_srv_{idx}",
                    "originalIndex": idx,
                    "proyecto": pid,
                    "cliente": P["cliente"],
                    "nombreServicio": P["denominacion"],
                    "direccion": (hint.get("S DIRECCION") if hint else "") or f"{P['direccion']} ({P['poblacion']})",
                    "poblacion": P["poblacion"],
                    "categoria": P["categoria"],
                    "sector": P["sector"],
                    "horario": horario,
                    "titular": t["nombre"],
                    "idEmpleado": t["id"],
                    "dni": t["dni"],
                    "telefono": t["telefono"],
                    "suplente": supl_obj["nombre"] if supl_obj else "",
                    "telefonoSuplente": supl_obj["telefono"] if supl_obj else "",
                    "estado": estado,
                    "estadoBadge": badge,
                    "esUrgente": urgente,
                    "sociedad": P.get("sociedad") or "SIFU, S.L.",
                    "empresa_grupo": _detectar_empresa_grupo(P.get("sociedad"), t.get("centro"), P.get("division"), P.get("gestor_nombre")),
                    "empresa_badge": "🥦 BCL" if _detectar_empresa_grupo(P.get("sociedad"), t.get("centro"), P.get("division"), P.get("gestor_nombre")) == "BCL" else "🏢 SIFU",
                    "gestor_id": fila_gestor_id,
                    "gestor": g_fila["nombre"] if g_fila else t["responsable_rrhh"],
                    "gestorCorto": g_fila["nombre_corto"] if g_fila else t["responsable_corto"],
                    "gestor_empleado_id": gestor_emp_id,
                    "gestor_empleado_nombre": t["responsable_rrhh"],
                    "gestor_proyecto_id": gestor_proy_id,
                    "gestor_proyecto_nombre": P["gestor_nombre"],
                    "es_cruce_gestor": es_cruce,
                    "tipo_relacion": "APOYO_ENTRE_GESTORES" if es_cruce else "DIRECTO",
                    "tieneImputacionReciente": True,
                    "estadoActividadProyecto": P["estado_actividad"],
                    "ultimaImputacion": P["ultima_imputacion"],
                    "diasSinImputar": P["dias_sin_imputar"],
                    "horasContratadasProyecto": P["horas_contratadas"],
                    "diasTrabajadosMes": t["dias_trabajados_mes"],
                    "tipoContrato": t["tipo_contrato"],
                    "finContrato": t["fin_contrato"],
                    "diasRestantesContrato": t["dias_fin_contrato"],
                    "finContratoUrgente": bool(t["dias_fin_contrato"] is not None and 0 <= t["dias_fin_contrato"] <= 45),
                    "diasVacacionesRestantes": str(t["vac_restantes"]),
                    "vacTomados": t["vac_tomados"],
                    "vacTotales": t["vac_totales"],
                    "vacaciones": f"{t['vac_restantes']} días disponibles",
                })
                idx += 1
        elif es_activo:
            # Proyecto ACTIVO EN VIGOR en SAP HO (con contrato vigente / horas contratadas pero sin cuadrante/imputación de personal este mes)
            hint = hint_p
            tit_hist = (hint.get("TITULAR") if hint else "") or "OPERATIVO SEGÚN CONTRATO"
            g_proy = gestores_map.get(P["gestor_id"])
            emp_grupo = _detectar_empresa_grupo(P.get("sociedad"), "", P.get("division"), P.get("gestor_nombre"))
            servicios.append({
                "id": f"ho_srv_{idx}",
                "originalIndex": idx,
                "proyecto": pid,
                "cliente": P["cliente"],
                "nombreServicio": P["denominacion"],
                "direccion": (hint.get("S DIRECCION") if hint else "") or f"{P['direccion']} ({P['poblacion']})",
                "poblacion": P["poblacion"],
                "categoria": P["categoria"],
                "sector": P["sector"],
                "horario": (hint.get("HORARIO") if hint else "") or (f"Contratado: {P['horas_contratadas']}h" if P.get("horas_contratadas") else "Según contrato"),
                "titular": tit_hist,
                "idEmpleado": "",
                "dni": "",
                "telefono": P.get("telefono_contacto") or "",
                "suplente": "",
                "telefonoSuplente": "",
                "estado": "ACTIVO (EN VIGOR)",
                "estadoBadge": "ok",
                "esUrgente": False,
                "sociedad": P.get("sociedad") or ("BROCOLI, S.L." if emp_grupo == "BCL" else "SIFU, S.L."),
                "empresa_grupo": emp_grupo,
                "empresa_badge": "🥦 BCL" if emp_grupo == "BCL" else "🏢 SIFU",
                "gestor_id": P["gestor_id"],
                "gestor": g_proy["nombre"] if g_proy else P["gestor_nombre"],
                "gestorCorto": g_proy["nombre_corto"] if g_proy else P["gestor_corto"],
                "gestor_empleado_id": P["gestor_id"],
                "gestor_empleado_nombre": P["gestor_nombre"],
                "gestor_proyecto_id": P["gestor_id"],
                "gestor_proyecto_nombre": P["gestor_nombre"],
                "es_cruce_gestor": False,
                "tipo_relacion": "DIRECTO",
                "tieneImputacionReciente": True,
                "estadoActividadProyecto": "ACTIVO",
                "ultimaImputacion": P.get("ultima_imputacion"),
                "diasSinImputar": P.get("dias_sin_imputar"),
                "horasContratadasProyecto": P.get("horas_contratadas", 0),
                "diasTrabajadosMes": 0,
                "tipoContrato": "Contrato en vigor",
                "finContrato": P.get("fecha_fin") or "Indefinido",
                "diasRestantesContrato": None,
                "finContratoUrgente": False,
                "diasVacacionesRestantes": "0",
                "vacTomados": 0,
                "vacTotales": 0,
                "vacaciones": "—",
            })
            idx += 1
        else:
            # Proyecto SIN IMPUTACIÓN RECIENTE o FINALIZADO -> 1 fila limpia en la sección 1.5 Históricos
            hint = hint_p
            tit_hist = (hint.get("TITULAR") if hint else "") or "SIN PERSONAL IMPUTADO"
            g_proy = gestores_map.get(P["gestor_id"])
            servicios.append({
                "id": f"ho_hist_{idx}",
                "originalIndex": idx,
                "proyecto": pid,
                "cliente": P["cliente"],
                "nombreServicio": P["denominacion"],
                "direccion": (hint.get("S DIRECCION") if hint else "") or f"{P['direccion']} ({P['poblacion']})",
                "poblacion": P["poblacion"],
                "categoria": P["categoria"],
                "sector": P["sector"],
                "horario": (hint.get("HORARIO") if hint else "") or "Sin cuadrante activo",
                "titular": tit_hist,
                "idEmpleado": "",
                "dni": "",
                "telefono": "",
                "suplente": "",
                "telefonoSuplente": "",
                "estado": "SIN IMPUTACIÓN",
                "estadoBadge": "neutral",
                "esUrgente": False,
                "sociedad": P.get("sociedad") or "SIFU, S.L.",
                "empresa_grupo": _detectar_empresa_grupo(P.get("sociedad"), "", P.get("division"), P.get("gestor_nombre")),
                "empresa_badge": "🥦 BCL" if _detectar_empresa_grupo(P.get("sociedad"), "", P.get("division"), P.get("gestor_nombre")) == "BCL" else "🏢 SIFU",
                "gestor_id": P["gestor_id"],
                "gestor": g_proy["nombre"] if g_proy else P["gestor_nombre"],
                "gestorCorto": g_proy["nombre_corto"] if g_proy else P["gestor_corto"],
                "gestor_empleado_id": P["gestor_id"],
                "gestor_empleado_nombre": P["gestor_nombre"],
                "gestor_proyecto_id": P["gestor_id"],
                "gestor_proyecto_nombre": P["gestor_nombre"],
                "es_cruce_gestor": False,
                "tipo_relacion": "HISTORICO_SIN_IMPUTACION",
                "tieneImputacionReciente": False,
                "estadoActividadProyecto": P["estado_actividad"],
                "ultimaImputacion": P["ultima_imputacion"],
                "diasSinImputar": P["dias_sin_imputar"],
                "horasContratadasProyecto": P["horas_contratadas"],
                "diasTrabajadosMes": 0,
                "tipoContrato": "—",
                "finContrato": P["fecha_fin"] or "—",
                "diasRestantesContrato": None,
                "finContratoUrgente": False,
                "diasVacacionesRestantes": "0",
                "vacTomados": 0,
                "vacTotales": 0,
                "vacaciones": "Proyecto sin imputación reciente",
            })
            idx += 1

    # Garantizar que ningún trabajador activo de un gestor quede oculto aunque este mes no tenga aún proyecto imputado
    for eid, w in trabajadores.items():
        if eid in seen_worker_active:
            continue
        if w["gestor_id"] == "SIN_GESTOR":
            continue
        g_w = gestores_map.get(w["gestor_id"])
        pid = w["proyecto_principal"] or "PENDIENTE-CUADRANTE"
        P = proyectos.get(pid)
        servicios.append({
            "id": f"ho_w_{idx}",
            "originalIndex": idx,
            "proyecto": pid,
            "cliente": P["cliente"] if P else w["cliente_principal"],
            "nombreServicio": P["denominacion"] if P else w["proyecto_principal_nombre"],
            "direccion": f"{P['direccion']} ({P['poblacion']})" if P else w["nom_centro"],
            "poblacion": P["poblacion"] if P else w["nom_centro"],
            "categoria": P["categoria"] if P else "LIMPIEZA",
            "sector": P["sector"] if P else "Limpieza",
            "horario": w["horario_habitual"],
            "titular": w["nombre"],
            "idEmpleado": w["id"],
            "dni": w["dni"],
            "telefono": w["telefono"],
            "suplente": "",
            "telefonoSuplente": "",
            "estado": "BAJA SIN SUPLENTE" if w["en_baja"] else ("VACACIONES" if w["de_vacaciones"] else "CUBIERTO"),
            "estadoBadge": "danger" if w["en_baja"] else ("purple" if w["de_vacaciones"] else "ok"),
            "esUrgente": bool(w["en_baja"]),
            "sociedad": (P["sociedad"] if P else "") or "SIFU, S.L.",
            "empresa_grupo": _detectar_empresa_grupo(P.get("sociedad") if P else "", w.get("centro"), P.get("division") if P else "", w.get("responsable_rrhh")),
            "empresa_badge": "🥦 BCL" if _detectar_empresa_grupo(P.get("sociedad") if P else "", w.get("centro"), P.get("division") if P else "", w.get("responsable_rrhh")) == "BCL" else "🏢 SIFU",
            "gestor_id": w["gestor_id"],
            "gestor": g_w["nombre"] if g_w else w["responsable_rrhh"],
            "gestorCorto": g_w["nombre_corto"] if g_w else w["responsable_corto"],
            "gestor_empleado_id": w["gestor_id"],
            "gestor_empleado_nombre": w["responsable_rrhh"],
            "gestor_proyecto_id": P["gestor_id"] if P else w["gestor_id"],
            "gestor_proyecto_nombre": P["gestor_nombre"] if P else w["responsable_rrhh"],
            "es_cruce_gestor": bool(P and P["gestor_id"] not in (w["gestor_id"], "SIN_GESTOR")),
            "tipo_relacion": "DIRECTO",
            "tieneImputacionReciente": True,
            "estadoActividadProyecto": "ACTIVO",
            "ultimaImputacion": w["ultima_imputacion"],
            "diasSinImputar": w["dias_sin_imputar"],
            "horasContratadasProyecto": P["horas_contratadas"] if P else 0,
            "diasTrabajadosMes": 0,
            "tipoContrato": w["tipo_contrato"],
            "finContrato": w["fin_contrato"],
            "diasRestantesContrato": w["dias_fin_contrato"],
            "finContratoUrgente": bool(w["dias_fin_contrato"] is not None and 0 <= w["dias_fin_contrato"] <= 45),
            "diasVacacionesRestantes": str(w["vac_restantes"]),
            "vacTomados": w["vac_tomados"],
            "vacTotales": w["vac_totales"],
            "vacaciones": f"{w['vac_restantes']} días disponibles",
        })
        idx += 1

    return servicios


def _save(payload):
    txt = json.dumps(payload, ensure_ascii=False)
    tmp = CACHE_JSON + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(txt)
    os.replace(tmp, CACHE_JSON)

    tmp_js = CACHE_JS + ".tmp"
    with open(tmp_js, "w", encoding="utf-8") as f:
        f.write("// Carteras en Tiempo Real por Gestor · Delegación Barcelona (0801) · SAP S/4HANA HO\n")
        f.write("window.HO_CARTERAS_PAYLOAD = " + txt + ";\n")
    os.replace(tmp_js, CACHE_JS)


def load_cached():
    try:
        with open(CACHE_JSON, "r", encoding="utf-8") as f:
            d = json.load(f)
        d["from_cache"] = True
        return d
    except Exception:
        return None


_bg_started = False


def start_background_refresh(interval_seconds=180):
    global _bg_started
    if _bg_started:
        return
    _bg_started = True

    def _loop():
        while True:
            try:
                sync_carteras(save_files=True)
            except Exception as ex:
                logger.warning(f"[CARTERAS] Error en refresco automático: {ex}")
            time.sleep(interval_seconds)

    threading.Thread(target=_loop, name="carteras-refresh", daemon=True).start()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    res = sync_carteras(save_files=True)
    print(json.dumps({
        "status": res.get("status"),
        "elapsed": res.get("elapsed_seconds"),
        "gestores": [{"nombre": g["nombre"], "id": g["id"], **g["kpis"]} for g in res.get("gestores", [])],
    }, ensure_ascii=False, indent=2))
