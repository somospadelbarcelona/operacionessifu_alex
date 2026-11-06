import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        
        errors = []
        page.on("pageerror", lambda err: errors.append(f"PAGE_ERROR: {err}"))
        page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}") if msg.type in ['error', 'warn'] else None)
        
        await page.goto("http://127.0.0.1:5006/index.html")
        await page.wait_for_timeout(1000)
        
        # Desbloquear PIN si aparece
        pin_input = page.locator("#auth-pin-input")
        if await pin_input.is_visible():
            await pin_input.fill("2121")
            await page.click("button:has-text('DESBLOQUEAR SESIÓN')")
            await page.wait_for_timeout(1000)
            
        await page.wait_for_timeout(1500)
        
        # Comprobar qué elementos existen y si están visibles
        info = await page.evaluate("""() => {
            const entRoot = document.getElementById('sifu-enterprise-root');
            const gironaRoot = document.getElementById('girona-pro-root');
            return {
                entRootExists: !!entRoot,
                entRootDisplay: entRoot ? window.getComputedStyle(entRoot).display : null,
                entRootHtmlLen: entRoot ? entRoot.innerHTML.length : 0,
                gironaRootExists: !!gironaRoot,
                gironaRootDisplay: gironaRoot ? window.getComputedStyle(gironaRoot).display : null,
                gironaRootHtmlLen: gironaRoot ? gironaRoot.innerHTML.length : 0,
                isEnterpriseActive: !!(window.SifuEnterprisePlatform && window.SifuEnterprisePlatform.isEnterpriseActive),
                hasErrors: window.hasErrors || false
            };
        }""")
        print("DOM_INFO:", info)
        print("PAGE_ERRORS:", errors)
        
        await page.screenshot(path="scratch_view_check.png", full_page=True)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
