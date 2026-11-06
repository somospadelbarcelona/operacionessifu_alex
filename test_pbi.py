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

    # Initial email
    inp = page.locator('input[type="email"], input[placeholder*="email" i], input#email').first
    if inp.count() > 0:
        inp.fill(user)
        submit_btn = page.locator('button:has-text("Submit"), input[type="submit"], button.submit, button[type="submit"]').first
        if submit_btn.count() > 0:
            submit_btn.click()
        else:
            page.keyboard.press("Enter")

    page.wait_for_timeout(5000)

    # Check for "Use your password instead" or "Other ways to sign in"
    try:
        # Print all text/links on page
        links = page.locator('a, button').all_inner_texts()
        print("Available links/buttons on MS page:", links)
        
        switch_pwd = page.locator('a#idA_PWD_SwitchToPassword, a:has-text("password"), a:has-text("contraseña"), a:has-text("Other ways"), a:has-text("Otras formas"), #otherOptions').first
        if switch_pwd.is_visible(timeout=5000):
            print("Found switch to password / options:", switch_pwd.inner_text())
            switch_pwd.click()
            page.wait_for_timeout(3000)
            page.screenshot(path='powerbi_options.png')
            # Look for password option
            pwd_opt = page.locator('div:has-text("Use your password"), div:has-text("Usar mi contraseña"), div:has-text("Contraseña")').first
            if pwd_opt.is_visible(timeout=5000):
                pwd_opt.click()
                page.wait_for_timeout(3000)
    except Exception as e:
        print("Switch to pwd error:", e)

    page.screenshot(path='powerbi_step3_updated.png')

    # Password input
    try:
        pwd_box = page.locator('input[name="passwd"], input[type="password"]').first
        pwd_box.wait_for(state="visible", timeout=10000)
        print("Filling password...")
        pwd_box.fill(pwd)
        page.locator('input[type="submit"], button[type="submit"], input#idSIButton9').first.click()
        page.wait_for_timeout(5000)
    except Exception as e:
        print("MS password fill error:", e)

    page.screenshot(path='powerbi_step4_after_pwd.png')

    # Stay signed in prompt or MFA prompt
    try:
        stay_btn = page.locator('input#idSIButton9, button#idSIButton9, input[value="Yes"], button:has-text("Yes"), input[value="Sí"], button:has-text("Sí")').first
        if stay_btn.is_visible(timeout=7000):
            print("Clicking stay signed in...")
            stay_btn.click()
            page.wait_for_timeout(5000)
    except Exception as e:
        print("Stay signed in check:", e)

    page.screenshot(path='powerbi_step5_report.png')
    page.wait_for_timeout(15000)
    page.screenshot(path='powerbi_step6_final.png')
    print("Final URL:", page.url)
    print("Final title:", page.title())

    browser.close()
