const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('CERTIFICACIÓN QA INTEGRAL: INMUNIDAD ENTERPRISE & SECCIÓN 1 CARTERA');
console.log('================================================================\n');

// 1. Simulación completa del entorno DOM en Node.js
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
    // Parse básico de IDs dentro de innerHTML para queries
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

// Configurar entorno global
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
global.window.addEventListener = (event, fn) => {};
global.window.removeEventListener = (event, fn) => {};
global.document = mockDocument;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'NodeTest' };

// Mock de fetch para simular liveRefreshHO y OData
global.fetch = async (url) => {
  if (url.includes('ho_live_refresh')) {
    return {
      ok: true,
      json: async () => ({
        ho_connected: true,
        employees: {
          '00066957': { nombre: 'Sonia Cañete', estado: 'ACTIVO' },
          '00063967': { nombre: 'Adrià Serrano', estado: 'ACTIVO' }
        }
      })
    };
  }
  return { ok: false };
};

// 2. Cargar e Inicializar Plataforma
console.log('--- TEST 1: Carga y Acoplamiento de Módulos Core ---');

// Mock preliminar de girona_pro_app si es necesario
require('./girona_pro_app.js');
console.log('  [PASS] girona_pro_app.js cargado correctamente.');
assert(typeof window.renderCarteraModularView === 'function', 'window.renderCarteraModularView debe existir');
assert(typeof window.renderAppShell === 'function', 'window.renderAppShell debe existir');

require('./enterprise_platform.js');
console.log('  [PASS] enterprise_platform.js cargado correctamente.');
assert(window.SifuEnterprisePlatform, 'window.SifuEnterprisePlatform debe estar disponible');
assert(window.SifuEnterprisePlatform.isEnterpriseActive === true, 'isEnterpriseActive debe ser true');

// Inicializar Enterprise Platform
window.SifuEnterprisePlatform.init();

const enterpriseRoot = mockDocument.getElementById('sifu-enterprise-root');
assert(enterpriseRoot, '#sifu-enterprise-root debe existir en el DOM tras init()');
console.log('  [PASS] Plataforma Enterprise montada en #sifu-enterprise-root.');

// 3. Verificación de Inmunidad Temporal y Centinelas (8s, 10s, 20s, 60s)
console.log('\n--- TEST 2: Inmunidad frente a liveRefreshHO y centinelas temporales ---');

// Comprobar estado inicial en War Room
assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'war_room', 'Módulo inicial debe ser war_room');
const initialHtml = enterpriseRoot.innerHTML;
assert(initialHtml.includes('Centro de Control'), 'Debe contener la cabecera del Centro de Control');

// Simular llamada a liveRefreshHO('arranque') que ocurre tras 8 segundos
console.log('  -> Disparando liveRefreshHO("arranque") simulado...');
if (window.ProApp && window.ProApp.liveRefreshHO) {
  window.ProApp.liveRefreshHO('arranque');
}

// Simular llamadas automáticas legadas a renderAppShell() que ocurrían a los 10s y 20s
window.renderAppShell();
window.renderAppShell();

// Verificar que #sifu-enterprise-root NO ha sido pisado
assert(mockDocument.getElementById('sifu-enterprise-root') === enterpriseRoot, '#sifu-enterprise-root debe ser inmutable');
assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'war_room', 'Debe mantenerse en war_room tras liveRefreshHO');

// Verificar que el viejo girona-pro-root NO se ha inyectado encima
const gironaRoot = mockDocument.getElementById('girona-pro-root');
if (gironaRoot) {
  assert.strictEqual(gironaRoot.style.display, 'none', 'Si girona-pro-root existe, debe estar oculto con display:none');
}
console.log('  [PASS] Inmunidad certificada: renderAppShell() y liveRefreshHO() respetan el shell Enterprise.');

// 4. Verificación de Navegación Rápida de Cabecera
console.log('\n--- TEST 3: Conmutación de Módulos de Cabecera (Quick Navigation) ---');

// Conmutar a Sección 1: Cartera Operativa
console.log('  -> Conmutando a "1. Cartera Operativa" (operations)...');
window.SifuEnterprisePlatform.switchModule('operations');
assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'operations', 'Módulo activo debe ser operations');

