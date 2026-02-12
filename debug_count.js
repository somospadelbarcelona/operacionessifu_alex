const fs = require('fs');
const content = fs.readFileSync('c:/Users/acoscolin/OneDrive - GRUPO SIFU INTEGRACION LABORAL SL/Escritorio/INFORMER SIFU/master_data.js', 'utf8');
const dataStr = content.substring(content.indexOf('['));
const data = JSON.parse(dataStr.substring(0, dataStr.lastIndexOf(']') + 1));

let count = 0;
data.forEach(row => {
    const keys = Object.keys(row);
    const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
    const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';
    const status = (row[kEstado] || '').toString().toUpperCase();
    const titular = (row[kTitular] || '').toString().toUpperCase();
    const isSpecial = status.includes('BRIGADA') || titular.includes('RUTA CRISTALES') || status.includes('OBRAS') || status.includes('CERRADO');
    const isDesc = (
        status.includes('DESCUBIERTO') ||
        status.includes('VACANTE') ||
        status.includes('SIN ASIGNAR') ||
        titular.includes('SIN TITULAR') ||
        titular.includes('DESCUBIERTO') ||
        titular.includes('VACANTE') ||
        (status === '' && (titular === '' || titular === 'SIN TITULAR')) ||
        (status === 'PENDIENTE' && titular === '')
    ) && !isSpecial;
    if (isDesc) {
        count++;
        console.log(`DESCUBIERTO: ${row.SERVICIO || 'no service'} - ${status} - ${titular}`);
    }
});
console.log('TOTAL:', count);
