/**
 * BATERÍA DE PRUEBAS QA AUTOMATIZADA - SIFU ENTERPRISE OPERATIONS PLATFORM
 * Auditoría Integral de Control Horario, Validación, Persistencia Multi-Mes y Frontend.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const timeTrackingService = require('./backend/services/timeTrackingService');
const validator = require('./backend/services/timeTrackingValidator');

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function runTest(testName, fn) {
    try {
        fn();
        passedTests++;
        testResults.push({ name: testName, status: 'PASS' });
        console.log(`  [PASS] ${testName}`);
    } catch (err) {
        failedTests++;
        testResults.push({ name: testName, status: 'FAIL', error: err.message });
        console.error(`  [FAIL] ${testName}: ${err.message}`);
    }
}

async function runAsyncTest(testName, fn) {
    try {
        await fn();
        passedTests++;
        testResults.push({ name: testName, status: 'PASS' });
        console.log(`  [PASS] ${testName}`);
    } catch (err) {
        failedTests++;
        testResults.push({ name: testName, status: 'FAIL', error: err.message });
        console.error(`  [FAIL] ${testName}: ${err.message}`);
    }
}

async function main() {
    console.log('================================================================');
    console.log('AUDITORÍA QA: SIFU ENTERPRISE OPERATIONS PLATFORM');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // ÁREA 1: CONTROL HORARIO Y PERSISTENCIA MULTI-MES
    // -------------------------------------------------------------
    console.log('--- 1. CONTROL HORARIO INTELIGENTE Y PERSISTENCIA MULTI-MES ---');

    runTest('1.1 Listado de meses disponibles incluye meses clave', () => {
        const months = timeTrackingService.getAvailableMonths();
        assert(Array.isArray(months), 'getAvailableMonths debe devolver un array');
        assert(months.includes('2026-10'), 'Debe incluir 2026-10');
        assert(months.includes('2026-11'), 'Debe incluir 2026-11');
    });

    runTest('1.2 Carga de datos de mes 2026-10 sin errores y con estructura requerida', () => {
        const dataOct = timeTrackingService.loadMonthData('2026-10');
        assert(dataOct, 'Dataset 2026-10 debe existir');
        assert(Array.isArray(dataOct.trabajadores), 'Debe contener array de trabajadores');
        assert(dataOct.trabajadores.length > 0, 'Debe haber trabajadores en 2026-10');
    });

    runTest('1.3 Carga de datos de mes 2026-11 sin errores y con estructura requerida', () => {
        const dataNov = timeTrackingService.loadMonthData('2026-11');
        assert(dataNov, 'Dataset 2026-11 debe existir');
        assert(Array.isArray(dataNov.trabajadores), 'Debe contener array de trabajadores');
    });

    runTest('1.4 Aislamiento estricto entre meses (Modificación en 2026-11 no muta 2026-10)', () => {
        const dataOctBefore = timeTrackingService.loadMonthData('2026-10');
        const octWorkersCount = dataOctBefore.trabajadores.length;

        // Cargar 2026-11 y añadir trabajador dummy temporal
        const dataNov = timeTrackingService.loadMonthData('2026-11');
        const testDni = 'QA-TEST-ISO-999';
        const dummyWorker = {
            dni: testDni,
            id_empleado: testDni,
            nombre: 'Trabajador QA Aislamiento',
            servicio: 'Centro Test',
            meses: { '2026-11': { dias: { '01': { marcajes: [] } } } }
        };
        dataNov.trabajadores.push(dummyWorker);
        timeTrackingService.saveMonthData('2026-11', dataNov);

        // Recargar 2026-10 y verificar que no ha cambiado
        const dataOctAfter = timeTrackingService.loadMonthData('2026-10');
        assert.strictEqual(dataOctAfter.trabajadores.length, octWorkersCount, 'El conteo en 2026-10 debe permanecer invariable');
        assert(!dataOctAfter.trabajadores.some(w => w.dni === testDni), 'El trabajador dummy no debe existir en 2026-10');

        // Limpiar dummy de 2026-11
        const dataNovClean = timeTrackingService.loadMonthData('2026-11');
        dataNovClean.trabajadores = dataNovClean.trabajadores.filter(w => w.dni !== testDni);
        timeTrackingService.saveMonthData('2026-11', dataNovClean);
    });

    await runAsyncTest('1.5 Sincronización Delta (5 min) actualiza estado del monitor de sincro', async () => {
        const deltaRes = await timeTrackingService.syncDelta();
        assert(deltaRes.success, 'Sync delta debe retornar success');
        const status = timeTrackingService.getSyncStatus();
        assert.strictEqual(status.status, 'HEALTHY', 'El estado del monitor debe ser HEALTHY');
        assert(status.lastSyncIso, 'Debe registrar lastSyncIso');
    });

    await runAsyncTest('1.6 Sincronización Manual forzada bajo demanda', async () => {
        const manualRes = await timeTrackingService.syncManual({ mes: '2026-10', tipo: 'manual' });
        assert(manualRes.success, 'Sync manual debe retornar success');
        assert(typeof manualRes.workersProcessed === 'number', 'Debe reportar trabajadores procesados');
    });

    console.log('\n--- 2. MOTOR DE VALIDACIÓN DE FICHAJES (8 REGLAS) ---');

    const baseWorker = {
        id_empleado: 'EMP-001',
        dni: '12345678A',
        nombre: 'Juan Pérez Test',
        servicio: 'Sede Central Barcelona',
        centerLat: 41.3879,
        centerLon: 2.16992
    };

    runTest('2.1 Regla 1: Entrada sin salida en jornada pasada (CRITICAL) y consecutivas (WARNING)', () => {
        // Entradas consecutivas en el mismo día
        const marcajesConsecutivos = [
            { hora: '08:00:00', tipo: 'Entrada', punto: 'Sede Central Barcelona' },
            { hora: '09:00:00', tipo: 'Entrada', punto: 'Sede Central Barcelona' }
        ];
        const res1 = validator.validateDailyRecords(baseWorker, '01/10/2026', marcajesConsecutivos);
        const alrConsec = res1.alerts.find(a => a.type === 'ENTRADA_SIN_SALIDA');
        assert(alrConsec, 'Debe generar alerta ENTRADA_SIN_SALIDA');
        assert.strictEqual(alrConsec.severity, 'WARNING', 'Entrada consecutiva debe ser WARNING');

        // Entrada huérfana en día pasado
        const marcajeSoloEntrada = [
            { hora: '08:00:00', tipo: 'Entrada', punto: 'Sede Central Barcelona' }
        ];
        const res2 = validator.validateDailyRecords(baseWorker, '01/10/2026', marcajeSoloEntrada);
        const alrPast = res2.alerts.find(a => a.id.includes('OPEN-PAST'));
        assert(alrPast, 'Debe generar alerta de jornada cerrada por sistema');
        assert.strictEqual(alrPast.severity, 'CRITICAL', 'Jornada pasada sin salida debe ser CRITICAL');
    });

    runTest('2.2 Regla 2: Salida sin entrada previa (CRITICAL)', () => {
        const marcajes = [
            { hora: '14:00:00', tipo: 'Salida', punto: 'Sede Central Barcelona' }
        ];
        const res = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajes);
        const alr = res.alerts.find(a => a.type === 'SALIDA_SIN_ENTRADA');
        assert(alr, 'Debe generar alerta SALIDA_SIN_ENTRADA');
        assert.strictEqual(alr.severity, 'CRITICAL', 'Salida sin entrada debe ser CRITICAL');
    });

    runTest('2.3 Regla 3: Exceso de jornada diaria (>9h WARNING, >12h CRITICAL)', () => {
        // Caso 10 horas (> 9h -> WARNING)
        const marcajes10h = [
            { hora: '08:00:00', tipo: 'Entrada' },
            { hora: '18:00:00', tipo: 'Salida' }
        ];
        const res10 = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajes10h);
        const alr10 = res10.alerts.find(a => a.type === 'EXCESO_JORNADA_LEGAL');
        assert(alr10, 'Debe generar alerta de exceso de jornada para 10h');
        assert.strictEqual(alr10.severity, 'WARNING', '10 horas debe generar severidad WARNING');

        // Caso 13 horas (> 12h -> CRITICAL)
        const marcajes13h = [
            { hora: '07:00:00', tipo: 'Entrada' },
            { hora: '20:00:00', tipo: 'Salida' }
        ];
        const res13 = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajes13h);
        const alr13 = res13.alerts.find(a => a.type === 'EXCESO_JORNADA_LEGAL');
        assert(alr13, 'Debe generar alerta de exceso de jornada para 13h');
        assert.strictEqual(alr13.severity, 'CRITICAL', '13 horas debe generar severidad CRITICAL');
    });

    runTest('2.4 Regla 4: Fichajes duplicados (<3 minutos) (WARNING)', () => {
        const marcajesDup = [
            { hora: '08:00:00', tipo: 'Entrada' },
            { hora: '08:01:30', tipo: 'Entrada' }, // 90 segundos de diferencia
            { hora: '16:00:00', tipo: 'Salida' }
        ];
        const res = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajesDup);
        const alr = res.alerts.find(a => a.type === 'FICHAJE_DUPLICADO');
        assert(alr, 'Debe detectar fichajes duplicados con <3 min de diferencia');
        assert.strictEqual(alr.severity, 'WARNING', 'Duplicado debe ser WARNING');
    });

    runTest('2.5 Regla 5: Solapamiento entre centros / Desplazamiento imposible (CRITICAL)', () => {
        const marcajesCentros = [
            { hora: '08:00:00', tipo: 'Entrada', punto: 'Hospital Bellvitge' },
            { hora: '12:00:00', tipo: 'Salida', punto: 'Hospital Bellvitge' },
            { hora: '12:04:00', tipo: 'Entrada', punto: 'Torre Diagonal SIFU' }, // Solo 4 min entre centros distintos
            { hora: '16:00:00', tipo: 'Salida', punto: 'Torre Diagonal SIFU' }
        ];
        const res = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajesCentros);
        const alr = res.alerts.find(a => a.type === 'SOLAPAMIENTO_CENTROS');
        assert(alr, 'Debe detectar solapamiento o desplazamiento imposible entre centros');
        assert.strictEqual(alr.severity, 'CRITICAL', 'Solapamiento de centros debe ser CRITICAL');
    });

    runTest('2.6 Regla 6: Horas inconsistentes / Formato corrupto / Secuencia invertida (CRITICAL)', () => {
        // Formato corrupto
        const marcajeCorrupto = [{ hora: '99:88:77', tipo: 'Entrada' }];
        const resCorrupto = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajeCorrupto);
        const alrCorrupto = resCorrupto.alerts.find(a => a.type === 'HORA_INCONSISTENTE');
        assert(alrCorrupto, 'Debe detectar formato corrupto');
        assert.strictEqual(alrCorrupto.severity, 'CRITICAL');

        // Secuencia invertida: salida antes de entrada
        const marcajeInvertido = [
            { hora: '17:00:00', tipo: 'Entrada' },
            { hora: '08:00:00', tipo: 'Salida' }
        ];
        const resInvertido = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajeInvertido);
        const alrInvertido = resInvertido.alerts.find(a => a.id.includes('INV'));
        assert(alrInvertido, 'Debe detectar secuencia horaria invertida');
        assert.strictEqual(alrInvertido.severity, 'CRITICAL');
    });

    runTest('2.7 Regla 7: Retraso >15 min vs cuadrante (WARNING/CRITICAL) y turno sin fichar (CRITICAL)', () => {
        const cuadrante = { inicio: '08:00', fin: '16:00', horas: 8 };

        // Retraso de 25 min -> WARNING
        const marcajeRetraso25 = [
            { hora: '08:25:00', tipo: 'Entrada' },
            { hora: '16:00:00', tipo: 'Salida' }
        ];
        const res25 = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajeRetraso25, cuadrante);
        const alr25 = res25.alerts.find(a => a.type === 'RETRASO_INJUSTIFICADO');
        assert(alr25, 'Debe detectar retraso > 15 min');
        assert.strictEqual(alr25.severity, 'WARNING', 'Retraso de 25 min debe ser WARNING');

        // Retraso de 75 min -> CRITICAL
        const marcajeRetraso75 = [
            { hora: '09:15:00', tipo: 'Entrada' },
            { hora: '17:00:00', tipo: 'Salida' }
        ];
        const res75 = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajeRetraso75, cuadrante);
        const alr75 = res75.alerts.find(a => a.type === 'RETRASO_INJUSTIFICADO');
        assert(alr75, 'Debe detectar retraso severo');
        assert.strictEqual(alr75.severity, 'CRITICAL', 'Retraso > 60 min debe ser CRITICAL');

        // Turno previsto en día pasado sin fichar -> CRITICAL
        const resNoShow = validator.validateDailyRecords(baseWorker, '01/10/2026', [], cuadrante);
        const alrNoShow = resNoShow.alerts.find(a => a.type === 'AUSENCIA_NO_FICHADO');
        assert(alrNoShow, 'Debe detectar ausencia en turno programado');
        assert.strictEqual(alrNoShow.severity, 'CRITICAL', 'Ausencia sin fichar debe ser CRITICAL');
    });

    runTest('2.8 Regla 8: Anomalías de geolocalización (>200m WARNING, >1000m CRITICAL, centro no asignado INFO)', () => {
        // A 350 metros (WARNING)
        // 1 grado latitud aprox 111km -> 0.00315 deg ~ 350m
        const marcaje350m = [
            { hora: '08:00:00', tipo: 'Entrada', lat: 41.3910, lon: 2.16992, punto: 'Sede Central Barcelona' },
            { hora: '16:00:00', tipo: 'Salida', lat: 41.3879, lon: 2.16992, punto: 'Sede Central Barcelona' }
        ];
        const res350 = validator.validateDailyRecords(baseWorker, '15/10/2026', marcaje350m);
        const alr350 = res350.alerts.find(a => a.type === 'GEO_FUERA_RANGO');
        assert(alr350, 'Debe detectar fuera de rango 350m');
        assert.strictEqual(alr350.severity, 'WARNING', 'Desviación moderada debe ser WARNING');

        // A 25 kilómetros (CRITICAL)
        const marcaje25km = [
            { hora: '08:00:00', tipo: 'Entrada', lat: 41.6000, lon: 2.3000, punto: 'Sede Central Barcelona' }
        ];
        const res25km = validator.validateDailyRecords(baseWorker, '15/10/2026', marcaje25km);
        const alr25km = res25km.alerts.find(a => a.type === 'GEO_FUERA_RANGO');
        assert(alr25km, 'Debe detectar fuera de rango severo');
        assert.strictEqual(alr25km.severity, 'CRITICAL', 'Desviación > 1000m debe ser CRITICAL');

        // Centro no habitual (INFO)
        const marcajeOtroCentro = [
            { hora: '08:00:00', tipo: 'Entrada', punto: 'Almacén Zona Franca Logística' }
        ];
        const resOtro = validator.validateDailyRecords(baseWorker, '15/10/2026', marcajeOtroCentro);
        const alrOtro = resOtro.alerts.find(a => a.type === 'CENTRO_NO_ASIGNADO');
        assert(alrOtro, 'Debe generar alerta de centro no habitual');
        assert.strictEqual(alrOtro.severity, 'INFO', 'Centro no asignado debe ser INFO');
    });

    console.log('\n--- 3. AUDITORÍA INMUTABLE DE MODIFICACIONES ---');

    await runAsyncTest('3.1 Rechazo de regularización si falta motivo justificado obligatorio', async () => {
        let threw = false;
        try {
            await timeTrackingService.adjustRecord('QA-TEST-ANY', {
                dia: '10',
                hora: '08:00',
                motivo: '' // Motivo vacío
            });
        } catch (e) {
            threw = true;
            assert(e.message.includes('motivo justificado'), 'El mensaje debe indicar motivo obligatorio');
        }
        assert(threw, 'Debe lanzar excepción si falta el motivo');
    });

    await runAsyncTest('3.2 Regularización exitosa con registro inmutable en audit_log.json', async () => {
        const dataset = timeTrackingService.loadMonthData('2026-10');
        assert(dataset.trabajadores.length > 0, 'Debe haber trabajadores en 2026-10');
        const targetWorker = dataset.trabajadores[0];
        const workerId = targetWorker.id_empleado || targetWorker.dni;

        const user = { id: 'USR-AUDITOR-01', name: 'Alejandro Coscolin', email: 'acoscolin@gruposifu.com' };
        const adjustResult = await timeTrackingService.adjustRecord(workerId, {
            mes: '2026-10',
            fecha: '2026-10-15',
            entrada: '07:45',
            salida: '15:45',
            motivo: 'Regularización por fallo de cobertura en lector de huella RFID',
            tipoAccion: 'SUBSANACION_COMPLETA'
        }, user);

        assert(adjustResult.success, 'La regularización debe ser exitosa');
        assert(adjustResult.audit, 'Debe retornar el objeto audit');
        assert.strictEqual(adjustResult.audit.userNombre, 'Alejandro Coscolin');
        assert.strictEqual(adjustResult.audit.motivoJustificado, 'Regularización por fallo de cobertura en lector de huella RFID');
        assert(adjustResult.audit.timestamp, 'Debe tener timestamp ISO');
        assert(adjustResult.audit.valorNuevo, 'Debe tener valor nuevo registrado');

        // Comprobar que persiste en el fichero audit_log.json
        const auditLogPath = path.join(__dirname, 'backend/data/audit_log.json');
        assert(fs.existsSync(auditLogPath), 'El fichero audit_log.json debe existir');
        const auditData = JSON.parse(fs.readFileSync(auditLogPath, 'utf-8'));
        const found = auditData.find(a => a.id === adjustResult.audit.id);
        assert(found, 'El registro de auditoría debe existir en audit_log.json');
    });

    runTest('3.3 Consulta paginada y filtrada del audit_log', () => {
        const logRes = timeTrackingService.getAuditLog({ page: 1, limit: 10 });
        assert(Array.isArray(logRes.logs), 'Debe devolver array de logs');
        assert(logRes.total > 0, 'Debe haber registros de auditoría');
        assert(logRes.pages >= 1, 'Debe reportar número de páginas');
    });

    console.log('\n--- 4. INTEGRACIÓN FRONTEND & EXPERIENCIA DE USUARIO ---');

    runTest('4.1 index.html incluye los enlaces requeridos a enterprise_platform.css y enterprise_platform.js', () => {
        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        assert(indexHtml.includes('enterprise_platform.css'), 'index.html debe enlazar enterprise_platform.css');
        assert(indexHtml.includes('enterprise_platform.js'), 'index.html debe cargar enterprise_platform.js');
    });

    runTest('4.2 enterprise_platform.js define los 10 módulos corporativos requeridos', () => {
        const jsCode = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        const requiredModules = [
            'war_room',
            'time_tracking',
            'operations',
            'hr_360',
            'billing_profit',
            'ai_predictive',
            'power_bi',
            'sap_gateway',
            'alerts_center',
            'security_audit'
        ];

        requiredModules.forEach(mod => {
            assert(jsCode.includes(mod), `enterprise_platform.js debe contener el módulo ${mod}`);
        });

        // Verificar Centro de Control Operativo War Room con KPIs
        assert(jsCode.includes('Centro de Control Operativo'), 'Debe incluir módulo War Room');
        assert(jsCode.includes('Control Horario Inteligente'), 'Debe incluir módulo Control Horario');
    });

    runTest('4.3 Compatibilidad del Adaptador de Datos con respuestas data, records y trabajadores', () => {
        const jsCode = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        assert(jsCode.includes('json.data || json.records || json.trabajadores'),
            'fetchTimeTrackingData debe contemplar json.data, json.records y json.trabajadores');
    });

    runTest('4.4 Rendimiento: Simulación de procesamiento de 500 trabajadores con 30 días de fichajes', () => {
        const simulatedWorkers = [];
        for (let i = 0; i < 500; i++) {
            const diasObj = {};
            for (let d = 1; d <= 22; d++) { // 22 días laborables
                const dayKey = String(d).padStart(2, '0');
                diasObj[dayKey] = {
                    marcajes: [
                        { hora: '08:00:00', tipo: 'Entrada', punto: 'Centro SIFU' },
                        { hora: '16:00:00', tipo: 'Salida', punto: 'Centro SIFU' }
                    ]
                };
            }
            simulatedWorkers.push({
                id_empleado: `SIM-${i}`,
                dni: `0000000${i}X`,
                nombre: `Trabajador Simulado ${i}`,
                servicio: 'Centro SIFU',
                meses: {
                    '2026-10': { dias: diasObj }
                }
            });
        }

        const start = performance.now();
        const alerts = timeTrackingService.runValidationEngine({ trabajadores: simulatedWorkers }, '2026-10');
        const elapsed = performance.now() - start;

        console.log(`     -> Procesados 500 trabajadores (11.000 jornadas) en ${elapsed.toFixed(1)} ms`);
        assert(elapsed < 1000, `El tiempo de procesamiento debe ser inferior a 1000ms (obtenido: ${elapsed.toFixed(1)} ms)`);
        assert(Array.isArray(alerts), 'Debe devolver array de alertas');
    });

    console.log('\n================================================================');
    console.log(`TOTAL PRUEBAS EJECUTADAS: ${passedTests + failedTests}`);
    console.log(`ÉXITO (PASS): ${passedTests}`);
    console.log(`FALLOS (FAIL): ${failedTests}`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error en batería de pruebas:', err);
    process.exit(1);
});
