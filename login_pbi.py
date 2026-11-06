import time
from playwright.sync_api import sync_playwright

url = 'https://app.powerbi.com/groups/me/reports/bc4f17b6-0ede-468e-9738-51a8654b7a0e/ReportSection96a133ff3a7bc4163373?experience=power-bi'
user = 'OperacionesSIFUGirona@gruposifu.onmicrosoft.com'
pwd = 'D/589468554340ag'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1600, 'height': 900})
    page = context.new_page()
    print("Navigating to:", url)
    page.goto(url, timeout=60000)
    page.wait_for_timeout(3000)

    # Email
    email_input = page.locator('input[type="email"], input[name="loginfmt"]').first
    if email_input.is_visible(timeout=5000):
        print("Entering email...")
        email_input.fill(user)
        page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first.click()
        page.wait_for_timeout(4000)

    page.screenshot(path='pbi_1_after_email.png')

    # If "Choose a way to sign in" / Pick an account / Use password
    print("Checking for sign in options...")
    try:
        # Check if "Use my password" or similar is visible
        pwd_option = page.locator('div:has-text("Use my password"), span:has-text("Use my password"), div[data-value="Password"], #idA_PWD_SwitchToPassword').first
        if pwd_option.is_visible(timeout=5000):
            print("Clicking 'Use my password'...")
            pwd_option.click()
            page.wait_for_timeout(3000)
    except Exception as e:
        print("Option selection notice:", e)

    page.screenshot(path='pbi_2_after_option.png')

    # Password
    try:
        pwd_box = page.locator('input[name="passwd"], input[type="password"]').first
        pwd_box.wait_for(state="visible", timeout=8000)
        print("Entering password...")
        pwd_box.fill(pwd)
        page.wait_for_timeout(1000)
        page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first.click()
        page.wait_for_timeout(5000)
    except Exception as e:
        print("Password entry error:", e)

    page.screenshot(path='pbi_3_after_password.png')

    # Stay signed in or MFA
    try:
        stay_btn = page.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes"), input[value="Sí"], button:has-text("Sí")').first
        if stay_btn.is_visible(timeout=5000):
            print("Clicking stay signed in...")
            stay_btn.click()
            page.wait_for_timeout(5000)
    except Exception as e:
        print("Stay signed in note:", e)

    page.screenshot(path='pbi_4_final_wait.png')
    
    # Wait for PowerBI to load
    print("Waiting for Power BI report...")
    for i in range(6):
        page.wait_for_timeout(5000)
        print(f"Elapsed {(i+1)*5}s, URL: {page.url}, Title: {page.title()}")
        if "powerbi.com" in page.url and "signin" not in page.url and "login" not in page.url:
            break

    page.screenshot(path='pbi_5_report.png')
    print("Done! Final URL:", page.url)
    browser.close()
