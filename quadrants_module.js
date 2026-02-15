
// --- VISUAL QUADRANTS MODULE (COMMAND CENTER EDITION) ---

let currentQuadrantMonth = new Date().getMonth();
let currentQuadrantYear = new Date().getFullYear();
let currentSelectedService = '';
let currentSearchQuery = '';

// Inject Custom Styles for Quadrants
const injectQuadrantStyles = () => {
    if (document.getElementById('quadrant-styles')) return;
    const style = document.createElement('style');
    style.id = 'quadrant-styles';
    style.innerHTML = `
        /* Main Grid Container */
        .quadrant-wrapper {
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.05);
            animation: fadeIn 0.5s ease-out;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .quadrant-header-bar {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            flex-shrink: 0;
        }

        /* Controls */
        .q-control-group {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .q-month-nav {
            display: flex;
            align-items: center;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
            overflow: hidden;
        }

        .q-nav-btn {
            padding: 8px 16px;
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 14px;
            color: #64748b;
            transition: all 0.2s;
        }

        .q-nav-btn:hover {
            background: #f1f5f9;
            color: #1e293b;
        }

        .q-current-date {
            font-weight: 700;
            font-size: 14px;
            color: #0f172a;
            min-width: 140px;
            text-align: center;
            border-left: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            padding: 8px 0;
            background: #f8fafc;
        }

        /* Filter Inputs */
        .q-select, .q-search {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 13px;
            color: #334155;
            transition: all 0.2s;
            outline: none;
            min-width: 200px;
        }

        .q-select:focus, .q-search:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* The Grid Table */
        .q-table-container {
            overflow: auto;
            flex: 1;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
        }

        .q-table {
            border-collapse: separate;
            border-spacing: 0;
            width: 100%;
        }

        /* Sticky Headers */
        .q-th-worker {
            position: sticky;
            left: 0;
            z-index: 20;
            background: #f8fafc;
            border-bottom: 2px solid #e2e8f0;
            border-right: 2px solid #e2e8f0;
            padding: 15px;
            text-align: left;
            min-width: 220px;
            box-shadow: 2px 0 5px rgba(0,0,0,0.02);
        }

        .q-th-day {
            position: sticky;
            top: 0;
            z-index: 10;
            background: white;
            border-bottom: 2px solid #e2e8f0;
            border-right: 1px solid #f1f5f9;
            text-align: center;
            padding: 8px;
            min-width: 36px;
            font-size: 11px;
            color: #64748b;
        }

        .q-th-day.weekend {
            background: #f1f5f9;
            color: #94a3b8;
        }

        .q-th-day.today {
            background: #eff6ff;
            color: #3b82f6;
            border-bottom: 2px solid #3b82f6;
        }

        /* Cells */
        .q-td-worker {
            position: sticky;
            left: 0;
            z-index: 15;
            background: white;
            border-bottom: 1px solid #f1f5f9;
            border-right: 2px solid #e2e8f0;
            padding: 10px 15px;
        }

        .q-cell {
            border-bottom: 1px solid #f1f5f9;
            border-right: 1px solid #f8fafc;
            text-align: center;
            cursor: pointer;
            transition: all 0.1s;
            font-size: 11px;
            font-weight: 700;
            position: relative;
        }

        .q-cell:hover {
            transform: scale(1.1);
            z-index: 5;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-radius: 4px;
        }

        /* Status Colors */
        .status-T { background: #dcfce7 !important; color: #166534 !important; } /* Green */
        .status-B { background: #fee2e2 !important; color: #991b1b !important; } /* Red IT */
        .status-V { background: #fef9c3 !important; color: #854d0e !important; } /* Yellow Vac */
        .status-F { background: #f1f5f9 !important; color: #64748b !important; border: 1px solid #cbd5e1 !important; } /* Gray Falta */
        .status-D { background: #ffffff !important; color: #94a3b8 !important; } /* White Descanso */
        .status-U { 
            background: repeating-linear-gradient(45deg, #fee2e2, #fee2e2 5px, #fecaca 5px, #fecaca 10px) !important; 
            color: #dc2626 !important; 
        }

        .status-weekend { background: #f8fafc; }
        
        /* Modal Animation */
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .status-btn { 
            padding: 12px; 
            border-radius: 8px; 
            font-weight: 700; 
            font-size: 11px; 
            cursor: pointer; 
            transition: transform 0.1s;
            border: 1px solid transparent; 
        }
        .status-btn:active { transform: scale(0.95); }
    `;
    document.head.appendChild(style);
};

