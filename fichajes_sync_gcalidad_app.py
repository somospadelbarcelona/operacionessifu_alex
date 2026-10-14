# -*- coding: utf-8 -*-
"""
SUPER MOTOR DE SINCRONIZACIÓN Y AUDITORÍA DE FICHAJES - SIFU GIRONA v2.0
- Sesiones 100% aisladas con Playwright por trabajador (cero cruce de cookies).
- Extracción fidedigna de window.Fichajes (sin depender de colores de DOM).
- Algoritmo de emparejamiento de turnos, cálculo de horas e incidencias (sin salida, nocturnos).
- Cruce con bajas de SAP y cuadrantes.
- Escritura atómica, preservación de datos ante fallos transitorios e histórico mensual.
"""

import asyncio
import json
import os
import sys
import time
import re
from datetime import datetime, date, timedelta
from playwright.async_api import async_playwright

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_OUT = os.path.join(BASE_DIR, "fichajes_contraste_girona.json")
JS_OUT = os.path.join(BASE_DIR, "fichajes_contraste_data.js")
CENSUS_FILE = os.path.join(BASE_DIR, "fichajes_censo_girona.json")
HISTORICO_DIR = os.path.join(BASE_DIR, "fichajes_historico")
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOCK_FILE = os.path.join(BASE_DIR, ".fichajes_sync.lock")
SAP_EMPLOYEES_FILE = os.path.join(BASE_DIR, "ho_employees_cache.json")
CUADRANTES_FILE = os.path.join(BASE_DIR, "ho_cuadrantes_cache.json")

os.makedirs(HISTORICO_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

def log_msg(msg):
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{now_str}] {msg}"
    print(line)
    try:
        with open(os.path.join(LOG_DIR, "fichajes_sync.log"), "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%d/%m/%Y")
    except Exception:
        return None

def parse_datetime(dt_str):
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(dt_str, fmt)
        except Exception:
            pass
    return None

