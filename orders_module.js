
// --- ORDERS MODULE (Enhanced with Deep Cleaning Expert Audit) ---

window.ordersFilterState = {}; // Store filter values: { "COL_NAME": "value" }

// Ensure state.orders exists and load default if needed
function ensureStateOrders() {
    if (typeof state === 'undefined') return false;

    // Initialize if missing
    if (!state.orders) {
        state.orders = [];
    }

    // Load default data if empty and available
    if (state.orders.length === 0 && typeof INITIAL_ORDERS_DATA !== 'undefined' && INITIAL_ORDERS_DATA.length > 0) {
        console.log("📥 Loading Default Orders Data...");
        state.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS_DATA)); // Deep copy
        if (typeof saveAllState === 'function') saveAllState();
    }

    return true;
}

window.handleOrdersExcel = async function (file) {
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showToast("ERROR: Librería Excel (XLSX) no cargada.", "error");
        return;
    }

    const container = document.getElementById('orders-table-container');
    if (container) container.innerHTML = '<div class="loading-spinner">⏳ Procesando archivo de pedidos...</div>';

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData && jsonData.length > 0) {
            if (ensureStateOrders()) {
                state.orders = jsonData;
                if (typeof saveAllState === 'function') saveAllState();

                // Reset filters on new load
                window.ordersFilterState = {};
                renderOrders();
                showToast(`✅ ${jsonData.length} pedidos cargados correctamente.`, 'success');
            }
        } else {
            showToast("⚠️ El archivo parece estar vacío.", "warning");
            renderOrders();
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        showToast("❌ Error al procesar el archivo.", "error");
        renderOrders();
    }
};

