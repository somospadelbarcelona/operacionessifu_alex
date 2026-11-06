import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('ho_vacaciones_cache.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

kpis = data.get('kpis', {})
print("=== KPIS REALES SAP S/4HANA HO ===")
for k, v in kpis.items():
    print(f"  {k}: {v}")

test_names = ['BRANDON CORTES', 'FRANCISCO JAVIER RUBIO', 'FREDY LOVO', 'IVAN AUGUSTUS', 'JOSE ANTONIO LOPEZ', 'JULIAN PEGUERO', 'MARCELO BIEDMA', 'MOHAMED KABBOURI']
trabajadores = data.get('trabajadores', [])

print("\n=== TRABAJADORES DE LA CAPTURA ===")
for w in trabajadores:
    nom = (w.get('nombre_completo') or '').upper()
    if any(t in nom for t in test_names):
        print(f"--- {w.get('nombre_completo')} (ID: {w.get('id_empleado')}) ---")
        print(f"  DNI: {w.get('dni')} | Gestor: {w.get('nom_responsable')}")
        print(f"  En Baja IT: {w.get('en_baja_it_actual')}")
        print(f"  Totales HO: {w.get('vac_totales')}d | Imputados HO: {w.get('vac_tomados')}d ({w.get('pctDisfrutado')}%) | Faltan: {w.get('vac_restantes')}d")
        print(f"  Periodos vacaciones ({w.get('total_periodos')}):")
        for p in w.get('periodos_vacaciones', []):
            print(f"    * {p.get('rango_texto')} ({p.get('dias_habiles')}d lab, {p.get('dias_naturales')}d nat) [{p.get('codigo_tipo')}] - {p.get('estado')}")
        print(f"  Otras ausencias: {w.get('otras_ausencias_2026')}")
