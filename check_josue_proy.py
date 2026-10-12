from ho_service import HOService

ho = HOService()
ho.connect()

proy_id = 'SVO11110-P1-C018'
print(f"=== EmpleadoAsigProySet para {proy_id} ===")
asigs = ho.query_entity_set("EmpleadoAsigProySet", filter_query=f"IdProyecto eq '{proy_id}'")
for a in asigs or []:
    print(f" - {a.get('IdEmpleado')} | {a.get('Nombre')} | DNI: {a.get('DNI')}")

proy = ho.get_project(proy_id)
if proy:
    print(f"\nDetalle Proyecto en HO:")
    print(f" - Denominacion: {proy.get('Denominacion')}")
    print(f" - Cliente: {proy.get('NomCliente')}")
    print(f" - Direccion: {proy.get('Calle')}, {proy.get('CodPostal')} {proy.get('Poblacion')}")
    print(f" - Responsable: {proy.get('Responsable')}")
    print(f" - HorasContratadas: {proy.get('HorasContratadas')}")
