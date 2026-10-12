// =============================================================
//  MASTER IMPROVEMENTS MODULE — INFORMER SIFU
//  Experto: Telecomunicaciones · IA · Big Data
//  Versión: 2.0 · Julio 2026
// =============================================================

// ─────────────────────────────────────────────────────────────
// UTILIDADES COMPARTIDAS
// ─────────────────────────────────────────────────────────────
function _masterData() {
    return (window.state && window.state.masterData) ? window.state.masterData : [];
}

function _getKeys(data) {
    if (!data || !data.length) return {};
    const keys = Object.keys(data[0]);
    const find = (q) => keys.find(k => k.toUpperCase().includes(q)) || q;
    return {
        kEstado:    keys.find(k => k.toUpperCase().trim() === 'ESTADO') || find('ESTADO'),
        kEstado1:   keys.find(k => k.toUpperCase().trim() === 'ESTADO1') || 'ESTADO1',
        kServicio:  find('SERVICIO'),
        kTitular:   find('TITULAR'),
        kHorario:   find('HORARIO'),
        kSuplente:  keys.find(k => k.toUpperCase().trim() === 'SUPL') || find('SUPL'),
        kFinC:      find('FIN CONTRATO'),
        kVac26:     keys.find(k => k.toUpperCase().trim() === 'VAC 26') || 'VAC 26',
        kVacDet:    find('VACACIONES 2026'),
        kTipoS:     keys.find(k => k.toUpperCase().trim() === 'TIPO S') || 'TIPO S',
        kJira:      keys.find(k => k.toUpperCase().trim() === 'JIRA') || 'JIRA',
        kCLD:       keys.find(k => k.toUpperCase().trim() === 'CLD') || 'CLD',
        kObs:       find('OBSERVACIONES'),
        kOb1:       keys.find(k => k.toUpperCase().trim() === 'OB1') || 'ob1',
    };
}

// Parser de fecha americano M/D/YYYY → objeto Date
function _parseContractDate(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();
    if (!clean || /[a-zA-Z]/.test(clean)) return null;
    const parts = clean.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    let p0 = parseInt(parts[0]), p1 = parseInt(parts[1]), y = parseInt(parts[2]);
    if (isNaN(p0) || isNaN(p1) || isNaN(y)) return null;
    if (y < 100) y += 2000;
    let m, d;
    if (p1 > 12) { m = p0; d = p1; }
    else if (p0 > 12) { d = p0; m = p1; }
    else { m = p0; d = p1; } // americano por defecto
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
}

function _fmtDate(raw) {
    const dt = _parseContractDate(raw);
    if (!dt) return raw || '—';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
}

// Mes actual en español (para cruzar con VAC 26)
const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];


