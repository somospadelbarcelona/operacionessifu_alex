/**
 * MODAL FIX - Standalone modal functions
 * This file ensures modal functions are available globally
 */

console.log('🔧 Cargando modal_fix.js...');

// Close modal function
function closeStatusModal() {
    console.log('🔒 Cerrando modal...');
    const modal = document.getElementById('status-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        console.log('✅ Modal cerrado');
    } else {
        console.error('❌ Modal no encontrado');
    }
}

// Show modal function
function showStatusModal(title, contentHTML) {
    console.log('📋 Abriendo modal:', title);
    const modal = document.getElementById('status-detail-modal');
    const mTitle = document.getElementById('status-modal-title');
    const mBody = document.getElementById('status-modal-body');

    if (!modal) {
        console.error('❌ Modal element not found');
        alert('Error: Modal no encontrado en el DOM');
        return;
    }

    if (!mTitle) {
        console.error('❌ Modal title element not found');
        return;
    }

    if (!mBody) {
        console.error('❌ Modal body element not found');
        return;
    }

    mTitle.innerText = title;
    mBody.innerHTML = contentHTML;
    modal.style.display = 'flex';
    modal.classList.add('active');
    console.log('✅ Modal abierto correctamente');
}

// Show uncovered details
function showUncoveredDetails() {
    console.log('🔥 Mostrando descubiertos...');

    if (!window.state || !window.state.masterData) {
        console.warn('⚠️ Estado no disponible aún');
        showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:40px; color:#64748b;">⏳ Cargando datos del sistema...</p>');
        return;
    }

    const uncovered = window.state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO'));

        if (!row[kServicio]) return false;

        const status = (row[kEstado] || '').toString().toUpperCase();
        const titular = (row[kTitular] || '').toString().toUpperCase();

        return (
            status.includes('DESCUBIERTO') ||
            status.includes('VACANTE') ||
            status.includes('SIN ASIGNAR') ||
            titular.includes('SIN TITULAR') ||
            titular.includes('DESCUBIERTO') ||
            titular.includes('VACANTE') ||
            (status === '' && (titular === '' || titular === 'SIN TITULAR')) ||
            (status === 'PENDIENTE' && titular === '')
        );
    });

    console.log(`📊 Encontrados ${uncovered.length} descubiertos`);

    if (uncovered.length === 0) {
        showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:40px; color:#10b981; font-size:18px;">✅ No hay servicios descubiertos actualmente</p>');
        return;
    }

    const html = `
    <div style="overflow-x: auto;">
        <table class="master-table" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">SERVICIO</th>
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">ESTADO</th>
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">HORARIO</th>
                </tr>
            </thead>
            <tbody>
                ${uncovered.map(row => {
        const keys = Object.keys(row);
        const srv = row[keys.find(k => k.toUpperCase().includes('SERVICIO'))] || '-';
        const est = row[keys.find(k => k.toUpperCase().trim() === 'ESTADO')] || 'DESCUBIERTO';
        const hor = row[keys.find(k => k.toUpperCase().includes('HORARIO'))] || '-';
        return `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 14px;"><b style="color: #1e293b;">${srv}</b></td>
                            <td style="padding: 14px;"><span style="padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fee2e2; color: #dc2626;">${est}</span></td>
                            <td style="padding: 14px; font-family: monospace; color: #3b82f6; font-weight: 600;">${hor}</td>
                        </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;

    showStatusModal(`🔥 DESCUBIERTOS (${uncovered.length})`, html);
}

