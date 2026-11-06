import os

for root, dirs, files in os.walk("."):
    if ".git" in root or "node_modules" in root:
        continue
    for f in files:
        if f.endswith(('.js', '.py')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    c = fp.read()
                    if 'fichajes_historico' in c:
                        print(f"Found in {p}")
            except Exception:
                pass
