// --- CONTRACT EXPIRATION GUARDIAN ---
window.cachedContractData = { expired: [], urgent: [], warning: [], all: [] };

window.checkContractExpirations = function () {
    console.log("Checking contract expirations...");
    if (!window.state || !window.state.masterData || window.state.masterData.length === 0) {
        console.warn("No master data available for contract check.");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = [];
    const urgent = [];
    const warning = [];
    const all = [];

    window.state.masterData.forEach(row => {
        const rawDate = row['FIN CONTRATO'];
        if (!rawDate) return;

        let dateObj = null;

        try {
            if (typeof rawDate === 'number') {
                // Excel serial date to JS Date (Local)
                // Correct for timezone offsets by treating serial as UTC components then building local
                const utcDate = new Date((rawDate - 25569) * 86400 * 1000);
                // Adjust: Excel 44256 is roughly noon-ish in some calcs? 
                // Best approach: Add ~12h to handle rounding drifts then take components
                const slightlyAdjusted = new Date(utcDate.getTime() + (12 * 60 * 60 * 1000));
                dateObj = new Date(slightlyAdjusted.getUTCFullYear(), slightlyAdjusted.getUTCMonth(), slightlyAdjusted.getUTCDate());
            } else if (typeof rawDate === 'string') {
                const cleanStr = rawDate.trim();
                // DD/MM/YYYY or DD-MM-YYYY
                if (cleanStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
                    const parts = cleanStr.split(/[\/\-]/);
                    dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
                // YYYY-MM-DD
                else if (cleanStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
                    dateObj = new Date(cleanStr);
                }
            }
        } catch (e) {
            console.warn("Date parse error for row:", row, e);
        }

        if (!dateObj || isNaN(dateObj.getTime())) return;

        // Exclude Indefinite Contracts (Year < 2026 based on user clarification)
        // User said: "date prior to 2026 are indefinite"
        if (dateObj.getFullYear() < 2026) return;

        // Diff in Days
        const diffTime = dateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // CORRECTION: If day count is huge positive, these are UPCOMING.
        // If day count is small positive, these are URGENT.
        // If day count is negative, they are EXPIRED or INVALID (but we filter invalid < 2026).
        // Since we kept >= 2026, and today is 2026, diffDays can be negative if it was Jan 2026?
        // E.g. Jan 1 2026 expired. Valid expiration. 
        // 2025 excluded.
        // So this logic holds.

        const item = {
            worker: row['TITULAR'] || 'Sin Nombre',
            service: row['SERVICIO'] || 'Sin Servicio',
            days: diffDays,
            dateStr: dateObj.toLocaleDateString(),
            rawDate: dateObj
        };

        all.push(item);

        // Logic:
        // < 0 days: BLACK EXPIRED (VENCIDOS)
        // 0 - 7 days: RED URGENT (URGENTES)
        // 8 - 45 days: ORANGE WARNING (PRÓXIMOS)

        if (diffDays < 0) {
            expired.push(item);
        } else if (diffDays >= 0 && diffDays <= 7) {
            urgent.push(item);
        } else if (diffDays > 7 && diffDays <= 45) {
            warning.push(item);
        }
    });

    // Cache Data
    window.cachedContractData = { expired, urgent, warning, all };

    const totalAlerts = expired.length + urgent.length + warning.length;

    // Update Bell Icon
    const bellCount = document.getElementById('notification-count');
    const bellContainer = document.querySelector('.notification-bell');

    if (bellCount) {
        bellCount.textContent = totalAlerts;
        bellCount.style.display = totalAlerts > 0 ? 'flex' : 'none';

        if (totalAlerts > 0 && bellContainer) {
            bellContainer.classList.add('has-notifications');
            bellContainer.title = `${expired.length} vencidos, ${urgent.length} urgentes, ${warning.length} próximos`;
        }
    }

    // Show Modal if Urgent or Expired exist (Optional, user might find invalid expired annoying if many)
    // Only show modal for URGENT (0-7 days) to avoid noise from old expired 2026 ones?
    // User requested separation. Let's keep modal for Urgent + Warning + Expired but maybe group them.
    // Show Modal -> DISABLED per user request
    // "el popup de CONTROL DESCUBIERTOS no quiero que se inicie por defecto"
    // if ((expired.length > 0 || urgent.length > 0) && !sessionStorage.getItem('contractAuthDismissed')) {
    //    showContractAlertModal(urgent, warning, expired);
    // }

    // Visual Cue: Animate the widget if there are alerts
    const widget = document.getElementById('module-contract-tracker');
    if (widget && (expired.length > 0 || urgent.length > 0 || warning.length > 0)) {
        widget.classList.add('attention-pulse');
        // Add a badge or text to header?
        const headerTitle = widget.querySelector('h3');
        if (headerTitle && !headerTitle.innerText.includes('⚠️')) {
            headerTitle.innerHTML = `🗓️ CONTROL DE VENCIMIENTOS <span style="font-size:12px; background:#ef4444; color:white; padding:2px 6px; border-radius:10px; margin-left:10px; animation: blink 1s infinite;">¡ATENCIÓN!</span>`;
        }
    } else if (widget) {
        widget.classList.remove('attention-pulse');
    }

    // Update Widget (Default to ALL as requested)
    renderContractWidget('ALL');

    // Update default active button programmatically
    const btnAll = document.getElementById('btn-filter-all');
    if (btnAll) {
        document.querySelectorAll('.btn-mini-filter').forEach(b => b.classList.remove('active'));
        btnAll.classList.add('active');
        // Styles for ALL
        btnAll.style.background = '#e2e8f0';
        btnAll.style.color = '#1e293b';
        btnAll.style.opacity = '1';
    }
};


window.renderContractWidget = function (filter) {
    const tbody = document.getElementById('contract-widget-body');
    if (!tbody) return;

    let data = [];
    if (filter === 'EXPIRED') data = window.cachedContractData.expired;
    else if (filter === 'URGENT') data = window.cachedContractData.urgent;
    else if (filter === 'WARNING') data = window.cachedContractData.warning;
    else data = window.cachedContractData.all.sort((a, b) => a.days - b.days);

    // Update active button state visuals (opacity)
    document.querySelectorAll('.btn-mini-filter').forEach(b => b.style.opacity = '0.6');
    const activeBtn = document.querySelector(`.btn-mini-filter[onclick*="${filter}"]`);
    if (activeBtn) activeBtn.style.opacity = '1';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">✅ No hay contratos en esta categoría.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => {
        let badge = '';
        if (item.days < 0) badge = `<span style="background:#000; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">VENCIDO</span>`;
        else if (item.days <= 7) badge = `<span style="background:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">URGENTE</span>`;
        else if (item.days <= 30) badge = `<span style="background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">PRÓXIMO</span>`;
        else badge = `<span style="background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:4px; font-size:10px;">OK</span>`;

        return `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px;">
                <div style="font-weight:700; color:#334155;">${item.worker}</div>
                <div style="font-size:10px; color:#cbd5e1;">${item.service.substring(0, 30)}...</div>
            </td>
            <td style="text-align:right; padding:10px; font-family:monospace; color:#475569;">${item.dateStr}</td>
            <td style="text-align:right; padding:10px; font-weight:700; ${item.days < 0 ? 'color:#000;' : (item.days <= 7 ? 'color:#ef4444;' : 'color:#334155;')}">${item.days}</td>
            <td style="text-align:center; padding:10px;">${badge}</td>
        </tr>
        `;
    }).join('');
};

