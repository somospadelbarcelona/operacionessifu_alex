import json

with open("fichajes_bcn.json", "r", encoding="utf-8") as f:
    bcn = json.load(f)

carmen_punches = [x for x in bcn.get("fichajes", []) if "46538701" in str(x.get("USERDNI"))]
for p in carmen_punches[:10]:
    print(p)
