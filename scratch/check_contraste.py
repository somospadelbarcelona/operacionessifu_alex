import json

with open('fichajes_contraste_bcn.json', 'r', encoding='utf-8') as f:
    fc = json.load(f)

trabajadores = fc.get('trabajadores', [])
print(f'Total trabajadores in contraste: {len(trabajadores)}')

alejandro_w = [w for w in trabajadores if 'COSCOLIN' in (w.get('gestor_nombre') or w.get('gestor_corto') or '').upper() or w.get('gestor_id') == '00067697']
print(f'Trabajadores de Alejandro: {len(alejandro_w)}')
for w in alejandro_w:
    nov = (w.get('meses') or {}).get('2026-11', {}).get('dias', {})
    d03 = nov.get('03', {})
    d05 = nov.get('05', {})
    fichajes = w.get('fichajes', [])
    nov_fich = [f for f in fichajes if '/11/2026' in str(f.get('fecha'))]
    print(f"{w.get('nombre')} ({w.get('dni')}): fichajes_tot={len(fichajes)}, nov_fich={len(nov_fich)}, d03={d03.get('estado')}, d05={d05.get('estado')}, sin_cuad={w.get('sin_cuadrante_activo')}, fin_sup={w.get('fin_suplencia')}")
