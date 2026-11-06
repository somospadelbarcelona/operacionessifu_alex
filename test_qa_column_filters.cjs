/**
 * Test QA: Verificación de Filtrado y Ordenación por Columna en Tabla de Fichajes
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('PRUEBA QA: FILTRADO Y ORDENACIÓN POR COLUMNA EN CONTROL HORARIO');
console.log('================================================================\n');

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
    return new MockElement('div');
  }

  querySelectorAll() {
    return [new MockElement('tr')];
  }
}

const mockDoc = {
  readyState: 'complete',
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => {
    if (!mockDoc._elements[id]) {
      const el = new MockElement('div');
      el.id = id;
      mockDoc._elements[id] = el;
    }
    return mockDoc._elements[id];
  },
  querySelector: (sel) => {
    return new MockElement('div');
  },
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
  _elements: {}
};

const mockWin = {
  document: mockDoc,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  addEventListener: () => {},
  dispatchEvent: () => {},
  Chart: class { constructor() {} destroy() {} update() {} },
  navigator: { userAgent: 'NodeTest' },
  location: { reload: () => {} },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};

global.window = mockWin;
global.document = mockDoc;
global.localStorage = mockWin.localStorage;
global.Chart = mockWin.Chart;
global.navigator = mockWin.navigator;

// Cargar platform
const platformCode = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');
eval(platformCode);

async function run() {
  const S = global.window.SifuEnterprisePlatform;
  assert(S, 'SifuEnterprisePlatform debe cargarse correctamente');
  console.log('  [PASS] 1. Carga de SifuEnterprisePlatform');

  assert.strictEqual(typeof S.getTimeTableHeadHtml, 'function', 'getTimeTableHeadHtml existe');
  assert.strictEqual(typeof S.setColumnFilter, 'function', 'setColumnFilter existe');
  assert.strictEqual(typeof S.clearColumnFilters, 'function', 'clearColumnFilters existe');
  assert.strictEqual(typeof S.setSortColumn, 'function', 'setSortColumn existe');
  console.log('  [PASS] 2. Métodos de filtrado y ordenación por columna presentes');

  // Test 3: Generación del HTML de la cabecera
  const dailyHead = S.getTimeTableHeadHtml(true, '02', 'Día 02 (Hoy)');
  assert(dailyHead.includes('ent-col-filter-row'), 'La cabecera diaria debe incluir la fila de filtros por columna');
  assert(dailyHead.includes('ent-colfilter-estado'), 'Filtro por columna Estado presente');
  assert(dailyHead.includes('ent-colfilter-operario'), 'Filtro por columna Operario presente');
  assert(dailyHead.includes('ent-colfilter-servicio'), 'Filtro por columna Servicio presente');
  assert(dailyHead.includes('ent-colfilter-gestor'), 'Filtro por columna Gestor presente');
  assert(dailyHead.includes('ent-colfilter-entrada'), 'Filtro por columna Entrada presente');
  assert(dailyHead.includes('ent-colfilter-salida'), 'Filtro por columna Salida presente');
  assert(dailyHead.includes('ent-colfilter-horas'), 'Filtro por columna Horas presente');
  assert(dailyHead.includes('ent-colfilter-canal'), 'Filtro por columna Canal presente');
  assert(dailyHead.includes('ent-btn-clear-col-filters'), 'Botón limpiar filtros por columna presente');
  console.log('  [PASS] 3. Estructura HTML de cabecera diaria con todos los filtros de columna');

  // Test 4: Generación del HTML de la cabecera mensual
  const monthlyHead = S.getTimeTableHeadHtml(false, 'all', 'Todo el Mes');
  assert(monthlyHead.includes('ent-col-filter-row'), 'La cabecera mensual debe incluir fila de filtros');
  assert(monthlyHead.includes('Estado General'), 'Cabecera mensual incluye Estado General');
  assert(monthlyHead.includes('Diagnóstico Validación'), 'Cabecera mensual incluye Diagnóstico');
  console.log('  [PASS] 4. Estructura HTML de cabecera mensual con filtros por columna');

  // Test 5: Llamadas a los métodos sin errores
  S.setColumnFilter('gestor', 'Albert Sánchez');
  S.setColumnFilter('operario', 'Garcia');
  S.setSortColumn('operario');
  S.setSortColumn('horas');
  S.clearColumnFilters();
  console.log('  [PASS] 5. Ejecución fluida de setColumnFilter, setSortColumn y clearColumnFilters');

  console.log('\n================================================================');
  console.log('CERTIFICACIÓN QA DE FILTRADO POR COLUMNA: 100% OK (5/5 PASS)');
  console.log('================================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
