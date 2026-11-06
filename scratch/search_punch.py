import os

search_str = "06:16:29"
for root, dirs, files in os.walk("."):
    if ".git" in root or "node_modules" in root:
        continue
    for f in files:
        if f.endswith(('.json', '.js', '.py', '.html', '.csv', '.xlsx')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    if search_str in fp.read():
                        print(f"Found in {p}")
            except Exception:
                pass
