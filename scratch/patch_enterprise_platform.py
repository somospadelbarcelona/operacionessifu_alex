with open('enterprise_platform.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """        if (d.estado === 'SIN_MARCAJE' || d.estado === 'NO_FICHADO') {
          return {
            estado: '🚨 No Fichó (Turno previsto)',
            badgeClass: 'danger',
            horaEntrada: '--:--',
            horaSalida: '--:--',
            horas: 0,
            canal: '☎️ CTI',
            canalIcon: '☎️',
            canalDesc: d.turno_previsto ? `Turno previsto ${d.turno_previsto}: sin marcaje` : 'Turno previsto sin fichar'
          };
        }"""

replacement = """        if (d.estado === 'NO_CONTRATADO') {
          return {
            estado: '⚪ No Contratado',
            badgeClass: 'neutral',
            horaEntrada: '--:--',
            horaSalida: '--:--',
            horas: 0,
            canal: '⚪ SAP HO',
            canalIcon: '⚪',
            canalDesc: 'Sin contrato vigente en esta fecha'
          };
        }
        if (d.estado === 'SIN_TURNO_ASIGNADO' || worker.fin_suplencia || worker.sin_cuadrante_activo) {
          return {
            estado: '⚪ Sin Turno Asignado',
            badgeClass: 'neutral',
            horaEntrada: '--:--',
            horaSalida: '--:--',
            horas: 0,
            canal: '⚪ Cuadrante',
            canalIcon: '⚪',
            canalDesc: 'Sin turno en cuadrante activo del mes'
          };
        }
        if (d.estado === 'INACTIVO_SIN_CUADRANTE' || worker.posible_baja_empresa) {
          return {
            estado: '⚠️ Inactivo / Auditar',
            badgeClass: 'neutral',
            horaEntrada: '--:--',
            horaSalida: '--:--',
            horas: 0,
            canal: '⚠️ Auditoría',
            canalIcon: '⚠️',
            canalDesc: 'Sin cuadrante ni marcajes en el mes'
          };
        }
        if (d.estado === 'SIN_MARCAJE' || d.estado === 'NO_FICHADO') {
          return {
            estado: '🚨 No Fichó (Turno previsto)',
            badgeClass: 'danger',
            horaEntrada: '--:--',
            horaSalida: '--:--',
            horas: 0,
            canal: '☎️ CTI',
            canalIcon: '☎️',
            canalDesc: d.turno_previsto ? `Turno previsto ${d.turno_previsto}: sin marcaje` : 'Turno previsto sin fichar'
          };
        }"""

if target in code:
    code = code.replace(target, replacement)
    print("Replaced day record states in enterprise_platform.js.")

# Add reubicado badge to table row
target_serv = '<div style="font-weight:700;">${w.servicio || \'Sede Barcelona\'}</div>'
replacement_serv = '<div style="font-weight:700;">${w.servicio || \'Sede Barcelona\'} ${w.reubicado ? \'<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:4px;">🔁 REUBICADO</span>\' : \'\'}</div>'

if target_serv in code:
    code = code.replace(target_serv, replacement_serv)
    print("Added reubicado badge to table in enterprise_platform.js.")

with open('enterprise_platform.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("enterprise_platform.js updated successfully.")
