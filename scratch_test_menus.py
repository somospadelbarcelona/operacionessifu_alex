import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        
        errors = []
        logs = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.on('console', lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

        try:
            await page.goto('http://127.0.0.1:5006/index.html', wait_until='domcontentloaded', timeout=10000)
        except Exception as ex:
            print("Goto error:", ex)
        await page.wait_for_timeout(2000)

        # Check PIN
        pin = page.locator('#auth-pin-input')
        if await pin.is_visible():
            await pin.fill('2121')
            btn = page.locator('button:has-text("DESBLOQUEAR SESIÓN")')
            if await btn.is_visible():
                await btn.click()
            await page.wait_for_timeout(1000)

        print(f"Errors count: {len(errors)}")
        for e in errors[:5]:
            print(f"Error: {e}")

        # Check Enterprise platform container
        ent_root = page.locator('#sifu-enterprise-root')
        print(f"Enterprise root visible: {await ent_root.is_visible()}")

        # Check active module
        active_mod = await page.evaluate("() => window.SifuEnterprisePlatform ? window.SifuEnterprisePlatform.getActiveModule() : 'none'")
        print(f"Active module: {active_mod}")

        # Now test clicking the menu items!
        # Test 1: Click 4. Fichajes in header or sidebar
        print("\n--- Testing Navigation to Module 4: Time Tracking ---")
        await page.evaluate("() => window.SifuEnterprisePlatform.switchModule('time_tracking')")
        await page.wait_for_timeout(1000)

        # Check results in Section 4
        table_count = await page.evaluate("""() => {
            const el = document.getElementById('ent-table-results-count');
            return el ? el.textContent.trim() : 'no count element';
        }""")
        print(f"Initial Time Tracking Results: {table_count}")

        # Test 2: Select Gestor Albert Sánchez
        print("\n--- Testing Filter Gestor: Albert Sánchez ---")
        await page.evaluate("""() => {
            const sel = document.getElementById('ent-filter-time-gestor');
            if (sel) {
                sel.value = 'Albert Sánchez';
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }""")
        await page.wait_for_timeout(1000)
        
        count_albert = await page.evaluate("""() => {
            const el = document.getElementById('ent-table-results-count');
            return el ? el.textContent.trim() : 'no count element';
        }""")
        print(f"Results after Albert Sanchez: {count_albert}")

        # Check badge texts
        badges = await page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('.ent-val-filter-btn'));
            return btns.map(b => b.textContent.replace(/\\s+/g, ' ').trim());
        }""")
        print(f"Validation Badges: {badges}")

        # Test 3: Click 'No Fichó / Incidencias' badge
        print("\n--- Testing Badge Filter: No Fichó / Incidencias ---")
        await page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('.ent-val-filter-btn'));
            const issueBtn = btns.find(b => b.textContent.includes('No Fichó') || b.textContent.includes('Incidencias'));
            if (issueBtn) issueBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        count_issue = await page.evaluate("""() => {
            const el = document.getElementById('ent-table-results-count');
            const rows = document.querySelectorAll('#ent-time-table-body tr').length;
            return { label: el ? el.textContent.trim() : '', rows };
        }""")
        print(f"Results after Issue Filter: {count_issue}")

        # Test 4: Switch to Fichajes Live subtab
        print("\n--- Testing Switch to Fichajes en Vivo (gcalidad) ---")
        await page.evaluate("() => window.SifuEnterprisePlatform.switchModule('time_tracking', 'fichajes_live')")
        await page.wait_for_timeout(1500)

        live_container = await page.evaluate("""() => {
            const c = document.getElementById('ent-fichajes-live-container');
            return c ? { exists: true, innerLen: c.innerHTML.length, hasCards: !!c.querySelector('.pro-kpi-card, .fich-card, .pro-table') } : { exists: false };
        }""")
        print(f"Fichajes Live Container: {live_container}")

        # Capture final screenshot
        await page.screenshot(path='scratch_screen_test.png')
        print("Captured scratch_screen_test.png")

        await browser.close()

asyncio.run(run())
