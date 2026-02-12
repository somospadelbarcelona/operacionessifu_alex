const fs = require('fs');
const content = fs.readFileSync('c:/Users/acoscolin/OneDrive - GRUPO SIFU INTEGRACION LABORAL SL/Escritorio/INFORMER SIFU/master_data.js', 'utf8');
const dataStr = content.substring(content.indexOf('['));
const data = JSON.parse(dataStr.substring(0, dataStr.lastIndexOf(']') + 1));

console.log('--- NON-CUBIERTO ROWS ---');
data.forEach((row, i) => {
    const estado = (row.ESTADO || '').toUpperCase();
    const titular = (row.TITULAR || '').toUpperCase();
    const salud = (row.ESTADO1 || '').toUpperCase();

    if (estado !== 'CUBIERTO' || titular === '' || salud !== '') {
        console.log(`[${i}] Srv: ${row.SERVICIO} | Est: ${estado} | Tit: ${titular} | Sal: ${salud}`);
    }
});