// Show absence details
function showAbsenceDetails() {
    console.log('🏥 Mostrando bajas...');

    if (!window.state || !window.state.masterData || window.state.masterData.length === 0) {
        showStatusModal('BAJAS / IT', '<p style="text-align:center; padding:40px; color:#64748b;">⏳ Cargando datos del sistema...</p>');
        return;
    }

    const keys = Object.keys(window.state.masterData[0]);
    const kEstado1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') ||
        keys.find(k => k.toUpperCase().includes('SALUD')) ||
        keys.find(k => k.toUpperCase().includes('BAJA')) ||
        'ESTADO1';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';

    const absences = window.state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEst = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kEst1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') || 'ESTADO1';

        const stateUpper = (row[kEst] || '').toString().toUpperCase();
        const healthUpper = (row[kEst1] || '').toString().toUpperCase();

        return healthUpper.includes('BAJA') ||
            healthUpper.includes('IT') ||
            healthUpper.includes('I.T') ||
            healthUpper.includes('VACACIONES') ||
            stateUpper.includes('BAJA') ||
            stateUpper.includes('IT');
    });

    console.log(`📊 Encontradas ${absences.length} bajas`);

    if (absences.length === 0) {
        showStatusModal('BAJAS / IT', '<p style="text-align:center; padding:40px; color:#10b981; font-size:18px;">✅ No hay bajas activas hoy</p>');
        return;
    }

    const html = `
    <div style="overflow-x: auto;">
        <table class="master-table" style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">SERVICIO</th>
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">TITULAR</th>
                    <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">ESTADO / SALUD</th>
                </tr>
            </thead>
            <tbody>
                ${absences.map(row => {
        const srv = row[kServicio] || '-';
        const tit = row[kTitular] || '-';
        const est1 = row[kEstado1] || 'BAJA';
        let badgeStyle = 'background: #dbeafe; color: #2563eb;';
        if (est1.toUpperCase().includes('BAJA') || est1.toUpperCase().includes('IT')) {
            badgeStyle = 'background: #fee2e2; color: #dc2626;';
        }
        if (est1.toUpperCase().includes('VAC')) {
            badgeStyle = 'background: #d1fae5; color: #059669;';
        }

        return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 14px;"><b style="color: #1e293b;">${srv}</b></td>
                        <td style="padding: 14px; color: #64748b;">${tit}</td>
                        <td style="padding: 14px;"><span style="padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">${est1}</span></td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;

    showStatusModal(`🏥 DETALLE DE BAJAS (${absences.length})`, html);
}

// Show incident details
function showIncidentDetails() {
    console.log('⚠️ Mostrando incidencias...');

    if (!window.state || !window.state.incidents || window.state.incidents.length === 0) {
        showStatusModal('INCIDENCIAS', '<p style="text-align:center; padding:40px; color:#10b981; font-size:18px;">✅ No hay incidencias registradas</p>');
        return;
    }

    const priorityOrder = { 'HIGH': 0, 'MID': 1, 'LOW': 2 };
    const sorted = [...window.state.incidents].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));

    console.log(`📊 Mostrando ${sorted.length} incidencias`);

    const html = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
        ${sorted.map(inc => {
        const badgeStyle = inc.priority === 'HIGH' ? 'background: #fee2e2; color: #dc2626;' : 'background: #dbeafe; color: #2563eb;';
        return `
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${inc.priority === 'HIGH' ? '#dc2626' : '#3b82f6'};">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #3b82f6; font-size: 15px;">${inc.worker}</strong>
                </div>
                <div style="color: #475569; margin-bottom: 10px; line-height: 1.5;">
                    ${inc.desc}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">${inc.priority}</span>
                    <span style="font-size: 12px; color: #94a3b8;">${inc.date || ''}</span>
                </div>
            </div>`;
    }).join('')}
    </div>`;

    showStatusModal(`⚠️ INCIDENCIAS (${sorted.length})`, html);
}

// Expose functions globally
window.closeStatusModal = closeStatusModal;
window.showStatusModal = showStatusModal;
window.showUncoveredDetails = showUncoveredDetails;
window.showAbsenceDetails = showAbsenceDetails;
window.showIncidentDetails = showIncidentDetails;

console.log('✅ Modal functions loaded successfully');
