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
    page.wait_for_timeout(4000)

    # 1. Fill email
    inp = page.locator('input[type="email"], input[placeholder*="email" i], input#email').first
    if inp.is_visible(timeout=5000):
        print("Filling initial email...")
        inp.fill(user)
        btn = page.locator('button:has-text("Submit"), input[type="submit"], button[type="submit"]').first
        if btn.is_visible(timeout=3000):
            btn.click()
        else:
            page.keyboard.press("Enter")
        page.wait_for_timeout(5000)

    page.screenshot(path='ms_step1.png')

    # 2. Check if we are on MS login
    print("Page URL:", page.url)
    
    # If there's an email prompt on login.microsoftonline.com
    ms_email = page.locator('input[type="email"], input[name="loginfmt"]').first
    if ms_email.is_visible(timeout=3000):
        print("MS email visible, filling...")
        ms_email.fill(user)
        page.locator('#idSIButton9, input[type="submit"]').first.click()
        page.wait_for_timeout(4000)

    page.screenshot(path='ms_step2.png')

    # Look for "Use my password"
    # Find all elements with text "password" or "contraseña"
    print("Searching for password option...")
    # Try clicking text 'Use my password'
    try:
        opt = page.get_by_text("Use my password", exact=False).first
        if opt.is_visible(timeout=5000):
            print("Found 'Use my password' text, clicking!")
            opt.click()
            page.wait_for_timeout(4000)
        else:
            # Maybe Spanish?
            opt_es = page.get_by_text("contraseña", exact=False).first
            if opt_es.is_visible(timeout=3000):
                print("Found 'contraseña' text, clicking!")
                opt_es.click()
                page.wait_for_timeout(4000)
    except Exception as e:
        print("Error clicking password option:", e)

    page.screenshot(path='ms_step3_after_opt.png')

    # 3. Enter password
    try:
        pwd_box = page.locator('input[name="passwd"], input[type="password"]').first
        pwd_box.wait_for(state="visible", timeout=10000)
        print("Entering password...")
        pwd_box.fill(pwd)
        page.wait_for_timeout(1000)
        page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first.click()
        page.wait_for_timeout(5000)
    except Exception as e:
        print("Error entering password:", e)

    page.screenshot(path='ms_step4_after_pwd.png')

    # 4. Check for 'Stay signed in' or MFA
    try:
        stay = page.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes"), input[value="Sí"], button:has-text("Sí")').first
        if stay.is_visible(timeout=5000):
            print("Clicking stay signed in...")
            stay.click()
            page.wait_for_timeout(5000)
    except Exception as e:
        print("Stay signed in error:", e)

    page.screenshot(path='ms_step5_after_stay.png')

    # Wait for PowerBI to load
    print("Waiting for report load...")
    for i in range(8):
        page.wait_for_timeout(5000)
        print(f"Elapsed {(i+1)*5}s, URL: {page.url}, Title: {page.title()}")
        if "powerbi.com" in page.url and "signin" not in page.url and "login" not in page.url:
            print("Reached Power BI!")
            break

    page.screenshot(path='ms_step6_powerbi.png')
    print("Finished navigation.")
    browser.close()
