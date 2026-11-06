import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1600, 'height': 1200})
    page.goto('http://127.0.0.1:5500/index.html' if False else f"file:///{__file__.replace('verify_cmh_ui.py', 'index.html').replace('\\', '/')}")
    page.wait_for_timeout(3000)

    # Click CMH tab
    btn = page.locator('button[data-tab="cmh"], button:has-text("CMH")').first
    if btn.is_visible():
        btn.click()
        page.wait_for_timeout(2000)

    page.screenshot(path='cmh_revolution_preview.png', full_page=True)
    print("Screenshot saved to cmh_revolution_preview.png")
    browser.close()
