import json

for path in ['fichajes_historico/2026-11.json', 'fichajes_bcn.json', 'fichajes_contraste_girona.json', 'live_sap_ho_audit.json']:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"Checking {path}...")
            # check if 46538701H is in there
            text = json.dumps(data)
            if '46538701H' in text:
                print(f"  FOUND 46538701H in {path}")
    except Exception as e:
        print(f"Error reading {path}: {e}")
