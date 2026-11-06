const fs = require('fs');

const cmh = JSON.parse(fs.readFileSync('cmh_bcn_dataset.json', 'utf8'));
const fc = JSON.parse(fs.readFileSync('fichajes_contraste_bcn.json', 'utf8'));

global.window = {
  CMH_BCN_DATASET: cmh,
  FICHAJES_CONTRASTE_BCN: fc
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  readyState: 'complete',
  addEventListener: () => {}
};
global.setTimeout = () => {};

const epCode = fs.readFileSync('enterprise_platform.js', 'utf8');
eval(epCode);

const workers = window.SifuEnterprisePlatform.DataAdapter.getConsolidatedWorkers();
console.log('Total workers consolidado:', workers.length);

const alejandro = workers.filter(w => w.gestor_id === '00062620' || (w.gestor_corto || '').includes('Alejandro'));
console.log('Trabajadores de Alejandro:', alejandro.length);

console.log('\n--- DIA 03 ---');
alejandro.forEach(w => {
  const rec = window.SifuEnterprisePlatform.getWorkerDayRecord(w, '03', '2026-11');
  console.log(`${w.nombre} (${w.dni}): estado=${rec.estado}, horas=${rec.horas}, entrada=${rec.horaEntrada}, salida=${rec.horaSalida}`);
});

console.log('\n--- DIA 05 ---');
alejandro.forEach(w => {
  const rec = window.SifuEnterprisePlatform.getWorkerDayRecord(w, '05', '2026-11');
  console.log(`${w.nombre} (${w.dni}): estado=${rec.estado}, horas=${rec.horas}, entrada=${rec.horaEntrada}, salida=${rec.horaSalida}`);
});
