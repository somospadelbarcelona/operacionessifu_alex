const http = require('http');

function getLiveFichajes() {
  return new Promise((resolve) => {
    http.get('http://localhost:5006/api/fichajes', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function test() {
  const fs = require('fs');
  const cmh = JSON.parse(fs.readFileSync('cmh_bcn_dataset.json', 'utf8'));
  const fc = JSON.parse(fs.readFileSync('fichajes_contraste_bcn.json', 'utf8'));
  const live = await getLiveFichajes();

  global.window = {
    CMH_BCN_DATASET: cmh,
    FICHAJES_CONTRASTE_BCN: fc
  };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    readyState: 'complete', addEventListener: () => {}
  };
  global.setTimeout = () => {};
  global.fetch = async (url) => {
    if (url.includes('5006')) {
      return { ok: true, json: async () => live };
    }
    return { ok: false };
  };

  const epCode = fs.readFileSync('enterprise_platform.js', 'utf8');
  eval(epCode);

  const data = await window.SifuEnterprisePlatform.DataAdapter.fetchTimeTrackingData('2026-11');
  const workers = data.trabajadores;

  const alejandro = workers.filter(w => w.gestor_id === '00062620' || (w.gestor_corto || '').includes('Alejandro'));
  console.log('Alejandro workers count:', alejandro.length);

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
}

test();
