# -*- coding: utf-8 -*-
"""
FICHAJES SYNC - Extractor y Sincronizador en Tiempo Real de Fichajes SIFU GIRONA
Conecta con https://gruposifu.gcalidad.com/# mediante credenciales seguras,
consulta el portal de Control de Presencia Transversal y descarga todos los
registros de fichajes del mes activo (Octubre 2026), exportando a JSON y JS.
"""

import asyncio
import os
import sys
import json
from datetime import datetime
from playwright.async_api import async_playwright

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_OUTPUT = os.path.join(BASE_DIR, "fichajes_girona.json")
JS_OUTPUT = os.path.join(BASE_DIR, "fichajes_data.js")

async def extraer_fichajes(fecha_desde="01/10/2026", fecha_hasta="31/10/2026", gerencia_id="1358", delegacion_id="1623"):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando extracción de fichajes ({fecha_desde} - {fecha_hasta})...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1366, 'height': 850})
        page = await context.new_page()
        
        try:
            # 1. Login
            print("1. Conectando con gruposifu.gcalidad.com...")
            await page.goto("https://gruposifu.gcalidad.com/#", wait_until="networkidle", timeout=30000)
            await page.wait_for_selector("#txtLogin", state="visible", timeout=15000)
            await page.fill("#txtLogin", "46468278K")
            await page.fill("#txtPassword", "Jaraba99!")
            await page.click("#btnAceptarLogin")
            
            # 2. Selección de Empresa
            print("2. Seleccionando 'GRUPO SIFU OPERATIVA'...")
            operativa_elem = await page.wait_for_selector("text=GRUPO SIFU OPERATIVA", timeout=15000)
            await operativa_elem.click()
            await page.wait_for_timeout(2500)
            
            # 3. Navegar a Control de Presencia
            print("3. Accediendo a Control de Presencia Transversal...")
            await page.goto("https://gruposifu.gcalidad.com/pages/presencia/wfControlPresenciaTransversalListado.aspx", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            
            # 4. Ejecutar consulta AJAX con parámetros exactos
            print(f"4. Consultando fichajes Delegación Girona ({delegacion_id}) para periodo {fecha_desde} a {fecha_hasta}...")
            resultado = await page.evaluate(f"""() => {{
                return new Promise((resolve) => {{
                    $("#hidOperacion").val("LIST");
                    $("#hidDesde").val("{fecha_desde}");
                    $("#hidHasta").val("{fecha_hasta}");
                    $("#ddlGerencias").val(["{gerencia_id}"]);
                    $("#ddlDelegaciones").val(["{delegacion_id}"]);
                    
                    const formData = $('#form1').serialize();
                    
                    $.ajax({{
                        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
                        type: 'POST',
                        data: formData,
                        url: "/pages/presencia/wfControlPresenciaTransversalAJAX.aspx",
                        dataType: "html",
                        timeout: 45000,
                        success: function (data) {{
                            try {{
                                const obj = JSON.parse(data);
                                resolve({{ ok: true, data: obj }});
                            }} catch(e) {{
                                resolve({{ ok: false, error: 'JSON parse error: ' + e.message, raw: data.substring(0, 500) }});
                            }}
                        }},
                        error: function(xhr, status, err) {{
                            resolve({{ ok: false, error: 'AJAX error: ' + status }});
                        }}
                    }});
                }});
            }}""")
            
            await browser.close()
            
            if not resultado.get("ok"):
                raise RuntimeError(resultado.get("error", "Error desconocido en AJAX"))
                
            obj = resultado["data"]
            if obj.get("Resultado") != "OK":
                raise RuntimeError(f"Respuesta del servidor no OK: {obj.get('Mensaje')}")
                
            listado = obj.get("Listado", [])
            print(f"✅ ¡Extraídos con éxito {len(listado)} fichajes reales!")
            
            # Guardar JSON
            payload = {
                "fecha_sincronizacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "periodo": {
                    "desde": fecha_desde,
                    "hasta": fecha_hasta
                },
                "delegacion": "SIFU - SIFU GIRONA",
                "gerencia": "SIFU",
                "total_registros": len(listado),
                "fichajes": listado
            }
            
            with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            print(f"📁 Guardado en {JSON_OUTPUT}")
            
            # Guardar JS para el navegador
            js_content = f"""// Base de datos de Control de Presencia y Fichajes - SIFU GIRONA
// Sincronizado automáticamente desde https://gruposifu.gcalidad.com
window.FICHAJES_RAW_PAYLOAD = {json.dumps(payload, ensure_ascii=False, indent=2)};
"""
            with open(JS_OUTPUT, "w", encoding="utf-8") as f:
                f.write(js_content)
            print(f"📁 Guardado en {JS_OUTPUT}")
            
            return payload

        except Exception as e:
            print(f"❌ Error durante la extracción: {e}")
            await browser.close()
            raise

def sync_cli():
    asyncio.run(extraer_fichajes())

if __name__ == "__main__":
    sync_cli()
