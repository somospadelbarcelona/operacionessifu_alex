const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('TEST: INMUNIDAD ENTERPRISE HOST MAESTRO & CARTERA OPERATIVA');
console.log('================================================================\n');

// Mock DOM environment
const jsdomHtml = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="girona-pro-root"></div>
</body>
</html>
`;

// Simular entorno window/document básico en Node
const windowMock = {
  location: { href: 'http://localhost/' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener: () => {},
  removeEventListener: () => {},
  document: null
};

// Crear mock element
function createElementMock(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    style: {},
    innerHTML: '',
    children: [],
    attributes: {},
    dataset: {},
    classList: {
      add(cls) { this._classes = this._classes || new Set(); this._classes.add(cls); },
      remove(cls) { if (this._classes) this._classes.delete(cls); },
      toggle(cls, val) {
        this._classes = this._classes || new Set();
        if (val === undefined) {
          if (this._classes.has(cls)) this._classes.delete(cls); else this._classes.add(cls);
        } else if (val) this._classes.add(cls); else this._classes.delete(cls);
      },
      contains(cls) { return !!(this._classes && this._classes.has(cls)); }
    },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] || null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
    prepend(child) { this.children.unshift(child); child.parentElement = this; return child; },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; },
    closest(sel) { return null; },
    addEventListener() {},
    removeEventListener() {}
  };
}

console.log('1. Verificando estructura de girona_pro_app.js:');
const gironaCode = fs.readFileSync(path.join(__dirname, 'girona_pro_app.js'), 'utf-8');

assert(gironaCode.includes('function renderCarteraModularView'), 'girona_pro_app.js debe definir renderCarteraModularView');
assert(gironaCode.includes('window.renderCarteraModularView = renderCarteraModularView;'), 'Debe exportar renderCarteraModularView a window');
assert(gironaCode.includes('window.SifuEnterprisePlatform.isEnterpriseActive'), 'renderAppShell debe consultar isEnterpriseActive');
assert(gironaCode.includes('getActiveModule() === \'operations\''), 'renderAppShell debe comprobar el módulo operations');
console.log('  [PASS] girona_pro_app.js posee la inmunización Enterprise y renderCarteraModularView.');

console.log('\n2. Verificando estructura de enterprise_platform.js:');
const entCode = fs.readFileSync(path.join(__dirname, 'enterprise_platform.js'), 'utf-8');

assert(entCode.includes('isEnterpriseActive: true'), 'enterprise_platform.js debe marcar isEnterpriseActive');
assert(entCode.includes('getActiveModule()'), 'enterprise_platform.js debe proveer getActiveModule()');
assert(entCode.includes('renderCarteraView()'), 'enterprise_platform.js debe proveer renderCarteraView()');
assert(entCode.includes('ent-header-quick-nav'), 'renderMasterLayout debe contener ent-header-quick-nav en el header');
assert(entCode.includes('1. Cartera Operativa'), 'Debe incluir botón rápido a Cartera Operativa');
assert(entCode.includes('Centro de Control'), 'Debe incluir botón rápido a Centro de Control');
assert(entCode.includes('Control Horario'), 'Debe incluir botón rápido a Control Horario');
console.log('  [PASS] enterprise_platform.js incluye barra de navegación rápida y API de integración.');

console.log('\n3. Verificando estilos en enterprise_platform.css:');
const cssCode = fs.readFileSync(path.join(__dirname, 'enterprise_platform.css'), 'utf-8');

assert(cssCode.includes('.ent-header-quick-nav'), 'enterprise_platform.css debe estilizar .ent-header-quick-nav');
assert(cssCode.includes('.ent-quick-nav-btn'), 'enterprise_platform.css debe estilizar .ent-quick-nav-btn');
assert(cssCode.includes('#sifu-enterprise-root .pro-kpis-container'), 'enterprise_platform.css debe contener reglas para Cartera');
console.log('  [PASS] enterprise_platform.css contiene estilos de quick-nav y contención de Cartera.');

console.log('\n================================================================');
console.log('AUDITORÍA DE INMUNIDAD Y CARTERA COMPLETADA EXITOSAMENTE');
console.log('================================================================\n');
