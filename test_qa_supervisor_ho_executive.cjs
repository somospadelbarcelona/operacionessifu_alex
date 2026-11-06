const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('TEST QA CERTIFICACIÓN: 2.2 SUPERVISOR HO EJECUTIVO (NACIONAL & BCN)');
console.log('Dirección de Operaciones Grupo SIFU · SAP S/4HANA Suite');
console.log('================================================================\n');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// 1. Mock minimal DOM
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...c) { c.forEach(x => this.classes.add(x)); }
  remove(...c) { c.forEach(x => this.classes.delete(x)); }
  contains(x) { return this.classes.has(x); }
}

class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = new MockClassList();
    this.style = {};
    this._innerHTML = '';
    this.attributes = {};
    this.children = [];
    this.value = '';
    this.textContent = '';
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  appendChild(c) { this.children.push(c); return c; }
  prepend(c) { this.children.unshift(c); return c; }
  insertBefore(c, ref) { this.children.unshift(c); return c; }
  remove() {}
  addEventListener() {}
  get firstChild() { return this.children[0] || null; }
  scrollIntoView() {}
  focus() {}
  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.textContent = val.replace(/<[^>]*>/g, '');
  }
}

global.window = global;
global.document = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = new MockElement('div', id);
    }
    return this.elements[id];
  },
  createElement(tag) { return new MockElement(tag); },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return new MockElement('div');
  },
  querySelectorAll() { return []; },
  body: new MockElement('body'),
  addEventListener() {}
};

// Cargar supervisor_panel.js
require('./supervisor_panel.js');

// Verificaciones de API SupervisorPanel
console.log('--- 1. Verificación de Exposición de API Global Supervisor HO ---');
assert.strictEqual(typeof window.SupervisorPanel, 'object', 'SupervisorPanel debe estar definido en window');
assert.strictEqual(typeof window.SupervisorPanel.renderDashboard, 'function', 'renderDashboard debe ser una función');
assert.strictEqual(typeof window.renderSupervisorDashboardView, 'function', 'renderSupervisorDashboardView debe ser una función');
console.log('  [PASS] SupervisorPanel y renderSupervisorDashboardView expuestos en window');

// Verificación de Generación HTML del Dashboard
console.log('\n--- 2. Verificación de Contenido HTML del Dashboard Ejecutivo ---');
const html = window.SupervisorPanel.renderDashboard();
assert.ok(html.includes('supervisor-tab-card'), 'Debe contener la tarjeta supervisor-tab-card');
assert.ok(html.includes('SUPERVISOR VIRTUAL AUTÓNOMO - SIFU OPERACIONES (SAP S/4HANA)'), 'Debe contener el título corporativo nacional');
assert.ok(html.includes('Consolidado Nacional (Toda España · 4.520 proyectos)'), 'Debe incluir la opción de Consolidado Nacional');
assert.ok(html.includes('Bolsa de Suplencias Exprés de Guardia (CEE Grupo SIFU)'), 'Debe incluir la sección de Bolsa de Suplencias CEE');
assert.ok(html.includes('Gerard Navarro Gómez'), 'Debe incluir candidato verificado de la bolsa');
assert.ok(html.includes('Carla Méndez Rivas'), 'Debe incluir candidata verificada de la bolsa');
assert.ok(html.includes('kpi-val-servicios'), 'Debe tener id kpi-val-servicios');
assert.ok(html.includes('kpi-val-descubiertos'), 'Debe tener id kpi-val-descubiertos');
assert.ok(html.includes('kpi-val-lgd'), 'Debe tener id kpi-val-lgd');
assert.ok(html.includes('Informe Dirección'), 'Debe incluir acceso al Informe de Dirección');
console.log('  [PASS] Contenido HTML completo, profesional y enriquecido para Dirección de Operaciones');

// Cargar enterprise_platform.js y simular renderizado de la sub-pestaña 2.2
console.log('\n--- 3. Verificación de Renderizado en Enterprise Platform ---');
require('./enterprise_platform.js');

const viewport = document.getElementById('ent-main-viewport');
window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_supervisor');
const subContainer = document.getElementById('ent-sap-sub-container');
assert.ok(subContainer.innerHTML.includes('supervisor-tab-card'), 'El subcontenedor ent-sap-sub-container debe tener el supervisor completo inyectado');
assert.ok(!subContainer.innerHTML.includes('Cargando 2.2'), 'No debe tener placeholders vacíos');
console.log('  [PASS] Sub-pestaña 2.2 Supervisor HO renderiza el panel completo directamente en el layout Enterprise');

// Probar cambio dinámico de ámbito a Nacional y Barcelona
console.log('\n--- 4. Verificación de Ámbito Territorial Dinámico ---');
window.cambiarGestorSupervisor('nacional');
const chipProys = document.getElementById('chip-proyectos-val');
assert.strictEqual(chipProys.textContent, '4.520', 'Proyectos nacionales deben ser 4.520');

window.cambiarGestorSupervisor('todos');
assert.strictEqual(chipProys.textContent, '704', 'Proyectos de Barcelona deben ser 704');
console.log('  [PASS] Selector de ámbito territorial actualiza en tiempo real las métricas');

// Probar simulador de descubierto y resolución preventiva en <15 seg
console.log('\n--- 5. Verificación de Protocolo Preventivo de Descubiertos (Demo para Dirección) ---');
window.simularDescubiertoPreventivo();
const chipDesc = document.getElementById('chip-descubiertos-val');
assert.strictEqual(chipDesc.textContent, '1', 'Descubierto detectado debe marcar 1');

window.resolverDescubiertoSimulado();
assert.strictEqual(chipDesc.textContent, '0', 'Descubierto resuelto debe volver a 0');
console.log('  [PASS] Demostración de detección y mitigación de descubierto resuelta con éxito');

// Probar informe ejecutivo para Dirección
console.log('\n--- 6. Verificación de Generador de Informe Ejecutivo para Dirección ---');
window.generarInformeEjecutivoDireccion();
const modal = document.getElementById('informe-ejecutivo-modal-overlay');
assert.ok(modal.innerHTML.includes('Dirección de Operaciones España'), 'El informe debe titularse para Dirección de Operaciones España');
assert.ok(modal.innerHTML.includes('Cataluña (0801 Barcelona)'), 'El informe debe incluir desglose territorial');
assert.ok(modal.innerHTML.includes('88.5%'), 'El informe debe incluir cuota de discapacidad LGD');
console.log('  [PASS] Generador de Informe Ejecutivo de Dirección disponible y certificado');

console.log('\n================================================================');
console.log('RESULTADO FINAL: TODAS LAS PRUEBAS SUPERADAS CON ÉXITO (100% OK)');
console.log('================================================================');
process.exit(0);
