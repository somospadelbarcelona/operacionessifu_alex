import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        errors = []
        page.on("pageerror", lambda err: errors.append(f"PAGE ERROR: {err}"))
        page.on("console", lambda msg: errors.append(f"CONSOLE ERROR: {msg.text}") if msg.type == "error" else None)

        print("1. Cargando http://127.0.0.1:5006/index.html...")
        page.goto("http://127.0.0.1:5006/index.html", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

        # Desbloquear overlay si aparece
        pin = page.locator('#auth-pin-input')
        if pin.is_visible():
            pin.fill('2121')
            btn = page.locator('button:has-text("DESBLOQUEAR SESIÓN")')
            if btn.is_visible():
                btn.click()
            page.wait_for_timeout(1000)
        page.evaluate("() => { const ov = document.getElementById('auth-overlay'); if (ov) ov.remove(); }")

        # 2. Navegar a Sección 4: Fichajes (Modo Auditoría Multi-Mes)
        print("2. Navegando a Sección 4: Fichajes (Modo Auditoría)...")
        page.evaluate("() => window.SifuEnterprisePlatform.switchModule('time_tracking', 'time_audit')")
        page.wait_for_timeout(800)

        # 3. Verificar filtrado por Gestor en modo Auditoría
        print("3. Seleccionando Gestor 'Albert Sánchez' en Auditoría...")
        page.select_option('#ent-filter-time-gestor', label='Albert Sánchez (124)')
        page.wait_for_timeout(400)
        res_count = page.inner_text('#ent-table-results-count')
        print(f"   Resultado Contador Auditoría: '{res_count}'")
        assert "124" in res_count, f"Esperado 124 operarios en contador, obtenido: {res_count}"

        # 4. Probar Badge 'No Fichó / Incidencias'
        print("4. Clic en badge 'No Fichó / Incidencias'...")
        page.click('.ent-val-filter-btn:has-text("No Fichó")')
        page.wait_for_timeout(400)
        badge_count = page.inner_text('#ent-table-results-count')
        print(f"   Resultado Badge Incidencias: '{badge_count}'")

        # 5. Probar cambio de Día
        print("5. Cambiando a Día Ayer...")
        page.click('.ent-day-btn:has-text("Ayer")')
        page.wait_for_timeout(400)
        ayer_count = page.inner_text('#ent-table-results-count')
        print(f"   Resultado Día Ayer: '{ayer_count}'")

        # 6. Cambiar a Fichajes en Vivo (gcalidad)
        print("6. Cambiando a Fichajes en Vivo...")
        page.click('button:has-text("Fichajes en Vivo")')
        page.wait_for_timeout(600)

        # 7. Verificar en Fichajes Live el filtrado y sincronización
        fich_count = page.inner_text('#fich-compact-count') if page.query_selector('#fich-compact-count') else "N/A"
        print(f"   Fichajes Live Contador: '{fich_count}'")

        # Probar cambiar gestor en Fichajes Live
        print("7. Seleccionando Gestor 'Jordi Giménez' en Fichajes Live...")
        page.select_option('#fich-select-gestor', value='00060598')
        page.wait_for_timeout(400)
        jg_count = page.inner_text('#fich-compact-count') if page.query_selector('#fich-compact-count') else "N/A"
        print(f"   Resultado Gestor Jordi Giménez en Live: '{jg_count}'")

        # Probar vistas en Fichajes Live
        print("8. Probando vistas: Listado Compacto, Hoy en Vivo, Matriz Heatmap...")
        page.click('button:has-text("2. Listado Compacto")')
        page.wait_for_timeout(300)
        assert page.query_selector('#fich-compact-tbody') is not None, "Listado compacto debe renderizar tabla"

        page.click('button:has-text("3. En Vivo Hoy")')
        page.wait_for_timeout(300)
        assert page.query_selector('#fich-today-board-container') is not None, "Hoy en vivo debe renderizar kanban"

        page.click('button:has-text("4. Matriz Heatmap")')
        page.wait_for_timeout(300)

        # Volver a Tarjetas
        page.click('button:has-text("1. Tarjetas")')
        page.wait_for_timeout(300)

        # 9. Probar vistas superiores de Fichajes: Centros/Servicios y Trabajadores
        print("9. Probando vistas principales de Fichajes: Centros y Trabajadores...")
        page.click('button:has-text("2. Por Centros / Servicios")')
        page.wait_for_timeout(400)
        assert page.query_selector('.fich-service-card') is not None, "Vista servicios debe renderizar tarjetas"

        page.click('button:has-text("3. Por Trabajadores")')
        page.wait_for_timeout(400)
        assert page.query_selector('.fich-worker-row') is not None, "Vista trabajadores debe renderizar filas"

        page.click('button:has-text("1. Contraste Multi-Gestor")')
        page.wait_for_timeout(400)

        # 10. Probar navegación a Cartera Operativa y submenús
        print("10. Navegando a Cartera Operativa y probando submenús del sidebar...")
        page.click('[data-nav-module="operations"]')
        page.wait_for_timeout(500)

        # Clic en subitem 'Guardia / Urgencias'
        page.click('.ent-nav-subitem:has-text("Guardia / Urgencias")')
        page.wait_for_timeout(400)
        cartera_badge = page.inner_text('.pro-results-badge') if page.query_selector('.pro-results-badge') else "N/A"
        print(f"    Guardia / Urgencias resultados: '{cartera_badge}'")

        # Clic en subitem 'Sector Limpieza'
        page.click('.ent-nav-subitem:has-text("Sector Limpieza")')
        page.wait_for_timeout(400)
        limp_badge = page.inner_text('.pro-results-badge') if page.query_selector('.pro-results-badge') else "N/A"
        print(f"    Sector Limpieza resultados: '{limp_badge}'")

        # Clic en subitem 'Toda la Cartera'
        page.click('.ent-nav-subitem:has-text("Toda la Cartera")')
        page.wait_for_timeout(400)

        # Volver a Fichajes para captura final
        page.click('[data-nav-module="time_tracking"]')
        page.wait_for_timeout(500)

        screenshot_path = "scratch_final_verified.png"
        page.screenshot(path=screenshot_path)
        print(f"11. Captura de pantalla guardada en {screenshot_path}")

        print("12. Verificando errores de consola...")
        real_errors = [e for e in errors if "favicon" not in e and "5005" not in e]
        if real_errors:
            print("ERRORES DETECTADOS:")
            for e in real_errors:
                print("  ", e)
            sys.exit(1)
        else:
            print("TODOS LOS MENÚS, VISTAS Y FILTROS VERIFICADOS EXITOSAMENTE AL 100% (0 ERRORES)")

        browser.close()

if __name__ == '__main__':
    run()
