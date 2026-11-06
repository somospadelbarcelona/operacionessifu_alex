import json

with open('cmh_bcn_dataset.json', 'r', encoding='utf-8') as f:
    cmh = json.load(f)

with open('fichajes_contraste_bcn.json', 'r', encoding='utf-8') as f:
    fc = json.load(f)

fc_map = {w.get('dni'): w for w in fc.get('trabajadores', []) if w.get('dni')}

for w in cmh:
    dni = w.get('dni')
    contrastW = fc_map.get(dni, {})
    gid = contrastW.get('gestor_id') or w.get('gestor_id')
    if gid == '00062620' or 'COSCOLIN' in str(w.get('manager')).upper():
        print(f"Worker: {w.get('empleado')} ({dni})")
        print(f"  cmh tipoServicio: {w.get('tipoServicio')}")
        print(f"  contrast sector: {contrastW.get('sector')}")
        print(f"  contrast es_brigada: {contrastW.get('es_brigada')}")
        print(f"  contrast fin_suplencia: {contrastW.get('fin_suplencia')}")
        print(f"  contrast sin_cuadrante_activo: {contrastW.get('sin_cuadrante_activo')}")
        print(f"  contrast posible_baja_empresa: {contrastW.get('posible_baja_empresa')}")