// =============================================================
// BLOQUE 1 — KPI BAR SUPERIOR
// =============================================================
window.renderMasterKPIBar = function() {
    const bar = document.getElementById('master-kpi-bar');
    if (!bar) return;

    const data = _masterData();
    if (!data.length) {
        bar.innerHTML = '<div class="kpi-empty">Sin datos cargados</div>';
        return;
    }

    const K = _getKeys(data);
    const today = new Date();
    today.setHours(0,0,0,0);
    const mesActual = MESES_ES[today.getMonth()];
    const mesProximo = MESES_ES[(today.getMonth() + 1) % 12];
    const en90 = new Date(today); en90.setDate(today.getDate() + 90);

    let total = 0, cubiertos = 0, descubiertos = 0, bajasIT = 0,
        enObras = 0, contratos90 = 0, enVac = 0, sinTitular = 0;

    const clientesSeen = new Set();
    data.forEach(row => {
        const srv = (row[K.kServicio] || '').trim();
        if (!srv) return; // saltar filas vacías
        total++;

        const est  = (row[K.kEstado]  || '').toUpperCase().trim();
        const est1 = (row[K.kEstado1] || '').toUpperCase().trim();
        const tit  = (row[K.kTitular] || '').trim();
        const vac26 = (row[K.kVac26] || '').toUpperCase().trim();
        const finC = row[K.kFinC];
        const cli  = (row[K.kTipoS]   || '').trim();

        if (cli) clientesSeen.add(cli);
        if (est.includes('CUBIERTO') && !est.includes('DESCUBIERTO')) cubiertos++;
        if (est.includes('DESCUBIERTO')) descubiertos++;
        if (est1.includes('BAJA IT')) bajasIT++;
        if (est.includes('OBRAS')) enObras++;
        if (!tit) sinTitular++;

        // Contratos que vencen en los próximos 90 días
        const dt = _parseContractDate(finC);
        if (dt && dt >= today && dt <= en90) contratos90++;

        // En vacaciones este mes
        if (vac26 === mesActual || vac26 === mesProximo) enVac++;
    });

    const pctCobertura = total > 0 ? Math.round((cubiertos / total) * 100) : 0;
    const colorCobertura = pctCobertura >= 90 ? '#10b981' : pctCobertura >= 75 ? '#f59e0b' : '#ef4444';
    const numClientes = clientesSeen.size;

    bar.innerHTML = `
        <div class="kpi-card kpi-total" title="Total servicios activos en el sistema">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">📋</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value">${total}</div>
                <div class="kpi-label">SERVICIOS</div>
            </div>
        </div>
        <div class="kpi-card kpi-clients" title="${numClientes} clientes distintos">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">🏢</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value">${numClientes}</div>
                <div class="kpi-label">CLIENTES</div>
            </div>
        </div>
        <div class="kpi-card kpi-cobertura" title="Porcentaje de servicios cubiertos">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">🛡️</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:${colorCobertura}">${pctCobertura}%</div>
                <div class="kpi-label">COBERTURA</div>
                <div class="kpi-bar-wrap">
                    <div class="kpi-bar-fill" style="width:${pctCobertura}%; background:${colorCobertura};"></div>
                </div>
            </div>
        </div>
        <div class="kpi-card kpi-desc ${descubiertos > 0 ? 'kpi-alert' : ''}" 
             title="Servicios sin cobertura" onclick="filterByUrgency && filterByUrgency('DESCUBIERTO')" style="cursor:pointer;">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">🚨</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:${descubiertos>0?'#ef4444':'#10b981'}">${descubiertos}</div>
                <div class="kpi-label">DESCUBIERTOS</div>
            </div>
            ${descubiertos > 0 ? '<div class="kpi-pulse"></div>' : ''}
        </div>
        <div class="kpi-card kpi-bajas" title="Trabajadores en Baja IT actualmente"
             onclick="filterByUrgency && filterByUrgency('BAJA IT')" style="cursor:pointer;">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">🩺</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:${bajasIT>0?'#f59e0b':'#10b981'}">${bajasIT}</div>
                <div class="kpi-label">BAJAS IT</div>
            </div>
        </div>
        <div class="kpi-card kpi-contratos" title="Contratos que vencen en los próximos 90 días">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">📅</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:${contratos90>5?'#ef4444':contratos90>0?'#f59e0b':'#10b981'}">${contratos90}</div>
                <div class="kpi-label">VTO. 90 DÍAS</div>
            </div>
        </div>
        <div class="kpi-card kpi-vac" title="Vacaciones este mes (${mesActual}) o próximo (${mesProximo})">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">🌴</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:#6366f1">${enVac}</div>
                <div class="kpi-label">VAC. ${mesActual.substring(0,3)}</div>
            </div>
        </div>
        ${sinTitular > 0 ? `
        <div class="kpi-card kpi-sin-tit" title="Servicios sin titular asignado">
            <div class="kpi-icon-wrapper">
                <div class="kpi-icon">👤</div>
            </div>
            <div class="kpi-data">
                <div class="kpi-value" style="color:#ef4444">${sinTitular}</div>
                <div class="kpi-label">SIN TITULAR</div>
            </div>
        </div>` : ''}
    `;
};


