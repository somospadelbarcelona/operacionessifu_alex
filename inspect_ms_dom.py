import time
from playwright.sync_api import sync_playwright

url = 'https://app.powerbi.com/groups/me/reports/bc4f17b6-0ede-468e-9738-51a8654b7a0e/ReportSection96a133ff3a7bc4163373?experience=power-bi'
user = 'OperacionesSIFUGirona@gruposifu.onmicrosoft.com'
pwd = 'D/589468554340ag'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1600, 'height': 900})
    page = context.new_page()
    page.goto(url, timeout=60000)
    page.wait_for_timeout(3000)

    inp = page.locator('input[type="email"], input[placeholder*="email" i], input#email').first
    inp.fill(user)
    page.keyboard.press("Enter")
    page.wait_for_timeout(4000)

    print("--- DOM Inspection on MS Page ---")
    elements = page.eval_on_selector_all('button, a, input, [role="button"]', 
        '''els => els.map(e => ({
            tag: e.tagName, 
            id: e.id, 
            className: e.className, 
            text: e.innerText, 
            type: e.type,
            href: e.href,
            ariaLabel: e.getAttribute("aria-label")
        }))'''
    )
    for el in elements:
        print(el)

    # Let's also check if clicking the back arrow (usually id=idBtn_Back or [aria-label*="Back"]) goes to "Choose a way to sign in"
    back_btn = page.locator('#idBtn_Back, button[aria-label*="Back"], button[aria-label*="Atrás"], #navigation').first
    if back_btn.is_visible(timeout=2000):
        print("Back button visible! Clicking back...")
        back_btn.click()
        page.wait_for_timeout(2000)
        page.screenshot(path='ms_after_back.png')
        opts = page.eval_on_selector_all('div, button, a', 'els => els.filter(e => e.innerText && e.innerText.includes("password")).map(e => ({id: e.id, text: e.innerText, tag: e.tagName}))')
        print("Password elements after back:", opts)

    browser.close()
