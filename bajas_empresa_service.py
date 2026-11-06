# -*- coding: utf-8 -*-
"""
SERVICIO CENTRALIZADO DE BAJAS DEFINITIVAS DE EMPRESA - SIFU GIRONA
Gestiona la lista y persistencia de operarios que YA NO ESTÁN EN LA EMPRESA (desvinculados, bajas definitivas, fin de contrato).
Asegura que nunca aparezcan en censos, fichajes, cuadrantes ni auditorías.
"""

import os
import json
import re
import unicodedata
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BAJAS_EMPRESA_FILE = os.path.join(BASE_DIR, "bajas_empresa_sifu.json")

def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFD', str(text))
    text = re.sub(r'[\u0300-\u036f]', '', text)
    return re.sub(r'[^A-Z0-9 ]', '', text.upper()).strip()

def normalize_dni(dni):
    if not dni:
        return ""
    return re.sub(r'[\s\-_.]', '', str(dni)).upper()

# Lista base de personas confirmadas que YA NO ESTÁN en SIFU (HECTOR GOMEZ, NATALIA HRABAN, ZAKARIAE ALAMI, JAVIER SANCHEZ, MANUEL TITOS)
BAJAS_INICIALES = [
    {"dni": "40561222D", "nombre": "HECTOR GOMEZ CARRERA", "motivo": "Dado de baja en SAP HO (FechaFiniquito)"},
    {"dni": "40529718S", "nombre": "JAVIER RAUL SANCHEZ CHILLON", "motivo": "Jardinería / No está en plantilla de operaciones"},
    {"dni": "40526220J", "nombre": "MANUEL TITOS LOZANO", "motivo": "Jardinería / No está en plantilla de operaciones"},
    {"dni": "Z1320496W", "nombre": "NATALIA HRABAN", "motivo": "Dado de baja en SAP HO (FechaFiniquito)"},
    {"dni": "46173041N", "nombre": "ZAKARIAE ALAMI-MERROUNI EL BAKKARI", "motivo": "Dado de baja en SAP HO (FechaFiniquito)"}
]

