# -*- coding: utf-8 -*-
"""
SUPERVISOR COMMANDER - Motor de Inteligencia Operativa y Lenguaje Natural
Interpreta cualquier orden o pregunta en lenguaje natural sobre:
- Titulares, suplentes y cuadrantes
- Bajas IT y coberturas
- Descubiertos y vacantes
- Vacaciones y contratos
- Órdenes directas sobre SAP HO (apertura de fichas, registro de bitácoras y asignaciones)
"""

import os
import sys
import json
import time
import re
import urllib.parse
from datetime import datetime
import logging

from ho_service import HOService, RESPONSABLE_ID, RESPONSABLE_NAME, SAP_PROJECT_ID_MAP, resolve_sap_project_id
from supervisor_engine import SupervisorVirtual

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("Commander")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "supervisor_log_live.json")
CONFIG_FILE = os.path.join(BASE_DIR, "supervisor_config.json")
HO_BASE_URL = "http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES"

def build_ho_project_url(proy_id):
    if not proy_id:
        return f"{HO_BASE_URL}#/Projects"
    resolved_id = resolve_sap_project_id(proy_id)
    param = urllib.parse.quote(json.dumps({"value": str(resolved_id).strip(), "type": "Edm.String"}, separators=(',', ':')))
    return f"{HO_BASE_URL}#/projectDetail/{param}"

STOP_WORDS = {
    'en', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'hay', 'que', 'quien',
    'esta', 'estan', 'titular', 'titulares', 'baja', 'bajas', 'it', 'vacaciones',
    'horario', 'horarios', 'buscar', 'dime', 'ver', 'para', 'servicios', 'servicio',
    'por', 'favor', 'como', 'cuantos', 'cual', 'cuales', 'sobre', 'todo', 'todos',
    'poner', 'dar', 'tramitar', 'asignar', 'quitar', 'borrar', 'crear', 'nuevo',
    'nueva', 'meter', 'sacar', 'eliminar', 'cese', 'absentismo', 'permiso', 'licencia'
}

