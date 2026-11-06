const fs = require('fs');

class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.style = {};
        this.children = [];
        this.parentElement = null;
        this.classList = {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        };
    }
    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }
    insertBefore(newChild, refChild) {
        const idx = this.children.indexOf(refChild);
        if (idx !== -1) {
            this.children.splice(idx, 0, newChild);
        } else {
            this.children.push(newChild);
        }
        newChild.parentElement = this;
        return newChild;
    }
    remove() {
        if (this.parentElement) {
            const idx = this.parentElement.children.indexOf(this);
            if (idx !== -1) this.parentElement.children.splice(idx, 1);
        }
    }
    setAttribute(k, v) { this[k] = v; }
    getAttribute(k) { return this[k]; }
}

const elementsMap = {};
function getOrCreate(id) {
    if (!elementsMap[id]) elementsMap[id] = new MockElement(id);
    return elementsMap[id];
}

global.document = {
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => new MockElement('', tag),
    querySelector: () => new MockElement(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: new MockElement('body', 'body')
};

global.window = global;
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

// Cargar datos oficiales de carteras
require('./ho_carteras_data.js');

// Configurar estado
window.AppState = {
    activeTab: 'todos',
    gestorFilter: 'todos',
    monitorGestorFilter: 'todos',
    searchQuery: '',
    empresaFilter: 'todas',
    modoCartera: 'todos',
    sectorFilter: 'todos',
    comarcaFilter: 'todas',
    statusFilter: 'todos',
    logs: []
};

// Cargar apps
require('./supervisor_panel.js');
require('./girona_pro_app.js');

console.log('================================================================');
console.log('TEST QA REACTIVIDAD DE GESTOR: SUPERVISOR & MONITOR SAP HO');
console.log('================================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log('  [PASS] ' + message);
        passed++;
    } else {
        console.error('  [FAIL] ' + message);
        failed++;
    }
}

// TEST 1: Cambiar a Adrià Serrano (00063967) en Supervisor HO
console.log('\n--- 1. Cambio a Gestor con Descubiertos/Riesgos: Adrià Serrano (00063967) ---');
window.cambiarGestorSupervisor('00063967');

const chipDesc = getOrCreate('chip-descubiertos-val').textContent;
const kpiDesc = getOrCreate('kpi-val-descubiertos').textContent;
const kpiBajas = getOrCreate('kpi-val-bajas').textContent;
const kpiProys = getOrCreate('kpi-val-servicios').textContent;
const descTbody = getOrCreate('supervisor-descubiertos-tbody').innerHTML;
const proysTbody = getOrCreate('supervisor-proyectos-tbody').innerHTML;

assert(String(kpiProys) === '153', `Proyectos actualizados a 153 (obtenido: ${kpiProys})`);
assert(String(kpiDesc) === '14', `Riesgos/descubiertos actualizados a 14 (obtenido: ${kpiDesc})`);
assert(String(kpiBajas) === '8', `Bajas IT actualizadas a 8 (obtenido: ${kpiBajas})`);
assert(descTbody.includes('badge-alta') || descTbody.includes('badge-critica'), 'Tabla de descubiertos contiene alertas activas');
assert(descTbody.includes('Proponer Suplencia en HO'), 'Botón Proponer Suplencia en HO presente en descubiertos');
assert(proysTbody.includes('Entrar al Proyecto HO'), 'Tabla de proyectos contiene accesos a proyectos SAP HO');
assert(window.AppState.gestorFilter === '00063967', 'AppState.gestorFilter sincronizado a 00063967');

// TEST 2: Cambiar a Alejandro Coscolín (00062620) en Supervisor HO
console.log('\n--- 2. Cambio a Responsable Operativo sin Descubiertos: Alejandro Coscolín (00062620) ---');
window.cambiarGestorSupervisor('00062620');

const kpiDesc2 = getOrCreate('kpi-val-descubiertos').textContent;
const descTbody2 = getOrCreate('supervisor-descubiertos-tbody').innerHTML;

assert(String(kpiDesc2) === '0', `Riesgos/descubiertos actualizados a 0 (obtenido: ${kpiDesc2})`);
assert(descTbody2.includes('0 Descubiertos activos para Alejandro Coscolin'), 'Muestra banner verde de 0 descubiertos cubiertos al 100%');
assert(window.AppState.gestorFilter === '00062620', 'AppState.gestorFilter sincronizado a 00062620');

// TEST 3: Cambiar a Delegación Barcelona Completa (todos)
console.log('\n--- 3. Cambio a Toda Barcelona (0801) ---');
window.cambiarGestorSupervisor('todos');

const kpiServTodos = getOrCreate('kpi-val-servicios').textContent;
const chipPlanTodos = getOrCreate('chip-plantilla-val').textContent;
assert(kpiServTodos === '704', `Proyectos Barcelona actualizados a 704 (obtenido: ${kpiServTodos})`);
assert(chipPlanTodos === '~480', `Plantilla Barcelona actualizada a ~480 (obtenido: ${chipPlanTodos})`);

// TEST 4: Cambiar a Consolidado Nacional (nacional)
console.log('\n--- 4. Cambio a Consolidado Nacional (nacional) ---');
window.cambiarGestorSupervisor('nacional');

const kpiServNac = getOrCreate('kpi-val-servicios').textContent;
const chipPlanNac = getOrCreate('chip-plantilla-val').textContent;
assert(kpiServNac === '4.520', `Proyectos Nacional actualizados a 4.520 (obtenido: ${kpiServNac})`);
assert(chipPlanNac === '8.350', `Plantilla Nacional actualizada a 8.350 (obtenido: ${chipPlanNac})`);

// TEST 5: Reactividad en 2.1 Monitor SAP HO
console.log('\n--- 5. Reactividad de Gestor en 2.1 Monitor SAP HO ---');
window.SifuEnterprisePlatform = {
    isEnterpriseActive: true,
    getActiveModule: () => 'sap_ho'
};
window.EnterpriseState = {
    activeModule: 'sap_ho',
    sapSubTab: 'ho_sync'
};

const subContainer = getOrCreate('ent-sap-sub-container');
window.ProApp.setMonitorGestor('00063967');

assert(window.AppState.monitorGestorFilter === '00063967', 'AppState.monitorGestorFilter actualizado a 00063967');
assert(subContainer.innerHTML.includes('ADRIÀ SERRANO VIU'), 'Sub-contenedor 2.1 Monitor SAP HO re-renderizado con el nombre del gestor');
assert(subContainer.innerHTML.includes('153'), 'Sub-contenedor 2.1 Monitor SAP HO muestra los 153 proyectos del gestor');

console.log('\n================================================================');
console.log(`TOTAL PRUEBAS: ${passed + failed} | SUPERADAS: ${passed} | FALLIDAS: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
process.exit(0);
