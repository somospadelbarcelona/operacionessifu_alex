const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('CERTIFICACIÓN FINAL QA: REGRESIÓN TOTAL PLATAFORMA ENTERPRISE');
console.log('Delegación Territorial Barcelona 0801 - Grupo SIFU');
console.log('================================================================\n');

// 1. Mock DOM Environment
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...cls) { cls.forEach(c => this.classes.add(c)); }
  remove(...cls) { cls.forEach(c => this.classes.delete(c)); }
  toggle(cls, force) {
    if (force === undefined) {
      if (this.classes.has(cls)) { this.classes.delete(cls); return false; }
      else { this.classes.add(cls); return true; }
    } else if (force) {
      this.classes.add(cls); return true;
    } else {
      this.classes.delete(cls); return false;
    }
  }
  contains(cls) { return this.classes.has(cls); }
  toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
  constructor(tagName) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.id = '';
    this.className = '';
    this.classList = new MockClassList();
    this.style = {};
    this._innerHTML = '';
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.eventListeners = {};
    this.value = '';
    this.textContent = '';
  }

  get innerHTML() {
    return this._innerHTML;
  }

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

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  prepend(child) {
    this.children.unshift(child);
    child.parentElement = this;
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners[event.type || event];
    if (handlers) {
      handlers.forEach(h => h(event));
    }
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
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.classList.contains(cls) || (this.className && this.className.includes(cls))) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.classList.contains(cls) || (this.className && this.className.includes(cls))) results.push(this);
    }
    for (const child of this.children) {
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (selector.startsWith('.') && (cur.classList.contains(selector.slice(1)) || (cur.className && cur.className.includes(selector.slice(1))))) {
        return cur;
      }
      if (selector.startsWith('#') && cur.id === selector.slice(1)) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }
}

const mockBody = new MockElement('body');
const mockHead = new MockElement('head');
const mockDocument = {
  body: mockBody,
  head: mockHead,
  readyState: 'complete',
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => {
    if (mockBody.id === id) return mockBody;
    return mockBody.querySelector('#' + id);
  },
  querySelector: (sel) => mockBody.querySelector(sel),
  querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.document = mockDocument;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'QATestMaster' };
global.fetch = async (url) => ({
  ok: true,
  json: async () => ({
    months: ['2026-11', '2026-10', '2026-09'],
    data: [],
    trabajadores: []
  })
});

// Load App & Modules
require('./girona_pro_app.js');
require('./enterprise_platform.js');

let passedTests = 0;
let failedTests = 0;

function runQA(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

// Inicializar Enterprise Platform
window.SifuEnterprisePlatform.init();
const root = mockDocument.getElementById('sifu-enterprise-root');
const viewport = mockDocument.getElementById('ent-main-viewport');

console.log('--- 1. SECCIONES CLÁSICAS TOP EN VIEWPORT ENTERPRISE ---');

runQA('1.1 Cartera Operativa: Despliegue con 9 gestores oficiales de Barcelona', () => {
  window.SifuEnterprisePlatform.switchModule('operations', 'todos');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'operations');
  const html = viewport.innerHTML;
  assert(html.includes('Cartera Operativa'), 'Debe contener Cartera Operativa');
  const gestores = [
    'Sonia Cañete', 'Adrià Serrano', 'Liana Garayshina', 'Jordi Giménez',
    'José García', 'Alba Valverde', 'Julio Ortiz', 'Albert Sánchez', 'Alejandro Coscolin'
  ];
  gestores.forEach(g => assert(html.includes(g), `Debe contener gestor ${g}`));
});

runQA('1.2 Cartera Operativa: Submódulos (Guardia, Limpieza, Auxiliares, Históricos, Plantilla)', () => {
  ['urgencias', 'limpieza', 'auxiliares', 'historicos', 'plantilla'].forEach(sub => {
    window.SifuEnterprisePlatform.switchModule('operations', sub);
    assert.strictEqual(window.AppState.modoCartera === sub || window.AppState.sectorFilter === sub.toUpperCase() || window.AppState.modoAgrupacion === 'trabajadores', true, `Submódulo ${sub} debe activar el estado correspondiente`);
  });
});

runQA('1.3 SAP S/4HANA HO: 2.1 Monitor SAP HO (ho_sync)', () => {
  window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_sync');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'sap_ho');
  const html = viewport.innerHTML;
  assert(html.includes('2.1 Monitor SAP HO') || html.includes('SAP S/4HANA HO'), 'Debe contener Monitor SAP HO');
});

runQA('1.4 SAP S/4HANA HO: 2.2 Supervisor HO (ho_supervisor)', () => {
  window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_supervisor');
  const html = viewport.innerHTML;
  assert(html.includes('Supervisor') || html.includes('2.2'), 'Debe contener Supervisor HO');
});

runQA('1.5 SAP S/4HANA HO: 2.3 Revisión Inteligente IA (ho_intelligent)', () => {
  window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_intelligent');
  const html = viewport.innerHTML;
  assert(html.includes('2.3 Revisión Inteligente') || html.includes('Revisión Inteligente'), 'Debe contener Revisión Inteligente');
});

runQA('1.6 SAP S/4HANA HO: 2.4 Vacaciones en Vivo (ho_vacaciones)', () => {
  window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_vacaciones');
  const html = viewport.innerHTML;
  assert(html.includes('2.4 Vacaciones') || html.includes('Vacaciones'), 'Debe contener Vacaciones en Vivo');
});