// Main Initialization
window.initQuadrantsModule = function () {
    console.log("📅 Iniciando Visual Command Center (Cuadrantes)...");
    injectQuadrantStyles(); // Inject CSS

    const container = document.getElementById('quadrants-grid');
    const controls = document.getElementById('quadrants-controls');

    // Ensure Daily Overrides
    if (!state.dailyOverrides) state.dailyOverrides = {};

    if (controls) {
        // Collect Services for Filter
        const masterData = state.masterData || [];
        const services = [...new Set(masterData.map(r => r['SERVICIO'] || r['Alias/Nombre del centro'] || "SIN CENTRO"))]
            .filter(s => s && s.length > 2).sort();

        const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

        controls.innerHTML = `
            <div class="quadrant-wrapper">
                <div class="quadrant-header-bar">
                    <div class="q-control-group">
                        <div class="q-month-nav">
                            <button onclick="window.changeQuadrantMonth(-1)" class="q-nav-btn">◀</button>
                            <div class="q-current-date">${months[currentQuadrantMonth]} ${currentQuadrantYear}</div>
                            <button onclick="window.changeQuadrantMonth(1)" class="q-nav-btn">▶</button>
                        </div>
                        <button class="btn-primary-glow" style="padding: 8px 16px; font-size: 13px;" onclick="renderQuadrantsGrid()">
                            🔄 REFRESCAR
                        </button>
                    </div>

                    <div class="q-control-group" style="flex:1; justify-content: flex-end;">
                        <input type="text" id="quadrant-search-input" class="q-search"
                            placeholder="🔍 Buscar Trabajador, Servicio..." 
                            onkeyup="window.handleQuadrantSearch(this.value)"
                            value="${currentSearchQuery}">
                        
                        <select id="quadrant-service-filter" class="q-select" onchange="window.filterQuadrantService(this.value)">
                            <option value="">🏢 Todos los Centros</option>
                            ${services.map(s => `<option value="${s}" ${s === currentSelectedService ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="q-legends" style="display:flex; gap:20px; padding: 10px 20px; font-size:11px; background:#fff; border-bottom:1px solid #f1f5f9; flex-shrink: 0;">
                    <span style="display:flex; align-items:center; gap:6px; color:#475569;"><span style="width:10px; height:10px; background:#dcfce7; border-radius:3px;"></span> TRABAJO</span>
                    <span style="display:flex; align-items:center; gap:6px; color:#475569;"><span style="width:10px; height:10px; background:#fee2e2; border-radius:3px;"></span> BAJA IT</span>
                    <span style="display:flex; align-items:center; gap:6px; color:#475569;"><span style="width:10px; height:10px; background:#fef9c3; border-radius:3px;"></span> VACACIONES</span>
                    <span style="display:flex; align-items:center; gap:6px; color:#475569;"><span style="width:10px; height:10px; background:repeating-linear-gradient(45deg, #fee2e2, #fee2e2 5px, #fecaca 5px, #fecaca 10px); border-radius:3px;"></span> DESCUBIERTO</span>
                </div>

                <div id="q-grid-body" class="q-table-container">
                    <!-- Table Injected Here -->
                </div>
            </div>
        `;
    }

    renderQuadrantsGrid();
};

window.changeQuadrantMonth = function (delta) {
    currentQuadrantMonth += delta;
    if (currentQuadrantMonth > 11) { currentQuadrantMonth = 0; currentQuadrantYear++; }
    else if (currentQuadrantMonth < 0) { currentQuadrantMonth = 11; currentQuadrantYear--; }
    initQuadrantsModule();
};

window.filterQuadrantService = function (service) {
    currentSelectedService = service;
    currentSearchQuery = '';
    const input = document.getElementById('quadrant-search-input');
    if (input) input.value = '';
    renderQuadrantsGrid();
};

window.handleQuadrantSearch = function (query) {
    currentSearchQuery = query.toLowerCase();
    if (currentSearchQuery.length > 2) {
        currentSelectedService = "";
        const sel = document.getElementById('quadrant-service-filter');
        if (sel) sel.value = "";
    }
    renderQuadrantsGrid();
};

const getDayKey = (worker, dateStr) => `Q|${worker.trim()}|${dateStr}`;

window.renderQuadrantsGrid = function () {
    const container = document.getElementById('q-grid-body');
    if (!container) return; // Should be created in init

    const masterData = state.masterData || [];
    let filteredData = [];

    // Filter Logic
    if (currentSearchQuery && currentSearchQuery.length > 1) {
        filteredData = masterData.filter(r => {
            const w = (r['TITULAR'] || r['Titular'] || "").toLowerCase();
            const s = (r['SERVICIO'] || r['Alias/Nombre del centro'] || "").toLowerCase();
            return w.includes(currentSearchQuery) || s.includes(currentSearchQuery);
        });
        if (filteredData.length > 100) filteredData = filteredData.slice(0, 100);
    } else if (currentSelectedService && currentSelectedService !== '') {
        filteredData = masterData.filter(r => (r['SERVICIO'] || r['Alias/Nombre del centro']) === currentSelectedService);
    } else {
        // Default: Show ALL (Limited for Performance)
        filteredData = masterData.slice(0, 200);
    }

    let html = '';

    if (masterData.length > 200 && (!currentSearchQuery || currentSearchQuery.length < 2) && (!currentSelectedService || currentSelectedService === '')) {
        html += `<div style="padding: 10px; text-align: center; color: #854d0e; background:#fef3c7; font-size:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">⚠️ Vista limitada a los primeros 200 trabajadores. Usa el buscador o filtros para localizar registros específicos.</div>`;
    }

    if (filteredData.length === 0) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444;">❌ No se encontraron cuadrantes.</div>`;
        return;
    }

    const daysInMonth = new Date(currentQuadrantYear, currentQuadrantMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentQuadrantMonth && today.getFullYear() === currentQuadrantYear;

    html += `<table class="q-table"><thead><tr><th class="q-th-worker">🧑‍🔧 OPERARIO / SERVICIO</th>`;

    // Days Header
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentQuadrantYear, currentQuadrantMonth, d);
        const day = date.getDay();
        const isWeekend = (day === 0 || day === 6);
        const isToday = isCurrentMonth && d === today.getDate();
        const letter = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][day];

        html += `<th class="q-th-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}">
                    <div style="font-weight:700; font-size:12px;">${d}</div>
                    <div style="font-weight:400; opacity:0.7;">${letter}</div>
                 </th>`;
    }
    html += `</tr></thead><tbody>`;

    // Body
    filteredData.forEach(row => {
        const worker = row['TITULAR'] || row['Titular'] || "DESCONOCIDO";
        const service = row['SERVICIO'] || row['Alias/Nombre del centro'] || "";
        const rowGenStatus = (row['ESTADO'] || "").toUpperCase();
        const substitute = row['SUPLENTE'] || "";

        // --- ROW 1: TITULAR ---
        html += `<tr>
            <td class="q-td-worker">
                <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${worker}</div>
                <div style="font-size: 11px; color: #64748b; margin-top:2px; display:flex; align-items:center; gap:4px;">
                    🏢 ${service.substring(0, 25)}${service.length > 25 ? '...' : ''}
                </div>
            </td>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentQuadrantYear}-${String(currentQuadrantMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dateObj = new Date(currentQuadrantYear, currentQuadrantMonth, d);
            const day = dateObj.getDay();
            const isWeekend = (day === 0 || day === 6);

            const overrideKey = getDayKey(worker, dateStr);
            const overrideVal = state.dailyOverrides ? state.dailyOverrides[overrideKey] : null;

            let cellClass = isWeekend ? 'status-weekend' : 'status-D';
            let content = '';

            if (overrideVal) {
                cellClass = `status-${overrideVal}`;
                content = overrideVal;
            } else {
                if (rowGenStatus === 'DESCUBIERTO') {
                    cellClass = 'status-U'; content = '!';
                } else if ((row['ESTADO1'] || "").toUpperCase().includes('IT')) {
                    cellClass = 'status-B'; content = 'B';
                } else if ((row['ESTADO1'] || "").toUpperCase().includes('VAC')) {
                    cellClass = 'status-V'; content = 'V';
                } else if (rowGenStatus === 'CUBIERTO' && !isWeekend) {
                    cellClass = 'status-T'; content = 'T';
                }
            }

            html += `<td class="q-cell ${cellClass}" onclick="window.openDayEditor('${worker.replace(/'/g, "\\'")}', '${dateStr}', '${overrideVal || ''}')">${content}</td>`;
        }
        html += `</tr>`;

        // --- ROW 2: SUBSTITUTE (IF EXISTS) ---
        if (substitute && substitute.length > 2) {
            html += `<tr style="background-color: #f0fdf4;">
                <td class="q-td-worker" style="padding-left: 25px; border-left: 4px solid #4ade80;">
                    <div style="font-weight: 700; color: #15803d; font-size: 12px; display:flex; align-items:center; gap:6px;">
                        <span>↳</span> ${substitute}
                    </div>
                    <div style="font-size: 10px; color: #166534; opacity:0.8;">
                        🔄 Suplente Activo
                    </div>
                </td>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${currentQuadrantYear}-${String(currentQuadrantMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dateObj = new Date(currentQuadrantYear, currentQuadrantMonth, d);
                const day = dateObj.getDay();
                const isWeekend = (day === 0 || day === 6);

                // Substitute Logic: Default to 'T' if covering, but allow overrides
                const overrideKey = getDayKey(substitute, dateStr);
                const overrideVal = state.dailyOverrides ? state.dailyOverrides[overrideKey] : null;

                let cellClass = isWeekend ? 'status-weekend' : 'status-T'; // Default working
                let content = 'T';

                if (overrideVal) {
                    cellClass = `status-${overrideVal}`;
                    content = overrideVal;
                } else if (isWeekend) {
                    content = '';
                }

                html += `<td class="q-cell ${cellClass}" onclick="window.openDayEditor('${substitute.replace(/'/g, "\\'")}', '${dateStr}', '${overrideVal || ''}')" style="opacity: 0.9;">${content}</td>`;
            }
            html += `</tr>`;
        }
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Ensure Modal Exists
    ensureQuadrantModal();
};

