import json

with open('fichajes_historico/2026-11.json', 'r', encoding='utf-8') as f:
    hist = json.load(f)

for w in hist.get('trabajadores', []):
    nom = w.get('nombre')
    dias = w.get('meses', {}).get('2026-11', {}).get('dias', {})
    print(f"=== {nom} ({w.get('dni')}) ===")
    for d, dinfo in sorted(dias.items()):
        if int(d) <= 5:
            print(f"  Dia {d}: estado={dinfo.get('estado')}, entrada={dinfo.get('horaEntrada')}, salida={dinfo.get('horaSalida')}, horas={dinfo.get('horas_trabajadas')}, turno={dinfo.get('turno_previsto')}")