// =============================================================
// BLOQUE 2 — AI SCORING SEMÁFORO POR CLIENTE
// =============================================================
window.renderRiskSemaphorAI = function() {
    const list = document.getElementById('risk-list');
    if (!list) return;

    const data = _masterData();
    if (!data.length) return;

    const K = _getKeys(data);
    const today = new Date(); today.setHours(0,0,0,0);
    const en30 = new Date(today); en30.setDate(today.getDate() + 30);

    // Agrupar por cliente (TIPO S)
    const clientMap = new Map();

    data.forEach(row => {
        const srv = (row[K.kServicio] || '').trim();
        if (!srv) return;

        const cliente = (row[K.kTipoS] || 'SIN CLIENTE').trim();
        if (!clientMap.has(cliente)) {
            clientMap.set(cliente, {
                nombre: cliente,
                total: 0, descubiertos: 0, bajasIT: 0,
                sinSuplente: 0, contratos30: 0, score: 0, factors: []
            });
        }
        const c = clientMap.get(cliente);
        c.total++;

        const est  = (row[K.kEstado]  || '').toUpperCase().trim();
        const est1 = (row[K.kEstado1] || '').toUpperCase().trim();
        const supl = (row[K.kSuplente]|| '').trim();

        if (est.includes('DESCUBIERTO')) c.descubiertos++;
        if (est1.includes('BAJA IT')) {
            c.bajasIT++;
            if (!supl) c.sinSuplente++;
        }
        const dt = _parseContractDate(row[K.kFinC]);
        if (dt && dt >= today && dt <= en30) c.contratos30++;
    });

    // Calcular score por cliente
    // Score = (descubiertos × 3) + (baja_sin_suplente × 2) + (contratos_30d × 1)
    clientMap.forEach(c => {
        c.score = (c.descubiertos * 3) + (c.sinSuplente * 2) + (c.contratos30 * 1);
        if (c.descubiertos > 0) c.factors.push(`🚨 ${c.descubiertos} sin cobertura`);
        if (c.sinSuplente > 0)  c.factors.push(`🩺 ${c.sinSuplente} IT sin suplente`);
        if (c.contratos30 > 0)  c.factors.push(`📅 ${c.contratos30} contratos vencen pronto`);
    });

    const sorted = Array.from(clientMap.values())
        .filter(c => c.total > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    if (sorted.every(c => c.score === 0)) {
        list.innerHTML = `<div class="empty-state">✅ TODOS LOS CLIENTES ESTABLES · Sin riesgos detectados</div>`;
        return;
    }

    list.innerHTML = sorted.map(c => {
        let colorClass = 'green', level = 'ESTABLE', levelIcon = '🟢';
        if (c.score >= 6)      { colorClass = 'red';    level = 'CRÍTICO'; levelIcon = '🔴'; }
        else if (c.score >= 2) { colorClass = 'yellow'; level = 'ALERTA';  levelIcon = '🟡'; }

        const pct = c.total > 0 ? Math.round(((c.total - c.descubiertos) / c.total) * 100) : 100;

        return `
        <div class="risk-item risk-${colorClass}" onclick="window.filterByCliente && window.filterByCliente('${c.nombre.replace(/'/g,"\'")}')" style="cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:800; font-size:12px; color:#0f172a;">${levelIcon} ${c.nombre}</span>
                <span class="badge ${colorClass}" style="font-size:9px; padding:2px 7px;">${level}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:5px;">
                ${c.factors.map(f => `<span style="font-size:9px; color:#64748b; background:#f1f5f9; padding:1px 6px; border-radius:10px;">${f}</span>`).join('')}
                ${c.factors.length === 0 ? '<span style="font-size:9px; color:#10b981;">Sin incidencias</span>' : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <div style="flex:1; background:#e2e8f0; border-radius:4px; height:4px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${colorClass==='red'?'#ef4444':colorClass==='yellow'?'#f59e0b':'#10b981'}; border-radius:4px; transition:width 0.5s;"></div>
                </div>
                <span style="font-size:9px; color:#64748b; white-space:nowrap;">${c.total - c.descubiertos}/${c.total} ✓</span>
            </div>
        </div>`;
    }).join('');
};


// =============================================================
// BLOQUE 3 — VISTA AGRUPADA POR CLIENTE
// =============================================================
window._groupedViewOpen = {};

window.renderGroupedByCliente = function() {
    const container = document.getElementById('master-grouped-view');
    if (!container) return;

    const data = _masterData();
    if (!data.length) {
        container.innerHTML = '<div class="empty-state">Sin datos</div>';
        return;
    }

    const K = _getKeys(data);

    // Agrupar por TIPO S
    const groups = new Map();
    data.forEach(row => {
        const srv = (row[K.kServicio] || '').trim();
        if (!srv) return;
        const cli = (row[K.kTipoS] || '—').trim();
        if (!groups.has(cli)) groups.set(cli, []);
        groups.get(cli).push(row);
    });

    // Ordenar grupos: más críticos primero
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
        const aDisc = a[1].filter(r => (r[K.kEstado]||'').toUpperCase().includes('DESCUBIERTO')).length;
        const bDisc = b[1].filter(r => (r[K.kEstado]||'').toUpperCase().includes('DESCUBIERTO')).length;
        return bDisc - aDisc;
    });

    container.innerHTML = sortedGroups.map(([cliente, rows]) => {
        const total = rows.length;
        const disc  = rows.filter(r => (r[K.kEstado]||'').toUpperCase().includes('DESCUBIERTO')).length;
        const bajas = rows.filter(r => (r[K.kEstado1]||'').toUpperCase().includes('BAJA IT')).length;
        const pct   = total > 0 ? Math.round(((total - disc) / total) * 100) : 100;

        const riskColor = disc > 0 ? '#ef4444' : '#10b981';
        const riskLabel = disc > 0 ? `${disc} DESCUBIERTO${disc>1?'S':''}` : 'CUBIERTO';
        const isOpen = window._groupedViewOpen[cliente] || false;

        const rowsHTML = rows.map(row => {
            const est  = (row[K.kEstado]  || '').toUpperCase();
            const est1 = (row[K.kEstado1] || '').toUpperCase();
            const supl = (row[K.kSuplente]|| '').trim();
            const isDisc = est.includes('DESCUBIERTO');
            const isBaja = est1.includes('BAJA IT');

            let rowBg = 'transparent';
            if (isDisc) rowBg = 'rgba(239,68,68,0.04)';
            else if (isBaja) rowBg = 'rgba(245,158,11,0.04)';

            const jira = (row[K.kJira] || '').trim().toUpperCase();
            const jiraColor = jira === 'SI' || jira === 'OK' ? '#10b981' : jira === 'OUT' ? '#6366f1' : jira === 'BAJA' ? '#ef4444' : '#94a3b8';
            const jiraLabel = jira || '—';

            const finFmt = _fmtDate(row[K.kFinC]);
            const dt = _parseContractDate(row[K.kFinC]);
            const today = new Date(); today.setHours(0,0,0,0);
            const daysLeft = dt ? Math.ceil((dt - today) / 86400000) : null;
            const finColor = daysLeft !== null ? (daysLeft < 30 ? '#ef4444' : daysLeft < 90 ? '#f59e0b' : '#10b981') : '#94a3b8';

            return `<div class="grouped-row" style="background:${rowBg}; display:flex; align-items:center; gap:10px; padding:7px 12px; border-bottom:1px solid #f1f5f9; font-size:11.5px;">
                <div style="flex:0 0 80px;">
                    ${isDisc ? '<span style="color:#ef4444; font-weight:800; font-size:10px;">🚨 DESCUBIERTO</span>'
                             : isBaja ? '<span style="color:#f59e0b; font-weight:700; font-size:10px;">🩺 BAJA IT</span>'
                             : '<span style="color:#10b981; font-size:10px;">✅ CUBIERTO</span>'}
                </div>
                <div style="flex:1; font-weight:600; color:#0f172a; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${row[K.kServicio]||''}">${row[K.kServicio]||'—'}</div>
                <div style="flex:0 0 160px; color:#334155; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${row[K.kTitular]||''}">${row[K.kTitular]||'<span style="color:#94a3b8">Sin titular</span>'}</div>
                <div style="flex:0 0 100px; color:#64748b; font-size:10.5px; white-space:nowrap;">${supl ? `<span style="color:#10b981; font-weight:700;">✓ ${supl.substring(0,15)}</span>` : '<span style="color:#94a3b8;">Sin suplente</span>'}</div>
                <div style="flex:0 0 80px; font-family:monospace; font-size:10.5px; color:${finColor}; font-weight:600;">${finFmt}</div>
                <div style="flex:0 0 55px; text-align:center;">
                    <span style="background:${jiraColor}22; color:${jiraColor}; font-size:9px; font-weight:700; padding:2px 6px; border-radius:8px; border:1px solid ${jiraColor}44;">${jiraLabel}</span>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="grupo-cliente-card" style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:8px;">
            <!-- Header del grupo (clickable) -->
            <div onclick="window._groupedViewOpen['${cliente.replace(/'/g,"\\'")}'] = !window._groupedViewOpen['${cliente.replace(/'/g,"\\'")}'];
                          document.getElementById('group-rows-${cliente.replace(/[^a-zA-Z0-9]/g,'_')}').style.display = window._groupedViewOpen['${cliente.replace(/'/g,"\\'")}'] ? 'block' : 'none';
                          this.querySelector('.grupo-arrow').textContent = window._groupedViewOpen['${cliente.replace(/'/g,"\\'")}'] ? '▼' : '▶';"
                 style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:#f8fafc; cursor:pointer; user-select:none; border-bottom:1px solid #e2e8f0;">
                <span class="grupo-arrow" style="font-size:11px; color:#64748b; flex-shrink:0;">${isOpen ? '▼' : '▶'}</span>
                <span style="font-weight:800; color:#0f172a; font-size:13px; flex:1;">${cliente}</span>
                <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                    <span style="font-size:10px; color:#64748b;">${total} servicio${total!==1?'s':''}</span>
                    <span style="background:${riskColor}22; color:${riskColor}; font-size:9px; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid ${riskColor}44;">${riskLabel}</span>
                    ${bajas > 0 ? `<span style="background:#f59e0b22; color:#f59e0b; font-size:9px; font-weight:700; padding:2px 6px; border-radius:10px; border:1px solid #f59e0b44;">🩺 ${bajas} baja${bajas>1?'s':''}</span>` : ''}
                </div>
                <div style="width:80px; background:#e2e8f0; border-radius:4px; height:5px; overflow:hidden; flex-shrink:0;">
                    <div style="width:${pct}%; height:100%; background:${riskColor}; border-radius:4px;"></div>
                </div>
                <span style="font-size:10px; font-weight:700; color:${riskColor}; width:30px; text-align:right; flex-shrink:0;">${pct}%</span>
            </div>
            <!-- Rows del grupo -->
            <div id="group-rows-${cliente.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:${isOpen ? 'block' : 'none'};">
                <!-- Mini-header -->
                <div style="display:flex; gap:10px; padding:5px 12px; background:#f1f5f9; font-size:9px; font-weight:700; color:#64748b; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">
                    <div style="flex:0 0 80px;">ESTADO</div>
                    <div style="flex:1;">SERVICIO</div>
                    <div style="flex:0 0 160px;">TITULAR</div>
                    <div style="flex:0 0 100px;">SUPLENTE</div>
                    <div style="flex:0 0 80px;">FIN CONTRATO</div>
                    <div style="flex:0 0 55px; text-align:center;">JIRA</div>
                </div>
                ${rowsHTML}
            </div>
        </div>`;
    }).join('');
};

// Toggle vista agrupada
window.toggleGroupedView = function() {
    const grouped = document.getElementById('master-grouped-view-wrapper');
    const table   = document.getElementById('module-master-summary');
    const btn     = document.getElementById('btn-toggle-grouped');
    if (!grouped) return;

    const isVisible = grouped.style.display !== 'none';
    grouped.style.display = isVisible ? 'none' : 'block';
    if (table) table.style.display = isVisible ? '' : 'none';
    if (btn) {
        btn.style.background = isVisible ? '' : '#6366f1';
        btn.style.color      = isVisible ? '' : '#ffffff';
        btn.textContent      = isVisible ? '🏢 VISTA CLIENTE' : '📋 VISTA TABLA';
    }

    if (!isVisible) window.renderGroupedByCliente();
};


// =============================================================
// BLOQUE 4 — PANEL VACACIONES EN CURSO
// =============================================================
window.renderVacacionesPanel = function() {
    const container = document.getElementById('master-vacaciones-panel');
    if (!container) return;

    const data = _masterData();
    if (!data.length) return;

    const K = _getKeys(data);
    const today = new Date(); today.setHours(0,0,0,0);
    const mesIdx = today.getMonth();
    const mesActual  = MESES_ES[mesIdx];
    const mesProximo = MESES_ES[(mesIdx + 1) % 12];

    const enVacAhora = [];
    const proxVac    = [];

    data.forEach(row => {
        const srv  = (row[K.kServicio] || '').trim();
        const tit  = (row[K.kTitular] || '').trim();
        const supl = (row[K.kSuplente]|| '').trim();
        const vac26 = (row[K.kVac26]  || '').toUpperCase().trim();
        const vacDet = (row[K.kVacDet]|| '').trim();

        if (!srv || !vac26) return;

        const entry = { srv, tit: tit || '(Sin titular)', supl, vacDet, vac26 };

        if (vac26 === mesActual)  enVacAhora.push(entry);
        else if (vac26 === mesProximo) proxVac.push(entry);
    });

    const renderItem = (item, badge, badgeColor) => `
        <div style="display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid #f1f5f9;">
            <span style="font-size:16px;">🌴</span>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; color:#0f172a; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.srv}">${item.srv}</div>
                <div style="font-size:10px; color:#64748b;">${item.tit}${item.vacDet ? ` · ${item.vacDet}` : ''}</div>
            </div>
            <div style="flex-shrink:0; text-align:right;">
                <span style="background:${badgeColor}22; color:${badgeColor}; font-size:9px; font-weight:700; padding:2px 6px; border-radius:8px; border:1px solid ${badgeColor}44;">${badge}</span>
                ${item.supl ? `<div style="font-size:9px; color:#10b981; margin-top:2px;">✓ ${item.supl.substring(0,12)}</div>`
                            : `<div style="font-size:9px; color:#ef4444; margin-top:2px;">Sin suplente</div>`}
            </div>
        </div>`;

    if (enVacAhora.length === 0 && proxVac.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:12px; color:#94a3b8; font-size:12px;">✅ Sin vacaciones programadas en ${mesActual} ni ${mesProximo}</div>`;
        return;
    }

    container.innerHTML = `
        ${enVacAhora.length > 0 ? `
        <div style="margin-bottom:10px;">
            <div style="font-size:10px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                🌴 EN VACACIONES ESTE MES (${mesActual}) — ${enVacAhora.length}
            </div>
            ${enVacAhora.slice(0,8).map(i => renderItem(i, mesActual, '#ef4444')).join('')}
            ${enVacAhora.length > 8 ? `<div style="font-size:10px; color:#94a3b8; text-align:center; padding-top:4px;">+${enVacAhora.length-8} más...</div>` : ''}
        </div>` : ''}

        ${proxVac.length > 0 ? `
        <div>
            <div style="font-size:10px; font-weight:800; color:#f59e0b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                📅 PRÓXIMAS VACACIONES (${mesProximo}) — ${proxVac.length}
            </div>
            ${proxVac.slice(0,6).map(i => renderItem(i, mesProximo, '#f59e0b')).join('')}
            ${proxVac.length > 6 ? `<div style="font-size:10px; color:#94a3b8; text-align:center; padding-top:4px;">+${proxVac.length-6} más...</div>` : ''}
        </div>` : ''}
    `;
};


// =============================================================
// BLOQUE 5 — MEJORA TABLA: FIN CONTRATO con color + JIRA badge
// =============================================================
// Esta función devuelve el HTML mejorado para la celda de FIN CONTRATO
window.renderFinContratoCell = function(raw) {
    const dt = _parseContractDate(raw);
    if (!dt) return `<div class="td-content" style="color:#94a3b8; font-size:11px;">—</div>`;

    const today = new Date(); today.setHours(0,0,0,0);
    const daysLeft = Math.ceil((dt - today) / 86400000);
    const dd = String(dt.getDate()).padStart(2,'0');
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const yyyy = dt.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    let color = '#10b981', bg = '#dcfce7', label = '', icon = '';
    if (daysLeft < 0)   { color='#6b7280'; bg='#f1f5f9'; label='Vencido'; icon='⬛'; }
    else if (daysLeft <= 30)  { color='#ef4444'; bg='#fee2e2'; label=`${daysLeft}d`; icon='🔴'; }
    else if (daysLeft <= 90)  { color='#f59e0b'; bg='#fef3c7'; label=`${daysLeft}d`; icon='🟡'; }
    else { color='#10b981'; bg='#dcfce7'; label=''; icon=''; }

    return `<div class="td-content" style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-family:monospace; font-size:11.5px; font-weight:700; color:${color};">${dateStr}</span>
        ${label ? `<span style="font-size:9px; background:${bg}; color:${color}; padding:1px 5px; border-radius:6px; font-weight:700; width:fit-content;">${icon} ${label}</span>` : ''}
    </div>`;
};

window.renderJiraCell = function(raw) {
    const v = (raw || '').trim().toUpperCase();
    const map = {
        'SI':  { bg:'#dcfce7', color:'#16a34a', label:'JIRA ✓' },
        'OK':  { bg:'#dcfce7', color:'#16a34a', label:'OK ✓' },
        'NO':  { bg:'#f1f5f9', color:'#94a3b8', label:'NO' },
        'OUT': { bg:'#ede9fe', color:'#7c3aed', label:'OUT' },
        'BAJA':{ bg:'#fee2e2', color:'#dc2626', label:'BAJA' },
    };
    const s = map[v] || { bg:'#f1f5f9', color:'#94a3b8', label: v || '—' };
    return `<span style="background:${s.bg}; color:${s.color}; font-size:9px; font-weight:700; padding:2px 6px; border-radius:8px; display:inline-block;">${s.label}</span>`;
};

window.renderSuplementeCell = function(raw) {
    const v = (raw || '').trim();
    if (!v || v === '-') return `<div class="td-content" style="color:#94a3b8; font-size:11px;">—</div>`;
    return `<div class="td-content" style="color:#10b981; font-weight:700; font-size:11px;">✓ ${v}</div>`;
};

window.renderEstado1Cell = function(raw) {
    const v = (raw || '').trim().toUpperCase();
    if (!v) return '';
    if (v.includes('BAJA IT')) return `<span style="background:#fef3c7; color:#d97706; font-size:9px; font-weight:700; padding:2px 6px; border-radius:8px; margin-left:4px;">🩺 IT</span>`;
    return `<span style="background:#f1f5f9; color:#64748b; font-size:9px; padding:2px 5px; border-radius:6px; margin-left:4px;">${v}</span>`;
};


// =============================================================
// BLOQUE 6 — FILTROS RÁPIDOS POR CLIENTE Y MES VACACIONES
// =============================================================
window._activeClientFilter = null;
window._activeVacFilter = null;

window.renderClientFilterChips = function() {
    const container = document.getElementById('master-client-chips');
    if (!container) return;

    const data = _masterData();
    if (!data.length) return;

    const K = _getKeys(data);
    const clientCount = new Map();

    data.forEach(row => {
        const srv = (row[K.kServicio] || '').trim();
        if (!srv) return;
        const cli = (row[K.kTipoS] || '—').trim();
        if (!clientCount.has(cli)) clientCount.set(cli, { total: 0, disc: 0 });
        const c = clientCount.get(cli);
        c.total++;
        if ((row[K.kEstado]||'').toUpperCase().includes('DESCUBIERTO')) c.disc++;
    });

    const sorted = Array.from(clientCount.entries())
        .sort((a, b) => b[1].disc - a[1].disc || a[0].localeCompare(b[0]));

    container.innerHTML = `
        <button onclick="window.filterByCliente(null)"
                style="padding:4px 10px; border-radius:20px; border:1px solid #cbd5e1; font-size:10px; font-weight:700; cursor:pointer;
                       background:${!window._activeClientFilter ? '#0f172a' : '#f8fafc'};
                       color:${!window._activeClientFilter ? '#ffffff' : '#475569'};">
            TODOS
        </button>
        ${sorted.map(([cli, info]) => `
        <button onclick="window.filterByCliente('${cli.replace(/'/g,"\\'")}')"
                title="${cli}: ${info.total} servicios, ${info.disc} descubiertos"
                style="padding:4px 10px; border-radius:20px; border:1px solid ${info.disc > 0 ? '#fecaca' : '#cbd5e1'}; font-size:10px; font-weight:700; cursor:pointer; white-space:nowrap;
                       background:${window._activeClientFilter === cli ? '#0f172a' : info.disc > 0 ? '#fee2e2' : '#f8fafc'};
                       color:${window._activeClientFilter === cli ? '#ffffff' : info.disc > 0 ? '#b91c1c' : '#475569'};">
            ${cli} <span style="opacity:0.7;">(${info.total}${info.disc > 0 ? ` · 🚨${info.disc}` : ''})</span>
        </button>`).join('')}
    `;
};