function ensureQuadrantModal() {
    if (document.getElementById('quadrant-editor-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'quadrant-editor-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: none; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 16px; width: 340px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                <div>
                    <h3 style="margin:0; font-size:16px; color:#1e293b;">Editar Jornada</h3>
                    <div id="q-editor-subtitle" style="font-size:12px; color:#64748b; margin-top:4px;"></div>
                </div>
                <button onclick="document.getElementById('quadrant-editor-modal').style.display='none'" style="background:none; border:none; font-size:20px; color:#94a3b8; cursor:pointer;">&times;</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <button class="status-btn" onclick="window.saveDayStatus('T')" style="background:#dcfce7; color:#166534; border:1px solid #bbf7d0;">✅ TRABAJO (T)</button>
                <button class="status-btn" onclick="window.saveDayStatus('B')" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca;">🏥 BAJA IT (B)</button>
                <button class="status-btn" onclick="window.saveDayStatus('V')" style="background:#fef9c3; color:#854d0e; border:1px solid #fde047;">🏖️ VACANCE (V)</button>
                <button class="status-btn" onclick="window.saveDayStatus('F')" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">🚫 FALTA (F)</button>
                <button class="status-btn" onclick="window.saveDayStatus('D')" style="background:#ffffff; color:#3b82f6; border:1px solid #e2e8f0;">💤 DESCANSO</button>
                <button class="status-btn" onclick="window.saveDayStatus(null)" style="background:#f8fafc; color:#64748b; border:1px dashed #cbd5e1;">🗑️ BORRAR</button>
            </div>
            <button onclick="document.getElementById('quadrant-editor-modal').style.display='none'" style="width:100%; padding: 12px; border-radius: 8px; border:1px solid #e2e8f0; background:white; color:#64748b; font-weight:600; cursor:pointer;">Cancelar</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Editor Global Vars
let edWorker = null;
let edDate = null;

window.openDayEditor = function (worker, dateStr, current) {
    edWorker = worker;
    edDate = dateStr;
    const modal = document.getElementById('quadrant-editor-modal');
    const subtitle = document.getElementById('q-editor-subtitle');
    if (modal && subtitle) {
        subtitle.innerHTML = `${worker} <br> <strong>${dateStr}</strong>`;
        modal.style.display = 'flex';
    }
};

window.saveDayStatus = function (status) {
    if (!edWorker || !edDate) return;
    const key = getDayKey(edWorker, edDate);
    if (status) {
        state.dailyOverrides[key] = status;
    } else {
        delete state.dailyOverrides[key];
    }

    // Save state
    if (typeof saveToIndexedDB === 'function') {
        saveToIndexedDB();
    } else {
        localStorage.setItem('sifu_universal_state_v5', JSON.stringify(state));
    }

    document.getElementById('quadrant-editor-modal').style.display = 'none';
    renderQuadrantsGrid();
};
