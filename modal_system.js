/**
 * MODAL SYSTEM v5.0 - Expert Engineered Pop-up System
 * This version creates elements dynamically to ensure visibility.
 */

console.log('💎 Loading Modal System v5.0...');

(function () {
    // 1. Create Modal if it doesn't exist
    function ensureModalExists() {
        let modal = document.getElementById('status-detail-modal');
        if (!modal) {
            console.log('🏗️ Creating modal element from scratch...');
            modal = document.createElement('div');
            modal.id = 'status-detail-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="status-modal-content">
                    <div class="modal-header">
                        <h2 id="status-modal-title">DETALLE</h2>
                        <button class="close-modal" onclick="closeStatusModal()">×</button>
                    </div>
                    <div id="status-modal-body"></div>
                    <div class="status-modal-footer">
                        <button class="btn-modal-action excel" onclick="if(window.exportStatusToExcel) window.exportStatusToExcel(); else alert('Fución Excel no disponible');">
                            <span>📊</span> EXCEL
                        </button>
                        <button class="btn-modal-action pdf" onclick="if(window.exportStatusToPDF) window.exportStatusToPDF(); else alert('Fución PDF no disponible');">
                            <span>📄</span> PDF
                        </button>
                        <button class="btn-modal-action back" onclick="closeStatusModal()">
                            VOLVER
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    }

    // 2. Global Close Function
    window.closeStatusModal = function () {
        const modal = document.getElementById('status-detail-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    };

    // 3. Global Show Function
    window.showStatusModal = function (title, contentHTML) {
        console.log('🚀 Triggering Modal Display...');
        const modal = ensureModalExists();
        const mTitle = document.getElementById('status-modal-title');
        const mBody = document.getElementById('status-modal-body');

        mTitle.innerText = title;
        mBody.innerHTML = contentHTML;

        // Force styles to be absolutely sure
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('z-index', '2147483647', 'important');
        modal.classList.add('active');

        console.log('✅ Modal should be visible now.');
    };

    // 4. Detail View Functions
    window.showUncoveredDetails = function () {
        if (!window.state || !window.state.masterData) {
            window.showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:30px;">⏳ Buscando datos en el sistema...</p>');
            return;
        }

        const uncovered = window.state.masterData.filter(r => {
            const e = (r.ESTADO || '').toString().toUpperCase();
            const t = (r.TITULAR || '').toString().toUpperCase();
            return e.includes('DESCUBIERTO') || e.includes('VACANTE') || t.includes('SIN TITULAR');
        });

        const html = `
            <div class="modal-list-container">
                <table style="width:100%; border-collapse: collapse;">
                    <thead style="background:#f1f5f9; position:sticky; top:0;">
                        <tr><th style="padding:12px; text-align:left;">SERVICIO</th><th style="padding:12px; text-align:left;">ESTADO</th></tr>
                    </thead>
                    <tbody>
                        ${uncovered.map(r => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:12px;"><b>${r.SERVICIO || r.PROYECTO}</b></td>
                                <td style="padding:12px;"><span style="color:#ef4444; font-weight:bold;">${r.ESTADO || 'DESCUBIERTO'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        window.showStatusModal(`🔥 DESCUBIERTOS (${uncovered.length})`, html);
    };

    window.showAbsenceDetails = function () {
        if (!window.state || !window.state.masterData) return;
        const absences = window.state.masterData.filter(r => {
            const e1 = (r.ESTADO1 || '').toString().toUpperCase();
            return e1.includes('BAJA') || e1.includes('IT') || e1.includes('VACACIONES');
        });

        const html = `
            <div class="modal-list-container">
                <table style="width:100%; border-collapse: collapse;">
                    <thead style="background:#f1f5f9;">
                        <tr><th style="padding:12px; text-align:left;">SERVICIO</th><th style="padding:12px; text-align:left;">TITULAR</th><th style="padding:12px; text-align:left;">MOTIVO</th></tr>
                    </thead>
                    <tbody>
                        ${absences.map(r => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:12px;"><b>${r.SERVICIO || r.PROYECTO}</b></td>
                                <td style="padding:12px;">${r.TITULAR}</td>
                                <td style="padding:12px;"><span style="color:#f59e0b; font-weight:bold;">${r.ESTADO1}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        window.showStatusModal(`🏥 BAJAS (${absences.length})`, html);
    };

    window.showIncidentDetails = function () {
        if (!window.state || !window.state.incidents) return;
        const html = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${window.state.incidents.map(inc => `
                    <div style="background:#f8fafc; border-left:4px solid #3b82f6; padding:15px; border-radius:4px;">
                        <strong>${inc.worker}</strong><br>${inc.desc}
                    </div>
                `).join('')}
            </div>
        `;
        window.showStatusModal(`⚠️ INCIDENCIAS (${window.state.incidents.length})`, html);
    };

    // 5. Attach Click Events to Cards
    function attachListeners() {
        const cards = [
            { id: 'metric-uncovered', fn: window.showUncoveredDetails },
            { id: 'metric-absences', fn: window.showAbsenceDetails },
            { id: 'metric-incidents', fn: window.showIncidentDetails }
        ];

        cards.forEach(card => {
            const el = document.getElementById(card.id);
            if (el) {
                el.style.cursor = 'pointer';
                el.onclick = function (e) {
                    e.preventDefault();
                    card.fn();
                };
            }
        });
    }

    // Run when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachListeners);
    } else {
        attachListeners();
    }

    // Emergency backup check every 2 seconds (in case DOM is rebuilt)
    setInterval(attachListeners, 2000);

})();