window.renderOrders = function () {
    console.log("Rendering Orders Table with Filters...");
    const container = document.getElementById('orders-table-container');
    if (!container) return;

    ensureStateOrders();

    if (!state.orders || state.orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span style="font-size: 48px; margin-bottom: 10px; display:block;">📂</span>
                <p>No hay pedidos cargados.</p>
                <p style="font-size: 12px;">Sube el archivo Excel para visualizar los datos.</p>
            </div>`;
        return;
    }

    // Get columns from first row
    const columns = Object.keys(state.orders[0]);

    // Build Table Header with Filter Inputs
    let html = `
    <div class="table-responsive" style="height: 100%; overflow-y: auto;">
        <table class="data-table" id="orders-main-table" style="table-layout: fixed; width: 100%; word-wrap: break-word;">
            <thead>
                <tr>`;

    // Header Row 1: Titles
    columns.forEach(col => {
        html += `<th style="padding: 8px; background: #f8f9fa; border-bottom: 2px solid #ddd; white-space: normal; vertical-align: bottom;">${col}</th>`;
    });
    html += `</tr>
             <tr class="filter-row">`;

    // Header Row 2: Inputs
    columns.forEach(col => {
        const currentVal = window.ordersFilterState[col] || '';
        html += `
            <th style="padding: 4px; background: #f1f3f4;">
                <input type="text" 
                       class="col-filter-input" 
                       data-col="${col}" 
                       value="${currentVal}" 
                       placeholder="Filtrar..." 
                       oninput="applyColumnFilter(this)"
                       style="width: 100%; padding: 4px; font-size: 11px; border: 1px solid #ccc; border-radius: 4px;">
            </th>`;
    });

    html += `   </tr>
            </thead>
            <tbody>`;

    state.orders.forEach((row, index) => {
        html += `<tr class="order-row" style="border-bottom: 1px solid #eee;">`;
        columns.forEach(col => {
            let val = row[col] !== undefined ? row[col] : '';
            html += `<td style="padding: 8px; vertical-align: top; white-space: normal; word-break: break-word;">${val}</td>`;
        });
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Re-apply filters after render to match state
    applyStoredFilters();
};

window.applyColumnFilter = function (input) {
    const col = input.dataset.col;
    const val = input.value.toLowerCase();

    window.ordersFilterState[col] = val; // Update state

    applyStoredFilters();
};

// Apply all filters currently in state
function applyStoredFilters() {
    const table = document.getElementById('orders-main-table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr.order-row');
    const cols = Object.keys(state.orders[0]); // Column order maps index

    // Global Search term also
    const globalSearch = document.getElementById('orders-search');
    const globalTerm = globalSearch ? globalSearch.value.toLowerCase() : '';

    rows.forEach(row => {
        let isVisible = true;
        const cells = row.cells; // HTMLCollection

        // 1. Check Column Filters
        for (let i = 0; i < cols.length; i++) {
            const colName = cols[i];
            const filterVal = window.ordersFilterState[colName];

            if (filterVal && filterVal.length > 0) {
                const cellText = cells[i].innerText.toLowerCase();
                if (!cellText.includes(filterVal)) {
                    isVisible = false;
                    break;
                }
            }
        }

        // 2. Check Global Search (only if passed column filters)
        if (isVisible && globalTerm) {
            const rowText = row.innerText.toLowerCase();
            if (!rowText.includes(globalTerm)) {
                isVisible = false;
            }
        }

        row.style.display = isVisible ? '' : 'none';
    });
}

// --- DEEP CLEANING EXPERT AUDIT (V2) ---
window.runCleaningAudit = function () {
    console.log("Running Deep Cleaning Expert Audit...");

    if (!state.orders || state.orders.length === 0) {
        showToast("⚠️ No hay pedidos para auditar.", "warning");
        return;
    }

    const modal = document.getElementById('status-detail-modal');
    const modalTitle = document.getElementById('status-modal-title');
    const modalBody = document.getElementById('status-modal-body');

    modalTitle.innerHTML = "🕵️ CONSULTORÍA DE EFICIENCIA Y SEGURIDAD (V2)";

    // --- 1. ANALYSIS BY SERVICE ---
    let services = {};
    let globalStats = {
        totalCost: 0,
        totalItems: state.orders.length,
        categoryCounts: { 'QUIMICOS': 0, 'CELULOSA': 0, 'BOLSAS': 0, 'UTILES': 0, 'EPIS': 0, 'MAQUINARIA': 0 }
    };
    let anomalies = [];

    state.orders.forEach(row => {
        const serviceName = row['NOMBRE DEL SERVICIO'] || "DESCONOCIDO";
        const desc = (row['DESCRIPCION'] || "").toLowerCase();
        const family = (row['Denom.gr-artículos'] || "").toUpperCase();
        const cost = parseFloat(row['TOTAL']) || 0;

        // Init Service Stats
        if (!services[serviceName]) {
            services[serviceName] = {
                name: serviceName,
                cost: 0,
                items: 0,
                hasChemicals: false,
                hasGloves: false,
                hasBags: false,
                products: []
            };
        }

        // Update Service
        services[serviceName].cost += cost;
        services[serviceName].items++;
        services[serviceName].products.push({ desc, cost });
        globalStats.totalCost += cost;

        // Categorize Item
        let category = 'OTROS';
        if (desc.includes('lejia') || desc.includes('detergente') || desc.includes('fregasuelos') || desc.includes('limpiador') || desc.includes('jabon') || family.includes('QUIM')) {
            category = 'QUIMICOS';
            services[serviceName].hasChemicals = true;
        } else if (desc.includes('papel') || desc.includes('higienico') || desc.includes('secamanos') || family.includes('CELULOSA')) {
            category = 'CELULOSA';
        } else if (desc.includes('bolsa') || desc.includes('saco') || family.includes('BOLSAS')) {
            category = 'BOLSAS';
            services[serviceName].hasBags = true;
        } else if (desc.includes('guante') || desc.includes('mascarilla') || family.includes('GUANTES') || family.includes('EPIS')) {
            category = 'EPIS';
            services[serviceName].hasGloves = true;
        } else if (desc.includes('fregona') || desc.includes('cepillo') || desc.includes('palo') || desc.includes('mopa') || desc.includes('bayeta') || family.includes('UTIL')) {
            category = 'UTILES';
        } else if (desc.includes('aspiradora') || desc.includes('rotativa') || desc.includes('fregadora')) {
            category = 'MAQUINARIA';
        }

        if (globalStats.categoryCounts[category] !== undefined) {
            globalStats.categoryCounts[category]++;
        }
    });

    // --- 2. GENERATE INSIGHTS FROM SERVICES ---
    let expensiveServices = Object.values(services).sort((a, b) => b.cost - a.cost).slice(0, 5);

    Object.values(services).forEach(srv => {
        // ANOMALY: Chemicals without Gloves
        if (srv.hasChemicals && !srv.hasGloves && srv.cost > 20) {
            anomalies.push({
                type: 'SEGURIDAD',
                level: 'high',
                msg: `En <b>${srv.name}</b> se piden químicos pero <u>NO hay guantes</u>.`,
                icon: '🧤'
            });
        }
        // ANOMALY: Cleaning without Bags? (Maybe valid, but suspicious)
        if (srv.items > 10 && !srv.hasBags) {
            anomalies.push({
                type: 'OPERATIVA',
                level: 'medium',
                msg: `En <b>${srv.name}</b> hay mucho pedido (${srv.items} items) pero <u>NO hay bolsas</u> de basura.`,
                icon: '🗑️'
            });
        }
    });


    // --- 3. BUILD HTML REPORT ---
    let reportHtml = `
        <div class="audit-dashboard-v2" style="font-family: 'Segoe UI', sans-serif;">
            
            <!-- ALERTAS IMPORTANTES (Top Section) -->
            ${anomalies.length > 0 ? `
                <div class="audit-alerts" style="margin-bottom: 20px;">
                    <h3 style="color:#d93025; font-size:14px; border-bottom:2px solid #fce8e6; padding-bottom:5px;">🚨 ALERTAS OPERATIVAS (${anomalies.length})</h3>
                    <div style="max-height: 150px; overflow-y: auto; background: #fff5f5; border: 1px solid #fce8e6; border-radius: 8px; padding: 10px;">
                        ${anomalies.map(a => `
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; border-bottom:1px dashed #fad2cf; padding-bottom:4px;">
                                <span style="font-size:18px;">${a.icon}</span>
                                <span style="font-size:12px; color:#c5221f;">${a.msg}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                
                <!-- GASTO POR CATEGORÍA (Left Chart Simulation) -->
                <div class="audit-card">
                    <h4 style="font-size:13px; color:#1a73e8; margin-bottom:10px;">📊 DISTRIBUCIÓN DEL GASTO</h4>
                    ${Object.keys(globalStats.categoryCounts).map(cat => {
        let count = globalStats.categoryCounts[cat];
        if (count === 0) return '';
        let pct = Math.round((count / globalStats.totalItems) * 100);
        let color = '#5f6368';
        if (cat === 'QUIMICOS') color = '#ea4335';
        if (cat === 'EPIS') color = '#34a853';
        if (cat === 'CELULOSA') color = '#fbbc04';

        return `
                            <div style="margin-bottom:8px;">
                                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                                    <span>${cat}</span>
                                    <strong>${count} items (${pct}%)</strong>
                                </div>
                                <div style="height:6px; background:#f1f3f4; border-radius:3px; overflow:hidden;">
                                    <div style="height:100%; width:${pct}%; background:${color};"></div>
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>

                <!-- TOP SERVICIOS GASTO (Right List) -->
                <div class="audit-card">
                    <h4 style="font-size:13px; color:#1a73e8; margin-bottom:10px;">💰 TOP 5 SERVICIOS (GASTO)</h4>
                    <ul style="list-style:none; padding:0; margin:0;">
                        ${expensiveServices.map((srv, idx) => `
                            <li style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f1f3f4; font-size:11px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="background:#e8f0fe; color:#1a73e8; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; font-size:9px;">${idx + 1}</span>
                                    <span style="font-weight:500;" title="${srv.name}">${srv.name.substring(0, 20)}...</span>
                                </div>
                                <strong style="color:#3c4043;">${srv.cost.toFixed(2)}€</strong>
                            </li>
                        `).join('')}
                    </ul>
                </div>

            </div>

            <!-- ECO-TIPS & RECOMENDACIONES -->
            <div style="margin-top: 20px; background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <h4 style="color:#15803d; font-size:13px; margin-bottom:10px;">🌿 RECOMENDACIONES DEL EXPERTO</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="font-size:11px; color:#14532d;">
                        <strong>💡 AHORRO EN BOLSAS</strong><br>
                        Si usas bolsas de basura 'Negra Comunidad', revisa si puedes usar 'Compacta' para papeleras de oficina. Ahorro estimado: 15%.
                    </div>
                    <div style="font-size:11px; color:#14532d;">
                        <strong>💧 DILUCIÓN DE QUÍMICOS</strong><br>
                        El gasto en químicos es del ${Math.round((globalStats.categoryCounts['QUIMICOS'] / globalStats.totalItems) * 100)}%. Utiiza sistemas de dosificación para evitar el "chorro libre".
                    </div>
                </div>
            </div>

            <div style="text-align:right; margin-top:20px; font-size:10px; color:#9aa0a6;">
                Análisis realizado automáticamente por el Motor de Análisis Operativo SIFU sobre ${state.orders.length} líneas de pedido.
            </div>

        </div>
    `;

    modalBody.innerHTML = reportHtml;
    modal.classList.add('active');
};

window.initOrdersModule = function () {
    console.log("Configurando listeners de Pedidos (v5)...");

    // Global Search Listener
    const searchInput = document.getElementById('orders-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            applyStoredFilters();
        };
    }

    // Attempt to load default data if empty
    ensureStateOrders();

    // Render
    renderOrders();
};