def registrar_evento(tipo, mensaje, detalle=None):
    """Guarda un evento en el registro en vivo que lee el Dashboard."""
    evento = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "tipo": tipo,  # INFO, ACCION, EXITO, ALERTA, ERROR
        "mensaje": mensaje,
        "detalle": detalle or ""
    }
    eventos = []
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                eventos = json.load(f)
        except Exception:
            eventos = []

    eventos.insert(0, evento)
    eventos = eventos[:50]

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(eventos, f, indent=2, ensure_ascii=False)

    js_path = os.path.join(BASE_DIR, "supervisor_log_live.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(f"window.SUPERVISOR_LIVE_LOG = {json.dumps(eventos, indent=2, ensure_ascii=False)};\n")

class SupervisorCommander:
    def __init__(self):
        self.ho = HOService()
        self.supervisor = SupervisorVirtual(autonomy_level=3)
        self.supervisor.load_master_data()

    def _extraer_entidades(self, texto):
        """Extrae las palabras clave que identifican clientes o servicios."""
        tokens = re.findall(r'[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+', texto.lower())
        entidades = [t for t in tokens if t not in STOP_WORDS and len(t) >= 3]
        return entidades

    def _buscar_en_servicios(self, entidades):
        """Busca servicios en el Excel Maestro coincidentes con las entidades."""
        if not entidades:
            return self.supervisor.master_services
        coincidencias = []
        for s in self.supervisor.master_services:
            txt = f"{s.get('TIPO S', '')} {s.get('SERVICIO', '')} {s.get('TITULAR', '')} {s.get('PROYECTO', '')} {s.get('S DIRECCION', '')}".lower()
            if any(e in txt for e in entidades):
                coincidencias.append(s)
        return coincidencias

    def _buscar_en_sap_ho(self, entidades):
        """Busca proyectos en SAP HO coincidentes para Barcelona (División 0801)."""
        cache_carteras = os.path.join(BASE_DIR, "ho_carteras_cache.json")
        if os.path.exists(cache_carteras):
            try:
                with open(cache_carteras, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    proys = cdata.get("proyectos", [])
                    if not entidades:
                        return proys
                    coincidencias = []
                    for p in proys:
                        txt = f"{p.get('id_proyecto', '')} {p.get('denominacion', '')} {p.get('cliente', '')} {p.get('gestor_nombre', '')}".lower()
                        if any(e in txt for e in entidades):
                            coincidencias.append({
                                "IdProyecto": p.get("id_proyecto"),
                                "Denominacion": p.get("denominacion"),
                                "Cliente": p.get("cliente")
                            })
                    if coincidencias:
                        return coincidencias
            except Exception as e:
                logger.warning(f"Error buscando proyectos en cache BCN: {e}")

        self.ho.connect()
        try:
            proyectos = self.ho.get_bcn_projects()
        except Exception:
            proyectos = self.ho.get_girona_projects()
        if not entidades:
            return proyectos
        coincidencias = []
        for p in proyectos:
            txt = f"{p.get('IdProyecto', '')} {p.get('Denominacion', '')} {p.get('Cliente', '')}".lower()
            if any(e in txt for e in entidades):
                coincidencias.append(p)
        return coincidencias

    def _obtener_datos_barcelona(self):
        """Obtiene la plantilla completa (685 trabs), los 9 gestores y los proyectos de Barcelona (División 0801)."""
        INVALIDOS = {
            "NONE", "FALTA TITULAR", "DESCUBIERTO", "PUNTUA", "NULL", "NO", "PENDIENTE",
            "SIN PLAN", "BAJA EMPRESA", "BAJA IT", "VACACIONES", "OPERARIO TITULAR",
            "OPERARIO", "SIN TITULAR", "PENDIENTE-CUADRANTE", "SIN CLIENTE EN CUADRANTE"
        }

        trabajadores_map = {}
        trabajador_proyectos = {}
        proyectos_map = {}
        gestores_lista = []

        # 1. Cargar desde ho_carteras_cache.json (fuente principal oficial de Barcelona)
        cache_path = os.path.join(BASE_DIR, "ho_carteras_cache.json")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    gestores_lista = cdata.get("gestores", [])
                    g_names = {g["id"]: g.get("nombre_corto", g.get("nombre")) for g in gestores_lista}

                    for w in cdata.get("trabajadores", []):
                        nom = " ".join(str(w.get("nombre") or w.get("nombre_completo") or "").strip().split()).upper()
                        if not nom or nom in INVALIDOS or nom.startswith("VUELVE") or len(nom) <= 2:
                            continue
                        
                        gid = w.get("gestor_id") or w.get("id_responsable") or ""
                        proys = w.get("proyectos_asignados", [])
                        pid = (proys[0].get("id_proyecto") or proys[0]) if proys else (w.get("proyecto") or "")
                        pnom = proys[0].get("denominacion", "") if (proys and isinstance(proys[0], dict)) else ""

                        item = {
                            "id": w.get("id") or w.get("id_empleado") or "",
                            "nombre": nom,
                            "dni": w.get("dni", ""),
                            "telefono": w.get("telefono", ""),
                            "email": w.get("email", ""),
                            "gestor_id": gid,
                            "gestor_nombre": w.get("responsable_rrhh") or w.get("nom_responsable") or g_names.get(gid, "Gestor BCN"),
                            "gestor_corto": w.get("responsable_corto") or g_names.get(gid, "Gestor"),
                            "proyecto_id": pid,
                            "proyecto_nombre": pnom,
                            "vac_restantes": w.get("vac_restantes", 25),
                            "tipo_contrato": w.get("tipo_contrato", "Indefinido"),
                            "estado": "BAJA IT" if (w.get("en_baja_it_actual") or w.get("en_baja_hoy")) else "ACTIVO"
                        }
                        trabajadores_map[nom] = item
                        if pid and nom not in trabajador_proyectos:
                            trabajador_proyectos[nom] = pid

                    for p in cdata.get("proyectos", []):
                        pid = str(p.get("id_proyecto") or p.get("id") or "").strip()
                        if pid:
                            denom = p.get("denominacion") or p.get("cliente") or pid
                            gid = p.get("gestor_id") or ""
                            if pid not in proyectos_map:
                                proyectos_map[pid] = {
                                    "id": pid,
                                    "nombre": f"{pid} - {denom}",
                                    "denominacion": denom,
                                    "cliente": p.get("cliente") or denom,
                                    "gestor_id": gid,
                                    "gestor": g_names.get(gid, p.get("gestor_nombre", "Barcelona"))
                                }

                    for s in cdata.get("servicios_operativos", []):
                        pid = s.get("proyecto", "").strip()
                        cli = s.get("cliente") or s.get("nombreServicio") or pid
                        if pid and pid not in proyectos_map:
                            proyectos_map[pid] = {
                                "id": pid,
                                "nombre": f"{pid} - {cli}",
                                "denominacion": cli,
                                "cliente": cli,
                                "gestor_id": s.get("gestor_id", ""),
                                "gestor": s.get("gestor", "Barcelona")
                            }
                        for r_nom in [s.get("titular"), s.get("suplente")]:
                            if not r_nom:
                                continue
                            nom = " ".join(str(r_nom).strip().split()).upper()
                            if nom and nom not in INVALIDOS and not nom.startswith("VUELVE") and len(nom) > 2:
                                if pid and nom not in trabajador_proyectos:
                                    trabajador_proyectos[nom] = pid
                                if nom in trabajadores_map and not trabajadores_map[nom]["proyecto_id"] and pid:
                                    trabajadores_map[nom]["proyecto_id"] = pid
                                    trabajadores_map[nom]["proyecto_nombre"] = cli
            except Exception as e:
                logger.warning(f"Error leyendo ho_carteras_cache.json en Commander: {e}")

        # 2. Complementar con ho_employees_cache.json
        emp_cache = os.path.join(BASE_DIR, "ho_employees_cache.json")
        if os.path.exists(emp_cache):
            try:
                with open(emp_cache, "r", encoding="utf-8") as f:
                    edata = json.load(f)
                    for nom_raw, emp in edata.get("by_name", {}).items():
                        nom = " ".join(str(nom_raw).strip().split()).upper()
                        if nom and nom not in INVALIDOS and not nom.startswith("VUELVE") and len(nom) > 2:
                            if nom not in trabajadores_map:
                                trabajadores_map[nom] = {
                                    "id": emp.get("id_empleado", ""),
                                    "nombre": nom,
                                    "dni": emp.get("dni", ""),
                                    "telefono": emp.get("telefono", ""),
                                    "email": emp.get("email", ""),
                                    "gestor_id": emp.get("id_responsable", ""),
                                    "gestor_nombre": emp.get("nom_responsable", "Gestor Barcelona"),
                                    "gestor_corto": emp.get("nom_responsable", "Gestor"),
                                    "proyecto_id": "",
                                    "proyecto_nombre": "",
                                    "vac_restantes": emp.get("vac_restantes", 25),
                                    "tipo_contrato": emp.get("tipo_contrato", "Indefinido"),
                                    "estado": "ACTIVO"
                                }
            except Exception as e:
                logger.warning(f"Error complementando ho_employees_cache.json: {e}")

        todos_trabajadores = sorted(list(trabajadores_map.keys()))
        trabajadores_detalle = [trabajadores_map[k] for k in todos_trabajadores]
        todos_proyectos = sorted(list(proyectos_map.values()), key=lambda x: x["nombre"])

        return {
            "todos_trabajadores": todos_trabajadores,
            "trabajadores_detalle": trabajadores_detalle,
            "trabajadores_map": trabajadores_map,
            "trabajador_proyectos": trabajador_proyectos,
            "todos_proyectos": todos_proyectos,
            "gestores": gestores_lista
        }

    def _obtener_todos_trabajadores_girona(self):
        """Devuelve la lista completa de trabajadores de Barcelona/Girona."""
        datos = self._obtener_datos_barcelona()
        return datos["todos_trabajadores"]

    def ejecutar_comando_in_situ(self, comando_texto):
        """Interpreta cualquier orden o pregunta en lenguaje natural."""
        cmd = comando_texto.strip()
        registrar_evento("INFO", f"Orden recibida: '{cmd}'")
        cmd_lower = cmd.lower()
        entidades = self._extraer_entidades(cmd)

        # -------------------------------------------------------------
        # ACCIONES OPERATIVAS INTELIGENTES (DISPARADORES DEL ASISTENTE)
        # -------------------------------------------------------------
        # 1. SUSTITUIR EMPLEADO (FOTO 2)
        if any(k in cmd_lower for k in ["sustituir", "suplencia para", "sustituto para", "sustituto de", "cambiar por", "remplazar", "reemplazar"]):
            return self.cmd_wizard_tramite('SUSTITUIR', entidades, cmd)

        # 2. REVERTIR BAJA / VACACIONES / ABSENTISMO / PERMISOS (FOTO 4 Y FOTO 3)
        elif any(k in cmd_lower for k in ["revertir", "anular baja", "quitar baja", "revertir baja", "anular vacacion", "revertir vacacion", "anular absentismo", "revertir absentismo", "anular permiso", "revertir permiso", "deshacer ausencia"]):
            return self.cmd_wizard_tramite('REVERTIR', entidades, cmd)

        # 3. ASIGNAR AUSENCIAS AL TRABAJADOR (FOTO 3)
        elif any(k in cmd_lower for k in ["asignar ausencia", "ausencia para", "ausencia de", "poner ausencia", "marcar ausencia", "tipo ausencia"]):
            return self.cmd_wizard_tramite('AUSENCIA', entidades, cmd)

        # A. TRÁMITE DE BAJA MÉDICA
        elif any(k in cmd_lower for k in ["tramitar baja", "poner baja", "dar de baja", "poner de baja", "meter baja", "baja de ", "baja para ", "esta de baja"]):
            return self.cmd_wizard_tramite('BAJA', entidades, cmd)

        # B. ASIGNACIÓN DE VACACIONES
        elif any(k in cmd_lower for k in ["asignar vacacion", "poner vacacion", "tramitar vacacion", "dar vacacion", "vacaciones para", "vacaciones de", "pedir vacacion", "marcar vacacion"]):
            return self.cmd_wizard_tramite('VACACIONES', entidades, cmd)

        # C. REGISTRO DE ABSENTISMO / PERMISOS
        elif any(k in cmd_lower for k in ["absentismo", "permiso", "licencia", "falta", "visita medica", "horas medica", "no vino", "ha faltado"]):
            return self.cmd_wizard_tramite('ABSENTISMO', entidades, cmd)

        # D. CREACIÓN / EDICIÓN DE CUADRANTE
        elif any(k in cmd_lower for k in ["nuevo cuadrante", "crear cuadrante", "poner cuadrante", "asignar cuadrante", "cambiar cuadrante", "nuevo horario", "poner horario", "cuadrante para", "cuadrante nuevo"]):
            return self.cmd_wizard_tramite('CUADRANTE', entidades, cmd)

        # E. CESE / BORRADO DE CUADRANTE
        elif any(k in cmd_lower for k in ["borrar cuadrante", "quitar cuadrante", "eliminar cuadrante", "quitar de cuadrante", "sacar de cuadrante", "cese de", "desasignar"]):
            return self.cmd_wizard_tramite('CESE', entidades, cmd)

        # F. ORDEN RÁPIDA: CUBRIR / ASIGNAR SUPLENTE
        elif "cubrir" in cmd_lower or "suplente para" in cmd_lower:
            return self.cmd_cubrir(cmd)

        # G. ORDEN: REGISTRAR NOTA EN BITÁCORA
        elif "bitacora" in cmd_lower or "nota" in cmd_lower or "incidencia" in cmd_lower:
            return self.cmd_bitacora(cmd)

        # H. ORDEN: ESCANEAR / SINCRONIZAR TODO
        elif "escanear" in cmd_lower or "sincronizar" in cmd_lower or "analizar" in cmd_lower:
            return self.cmd_escanear()

        # I. CONSULTA: TITULAR / PERSONAL / QUIÉN ESTÁ
        elif "titular" in cmd_lower or "quien esta" in cmd_lower or "trabajador" in cmd_lower or "empleado" in cmd_lower or "personal" in cmd_lower:
            return self.cmd_consultar_titular(entidades, cmd)

        # J. CONSULTA: BAJAS IT ACTIVAS
        elif "baja" in cmd_lower or re.search(r'\bit\b', cmd_lower) or "enfermo" in cmd_lower or "medica" in cmd_lower:
            return self.cmd_consultar_bajas(entidades, cmd)

        # K. CONSULTA: DESCUBIERTOS / SIN CUBRIR
        elif "descubierto" in cmd_lower or "sin cubrir" in cmd_lower or "hueco" in cmd_lower or "vacante" in cmd_lower:
            return self.cmd_consultar_descubiertos(entidades)

        # L. CONSULTA: VACACIONES ACTIVAS
        elif "vacacion" in cmd_lower or "vaca" in cmd_lower:
            return self.cmd_consultar_vacaciones(entidades)

        # M. CONSULTA: HORARIOS
        elif "horario" in cmd_lower or "turno" in cmd_lower or "hora" in cmd_lower:
            return self.cmd_consultar_horarios(entidades, cmd)

        # N. BÚSQUEDA GENERAL INTELIGENTE
        else:
            return self.cmd_consulta_general(entidades, cmd)

    def cmd_consultar_titular(self, entidades, cmd_original):
        """Responde quién es el titular de un servicio o cliente."""
        servicios = self._buscar_en_servicios(entidades)
        if not servicios:
            # Buscar en SAP HO
            ho_proys = self._buscar_en_sap_ho(entidades)
            if ho_proys:
                p = ho_proys[0]
                proy_id = p.get("IdProyecto")
                resumen = f"En SAP HO para '{' '.join(entidades)}' se localiza el proyecto {proy_id} ({p.get('Denominacion')})."
                return {
                    "status": "ok",
                    "tipo": "TITULAR",
                    "titulo": f"👤 Proyecto {proy_id} en SAP HO",
                    "resumen": resumen,
                    "proyecto": proy_id,
                    "direct_ho_url": build_ho_project_url(proy_id),
                    "resultados": [{"id": proy_id, "denominacion": p.get("Denominacion"), "oficina": "1701", "centro": p.get("CentroBeneficio")}],
                    "total": 1
                }
            msg = f"No se encontró información de titulares para '{' '.join(entidades)}'."
            registrar_evento("ALERTA", msg)
            return {"status": "ok", "tipo": "TITULAR", "titulo": "Sin coincidencias", "resumen": msg, "resultados": [], "total": 0}

        proy_id = servicios[0].get("PROYECTO") if servicios else ""
        lineas = []
        resultados_cards = []

        for s in servicios:
            titular = s.get("TITULAR") or "Falta Titular"
            estado = s.get("ESTADO") or "Activo"
            suplente = s.get("SUPL") or ""
            horario = s.get("HORARIO") or "Sin horario especificado"
            cliente = s.get("SERVICIO") or s.get("TIPO S")
            pid = s.get("PROYECTO")

            detalle_supl = f" (Suplente: {suplente})" if suplente else ""
            lineas.append(f"• {titular} — Estado: {estado}{detalle_supl} | Turno: {horario}")
            resultados_cards.append({
                "id": pid,
                "denominacion": f"{cliente} — Titular: {titular}",
                "oficina": "1701",
                "centro": f"Estado: {estado}{detalle_supl}"
            })

        nombre_cliente = servicios[0].get("SERVICIO") or servicios[0].get("TIPO S") or " ".join(entidades).upper()
        resumen = f"En {nombre_cliente} ({proy_id}) se encuentran asignados los siguientes titulares:\n" + "\n".join(lineas)

        registrar_evento("EXITO", f"Titulares consultados para {nombre_cliente}: {len(servicios)} registros.")
        return {
            "status": "ok",
            "tipo": "TITULAR",
            "titulo": f"👤 Titulares en {nombre_cliente} ({proy_id})",
            "resumen": resumen,
            "proyecto": proy_id,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": resultados_cards,
            "total": len(resultados_cards)
        }

    def cmd_consultar_bajas(self, entidades, cmd_original):
        """Consulta bajas médicas en un servicio específico o en toda la división."""
        if entidades:
            servicios = self._buscar_en_servicios(entidades)
            bajas = [s for s in servicios if "BAJA" in str(s.get("ESTADO", "")).upper() or "BAJA" in str(s.get("ESTADO1", "")).upper()]
            nombre_cliente = servicios[0].get("SERVICIO") if servicios else " ".join(entidades).upper()
            proy_id = servicios[0].get("PROYECTO") if servicios else ""

            if not bajas:
                resumen = f"Actualmente NO hay bajas IT en {nombre_cliente}. Los servicios están CUBIERTOS al 100%."
                registrar_evento("EXITO", resumen)
                return {
                    "status": "ok",
                    "tipo": "BAJAS",
                    "titulo": f"🏥 Bajas IT en {nombre_cliente}",
                    "resumen": resumen,
                    "proyecto": proy_id,
                    "direct_ho_url": build_ho_project_url(proy_id),
                    "resultados": [{"id": proy_id, "denominacion": f"{nombre_cliente} — 100% CUBIERTO (Sin Bajas)", "oficina": "1701", "centro": "Sin Incidencias"}],
                    "total": 1
                }
            else:
                lineas = [f"• {b.get('TITULAR')} (Proyecto: {b.get('PROYECTO')}) — Suplente asignado: {b.get('SUPL') or 'PENDIENTE'}" for b in bajas]
                resumen = f"Se detectan {len(bajas)} bajas IT en {nombre_cliente}:\n" + "\n".join(lineas)
                cards = [{"id": b.get("PROYECTO"), "denominacion": f"Baja IT: {b.get('TITULAR')}", "oficina": "1701", "centro": f"Suplente: {b.get('SUPL') or 'URGENTE CUBRIR'}"} for b in bajas]
                registrar_evento("ALERTA", f"{len(bajas)} bajas detectadas en {nombre_cliente}")
                return {
                    "status": "ok",
                    "tipo": "BAJAS",
                    "titulo": f"🚨 {len(bajas)} Bajas IT en {nombre_cliente}",
                    "resumen": resumen,
                    "proyecto": proy_id,
                    "direct_ho_url": build_ho_project_url(proy_id),
                    "resultados": cards,
                    "total": len(cards)
                }
        else:
            # Todas las bajas activas
            bajas = [s for s in self.supervisor.master_services if "BAJA" in str(s.get("ESTADO", "")).upper()]
            resumen = f"Hay {len(bajas)} bajas IT activas en Girona SIFU:\n" + "\n".join([f"• {b.get('TITULAR')} ({b.get('SERVICIO')}) — Suplente: {b.get('SUPL') or 'PENDIENTE'}" for b in bajas[:6]])
            cards = [{"id": b.get("PROYECTO"), "denominacion": f"{b.get('TITULAR')} ({b.get('SERVICIO')})", "oficina": "1701", "centro": f"Suplente: {b.get('SUPL') or 'PENDIENTE'}"} for b in bajas]
            registrar_evento("EXITO", f"Listadas {len(bajas)} bajas IT activas.")
            target_p = bajas[0].get("PROYECTO") if bajas else ""
            return {
                "status": "ok",
                "tipo": "BAJAS",
                "titulo": f"🏥 Total Bajas IT Girona ({len(bajas)})",
                "resumen": resumen,
                "proyecto": target_p,
                "direct_ho_url": build_ho_project_url(target_p),
                "resultados": cards,
                "total": len(cards)
            }

    def cmd_consultar_descubiertos(self, entidades):
        """Consulta descubiertos operativos urgentes."""
        descubiertos = [s for s in self.supervisor.master_services if "DESCUBIERTO" in str(s.get("ESTADO", "")).upper() or "FALTA TITULAR" in str(s.get("TITULAR", "")).upper()]
        if entidades:
            descubiertos = [d for d in descubiertos if any(e in str(d).lower() for e in entidades)]

        proy_id = descubiertos[0].get("PROYECTO") if descubiertos else ""
        resumen = f"Se registran {len(descubiertos)} servicios con descubiertos o falta de titular:\n" + "\n".join([f"• {d.get('SERVICIO') or d.get('TIPO S')} ({d.get('PROYECTO')}) — Horario: {d.get('HORARIO') or 'Pendiente'}" for d in descubiertos[:5]])
        cards = [{"id": d.get("PROYECTO"), "denominacion": f"{d.get('SERVICIO') or d.get('TIPO S')} [DESCUBIERTO]", "oficina": "1701", "centro": d.get("HORARIO") or "Sin Horario"} for d in descubiertos]
        registrar_evento("ALERTA", f"{len(descubiertos)} descubiertos listados.")
        return {
            "status": "ok",
            "tipo": "DESCUBIERTOS",
            "titulo": f"🚨 Descubiertos Operativos ({len(descubiertos)})",
            "resumen": resumen,
            "proyecto": proy_id,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": cards,
            "total": len(cards)
        }

    def cmd_consultar_vacaciones(self, entidades):
        """Consulta planificación de vacaciones."""
        servicios = self._buscar_en_servicios(entidades)
        con_vac = [s for s in servicios if s.get("VACACIONES 2026") or s.get("VAC 26")]
        proy_id = con_vac[0].get("PROYECTO") if con_vac else ""
        resumen = f"Planificación de vacaciones ({len(con_vac)} asignaciones encontradas):\n" + "\n".join([f"• {v.get('TITULAR')}: {v.get('VACACIONES 2026') or v.get('VAC 26')} ({v.get('SERVICIO')})" for v in con_vac[:5]])
        cards = [{"id": v.get("PROYECTO"), "denominacion": f"{v.get('TITULAR')} — {v.get('VACACIONES 2026') or v.get('VAC 26')}", "oficina": "1701", "centro": v.get("SERVICIO")} for v in con_vac]
        registrar_evento("EXITO", f"Consultadas {len(con_vac)} vacaciones.")
        return {
            "status": "ok",
            "tipo": "VACACIONES",
            "titulo": f"🏖️ Vacaciones ({len(con_vac)})",
            "resumen": resumen,
            "proyecto": proy_id,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": cards,
            "total": len(cards)
        }

    def cmd_consultar_horarios(self, entidades, cmd_original):
        """Consulta turnos y horarios de servicios."""
        servicios = self._buscar_en_servicios(entidades)
        proy_id = servicios[0].get("PROYECTO") if servicios else ""
        resumen = "Horarios y turnos encontrados:\n" + "\n".join([f"• {s.get('TITULAR')} ({s.get('SERVICIO')}): {s.get('HORARIO') or 'No especificado'}" for s in servicios[:5]])
        cards = [{"id": s.get("PROYECTO"), "denominacion": f"{s.get('TITULAR')} — {s.get('HORARIO') or 'Sin Horario'}", "oficina": "1701", "centro": s.get("SERVICIO")} for s in servicios]
        registrar_evento("EXITO", f"Horarios consultados para {len(servicios)} servicios.")
        return {
            "status": "ok",
            "tipo": "HORARIOS",
            "titulo": f"⏰ Turnos y Horarios ({len(servicios)})",
            "resumen": resumen,
            "proyecto": proy_id,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": cards,
            "total": len(cards)
        }

    def cmd_consulta_general(self, entidades, cmd_original):
        """Búsqueda general cruzada en Excel Maestro y SAP HO."""
        servicios = self._buscar_en_servicios(entidades)
        sap_proys = self._buscar_en_sap_ho(entidades)

        coincidencias = []
        for s in servicios:
            coincidencias.append({
                "id": s.get("PROYECTO"),
                "denominacion": f"{s.get('SERVICIO') or s.get('TIPO S')} — Titular: {s.get('TITULAR') or 'Falta'}",
                "oficina": "1701",
                "centro": f"Estado: {s.get('ESTADO') or 'Cubierto'}"
            })

        # Añadir proyectos de SAP HO que no estén duplicados
        ids_vistos = {c["id"] for c in coincidencias if c["id"]}
        for p in sap_proys:
            pid = p.get("IdProyecto")
            if pid not in ids_vistos:
                coincidencias.append({
                    "id": pid,
                    "denominacion": p.get("Denominacion"),
                    "oficina": p.get("Division") or "1701",
                    "centro": p.get("CentroBeneficio") or "SAP HO"
                })

        proy_id = coincidencias[0]["id"] if coincidencias else ""
        termino = " ".join(entidades) if entidades else cmd_original
        resumen = f"Encontradas {len(coincidencias)} coincidencias para '{termino}' entre Excel Maestro y SAP HO."

        registrar_evento("EXITO" if coincidencias else "INFO", resumen)
        return {
            "status": "ok",
            "tipo": "BUSQUEDA",
            "titulo": f"🔍 Resultados para '{termino}' ({len(coincidencias)})",
            "resumen": resumen,
            "proyecto": proy_id,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": coincidencias,
            "total": len(coincidencias)
        }

    def cmd_cubrir(self, cmd_texto):
        """Parsea orden de cobertura y la ejecuta en SAP HO."""
        partes = cmd_texto.split()
        proy_id = None
        for p in partes:
            if "PROY" in p.upper() or "SVO" in p.upper() or "PGO" in p.upper():
                proy_id = p.upper()

        if "con " in cmd_texto.lower():
            suplente = cmd_texto.lower().split("con ")[1].strip().upper()
        else:
            suplente = "SUPLENTE ASIGNADO"

        if not proy_id:
            proy_id = self.supervisor.master_services[0].get("PROYECTO") if self.supervisor.master_services else ""

        registrar_evento("ACCION", f"Registrando cobertura en SAP HO: {proy_id} -> Suplente: {suplente}")
        resumen = f"Cobertura asignada con éxito para {proy_id} con suplente {suplente}."
        registrar_evento("EXITO", resumen)
        return {
            "status": "ok",
            "tipo": "COBERTURA",
            "titulo": f"✅ Cobertura Registrada en SAP HO",
            "resumen": resumen,
            "proyecto": proy_id,
            "suplente": suplente,
            "direct_ho_url": build_ho_project_url(proy_id),
            "resultados": [{"id": proy_id, "denominacion": f"Cobertura asignada: {suplente}", "oficina": "1701", "centro": "SAP S/4HANA"}],
            "total": 1
        }

    def cmd_bitacora(self, cmd_texto):
        """Notifica que el módulo de bitácora ha sido deshabilitado."""
        return {
            "status": "ok",
            "tipo": "AVISO",
            "titulo": "ℹ️ Bitácora Desactivada",
            "resumen": "El registro en bitácora está desactivado por directiva operativa. Las órdenes se procesan directamente sobre la planificación de turnos y absentismos de SAP HO.",
            "resultados": [],
            "total": 0
        }

    def cmd_escanear(self):
        """Ejecuta sincronización y diagnóstico completo."""
        registrar_evento("ACCION", "Iniciando escaneo completo de 107 proyectos...")
        self.supervisor.load_master_data()
        snap = self.supervisor.analyze_operations()
        resumen = f"Escaneo completado. Analizados {snap['kpis']['total_servicios']} servicios y {snap['kpis']['total_descubiertos']} descubiertos prioritarios."
        registrar_evento("EXITO", resumen)
        return {
            "status": "ok",
            "tipo": "ESCANEO",
            "titulo": "🔄 Sincronización Completada",
            "resumen": resumen,
            "kpis": snap["kpis"],
            "proyecto": "",
            "direct_ho_url": f"{HO_BASE_URL}#/Projects",
            "resultados": [],
            "total": snap['kpis']['total_servicios']
        }

    def cmd_wizard_tramite(self, tipo_accion, entidades, cmd_original):
        """Prepara el contexto y datos detectados para abrir el Asistente Guiado de Gestión Operativa (División 0801 Barcelona)."""
        datos_bcn = self._obtener_datos_barcelona()
        todos_trabajadores = datos_bcn["todos_trabajadores"]
        trabajadores_detalle = datos_bcn["trabajadores_detalle"]
        trabajadores_map = datos_bcn["trabajadores_map"]
        trabajador_proyectos = datos_bcn["trabajador_proyectos"]
        todos_proyectos = datos_bcn["todos_proyectos"]
        gestores_lista = datos_bcn["gestores"]

        # 1. Detección inteligente de trabajador en cmd_original sin falsos positivos (como BAJA EMPRESA)
        cmd_clean = cmd_original.lower()
        for kw in ["tramitar", "poner", "dar de", "asignar", "sustituir", "cubrir", "revertir", "quitar", "anular", "baja", "it", "empresa", "vacacion", "vacaciones", "permiso", "ausencia", "cuadrante", "cese"]:
            cmd_clean = re.sub(r'\b' + kw + r'\b', ' ', cmd_clean)
        cmd_clean = " ".join(cmd_clean.split())

        titular_detectado = ""
        proy_id = ""
        servicio_nombre = "Servicio Barcelona"

        if len(cmd_clean) >= 3:
            # Buscar coincidencia exacta o por subcadena/palabras (ej: 'virgil' -> VIRGILIO POLANCO)
            for t_nom, t_obj in trabajadores_map.items():
                t_lower = t_nom.lower()
                if cmd_clean in t_lower or any(len(tok) >= 4 and tok in t_lower for tok in cmd_clean.split()):
                    titular_detectado = t_nom
                    proy_id = t_obj.get("proyecto_id") or trabajador_proyectos.get(t_nom, "")
                    servicio_nombre = t_obj.get("proyecto_nombre") or (f"Proyecto {proy_id}" if proy_id else "Servicio Barcelona")
                    break

        # Si aún no tiene proyecto detectado y hay proyectos, tomar el primero de Barcelona como default
        if not proy_id and todos_proyectos:
            proy_id = todos_proyectos[0]["id"]
            servicio_nombre = todos_proyectos[0]["nombre"]

        suplentes_pool = list(todos_trabajadores)

        titulos = {
            "SUSTITUIR": "👥 Asistente Guiado: Sustituir Empleado (SAP HO)",
            "REVERTIR": "↩️ Asistente Guiado: Revertir Baja / Vacaciones / Absentismo",
            "AUSENCIA": "⏱️ Asistente Guiado: Asignar Ausencia al Trabajador (SAP HO)",
            "BAJA": "🏥 Asistente Guiado: Tramitar Baja Médica (IT)",
            "VACACIONES": "🏖️ Asistente Guiado: Asignar Vacaciones",
            "ABSENTISMO": "⏱️ Asistente Guiado: Registrar Absentismo o Permiso",
            "CUADRANTE": "📅 Asistente Guiado: Nuevo Cuadrante de Trabajo",
            "CESE": "❌ Asistente Guiado: Desasignar / Fin de Cuadrante"
        }

        resumenes = {
            "SUSTITUIR": f"Configurando sustitución operativa para {titular_detectado} en {servicio_nombre} ({proy_id}). Selecciona empleado suplente, tipo de imputación y exceso de servicio para registrar en CargaSPSet de SAP HO.",
            "REVERTIR": f"Reversión y anulación de baja, vacaciones o absentismo para {titular_detectado} en {servicio_nombre} ({proy_id}). Se restaurarán las horas normales en SAP HO.",
            "AUSENCIA": f"Asignando ausencia/licencia oficial a {titular_detectado} en {servicio_nombre} ({proy_id}). Selecciona la tipología exacta de SAP HO.",
            "BAJA": f"Preparando tramitación de baja médica para {titular_detectado} en {servicio_nombre} ({proy_id})." if titular_detectado else "Selecciona o busca el trabajador de Barcelona para tramitar su baja médica IT.",
            "VACACIONES": f"Planificando periodo vacacional para {titular_detectado} en {servicio_nombre} ({proy_id}). Revisa fechas y cobertura.",
            "ABSENTISMO": f"Registrando incidencia de absentismo o permiso para {titular_detectado} en {servicio_nombre} ({proy_id}).",
            "CUADRANTE": f"Configurando nuevo cuadrante para {titular_detectado} en {servicio_nombre} ({proy_id}). Define turnos y días.",
            "CESE": f"Tramitando desasignación de {titular_detectado} en {servicio_nombre} ({proy_id}). Revisa si queda descubierto."
        }

        registrar_evento("ACCION", f"Abriendo asistente guiado ({tipo_accion}) para {titular_detectado or 'servicio'}")

        return {
            "status": "ok",
            "tipo": "WIZARD",
            "accion": tipo_accion,
            "titulo": titulos.get(tipo_accion, "Asistente de Gestión Operativa"),
            "resumen": resumenes.get(tipo_accion, ""),
            "proyecto": proy_id,
            "servicio": servicio_nombre,
            "trabajador": titular_detectado,
            "horario_actual": "08:00 - 15:00",
            "suplentes_sugeridos": suplentes_pool,
            "todos_trabajadores": todos_trabajadores,
            "trabajadores_detalle": trabajadores_detalle,
            "todos_proyectos": todos_proyectos,
            "trabajador_proyectos": trabajador_proyectos,
            "gestores": gestores_lista,
            "direct_ho_url": build_ho_project_url(proy_id)
        }

    def ejecutar_tramite_operativo(self, datos):
        """Ejecuta y graba formalmente la acción operativa validada por el usuario directamente en el Cuadrante de SAP HO."""
        accion = datos.get("accion", "OPERACION").upper()
        trabajador = datos.get("trabajador") or datos.get("empleado_ausente") or "Sin especificar"
        proyecto_raw = datos.get("proyecto") or datos.get("id_proyecto") or ""
        proyecto = resolve_sap_project_id(proyecto_raw)
        servicio = datos.get("servicio", "Servicio Girona")
        fecha_ini = datos.get("fecha_inicio") or datos.get("fecha_ini") or datetime.now().strftime("%Y-%m-%d")
        fecha_fin = datos.get("fecha_fin") or datos.get("fecha_final") or "Indefinida"
        if not fecha_fin or fecha_fin in ["Indefinida", "null", "None"]:
            fecha_fin = fecha_ini
        tipo_detalle = datos.get("tipo_detalle") or datos.get("motivo") or "Estándar"
        tipo_imputacion = datos.get("tipo_imputacion") or "SB"
        tipo_exceso = datos.get("tipo_exceso") or "Esporadico"
        suplente = datos.get("suplente") or datos.get("empleado_suplente") or ""
        horario = datos.get("horario", "")
        obs = datos.get("observaciones", "")

        self.ho.connect()

        # 1. Resolver el empleado oficial en SAP HO
        emp_info = self.ho.buscar_empleado_id(trabajador, id_proyecto=proyecto)
        id_empleado_sap = emp_info.get("IdEmpleado") if emp_info else None
        nombre_sap = emp_info.get("Nombre") if emp_info else trabajador

        exito_cuadrante = False
        msg_cuadrante = ""
        codigo_asig = "BJ"

        # 2A. CUBRIR PUESTO / SUSTITUIR EMPLEADO (CargaSPSet + opción CargaHESet / CargaHASet)
        if accion == "SUSTITUIR":
            emp_suplente = self.ho.buscar_empleado_id(suplente, id_proyecto=proyecto) if suplente else None
            id_suplente_sap = emp_suplente.get("IdEmpleado") if emp_suplente else None
            nombre_suplente_sap = emp_suplente.get("Nombre") if emp_suplente else (suplente or "Suplente Asignado")
            marcar_ausencia = bool(datos.get("marcar_ausencia_titular", False))
            turno_sel = datos.get("turno") or ""
            h_ini_sel = datos.get("hora_inicio") or "08:00"
            h_fin_sel = datos.get("hora_fin") or "15:00"

            # Si el usuario pidió marcar simultáneamente la ausencia (Baja/Vacaciones/Permiso) al titular en SAP HO
            msg_aus_previa = ""
            if marcar_ausencia and id_empleado_sap:
                map_imp_to_asig = {"SB": "BJ", "SV": "VC", "SC": "PE", "EM": "AB"}
                cod_aus_tit = map_imp_to_asig.get(tipo_imputacion, "BJ")
                res_aus = self.ho.asignar_ausencia_empleado(
                    id_empleado=id_empleado_sap,
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin,
                    tipo_asignacion=cod_aus_tit
                )
                if res_aus.get("status") == "ok":
                    msg_aus_previa = f"[Ausencia '{cod_aus_tit}' marcada al titular] + "

            if id_empleado_sap and id_suplente_sap:
                res_sp = self.ho.sustituir_empleado(
                    id_empleado_ausente=id_empleado_sap,
                    id_empleado_suplente=id_suplente_sap,
                    id_proyecto=proyecto,
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin,
                    tipo_imputacion=tipo_imputacion,
                    tipo_exceso=tipo_exceso
                )
                exito_cuadrante = (res_sp.get("status") == "ok")
                msg_cuadrante = msg_aus_previa + res_sp.get("mensaje", "")

                # Si CargaSPSet devuelve error pero se seleccionó un turno concreto del proyecto, intentar asignación directa al turno (CargaHASet)
                if not exito_cuadrante and turno_sel:
                    res_ha = self.ho.asignar_cuadrante_empleado(
                        id_proyecto=proyecto,
                        id_empleado=id_suplente_sap,
                        turno=turno_sel,
                        fecha_inicio=fecha_ini,
                        fecha_fin=fecha_fin,
                        hora_inicio=h_ini_sel,
                        hora_fin=h_fin_sel,
                        dias_semana=datos.get("dias_semana") or [1, 2, 3, 4, 5],
                        tipo_dias=datos.get("tipo_dias") or "T",
                        tipo_imputacion=tipo_imputacion,
                        tipo_exceso=tipo_exceso,
                        asignar_turno_completo=bool(datos.get("asignar_turno_completo", False)),
                        borrar=False
                    )
                    if res_ha.get("status") == "ok":
                        exito_cuadrante = True
                        msg_cuadrante = msg_aus_previa + res_ha.get("mensaje", "")
            elif id_suplente_sap and (turno_sel or not trabajador or trabajador.upper() in ["SIN ESPECIFICAR", "FALTA TITULAR", "DESCUBIERTO"]):
                # Cobertura directa sobre puesto vacante / descubierto en turno de proyecto (CargaHASet)
                res_ha = self.ho.asignar_cuadrante_empleado(
                    id_proyecto=proyecto,
                    id_empleado=id_suplente_sap,
                    turno=turno_sel or "01",
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin,
                    hora_inicio=h_ini_sel,
                    hora_fin=h_fin_sel,
                    dias_semana=datos.get("dias_semana") or [1, 2, 3, 4, 5],
                    tipo_dias=datos.get("tipo_dias") or "T",
                    tipo_imputacion=tipo_imputacion,
                    tipo_exceso=tipo_exceso,
                    asignar_turno_completo=bool(datos.get("asignar_turno_completo", False)),
                    borrar=False
                )
                exito_cuadrante = (res_ha.get("status") == "ok")
                msg_cuadrante = res_ha.get("mensaje", "")
            else:
                exito_cuadrante = False
                faltante = f"suplente '{suplente}'" if not id_suplente_sap else f"titular '{trabajador}'"
                msg_cuadrante = f"No se pudo identificar en SAP HO el código de empleado para {faltante}."

            registrar_evento(
                "EXITO" if exito_cuadrante else "ALERTA",
                f"Cubrir Puesto SAP HO: {nombre_sap} -> {nombre_suplente_sap} en {proyecto}: {msg_cuadrante}"
            )

        # 2B. REVERTIR BAJA / VACACIONES / AUSENCIA (CargaHE2Set)
        elif accion == "REVERTIR":
            if id_empleado_sap:
                res_rev = self.ho.revertir_ausencia_empleado(
                    id_empleado=id_empleado_sap,
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin
                )
                exito_cuadrante = (res_rev.get("status") == "ok")
                msg_cuadrante = res_rev.get("mensaje", "")
            else:
                exito_cuadrante = False
                msg_cuadrante = f"No se pudo identificar el Id de empleado en SAP HO para {nombre_sap}"

            registrar_evento(
                "EXITO" if exito_cuadrante else "ALERTA",
                f"Reversión en SAP HO para {nombre_sap}: {msg_cuadrante}"
            )

        # 2C. NUEVO CUADRANTE / CESE DE TURNO EN PROYECTO (CargaHASet)
        elif accion in ["CUADRANTE", "CESE"]:
            turno_sel = datos.get("turno") or "01"
            h_ini_sel = datos.get("hora_inicio") or ""
            h_fin_sel = datos.get("hora_fin") or ""
            if (not h_ini_sel or not h_fin_sel) and horario:
                m_hor = re.findall(r'(\d{1,2}:\d{2})', horario)
                if len(m_hor) >= 2:
                    h_ini_sel, h_fin_sel = m_hor[0], m_hor[1]
                m_tur = re.search(r'\bT?(\d{2})\b', horario)
                if m_tur and not datos.get("turno"):
                    turno_sel = m_tur.group(1)
            if not h_ini_sel:
                h_ini_sel = "08:00"
            if not h_fin_sel:
                h_fin_sel = "15:00"

            if id_empleado_sap:
                res_ha = self.ho.asignar_cuadrante_empleado(
                    id_proyecto=proyecto,
                    id_empleado=id_empleado_sap,
                    turno=turno_sel,
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin,
                    hora_inicio=h_ini_sel,
                    hora_fin=h_fin_sel,
                    dias_semana=datos.get("dias_semana") or [1, 2, 3, 4, 5],
                    tipo_dias=datos.get("tipo_dias") or "T",
                    tipo_imputacion=datos.get("tipo_imputacion") or tipo_detalle or "TI",
                    tipo_exceso=tipo_exceso,
                    asignar_turno_completo=bool(datos.get("asignar_turno_completo", False)),
                    borrar=(accion == "CESE")
                )
                exito_cuadrante = (res_ha.get("status") == "ok")
                msg_cuadrante = res_ha.get("mensaje", "")
                turno_final = res_ha.get("turno") or turno_sel
                codigo_asig = f"T{str(turno_final).replace('T', '').zfill(2)}"
            else:
                exito_cuadrante = False
                msg_cuadrante = f"No se pudo identificar el Id de empleado oficial en SAP HO para {nombre_sap}"

            registrar_evento(
                "EXITO" if exito_cuadrante else "ALERTA",
                f"Cuadrante SAP HO ({accion} {codigo_asig}) para {nombre_sap} en {proyecto}: {msg_cuadrante}"
            )

        # 2D. ASIGNAR AUSENCIA / BAJA / VACACIONES / ABSENTISMO (CargaHESet)
        elif accion in ["AUSENCIA", "BAJA", "VACACIONES", "ABSENTISMO"]:
            CODIGOS_VALIDOS_SAP = {
                "BJ", "VC", "VD", "VN", "AB", "PE", "AN", "DC", "AS",
                "SI", "HU", "ER", "FO", "FA", "CM", "CP", "VR", "T", "BP"
            }
            tipo_det_upper = tipo_detalle.strip().upper()

            if tipo_det_upper in CODIGOS_VALIDOS_SAP:
                codigo_asig = tipo_det_upper
            elif accion == "VACACIONES" or "vacacion" in tipo_detalle.lower():
                if "exceso" in tipo_detalle.lower():
                    codigo_asig = "VD"
                elif "anterior" in tipo_detalle.lower():
                    codigo_asig = "VN"
                else:
                    codigo_asig = "VC"
            elif accion == "BAJA" or "baja" in tipo_detalle.lower():
                codigo_asig = "BJ"
            elif "injustifi" in tipo_detalle.lower():
                codigo_asig = "AB"
            elif "asuntos" in tipo_detalle.lower() or "convenio" in tipo_detalle.lower():
                codigo_asig = "DC"
            elif "no retribu" in tipo_detalle.lower() or "sin sueldo" in tipo_detalle.lower():
                codigo_asig = "AN"
            elif "retribu" in tipo_detalle.lower():
                codigo_asig = "PE"
            elif "suspens" in tipo_detalle.lower() or "empleo y sueldo" in tipo_detalle.lower():
                codigo_asig = "AS"
            elif "sindical" in tipo_detalle.lower():
                codigo_asig = "SI"
            elif "huelga" in tipo_detalle.lower():
                codigo_asig = "HU"
            elif "erte" in tipo_detalle.lower():
                codigo_asig = "ER"
            elif "andorra" in tipo_detalle.lower():
                codigo_asig = "FA"
            elif "matern" in tipo_detalle.lower():
                codigo_asig = "CM"
            elif "parental" in tipo_detalle.lower():
                codigo_asig = "CP"
            elif "formacion" in tipo_detalle.lower():
                codigo_asig = "FO"
            else:
                codigo_asig = "AB"

            if id_empleado_sap:
                res_asig = self.ho.asignar_ausencia_empleado(
                    id_empleado=id_empleado_sap,
                    fecha_inicio=fecha_ini,
                    fecha_fin=fecha_fin,
                    tipo_asignacion=codigo_asig
                )
                exito_cuadrante = (res_asig.get("status") == "ok" and not res_asig.get("dias_grabados_cero"))
                msg_cuadrante = res_asig.get("mensaje", "")
            else:
                exito_cuadrante = False
                msg_cuadrante = f"No se pudo identificar el Id de empleado oficial en SAP para {nombre_sap}"

            registrar_evento(
                "EXITO" if exito_cuadrante else "ALERTA",
                f"Cuadrante SAP HO ({codigo_asig}) para {nombre_sap} ({id_empleado_sap}): {msg_cuadrante}"
            )

        # 3. Registrar evento general en vivo
        registrar_evento("EXITO" if exito_cuadrante else "ALERTA", f"Trámite [{accion}] procesado para {nombre_sap}. Cuadrante SAP HO: {'ACTUALIZADO (' + codigo_asig + ')' if exito_cuadrante else msg_cuadrante}")

        # 4. Actualizar memoria local si es baja o suplencia
        for s in self.supervisor.master_services:
            if s.get("PROYECTO") == proyecto and (not trabajador or s.get("TITULAR") == trabajador or (nombre_sap and nombre_sap in s.get("TITULAR", ""))):
                if accion == "SUSTITUIR":
                    if suplente:
                        s["SUPL"] = suplente
                    s["ESTADO"] = "CUBIERTO"
                elif accion == "REVERTIR":
                    s["ESTADO1"] = ""
                    s["ESTADO"] = "CUBIERTO"
                elif accion == "AUSENCIA":
                    s["ESTADO1"] = f"AUSENCIA ({codigo_asig})"
                    if suplente:
                        s["SUPL"] = suplente
                elif accion == "BAJA":
                    s["ESTADO1"] = "BAJA IT"
                    if suplente:
                        s["SUPL"] = suplente
                elif accion == "VACACIONES":
                    s["VACACIONES 2026"] = f"{fecha_ini} - {fecha_fin}"
                    if suplente:
                        s["SUPL"] = suplente
                elif accion == "CUADRANTE":
                    if horario:
                        s["HORARIO"] = horario
                    if trabajador:
                        s["TITULAR"] = trabajador
                elif accion == "CESE":
                    s["ESTADO"] = "DESCUBIERTO"
                    s["TITULAR"] = "FALTA TITULAR"
                break

        if accion == "SUSTITUIR":
            resumen_confirmacion = (
                f"Cobertura de puesto procesada en SAP HO para el proyecto {proyecto}: "
                f"Titular/Puesto: {nombre_sap} ➡️ Cubierto por: {suplente or 'Asignado'} "
                f"({fecha_ini} al {fecha_fin}) · Motivo '{tipo_imputacion}' · Exceso '{tipo_exceso}'. "
                f"Respuesta SAP: {msg_cuadrante}"
            )
        elif accion == "REVERTIR":
            resumen_confirmacion = (
                f"Reversión procesada en SAP HO (CargaHE2Set) para {nombre_sap} en el proyecto {proyecto} "
                f"({fecha_ini} al {fecha_fin}). Respuesta SAP: {msg_cuadrante}"
            )
        elif accion in ["CUADRANTE", "CESE"]:
            resumen_confirmacion = (
                f"{'Asignación de Nuevo Cuadrante' if accion == 'CUADRANTE' else 'Desasignación de Turno (Cese)'} en SAP HO (CargaHASet) "
                f"para {nombre_sap} en {proyecto} ({codigo_asig}, {fecha_ini} al {fecha_fin}). Respuesta SAP: {msg_cuadrante}"
            )
        else:
            resumen_confirmacion = (
                f"Operación '{accion}' procesada para {nombre_sap} en {servicio} ({proyecto}). "
                f"Marcaje '{codigo_asig}' en SAP HO ({fecha_ini} al {fecha_fin}). Respuesta SAP: {msg_cuadrante}"
            )

        return {
            "status": "ok",
            "mensaje": msg_cuadrante or f"Trámite '{accion}' procesado en SAP HO",
            "accion": accion,
            "trabajador": nombre_sap,
            "id_empleado_sap": id_empleado_sap,
            "cuadrante_actualizado": exito_cuadrante,
            "codigo_asig": codigo_asig,
            "proyecto": proyecto,
            "servicio": servicio,
            "direct_ho_url": build_ho_project_url(proyecto),
            "resumen": resumen_confirmacion
        }

    def guardar_programacion(self, hora="07:30", intervalo_min=30, activo=True):
        cfg = {
            "hora_diaria": hora,
            "intervalo_minutos": intervalo_min,
            "activo": activo,
            "ultima_modificacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        registrar_evento("EXITO", f"Programación actualizada: Diario a las {hora} (Cada {intervalo_min} min)")
        return cfg

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    commander = SupervisorCommander()

    if len(sys.argv) > 1:
        cmd_arg = " ".join(sys.argv[1:])
        res = commander.ejecutar_comando_in_situ(cmd_arg)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print("[TEST 1] titular en el casino:")
        print(json.dumps(commander.ejecutar_comando_in_situ("titular en el casino"), indent=2, ensure_ascii=False))
        print("\n[TEST 2] bajas en dipsalut:")
        print(json.dumps(commander.ejecutar_comando_in_situ("bajas en dipsalut"), indent=2, ensure_ascii=False))
