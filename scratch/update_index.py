with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Purga total SW + Caches
old_sw = "        if ('serviceWorker' in navigator) {\n            navigator.serviceWorker.getRegistrations().then(function (regs) {\n                regs.forEach(function (r) { r.unregister(); });\n            }).catch(function () {});\n        }"
new_sw = "        // PURGA TOTAL DE SERVICE WORKERS Y CACHE STORAGE\n        if ('serviceWorker' in navigator) {\n            navigator.serviceWorker.getRegistrations().then(function (regs) {\n                regs.forEach(function (r) { r.unregister(); });\n            }).catch(function () {});\n        }\n        if ('caches' in window) {\n            caches.keys().then(function (names) {\n                names.forEach(function (name) { caches.delete(name); });\n            }).catch(function () {});\n        }"

if old_sw in content:
    content = content.replace(old_sw, new_sw, 1)
else:
    # Intento con \r\n
    old_sw_crlf = old_sw.replace('\n', '\r\n')
    new_sw_crlf = new_sw.replace('\n', '\r\n')
    assert old_sw_crlf in content, 'old_sw not found'
    content = content.replace(old_sw_crlf, new_sw_crlf, 1)

# 2. enterprise_platform.css version
content = content.replace('enterprise_platform.css?v=7.5-fichajes-mes-dia-export', 'enterprise_platform.css?v=20261105_v9_enterprise', 1)

# 3. CSS for #girona-pro-root & #sifu-enterprise-root
old_css = "        #girona-pro-root {\n            display: block !important;\n            min-height: 100vh;\n            width: 100%;\n        }"
new_css = "        #girona-pro-root {\n            display: none !important;\n            visibility: hidden !important;\n            height: 0 !important;\n            overflow: hidden !important;\n        }\n\n        #sifu-enterprise-root {\n            display: flex !important;\n            min-height: 100vh;\n            width: 100%;\n        }"

if old_css in content:
    content = content.replace(old_css, new_css, 1)
else:
    old_css_crlf = old_css.replace('\n', '\r\n')
    new_css_crlf = new_css.replace('\n', '\r\n')
    assert old_css_crlf in content, 'old_css not found'
    content = content.replace(old_css_crlf, new_css_crlf, 1)

# 4. Containers in body
old_body = "    <!-- CONTENEDOR PRINCIPAL DIRECTO: SIFU BARCELONA OPERACIONES PRO -->\n    <div id=\"girona-pro-root\"></div>"
new_body = "    <!-- PLATAFORMA INTEGRAL SIFU ENTERPRISE (NUEVO DISEÑO v2.0) -->\n    <div id=\"sifu-enterprise-root\"></div>\n\n    <!-- CONTENEDOR SECUNDARIO HEREDADO -->\n    <div id=\"girona-pro-root\" style=\"display: none !important;\"></div>"

if old_body in content:
    content = content.replace(old_body, new_body, 1)
else:
    old_body_crlf = old_body.replace('\n', '\r\n')
    new_body_crlf = new_body.replace('\n', '\r\n')
    assert old_body_crlf in content, 'old_body not found'
    content = content.replace(old_body_crlf, new_body_crlf, 1)

# 5. enterprise_platform.js version
content = content.replace('enterprise_platform.js?v=7.5-fichajes-mes-dia-export', 'enterprise_platform.js?v=20261105_v9_enterprise', 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('SUCCESS_INDEX_UPDATED')
