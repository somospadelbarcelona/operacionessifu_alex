import asyncio
import os
from playwright.async_api import async_playwright

async def generate_pdf():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(base_dir, 'generar_resumen_tecnico.html')
    pdf_path = os.path.join(base_dir, 'Resumen_Tecnico_App_Girona.pdf')
    
    print(f"Cargando {html_path}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"file:///{html_path.replace(os.sep, '/')}", wait_until="networkidle")
        await page.pdf(
            path=pdf_path,
            format='A4',
            print_background=True,
            margin={'top': '10mm', 'bottom': '10mm', 'left': '12mm', 'right': '12mm'}
        )
        await browser.close()
    print(f"PDF generado con éxito en: {pdf_path}")

if __name__ == '__main__':
    asyncio.run(generate_pdf())
