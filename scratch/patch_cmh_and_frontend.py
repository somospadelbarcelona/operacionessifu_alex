import json
import re

# 1. Actualizar cmh_bcn_dataset.json y cmh_bcn_data.js
cmh_json_file = "cmh_bcn_dataset.json"
cmh_js_file = "cmh_bcn_data.js"

with open(cmh_json_file, "r", encoding="utf-8") as f:
    cmh = json.load(f)

for w in cmh:
    wid = str(w.get("id") or "")
    if wid == "00012230":  # Aitor Feijoo
        w["gestor_id"] = "00066957"
        w["manager"] = "SONIA CAÑETE CÁRDENAS PERAL"
        w["centroServicio"] = "PGOC018081L - PGO LIMPIEZA BARCELONA (BRIGADA)"
        w["tipoServicio"] = "BRIGADA"
    elif wid == "00064684":  # Yolanda Olivares
        w["gestor_id"] = "00066957"
        w["manager"] = "SONIA CAÑETE CÁRDENAS PERAL"
        w["centroServicio"] = "PROY011521-P1 - SERVICIO LIMPIEZA OFICINAS WTC ALMEDA PARK"
        w["tipoServicio"] = "LIMPIEZA"
    elif wid == "00005815":  # Ramon Bernal
        w["gestor_id"] = "00066957"
        w["manager"] = "SONIA CAÑETE CÁRDENAS PERAL"
        w["centroServicio"] = "PGOC018081L - PGO LIMPIEZA BARCELONA (BRIGADA)"
        w["tipoServicio"] = "BRIGADA"
    elif wid == "00001571":  # Jonathan Sena
        w["gestor_id"] = "00066957"
        w["manager"] = "SONIA CAÑETE CÁRDENAS PERAL"
        w["centroServicio"] = "PGOC018081L - PGO LIMPIEZA BARCELONA (BRIGADA)"
        w["tipoServicio"] = "BRIGADA"

with open(cmh_json_file, "w", encoding="utf-8") as f:
    json.dump(cmh, f, ensure_ascii=False, indent=2)

with open(cmh_js_file, "w", encoding="utf-8") as f:
    f.write(f"window.CMH_BCN_DATASET = {json.dumps(cmh, ensure_ascii=False)};\n")

print("cmh_bcn_dataset.json and cmh_bcn_data.js updated.")

# 2. Actualizar enterprise_platform.js para que el contraste auditado mande sobre el censo estático
with open("enterprise_platform.js", "r", encoding="utf-8") as f:
    code = f.read()

# Prioridad a contrastW (live/audited) sobre w (estático)
old_g_resolve = """        const gId = w.gestor_id || contrastW.gestor_id || unifiedW.gestor_id;
        const gName = contrastW.gestor_nombre || contrastW.gestor_corto || contrastW.gestor || w.manager || unifiedW.gestor_nombre || unifiedW.gestor_corto || unifiedW.manager;
        const gInfo = resolveGestorInfo(gId, gName);"""

new_g_resolve = """        const gId = (contrastW.gestor_id && contrastW.gestor_id !== 'SIN_GESTOR') ? contrastW.gestor_id : (w.gestor_id || unifiedW.gestor_id);
        const gName = (contrastW.gestor_id && contrastW.gestor_id !== 'SIN_GESTOR') ? (contrastW.gestor_nombre || contrastW.gestor_corto || contrastW.gestor) : (w.manager || unifiedW.gestor_nombre || contrastW.gestor_nombre);
        const gInfo = resolveGestorInfo(gId, gName);"""

if old_g_resolve in code:
    code = code.replace(old_g_resolve, new_g_resolve)
    print("Updated gInfo resolution in enterprise_platform.js.")

# Prioridad de servicio y sector
old_serv_resolve = """          servicio: w.centroServicio || unifiedW.servicio || contrastW.servicio || 'Sede Barcelona (0801)',
          sector: w.tipoServicio || unifiedW.sector || contrastW.sector || 'LIMPIEZA',"""

new_serv_resolve = """          servicio: (contrastW.servicio && !contrastW.servicio.includes('Sede Barcelona')) ? contrastW.servicio : (w.centroServicio || unifiedW.servicio || 'Sede Barcelona (0801)'),
          sector: contrastW.sector || w.tipoServicio || unifiedW.sector || 'LIMPIEZA',
          es_brigada: contrastW.es_brigada || (w.tipoServicio === 'BRIGADA') || (contrastW.sector === 'BRIGADA / MULTICLIENTE'),
          fin_suplencia: contrastW.fin_suplencia || false,
          sin_cuadrante_activo: contrastW.sin_cuadrante_activo || false,
          posible_baja_empresa: contrastW.posible_baja_empresa || false,
          reubicado: contrastW.reubicado || false,"""

if old_serv_resolve in code:
    code = code.replace(old_serv_resolve, new_serv_resolve)
    print("Updated servicio and flags in enterprise_platform.js.")

# En ensureContinuousWorkData, no simular NO_FICHADO para suplencias terminadas, inactivos o brigadas
old_cont_loop = """          // Construir los días de Noviembre (01 al 30)
          for (let d = 1; d <= 30; d++) {
            const dStr = String(d).padStart(2, '0');
            const fechaStr = `${dStr}/11/2026`;

            if (isBaja) {"""

new_cont_loop = """          const isSinTurno = w.fin_suplencia || w.sin_cuadrante_activo || w.estado_hoy === 'SIN_TURNO_ASIGNADO' || w.posible_baja_empresa;
          const isBrigada = w.es_brigada || (w.sector || '').includes('BRIGADA');

          // Construir los días de Noviembre (01 al 30)
          for (let d = 1; d <= 30; d++) {
            const dStr = String(d).padStart(2, '0');
            const fechaStr = `${dStr}/11/2026`;

            if (isSinTurno) {
              w.meses['2026-11'].dias[dStr] = {
                estado: 'SIN_TURNO_ASIGNADO',
                horas_trabajadas: 0,
                horaEntrada: '--:--',
                horaSalida: '--:--',
                marcajes: [],
                canal: '⚪ Cuadrante'
              };
            } else if (isBrigada && (!w.fichajes || !w.fichajes.some(f => (f.fecha || '').startsWith(dStr)))) {
              w.meses['2026-11'].dias[dStr] = {
                estado: 'DESCANSO',
                horas_trabajadas: 0,
                horaEntrada: '--:--',
                horaSalida: '--:--',
                marcajes: [],
                canal: '⚪ Cuadrante'
              };
            } else if (isBaja) {"""

if old_cont_loop in code:
    code = code.replace(old_cont_loop, new_cont_loop)
    print("Updated ensureContinuousWorkData loop in enterprise_platform.js.")

with open("enterprise_platform.js", "w", encoding="utf-8") as f:
    f.write(code)

print("All patches applied.")
