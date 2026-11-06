# -*- coding: utf-8 -*-
"""
HO SERVICE - Conector Oficial SAP S/4HANA (ZPS_HOPER_SRV)
Permite interactuar con el ERP corporativo HO mediante OData REST v2,
con soporte de autenticacion HTTP Basic, sesiones con cookies y tokens CSRF para escrituras.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
import requests
from requests.auth import HTTPBasicAuth

# Configuracion de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("HO_Service")

HO_BASE_URL = "http://qgssrvs4pro.gruposifu.com:8000"
HO_ODATA_ROOT = f"{HO_BASE_URL}/sap/opu/odata/sap/ZPS_HOPER_SRV"
HO_APP_URL = f"{HO_BASE_URL}/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#"

DEFAULT_USER = "acoscolin"
DEFAULT_PASS = "Sifucosco21"
RESPONSABLE_ID = "46468278"
RESPONSABLE_NAME = "COSCOLIN PEREGRIN, ALEJAN"
OFICINA_BCN = "0801"
DIVISION_BCN = "0801"
OFICINA_ACTUAL = OFICINA_BCN
DIVISION_ACTUAL = DIVISION_BCN
OFICINA_GIRONA = "1701"
HO_PROJECTS_URL = f"{HO_BASE_URL}/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#/Projects"
BCN_PREFIXES = ["08", "BCN", "BARCELONA", "BADALONA", "HOSPITALET", "SABADELL", "TERRASSA", "MATARO", "GRANOLLERS", "CORNELLA", "PRAT", "SANT CUGAT"]
GIRONA_PREFIXES = ["17", "GIR", "GIRONA", "FIGUERES", "OLOT", "BLANES", "SALT"]

SAP_PROJECT_ID_MAP = {
    "SVO09390-P1-C017": "SVO10033-P1-C017",
    "SVO09390-P2-C018": "SVO10033-P2-C018",
    "SVO14670-P1-C018": "PROY017304-P1",
    "PROY018708-P1": "PROY018780-P1",
    "PROY0187080-P1": "PROY018780-P1",
    "PROY018171L": "PGOC018171L",
    "PROY01817J": "PGOC018171J",
    "SVO06910-P2-C001": "SVO06910-P1-C018",
}

def resolve_sap_project_id(proy_id):
    """Traduce códigos de proyecto antiguos o con errata al código activo oficial en SAP S/4HANA."""
    if not proy_id:
        return ""
    clean_id = str(proy_id).strip().upper()
    # Normalizar automáticamente SV0 (con dígito cero) a SVO (con letra O)
    if clean_id.startswith("SV0") and len(clean_id) > 3 and clean_id[3].isdigit():
        clean_id = "SVO" + clean_id[3:]
    return SAP_PROJECT_ID_MAP.get(clean_id, clean_id)

class HOService:
    def __init__(self, username=DEFAULT_USER, password=DEFAULT_PASS):
        self.username = username
        self.password = password
        self.auth = HTTPBasicAuth(self.username, self.password)
        self.session = requests.Session()
        self.session.auth = self.auth
        self.csrf_token = None
        self.is_connected = False

    def connect(self):
        """Valida la conectividad con HO y extrae el token CSRF y cookies de sesion."""
        try:
            headers = {
                "Accept": "application/json",
                "x-csrf-token": "Fetch"
            }
            res = self.session.get(f"{HO_ODATA_ROOT}/", headers=headers, timeout=12)
            if res.status_code == 200:
                self.csrf_token = res.headers.get("x-csrf-token")
                self.is_connected = True
                logger.info(f"Conectado con exito a HO (SAP). CSRF Token: {'Disponible' if self.csrf_token else 'No requerido'}")
                return True
            else:
                logger.warning(f"Respuesta inesperada al conectar con HO: HTTP {res.status_code}")
                self.is_connected = False
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"No se pudo conectar a HO (¿VPN Ivanti desconectada?): {e}")
            self.is_connected = False
            return False

    def query_entity_set(self, entity_set, filter_query=None, top=None, select=None):
        """Consulta generica a un EntitySet de OData."""
        if not self.is_connected and not self.connect():
            return None

        url = f"{HO_ODATA_ROOT}/{entity_set}"
        params = {"$format": "json"}
        if filter_query:
            params["$filter"] = filter_query
        if top:
            params["$top"] = str(top)
        if select:
            params["$select"] = select

        headers = {"Accept": "application/json"}
        try:
            res = self.session.get(url, params=params, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                return data.get("d", {}).get("results", [])
            else:
                logger.error(f"Error consultando {entity_set}: HTTP {res.status_code} - {res.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"Fallo en peticion a {entity_set}: {e}")
            return None

    def get_project(self, project_id):
        """Obtiene el detalle completo de un proyecto concreto por su ID."""
        if not self.is_connected and not self.connect():
            return None
        project_id = resolve_sap_project_id(project_id)
        url = f"{HO_ODATA_ROOT}/ProyectoSet('{project_id}')"
        headers = {"Accept": "application/json"}
        try:
            res = self.session.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                return res.json().get("d", {})
            return None
        except Exception as e:
            logger.error(f"Error consultando proyecto {project_id}: {e}")
            return None

    def get_responsable_projects(self, responsable_id=RESPONSABLE_ID, max_results=300):
        """Obtiene todos los proyectos asignados directamente al responsable COSCOLIN PEREGRIN, ALEJAN."""
        return self.query_entity_set("ProyectoSet", filter_query=f"IdResponsable eq '{responsable_id}'", top=max_results) or []

    def get_girona_projects(self, max_results=300):
        """Obtiene los proyectos de Girona gestionados por el responsable COSCOLIN PEREGRIN, ALEJAN."""
        # Filtramos estrictamente por IdResponsable 46468278 (COSCOLIN PEREGRIN, ALEJAN)
        results = self.get_responsable_projects(RESPONSABLE_ID, max_results=max_results)
        if not results:
            # Fallback por oficina 1701 (Girona) o centro de beneficio 17
            results = self.query_entity_set("ProyectoSet", filter_query=f"Division eq '{OFICINA_GIRONA}'", top=max_results)
        return results or []

    def get_bcn_projects(self, max_results=1000):
        """Obtiene los proyectos de Barcelona (División 0801)."""
        return self.query_entity_set("ProyectoSet", filter_query=f"Division eq '{DIVISION_BCN}'", top=max_results) or []

    @staticmethod
    def _parse_sap_pt_time(pt_str):
        """Convierte PT08H30M00S a 08:30."""
        if not pt_str or not isinstance(pt_str, str):
            return ""
        import re
        m = re.match(r"PT(\d{1,2})H(\d{1,2})M", pt_str)
        if m:
            return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"
        return pt_str

    def get_project_cuadrante(self, project_id, fecha_consulta=None):
        """Descarga el cuadrante real completo (HAGridSet + HSGridSet + TurnosPHSet + EmpleadoProyectoSet) de un proyecto en SAP HO."""
        if not self.is_connected and not self.connect():
            return None
        pid = resolve_sap_project_id(project_id)
        mes_actual_fc = datetime.now().strftime("%Y-%m-01T00:00:00")
        fechas_a_consultar = [fecha_consulta] if fecha_consulta else [mes_actual_fc]

        headers = {"Accept": "application/json"}
        filas_map = {}  # (turno_id, emp_id, nom) -> emp_entry
        turnos_dict = {}

        # 1. Consultar HSGridSet del mes actual para saber qué turnos tienen horas de servicio abiertas en el mes en curso
        turnos_hs_activos = {}  # raw_t ('01') -> {'dias_activos': int, 'hora_inicio': str, 'hora_fin': str, 'horarios': list}
        mes_cerrado_sap = False
        fc_hs = fecha_consulta or mes_actual_fc
        try:
            url_hs = f"{HO_ODATA_ROOT}/HSGridSet"
            params_hs = {
                "$format": "json",
                "$filter": f"IdProyecto eq '{pid}' and FechaConsulta eq datetime'{fc_hs}'",
                "$expand": "NAVHSGHSR/NAVHSRHSC"
            }
            res_hs = self.session.get(url_hs, params=params_hs, headers=headers, timeout=12)
            if res_hs.status_code == 200:
                hs_grids = res_hs.json().get("d", {}).get("results", [])
                for hg in hs_grids:
                    mes_cerrado_sap = bool(hg.get("Cerrado", False))
                    for hrow in hg.get("NAVHSGHSR", {}).get("results", []):
                        raw_t = str(hrow.get("Turno") or "01").strip().zfill(2)
                        titulo_h = (hrow.get("Titulo") or "").strip()
                        if "Persona" in titulo_h:
                            continue
                        hcells = hrow.get("NAVHSRHSC", {}).get("results", [])
                        dias_srv = 0
                        horarios_srv = []
                        h_ini_first, h_fin_first = "", ""
                        for hc in hcells:
                            hi = self._parse_sap_pt_time(hc.get("HoraInicio"))
                            hf = self._parse_sap_pt_time(hc.get("HoraFin"))
                            if hf == "23:59":
                                hf = "24:00"
                            if hi and hf and not (hi == "00:00" and hf == "00:00"):
                                dias_srv += 1
                                hp = f"{hi} a {hf}"
                                if hp not in horarios_srv:
                                    horarios_srv.append(hp)
                                if not h_ini_first:
                                    h_ini_first, h_fin_first = hi, hf
                        if dias_srv > 0:
                            turnos_hs_activos[raw_t] = {
                                "dias_servicio_mes": dias_srv,
                                "hora_inicio": h_ini_first,
                                "hora_fin": h_fin_first,
                                "horarios": horarios_srv
                            }
        except Exception as e:
            logger.warning(f"Error consultando HSGridSet para {pid} ({fc_hs}): {e}")

        for fc in fechas_a_consultar:
            url = f"{HO_ODATA_ROOT}/HAGridSet"
            params = {
                "$format": "json",
                "$filter": f"IdProyecto eq '{pid}' and FechaConsulta eq datetime'{fc}'",
                "$expand": "NAVHAGHAR/NAVHARHAC"
            }
            try:
                res = self.session.get(url, params=params, headers=headers, timeout=15)
                if res.status_code == 200:
                    grids = res.json().get("d", {}).get("results", [])
                    for g in grids:
                        nav_rows = g.get("NAVHAGHAR", {}).get("results", [])
                        for row in nav_rows:
                            emp_id = str(row.get("IdEmpleado") or "").strip()
                            titulo_raw = (row.get("Titulo") or "").strip()
                            nom = titulo_raw.split("(")[0].strip() if "(" in titulo_raw else titulo_raw
                            turno_id = str(row.get("Turno") or "01").strip().zfill(2)
                            cells = row.get("NAVHARHAC", {}).get("results", [])

                            tipos_celda = []
                            tipos_imput = []
                            colores = []
                            horarios_set = []
                            dias_activos = 0

                            for c in cells:
                                ta = (c.get("TipoAsignacion") or "").strip()
                                ti = (c.get("IdTipoImput") or "").strip()
                                col = (c.get("Color") or "").strip()
                                if ta and ta not in tipos_celda:
                                    tipos_celda.append(ta)
                                if ti and ti not in tipos_imput:
                                    tipos_imput.append(ti)
                                if col and col not in colores:
                                    colores.append(col)

                                h_ini = self._parse_sap_pt_time(c.get("HoraInicioReal") or c.get("HoraInicioPlan"))
                                h_fin = self._parse_sap_pt_time(c.get("HoraFinReal") or c.get("HoraFinPlan"))
                                if h_fin == "23:59":
                                    h_fin = "24:00"
                                if h_ini and h_fin and not (h_ini == "00:00" and h_fin == "00:00"):
                                    dias_activos += 1
                                    h_pair = f"{h_ini} a {h_fin}"
                                    if h_pair not in horarios_set:
                                        horarios_set.append(h_pair)

                            key = (turno_id, emp_id, nom)
                            if key in filas_map:
                                existing = filas_map[key]
                                for t in tipos_celda:
                                    if t not in existing["tipos_asignacion"]:
                                        existing["tipos_asignacion"].append(t)
                                for ti in tipos_imput:
                                    if ti not in existing["tipos_imputacion"]:
                                        existing["tipos_imputacion"].append(ti)
                                for col in colores:
                                    if col not in existing["colores"]:
                                        existing["colores"].append(col)
                                for hp in horarios_set:
                                    if hp not in existing["horarios"]:
                                        existing["horarios"].append(hp)
                                existing["dias_activos"] = max(existing["dias_activos"], dias_activos)
                                existing["en_baja"] = existing["en_baja"] or ("ROJ" in colores) or ("BJ" in tipos_celda)
                                existing["es_suplente"] = existing["es_suplente"] or ("SB" in tipos_imput) or ("SB" in tipos_celda) or ("SV" in tipos_imput)
                            else:
                                en_baja = ("ROJ" in colores) or ("BJ" in tipos_celda)
                                es_suplente = ("SB" in tipos_imput) or ("SB" in tipos_celda) or ("SV" in tipos_imput) or ("EM" in tipos_imput)
                                if en_baja:
                                    rol = "BAJA IT"
                                elif "SB" in tipos_imput or "SB" in tipos_celda:
                                    rol = "SUPLENTE BAJA (SB)"
                                elif "BR" in tipos_imput:
                                    rol = "BRIGADA / APOYO (BR)"
                                elif "TI" in tipos_imput:
                                    rol = "TITULAR (TI)"
                                else:
                                    rol = ", ".join(tipos_imput or tipos_celda) or "ASIGNADO"

                                filas_map[key] = {
                                    "id_empleado": emp_id,
                                    "nombre": nom,
                                    "titulo_fila": titulo_raw,
                                    "turno": f"T{turno_id}",
                                    "rol": rol,
                                    "tipos_imputacion": tipos_imput,
                                    "tipos_asignacion": tipos_celda,
                                    "colores": colores,
                                    "en_baja": en_baja,
                                    "es_suplente": es_suplente,
                                    "dias_activos": dias_activos,
                                    "horarios": horarios_set
                                }
            except Exception as e:
                logger.warning(f"Error consultando HAGridSet para {pid} ({fc}): {e}")

        filas_cuadrante = list(filas_map.values())
        for emp_entry in filas_cuadrante:
            if emp_entry["en_baja"]:
                emp_entry["rol"] = "BAJA IT"
            elif "SB" in emp_entry["tipos_imputacion"] or "SB" in emp_entry["tipos_asignacion"]:
                emp_entry["rol"] = "SUPLENTE BAJA (SB)"
            elif "BR" in emp_entry["tipos_imputacion"]:
                emp_entry["rol"] = "BRIGADA / APOYO (BR)"
            elif "TI" in emp_entry["tipos_imputacion"]:
                emp_entry["rol"] = "TITULAR (TI)"

            t_id = emp_entry["turno"]
            cod_num = t_id.replace("T", "").zfill(2)
            hs_info = turnos_hs_activos.get(cod_num, {})
            if t_id not in turnos_dict:
                turnos_dict[t_id] = {
                    "id_turno": t_id,
                    "codigo_turno": cod_num,
                    "hora_inicio": hs_info.get("hora_inicio", ""),
                    "hora_fin": hs_info.get("hora_fin", ""),
                    "horarios": list(hs_info.get("horarios", [])),
                    "empleados": [],
                    "en_uso": True,
                    "activo_mes_actual": True,
                    "dias_servicio_mes": hs_info.get("dias_servicio_mes", 30),
                    "historico_cerrado": False
                }
            turnos_dict[t_id]["empleados"].append(emp_entry)
            for hp in emp_entry["horarios"]:
                if hp not in turnos_dict[t_id]["horarios"]:
                    turnos_dict[t_id]["horarios"].append(hp)
                    if not turnos_dict[t_id]["hora_inicio"] and " a " in hp:
                        p_ini, p_fin = hp.split(" a ", 1)
                        turnos_dict[t_id]["hora_inicio"] = p_ini.strip()
                        turnos_dict[t_id]["hora_fin"] = p_fin.strip()

        # Añadir turnos activos en HSGridSet este mes aunque no tengan empleados asignados todavía (vacantes reales del mes actual)
        for cod_hs, hs_info in turnos_hs_activos.items():
            t_key = f"T{cod_hs}"
            if t_key not in turnos_dict:
                turnos_dict[t_key] = {
                    "id_turno": t_key,
                    "codigo_turno": cod_hs,
                    "hora_inicio": hs_info.get("hora_inicio", "08:00"),
                    "hora_fin": hs_info.get("hora_fin", "15:00"),
                    "horarios": list(hs_info.get("horarios", [])),
                    "empleados": [],
                    "en_uso": False,
                    "activo_mes_actual": True,
                    "dias_servicio_mes": hs_info.get("dias_servicio_mes", 0),
                    "historico_cerrado": False
                }

        # Consultar también TurnosPHSet para enriquecer horarios oficiales, pero NO incluir turnos históricos cerrados
        # de meses pasados (ej. verano) si el proyecto ya tiene turnos activos en HSGridSet este mes
        turnos_historicos_cerrados = []
        try:
            url_tph = f"{HO_ODATA_ROOT}/TurnosPHSet"
            params_tph = {
                "$format": "json",
                "$filter": f"IdProyecto eq '{pid}'",
                "$expand": "NAVTPHTPD"
            }
            res_tph = self.session.get(url_tph, params=params_tph, headers=headers, timeout=12)
            if res_tph.status_code == 200:
                tph_results = res_tph.json().get("d", {}).get("results", [])
                for tph in tph_results:
                    nav_turnos = tph.get("NAVTPHTPD", {}).get("results", [])
                    for td in nav_turnos:
                        raw_t = str(td.get("Turno") or "01").strip().zfill(2)
                        t_key = f"T{raw_t}"
                        h_ini_of = self._parse_sap_pt_time(td.get("HoraInicio"))
                        h_fin_of = self._parse_sap_pt_time(td.get("HoraFin"))
                        if h_fin_of == "23:59":
                            h_fin_of = "24:00"
                        par_of = f"{h_ini_of} a {h_fin_of}" if (h_ini_of and h_fin_of) else ""
                        if t_key in turnos_dict:
                            if not turnos_dict[t_key].get("hora_inicio") and h_ini_of:
                                turnos_dict[t_key]["hora_inicio"] = h_ini_of
                            if not turnos_dict[t_key].get("hora_fin") and h_fin_of:
                                turnos_dict[t_key]["hora_fin"] = h_fin_of
                            if par_of and par_of not in turnos_dict[t_key]["horarios"]:
                                turnos_dict[t_key]["horarios"].insert(0, par_of)
                        else:
                            # Si HSGridSet devolvió turnos para este mes y este turno NO está en HSGridSet,
                            # significa que es un turno histórico de meses pasados ya cerrados (ej. T07..T21 de agosto)
                            if turnos_hs_activos:
                                turnos_historicos_cerrados.append({
                                    "id_turno": t_key,
                                    "codigo_turno": raw_t,
                                    "hora_inicio": h_ini_of,
                                    "hora_fin": h_fin_of,
                                    "horarios": [par_of] if par_of else [],
                                    "empleados": [],
                                    "en_uso": False,
                                    "activo_mes_actual": False,
                                    "historico_cerrado": True
                                })
                            else:
                                turnos_dict[t_key] = {
                                    "id_turno": t_key,
                                    "codigo_turno": raw_t,
                                    "hora_inicio": h_ini_of,
                                    "hora_fin": h_fin_of,
                                    "horarios": [par_of] if par_of else [],
                                    "empleados": [],
                                    "en_uso": False,
                                    "activo_mes_actual": True,
                                    "historico_cerrado": False
                                }
        except Exception as e:
            logger.warning(f"Error consultando TurnosPHSet para {pid}: {e}")

        turnos_ordenados = sorted(turnos_dict.values(), key=lambda x: x.get("id_turno", ""))

        emp_proy = self.query_entity_set("EmpleadoProyectoSet", filter_query=f"IdProyecto eq '{pid}'") or []
        empleados_asignados = [
            {
                "id_empleado": str(ep.get("IdEmpleado") or "").strip(),
                "nombre": (ep.get("Nombre") or "").strip(),
                "dni": (ep.get("DNI") or "").strip(),
                "familia": (ep.get("IdFamilia") or "").strip()
            }
            for ep in emp_proy if ep.get("IdEmpleado") or ep.get("Nombre")
        ]

        return {
            "id_proyecto": pid,
            "mes_cerrado": mes_cerrado_sap,
            "turnos": turnos_ordenados,
            "turnos_historicos_cerrados": turnos_historicos_cerrados,
            "filas_cuadrante": filas_cuadrante,
            "empleados_proyecto": empleados_asignados
        }

    def get_project_alerts(self, top=100):
        """Obtiene las alertas activas de proyectos."""
        return self.query_entity_set("AlertasPRSet", top=top) or []

    def get_employee_bajas(self, top=100):
        """Obtiene las bajas IT registradas en HO."""
        return self.query_entity_set("EmpleadoBajaSet", top=top) or []

    def get_employees(self, top=200):
        """Obtiene el catalogo de empleados disponibles en HO."""
        return self.query_entity_set("EmpleadoSet", top=top) or []

    def add_bitacora_entry(self, project_id, text, user=DEFAULT_USER):
        """Registro en bitácora desactivado a petición del usuario."""
        logger.info(f"Registro en bitácora omitido para {project_id} (desactivado por configuración)")
        return True

    def _format_sap_date_payload(self, fecha_str):
        """
        Convierte una fecha YYYY-MM-DD o DD/MM/YYYY a formato /Date(ms)/ en UTC estricto.
        Esto evita que el desfase horario de verano/invierno (UTC+1 / UTC+2 en España)
        desplace la medianoche a las 22:00/23:00 del día anterior en SAP.
        """
        if not fecha_str or fecha_str in ["Indefinida", "null", "None"]:
            dt = datetime.now(timezone.utc)
            y, m, d = dt.year, dt.month, dt.day
        elif isinstance(fecha_str, datetime):
            y, m, d = fecha_str.year, fecha_str.month, fecha_str.day
        else:
            try:
                parts = str(fecha_str).strip().split("T")[0].split("-")
                if len(parts) == 3:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                else:
                    parts = str(fecha_str).strip().split("/")
                    if len(parts) == 3:
                        y, m, d = int(parts[2]), int(parts[1]), int(parts[0])
                    else:
                        now = datetime.now(timezone.utc)
                        y, m, d = now.year, now.month, now.day
            except Exception:
                now = datetime.now(timezone.utc)
                y, m, d = now.year, now.month, now.day

        # Medianoche estricta UTC para coincidir con la convención de fechas OData de SAP
        dt_utc = datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)
        ts_ms = int(dt_utc.timestamp() * 1000)
        return f"/Date({ts_ms})/"

    def asignar_ausencia_empleado(self, id_empleado, fecha_inicio, fecha_fin=None, tipo_asignacion="BJ"):
        """
        Graba directamente una ausencia / baja / vacaciones en el cuadrante de SAP HO (CargaHESet).
        Tipos comunes:
          - 'BJ': Baja IT (Incapacidad Temporal) -> marca casillas en ROJO en el cuadrante
          - 'VC': Vacaciones
          - 'PE' / 'PR': Permiso retribuido
          - 'AB': Absentismo injustificado
        """
        if not self.is_connected and not self.connect():
            return {"status": "error", "mensaje": "Sin conexión con SAP HO"}

        if not fecha_fin:
            fecha_fin = fecha_inicio

        f_ini_sap = self._format_sap_date_payload(fecha_inicio)
        f_fin_sap = self._format_sap_date_payload(fecha_fin)

        url = f"{HO_ODATA_ROOT}/CargaHESet"
        payload = {
            "IdEmpleado": str(id_empleado).zfill(8),
            "TipoAsignacion": tipo_asignacion,
            "FechaInicio": f_ini_sap,
            "FechaFin": f_fin_sap
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": self.csrf_token or ""
        }

        try:
            res = self.session.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code in [200, 201]:
                data = res.json().get("d", {})
                is_error = data.get("Error", False)
                msg = data.get("Mensaje", "Trámite grabado con éxito en el cuadrante de SAP HO")
                dias_cero = ("0" in msg and "días" in msg.lower())
                if dias_cero:
                    logger.warning(f"CargaHESet para {id_empleado}: SAP devolvió 0 días grabados ({msg})")
                else:
                    logger.info(f"CargaHESet ejecutado para {id_empleado}: {msg}")
                return {
                    "status": "ok" if (not is_error and not dias_cero) else "error" if is_error else "alerta",
                    "mensaje": msg,
                    "error": is_error,
                    "dias_grabados_cero": dias_cero,
                    "tipo_asignacion": tipo_asignacion,
                    "id_empleado": id_empleado
                }
            else:
                logger.error(f"Error en CargaHESet: HTTP {res.status_code} - {res.text[:200]}")
                return {"status": "error", "mensaje": f"Error SAP HTTP {res.status_code}"}
        except Exception as e:
            logger.error(f"Fallo de conexión en CargaHESet: {e}")
            return {"status": "error", "mensaje": str(e)}

    def revertir_ausencia_empleado(self, id_empleado, fecha_inicio, fecha_fin=None):
        """Reconvierte absentismo en horas normales de cuadrante (CargaHE2Set)."""
        if not self.is_connected and not self.connect():
            return {"status": "error", "mensaje": "Sin conexión con SAP HO"}

        if not fecha_fin:
            fecha_fin = fecha_inicio

        f_ini_sap = self._format_sap_date_payload(fecha_inicio)
        f_fin_sap = self._format_sap_date_payload(fecha_fin)

        url = f"{HO_ODATA_ROOT}/CargaHE2Set"
        payload = {
            "IdEmpleado": str(id_empleado).zfill(8),
            "Revertir": True,
            "TipoAsignacion": "HO",
            "FechaInicio": f_ini_sap,
            "FechaFin": f_fin_sap
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": self.csrf_token or ""
        }

        try:
            res = self.session.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code in [200, 201]:
                data = res.json().get("d", {})
                return {"status": "ok", "mensaje": data.get("Mensaje", "Ausencia revertida")}
            return {"status": "error", "mensaje": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "error", "mensaje": str(e)}

    def sustituir_empleado(self, id_empleado_ausente, id_empleado_suplente, id_proyecto, fecha_inicio, fecha_fin=None, tipo_imputacion="SB", tipo_exceso="Esporadico"):
        """
        Registra formalmente una sustitución de empleado en SAP HO mediante CargaSPSet.
        - tipo_imputacion: 'EM' (Emergencias), 'SB' (Suplente Baja), 'SC' (Suplente miembro comité), 'SV' (Suplente Vacaciones)
        - tipo_exceso: 'Esporadico' o 'Sobreasignacion'
        """
        if not self.is_connected and not self.connect():
            return {"status": "error", "mensaje": "Sin conexión con SAP HO"}

        if not fecha_fin:
            fecha_fin = fecha_inicio

        f_ini_sap = self._format_sap_date_payload(fecha_inicio)
        f_fin_sap = self._format_sap_date_payload(fecha_fin)

        te = str(tipo_exceso).strip().upper()
        cod_exceso = "SO" if ("SOBRE" in te or te == "SO") else "ES"
        id_proyecto = resolve_sap_project_id(id_proyecto)

        url = f"{HO_ODATA_ROOT}/CargaSPSet"
        payload = {
            "IdProyecto": str(id_proyecto).strip(),
            "IdEmpleado": str(id_empleado_ausente).zfill(8),
            "IdSustituto": str(id_empleado_suplente).zfill(8),
            "FechaInicio": f_ini_sap,
            "FechaFin": f_fin_sap,
            "TipoImputacion": tipo_imputacion,
            "TipoExceso": cod_exceso
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": self.csrf_token or ""
        }

        try:
            res = self.session.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code in [200, 201]:
                data = res.json().get("d", {})
                is_error = data.get("Error", False)
                msg = data.get("Mensaje", "Sustitución registrada en SAP HO con éxito")
                logger.info(f"CargaSPSet ejecutado para ausente {id_empleado_ausente} -> suplente {id_empleado_suplente}: {msg}")
                return {
                    "status": "ok" if not is_error else "error",
                    "mensaje": msg,
                    "error": is_error,
                    "id_proyecto": id_proyecto,
                    "id_empleado": id_empleado_ausente,
                    "id_sustituto": id_empleado_suplente
                }
            else:
                logger.error(f"Error en CargaSPSet: HTTP {res.status_code} - {res.text[:200]}")
                return {"status": "error", "mensaje": f"Error SAP HTTP {res.status_code}"}
        except Exception as e:
            logger.error(f"Fallo de conexión en CargaSPSet: {e}")
            return {"status": "error", "mensaje": str(e)}

    @staticmethod
    def _format_sap_pt_time(hm_str):
        """Convierte '08:00' a 'PT08H00M00S' para Edm.Time de SAP OData."""
        if not hm_str:
            return "PT00H00M00S"
        s = str(hm_str).strip()
        if s.startswith("PT"):
            return s
        if ":" in s:
            parts = s.split(":")
            try:
                h = int(parts[0])
                m = int(parts[1][:2])
                if h == 24:
                    return "PT23H59M59S"
                return f"PT{h:02d}H{m:02d}M00S"
            except Exception:
                pass
        return "PT00H00M00S"

    def crear_turno_servicio(
        self,
        id_proyecto,
        turno="01",
        fecha_inicio=None,
        fecha_fin=None,
        hora_inicio="08:00",
        hora_fin="15:00",
        dias_set=None,
        tipo_dias="T",
        num_personas="1",
        borrar=False
    ):
        """Crea o abre las Horas de Servicio de un turno en el proyecto mediante CargaHSSet."""
        if not self.is_connected and not self.connect():
            return {"status": "error", "mensaje": "Sin conexión con SAP HO"}

        pid = resolve_sap_project_id(id_proyecto)
        raw_t = str(turno or "01").strip().upper().replace("TURNO", "").replace("T", "").strip()
        turno_clean = raw_t.zfill(2) if raw_t.isdigit() else "01"

        if not fecha_inicio:
            fecha_inicio = datetime.now().strftime("%Y-%m-%d")
        if not fecha_fin or fecha_fin in ["Indefinida", "null", "None"]:
            fecha_fin = fecha_inicio

        f_ini_sap = self._format_sap_date_payload(fecha_inicio)
        f_fin_sap = self._format_sap_date_payload(fecha_fin)
        dias = dias_set or {1, 2, 3, 4, 5, 6, 7}
        h_ini_pt = self._format_sap_pt_time(hora_inicio)
        h_fin_pt = self._format_sap_pt_time(hora_fin)
        zero_pt = "PT00H00M00S"

        url = f"{HO_ODATA_ROOT}/CargaHSSet"
        payload = {
            "IdProyecto": pid,
            "Turno": turno_clean,
            "Borrar": bool(borrar),
            "FechaInicio": f_ini_sap,
            "FechaFin": f_fin_sap,
            "Lunes": (1 in dias),
            "Martes": (2 in dias),
            "Miercoles": (3 in dias),
            "Jueves": (4 in dias),
            "Viernes": (5 in dias),
            "Sabado": (6 in dias),
            "Domingo": (7 in dias),
            "TipoDias": str(tipo_dias or "T").strip().upper()[:1] or "T",
            "NumPersonas": str(num_personas or "1"),
            "RecurrenciaDias": "",
            "RecurrenciaSemanas": "",
            "HoraIniLunes": h_ini_pt if (1 in dias) else zero_pt,
            "HoraFinLunes": h_fin_pt if (1 in dias) else zero_pt,
            "HoraIniMartes": h_ini_pt if (2 in dias) else zero_pt,
            "HoraFinMartes": h_fin_pt if (2 in dias) else zero_pt,
            "HoraIniMiercoles": h_ini_pt if (3 in dias) else zero_pt,
            "HoraFinMiercoles": h_fin_pt if (3 in dias) else zero_pt,
            "HoraIniJueves": h_ini_pt if (4 in dias) else zero_pt,
            "HoraFinJueves": h_fin_pt if (4 in dias) else zero_pt,
            "HoraIniViernes": h_ini_pt if (5 in dias) else zero_pt,
            "HoraFinViernes": h_fin_pt if (5 in dias) else zero_pt,
            "HoraIniSabado": h_ini_pt if (6 in dias) else zero_pt,
            "HoraFinSabado": h_fin_pt if (6 in dias) else zero_pt,
            "HoraIniDomingo": h_ini_pt if (7 in dias) else zero_pt,
            "HoraFinDomingo": h_fin_pt if (7 in dias) else zero_pt,
            "Error": False,
            "Mensaje": ""
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": self.csrf_token or ""
        }
        try:
            res = self.session.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code in [200, 201]:
                data = res.json().get("d", {})
                is_err = bool(data.get("Error", False))
                msg = data.get("Mensaje") or f"Turno {turno_clean} creado en {pid}"
                return {"status": "ok" if not is_err else "error", "mensaje": msg, "error": is_err}
            return {"status": "error", "mensaje": f"HTTP {res.status_code}", "error": True}
        except Exception as e:
            return {"status": "error", "mensaje": str(e), "error": True}

    def asignar_cuadrante_empleado(
        self,
        id_proyecto,
        id_empleado,
        turno="01",
        fecha_inicio=None,
        fecha_fin=None,
        hora_inicio="08:00",
        hora_fin="15:00",
        dias_semana=None,
        tipo_dias="T",
        tipo_imputacion="TI",
        tipo_exceso="ES",
        asignar_turno_completo=False,
        borrar=False
    ):
        """
        Crea, modifica o elimina una asignación de turno/cuadrante en SAP S/4HANA HO mediante CargaHASet.
        - turno: código de 2 dígitos del turno ('01', '02', ...)
        - dias_semana: lista de días [1..7] o letras ['L','M','X','J','V','S','D']
        - tipo_dias: 'T' (Todos), 'N' (Normales/Laborables), 'F' (Festivos)
        - tipo_imputacion: 'TI' (Titular), 'BR' (Brigada), 'SB' (Suplente Baja), 'SV' (Suplente Vacaciones), 'EM' (Emergencias), 'SC' (Comité)
        - borrar: True para desasignar/eliminar recurso del turno (CESE)
        """
        if not self.is_connected and not self.connect():
            return {"status": "error", "mensaje": "Sin conexión con SAP HO"}

        pid = resolve_sap_project_id(id_proyecto)
        raw_t = str(turno or "01").strip().upper().replace("TURNO", "").replace("T", "").strip()
        turno_clean = raw_t.zfill(2) if raw_t.isdigit() else "01"

        if not fecha_inicio:
            fecha_inicio = datetime.now().strftime("%Y-%m-%d")
        if not fecha_fin or fecha_fin in ["Indefinida", "null", "None"]:
            fecha_fin = fecha_inicio

        f_ini_sap = self._format_sap_date_payload(fecha_inicio)
        f_fin_sap = self._format_sap_date_payload(fecha_fin)

        dia_letra_map = {
            "L": 1, "LUN": 1, "LUNES": 1, "1": 1,
            "M": 2, "MAR": 2, "MARTES": 2, "2": 2,
            "X": 3, "MI": 3, "MIE": 3, "MIERCOLES": 3, "MIÉRCOLES": 3, "3": 3,
            "J": 4, "JUE": 4, "JUEVES": 4, "4": 4,
            "V": 5, "VIE": 5, "VIERNES": 5, "5": 5,
            "S": 6, "SAB": 6, "SABADO": 6, "SÁBADO": 6, "6": 6,
            "D": 7, "DOM": 7, "DOMINGO": 7, "7": 7
        }
        dias_set = set()
        if dias_semana:
            for x in dias_semana:
                k = str(x).strip().upper()
                if k in dia_letra_map:
                    dias_set.add(dia_letra_map[k])
                elif k.isdigit() and 1 <= int(k) <= 7:
                    dias_set.add(int(k))
        if not dias_set:
            dias_set = {1, 2, 3, 4, 5}

        # Si el rango de fechas es corto (<= 7 días, ej. "Hoy" en sábado o domingo), asegurar que los días del rango estén incluidos
        try:
            from datetime import timedelta
            d0 = datetime.strptime(str(fecha_inicio).strip()[:10], "%Y-%m-%d")
            d1 = datetime.strptime(str(fecha_fin).strip()[:10], "%Y-%m-%d")
            if 0 <= (d1 - d0).days < 7:
                dias_rango = set()
                curr = d0
                while curr <= d1:
                    dias_rango.add(curr.isoweekday())
                    curr += timedelta(days=1)
                if not (dias_set & dias_rango):
                    dias_set = dias_set | dias_rango
        except Exception:
            pass

        te = str(tipo_exceso or "ES").strip().upper()
        cod_exceso = "SO" if ("SOBRE" in te or te == "SO") else "ES"

        ti_map = {
            "TITULAR FIJO": "TI",
            "TITULAR": "TI",
            "TI": "TI",
            "REFUERZO TEMPORAL": "BR",
            "BRIGADA": "BR",
            "BR": "BR",
            "BC": "BC",
            "BP": "BP",
            "SUPLENTE DE CUADRANTE": "SB",
            "SUPLENTE BAJA": "SB",
            "SB": "SB",
            "SUPLENTE VACACIONES": "SV",
            "SV": "SV",
            "EMERGENCIA": "EM",
            "EMERGENCIAS": "EM",
            "EM": "EM",
            "SC": "SC"
        }
        cod_imput = ti_map.get(str(tipo_imputacion or "TI").strip().upper(), "TI")
        td_clean = str(tipo_dias or "T").strip().upper()[:1]
        if td_clean not in ["T", "N", "F"]:
            td_clean = "T"

        # IMPORTANTE SAP S/4HANA: Si AsignarTurnoCompleto=True, SAP ignora FechaInicio/FechaFin y HoraInicio/HoraFin
        # e intenta asignar todo el histórico del turno (incluyendo meses anteriores cerrados).
        # Por tanto, siempre que se indiquen fechas de vigencia o rango acotado, enviamos AsignarTurnoCompleto=False.
        usar_turno_completo = False if (fecha_inicio or fecha_fin or hora_inicio or hora_fin) else bool(asignar_turno_completo)

        url = f"{HO_ODATA_ROOT}/CargaHASet"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": self.csrf_token or ""
        }

        def _build_payload(cod_turno, exceso_override=None, dias_override=None):
            d_use = dias_override or dias_set
            return {
                "IdProyecto": pid,
                "Turno": cod_turno,
                "IdEmpleado": str(id_empleado).zfill(8),
                "Borrar": bool(borrar),
                "FechaInicio": f_ini_sap,
                "FechaFin": f_fin_sap,
                "TipoImputacion": cod_imput,
                "TipoHora": "",
                "AsignarTurnoCompleto": usar_turno_completo,
                "TipoExcesoServicio": exceso_override or cod_exceso,
                "TipoAsignacion": "HO",
                "IdEmpleado2": "",
                "TipoImputacion2": "",
                "Lunes": (1 in d_use),
                "Martes": (2 in d_use),
                "Miercoles": (3 in d_use),
                "Jueves": (4 in d_use),
                "Viernes": (5 in d_use),
                "Sabado": (6 in d_use),
                "Domingo": (7 in d_use),
                "TipoDias": td_clean,
                "RecurrenciaDias": "",
                "RecurrenciaSemanas": "",
                "HoraInicio": self._format_sap_pt_time(hora_inicio),
                "HoraFin": self._format_sap_pt_time(hora_fin)
            }

        try:
            payload = _build_payload(turno_clean)
            res = self.session.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code in [200, 201]:
                data = res.json().get("d", {})
                is_error = data.get("Error", False)
                msg = data.get("Mensaje") or ("Turno desasignado en SAP HO" if borrar else f"Cuadrante grabado en Turno {turno_clean} de {pid}")

                # Si SAP devuelve "Todas las fechas del turno se encuentran cerradas" o "Ningún día/turno coincide",
                # ocurre porque el turno elegido (ej. T20/T21 de verano) no tiene Horas de Servicio (HSGridSet) abiertas
                # en el mes actual o en los días seleccionados.
                if is_error and not borrar and any(k in msg.lower() for k in ["cerrada", "coincide"]):
                    logger.info(f"Turno T{turno_clean} sin horas de servicio abiertas en {pid} ({msg}). Intentando abrir/resolver turno activo en mes actual...")
                    # 1. Intentar abrir el turno en CargaHSSet por si el proyecto tiene horas de contrato disponibles
                    res_hs = self.crear_turno_servicio(
                        id_proyecto=pid,
                        turno=turno_clean,
                        fecha_inicio=fecha_inicio,
                        fecha_fin=fecha_fin,
                        hora_inicio=hora_inicio,
                        hora_fin=hora_fin,
                        dias_set=dias_set,
                        tipo_dias=td_clean
                    )
                    if res_hs.get("status") == "ok":
                        res_retry = self.session.post(url, json=payload, headers=headers, timeout=15)
                        if res_retry.status_code in [200, 201]:
                            d_retry = res_retry.json().get("d", {})
                            if not d_retry.get("Error", False):
                                msg_ok = d_retry.get("Mensaje") or f"Turno T{turno_clean} creado y asignado en SAP HO"
                                logger.info(f"CargaHSSet + CargaHASet completado en {pid} T{turno_clean}: {msg_ok}")
                                return {
                                    "status": "ok",
                                    "mensaje": f"{msg_ok} (Turno T{turno_clean} abierto en mes actual)",
                                    "error": False,
                                    "id_proyecto": pid,
                                    "id_empleado": id_empleado,
                                    "turno": turno_clean
                                }

                    # 2. Si el proyecto ya tiene el 100% de Horas Contrato repartidas en los turnos activos del mes actual
                    # (ej. T01..T06), localizar el turno activo abierto del mes en curso y asignar ahí con Sobreasignación (SO)
                    cuad_actual = self.get_project_cuadrante(pid) or {}
                    turnos_activos = [
                        t for t in (cuad_actual.get("turnos") or [])
                        if not t.get("historico_cerrado")
                    ]
                    if turnos_activos:
                        emp_id_8 = str(id_empleado).zfill(8)
                        # Preferir un turno activo donde coincida el tramo horario o donde el empleado aún no esté asignado
                        h_req_ini = str(hora_inicio or "08:00").strip()[:2]
                        candidatos = sorted(
                            turnos_activos,
                            key=lambda t: (
                                0 if str(t.get("hora_inicio") or "")[:2] == h_req_ini else 1,
                                0 if not any(str(e.get("id_empleado") or "").zfill(8) == emp_id_8 for e in (t.get("empleados") or [])) else 1,
                                -(t.get("dias_servicio_mes") or 0),
                                t.get("codigo_turno") or "99"
                            )
                        )
                        for cand in candidatos:
                            cod_alt = str(cand.get("codigo_turno") or "01").zfill(2)
                            payload_alt = _build_payload(cod_alt, exceso_override="SO", dias_override={1, 2, 3, 4, 5, 6, 7})
                            res_alt = self.session.post(url, json=payload_alt, headers=headers, timeout=15)
                            if res_alt.status_code in [200, 201]:
                                d_alt = res_alt.json().get("d", {})
                                if not d_alt.get("Error", False):
                                    msg_alt = d_alt.get("Mensaje") or "Asignación modificada."
                                    nota_redireccion = (
                                        f"{msg_alt} (Grabado en Turno T{cod_alt} activo del mes actual; "
                                        f"el Turno T{turno_clean} correspondía a meses anteriores ya cerrados en SAP HO)."
                                    ) if cod_alt != turno_clean else msg_alt
                                    logger.info(f"CargaHASet redirigido de T{turno_clean} a T{cod_alt} activo en {pid}: {nota_redireccion}")
                                    return {
                                        "status": "ok",
                                        "mensaje": nota_redireccion,
                                        "error": False,
                                        "id_proyecto": pid,
                                        "id_empleado": id_empleado,
                                        "turno": cod_alt
                                    }

                logger.info(f"CargaHASet ({'BORRAR' if borrar else 'ASIGNAR'}) para {id_empleado} en {pid} T{turno_clean}: {msg}")
                return {
                    "status": "ok" if not is_error else "error",
                    "mensaje": msg,
                    "error": is_error,
                    "id_proyecto": pid,
                    "id_empleado": id_empleado,
                    "turno": turno_clean
                }
            else:
                logger.error(f"Error en CargaHASet: HTTP {res.status_code} - {res.text[:250]}")
                return {"status": "error", "mensaje": f"Error SAP HTTP {res.status_code}"}
        except Exception as e:
            logger.error(f"Fallo de conexión en CargaHASet: {e}")
            return {"status": "error", "mensaje": str(e)}

    def buscar_empleado_id(self, nombre_o_fragmento, id_proyecto=None):
        """Resuelve el IdEmpleado de SAP oficial a partir de un nombre o fragmento con máxima precisión."""
        if not nombre_o_fragmento:
            return None

        term_clean = str(nombre_o_fragmento).strip().upper()
        words = [w for w in term_clean.split() if len(w) >= 3]

        # 1. Consultar primero en la caché oficial de empleados de Girona (ho_employees_cache.json)
        try:
            cache_path = os.path.join(os.path.dirname(__file__), "ho_employees_cache.json")
            if os.path.exists(cache_path):
                with open(cache_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    by_name = cdata.get("by_name", {})
                    # Coincidencia directa por clave
                    if term_clean in by_name:
                        emp = by_name[term_clean]
                        return {
                            "IdEmpleado": emp.get("id_empleado"),
                            "Nombre": emp.get("nombre_completo"),
                            "DNI": emp.get("dni")
                        }
                    # Coincidencia con todas las palabras clave
                    for nom_c, emp in by_name.items():
                        nom_up = nom_c.upper()
                        if term_clean in nom_up or (words and all(w in nom_up for w in words)):
                            return {
                                "IdEmpleado": emp.get("id_empleado"),
                                "Nombre": emp.get("nombre_completo"),
                                "DNI": emp.get("dni")
                            }
        except Exception as e:
            logger.warning(f"Error consultando caché local de empleados: {e}")

        # 2. Si viene el proyecto, buscar en el cuadrante del proyecto (HAGridSet)
        if id_proyecto:
            resolved_pid = resolve_sap_project_id(id_proyecto)
            try:
                cuad = self.get_project_cuadrante(resolved_pid)
                if cuad and cuad.get("filas_cuadrante"):
                    for f in cuad["filas_cuadrante"]:
                        f_nom = (f.get("nombre") or "").upper()
                        if term_clean in f_nom or (words and all(w in f_nom for w in words)):
                            return {
                                "IdEmpleado": f.get("id_empleado"),
                                "Nombre": f.get("nombre"),
                                "DNI": ""
                            }
            except Exception as e:
                logger.warning(f"Error consultando cuadrante del proyecto {resolved_pid}: {e}")

        if not self.is_connected and not self.connect():
            return None

        # 3. Búsqueda directa en SAP S/4HANA (EmpleadoSet)
        # Intentar con cada palabra significativa (priorizando apellidos y nombres de Barcelona)
        for w in words:
            # Probar en Apellido1
            res = self.query_entity_set("EmpleadoSet", filter_query=f"substringof('{w}',Apellido1)", top=20)
            if not res:
                res = self.query_entity_set("EmpleadoSet", filter_query=f"substringof('{w}',Nombre)", top=20)

            if res:
                # Priorizar delegación Barcelona (S081, S082, S083, B081, etc.)
                bcn_cands = [
                    r for r in res
                    if str(r.get("IdCentro") or "").startswith(("S08", "B08"))
                    or "BARCELONA" in (r.get("NomCentro") or "").upper()
                ]
                pool = bcn_cands if bcn_cands else res

                # Buscar candidato que contenga la mayor cantidad de palabras
                for cand in pool:
                    nc = (cand.get("NombreCompleto") or f"{cand.get('Nombre', '')} {cand.get('Apellido1', '')} {cand.get('Apellido2', '')}").upper()
                    if words and all(x in nc for x in words):
                        return {
                            "IdEmpleado": cand.get("IdEmpleado"),
                            "Nombre": cand.get("NombreCompleto") or cand.get("Nombre"),
                            "DNI": cand.get("DNI")
                        }

                if bcn_cands:
                    best = bcn_cands[0]
                    return {
                        "IdEmpleado": best.get("IdEmpleado"),
                        "Nombre": best.get("NombreCompleto") or best.get("Nombre"),
                        "DNI": best.get("DNI")
                    }

        return None

if __name__ == "__main__":
    ho = HOService()
    print("Probando conexion con HO...")
    if ho.connect():
        print("[OK] Conexion establecida con SAP HO.")
        proy = ho.get_project("SVO04295-P1-C018")
        if proy:
            print(f"[OK] Proyecto de prueba: {proy.get('IdProyecto')} - {proy.get('Denominacion')}")
        bajas = ho.get_employee_bajas(top=5)
        print(f"[OK] Bajas registradas recuperadas: {len(bajas)}")
    else:
        print("[AVISO] No se pudo conectar. Verifica que Ivanti VPN esté activa.")