def load_bajas_empresa():
    """Carga el diccionario completo de bajas de empresa."""
    if not os.path.exists(BAJAS_EMPRESA_FILE):
        data = {
            "ultima_actualizacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "bajas": {}
        }
        for b in BAJAS_INICIALES:
            cdni = normalize_dni(b["dni"])
            data["bajas"][cdni] = {
                "dni": cdni,
                "nombre": b["nombre"].upper(),
                "nombre_norm": normalize_text(b["nombre"]),
                "motivo": b.get("motivo", "Ya no sigue en SIFU"),
                "fecha_registro": datetime.now().strftime("%Y-%m-%d")
            }
        save_bajas_empresa(data)
        return data

    try:
        with open(BAJAS_EMPRESA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Asegurar que las iniciales siempre estén presentes
            modificado = False
            for b in BAJAS_INICIALES:
                cdni = normalize_dni(b["dni"])
                if cdni not in data.get("bajas", {}):
                    data.setdefault("bajas", {})[cdni] = {
                        "dni": cdni,
                        "nombre": b["nombre"].upper(),
                        "nombre_norm": normalize_text(b["nombre"]),
                        "motivo": b.get("motivo", "Ya no sigue en SIFU"),
                        "fecha_registro": datetime.now().strftime("%Y-%m-%d")
                    }
                    modificado = True
            if modificado:
                save_bajas_empresa(data)
            return data
    except Exception as e:
        print(f"Error cargando {BAJAS_EMPRESA_FILE}: {e}")
        return {"bajas": {}}

def save_bajas_empresa(data):
    """Guarda atómicamente el archivo de bajas de empresa."""
    data["ultima_actualizacion"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tmp = BAJAS_EMPRESA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    if os.path.exists(BAJAS_EMPRESA_FILE):
        os.replace(tmp, BAJAS_EMPRESA_FILE)
    else:
        os.rename(tmp, BAJAS_EMPRESA_FILE)

def registrar_baja_empresa(dni, nombre="", motivo="Ya no sigue en SIFU"):
    """Registra a un trabajador como baja definitiva de la empresa y purga los ficheros."""
    cdni = normalize_dni(dni)
    cnom = (nombre or "").strip().upper()
    cnom_norm = normalize_text(cnom)

    data = load_bajas_empresa()
    data.setdefault("bajas", {})
    data["bajas"][cdni] = {
        "dni": cdni,
        "nombre": cnom,
        "nombre_norm": cnom_norm,
        "motivo": motivo,
        "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    save_bajas_empresa(data)

    # Purgar inmediatamente de los archivos de fichajes y censo
    purgar_trabajador_desvinculado(cdni, cnom)
    return data["bajas"][cdni]

def es_baja_empresa(dni=None, nombre=None):
    """Comprueba si un trabajador está registrado como baja definitiva."""
    data = load_bajas_empresa()
    bajas = data.get("bajas", {})

    cdni = normalize_dni(dni)
    if cdni and cdni in bajas:
        return True, bajas[cdni]

    if nombre:
        norm = normalize_text(nombre)
        for b in bajas.values():
            if b.get("nombre_norm") and b["nombre_norm"] == norm:
                return True, b
            if norm and b.get("nombre_norm") and (norm in b["nombre_norm"] or b["nombre_norm"] in norm) and len(norm) > 8:
                return True, b

    return False, None

def purgar_trabajador_desvinculado(dni, nombre=""):
    """Elimina al trabajador de fichajes_censo_girona.json, fichajes_contraste_girona.json y fichajes_contraste_data.js."""
    cdni = normalize_dni(dni)
    cnom_norm = normalize_text(nombre)

    # 1. fichajes_censo_girona.json
    censo_file = os.path.join(BASE_DIR, "fichajes_censo_girona.json")
    if os.path.exists(censo_file):
        try:
            with open(censo_file, "r", encoding="utf-8") as f:
                censo = json.load(f)
            nuevo_censo = [
                w for w in censo
                if normalize_dni(w.get("dni")) != cdni and
                (not cnom_norm or normalize_text(w.get("name") or w.get("nombre")) != cnom_norm)
            ]
            if len(nuevo_censo) != len(censo):
                with open(censo_file, "w", encoding="utf-8") as f:
                    json.dump(nuevo_censo, f, ensure_ascii=False, indent=2)
                print(f"[PURGA] Eliminado de censo: {dni} {nombre}")
        except Exception as e:
            print(f"Error purgando censo: {e}")

    # 2. fichajes_contraste_girona.json y .js
    fich_file = os.path.join(BASE_DIR, "fichajes_contraste_girona.json")
    js_file = os.path.join(BASE_DIR, "fichajes_contraste_girona_data.js")
    if os.path.exists(fich_file):
        try:
            with open(fich_file, "r", encoding="utf-8") as f:
                fich_data = json.load(f)
            trabs = fich_data.get("trabajadores", [])
            nuevos_trabs = [
                w for w in trabs
                if normalize_dni(w.get("dni")) != cdni and
                (not cnom_norm or normalize_text(w.get("nombre")) != cnom_norm)
            ]
            if len(nuevos_trabs) != len(trabs):
                fich_data["trabajadores"] = nuevos_trabs
                fich_data["total_trabajadores"] = len(nuevos_trabs)
                fich_data["fichan_ok"] = sum(1 for w in nuevos_trabs if w.get("estado_semaforo") == "ok")
                fich_data["fichan_parcial"] = sum(1 for w in nuevos_trabs if w.get("estado_semaforo") == "nook")
                fich_data["no_fichan"] = sum(1 for w in nuevos_trabs if w.get("estado_semaforo") == "noficha")
                fich_data["en_baja"] = sum(1 for w in nuevos_trabs if w.get("estado_semaforo") == "baja")

                with open(fich_file, "w", encoding="utf-8") as f:
                    json.dump(fich_data, f, ensure_ascii=False, indent=2)

                payload_str = json.dumps(fich_data, ensure_ascii=False)
                with open(js_file, "w", encoding="utf-8") as f:
                    f.write(f"window.FICHAJES_CONTRASTE_PAYLOAD = {payload_str};\n")
                print(f"[PURGA] Eliminado de contraste: {dni} {nombre}")
        except Exception as e:
            print(f"Error purgando contraste: {e}")

if __name__ == "__main__":
    bajas = load_bajas_empresa()
    print(f"Bajas de empresa cargadas: {len(bajas.get('bajas', {}))} trabajadores.")