window.filterByCliente = function(cliente) {
    window._activeClientFilter = cliente;

    // Aplicar filtro al estado global
    const data = _masterData();
    if (!data.length) return;

    const K = _getKeys(data);

    if (!cliente) {
        // Quitar filtro de cliente, mantener otros filtros
        if (window.state) window.state.filteredData = null;
    } else {
        window.state.filteredData = data.filter(row => {
            const cli = (row[K.kTipoS] || '').trim();
            return cli === cliente;
        });
    }

    // Re-render chips y tabla
    window.renderClientFilterChips();
    if (typeof renderMasterSummary === 'function') renderMasterSummary();
};


// =============================================================
// INIT — Conectar todo al ciclo de vida de la app
// =============================================================
window.initMasterImprovements = function() {
    console.log('🚀 Master Improvements v2.0 — Iniciando...');

    // KPI Bar
    window.renderMasterKPIBar();

    // Semáforo mejorado (reemplaza el anterior)
    window.renderRiskSemaphorAI();

    // Chips de clientes
    window.renderClientFilterChips();

    // Panel de vacaciones
    window.renderVacacionesPanel();

    console.log('✅ Master Improvements v2.0 — Listo.');
};

// Hook: se llama cada vez que renderMasterBodyOnly termina
(function patchRenderMaster() {
    const _orig = window.renderRiskSemaphor;
    window.renderRiskSemaphor = function() {
        window.renderRiskSemaphorAI();
    };
})();
