import sys
sys.stdout.reconfigure(encoding='utf-8')
import asyncio
from playwright.async_api import async_playwright

async def check_titles():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1400, 'height': 900})
        await page.goto('http://127.0.0.1:5006/index.html')
        await page.wait_for_timeout(1000)
        pin_input = page.locator('#auth-pin-input')
        if await pin_input.is_visible():
            await pin_input.fill('2121')
            await page.click("button:has-text('DESBLOQUEAR SESIÓN')")
            await page.wait_for_timeout(1000)
        texts = await page.evaluate("""() => {
            const el = document.querySelector('.ent-brand-title');
            const pro = document.querySelector('.pro-brand-title');
            const h = document.querySelector('header');
            return {
                entBrand: el ? el.innerText : null,
                proBrand: pro ? pro.innerText : null,
                headerText: h ? h.innerText : null,
                visibleId: document.getElementById('sifu-enterprise-root')?.offsetParent !== null ? 'enterprise' : 'other',
                gironaVisible: document.getElementById('girona-pro-root')?.offsetHeight > 0
            };
        }""")
        print("RESULT:", texts)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_titles())
