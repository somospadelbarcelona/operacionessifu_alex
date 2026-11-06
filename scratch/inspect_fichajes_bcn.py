import json

with open("fichajes_bcn.json", "r", encoding="utf-8") as f:
    bcn = json.load(f)

print("Type of fichajes_bcn:", type(bcn))
if isinstance(bcn, dict):
    print("Keys:", list(bcn.keys())[:10])
    trab = bcn.get("trabajadores") or bcn.get("fichajes") or []
    print("Count:", len(trab))
    for t in trab:
        if "46538701" in str(t):
            print("Found in fichajes_bcn:", t.get("nombre") if isinstance(t, dict) else t)
            # print all punches
            if isinstance(t, dict) and "fichajes" in t:
                for fch in t["fichajes"][:5]:
                    print("  punch:", fch)
elif isinstance(bcn, list):
    print("List count:", len(bcn))
    for item in bcn:
        if "46538701" in str(item):
            print("Found item:", item)
            break
