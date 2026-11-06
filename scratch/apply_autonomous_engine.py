import os
import re

bcn_file = "build_bcn_contraste.py"
with open(bcn_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add file constants if missing
if "HO_CUADRANTES_FILE" not in code:
    code = code.replace(
        'HO_VACACIONES_FILE = os.path.join(BASE_DIR, "ho_vacaciones_cache.json")',
        'HO_VACACIONES_FILE = os.path.join(BASE_DIR, "ho_vacaciones_cache.json")\nHO_CUADRANTES_FILE = os.path.join(BASE_DIR, "ho_cuadrantes_cache.json")\nSERVICIOS_INTELIGENTES_FILE = os.path.join(BASE_DIR, "servicios_inteligente_consolidados.json")'
    )

with open(bcn_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Step 1 constants updated.")
