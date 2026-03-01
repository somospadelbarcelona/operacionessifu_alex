/**
 * DataManager.js - El Cerebro de Datos
 * Módulo encargado de:
 * 1. Normalizar datos crudos (COL_XX -> nombres reales)
 * 2. Limpiar y validar tipos de datos (Strings a Fechas)
 * 3. Gestionar la persistencia desacoplada de la UI
 */

const DataSchema = {
    // Mapeo de columnas Excel crudas a nombres semánticos
    // Basado en el análisis de master_data.js actual
    COLUMN_MAP: {
        'PROYECTO': 'id_proyecto',
        'SERVICIO': 'servicio_nombre',
        'TIPO_S': 'cliente',
        'TITULAR': 'trabajador_nombre',
        'ESTADO': 'estado_cobertura', // CUBIERTO, DESCUBIERTO, BRIGADA
        'ESTADO1': 'estado_personal', // BAJA IT, VACACIONES
        'HORARIO': 'horario_texto',
        'OBSERVACIONES': 'observaciones',
        'SUPLENTE': 'suplente_nombre',
        'FACT': 'facturable', // OK / A / Falta
        'VACACIONES_26': 'vacaciones_info',
        'GESTOR': 'gestor_nombre' // Nuevo mapeo detectado
    },

    // Valores por defecto para evitar undefined
    DEFAULTS: {
        estado_cobertura: 'PENDIENTE',
        estado_personal: 'TOKEN_NULL',
        horario_texto: 'NO DEFINIDO',
        gestor_nombre: 'SIN ASIGNAR'
    }
};

class DataTransformer {
    static normalize(rawData) {
        if (!Array.isArray(rawData)) return [];

        console.log(`🔄 DataTransformer: Iniciando normalización de ${rawData.length} registros.`);

        return rawData.map(row => {
            const normalized = {};

            // 1. Mapeo Directo (Excel -> Logic)
            for (const [excelKey, logicKey] of Object.entries(DataSchema.COLUMN_MAP)) {
                let value = row[excelKey];

                // Limpieza básica de strings
                if (typeof value === 'string') {
                    value = value.trim();
                }

                // Usar valor o default si existe
                normalized[logicKey] = value || DataSchema.DEFAULTS[logicKey] || null;
            }

            // 2. Propiedades calculadas (Inteligencia de Negocio)
            normalized.es_descubierto = this.detectarDescubierto(normalized);
            normalized.es_baja = this.detectarBaja(normalized);

            // 3. Inteligencia Temporal (Fase 3)
            const scheduleObj = this.parseHorarioCompleto(normalized.horario_texto);
            normalized.turno_detectado = scheduleObj ? scheduleObj.tipo_turno : this.parsearTurno(normalized.horario_texto);
            normalized.horario_computable = scheduleObj;
            normalized.activo_ahora = this.isServiceActiveNow(scheduleObj);

            return normalized;
        });
    }

    /**
     * Lógica crítica: ¿Está descubierto el servicio?
     * @param {Object} row - Fila normalizada
     * @returns {Boolean}
     */
    static detectarDescubierto(row) {
        // Prioridad 1: Marcado explícitamente
        if (row.estado_cobertura === 'DESCUBIERTO') return true;

        // Prioridad 2: Baja sin suplente
        if (row.estado_personal && row.estado_personal.includes('BAJA') && !row.suplente_nombre) return true;

        // Prioridad 3: Sin titular (y no es un servicio especial como BRIGADA)
        if (!row.trabajador_nombre && row.estado_cobertura !== 'BRIGADA') return true;

        return false;
    }

    static detectarBaja(row) {
        const estado = row.estado_personal ? row.estado_personal.toUpperCase() : '';
        return estado.includes('BAJA') || estado.includes('IT') || estado.includes('ACCIDENTE');
    }

    static parsearTurno(textoHorario) {
        if (!textoHorario) return 'SIN TURNO';

        // Parsing Avanzado V3: Intentar extraer horas reales
        const parsed = this.parseHorarioCompleto(textoHorario);
        if (parsed) {
            return parsed.tipo_turno; // MAÑANA, TARDE, NOCHE
        }

        // Fallback básico
        const lower = textoHorario.toLowerCase();
        if (lower.includes('6:00') || lower.includes('7:00') || lower.includes('8:00') || lower.includes('mañana')) return 'MAÑANA';
        if (lower.includes('14:00') || lower.includes('15:00') || lower.includes('16:00') || lower.includes('tarde')) return 'TARDE';
        if (lower.includes('22:00') || lower.includes('23:00') || lower.includes('noche')) return 'NOCHE';

        return 'VARIABLE/NO DEFINIDO';
    }

    /**
     * Convierte "L A V DE 06:00 A 14:00" en un objeto computable
     */
    static parseHorarioCompleto(texto) {
        if (!texto) return null;
        texto = texto.toUpperCase();

        // 1. Detectar rango de horas (Ej: 06:00 A 14:00, 6-14, 6 A 14)
        // Regex para capturar HH:MM o H
        const horaRegex = /(\d{1,2})(?::(\d{2}))?\s*(?:A|-|Y)\s*(\d{1,2})(?::(\d{2}))?/i;
        const match = texto.match(horaRegex);

        if (match) {
            const hInicio = parseInt(match[1]);
            const mInicio = match[2] ? parseInt(match[2]) : 0;
            const hFin = parseInt(match[3]);
            const mFin = match[4] ? parseInt(match[4]) : 0;

            let tipo = 'VARIABLE';
            if (hInicio >= 5 && hInicio < 13) tipo = 'MAÑANA';
            else if (hInicio >= 13 && hInicio < 21) tipo = 'TARDE';
            else tipo = 'NOCHE';

            return {
                inicio: { h: hInicio, m: mInicio },
                fin: { h: hFin, m: mFin },
                tipo_turno: tipo,
                texto_detectado: match[0]
            };
        }
        return null;
    }

    /**
     * Verifica si un servicio debería estar activo AHORA (Real-time Check)
     */
    static isServiceActiveNow(parsedSchedule) {
        if (!parsedSchedule) return false;

        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const currentDay = now.getDay(); // 0(Dom) - 6(Sab)

        // Parseo intuitivo de días (L A V, L-D, S D)
        const textUpper = parsedSchedule.texto_detectado ? parsedSchedule.texto_detectado.toUpperCase() : '';
        const isWeekend = (currentDay === 0 || currentDay === 6);

        let shouldBeActiveToday = true; // Por defecto asumimos activo

        if (textUpper.includes('L A V') || textUpper.includes('L-V')) {
            if (isWeekend) shouldBeActiveToday = false;
        } else if (textUpper.includes('S D') || textUpper.includes('FIN DE SEMANA') || textUpper.includes('SAB Y DOM')) {
            if (!isWeekend) shouldBeActiveToday = false;
        }

        if (!shouldBeActiveToday) return false;

        // Convertir a minutos para comparar fácil
        const minItems = (h, m) => h * 60 + m;
        const nowMins = minItems(currentH, currentM);
        const startMins = minItems(parsedSchedule.inicio.h, parsedSchedule.inicio.m);
        const endMins = minItems(parsedSchedule.fin.h, parsedSchedule.fin.m);

        return nowMins >= startMins && nowMins <= endMins;
    }
}

// Exportar para uso global
window.DataManagerV2 = {
    Transformer: DataTransformer,
    Schema: DataSchema
};

console.log("✅ [System] DataManager V2 Cargado: Listo para procesar datos.");
