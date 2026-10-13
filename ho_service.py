# -*- coding: utf-8 -*-
"""
HO SERVICE - Conector Oficial SAP S/4HANA (ZPS_HOPER_SRV)
Permite interactuar con el ERP corporativo HO mediante OData REST v2,
con soporte de autenticacion HTTP Basic, sesiones con cookies y tokens CSRF para escrituras.
"""

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
OFICINA_GIRONA = "1701"
HO_PROJECTS_URL = f"{HO_BASE_URL}/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#/Projects"
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
    return SAP_PROJECT_ID_MAP.get(clean_id, str(proy_id).strip())

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
        """Descarga el cuadrante real completo (HAGridSet + NAVHAGHAR/NAVHARHAC + EmpleadoProyectoSet) de un proyecto en SAP HO."""
        if not self.is_connected and not self.connect():
            return None
        pid = resolve_sap_project_id(project_id)
        fechas_a_consultar = [fecha_consulta] if fecha_consulta else list(dict.fromkeys([
            datetime.now().strftime("%Y-%m-01T00:00:00"),
            "2026-04-01T00:00:00"
        ]))

        headers = {"Accept": "application/json"}
        filas_map = {}  # (turno_id, emp_id, nom) -> emp_entry
        turnos_dict = {}

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
                            turno_id = str(row.get("Turno") or "01").strip()
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
            # Recalcular rol consolidado si se fusionaron meses
            if emp_entry["en_baja"]:
                emp_entry["rol"] = "BAJA IT"
            elif "SB" in emp_entry["tipos_imputacion"] or "SB" in emp_entry["tipos_asignacion"]:
                emp_entry["rol"] = "SUPLENTE BAJA (SB)"
            elif "BR" in emp_entry["tipos_imputacion"]:
                emp_entry["rol"] = "BRIGADA / APOYO (BR)"
            elif "TI" in emp_entry["tipos_imputacion"]:
                emp_entry["rol"] = "TITULAR (TI)"

            t_id = emp_entry["turno"]
            if t_id not in turnos_dict:
                turnos_dict[t_id] = {
                    "id_turno": t_id,
                    "horarios": [],
                    "empleados": []
                }
            turnos_dict[t_id]["empleados"].append(emp_entry)
            for hp in emp_entry["horarios"]:
                if hp not in turnos_dict[t_id]["horarios"]:
                    turnos_dict[t_id]["horarios"].append(hp)

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
            "turnos": list(turnos_dict.values()),
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
                logger.info(f"CargaHESet ejecutado para {id_empleado}: {msg}")
                return {
                    "status": "ok" if not is_error else "error",
                    "mensaje": msg,
                    "error": is_error,
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

    def buscar_empleado_id(self, nombre_o_fragmento, id_proyecto=None):
        """Resuelve el IdEmpleado de SAP oficial a partir de un nombre o fragmento."""
        if not self.is_connected and not self.connect():
            return None

        # Si viene el proyecto, buscar primero en EmpleadoProyectoSet de ese proyecto
        if id_proyecto:
            id_proyecto = resolve_sap_project_id(id_proyecto)
            res = self.query_entity_set("EmpleadoProyectoSet", filter_query=f"IdProyecto eq '{id_proyecto}'")
            if res:
                term = nombre_o_fragmento.lower()
                for r in res:
                    nom = (r.get("Nombre") or "").lower()
                    if term in nom or any(t in nom for t in term.split() if len(t) >= 4):
                        return {
                            "IdEmpleado": r.get("IdEmpleado"),
                            "Nombre": r.get("Nombre"),
                            "DNI": r.get("DNI")
                        }

        # Búsqueda general en EmpleadoSet
        terminos = [t for t in nombre_o_fragmento.split() if len(t) >= 3]
        for t in terminos:
            res = self.query_entity_set("EmpleadoSet", filter_query=f"substringof('{t.upper()}',Nombre)", top=20)
            if res:
                return {
                    "IdEmpleado": res[0].get("IdEmpleado"),
                    "Nombre": res[0].get("Nombre"),
                    "DNI": res[0].get("DNI")
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
