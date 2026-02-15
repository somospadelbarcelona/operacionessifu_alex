
// --- IT LEAVE MANAGEMENT MODULE ---

window.renderAbsences = function () {
    console.log("🚀 Renderizando Dashboard de Bajas IT...");
    const container = document.getElementById('absences-feed');
    if (!container) return;

    const masterData = state.masterData || [];

    if (!masterData || masterData.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <div class="icon">📁</div>
            <h3>SIN DATOS MAESTROS</h3>
            <p>Cargue el archivo Excel para activar el seguimiento IT.</p>
        </div>`;
        return;
    }

    // Filter Logic: Check 'ESTADO1' or 'ESTADO' for IT/BAJA
    const itCases = masterData.filter(row => {
        const stateVal = (row['ESTADO1'] || row['Estado1'] || "").trim().toUpperCase();
        const genVal = (row['ESTADO'] || row['Estado'] || "").trim().toUpperCase();
        return stateVal.includes('BAJA') || stateVal.includes('IT') || genVal.includes('BAJA') || genVal.includes('IT') || stateVal.includes('VACACIONES');
    });

    if (itCases.length === 0) {
        container.innerHTML = `
            <div class="empty-discovery">
                <div class="icon">✅</div>
                <h3>SIN BAJAS ACTIVAS</h3>
                <p>No se registran procesos de IT o absentismo en este momento.</p>
            </div>`;
        // Reset Stats
        ['it-count-total', 'it-count-uncovered', 'it-count-covered', 'it-count-long'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "0";
        });
        return;
    }

    // Sort: Uncovered and Critical first
    itCases.sort((a, b) => {
        const statusA = (a['ESTADO'] || "").toUpperCase();
        const statusB = (b['ESTADO'] || "").toUpperCase();
        if (statusA === 'DESCUBIERTO' && statusB !== 'DESCUBIERTO') return -1;
        if (statusA !== 'DESCUBIERTO' && statusB === 'DESCUBIERTO') return 1;
        return 0;
    });

    // Calculate Stats
    const totalCount = itCases.length;
    const uncoveredCount = itCases.filter(r => (r['ESTADO'] || "").toUpperCase() === 'DESCUBIERTO' || !r['SUPLENTE']).length;
    const coveredCount = totalCount - uncoveredCount;
    const longDurationCount = itCases.filter(r => {
        const start = r['F. Inicio IT'] || r['Fecha'];
        if (!start) return false;
        // Simple logic for "long" if it's from Jan or Feb (context: we are in Feb 14)
        return (start.includes('/01/') || start.includes('ENERO') || start.includes('2025'));
    }).length;

    // Update Header Stats (if they exist)
    const statMap = {
        'it-count-total': totalCount,
        'it-count-uncovered': uncoveredCount,
        'it-count-covered': coveredCount,
        'it-count-long': longDurationCount
    };
    Object.entries(statMap).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    });

    const efficiency = ((coveredCount / totalCount) * 100).toFixed(1);

    container.innerHTML = `
        <div class="uncovered-dashboard">
            <!-- IT Hub Stats -->
            <div class="discovery-hub-header" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
                <div class="hub-stat-group">
                    <div class="hub-stat">
                        <span class="label">Bajas Gestionadas</span>
                        <span class="value">${totalCount}</span>
                    </div>
                    <div class="hub-stat">
                        <span class="label">Tasa de Cobertura</span>
                        <span class="value" style="color:var(--accent-green);">${efficiency}%</span>
                    </div>
                </div>
                <div class="hub-actions">
                    <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 12px; background:var(--sifu-blue);" onclick="window.showITAnalysis()">
                        <span>📊</span> VER ANÁLISIS DETALLADO
                    </button>
                    <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 12px; margin-left:10px;" onclick="window.exportStatusToPDF(true)">
                        <span>📄</span> EXPORTAR LISTADO
                    </button>
                </div>
            </div>

            <!-- Interactive IT Grid -->
            <div class="uncovered-grid">
                ${itCases.map((row, idx) => {
        const worker = row['TITULAR'] || "PERSONAL";
        const service = row['SERVICIO'] || "CENTRO";
        const cause = row['ESTADO1'] || "BAJA IT";
        const substitute = row['SUPLENTE'] || "";
        const startStr = row['F. Inicio IT'] || row['Fecha'] || "--";
        const estadoGen = (row['ESTADO'] || "").toUpperCase();
        const isCovered = (estadoGen === 'CUBIERTO' || (substitute && substitute.length > 2));
        const isVacation = cause.toUpperCase().includes('VAC');

        const cardClass = isCovered ? 'covered' : 'critical';
        const badgeText = isCovered ? (isVacation ? 'Vacaciones' : 'Suplencia Activa') : 'Sin Suplente';
        const badgeClass = isCovered ? 'normal' : 'critical';
        const uniqueId = `it-case-${idx}`;

        return `
                    <div class="uncovered-card ${isCovered ? '' : 'critical'}">
                        <div class="card-top">
                            <div class="service-title">${service}</div>
                            <span class="priority-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        
                        <div class="card-details">
                            <div class="detail-item">
                                <span class="label">Persona de Baja</span>
                                <span class="val highlight">${worker}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Causa & Inicio</span>
                                <span class="val">${cause} <span style="font-size:9px; opacity:0.7;">(${startStr})</span></span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Situación</span>
                                <span class="val">
                                    ${isCovered ?
                `<span style="color:var(--accent-green); font-weight:700;">🔄 ${substitute}</span>` :
                `<span class="pulse-red-dot"></span> <span style="color:var(--accent-red); font-weight:800;">PENDIENTE</span>`
            }
                                </span>
                            </div>
                        </div>

                        <div class="card-actions">
                            ${!isCovered ? `
                                <button class="btn-ai-reveal" onclick="window.toggleAiSuggestions('${uniqueId}', '${service}', '${worker}', 'Turno Completo')">
                                    <span>🧠</span> Buscar Suplente
                                </button>
                            ` : `
                                <button class="mini-action-btn secondary" style="flex:1;" onclick="alert('Contactando con suplente: ${substitute}')">
                                    <span>📞</span> Contactar Suplente
                                </button>
                            `}
                            <button class="mini-action-btn secondary" onclick="showStatusModal('${service}', '<h3>Expediente IT</h3><p>Trabajador: ${worker}</p><p>Motivo: ${cause}</p><p>Inicio: ${startStr}</p>')">
                                <span>🔍</span> Historial
                            </button>
                        </div>

                        <!-- AI Suggestions Box (Hidden by default) -->
                        <div id="ai-box-${uniqueId}" class="ai-suggestions-box">
                            <div style="font-size: 9px; font-weight: 800; color: #6d28d9; margin-bottom: 8px; text-transform: uppercase;">
                                Suplentes Disponibles cerca:
                            </div>
                            <div id="ai-list-${uniqueId}">
                                <div style="font-size: 10px; color: #94a3b8; text-align: center; padding: 10px;">Analizando geocercas...</div>
                            </div>
                        </div>
                    </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
};


// --- NEW ANALYSIS FEATURE ---
window.showITAnalysis = function () {
    console.log("Running IT Analysis...");

    // FIX: user masterData variable
    const masterData = state.masterData || [];

    // 1. Get filtered data
    const itCases = masterData.filter(row => {
        const stateVal = (row['ESTADO1'] || row['Estado1'] || "").trim().toUpperCase();
        return stateVal.includes('BAJA IT') || stateVal.includes('IT');
    });

    if (itCases.length === 0) {
        alert("No hay casos de BAJA IT para analizar.");
        return;
    }

    const modal = document.getElementById('status-detail-modal');
    const modalTitle = document.getElementById('status-modal-title');
    const modalBody = document.getElementById('status-modal-body');

    modalTitle.innerHTML = "📊 ANÁLISIS DE ABSENTISMO (BAJAS IT)";

    // 2. Compute Statistics
    let byCenter = {};
    let totalUncovered = 0;

    itCases.forEach(row => {
        const center = row['SERVICIO'] || row['Alias/Nombre del centro'] || "SIN CENTRO";
        const substitute = row['SUPLENTE'] || "";
        const estadoGen = (row['ESTADO'] || "").toUpperCase();

        // Count Center
        byCenter[center] = (byCenter[center] || 0) + 1;

        // Uncovered check
        if (estadoGen === 'DESCUBIERTO' || (substitute.length <= 2 && estadoGen !== 'CUBIERTO')) {
            totalUncovered++;
        }
    });

    // Sort Top Centers
    const topCenters = Object.entries(byCenter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5

    // 3. Build HTML Report
    let reportHtml = `
        <div style="font-family: 'Segoe UI', sans-serif;">
            
            <!-- Summary Header -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div style="background:#e8f0fe; padding:15px; border-radius:8px; text-align:center;">
                    <div style="font-size:12px; color:#1a73e8; font-weight:bold;">TOTAL BAJAS</div>
                    <div style="font-size:24px; color:#1a73e8;">${itCases.length}</div>
                </div>
                <div style="background:#fce8e6; padding:15px; border-radius:8px; text-align:center;">
                    <div style="font-size:12px; color:#d93025; font-weight:bold;">DESCUBIERTAS</div>
                    <div style="font-size:24px; color:#d93025;">${totalUncovered}</div>
                </div>
                <div style="background:#e6f4ea; padding:15px; border-radius:8px; text-align:center;">
                    <div style="font-size:12px; color:#137333; font-weight:bold;">% COBERTURA</div>
                    <div style="font-size:24px; color:#137333;">${Math.round(((itCases.length - totalUncovered) / itCases.length) * 100)}%</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                
                <!-- Top Centers -->
                <div style="background:#fff; border:1px solid #eee; border-radius:8px; padding:15px;">
                    <h4 style="margin-top:0; color:#3c4043; font-size:14px; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">🏢 CENTROS MÁS AFECTADOS</h4>
                    ${topCenters.map((item, idx) => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                            <span style="color:#5f6368;">${idx + 1}. ${item[0].substring(0, 40)}...</span>
                            <strong style="color:#3c4043;">${item[1]} bajas</strong>
                        </div>
                        <div style="height:4px; background:#f1f3f4; width:100%; border-radius:2px; margin-bottom:12px;">
                            <div style="height:100%; background:#fbbc04; width:${(item[1] / itCases.length) * 100}%;"></div>
                        </div>
                    `).join('')}
                </div>

            </div>

            <!-- Actionable Insight -->
            <div style="margin-top:20px; background:#fff8e1; border:1px solid #ffe0b2; padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:#e65100; font-size:13px;">💡 INSIGHT OPERATIVO</h4>
                <p style="font-size:12px; color:#bf360c; margin:0;">
                    El centro <strong>${topCenters[0][0]}</strong> concentra el <strong>${Math.round((topCenters[0][1] / itCases.length) * 100)}%</strong> de las bajas IT. 
                    Prioridad operativa alta en este servicio.
                </p>
            </div>

        </div>
    `;

    modalBody.innerHTML = reportHtml;
    modal.classList.add('active');
};

window.exportITReport = function () {
    alert("Generando PDF de Bajas IT... (Simulado)");
};
