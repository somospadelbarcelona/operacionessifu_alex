import os

target = b"06:16:29"
for root, dirs, files in os.walk("."):
    if ".git" in root or "node_modules" in root:
        continue
    for f in files:
        p = os.path.join(root, f)
        try:
            with open(p, "rb") as fp:
                data = fp.read()
                if target in data:
                    print(f"Found in {p}")
        except Exception:
            pass
