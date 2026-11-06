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

    # 1. Fill email
    inp = page.locator('input[type="email"], input[placeholder*="email" i], input#email').first
    inp.fill(user)
    page.keyboard.press("Enter")
    page.wait_for_timeout(4000)

    # 2. Click back button if on FIDO / PIN screen
    back_btn = page.locator('#idBtn_Back, button[aria-label*="Back"], button[aria-label*="Atrás"]').first
    if back_btn.is_visible(timeout=3000):
        print("Clicking back to options...")
        back_btn.click()
        page.wait_for_timeout(2000)

    # 3. Click "Use my password"
    pwd_tile = page.locator('#credentialList div:has-text("Use my password"), #credentialList div:has-text("contraseña")').last
    if pwd_tile.is_visible(timeout=5000):
        print("Clicking 'Use my password' option...")
        pwd_tile.click()
        page.wait_for_timeout(3000)

    page.screenshot(path='ms_password_screen.png')

    # 4. Fill password
    pwd_box = page.locator('input[name="passwd"], input[type="password"]').first
    if pwd_box.is_visible(timeout=6000):
        print("Entering password...")
        pwd_box.fill(pwd)
        page.wait_for_timeout(500)
        page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first.click()
        page.wait_for_timeout(5000)
    else:
        print("Password input not found!")

    page.screenshot(path='ms_after_pwd_submit.png')

    # 5. Handle "Stay signed in?" (KMSI) or MFA
    stay = page.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes"), input[value="Sí"], button:has-text("Sí")').first
    if stay.is_visible(timeout=5000):
        print("Clicking Stay signed in (Yes)...")
        stay.click()
        page.wait_for_timeout(6000)

    page.screenshot(path='ms_after_stay.png')

    # 6. Wait for Power BI report to load
    print("Waiting for Power BI Report to load...")
    for i in range(12):
        page.wait_for_timeout(5000)
        print(f"Elapsed {(i+1)*5}s: {page.url} - {page.title()}")
        if "powerbi.com" in page.url and "login" not in page.url and "singleSignOn" not in page.url:
            print("Loaded Power BI!")
            break

    page.wait_for_timeout(10000)
    page.screenshot(path='powerbi_report_loaded.png', full_page=True)
    print("Final Title:", page.title())
    print("Final URL:", page.url)

    # Check for visual elements or iframe
    frames = page.frames
    print(f"Total frames: {len(frames)}")
    browser.close()
