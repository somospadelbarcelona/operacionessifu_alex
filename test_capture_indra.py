import asyncio
import os
import subprocess
import time
from playwright.async_api import async_playwright

async def capture():
    server = subprocess.Popen(["python", "-m", "http.server", "8899"], cwd=os.getcwd())
    time.sleep(1)
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1400, "height": 900})
            
            await page.goto("http://127.0.0.1:8899/index.html")
            await page.wait_for_timeout(1500)
            
            # Desbloquear PIN
            try:
                pin_input = page.locator("#auth-pin-input")
                if await pin_input.is_visible():
                    await pin_input.fill("2121")
                    await page.click("button:has-text('DESBLOQUEAR SESIÓN')")
                    await page.wait_for_timeout(1000)
            except Exception as e:
                pass
            
            # Cambiar a la pestaña de Indra
            await page.evaluate("""
                () => {
                    if (window.AppState) {
                        window.AppState.activeTab = 'indra';
                        window.renderAppShell();
                    }
                }
            """)
            await page.wait_for_timeout(2000)
            
            screenshot_path = "capture_indra_debug.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            print("SCREENSHOT_SUCCESS")
            
            await browser.close()
    finally:
        server.terminate()

if __name__ == "__main__":
    asyncio.run(capture())