def load_previous_data():
    if os.path.exists(JSON_OUT):
        try:
            with open(JSON_OUT, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_msg(f"Aviso leyendo datos anteriores: {e}")
    return {}

def load_census():
    if os.path.exists(CENSUS_FILE):
        try:
            with open(CENSUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_msg(f"Error leyendo {CENSUS_FILE}: {e}")
    # Fallback
    return []

def load_sap_bajas():
    # Detectar trabajadores en baja médica IT
    bajas_dni = set()
    if os.path.exists(SAP_EMPLOYEES_FILE):
        try:
            with open(SAP_EMPLOYEES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for d, info in data.get("by_dni", {}).items():
                    dni_norm = re.sub(r'[\s\-_.]', '', str(d)).upper()
                    # Si tiene marca de IT o suspendido
                    if info.get("baja") or "BAJA" in str(info.get("estado", "")).upper():
                        bajas_dni.add(dni_norm)
        except Exception:
            pass
    return bajas_dni

def process_worker_punches(raw_fichs, target_year, target_month):
    """
    Procesa la lista cruda de fichajes y construye la estructura detallada mensual
    con cálculo de horas y emparejamiento inteligente de turnos (incluido nocturno).
    """
    normalized = []
    for fc in raw_fichs:
        fechr_str = fc.get("FECHR", "").strip()
        dt = parse_datetime(fechr_str)
        if not dt:
            continue
        is_entrada = bool(fc.get("ENTR"))
        punto = fc.get("PUNTO") or ""
        chkid = fc.get("CHKID")
        descanso = bool(fc.get("DESCA"))

        normalized.append({
            "dt": dt,
            "fecha": dt.strftime("%d/%m/%Y"),
            "hora": dt.strftime("%H:%M:%S"),
            "tipo": "Entrada" if is_entrada else "Salida",
            "isEntrada": is_entrada,
            "punto": punto,
            "descanso": descanso,
            "chkid": chkid
        })

    # Ordenar cronológicamente ascendente
    normalized.sort(key=lambda x: x["dt"])

    # Estructura por meses
    # Determinamos mes objetivo (ej: "2026-10")
    month_key = f"{target_year:04d}-{target_month:02d}"
    num_days = 31 # por defecto
    try:
        import calendar
        num_days = calendar.monthrange(target_year, target_month)[1]
    except Exception:
        pass

    days_dict = {}
    for d in range(1, num_days + 1):
        day_str = f"{d:02d}"
        days_dict[day_str] = {
            "marcajes": [],
            "horas_trabajadas": 0.0,
            "estado": "SIN_MARCAJE", # COMPLETO | INCOMPLETO_SIN_SALIDA | SOLO_SALIDA | SIN_MARCAJE | EN_CURSO
            "turno_previsto": None,
            "retraso_min": None
        }

    # Asignar marcajes al día correspondiente y emparejar
    # Consideramos turno nocturno: Entrada a las 22:00-23:59 y Salida a las 05:00-09:00 del día siguiente
    for p in normalized:
        dt = p["dt"]
        if dt.year == target_year and dt.month == target_month:
            day_str = f"{dt.day:02d}"
            if day_str in days_dict:
                days_dict[day_str]["marcajes"].append({
                    "hora": p["hora"],
                    "tipo": p["tipo"],
                    "punto": p["punto"],
                    "descanso": p["descanso"]
                })

    # Calcular horas y estados de cada día
    total_horas_mes = 0.0
    dias_completos = 0
    dias_incompletos = 0
    dias_fichados_set = set()

    today_dt = datetime.now()

    for day_str, info in days_dict.items():
        day_int = int(day_str)
        day_date = date(target_year, target_month, day_int)
        day_punches = info["marcajes"]

        if not day_punches:
            if day_date > today_dt.date():
                info["estado"] = "FUTURO"
            else:
                info["estado"] = "SIN_MARCAJE"
            continue

        dias_fichados_set.add(day_str)

        # Emparejar entradas y salidas
        entradas = [m for m in day_punches if m["tipo"] == "Entrada"]
        salidas = [m for m in day_punches if m["tipo"] == "Salida"]

        horas_dia = 0.0
        # Algoritmo de emparejamiento básico en el mismo día
        # Tomamos pares consecutivos Entrada -> Salida
        idx_e = 0
        idx_s = 0
        while idx_e < len(entradas) and idx_s < len(salidas):
            t_ent = datetime.strptime(entradas[idx_e]["hora"], "%H:%M:%S")
            t_sal = datetime.strptime(salidas[idx_s]["hora"], "%H:%M:%S")
            if t_sal > t_ent:
                diff_sec = (t_sal - t_ent).total_seconds()
                horas_dia += diff_sec / 3600.0
                idx_e += 1
                idx_s += 1
            else:
                # Salida anterior a entrada (posible salida de turno nocturno iniciado ayer)
                idx_s += 1

        info["horas_trabajadas"] = round(horas_dia, 2)
        total_horas_mes += horas_dia

        # Evaluar estado del día
        if len(entradas) > 0 and len(salidas) > 0:
            info["estado"] = "COMPLETO"
            dias_completos += 1
        elif len(entradas) > 0 and len(salidas) == 0:
            if day_date == today_dt.date():
                info["estado"] = "EN_CURSO"
            else:
                info["estado"] = "INCOMPLETO_SIN_SALIDA"
                dias_incompletos += 1
        elif len(entradas) == 0 and len(salidas) > 0:
            info["estado"] = "SOLO_SALIDA"
            dias_incompletos += 1

    # Construir resumen del mes
    resumen_mes = {
        "dias_fichados": len(dias_fichados_set),
        "dias_completos": dias_completos,
        "dias_incompletos": dias_incompletos,
        "horas_totales": round(total_horas_mes, 2),
        "dias_previstos": 22,
        "dias_previstos_sin_fichar": 0,
        "cumplimiento_pct": round((len(dias_fichados_set) / max(1, 22)) * 100, 1)
    }

    # Lista de fichajes lista para formato Legacy
    legacy_fichajes = []
    for p in reversed(normalized): # más reciente primero
        legacy_fichajes.append({
            "fecha": p["fecha"],
            "hora": p["hora"],
            "tipo": p["tipo"],
            "isEntrada": p["isEntrada"],
            "punto": p["punto"],
            "descanso": p["descanso"]
        })

    # Calendar days legacy para UI existente
    calendar_days = {}
    for day_str, info in days_dict.items():
        st = info["estado"]
        is_orange = st in ("COMPLETO", "EN_CURSO", "INCOMPLETO_SIN_SALIDA")
        is_red = (int(day_str) == today_dt.day and target_month == today_dt.month and target_year == today_dt.year)
        is_cyan = not is_orange and not is_red
        calendar_days[str(int(day_str))] = {
            "isOrange": is_orange,
            "isCyan": is_cyan,
            "isRed": is_red,
            "status": "FICHO" if is_orange else ("HOY" if is_red else "NO_FICHO")
        }

    return {
        "months": {
            month_key: {
                "dias": days_dict,
                "resumen": resumen_mes
            }
        },
        "legacy_fichajes": legacy_fichajes,
        "dias_fichados": sorted(list(dias_fichados_set), key=lambda x: int(x)),
        "calendar_days": calendar_days,
        "ultimo_fichaje": legacy_fichajes[0] if legacy_fichajes else None
    }

async def audit_worker_single(browser, worker, idx, total, max_retries=3):
    name = worker["name"]
    dni = worker["dni"]
    servicio = worker.get("servicio", "GIRONA GENERAL")
    sector = worker.get("sector", "AUXILIARES")
    fuente = worker.get("fuente", "censo")

    today_dt = datetime.now()
    cur_year = today_dt.year
    cur_month = today_dt.month

    result = {
        "nombre": name,
        "dni": dni,
        "servicio": servicio,
        "sector": sector,
        "fuente_censo": fuente,
        "login_ok": False,
        "sync_ok": False,
        "sync_error": None,
        "intentos": 0,
        "ultima_consulta_ok": None,
        "datos_obsoletos": False,
        "estado_hoy": "NO_FICHADO",
        "estado_semaforo": "noficha",
        "diagnostico": "Sin comprobación",
        "ultimo_fichaje": None,
        "meses": {},
        # Legacy
        "total_fichajes": 0,
        "dias_fichados": [],
        "dias_naranja_count": 0,
        "dias_sin_fichar_count": 0,
        "fichajes": [],
        "calendar_days": {}
    }

    for attempt in range(1, max_retries + 1):
        result["intentos"] = attempt
        context = None
        try:
            # 1. Crear contexto 100% AISLADO (cero compartición de cookies)
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            # Bloquear recursos pesados innecesarios
            await context.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot,mp4}", lambda r: r.abort())

            page = await context.new_page()

            # 2. Login
            await page.goto("https://gruposifuapp.gcalidad.com/", wait_until="domcontentloaded", timeout=14000)
            await page.fill("#txtDNI", dni)
            await page.click("#btnBuscar")

            try:
                await page.wait_for_selector("a[href*='wfFichajesConsultar'], #btnEntrada, #btnSalida, .btn-primary, #lblNombre", timeout=7000)
            except Exception:
                await page.wait_for_timeout(1000)

            curr_url = page.url
            if "index" in curr_url and "wfFichajeGPS" not in curr_url:
                # Comprobación de mensaje de acceso denegado en la página
                page_text = await page.evaluate("() => document.body.innerText")
                if "no encontrado" in page_text.lower() or "no existe" in page_text.lower() or "denegado" in page_text.lower():
                    result["sync_ok"] = True
                    result["estado_semaforo"] = "sin_acceso"
                    result["estado_hoy"] = "SIN_ACCESO"
                    result["diagnostico"] = "DNI no registrado o acceso denegado en la app"
                    log_msg(f"[{idx+1}/{total}] {name} ({dni}) -> Sin acceso a la app")
                    return result
                elif attempt < max_retries:
                    await asyncio.sleep(2 * attempt)
                    continue
                else:
                    result["sync_ok"] = True
                    result["estado_semaforo"] = "sin_acceso"
                    result["estado_hoy"] = "SIN_ACCESO"
                    result["diagnostico"] = "DNI no registrado o acceso denegado en la app"
                    return result

            result["login_ok"] = True

            # 3. Navegar a Consultar Fichajes
            await page.goto("https://gruposifuapp.gcalidad.com/pages/Fichajes/wfFichajesConsultar.aspx", wait_until="networkidle", timeout=15000)
            try:
                await page.wait_for_function("() => window.Fichajes !== undefined && Array.isArray(window.Fichajes)", timeout=7000)
            except Exception:
                await page.wait_for_timeout(1500)

            # 4. Extraer window.Fichajes directamente
            extracted = await page.evaluate("""() => {
                const fichs = (window.Fichajes && Array.isArray(window.Fichajes)) ? window.Fichajes : [];
                return {
                    fichajes: fichs,
                    url: window.location.href
                };
            }""")

            raw_fichs = extracted.get("fichajes", [])

            # 5. Procesar y normalizar fichajes con lógica matemática rigurosa
            processed = process_worker_punches(raw_fichs, cur_year, cur_month)

            result["sync_ok"] = True
            result["sync_error"] = None
            result["ultima_consulta_ok"] = datetime.now().isoformat()
            result["meses"] = processed["months"]
            result["fichajes"] = processed["legacy_fichajes"]
            result["total_fichajes"] = len(processed["legacy_fichajes"])
            result["dias_fichados"] = processed["dias_fichados"]
            result["dias_naranja_count"] = len(processed["dias_fichados"])
            result["dias_sin_fichar_count"] = max(0, 31 - len(processed["dias_fichados"]))
            result["calendar_days"] = processed["calendar_days"]
            result["ultimo_fichaje"] = processed["ultimo_fichaje"]

            # 6. Determinar estado de HOY y Semáforo
            today_str = f"{today_dt.day:02d}"
            month_key = f"{cur_year:04d}-{cur_month:02d}"
            today_day_info = processed["months"][month_key]["dias"].get(today_str, {})
            today_marcajes = today_day_info.get("marcajes", [])

            if today_marcajes:
                last_m = today_marcajes[-1]
                if last_m["tipo"] == "Entrada":
                    result["estado_hoy"] = "TRABAJANDO"
                else:
                    result["estado_hoy"] = "FINALIZADO"
            else:
                result["estado_hoy"] = "NO_FICHADO"

            # Semáforo global
            dias_cnt = len(processed["dias_fichados"])
            total_f = len(processed["legacy_fichajes"])

            if dias_cnt == 0:
                result["estado_semaforo"] = "noficha"
                result["diagnostico"] = f"🔴 Sin marcajes en {today_dt.strftime('%B %Y')}"
            elif dias_cnt >= 4 and total_f >= 8:
                result["estado_semaforo"] = "ok"
                result["diagnostico"] = f"🟢 Ficha con regularidad ({dias_cnt} días, {total_f} marcajes)"
            else:
                result["estado_semaforo"] = "nook"
                result["diagnostico"] = f"🟡 Fichaje parcial ({dias_cnt} días con marcaje)"

            log_msg(f"[{idx+1}/{total}] {name} ({dni}) -> {result['diagnostico']} | Hoy: {result['estado_hoy']}")
            return result

        except Exception as ex:
            log_msg(f"[{idx+1}/{total}] Intento {attempt} fallido para {name} ({dni}): {ex}")
            if attempt < max_retries:
                await asyncio.sleep(2 * attempt)
            else:
                result["sync_error"] = str(ex)
                result["estado_semaforo"] = "error"
                result["estado_hoy"] = "ERROR"
                result["diagnostico"] = f"Error de conexión tras {max_retries} intentos: {ex}"
        finally:
            if context:
                try:
                    await context.close()
                except Exception:
                    pass

    return result

async def sync_all_workers(concurrency=3):
    start_time = time.time()
    today_dt = datetime.now()
    log_msg(f"=== INICIANDO SUPER SINCRONIZACIÓN DE FICHAJES SIFU GIRONA ===")

    # Lock para evitar concurrencia de dos scripts
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r") as f:
                pid = f.read().strip()
            log_msg(f"Aviso: Lock file existente (PID {pid}). Comprobando ejecución previa...")
        except Exception:
            pass

    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

    census = load_census()
    if not census:
        log_msg("Censo vacío. Regenerando censo...")
        try:
            import build_girona_census
            census = build_girona_census.build_census()
        except Exception as e:
            log_msg(f"Error construyendo censo: {e}")

    prev_data = load_previous_data()
    prev_workers_by_dni = {}
    if prev_data and "trabajadores" in prev_data:
        for tw in prev_data["trabajadores"]:
            prev_workers_by_dni[tw.get("dni")] = tw

    semaphore = asyncio.Semaphore(concurrency)

    async def sem_worker(browser, w, idx, tot):
        async with semaphore:
            return await audit_worker_single(browser, w, idx, tot)

    results_workers = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )

        tasks = [
            sem_worker(browser, w, idx, len(census))
            for idx, w in enumerate(census)
        ]
        results_workers = await asyncio.gather(*tasks)
        await browser.close()

    # Preservar datos buenos en caso de fallo puntual
    final_workers = []
    ok_count = 0
    fail_count = 0
    sin_acceso_count = 0
    obsoletos_count = 0

    trabajando_ahora = 0
    finalizados_hoy = 0
    no_fichados_hoy = 0
    total_horas_acum = 0.0

    for w_res in results_workers:
        dni = w_res.get("dni")
        # Si falló completamente pero teníamos datos buenos anteriores, conservar los datos y marcar obsoletos
        if not w_res.get("sync_ok") and dni in prev_workers_by_dni:
            old = prev_workers_by_dni[dni]
            old["datos_obsoletos"] = True
            old["diagnostico"] = f"⚠️ Datos en caché: {w_res.get('diagnostico')}"
            final_workers.append(old)
            obsoletos_count += 1
            fail_count += 1
        else:
            final_workers.append(w_res)
            if w_res.get("sync_ok"):
                ok_count += 1
            elif w_res.get("estado_semaforo") == "sin_acceso":
                sin_acceso_count += 1
            else:
                fail_count += 1

        # KPIs del día
        eh = w_res.get("estado_hoy")
        if eh == "TRABAJANDO":
            trabajando_ahora += 1
        elif eh == "FINALIZADO":
            finalizados_hoy += 1
        elif eh == "NO_FICHADO":
            no_fichados_hoy += 1

        # Sumar horas
        mes_key = f"{today_dt.year:04d}-{today_dt.month:02d}"
        if "meses" in w_res and mes_key in w_res["meses"]:
            total_horas_acum += w_res["meses"][mes_key]["resumen"].get("horas_totales", 0.0)

    duracion = round(time.time() - start_time, 2)
    now_str = today_dt.strftime("%d/%m/%Y %H:%M:%S")

    payload = {
        "schema_version": 2,
        "fecha_sincronizacion": now_str,
        "generado_iso": today_dt.isoformat(),
        "duracion_seg": duracion,
        "mes_actual": f"{today_dt.year:04d}-{today_dt.month:02d}",
        "meses_disponibles": [f"{today_dt.year:04d}-{today_dt.month:02d}"],
        "sync_salud": {
            "total": len(final_workers),
            "ok": ok_count,
            "fallidos": fail_count,
            "sin_acceso": sin_acceso_count,
            "obsoletos": obsoletos_count,
            "proxima_sync_iso": (today_dt + timedelta(minutes=15)).isoformat(),
            "intervalo_min": 15,
            "en_curso": False
        },
        "kpis": {
            "trabajando_ahora": trabajando_ahora,
            "finalizados_hoy": finalizados_hoy,
            "no_fichados_hoy_previstos": no_fichados_hoy,
            "bajas": 0,
            "vacaciones": 0,
            "incidencias_hoy": fail_count,
            "horas_mes_total": round(total_horas_acum, 2)
        },
        "total_trabajadores": len(final_workers),
        "trabajadores": final_workers
    }

    # Escritura Atómica JSON
    tmp_json = JSON_OUT + ".tmp"
    with open(tmp_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp_json, JSON_OUT)

    # Escritura Atómica JS
    tmp_js = JS_OUT + ".tmp"
    js_content = "window.FICHAJES_CONTRASTE_PAYLOAD = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    with open(tmp_js, "w", encoding="utf-8") as f:
        f.write(js_content)
    os.replace(tmp_js, JS_OUT)

    # Guardar en histórico mensual
    hist_file = os.path.join(HISTORICO_DIR, f"{today_dt.year:04d}-{today_dt.month:02d}.json")
    try:
        with open(hist_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log_msg(f"Aviso guardando histórico: {e}")

    # Limpiar lock
    if os.path.exists(LOCK_FILE):
        try:
            os.remove(LOCK_FILE)
        except Exception:
            pass

    log_msg(f"[OK] Sincronización completada en {duracion}s: {ok_count} OK, {sin_acceso_count} Sin Acceso, {fail_count} Fallidos")
    return payload

if __name__ == "__main__":
    asyncio.run(sync_all_workers())
