# -*- coding: utf-8 -*-
"""
Sincronizador y Contrastador Masivo de Fichajes para Girona SIFU
Consulta https://gruposifuapp.gcalidad.com/ mediante el DNI de cada trabajador,
extrae el calendario mensual (días naranja, azul, rojo) y el detalle de marcajes (window.Fichajes).
Genera fichajes_contraste_girona.json y fichajes_contraste_data.js.
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from playwright.async_api import async_playwright

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_OUT = os.path.join(BASE_DIR, "fichajes_contraste_girona.json")
JS_OUT = os.path.join(BASE_DIR, "fichajes_contraste_data.js")

# Censo prioritario de trabajadores de Girona con su servicio y DNI
GIRONA_CENSUS = [
    # CASTILLO / MUSEO DE FIGUERES
    {"name": "CRISTIAN BRUNET MENDEZ", "dni": "41555814N", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "RAUL GONZALEZ EXPOSITO", "dni": "40448650E", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "MANUEL QUESADA AGUDO", "dni": "33893922H", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "NIL BAZAN SERES", "dni": "41557346A", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "MARIANO SEQUERA VACAS", "dni": "40440897C", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "JOSE MANUEL CARRERA MATEOS", "dni": "40445148Q", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "CARLOS MARTINEZ VILANOVA", "dni": "40429576S", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "DAVID CONTRERA VIDAL", "dni": "40463481H", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "ELIA MOGIO MEDINA", "dni": "41559878M", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "ASMA EL OUAHABI", "dni": "X1607463Q", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},
    {"name": "JOSE ANTONIO SOLA EXPOSITO", "dni": "41552135J", "servicio": "CASTILLO FIGUERES", "sector": "AUXILIARES"},

    # ALBERGUES
    {"name": "MOHAMED UAHLET", "dni": "X2911961T", "servicio": "ALBERGUE VALL D'EN BAS", "sector": "ALBERGUES"},
    {"name": "MOHAMMED ETTMALAH", "dni": "Y0238800M", "servicio": "ALBERGUES APOYO", "sector": "ALBERGUES"},
    {"name": "JOSE MANUEL GUTIERREZ PACHECO", "dni": "40434075Y", "servicio": "ALBERGUE OLOT", "sector": "ALBERGUES"},
    {"name": "PEDRO FERNANDEZ RIBAS", "dni": "46672564K", "servicio": "ALBERGUE OLOT", "sector": "ALBERGUES"},
    {"name": "FIDEL CASTILLO CANAL", "dni": "37381865B", "servicio": "ALBERGUE OLOT", "sector": "ALBERGUES"},
    {"name": "MONICA LOPEZ CEBALLOS", "dni": "90002499A", "servicio": "ALBERGUE DANADA", "sector": "ALBERGUES"},
    {"name": "SAHIL SINGH ARORA", "dni": "41645077N", "servicio": "ALBERGUE PLANOLES / NURIA", "sector": "ALBERGUES"},
    {"name": "JUAN BONADA GONZALEZ", "dni": "78022561Y", "servicio": "ALBERGUE PLANOLES / LA MOLINA / NURIA", "sector": "ALBERGUES"},
    {"name": "JOSE MONTERO RODRIGUEZ", "dni": "41077968Z", "servicio": "ALBERGUE LA MOLINA", "sector": "ALBERGUES"},
    {"name": "JORGE LUIS RAMIREZ SALAS", "dni": "45173415N", "servicio": "ALBERGUE NURIA (BAJA)", "sector": "ALBERGUES"},
    {"name": "JOSE LUIS HERNANDEZ TORRES", "dni": "43633809A", "servicio": "ALBERGUE NURIA", "sector": "ALBERGUES"},
    {"name": "ERNESTO MALO HERRERO", "dni": "46601633E", "servicio": "AGENCIA CATALANA JOVENTUT", "sector": "ALBERGUES"},

    # DIPSALUT / GENERALITAT / LIMPIEZA
    {"name": "JOSUE RAMON CASTILLO MOLINA", "dni": "60439306K", "servicio": "DIPSALUT", "sector": "LIMPIEZA"},
    {"name": "LIDIA JORDA I MARQUEZ", "dni": "41666221L", "servicio": "DIPSALUT", "sector": "LIMPIEZA"},
    {"name": "MERCE PLANAS HERAS", "dni": "40370819T", "servicio": "DIPSALUT", "sector": "LIMPIEZA"},
    {"name": "IRENE MASSANET MASPOCH", "dni": "40339963X", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},
    {"name": "JOSEP MADI ARIZA", "dni": "41630393W", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},
    {"name": "JUAN JOSE GARCIA MANZANEQUE", "dni": "41652517T", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},
    {"name": "JULIAN CANO GALLEGO", "dni": "77731473Y", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},
    {"name": "LAMYAA RAJEB", "dni": "Y1673434Z", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},
    {"name": "MALIKA CHRIF", "dni": "Y6050514X", "servicio": "GENERALITAT DE CATALUNYA", "sector": "LIMPIEZA"},

    # JARDINERIA Y ESPECIALISTAS
    {"name": "ABDELKADER BEN MOUSSA", "dni": "X1368710A", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "ANGEL SANCHEZ PEREZ", "dni": "40437050Z", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "ANTONIO OSORIO VACA", "dni": "40345869M", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "DAVID CIFUENTES BOSCH", "dni": "40437178G", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "DAVID SALVADOR VILANOVA", "dni": "40441302B", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "GERARD ESPINAS DEL FRESNO", "dni": "41559902Y", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "JAVIER FELIU LOPEZ", "dni": "23274238D", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "JORDI MARTI BARTIS", "dni": "41551869T", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "MARIO BELLAPART MARTI", "dni": "40433702R", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "PEDRO ALDAMIZ ECHEVARRIA GARCIA", "dni": "40443871G", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},
    {"name": "ROMAN SIMO CASTELLS", "dni": "77606815P", "servicio": "JARDINERIA FIGUERES L1", "sector": "JARDINERIA"},

    # CASINO / PLAYA DE ARO / VARIOS
    {"name": "ALEXIA DOMINGUEZ MARSINACH", "dni": "36530075A", "servicio": "GRAN CASINO COSTA BRAVA", "sector": "LIMPIEZA"},
    {"name": "CARLA MASSANELLAS SAURA", "dni": "41547833N", "servicio": "GRAN CASINO COSTA BRAVA", "sector": "LIMPIEZA"},
    {"name": "GERARD SANCHEZ MORALES", "dni": "41649411E", "servicio": "CASTELL-PLATJA D'ARO", "sector": "LIMPIEZA"},
    {"name": "JOEL RUIZ DOBLADO", "dni": "53866302A", "servicio": "CASTELL-PLATJA D'ARO", "sector": "LIMPIEZA"},
    {"name": "JOSE ANTONIO LOPEZ SANCHEZ", "dni": "40526372G", "servicio": "CASTELL-PLATJA D'ARO", "sector": "LIMPIEZA"},
    {"name": "MANOUEL OUSSAMA LEON BOUAA", "dni": "41531049H", "servicio": "CASTELL-PLATJA D'ARO", "sector": "LIMPIEZA"},
    {"name": "CARMEN ALSINA MENA", "dni": "40526778L", "servicio": "FCC AQUALIA", "sector": "LIMPIEZA"},
    {"name": "MARIA MOLINA PEREZ", "dni": "40305698S", "servicio": "ENDESA GIRONA", "sector": "LIMPIEZA"},
    {"name": "MONICA GALA SEGURA", "dni": "45540124D", "servicio": "ACSA OBRAS", "sector": "LIMPIEZA"},
    {"name": "NADIA IULIANA GOAGA SUCEVEANU", "dni": "42364240B", "servicio": "WURTH ESPANA", "sector": "LIMPIEZA"},
    {"name": "NATALIA HRABAN", "dni": "Z1320496W", "servicio": "PLATJA D'ARO SO FOOD", "sector": "LIMPIEZA"},
    {"name": "SARAI PONCE MORENO", "dni": "47795423C", "servicio": "CENTRALS I INFRAESTRUCTURES", "sector": "LIMPIEZA"},
    {"name": "LAURA PARDILLO LOPEZ", "dni": "40352745G", "servicio": "ASCENSORS GIRONA", "sector": "LIMPIEZA"}
]

async def audit_worker(context, w, semaphore, idx, total):
    async with semaphore:
        name = w["name"]
        dni = w["dni"]
        servicio = w["servicio"]
        sector = w["sector"]

        w_data = {
            "nombre": name,
            "dni": dni,
            "servicio": servicio,
            "sector": sector,
            "login_ok": False,
            "total_fichajes": 0,
            "dias_fichados": [],
            "dias_naranja_count": 0,
            "dias_sin_fichar_count": 0,
            "estado_semaforo": "noficha", # 'ok' | 'nook' | 'noficha'
            "fichajes": [],
            "calendar_days": {},
            "ultimo_fichaje": None,
            "diagnostico": "Sin comprobacion"
        }

        page = await context.new_page()
        try:
            # 1. Login rápido
            await page.goto("https://gruposifuapp.gcalidad.com/", wait_until="domcontentloaded", timeout=12000)
            await page.fill("#txtDNI", dni)
            await page.click("#btnBuscar")

            try:
                await page.wait_for_url(lambda u: "wfFichajeGPS" in u or "index" in u, timeout=4000)
            except Exception:
                await page.wait_for_timeout(800)

            curr_url = page.url
            if "wfFichajeGPS" not in curr_url and "index" in curr_url:
                w_data["diagnostico"] = "DNI no registrado o acceso denegado en la app"
                w_data["estado_semaforo"] = "noficha"
                print(f"[{idx+1}/{total}] {name} ({dni}) -> Acceso denegado / No registrado")
                return w_data

            w_data["login_ok"] = True

            # 2. Consultar Fichajes
            await page.goto("https://gruposifuapp.gcalidad.com/pages/Fichajes/wfFichajesConsultar.aspx", wait_until="domcontentloaded", timeout=12000)
            try:
                await page.wait_for_selector("td.day, #form1", timeout=3500)
            except Exception:
                await page.wait_for_timeout(800)

            # 3. Extraer Fichajes y Dias
            extracted = await page.evaluate("""() => {
                const fichs = (window.Fichajes && Array.isArray(window.Fichajes)) ? window.Fichajes : [];
                const daysMap = {};
                
                document.querySelectorAll('td.day').forEach(td => {
                    const dayNum = td.innerText ? td.innerText.trim() : '';
                    if (dayNum) {
                        const style = window.getComputedStyle(td);
                        const bg = style.backgroundColor;
                        const isOrange = bg.includes('255, 133') || bg.includes('255, 140') || bg.includes('orange');
                        const isCyan = bg.includes('44, 168, 194') || bg.includes('cyan');
                        const isRed = bg.includes('221, 75, 57') || bg.includes('255, 65, 54') || bg.includes('red');
                        daysMap[dayNum] = {
                            isOrange: isOrange,
                            isCyan: isCyan,
                            isRed: isRed,
                            status: isOrange ? 'FICHO' : (isRed ? 'HOY' : 'NO_FICHO')
                        };
                    }
                });

                return {
                    fichajes: fichs,
                    days: daysMap
                };
            }""")

            raw_fichs = extracted.get("fichajes", [])
            days_map = extracted.get("days", {})

            normalized_fichs = []
            for fc in raw_fichs:
                fechr = fc.get("FECHR", "")
                fecha = fechr.split()[0] if fechr else ""
                hora = fechr.split()[1] if len(fechr.split()) > 1 else ""
                is_entrada = bool(fc.get("ENTR"))
                punto = fc.get("PUNTO", "") or ""
                
                normalized_fichs.append({
                    "fecha": fecha,
                    "hora": hora,
                    "tipo": "Entrada" if is_entrada else "Salida",
                    "isEntrada": is_entrada,
                    "punto": punto,
                    "descanso": bool(fc.get("DESCA"))
                })

            orange_days = [d for d, inf in days_map.items() if inf.get("status") == "FICHO"]
            cyan_days = [d for d, inf in days_map.items() if inf.get("status") == "NO_FICHO"]

            w_data["fichajes"] = normalized_fichs
            w_data["total_fichajes"] = len(normalized_fichs)
            w_data["dias_fichados"] = sorted(orange_days, key=lambda x: int(x))
            w_data["dias_naranja_count"] = len(orange_days)
            w_data["dias_sin_fichar_count"] = len(cyan_days)
            w_data["calendar_days"] = days_map

            if normalized_fichs:
                w_data["ultimo_fichaje"] = normalized_fichs[0]

            # Evaluacion del semaforo
            if len(orange_days) == 0:
                w_data["estado_semaforo"] = "noficha"
                w_data["diagnostico"] = "🔴 NO FICHA EN LA APP (0 marcajes en Octubre)"
            elif len(orange_days) >= 4 and len(normalized_fichs) >= 8:
                w_data["estado_semaforo"] = "ok"
                w_data["diagnostico"] = f"🟢 Ficha con regularidad ({len(orange_days)} dias activos, {len(normalized_fichs)} marcajes)"
            else:
                w_data["estado_semaforo"] = "nook"
                w_data["diagnostico"] = f"🟡 Fichaje parcial / Desfase ({len(orange_days)} dias con marcaje)"

            print(f"[{idx+1}/{total}] {name} ({dni}) -> {w_data['diagnostico']}")

        except Exception as ex:
            w_data["diagnostico"] = f"Error en consulta: {ex}"
            print(f"[{idx+1}/{total}] {name} ({dni}) -> Excepcion: {ex}")
        finally:
            await page.close()

        return w_data

async def sync_all_workers(concurrency=5):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando auditoria masiva de {len(GIRONA_CENSUS)} trabajadores con {concurrency} workers concurrentes...")
    results = {
        "fecha_sincronizacion": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "total_trabajadores": len(GIRONA_CENSUS),
        "trabajadores": []
    }

    semaphore = asyncio.Semaphore(concurrency)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        # Bloqueo de imagenes, medios y fuentes para hipervelocidad
        await context.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot,mp4}", lambda route: route.abort())

        tasks = [
            audit_worker(context, w, semaphore, idx, len(GIRONA_CENSUS))
            for idx, w in enumerate(GIRONA_CENSUS)
        ]
        worker_results = await asyncio.gather(*tasks)
        results["trabajadores"] = list(worker_results)
        await browser.close()

    # Guardar JSON
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] Guardado JSON en {JSON_OUT}")

    # Guardar JS para consumo directo
    js_content = "window.FICHAJES_CONTRASTE_PAYLOAD = " + json.dumps(results, ensure_ascii=False) + ";\n"
    with open(JS_OUT, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"[OK] Guardado JS en {JS_OUT}")
    return results

if __name__ == "__main__":
    asyncio.run(sync_all_workers())
