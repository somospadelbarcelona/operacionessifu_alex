with open("build_bcn_contraste.py", "r", encoding="utf-8") as f:
    code = f.read()

# Make sure w_meta stores proyecto_id from w.get("proyecto_principal")
old_wmeta = '''        workers_by_dni[cdni] = {
            "dni": cdni,
            "nombre": name,
            "servicio": servicio,'''

new_wmeta = '''        workers_by_dni[cdni] = {
            "dni": cdni,
            "nombre": name,
            "servicio": servicio,
            "proyecto_id": str(w.get("proyecto_principal") or w.get("proyecto_hoy") or ""),'''

if old_wmeta in code and '"proyecto_id":' not in code:
    code = code.replace(old_wmeta, new_wmeta)
    print("Added proyecto_id to workers_by_dni.")

# Update the serv_code check
old_serv_code = 'm_serv = re.search(r\'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)\', w_meta.get("servicio", ""))'
new_serv_code = 'm_serv = re.search(r\'(PROY\\d+|SVO\\d+|PGOC\\d+|PIEC\\d+)\', w_meta.get("proyecto_id", "") + " " + w_meta.get("servicio", ""))'

if old_serv_code in code:
    code = code.replace(old_serv_code, new_serv_code)
    print("Updated m_serv search.")

with open("build_bcn_contraste.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated build_bcn_contraste.py.")