window.filterContractWidget = function (type) {
    if (!type) type = 'URGENT';

    // Reset Styles
    document.querySelectorAll('.btn-mini-filter').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#f1f5f9'; // Default gray
        b.style.color = '#475569';
    });

    const btn = document.querySelector(`.btn-mini-filter[onclick*="${type}"]`);
    if (btn) btn.classList.add('active');

    // Apply specific active colors
    if (type === 'EXPIRED') {
        if (btn) { btn.style.background = '#1e293b'; btn.style.color = '#fff'; }
    } else if (type === 'URGENT') {
        if (btn) { btn.style.background = '#fee2e2'; btn.style.color = '#b91c1c'; }
    } else if (type === 'WARNING') {
        if (btn) { btn.style.background = '#fef3c7'; btn.style.color = '#b45309'; }
    } else {
        if (btn) { btn.style.background = '#e2e8f0'; btn.style.color = '#1e293b'; }
    }

    renderContractWidget(type);
}

window.showContractAlertModal = function (urgent, warning, expired) {
    if (document.getElementById('contract-alert-modal')) return;

    const modalHtml = `
    <div id="contract-alert-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); animation: fadeIn 0.3s;">
        <div style="background:white; width:650px; max-width:90%; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); transform: translateY(0); animation: slideUp 0.3s;">
            <div style="background:#ef4444; padding:20px; color:white; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:18px; font-weight:800; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">🚨</span> ALERTA DE VENCIMIENTOS
                </h3>
                <button onclick="document.getElementById('contract-alert-modal').remove(); sessionStorage.setItem('contractAuthDismissed', 'true');" 
                        style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:bold; font-size:16px; line-height:1;">✕</button>
            </div>
            
            <div style="padding:0; max-height:60vh; overflow-y:auto; background:#f8fafc;">
                ${urgent.length > 0 ? `
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; background:#fef2f2;">
                    <h4 style="margin:0 0 15px 0; color:#dc2626; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">🔥 Vencimiento Inminente (< 7 días)</h4>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${urgent.map(u => `
                        <div style="background:white; padding:15px; border-radius:10px; border-left:5px solid #ef4444; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                            <div>
                                <div style="font-weight:700; color:#1f2937; font-size:15px;">${u.worker}</div>
                                <div style="font-size:12px; color:#6b7280; margin-top:2px;">${u.service}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:800; color:#ef4444; font-size:15px;">${u.days} días</div>
                                <div style="font-size:11px; color:#ef4444; font-weight:600;">${u.dateStr}</div>
                            </div>
                        </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                ${warning.length > 0 ? `
                <div style="padding:20px;">
                    <h4 style="margin:0 0 15px 0; color:#d97706; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">⚠️ Próximos Vencimientos (8-45 días)</h4>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${warning.map(w => `
                        <div style="background:white; padding:12px; border-radius:8px; border-left:5px solid #f59e0b; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                            <div>
                                <div style="font-weight:700; color:#1f2937; font-size:14px;">${w.worker}</div>
                                <div style="font-size:11px; color:#6b7280;">${w.service}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:700; color:#d97706; font-size:14px;">${w.days} días</div>
                                <div style="font-size:11px; color:#b45309;">${w.dateStr}</div>
                            </div>
                        </div>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>

            <div style="padding:20px; background:white; border-top:1px solid #e2e8f0; text-align:right; display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('contract-alert-modal').remove(); sessionStorage.setItem('contractAuthDismissed', 'true');" 
                        style="background:#f1f5f9; color:#475569; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px; transition:background 0.2s;">
                    RECORDAR MÁS TARDE
                </button>
                <button onclick="document.getElementById('contract-alert-modal').remove(); sessionStorage.setItem('contractAuthDismissed', 'true');" 
                        style="background:#1e293b; color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); transition:transform 0.1s;">
                    ENTENDIDO
                </button>
            </div>
        </div>
    </div>
    <style>
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
    </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};
