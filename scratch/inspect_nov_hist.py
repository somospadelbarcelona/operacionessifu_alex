import json

with open('fichajes_historico/2026-11.json', 'r', encoding='utf-8') as f:
    hist = json.load(f)

print("Keys in fichajes_historico/2026-11.json:", list(hist.keys())[:5])
trab = hist.get('trabajadores', [])
print(f"Total trabajadores in 2026-11: {len(trab)}")
carmen = [w for w in trab if '46538701H' in str(w.get('dni', ''))]
if carmen:
    print(json.dumps(carmen[0], indent=2, ensure_ascii=False))
