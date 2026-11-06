import asyncio
from playwright.async_api import async_playwright

async def screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        await page.goto('http://127.0.0.1:5006/index.html')
        await page.wait_for_timeout(1000)
        pin_input = page.locator('#auth-pin-input')
        if await pin_input.is_visible():
            await pin_input.fill('2121')
            await page.click("button:has-text('DESBLOQUEAR SESIÓN')")
            await page.wait_for_timeout(1500)
        await page.screenshot(path='scratch/nuevo_diseno_verificado.png', full_page=False)
        print('SCREENSHOT_OK')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(screenshot())
