import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def crear_excel_sifu():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Servicios Limpieza BCN"

    # Encabezados
    headers = [
        "LISTADO", "ESTADO", "DÍA", "HORARIO", "CLIENTE",
        "DIRECCIÓN", "POBLACIÓN", "H/SEM", "TRABAJADOR ACTUAL",
        "PROPUESTA", "OBSERVACIONES"
    ]
    ws.append(headers)

    # Datos de ejemplo
    servicios = [
        ["SRV-001", "DESCUBIERTO", "Lunes a Viernes", "06:00 - 10:00", "Hospital Universitari de Bellvitge", "Feixa Llarga, s/n", "L'Hospitalet de Llobregat", 20, "VACANTE - SIN COBERTURA", "Marta Gómez o Karim Benali", "¡URGENTE! Cobertura prioritaria."],
        ["SRV-002", "BAJA IT", "Lunes a Sábado", "07:00 - 13:00", "Ajuntament de Cornellà - Oficines Centrals", "Plaça de l'Església, 1", "Cornellà de Llobregat", 36, "Rosa M. Martínez (Baja IT)", "Fátima Zahra para cubrir turno", "Baja médica estimada en 2 semanas."],
        ["SRV-003", "SIN TITULAR", "Lunes a Viernes", "14:00 - 18:00", "Centre Cívic Poblenou", "Rambla del Poblenou, 45", "Barcelona (Poblenou)", 20, "PENDIENTE ASIGNAR", "Laura Fernández", "Nueva apertura de centro."],
        ["SRV-004", "REQUIERE COBERTURA", "Lunes, Miércoles, Viernes", "16:00 - 20:00", "Sede Corporativa Grupo SIFU", "Carrer Ciutat de Granada, 123", "Barcelona (Poblenou)", 12, "Carlos Soler", "Antonio Morales", "Permiso retribuido por deber inexcusable."],
        ["SRV-005", "PENDIENTE", "Martes y Jueves", "08:00 - 12:00", "Poliesportiu Municipal El Prat", "Avinguda del Remolar, 12", "El Prat de Llobregat", 8, "Yolanda Castro Ramos", "Comprobar bolsa de horas", "Pendiente confirmación de llaves."],
        ["SRV-006", "OK", "Lunes a Viernes", "06:00 - 14:00", "Parc Científic de Barcelona", "Carrer Baldiri Reixac, 4", "Barcelona (Sants)", 40, "Joan Rovira Vidal", "Servicio consolidado", "Todo en orden."],
        ["SRV-007", "OK", "Lunes a Domingo (Rotativo)", "22:00 - 06:00", "Terminal T1 Aeroport El Prat", "Aeroport del Prat, T1", "El Prat de Llobregat", 38, "Elena Domènech Puig", "Servicio consolidado", "Pase de seguridad AENA vigente."],
        ["SRV-008", "DESCUBIERTO", "Sábado y Domingo", "08:00 - 14:00", "Escola Oficial d'Idiomes Badalona", "Carrer Francesc Layret, 80", "Badalona", 12, "VACANTE - SIN COBERTURA", "Jordi Pujadas Valls", "Evento extraordinario fin de semana."],
        ["SRV-009", "BAJA IT", "Lunes a Viernes", "15:00 - 20:00", "Edifici Banc Sabadell Sant Cugat", "Can Sant Joan, s/n", "Sant Cugat del Vallès", 25, "Pedro Gómez (Baja)", "David Sánchez Soler", "Accidente laboral leve."]
    ]

    for row in servicios:
        ws.append(row)

    # Estilos de cabecera Grupo SIFU (Azul corporativo)
    header_fill = PatternFill(start_color="005DA4", end_color="005DA4", fill_type="solid")
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='D3D3D3'),
        right=Side(style='thin', color='D3D3D3'),
        top=Side(style='thin', color='D3D3D3'),
        bottom=Side(style='thin', color='D3D3D3')
    )

    for col_num, cell in enumerate(ws[1], 1):
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Estilos de filas y colores por estado
    for row in ws.iter_rows(min_row=2, max_row=len(servicios)+1):
        estado = row[1].value
        fill_color = None
        if estado == "DESCUBIERTO":
            fill_color = "FEE2E2" # Rojo claro
        elif estado == "BAJA IT":
            fill_color = "FFEDD5" # Naranja claro
        elif estado == "REQUIERE COBERTURA":
            fill_color = "FFE4E6" # Rosa claro
        elif estado == "SIN TITULAR":
            fill_color = "EDE9FE" # Púrpura claro
        elif estado == "PENDIENTE":
            fill_color = "FEF9C3" # Amarillo claro
        elif estado == "OK":
            fill_color = "DCFCE7" # Verde claro

        for cell in row:
            cell.font = Font(name="Arial", size=10)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            if fill_color:
                cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")

    # Ajustar ancho de columnas
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # Guardar archivo
    nombre_archivo = "Servicios_Limpieza_SIFU_BCN.xlsx"
    wb.save(nombre_archivo)
    print(f"Archivo Excel generado con exito: {nombre_archivo}")

if __name__ == "__main__":
    crear_excel_sifu()
