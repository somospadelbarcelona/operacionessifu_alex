# -*- coding: utf-8 -*-
"""
SUPERVISOR VIRTUAL AUTONOMO - SIFU GIRONA
Motor principal de inteligencia operativa.
Cruza Dashboard SIFU GIRONA + Excel Maestro + SAP ERP HO.
Genera alertas, diagnosticos, propuestas de suplencias y actualiza supervisor_data.js.
"""

import os
import sys
import json
import re
from datetime import datetime, timedelta
import logging

from ho_service import HOService

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SupervisorVirtual")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DATA_FILE = os.path.join(BASE_DIR, "master_data.js")
SUPERVISOR_DATA_FILE = os.path.join(BASE_DIR, "supervisor_data.js")

class SupervisorVirtual:
    def __init__(self, autonomy_level=2):
        self.autonomy_level = autonomy_level  # 1: Asesor, 2: Supervisado, 3: Autónomo
        self.ho = HOService()
        self.master_services = []
        self.descubiertos = []
        self.ho_connected = False
        self.snapshot = {}

    def load_master_data(self):
        """Carga los datos del Excel Maestro extraídos en master_data.js."""
        if not os.path.exists(MASTER_DATA_FILE):
            logger.error(f"No existe {MASTER_DATA_FILE}")
            return False

        try:
            with open(MASTER_DATA_FILE, "r", encoding="utf-8") as f:
                content = f.read()

            # Extraer INITIAL_MASTER_DATA
            m_master = re.search(r'window\.INITIAL_MASTER_DATA\s*=\s*(\[.*?\]);', content, re.DOTALL)
            if m_master:
                self.master_services = json.loads(m_master.group(1))

            # Extraer INITIAL_DESCUBIERTOS_DATA
            m_desc = re.search(r'window\.INITIAL_DESCUBIERTOS_DATA\s*=\s*(\[.*?\]);', content, re.DOTALL)
            if m_desc:
                self.descubiertos = json.loads(m_desc.group(1))

            logger.info(f"Cargados {len(self.master_services)} servicios y {len(self.descubiertos)} descubiertos del Excel Maestro.")
            return True
        except Exception as e:
            logger.error(f"Error cargando master_data.js: {e}")
            return False

    def analyze_operations(self):
        """Analiza la operativa completa y genera diagnósticos y propuestas de acción."""
        self.ho_connected = self.ho.connect()

        # 1. Analisis de Descubiertos
        alertas_descubiertos = []
        for s in self.master_services:
            estado = str(s.get("ESTADO", "")).strip().upper()
            titular = str(s.get("TITULAR", "")).strip().upper()
            suplente = str(s.get("SUPL", "")).strip().upper()
            proyecto = str(s.get("PROYECTO", "")).strip()
            cliente = s.get("SERVICIO", "")

            es_descubierto = "DESCUBIERTO" in estado or "FALTA TITULAR" in titular or not titular
            if es_descubierto and not suplente:
                alertas_descubiertos.append({
                    "id": f"DESC_{proyecto}_{len(alertas_descubiertos)}",
                    "proyecto": proyecto,
                    "servicio": cliente,
                    "direccion": s.get("S DIRECCION", ""),
                    "horario": s.get("HORARIO", ""),
                    "motivo": "Sin titular ni suplente asignado",
                    "criticidad": "ALTA",
                    "accion_propuesta": f"Asignar suplente prioritario para {cliente} ({proyecto})",
                    "estado_ho": "Pendiente de regularizar en HO"
                })

        # 2. Analisis de Bajas IT
        alertas_bajas = []
        for s in self.master_services:
            estado = str(s.get("ESTADO", "")).strip().upper()
            estado1 = str(s.get("ESTADO1", "")).strip().upper()
            suplente = str(s.get("SUPL", "")).strip()
            titular = s.get("TITULAR", "")
            proyecto = s.get("PROYECTO", "")
            cliente = s.get("SERVICIO", "")

            if "BAJA IT" in estado or "BAJA IT" in estado1:
                sin_cobertura = not suplente or suplente.upper() in ["", "NO", "PENDIENTE"]
                criticidad = "CRITICA" if sin_cobertura else "MEDIA"
                alertas_bajas.append({
                    "id": f"BAJA_{proyecto}_{len(alertas_bajas)}",
                    "proyecto": proyecto,
                    "servicio": cliente,
                    "titular": titular,
                    "suplente": suplente if suplente else "SIN COBERTURA",
                    "cubierto": not sin_cobertura,
                    "criticidad": criticidad,
                    "accion_propuesta": f"Asignar cobertura urgente a la baja de {titular}" if sin_cobertura else f"Verificada suplencia ({suplente})"
                })

        # 3. Analisis de Vacaciones
        alertas_vacaciones = []
        for s in self.master_services:
            vac = str(s.get("VACACIONES 2026", "")).strip() or str(s.get("VAC 26", "")).strip()
            titular = s.get("TITULAR", "")
            suplente = str(s.get("SUPL", "")).strip()
            proyecto = s.get("PROYECTO", "")
            cliente = s.get("SERVICIO", "")

            if vac and vac.upper() not in ["", "NO", "0"]:
                alertas_vacaciones.append({
                    "id": f"VAC_{proyecto}_{len(alertas_vacaciones)}",
                    "proyecto": proyecto,
                    "servicio": cliente,
                    "titular": titular,
                    "periodo": vac,
                    "suplente": suplente if suplente else "Sin plan de sustitución",
                    "criticidad": "MEDIA" if not suplente else "BAJA",
                    "accion_propuesta": f"Planificar cobertura de vacaciones para {titular} ({vac})"
                })

        # 4. Analisis de Fin de Contratos
        alertas_contratos = []
        for s in self.master_services:
            fin = str(s.get("FIN CONTRATO", "")).strip()
            titular = s.get("TITULAR", "")
            proyecto = s.get("PROYECTO", "")
            cliente = s.get("SERVICIO", "")

            if fin and fin.lower() not in ["indefinido", "fijo", ""]:
                alertas_contratos.append({
                    "id": f"CONT_{proyecto}_{len(alertas_contratos)}",
                    "proyecto": proyecto,
                    "servicio": cliente,
                    "titular": titular,
                    "observacion_vencimiento": fin,
                    "criticidad": "ALTA" if "dia" in fin.lower() or "faltan" in fin.lower() else "MEDIA",
                    "accion_propuesta": f"Revisar prórroga o renovación contractual de {titular}"
                })

        # 5. Generar Acciones Propuestas según Nivel de Autonomía
        acciones_cola = []
        for b in alertas_bajas:
            if not b["cubierto"]:
                acciones_cola.append({
                    "tipo": "COBERTURA_BAJA",
                    "proyecto": b["proyecto"],
                    "descripcion": f"Crear solicitud de cobertura y registrar bitácora en HO para {b['titular']}",
                    "nivel_requerido": 2,
                    "estado": "Pendiente de Aprobación" if self.autonomy_level <= 2 else "Ejecutado Automático"
                })

        for d in alertas_descubiertos:
            acciones_cola.append({
                "tipo": "DESCUBIERTO_HO",
                "proyecto": d["proyecto"],
                "descripcion": f"Regularizar asignación operativa de {d['servicio']} en HO",
                "nivel_requerido": 2,
                "estado": "Pendiente de Aprobación" if self.autonomy_level <= 2 else "Ejecutado Automático"
            })

        ho_proyectos = self.ho.get_girona_projects() if self.ho_connected else []

        cuadrantes_ho = {}
        cuad_cache_file = os.path.join(BASE_DIR, "ho_cuadrantes_cache.json")
        if os.path.exists(cuad_cache_file):
            try:
                with open(cuad_cache_file, "r", encoding="utf-8") as cf:
                    cuadrantes_ho = json.load(cf).get("projects", {})
            except Exception as e:
                logger.warning(f"No se pudo leer ho_cuadrantes_cache.json: {e}")

        self.snapshot = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "autonomy_level": self.autonomy_level,
            "ho_status": {
                "connected": self.ho_connected,
                "server": "http://qgssrvs4pro.gruposifu.com:8000",
                "service": "ZPS_HOPER_SRV",
                "user": self.ho.username,
                "responsable": "COSCOLIN PEREGRIN, ALEJAN",
                "responsable_id": "46468278",
                "oficina": "1701 - Girona",
                "proyectos_ho_asignados": len(ho_proyectos),
                "csrf_ready": bool(self.ho.csrf_token)
            },
            "kpis": {
                "total_servicios": len(self.master_services),
                "proyectos_ho_responsable": len(ho_proyectos),
                "total_descubiertos": len(alertas_descubiertos),
                "total_bajas": len(alertas_bajas),
                "bajas_sin_cubrir": len([b for b in alertas_bajas if not b["cubierto"]]),
                "total_vacaciones_activas": len(alertas_vacaciones),
                "contratos_vencimiento": len(alertas_contratos)
            },
            "alertas_descubiertos": alertas_descubiertos,
            "alertas_bajas": alertas_bajas,
            "alertas_vacaciones": alertas_vacaciones,
            "alertas_contratos": alertas_contratos,
            "acciones_cola": acciones_cola,
            "cuadrantes_ho": cuadrantes_ho
        }

        self.save_supervisor_data()
        return self.snapshot

    def save_supervisor_data(self):
        """Guarda los resultados del análisis en supervisor_data.js para consumo del Dashboard."""
        js_content = f"""// GENERADO AUTOMATICAMENTE POR EL SUPERVISOR VIRTUAL SIFU GIRONA
// Fecha: {self.snapshot.get('timestamp')}
window.SUPERVISOR_SNAPSHOT = {json.dumps(self.snapshot, indent=2, ensure_ascii=False)};
"""
        with open(SUPERVISOR_DATA_FILE, "w", encoding="utf-8") as f:
            f.write(js_content)
        logger.info(f"Actualizado {SUPERVISOR_DATA_FILE} con el diagnóstico del Supervisor Virtual.")

    def run_autonomy_actions(self):
        """Ejecuta acciones de Nivel 3 o aprobadas en Nivel 2 sobre HO."""
        if not self.ho_connected and not self.ho.connect():
            logger.warning("No se pueden ejecutar acciones sobre HO: no hay conexion.")
            return False

        logger.info(f"Evaluando ejecucion de acciones (Nivel actual: {self.autonomy_level})...")
        ejecutadas = 0
        for accion in self.snapshot.get("acciones_cola", []):
            if self.autonomy_level >= accion["nivel_requerido"] and accion["estado"] != "Completado":
                logger.info(f"Ejecutando accion sobre HO: {accion['descripcion']}")
                # Ejemplo: registro de bitacora de auditoria en HO
                success = self.ho.add_bitacora_entry(
                    project_id=accion["proyecto"],
                    text=f"[SUPERVISOR VIRTUAL] {accion['descripcion']}",
                    user=self.ho.username
                )
                if success:
                    accion["estado"] = "Completado en HO"
                    ejecutadas += 1

        if ejecutadas > 0:
            self.save_supervisor_data()
        logger.info(f"Total acciones ejecutadas en HO: {ejecutadas}")
        return ejecutadas

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    autonomy = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    supervisor = SupervisorVirtual(autonomy_level=autonomy)
    if supervisor.load_master_data():
        snap = supervisor.analyze_operations()
        kpis = snap["kpis"]
        print("="*60)
        print("[SUPERVISOR VIRTUAL SIFU GIRONA - RESUMEN EJECUTIVO]")
        print("="*60)
        status_txt = "ONLINE (SAP OData Conectado)" if snap['ho_status']['connected'] else "OFFLINE"
        print(f"Estado Conexion HO: {status_txt}")
        print(f"Nivel de Autonomia: Nivel {snap['autonomy_level']}")
        print(f"Servicios Analizados: {kpis['total_servicios']}")
        print(f"Descubiertos Prioritarios: {kpis['total_descubiertos']}")
        print(f"Bajas IT Registradas: {kpis['total_bajas']} (Sin suplente: {kpis['bajas_sin_cubrir']})")
        print(f"Vacaciones Programadas: {kpis['total_vacaciones_activas']}")
        print(f"Contratos con Vencimiento Proximo: {kpis['contratos_vencimiento']}")
        print(f"Acciones en Cola: {len(snap['acciones_cola'])}")
        print("="*60)
