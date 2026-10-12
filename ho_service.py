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
