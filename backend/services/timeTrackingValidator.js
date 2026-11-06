/**
 * MOTOR DE VALIDACIÓN DE FICHAJES - GRUPO SIFU
 * Sistema de Control Horario Inteligente
 * Reglas de negocio, auditoría de integridad y generación estructurada de alertas.
 */

class TimeTrackingValidator {
    constructor() {
        this.LIMITS = {
            STANDARD_MAX_HOURS: 9.0,
            SPECIAL_MAX_HOURS: 12.0,
            DUPLICATE_THRESHOLD_SECONDS: 180, // 3 minutos
            MAX_OPEN_SHIFT_HOURS: 10.0,
            MAX_DELAY_MINUTES: 15,
            MAX_DISTANCE_METERS: 200
        };
    }

    /**
     * Convierte cadena HH:MM o HH:MM:SS a segundos del día
     */
    timeToSeconds(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const parts = timeStr.trim().split(':');
        if (parts.length < 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parts[2] ? parseInt(parts[2], 10) : 0;
        if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
        return h * 3600 + m * 60 + s;
    }

    /**
     * Calcula distancia en metros entre dos coordenadas (Haversine)
     */
    calculateDistanceMeters(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371e3; // Radio de la Tierra en metros
        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Valida los fichajes diarios de un trabajador
     * @param {Object} workerData Información del trabajador
     * @param {String} dateStr Fecha en formato DD/MM/YYYY o YYYY-MM-DD
     * @param {Array} marcajes Lista de marcajes del día
     * @param {Object} [cuadrante] Turno programado (opcional: { inicio: '08:00', fin: '16:00', horas: 8 })
     */
    validateDailyRecords(workerData, dateStr, marcajes = [], cuadrante = null) {
        const alerts = [];
        const normalizedMarcajes = [...marcajes].sort((a, b) => {
            const secA = this.timeToSeconds(a.hora || a.timestamp) || 0;
            const secB = this.timeToSeconds(b.hora || b.timestamp) || 0;
            return secA - secB;
        });

        const workerId = workerData.id_empleado || workerData.dni || workerData.id || 'N/A';
        const workerName = workerData.nombre || 'Trabajador';
        const workerCenter = workerData.servicio || workerData.cliente || 'Centro SIFU';

        // 1. REGLA: Validación de formato y consistencia de horas individuales
        normalizedMarcajes.forEach((m, idx) => {
            const hora = m.hora || m.timestamp;
            const sec = this.timeToSeconds(hora);
            if (sec === null) {
                alerts.push({
                    id: `ALR-${workerId}-${dateStr}-FMT-${idx}`,
                    workerId,
                    workerName,
                    center: m.punto || workerCenter,
                    date: dateStr,
                    type: 'HORA_INCONSISTENTE',
                    severity: 'CRITICAL',
                    title: 'Formato de hora incorrecto o corrupto',
                    description: `El marcaje nº ${idx + 1} posee un valor de hora inválido: "${hora}".`,
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
            }
        });

        // 1.b REGLA: Detección de secuencia horaria invertida en el registro original
        for (let i = 0; i < marcajes.length - 1; i++) {
            const m1 = marcajes[i];
            const m2 = marcajes[i + 1];
            const isM1Entrada = (m1.tipo || '').toLowerCase().includes('entrada') || m1.isEntrada;
            const isM2Salida = (m2.tipo || '').toLowerCase().includes('salida') || m2.isEntrada === false;
            const s1 = this.timeToSeconds(m1.hora || m1.timestamp);
            const s2 = this.timeToSeconds(m2.hora || m2.timestamp);
            if (isM1Entrada && isM2Salida && s1 !== null && s2 !== null && s2 < s1) {
                alerts.push({
                    id: `ALR-${workerId}-${dateStr}-INV-${i}`,
                    workerId,
                    workerName,
                    center: m2.punto || workerCenter,
                    date: dateStr,
                    type: 'HORA_INCONSISTENTE',
                    severity: 'CRITICAL',
                    title: 'Secuencia horaria invertida',
                    description: `La salida (${m2.hora}) es cronológicamente anterior a la entrada (${m1.hora}).`,
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
            }
        }

        // 2. REGLA: Detección de fichajes duplicados (< 3 minutos)
        for (let i = 0; i < normalizedMarcajes.length - 1; i++) {
            const curr = normalizedMarcajes[i];
            const next = normalizedMarcajes[i + 1];
            const secCurr = this.timeToSeconds(curr.hora || curr.timestamp);
            const secNext = this.timeToSeconds(next.hora || next.timestamp);

            if (secCurr !== null && secNext !== null) {
                const diffSec = Math.abs(secNext - secCurr);
                if (diffSec < this.LIMITS.DUPLICATE_THRESHOLD_SECONDS) {
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-DUP-${i}`,
                        workerId,
                        workerName,
                        center: curr.punto || workerCenter,
                        date: dateStr,
                        type: 'FICHAJE_DUPLICADO',
                        severity: 'WARNING',
                        title: 'Marcajes duplicados detectados',
                        description: `Dos marcajes registrados con sólo ${diffSec} seg de diferencia (${curr.hora} y ${next.hora}). Probable doble pulsación en terminal/app.`,
                        timestamp: new Date().toISOString(),
                        resolved: false,
                        meta: { marcaje1: curr, marcaje2: next, diffSeconds: diffSec }
                    });
                }
            }
        }

        // 3. REGLA: Emparejamiento de Entrada/Salida, Jornadas Abiertas y Salidas Huérfanas
        let openEntry = null;
        let totalWorkedSeconds = 0;
        const intervals = [];

        normalizedMarcajes.forEach((m, idx) => {
            const tipo = (m.tipo || '').toLowerCase();
            const isEntrada = tipo.includes('entrada') || m.isEntrada === true;
            const isSalida = tipo.includes('salida') || m.isEntrada === false;
            const sec = this.timeToSeconds(m.hora || m.timestamp);

            if (isEntrada) {
                if (openEntry) {
                    // Dos entradas consecutivas sin salida previa
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-2ENT-${idx}`,
                        workerId,
                        workerName,
                        center: m.punto || workerCenter,
                        date: dateStr,
                        type: 'ENTRADA_SIN_SALIDA',
                        severity: 'WARNING',
                        title: 'Entrada consecutiva sin salida intermedia',
                        description: `Se detectó una nueva entrada a las ${m.hora} cuando ya existía una abierta a las ${openEntry.hora}.`,
                        timestamp: new Date().toISOString(),
                        resolved: false
                    });
                }
                openEntry = { ...m, seconds: sec, index: idx };
            } else if (isSalida) {
                if (!openEntry) {
                    // Salida sin entrada previa
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-ORPH-${idx}`,
                        workerId,
                        workerName,
                        center: m.punto || workerCenter,
                        date: dateStr,
                        type: 'SALIDA_SIN_ENTRADA',
                        severity: 'CRITICAL',
                        title: 'Marcaje de salida sin entrada correspondiente',
                        description: `Se registró marcaje de salida a las ${m.hora} sin ninguna entrada previa registrada en el día.`,
                        timestamp: new Date().toISOString(),
                        resolved: false
                    });
                } else {
                    // Intervalo completado
                    if (sec !== null && openEntry.seconds !== null) {
                        if (sec < openEntry.seconds) {
                            alerts.push({
                                id: `ALR-${workerId}-${dateStr}-INV-${idx}`,
                                workerId,
                                workerName,
                                center: m.punto || workerCenter,
                                date: dateStr,
                                type: 'HORA_INCONSISTENTE',
                                severity: 'CRITICAL',
                                title: 'Secuencia horaria invertida',
                                description: `La salida (${m.hora}) es cronológicamente anterior a la entrada (${openEntry.hora}).`,
                                timestamp: new Date().toISOString(),
                                resolved: false
                            });
                        } else {
                            const intervalSec = sec - openEntry.seconds;
                            totalWorkedSeconds += intervalSec;
                            intervals.push({
                                entry: openEntry,
                                exit: m,
                                durationHours: +(intervalSec / 3600).toFixed(2),
                                centerEntry: openEntry.punto,
                                centerExit: m.punto
                            });
                        }
                    }
                    openEntry = null; // Cierra el turno
                }
            }
        });

        // Verificar si quedó una jornada abierta
        if (openEntry) {
            const now = new Date();
            const [d, m, y] = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-').reverse();
            const recordDate = new Date(`${y}-${m}-${d}T23:59:59`);
            const isToday = now.toDateString() === new Date(`${y}-${m}-${d}`).toDateString();

            if (!isToday && now > recordDate) {
                alerts.push({
                    id: `ALR-${workerId}-${dateStr}-OPEN-PAST`,
                    workerId,
                    workerName,
                    center: openEntry.punto || workerCenter,
                    date: dateStr,
                    type: 'ENTRADA_SIN_SALIDA',
                    severity: 'CRITICAL',
                    title: 'Jornada cerrada por sistema sin marcaje de salida',
                    description: `El trabajador fichó entrada a las ${openEntry.hora} pero nunca registró la salida en un día ya vencido.`,
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
            } else if (isToday) {
                const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const elapsedHours = (currentSeconds - openEntry.seconds) / 3600;
                if (elapsedHours > this.LIMITS.MAX_OPEN_SHIFT_HOURS) {
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-OPEN-EXCESS`,
                        workerId,
                        workerName,
                        center: openEntry.punto || workerCenter,
                        date: dateStr,
                        type: 'ENTRADA_SIN_SALIDA',
                        severity: 'WARNING',
                        title: 'Jornada activa excede tiempo estimado',
                        description: `Jornada abierta desde las ${openEntry.hora} (lleva ${elapsedHours.toFixed(1)} horas sin fichaje de salida).`,
                        timestamp: new Date().toISOString(),
                        resolved: false
                    });
                }
            }
        }

        // 4. REGLA: Exceso de jornada diaria (Límite legal estándar 9h / Especial 12h)
        const totalWorkedHours = +(totalWorkedSeconds / 3600).toFixed(2);
        const isSpecialShift = workerData.tipo_turno === '12H' || (cuadrante && cuadrante.horas >= 12);
        const maxAllowedHours = isSpecialShift ? this.LIMITS.SPECIAL_MAX_HOURS : this.LIMITS.STANDARD_MAX_HOURS;

        if (totalWorkedHours > maxAllowedHours) {
            alerts.push({
                id: `ALR-${workerId}-${dateStr}-EXCESS-HOURS`,
                workerId,
                workerName,
                center: workerCenter,
                date: dateStr,
                type: 'EXCESO_JORNADA_LEGAL',
                severity: totalWorkedHours > 12.0 ? 'CRITICAL' : 'WARNING',
                title: 'Jornada diaria superior al límite legal',
                description: `El acumulado registrado es de ${totalWorkedHours}h (límite establecido: ${maxAllowedHours}h).`,
                timestamp: new Date().toISOString(),
                resolved: false,
                meta: { totalWorkedHours, maxAllowedHours }
            });
        }

        // 5. REGLA: Solapamientos entre centros o proyectos
        for (let i = 0; i < intervals.length - 1; i++) {
            const intA = intervals[i];
            const intB = intervals[i + 1];
            if (intA.centerExit && intB.centerEntry && intA.centerExit !== intB.centerEntry) {
                const secExitA = this.timeToSeconds(intA.exit.hora);
                const secEntryB = this.timeToSeconds(intB.entry.hora);
                if (secExitA !== null && secEntryB !== null) {
                    const diffMinutes = (secEntryB - secExitA) / 60;
                    if (diffMinutes < 10) {
                        alerts.push({
                            id: `ALR-${workerId}-${dateStr}-OVL-${i}`,
                            workerId,
                            workerName,
                            center: `${intA.centerExit} / ${intB.centerEntry}`,
                            date: dateStr,
                            type: 'SOLAPAMIENTO_CENTROS',
                            severity: 'CRITICAL',
                            title: 'Solapamiento o desplazamiento imposible entre centros',
                            description: `Salida de "${intA.centerExit}" (${intA.exit.hora}) y entrada en "${intB.centerEntry}" (${intB.entry.hora}) con sólo ${Math.round(diffMinutes)} min de diferencia.`,
                            timestamp: new Date().toISOString(),
                            resolved: false
                        });
                    }
                }
            }
        }

        // 6. REGLA: Geolocalización fuera de rango y asignación de centro
        normalizedMarcajes.forEach((m, idx) => {
            if (m.lat && m.lon && workerData.centerLat && workerData.centerLon) {
                const distance = this.calculateDistanceMeters(m.lat, m.lon, workerData.centerLat, workerData.centerLon);
                if (distance > this.LIMITS.MAX_DISTANCE_METERS) {
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-GEO-${idx}`,
                        workerId,
                        workerName,
                        center: m.punto || workerCenter,
                        date: dateStr,
                        type: 'GEO_FUERA_RANGO',
                        severity: distance > 1000 ? 'CRITICAL' : 'WARNING',
                        title: 'Fichaje fuera de radio geolocalizado',
                        description: `Fichaje realizado a ${Math.round(distance)}m del centro asignado (máx permitido: ${this.LIMITS.MAX_DISTANCE_METERS}m).`,
                        timestamp: new Date().toISOString(),
                        resolved: false,
                        meta: { distanceMeters: Math.round(distance) }
                    });
                }
            }

            // Inconsistencia de centro
            if (m.punto && workerCenter && !workerCenter.includes('Multicliente')) {
                const pClean = m.punto.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cClean = workerCenter.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (pClean.length > 5 && cClean.length > 5 && !pClean.includes(cClean.slice(0, 8)) && !cClean.includes(pClean.slice(0, 8))) {
                    alerts.push({
                        id: `ALR-${workerId}-${dateStr}-CTR-${idx}`,
                        workerId,
                        workerName,
                        center: m.punto,
                        date: dateStr,
                        type: 'CENTRO_NO_ASIGNADO',
                        severity: 'INFO',
                        title: 'Marcaje en centro no habitual',
                        description: `Fichó en "${m.punto}" siendo su centro principal registrado "${workerCenter}".`,
                        timestamp: new Date().toISOString(),
                        resolved: false
                    });
                }
            }
        });

        // 7. REGLA: Cuadrante sin fichar / Retraso injustificado (+15 min)
        if (cuadrante && cuadrante.inicio) {
            const cuadSec = this.timeToSeconds(cuadrante.inicio);
            if (cuadSec !== null) {
                if (normalizedMarcajes.length === 0) {
                    // No hay marcajes
                    const now = new Date();
                    const [d, m, y] = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-').reverse();
                    const shiftStart = new Date(`${y}-${m}-${d}T${cuadrante.inicio}:00`);
                    if (now > new Date(shiftStart.getTime() + this.LIMITS.MAX_DELAY_MINUTES * 60000)) {
                        alerts.push({
                            id: `ALR-${workerId}-${dateStr}-NO-SHOW`,
                            workerId,
                            workerName,
                            center: workerCenter,
                            date: dateStr,
                            type: 'AUSENCIA_NO_FICHADO',
                            severity: 'CRITICAL',
                            title: 'Ausencia en turno programado / Sin fichar',
                            description: `Tenía turno previsto a las ${cuadrante.inicio} y no consta ningún marcaje registrado (+15 min de demora).`,
                            timestamp: new Date().toISOString(),
                            resolved: false
                        });
                    }
                } else {
                    // Primer marcaje de entrada comparado con inicio previsto
                    const firstEntry = normalizedMarcajes.find(m => (m.tipo || '').toLowerCase().includes('entrada') || m.isEntrada);
                    if (firstEntry) {
                        const entrySec = this.timeToSeconds(firstEntry.hora);
                        if (entrySec !== null) {
                            const delayMin = Math.round((entrySec - cuadSec) / 60);
                            if (delayMin > this.LIMITS.MAX_DELAY_MINUTES) {
                                alerts.push({
                                    id: `ALR-${workerId}-${dateStr}-DELAY`,
                                    workerId,
                                    workerName,
                                    center: firstEntry.punto || workerCenter,
                                    date: dateStr,
                                    type: 'RETRASO_INJUSTIFICADO',
                                    severity: delayMin > 60 ? 'CRITICAL' : 'WARNING',
                                    title: 'Retraso de entrada superior al umbral',
                            description: `Turno previsto a las ${cuadrante.inicio}, entrada realizada a las ${firstEntry.hora} (${delayMin} min de retraso).`,
                                    timestamp: new Date().toISOString(),
                                    resolved: false,
                                    meta: { delayMinutes: delayMin }
                                });
                            }
                        }
                    }
                }
            }
        }

        return {
            isValid: alerts.filter(a => a.severity === 'CRITICAL').length === 0,
            hasWarnings: alerts.filter(a => a.severity === 'WARNING').length > 0,
            totalWorkedHours,
            alertsCount: alerts.length,
            alerts
        };
    }
}

module.exports = new TimeTrackingValidator();
