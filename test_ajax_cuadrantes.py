# -*- coding: utf-8 -*-
import asyncio
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

async def inspect():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://gruposifuapp.gcalidad.com/')
        await page.fill('#txtDNI', 'Z0239717Q')
        await page.click('#btnBuscar')
        await page.wait_for_timeout(2500)
        await page.goto('https://gruposifuapp.gcalidad.com/pages/Cuadrantes/wfCuadrantesConsultar.aspx', wait_until='networkidle')
        
        # Esperar a que termine la llamada AJAX
        await page.wait_for_function("() => window.Cuadrantes && window.Cuadrantes.length > 0", timeout=10000)
        
        data = await page.evaluate('''() => {
            return {
                Cuadrantes: window.Cuadrantes,
                Calendario: window.Calendario,
                Turno: window.Turno,
                CentroTrabajo: window.CentroTrabajo
            };
        }''')
        
        print("AJAX EXITOSO!")
        print("Total Cuadrantes:", len(data['Cuadrantes']))
        print("Total Calendario:", len(data['Calendario']))
        print("Sample Cuadrante 0:", json.dumps(data['Cuadrantes'][0] if data['Cuadrantes'] else {}, indent=2))
        print("Sample Calendario 0:", json.dumps(data['Calendario'][0] if data['Calendario'] else {}, indent=2))

        await browser.close()

asyncio.run(inspect())
