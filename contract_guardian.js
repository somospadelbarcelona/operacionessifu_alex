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
                // Número serial de Excel → fecha JS
                const utcDate = new Date((rawDate - 25569) * 86400 * 1000);
                const adj = new Date(utcDate.getTime() + (12 * 60 * 60 * 1000));
                dateObj = new Date(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate());

            } else if (typeof rawDate === 'string') {
                const cleanStr = rawDate.trim();

                // Ignorar valores de texto como "temporal", "indefinido", etc.
                if (!cleanStr || /[a-zA-Z]/.test(cleanStr)) {
                    // skip
                }
                // Formato M/D/YYYY o DD/MM/YYYY (con / o -)
                else if (cleanStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
                    const parts = cleanStr.split(/[\/\-]/);
                    let p0 = parseInt(parts[0]); // primer número
                    let p1 = parseInt(parts[1]); // segundo número
                    let y  = parseInt(parts[2]);
                    if (y < 100) y += 2000;

                    let d, m;
                    // Si el segundo número > 12 → formato M/D/YYYY (americano)
                    if (p1 > 12) {
                        m = p0; d = p1;  // p0=mes, p1=día
                    }
                    // Si el primer número > 12 → formato D/M/YYYY (europeo)
                    else if (p0 > 12) {
                        d = p0; m = p1;
                    }
                    // Ambos ≤ 12: asumimos M/D/YYYY (americano, que es el formato del Excel)
                    else {
                        m = p0; d = p1;
                    }
                    dateObj = new Date(y, m - 1, d);
                }
                // Formato YYYY-MM-DD
                else if (cleanStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
                    const parts = cleanStr.split(/[\/\-]/);
                    dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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

        // Exclude contracts that have already expired or expire today (only show expirations after today)
        if (diffDays <= 0) return;

        // CORRECTION: If day count is huge positive, these are UPCOMING.
        // If day count is small positive, these are URGENT.
        // If day count is negative, they are EXPIRED or INVALID (but we filter invalid < 2026).
        // Since we kept >= 2026, and today is 2026, diffDays can be negative if it was Jan 2026?
        // E.g. Jan 1 2026 expired. Valid expiration. 
        // 2025 excluded.
        // So this logic holds.

        // Formatear fecha manualmente DD/MM/YYYY (evita fallos de toLocaleDateString)
        const dd   = String(dateObj.getDate()).padStart(2, '0');
        const mm   = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        const dateFormatted = `${dd}/${mm}/${yyyy}`;

        const item = {
            worker: row['TITULAR'] || 'Sin Nombre',
            service: row['SERVICIO'] || 'Sin Servicio',
            days: diffDays,
            dateStr: dateFormatted,
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
            headerTitle.innerHTML = `🗓️ CONTROL DE VENCIMIENTOS <span style="font-size:11px; background:#ef4444; color:white; padding:2px 6px; border-radius:10px; margin-left:10px; animation: blink 1s infinite;">¡ATENCIÓN!</span>`;
        }
    } else if (widget) {
        widget.classList.remove('attention-pulse');
        const headerTitle = widget.querySelector('h3');
        if (headerTitle) {
            headerTitle.innerHTML = `🗓️ CONTROL DE VENCIMIENTOS`;
        }
    }

    // Update count labels on chips
    const countAll = document.getElementById('contract-count-all');
    const countExpired = document.getElementById('contract-count-expired');
    const countUrgent = document.getElementById('contract-count-urgent');
    const countWarning = document.getElementById('contract-count-warning');

    if (countAll) countAll.textContent = `(${all.length})`;
    if (countExpired) countExpired.textContent = expired.length;
    if (countUrgent) countUrgent.textContent = urgent.length;
    if (countWarning) countWarning.textContent = warning.length;

    // Display current date in the header badge
    const dateBadge = document.getElementById('contract-current-date-badge');
    if (dateBadge) {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        dateBadge.textContent = `Hoy: ${today.toLocaleDateString('es-ES', options)}`;
    }

    // Update Widget and keep active filter
    window.filterContractWidget(window.activeContractFilter || 'ALL');
};

// Search & Filter State
window.activeContractFilter = 'ALL';
window.activeContractSearch = '';

window.handleContractSearch = function (val) {
    window.activeContractSearch = val.toLowerCase().trim();
    
    // Toggle clear button
    const clearBtn = document.getElementById('contract-search-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = val ? 'block' : 'none';
    }
    
    window.applyContractFilters();
};