runQA('1.7 SAP S/4HANA HO: 2.5 HO 2.0 Auto 24x7 (ho_auto)', () => {
  window.SifuEnterprisePlatform.switchModule('sap_ho', 'ho_auto');
  const html = viewport.innerHTML;
  assert(html.includes('2.5 HO 2.0 Auto') || html.includes('HO 2.0 Auto'), 'Debe contener HO 2.0 Auto');
});

runQA('1.8 CMH: Control Mensual de Horas & Conciliación', () => {
  window.SifuEnterprisePlatform.switchModule('cmh');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'cmh');
  assert(viewport.innerHTML.includes('CMH') || viewport.innerHTML.includes('Control Mensual de Horas'), 'Debe cargar módulo CMH');
});

runQA('1.9 Fichajes: Modo Control Horario Multi-Mes (time_audit)', () => {
  window.SifuEnterprisePlatform.switchModule('time_tracking', 'time_audit');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'time_tracking');
  const html = viewport.innerHTML;
  assert(html.includes('Control Horario Inteligente') || html.includes('Periodo Operativo'), 'Debe contener Control Horario Multi-Mes');
});

runQA('1.10 Fichajes: Modo Fichajes en Vivo gcalidad (fichajes_live)', () => {
  window.SifuEnterprisePlatform.switchModule('time_tracking', 'fichajes_live');
  const html = viewport.innerHTML;
  assert(html.includes('Fichajes en Vivo') || html.includes('gcalidad'), 'Debe contener modo en vivo');
});

runQA('1.11 Escandallo Pro: Estudio Económico oficial SIFU', () => {
  window.SifuEnterprisePlatform.switchModule('estudio_economico');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'estudio_economico');
  assert(viewport.innerHTML.includes('Escandallo') || viewport.innerHTML.includes('Estudio Económico'), 'Debe contener Escandallo Pro');
});

runQA('1.12 Clientes: Pliegos Técnicos & 6.1 Indra Roc Boronat 22@', () => {
  window.SifuEnterprisePlatform.switchModule('clientes', 'indra');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'clientes');
  assert(viewport.innerHTML.includes('Indra') || viewport.innerHTML.includes('Clientes'), 'Debe contener Clientes Indra');
});

console.log('\n--- 2. MÓDULOS C-LEVEL (DIRECCIÓN, IA, ANALÍTICA, GOBIERNO) ---');

runQA('2.1 War Room: Centro de Control Operativo con KPIs y Termómetro de Salud', () => {
  window.SifuEnterprisePlatform.switchModule('war_room');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'war_room');
  const html = viewport.innerHTML;
  assert(html.includes('Centro de Control Operativo'), 'Debe contener Centro de Control Operativo');
  assert(html.includes('WAR ROOM'), 'Debe contener WAR ROOM');
  assert(html.includes('Termómetro de Salud Operativa y SLA'), 'Debe incluir termómetro SLA');
});

runQA('2.2 Inteligencia Artificial Operativa: Radar predictivo y suplencias', () => {
  window.SifuEnterprisePlatform.switchModule('ai_predictive');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'ai_predictive');
  const html = viewport.innerHTML;
  assert(html.includes('Inteligencia Artificial') && html.includes('Suplentes IA'), 'Debe incluir IA predictiva');
});

runQA('2.3 Power BI Executive Hub: Analítica ejecutiva y absentismo', () => {
  window.SifuEnterprisePlatform.switchModule('power_bi');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'power_bi');
  const html = viewport.innerHTML;
  assert(html.includes('Power BI Executive') && html.includes('Absentismo'), 'Debe incluir Power BI');
});

runQA('2.4 RRHH 360° & CEE: Censo integral de plantilla con discapacidad, EPI y revisiones PRL', () => {
  window.SifuEnterprisePlatform.switchModule('hr_360');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'hr_360');
  const html = viewport.innerHTML;
  assert(html.includes('RRHH Inteligente') && html.includes('CEE'), 'Debe incluir RRHH 360');
});

runQA('2.5 Seguridad & Auditoría Forense: Trazabilidad, RBAC y Log inmutable', () => {
  window.SifuEnterprisePlatform.switchModule('security_audit');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'security_audit');
  const html = viewport.innerHTML;
  assert(html.includes('Seguridad, Gobernanza & Auditoría'), 'Debe incluir Seguridad y Auditoría');
});

console.log('\n--- 3. VERIFICACIÓN DE ALIASES Y COMPATIBILIDAD ---');

runQA('3.1 Alias sap_gateway redirige transparentemente a sap_ho', () => {
  window.SifuEnterprisePlatform.switchModule('sap_gateway');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'sap_ho');
});

runQA('3.2 Alias billing_profit redirige transparentemente a estudio_economico', () => {
  window.SifuEnterprisePlatform.switchModule('billing_profit');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'estudio_economico');
});

runQA('3.3 Alias alerts_center redirige transparentemente a security_audit', () => {
  window.SifuEnterprisePlatform.switchModule('alerts_center');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'security_audit');
});

console.log('\n================================================================');
console.log(`TOTAL PRUEBAS EJECUTADAS: ${passedTests + failedTests}`);
console.log(`ÉXITO (PASS): ${passedTests}`);
console.log(`FALLOS (FAIL): ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
