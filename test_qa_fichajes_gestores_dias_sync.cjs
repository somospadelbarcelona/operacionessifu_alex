/**
 * CERTIFICACIÓN QA EXHAUSTIVA:
 * Control Horario, Sincronización HO-SAP & CTI, Censo Oficial 9 Gestores BCN y Filtrado por Días.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const timeTrackingService = require('./backend/services/timeTrackingService');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  [PASS] ${name}`);
    } catch (err) {
        failedTests++;
        console.error(`  [FAIL] ${name}: ${err.message}`);
    }
}

// Mock DOM autónomo
class MockClassList {
    constructor() { this.classes = new Set(); }
    add(...cls) { cls.forEach(c => this.classes.add(c)); }
    remove(...cls) { cls.forEach(c => this.classes.delete(c)); }
    contains(cls) { return this.classes.has(cls); }
    toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.classList = new MockClassList();
        this.style = {};
        this._innerHTML = '';
        this.children = [];
        this.parentElement = null;
        this.value = '';
        this.textContent = '';
        this.attributes = {};
        this.eventListeners = {};
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
    removeAttribute(k) { delete this.attributes[k]; }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
        this._innerHTML = val;
        this.children = [];
        const idMatches = val.matchAll(/id=["']([^"']+)["']/g);
        for (const match of idMatches) {
            const child = new MockElement('div');
            child.id = match[1];
            child.parentElement = this;
            this.children.push(child);
        }
    }
    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }
    addEventListener(event, handler) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(handler);
    }
    querySelector(selector) {
        if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (this.id === id) return this;
            for (const child of this.children) {
                if (child.id === id) return child;
                const found = child.querySelector(selector);
                if (found) return found;
            }
        }
        return null;
    }
}

async function runAll() {
    console.log('================================================================');
    console.log('BATERÍA QA: SINCRONIZACIÓN HO-SAP & CTI, GESTORES Y DÍAS (BCN 0801)');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // ÁREA 1: CENSO COMPLETO DE LOS 9 GESTORES OFICIALES (680 TRABAJADORES)
    // -------------------------------------------------------------
    console.log('--- 1. CENSO OFICIAL DE LOS 9 GESTORES (680 TRABAJADORES) ---');

    const GESTORES_ESPERADOS = [
        { id: '00065945', nombre: 'LIANA GARAYSHINA', corto: 'Liana Garayshina', censo: 127 },
        { id: '00060598', nombre: 'JORDI GIMENEZ FERRER', corto: 'Jordi Giménez', censo: 127 },
        { id: '00015251', nombre: 'ALBERT SANCHEZ PADROSA', corto: 'Albert Sánchez', censo: 124 },
        { id: '00001370', nombre: 'JULIO ORTIZ SANCHEZ', corto: 'Julio Ortiz', censo: 120 },
        { id: '00010085', nombre: 'JOSE GARCIA QUESADA', corto: 'José García', censo: 75 },
        { id: '00027631', nombre: 'ALBA VALVERDE CEREZO', corto: 'Alba Valverde', censo: 60 },
        { id: '00063967', nombre: 'ADRIÀ SERRANO VIU', corto: 'Adrià Serrano', censo: 26 },
        { id: '00066957', nombre: 'SONIA CAÑETE CÁRDENAS PERAL', corto: 'Sonia Cañete', censo: 11 },
        { id: '00062620', nombre: 'ALEJANDRO COSCOLIN PEREGRÍN', corto: 'Alejandro Coscolin', censo: 10 }
    ];

    await test('1.1 Backend: Censo total suma exactamente 680 trabajadores', async () => {
        const res = await timeTrackingService.getRecords({ mes: '2026-11', limit: 1000 });
        assert.strictEqual(res.total, 680, `El censo total debe ser 680, se obtuvo ${res.total}`);
        assert.strictEqual(res.records.length, 680, 'Deben devolverse los 680 registros completos');
    });

    for (const g of GESTORES_ESPERADOS) {
        await test(`1.2 Backend: Gestor ${g.corto} tiene exactamente ${g.censo} trabajadores`, async () => {
            const byId = await timeTrackingService.getRecords({ mes: '2026-11', gestor: g.id, limit: 1000 });
            assert.strictEqual(byId.total, g.censo, `Gestor ${g.corto} por ID debe tener ${g.censo}, se obtuvo ${byId.total}`);

            const byName = await timeTrackingService.getRecords({ mes: '2026-11', gestor: g.corto, limit: 1000 });
            assert.strictEqual(byName.total, g.censo, `Gestor ${g.corto} por Nombre Corto debe tener ${g.censo}, se obtuvo ${byName.total}`);
        });
    }

    // -------------------------------------------------------------
    // ÁREA 2: FILTRADO POR DÍAS (HOY, AYER, TODO EL MES, ESPECÍFICOS)
    // -------------------------------------------------------------
    console.log('\n--- 2. FILTRADO POR DÍAS Y COMPUTACIÓN DE JORNADAS ---');

    await test('2.1 Backend: Consulta por día específico ("02" / Hoy) devuelve horas y estados', async () => {
        const resDay02 = await timeTrackingService.getRecords({ mes: '2026-11', dia: '02', limit: 680 });
        assert.strictEqual(resDay02.total, 680, 'Debe devolver 680 registros para el día 02');

        let conFichaje = 0;
        let sinFichaje = 0;
        let bajas = 0;
        let descansos = 0;

        resDay02.records.forEach(r => {
            assert(r.dni, 'Cada registro debe tener DNI');
            assert(r.nombre, 'Cada registro debe tener Nombre');
            assert(r.gestor_id, 'Cada registro debe tener Gestor ID');
            assert(r.gestor_corto, 'Cada registro debe tener Gestor Corto');

            if (r.en_baja || r.isBaja || r.estado_dia === 'BAJA_IT') bajas++;
            else if (r.estado_dia === 'COMPLETO' || r.estado_dia === 'EN_CURSO') conFichaje++;
            else if (r.estado_dia === 'DESCANSO') descansos++;
            else sinFichaje++;
        });

        assert(conFichaje > 0, 'Debe haber trabajadores con fichajes hoy');
        assert(bajas > 0, 'Debe haber trabajadores en baja IT detectados');
    });

    await test('2.2 Backend: Consulta por día "01" (Ayer / Domingo festivo)', async () => {
        const resDay01 = await timeTrackingService.getRecords({ mes: '2026-11', dia: '01', limit: 680 });
        assert.strictEqual(resDay01.total, 680, 'Debe devolver 680 registros para el día 01');
        assert(resDay01.records.some(r => r.estado_dia === 'DESCANSO' || r.estado_dia === 'COMPLETO'),
            'El día 01 debe contemplar jornadas de descanso y servicios de guardia');
    });

    await test('2.3 Backend: Consulta con dia="all" (Todo el mes)', async () => {
        const resAll = await timeTrackingService.getRecords({ mes: '2026-11', dia: 'all', limit: 680 });
        assert.strictEqual(resAll.total, 680, 'Debe devolver 680 registros acumulados');
        assert(resAll.records.every(r => typeof r.horas_mes === 'number' || typeof r.horas === 'number'),
            'Todos los registros deben tener horas mensuales computadas');
    });

    // -------------------------------------------------------------
    // ÁREA 3: CANALES DE FICHAJE (CTI / APP / TERMINAL / BIOMÉTRICO)
    // -------------------------------------------------------------
    console.log('\n--- 3. IDENTIFICACIÓN Y TRAZABILIDAD DE CANALES OPERATIVOS ---');

    await test('3.1 Backend: Identificación de canal CTI telefónico, APP móvil y TERMINAL', async () => {
        const res = await timeTrackingService.getRecords({ mes: '2026-11', limit: 680 });
        const channels = new Set();
        res.records.forEach(r => {
            const ch = r.canal || r.origenCanal || (r.ultimo_fichaje && r.ultimo_fichaje.canal);
            if (ch) channels.add(ch.toUpperCase());
        });

        assert(channels.has('CTI'), 'Debe existir el canal telefónico CTI');
        assert(channels.has('APP'), 'Debe existir el canal móvil APP');
        assert(channels.has('BIOMETRICO') || channels.has('TERMINAL'), 'Debe existir el canal biométrico / terminal');
    });

    await test('3.2 Backend: Filtrado por canal en getRecords (canal=CTI)', async () => {
        const ctiRes = await timeTrackingService.getRecords({ mes: '2026-11', canal: 'CTI', limit: 680 });
        assert(ctiRes.total > 0, 'Debe haber trabajadores asignados al canal CTI');
        ctiRes.records.forEach(r => {
            const c = (r.canal || r.origenCanal || '').toUpperCase();
            assert(c.includes('CTI'), `El registro debe pertenecer al canal CTI, se obtuvo ${c}`);
        });
    });

    // -------------------------------------------------------------
    // ÁREA 4: SINCRONIZACIÓN DUAL HO-SAP Y CTI
    // -------------------------------------------------------------
    console.log('\n--- 4. SINCRONIZACIÓN DUAL HO-SAP Y CTI TELEPHONY ---');

    await test('4.1 Telemetría de estado de sincronización (getSyncStatus)', async () => {
        const status = timeTrackingService.getSyncStatus();
        assert(status, 'El estado de sincronización no puede ser nulo');
        assert(status.sap, 'Debe contener telemetría sap');
        assert.strictEqual(status.sap.connected, true, 'SAP HO debe estar conectado');
        assert.strictEqual(status.sap.status, 'ONLINE', 'SAP HO debe reportar ONLINE');
        assert.strictEqual(status.sap.division, '0801 - BARCELONA', 'Delegación debe ser 0801 - BARCELONA');

        assert(status.cti, 'Debe contener telemetría cti');
        assert.strictEqual(status.cti.active, true, 'CTI debe estar activo');
        assert.strictEqual(status.cti.status, 'OPERATIONAL', 'CTI debe reportar OPERATIONAL');
        assert(status.cti.channel.includes('CTI'), 'Canal CTI debe estar identificado');

        assert(status.syncMonitor, 'Debe contener syncMonitor');
        assert.strictEqual(status.syncMonitor.workersMonitored, 680, 'Deben monitorizarse 680 trabajadores');
    });

    await test('4.2 Disparo de sincronización manual dual', async () => {
        const syncRes = await timeTrackingService.syncManual();
        assert.strictEqual(syncRes.success, true, 'syncManual debe ser exitoso');
        assert.strictEqual(syncRes.sapSynced, true, 'SAP HO debe sincronizarse');
        assert.strictEqual(syncRes.ctiSynced, true, 'CTI debe sincronizarse');
        assert(syncRes.recordsProcessed >= 680, 'Deben procesarse los 680 trabajadores');
    });

    // -------------------------------------------------------------
    // ÁREA 5: INTEGRACIÓN FRONTEND & UI ENTERPRISE
    // -------------------------------------------------------------
    console.log('\n--- 5. INTEGRACIÓN FRONTEND & COMPORTAMIENTO DE INTERFAZ ---');

    await test('5.1 Frontend: El código de enterprise_platform.js contiene los selectores de día requeridos', () => {
        const code = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        assert(code.includes('ent-day-filter-bar'), 'Debe contener la barra de filtros por día');
        assert(code.includes('Todo el Mes'), 'Debe incluir opción Todo el Mes');
        assert(code.includes('Hoy (Día 02)'), 'Debe incluir botón Hoy');
        assert(code.includes('Ayer (Día 01)'), 'Debe incluir botón Ayer');
        assert(code.includes('selectDay'), 'Debe implementar función selectDay()');
    });

    await test('5.2 Frontend: Etiquetas de canales CTI, App y Terminal presentes en renderizado', () => {
        const code = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        assert(code.includes('☎️ CTI'), 'Debe contener canal ☎️ CTI');
        assert(code.includes('📱 App'), 'Debe contener canal 📱 App');
        assert(code.includes('🏢 Terminal'), 'Debe contener canal 🏢 Terminal');
    });

    await test('5.3 Frontend: Monitor de sincronización HO-SAP y CTI presente en cabecera', () => {
        const code = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        assert(code.includes('ent-sync-monitor-strip'), 'Debe contener la tira de sincronización dual');
        assert(code.includes('SAP S/4HANA OData Gateway'), 'Debe contener caja SAP');
        assert(code.includes('CTI Telephony Engine'), 'Debe contener caja CTI');
        assert(code.includes('triggerHoSapCtiSync'), 'Debe incluir botón/función triggerHoSapCtiSync');
    });

    await test('5.4 Frontend: Censo 680 trabajadores y conteos exactos por cada gestor oficial', () => {
        // Simulación controlada del contexto de navegador
        const globalScope = {
            window: {},
            document: {
                getElementById: (id) => new MockElement('div'),
                querySelectorAll: () => [],
                createElement: (tag) => new MockElement(tag),
                head: new MockElement('head'),
                body: new MockElement('body')
            },
            localStorage: {
                store: {},
                getItem(k) { return this.store[k] || null; },
                setItem(k, v) { this.store[k] = String(v); }
            },
            fetch: async () => ({ ok: false }),
            console: console
        };
        globalScope.window = globalScope;

        // Inyectar datasets oficiales
        const cmhData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cmh_bcn_dataset.json'), 'utf-8'));
        globalScope.CMH_BCN_DATASET = cmhData;

        // Evaluar enterprise_platform.js en el entorno global simulado
        const code = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
        const evalFn = new Function('window', 'document', 'localStorage', 'fetch', code);
        evalFn(globalScope.window, globalScope.document, globalScope.localStorage, globalScope.fetch);

        assert(globalScope.window.SifuEnterprisePlatform, 'SifuEnterprisePlatform debe estar disponible globalmente');

        const workers = globalScope.window.SifuEnterprisePlatform.getConsolidatedWorkers();
        assert.strictEqual(workers.length, 680, `getConsolidatedWorkers debe devolver exactamente 680, devolvió ${workers.length}`);

        // Verificar el conteo de cada gestor en frontend
        for (const g of GESTORES_ESPERADOS) {
            const filtered = workers.filter(w => {
                const normTarget = g.corto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const wCorto = (w.gestor_corto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const wId = w.gestor_id || '';
                return wId === g.id || wCorto.includes(normTarget);
            });
            assert.strictEqual(filtered.length, g.censo, `En frontend, gestor ${g.corto} debe tener ${g.censo}, tiene ${filtered.length}`);
        }
    });

    console.log('\n================================================================');
    console.log(`TOTAL PRUEBAS EJECUTADAS: ${totalTests}`);
    console.log(`ÉXITO (PASS): ${passedTests}`);
    console.log(`FALLOS (FAIL): ${failedTests}`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAll().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