window.applyContractFilters = function () {
    const feed = document.getElementById('contract-list-feed');
    if (!feed) return;

    let data = [];
    const filter = window.activeContractFilter || 'ALL';

    if (filter === 'EXPIRED') data = window.cachedContractData.expired;
    else if (filter === 'URGENT') data = window.cachedContractData.urgent;
    else if (filter === 'WARNING') data = window.cachedContractData.warning;
    else data = window.cachedContractData.all;

    // Search filter
    const search = window.activeContractSearch || '';
    if (search) {
        data = data.filter(item => 
            (item.worker && item.worker.toLowerCase().includes(search)) || 
            (item.service && item.service.toLowerCase().includes(search))
        );
    }

    // Sort by remaining days
    data = data.slice().sort((a, b) => a.days - b.days);

    if (data.length === 0) {
        feed.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8; font-size:12px;">✅ No hay vencimientos que coincidan.</div>`;
        return;
    }

    feed.innerHTML = data.map(item => {
        let statusIcon = '✅';
        let bgLight = 'rgba(52, 168, 83, 0.12)'; // green
        let fgColor = '#34a853';
        let badgeBg = '#d1fae5';
        let badgeFg = '#065f46';
        let daysLabel = '';
        let itemClass = '';

        if (item.days < 0) {
            statusIcon = '🛑';
            bgLight = 'rgba(234, 67, 53, 0.12)'; // red
            fgColor = '#ea4335';
            badgeBg = '#fee2e2';
            badgeFg = '#b91c1c';
            const absDays = Math.abs(item.days);
            daysLabel = `Vencido hace ${absDays} ${absDays === 1 ? 'día' : 'días'}`;
            itemClass = 'expired-card';
        } else if (item.days === 0) {
            statusIcon = '🔥';
            bgLight = 'rgba(234, 67, 53, 0.18)'; // bright red
            fgColor = '#ea4335';
            badgeBg = '#ea4335';
            badgeFg = '#ffffff';
            daysLabel = 'VENCE HOY';
            itemClass = 'urgent-card pulse-urgent';
        } else if (item.days === 1) {
            statusIcon = '⚠️';
            bgLight = 'rgba(249, 171, 0, 0.15)'; // amber
            fgColor = '#f9ab00';
            badgeBg = '#fef3c7';
            badgeFg = '#d97706';
            daysLabel = 'Vence mañana';
            itemClass = 'urgent-card';
        } else if (item.days <= 7) {
            statusIcon = '⚠️';
            bgLight = 'rgba(249, 171, 0, 0.12)';
            fgColor = '#f9ab00';
            badgeBg = '#fef3c7';
            badgeFg = '#b45309';
            daysLabel = `En ${item.days} días`;
            itemClass = 'urgent-card';
        } else if (item.days <= 45) {
            statusIcon = '📅';
            bgLight = 'rgba(26, 115, 232, 0.1)'; // blue
            fgColor = '#1a73e8';
            badgeBg = '#dbeafe';
            badgeFg = '#1e40af';
            daysLabel = `En ${item.days} días`;
        } else {
            daysLabel = `En ${item.days} días`;
        }

        const serviceClean = item.service.length > 45 ? `${item.service.substring(0, 42)}...` : item.service;

        return `
        <div class="contract-card-item ${itemClass}" style="
            display: flex; 
            flex-direction: column;
            padding: 14px 16px; 
            border-radius: 12px; 
            background: #ffffff; 
            border: 1px solid #e2e8f0;
            border-left: 4px solid ${fgColor};
            transition: all 0.2s ease;
            gap: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        ">

            <!-- Fila 1: Icono + Nombre -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px; flex-shrink: 0;">${statusIcon}</span>
                <span style="font-weight: 800; color: #000000; font-size: 13px;">${item.worker}</span>
            </div>

            <!-- Fila 2: Servicio -->
            <div style="font-size: 11px; color: #64748b; padding-left: 26px;">💼 ${serviceClean}</div>

            <!-- Fila 3: FECHA siempre visible, en su propia línea -->
            <div style="
                display: flex; align-items: center; gap: 10px;
                padding: 9px 12px; margin-top: 4px;
                background: ${badgeBg}; border-radius: 8px;
                border: 1px solid rgba(0,0,0,0.06);
            ">
                <span style="font-size: 15px;">📅</span>
                <b style="color: #000000; font-size: 16px; font-family: monospace; letter-spacing: 0.8px; font-weight: 900;">${item.dateStr || '—'}</b>
                <span style="font-size: 11px; color: ${fgColor}; font-weight: 800; margin-left: auto; white-space: nowrap;">${daysLabel}</span>
            </div>
        </div>
        `;
    }).join('');
};

window.renderContractWidget = function (filter) {
    if (filter) window.activeContractFilter = filter;
    window.applyContractFilters();
};

window.filterContractWidget = function (type) {
    const filter = type || 'ALL';
    window.activeContractFilter = filter;

    // Reset Styles
    document.querySelectorAll('.btn-mini-filter').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#f1f5f9';
        b.style.color = '#475569';
        b.style.border = 'none';
    });

    const btn = document.getElementById(`btn-filter-${filter.toLowerCase()}`);
    if (btn) {
        btn.classList.add('active');
        
        // Premium active states corresponding to semantic colors in light theme
        if (filter === 'EXPIRED') {
            btn.style.background = '#fee2e2';
            btn.style.color = '#b91c1c';
            btn.style.border = '1px solid #fecaca';
        } else if (filter === 'URGENT') {
            btn.style.background = '#fef3c7';
            btn.style.color = '#d97706';
            btn.style.border = '1px solid #fde047';
        } else if (filter === 'WARNING') {
            btn.style.background = '#dbeafe';
            btn.style.color = '#1d4ed8';
            btn.style.border = '1px solid #bfdbfe';
        } else { // ALL
            btn.style.background = '#0f172a';
            btn.style.color = '#ffffff';
        }
    }

    window.applyContractFilters();
};

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
