from ho_service import HOService
import json

ho = HOService()
ho.connect()

proy_id = 'PROY017209-P1'

print("=== EmpleadoAsigProySet para PROY017209-P1 ===")
asigs = ho.query_entity_set("EmpleadoAsigProySet", filter_query=f"IdProyecto eq '{proy_id}'")
for a in asigs or []:
    print(f" - Empleado: {a.get('IdEmpleado')} | {a.get('Nombre')} | DNI: {a.get('DNI')}")

print("\n=== EmpleadoProyectoSet para PROY017209-P1 ===")
emps_p = ho.query_entity_set("EmpleadoProyectoSet", filter_query=f"IdProyecto eq '{proy_id}'")
for ep in emps_p or []:
    print(f" - {ep.get('IdEmpleado')} | {ep.get('Nombre')} | Fecha: {ep.get('Fecha')} | DNI: {ep.get('DNI')}")