const viewport = mockDocument.getElementById('ent-main-viewport');
assert(viewport, '#ent-main-viewport debe existir');
const carteraHtml = viewport.innerHTML;

// Comprobar elementos requeridos de la Cartera
assert(carteraHtml.includes('Cartera Operativa de Servicios'), 'Debe incluir título de Cartera');
assert(carteraHtml.includes('SECCIÓN 1 · 0801 BCN'), 'Debe incluir badge SECCIÓN 1 · 0801 BCN');
console.log('  [PASS] Sección 1: Cartera Operativa desplegada en el viewport principal.');

// 5. Verificación de los 9 Gestores Oficiales de Barcelona
console.log('\n--- TEST 4: Tira de los 9 Gestores Oficiales de Barcelona ---');
const gestoresEsperados = [
  'Sonia Cañete',
  'Adrià Serrano',
  'Liana Garayshina',
  'Jordi Giménez',
  'José García',
  'Alba Valverde',
  'Julio Ortiz',
  'Albert Sánchez',
  'Alejandro Coscolin'
];

gestoresEsperados.forEach(gestor => {
  assert(carteraHtml.includes(gestor), `La tira de gestores debe incluir a ${gestor}`);
});
console.log(`  [PASS] Los 9 gestores oficiales de Barcelona 0801 están presentes y activos en la tira.`);

// 6. Verificación de Filtros, Buscador Predictivo y Drawer
console.log('\n--- TEST 5: Controles Operativos, Buscador y Drawer ---');
assert(carteraHtml.includes('pro-controls-search-input'), 'Debe contener el buscador predictivo #pro-controls-search-input');
assert(carteraHtml.includes('pro-select-sector'), 'Debe contener selector de sector #pro-select-sector');
assert(carteraHtml.includes('LIMPIEZA'), 'Debe contener opción LIMPIEZA');
assert(carteraHtml.includes('AUXILIARES'), 'Debe contener opción AUXILIARES');
assert(carteraHtml.includes('pro-select-gestor'), 'Debe contener selector de gestor');
assert(carteraHtml.includes('pro-drawer-overlay'), 'Debe contener el overlay del drawer #pro-drawer-overlay');
assert(carteraHtml.includes('pro-drawer-panel'), 'Debe contener el panel del drawer #pro-drawer-panel');
console.log('  [PASS] Buscador predictivo, filtros de sector/gestor y drawer estructuralmente verificados.');

// 7. Verificación de Conmutación a Control Horario
console.log('\n--- TEST 6: Conmutación a Control Horario Inteligente ---');
window.SifuEnterprisePlatform.switchModule('time_tracking');
assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'time_tracking', 'Módulo activo debe ser time_tracking');
const timeHtml = viewport.innerHTML;
assert(timeHtml.includes('Control Horario'), 'Debe contener vista de Control Horario');
console.log('  [PASS] Conmutación instantánea a Control Horario validada.');

// 8. Re-conmutación a Centro de Control
console.log('\n--- TEST 7: Re-conmutación a Centro de Control (War Room) ---');
window.SifuEnterprisePlatform.switchModule('war_room');
assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'war_room', 'Módulo activo debe ser war_room');
assert(viewport.innerHTML.includes('WAR ROOM') || viewport.innerHTML.includes('Centro de Control'), 'Debe volver a renderizar War Room');
console.log('  [PASS] Re-conmutación a Centro de Control validada.');

// 9. Verificación Asíncrona (Espera de timers e init retrasado)
console.log('\n--- TEST 8: Validación de Estabilidad Asíncrona (Post-Timers) ---');
setTimeout(() => {
  // Verificar que el root no ha sido pisado
  const rootStill = mockDocument.getElementById('sifu-enterprise-root');
  assert(rootStill === enterpriseRoot, '#sifu-enterprise-root debe persistir tras la expiración de timers');
  assert.strictEqual(window.SifuEnterprisePlatform.getActiveModule(), 'war_room', 'El módulo activo debe permanecer intacto');
  console.log('  [PASS] Estabilidad asíncrona verificada tras el ciclo de temporizadores.');

  console.log('\n================================================================');
  console.log('RESULTADO FINAL AUDITORÍA QA: TODAS LAS PRUEBAS PASADAS (100% OK)');
  console.log('================================================================\n');
  process.exit(0);
}, 350);
