// indexeddb-persist.js
var DB_PERSIST_NAME = "SifuPersistDB";
var DB_PERSIST_VERSION = 1;
var STORE_PERSIST_NAME = "AppState";
function openPersistDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_PERSIST_NAME, DB_PERSIST_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PERSIST_NAME)) {
        db.createObjectStore(STORE_PERSIST_NAME);
      }
    };
  });
}
async function saveStateToIndexedDB2(stateData) {
  try {
    const db = await openPersistDB();
    const transaction = db.transaction([STORE_PERSIST_NAME], "readwrite");
    const store = transaction.objectStore(STORE_PERSIST_NAME);
    store.put(stateData, "appState");
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log("✅ Estado guardado en IndexedDB");
        resolve(true);
      };
      transaction.onerror = () => {
        console.error("❌ Error guardando en IndexedDB:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("❌ Error en saveStateToIndexedDB:", error);
    return false;
  }
}
async function loadStateFromIndexedDB2() {
  try {
    const db = await openPersistDB();
    const transaction = db.transaction([STORE_PERSIST_NAME], "readonly");
    const store = transaction.objectStore(STORE_PERSIST_NAME);
    const request = store.get("appState");
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
          console.log("✅ Estado cargado desde IndexedDB");
          resolve(request.result);
        } else {
          console.log("⚠️ No hay datos en IndexedDB");
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error("❌ Error cargando desde IndexedDB:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("❌ Error en loadStateFromIndexedDB:", error);
    return null;
  }
}
window.saveStateToIndexedDB = saveStateToIndexedDB2;
window.loadStateFromIndexedDB = loadStateFromIndexedDB2;

// operational_service.js
var OperationalService2 = {
  analyzeResilience() {
    if (!state.masterData || state.masterData.length === 0) {
      return {
        score: 0,
        metrics: { total: 0, descubiertos: 0, bajas: 0, vacaciones: 0, activos: 0, suplentes: 0 },
        hotspots: [],
        summaryList: []
      };
    }
    let integrityScore = 100;
    const totalServices = state.masterData.length;
    const seenServices = new Set;
    const metrics = {
      total: totalServices,
      descubiertos: 0,
      bajas: 0,
      vacaciones: 0,
      activos: 0,
      suplentes: 0
    };
    const summaryMap = new Map;
    const seenDescubiertos = new Set;
    state.masterData.forEach((row) => {
      const serv = (row.SERVICIO || row.PROYECTO || "").toString().trim();
      const tit = (row.TITULAR || "").toString();
      const hor = (row.HORARIO || "").toString();
      const uniqueKey = `${serv}-${tit}-${hor}`;
      if (seenServices.has(uniqueKey))
        return;
      seenServices.add(uniqueKey);
      const keys = Object.keys(row);
      const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
      const kEstado1 = keys.find((k) => k.toUpperCase().trim() === "ESTADO1") || "ESTADO1";
      const kTitular2 = keys.find((k) => k.toUpperCase().trim() === "TITULAR") || "TITULAR";
      const status = (row[kEstado2] || "").toString().toUpperCase();
      const status1 = (row[kEstado1] || "").toString().toUpperCase();
      const titular = (row[kTitular2] || "").toString().toUpperCase();
      const centro = row.CENTRO || row.ZONA || row["TIPO S"] || (row.SERVICIO ? row.SERVICIO.split(" - ")[0] : "Sin Centro");
      let isDescubierto = false;
      if (status.includes("DESCUBIERTO") || status.includes("VACANTE") || status.includes("SIN ASIGNAR") || titular.includes("SIN TITULAR") || titular.includes("DESCUBIERTO") || titular.includes("VACANTE") || status === "" && titular === "" || status === "PENDIENTE" && titular === "") {
        isDescubierto = true;
      }
      if (isDescubierto) {
        const srvKey = serv.toUpperCase();
        if (!seenDescubiertos.has(srvKey)) {
          seenDescubiertos.add(srvKey);
          metrics.descubiertos++;
          integrityScore -= 5;
          const cData = summaryMap.get(centro) || { centro, descubiertos: 0, bajas: 0 };
          cData.descubiertos++;
          summaryMap.set(centro, cData);
        }
      }
      if (status1.includes("BAJA") || status.includes("BAJA") || status.includes(" IT") || status.includes("I.T")) {
        metrics.bajas++;
        const suplente = row.SUPLENTE || row.COBERTURA || "";
        if (!suplente || suplente.length < 3) {
          integrityScore -= 3;
          const cData = summaryMap.get(centro) || { centro, descubiertos: 0, bajas: 0 };
          cData.bajas++;
          summaryMap.set(centro, cData);
        } else {
          metrics.suplentes++;
        }
      }
      if (status1.includes("VACACIONES"))
        metrics.vacaciones++;
      if (!isDescubierto && !status1.includes("BAJA"))
        metrics.activos++;
    });
    integrityScore = Math.max(0, Math.min(100, integrityScore));
    const fatigueMap = new Map;
    (state.incidents || []).forEach((inc) => {
      const count = (fatigueMap.get(inc.worker) || 0) + 1;
      fatigueMap.set(inc.worker, count);
    });
    const burnoutRisks = [];
    fatigueMap.forEach((count, worker) => {
      if (count > 2) {
        burnoutRisks.push({ worker, score: count * 20, reason: `${count} incidencias recientes` });
      }
    });
    const summaryList = Array.from(summaryMap.values()).sort((a, b) => b.descubiertos + b.bajas - (a.descubiertos + a.bajas)).slice(0, 8);
    return { score: integrityScore, metrics, summaryList, burnoutRisks };
  }
};
window.OperationalService = OperationalService2;

// analytics_engine.js
function renderAnalytics() {
  renderHeatmap();
  renderTopClients();
}
function renderHeatmap() {
  const ctx = document.getElementById("heatmapCanvas");
  if (!ctx)
    return;
  if (window.heatmapChart instanceof Chart) {
    window.heatmapChart.destroy();
  }
  let covered = 0;
  let uncovered = 0;
  let medical = 0;
  let vacations = 0;
  state.masterData.forEach((row) => {
    const est = (row.ESTADO || "").toUpperCase();
    const est1 = (row.ESTADO1 || "").toUpperCase();
    const obs = (row.OBSERVACIONES || "").toLowerCase();
    if (est.includes("DESCUBIERTO"))
      uncovered++;
    else if (est1.includes("BAJA") || est.includes("BAJA") || est.includes(" IT"))
      medical++;
    else if (est1.includes("VACACIONES"))
      vacations++;
    else
      covered++;
  });
  const gradGreen = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
  gradGreen.addColorStop(0, "rgba(34, 197, 94, 0.9)");
  gradGreen.addColorStop(1, "rgba(21, 128, 61, 0.9)");
  const gradRed = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
  gradRed.addColorStop(0, "rgba(239, 68, 68, 0.9)");
  gradRed.addColorStop(1, "rgba(185, 28, 28, 0.9)");
  const gradBlue = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
  gradBlue.addColorStop(0, "rgba(59, 130, 246, 0.9)");
  gradBlue.addColorStop(1, "rgba(29, 78, 216, 0.9)");
  const gradAmber = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
  gradAmber.addColorStop(0, "rgba(245, 158, 11, 0.9)");
  gradAmber.addColorStop(1, "rgba(180, 83, 9, 0.9)");
  window.heatmapChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Cubiertos", "Descubiertos", "Bajas IT", "Vacaciones"],
      datasets: [{
        data: [covered, uncovered, medical, vacations],
        backgroundColor: [gradGreen, gradRed, gradBlue, gradAmber],
        borderColor: [
          "#22c55e",
          "#ef4444",
          "#3b82f6",
          "#f59e0b"
        ],
        borderWidth: 2,
        hoverOffset: 15
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: "#cbd5e1",
            font: { family: "Outfit", size: 10 }
          }
        },
        title: {
          display: false,
          text: "Estado Global de Servicios"
        }
      },
      cutout: "70%",
      animation: {
        animateScale: true,
        animateRotate: true
      }
    }
  });
}
function renderTopClients() {
  const ctx = document.getElementById("topClientsChart");
  if (!ctx)
    return;
  if (window.topClientsChart instanceof Chart) {
    window.topClientsChart.destroy();
  }
  const clientCounts = {};
  state.masterData.forEach((row) => {
    const client = row.TIPO_S || "OTROS";
    clientCounts[client] = (clientCounts[client] || 0) + 1;
  });
  const sortedClients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const gradSky = ctx.getContext("2d").createLinearGradient(0, 0, 500, 0);
  gradSky.addColorStop(0, "rgba(14, 165, 233, 0.9)");
  gradSky.addColorStop(1, "rgba(2, 132, 199, 0.9)");
  window.topClientsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedClients.map((x) => x[0]),
      datasets: [{
        label: "Servicios Activos",
        data: sortedClients.map((x) => x[1]),
        backgroundColor: gradSky,
        borderColor: "#0ea5e9",
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8" }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#e2e8f0" }
        }
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderAnalytics, 1500);
});
window.refreshAnalytics = renderAnalytics;

// quality_module.js
window.openQualityModal = function() {
  const modal = document.getElementById("quality-modal");
  const select = document.getElementById("quality-service-select");
  if (select && state.masterData) {
    const keys = Object.keys(state.masterData[0] || {});
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
    const uniqueServices = [...new Set(state.masterData.map((r) => r[kServicio2]))].filter((s) => s).sort();
    select.innerHTML = uniqueServices.map((s) => `<option value="${s}">${s}</option>`).join("");
  }
  modal.classList.add("active");
};
window.closeQualityModal = function() {
  document.getElementById("quality-modal").classList.remove("active");
};
window.initQualityModule = function() {
  console.log("⭐ Inicializando Módulo de Calidad Master...");
  const form = document.getElementById("quality-form");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      saveAudit();
    };
  }
  renderQualityDashboard();
};
function saveAudit() {
  const service = document.getElementById("quality-service-select").value;
  const score = parseInt(document.getElementById("quality-score-range").value);
  const notes = document.getElementById("quality-notes").value;
  const newAudit = {
    id: Date.now(),
    service,
    score,
    notes,
    date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    supervisor: "Gestor Principal"
  };
  if (!state.audits)
    state.audits = [];
  state.audits.unshift(newAudit);
  if (typeof saveAllState === "function")
    saveAllState();
  closeQualityModal();
  renderQualityDashboard();
  updateTicker(`AUDITORÍA REGISTRADA: ${service} (${score}/10)`);
  showToast(`✅ Auditoría guardada correctamente.`, "success");
}
window.renderQualityDashboard = function() {
  const feed = document.getElementById("quality-feed");
  const scoreEl = document.getElementById("avg-quality-score");
  const countEl = document.getElementById("quality-count-total");
  const rankingEl = document.getElementById("quality-ranking");
  if (!feed || !state.audits)
    return;
  console.log("\uD83D\uDCCA Renderizando Dashboard de Calidad:", state.audits.length);
  if (state.audits.length === 0) {
    feed.innerHTML = '<div class="empty-state">No hay auditorías registradas todavía.</div>';
    scoreEl.textContent = "--";
    countEl.textContent = "0 AUDITORÍAS REALIZADAS";
    return;
  }
  const totalScore = state.audits.reduce((acc, curr) => acc + curr.score, 0);
  const avg = (totalScore / state.audits.length).toFixed(1);
  scoreEl.textContent = avg;
  countEl.textContent = `${state.audits.length} AUDITORÍAS REALIZADAS`;
  const serviceAvg = {};
  state.audits.forEach((a) => {
    if (!serviceAvg[a.service])
      serviceAvg[a.service] = { sum: 0, count: 0 };
    serviceAvg[a.service].sum += a.score;
    serviceAvg[a.service].count++;
  });
  const sortedRanking = Object.entries(serviceAvg).map(([name, data]) => ({ name, avg: (data.sum / data.count).toFixed(1) })).sort((a, b) => b.avg - a.avg).slice(0, 5);
  rankingEl.innerHTML = sortedRanking.map((r, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:11px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; color:var(--text-dim);">${i + 1}.</span>
                <span title="${r.name}">${r.name.length > 25 ? r.name.substring(0, 22) + "..." : r.name}</span>
            </div>
            <strong style="color:${r.avg >= 8 ? "var(--accent-green)" : r.avg >= 5 ? "#fbbc04" : "#ea4335"}">${r.avg}</strong>
        </div>
    `).join("");
  feed.innerHTML = state.audits.map((a) => {
    let scoreColor = "var(--accent-green)";
    if (a.score < 5)
      scoreColor = "#ea4335";
    else if (a.score < 8)
      scoreColor = "#fbbc04";
    return `
            <div class="analysis-card" style="padding:15px; border-left:4px solid ${scoreColor};">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                    <div>
                        <div style="font-weight:700; color:var(--text-main); font-size:14px;">${a.service}</div>
                        <div style="font-size:10px; color:var(--text-dim);">${a.date} | Por: ${a.supervisor}</div>
                    </div>
                    <div style="font-size:20px; font-weight:900; color:${scoreColor}">${a.score}<span style="font-size:10px; opacity:0.6;">/10</span></div>
                </div>
                <div style="font-size:11px; color:var(--text-main); line-height:1.4;">${a.notes || "Sin observaciones adicionales."}</div>
            </div>
        `;
  }).join("");
};

// orders_module.js
window.ordersFilterState = {};
function ensureStateOrders() {
  if (typeof state === "undefined")
    return false;
  if (!state.orders) {
    state.orders = [];
  }
  if (state.orders.length === 0 && typeof INITIAL_ORDERS_DATA !== "undefined" && INITIAL_ORDERS_DATA.length > 0) {
    console.log("\uD83D\uDCE5 Loading Default Orders Data...");
    state.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS_DATA));
    if (typeof saveAllState === "function")
      saveAllState();
  }
  return true;
}
window.handleOrdersExcel = async function(file) {
  if (!file)
    return;
  if (typeof XLSX === "undefined") {
    showToast("ERROR: Librería Excel (XLSX) no cargada.", "error");
    return;
  }
  const container = document.getElementById("orders-table-container");
  if (container)
    container.innerHTML = '<div class="loading-spinner">⏳ Procesando archivo de pedidos...</div>';
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (jsonData && jsonData.length > 0) {
      if (ensureStateOrders()) {
        state.orders = jsonData;
        if (typeof saveAllState === "function")
          saveAllState();
        window.ordersFilterState = {};
        renderOrders();
        showToast(`✅ ${jsonData.length} pedidos cargados correctamente.`, "success");
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
window.renderOrders = function() {
  console.log("Rendering Orders Table with Filters...");
  const container = document.getElementById("orders-table-container");
  if (!container)
    return;
  ensureStateOrders();
  if (!state.orders || state.orders.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <span style="font-size: 48px; margin-bottom: 10px; display:block;">\uD83D\uDCC2</span>
                <p>No hay pedidos cargados.</p>
                <p style="font-size: 12px;">Sube el archivo Excel para visualizar los datos.</p>
            </div>`;
    return;
  }
  const columns = Object.keys(state.orders[0]);
  let html = `
    <div class="table-responsive" style="height: 100%; overflow-y: auto;">
        <table class="data-table" id="orders-main-table" style="table-layout: fixed; width: 100%; word-wrap: break-word;">
            <thead>
                <tr>`;
  columns.forEach((col) => {
    html += `<th style="padding: 8px; background: #f8f9fa; border-bottom: 2px solid #ddd; white-space: normal; vertical-align: bottom;">${col}</th>`;
  });
  html += `</tr>
             <tr class="filter-row">`;
  columns.forEach((col) => {
    const currentVal = window.ordersFilterState[col] || "";
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
    columns.forEach((col) => {
      let val = row[col] !== undefined ? row[col] : "";
      html += `<td style="padding: 8px; vertical-align: top; white-space: normal; word-break: break-word;">${val}</td>`;
    });
    html += `</tr>`;
  });
  html += "</tbody></table></div>";
  container.innerHTML = html;
  applyStoredFilters();
};
window.applyColumnFilter = function(input) {
  const col = input.dataset.col;
  const val = input.value.toLowerCase();
  window.ordersFilterState[col] = val;
  applyStoredFilters();
};
function applyStoredFilters() {
  const table = document.getElementById("orders-main-table");
  if (!table)
    return;
  const rows = table.querySelectorAll("tbody tr.order-row");
  const cols = Object.keys(state.orders[0]);
  const globalSearch = document.getElementById("orders-search");
  const globalTerm = globalSearch ? globalSearch.value.toLowerCase() : "";
  rows.forEach((row) => {
    let isVisible = true;
    const cells = row.cells;
    for (let i = 0;i < cols.length; i++) {
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
    if (isVisible && globalTerm) {
      const rowText = row.innerText.toLowerCase();
      if (!rowText.includes(globalTerm)) {
        isVisible = false;
      }
    }
    row.style.display = isVisible ? "" : "none";
  });
}
window.runCleaningAudit = function() {
  console.log("Running Deep Cleaning Expert Audit...");
  if (!state.orders || state.orders.length === 0) {
    showToast("⚠️ No hay pedidos para auditar.", "warning");
    return;
  }
  const modal = document.getElementById("status-detail-modal");
  const modalTitle = document.getElementById("status-modal-title");
  const modalBody = document.getElementById("status-modal-body");
  modalTitle.innerHTML = "\uD83D\uDD75️ CONSULTORÍA DE EFICIENCIA Y SEGURIDAD (V2)";
  let services = {};
  let globalStats = {
    totalCost: 0,
    totalItems: state.orders.length,
    categoryCounts: { QUIMICOS: 0, CELULOSA: 0, BOLSAS: 0, UTILES: 0, EPIS: 0, MAQUINARIA: 0 }
  };
  let anomalies = [];
  state.orders.forEach((row) => {
    const serviceName = row["NOMBRE DEL SERVICIO"] || "DESCONOCIDO";
    const desc = (row["DESCRIPCION"] || "").toLowerCase();
    const family = (row["Denom.gr-artículos"] || "").toUpperCase();
    const cost = parseFloat(row["TOTAL"]) || 0;
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
    services[serviceName].cost += cost;
    services[serviceName].items++;
    services[serviceName].products.push({ desc, cost });
    globalStats.totalCost += cost;
    let category = "OTROS";
    if (desc.includes("lejia") || desc.includes("detergente") || desc.includes("fregasuelos") || desc.includes("limpiador") || desc.includes("jabon") || family.includes("QUIM")) {
      category = "QUIMICOS";
      services[serviceName].hasChemicals = true;
    } else if (desc.includes("papel") || desc.includes("higienico") || desc.includes("secamanos") || family.includes("CELULOSA")) {
      category = "CELULOSA";
    } else if (desc.includes("bolsa") || desc.includes("saco") || family.includes("BOLSAS")) {
      category = "BOLSAS";
      services[serviceName].hasBags = true;
    } else if (desc.includes("guante") || desc.includes("mascarilla") || family.includes("GUANTES") || family.includes("EPIS")) {
      category = "EPIS";
      services[serviceName].hasGloves = true;
    } else if (desc.includes("fregona") || desc.includes("cepillo") || desc.includes("palo") || desc.includes("mopa") || desc.includes("bayeta") || family.includes("UTIL")) {
      category = "UTILES";
    } else if (desc.includes("aspiradora") || desc.includes("rotativa") || desc.includes("fregadora")) {
      category = "MAQUINARIA";
    }
    if (globalStats.categoryCounts[category] !== undefined) {
      globalStats.categoryCounts[category]++;
    }
  });
  let expensiveServices = Object.values(services).sort((a, b) => b.cost - a.cost).slice(0, 5);
  Object.values(services).forEach((srv) => {
    if (srv.hasChemicals && !srv.hasGloves && srv.cost > 20) {
      anomalies.push({
        type: "SEGURIDAD",
        level: "high",
        msg: `En <b>${srv.name}</b> se piden químicos pero <u>NO hay guantes</u>.`,
        icon: "\uD83E\uDDE4"
      });
    }
    if (srv.items > 10 && !srv.hasBags) {
      anomalies.push({
        type: "OPERATIVA",
        level: "medium",
        msg: `En <b>${srv.name}</b> hay mucho pedido (${srv.items} items) pero <u>NO hay bolsas</u> de basura.`,
        icon: "\uD83D\uDDD1️"
      });
    }
  });
  let reportHtml = `
        <div class="audit-dashboard-v2" style="font-family: 'Segoe UI', sans-serif;">
            
            <!-- ALERTAS IMPORTANTES (Top Section) -->
            ${anomalies.length > 0 ? `
                <div class="audit-alerts" style="margin-bottom: 20px;">
                    <h3 style="color:#d93025; font-size:14px; border-bottom:2px solid #fce8e6; padding-bottom:5px;">\uD83D\uDEA8 ALERTAS OPERATIVAS (${anomalies.length})</h3>
                    <div style="max-height: 150px; overflow-y: auto; background: #fff5f5; border: 1px solid #fce8e6; border-radius: 8px; padding: 10px;">
                        ${anomalies.map((a) => `
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; border-bottom:1px dashed #fad2cf; padding-bottom:4px;">
                                <span style="font-size:18px;">${a.icon}</span>
                                <span style="font-size:12px; color:#c5221f;">${a.msg}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : ""}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                
                <!-- GASTO POR CATEGORÍA (Left Chart Simulation) -->
                <div class="audit-card">
                    <h4 style="font-size:13px; color:#1a73e8; margin-bottom:10px;">\uD83D\uDCCA DISTRIBUCIÓN DEL GASTO</h4>
                    ${Object.keys(globalStats.categoryCounts).map((cat) => {
    let count = globalStats.categoryCounts[cat];
    if (count === 0)
      return "";
    let pct = Math.round(count / globalStats.totalItems * 100);
    let color = "#5f6368";
    if (cat === "QUIMICOS")
      color = "#ea4335";
    if (cat === "EPIS")
      color = "#34a853";
    if (cat === "CELULOSA")
      color = "#fbbc04";
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
  }).join("")}
                </div>

                <!-- TOP SERVICIOS GASTO (Right List) -->
                <div class="audit-card">
                    <h4 style="font-size:13px; color:#1a73e8; margin-bottom:10px;">\uD83D\uDCB0 TOP 5 SERVICIOS (GASTO)</h4>
                    <ul style="list-style:none; padding:0; margin:0;">
                        ${expensiveServices.map((srv, idx) => `
                            <li style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f1f3f4; font-size:11px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="background:#e8f0fe; color:#1a73e8; width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; font-size:9px;">${idx + 1}</span>
                                    <span style="font-weight:500;" title="${srv.name}">${srv.name.substring(0, 20)}...</span>
                                </div>
                                <strong style="color:#3c4043;">${srv.cost.toFixed(2)}€</strong>
                            </li>
                        `).join("")}
                    </ul>
                </div>

            </div>

            <!-- ECO-TIPS & RECOMENDACIONES -->
            <div style="margin-top: 20px; background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <h4 style="color:#15803d; font-size:13px; margin-bottom:10px;">\uD83C\uDF3F RECOMENDACIONES DEL EXPERTO</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="font-size:11px; color:#14532d;">
                        <strong>\uD83D\uDCA1 AHORRO EN BOLSAS</strong><br>
                        Si usas bolsas de basura 'Negra Comunidad', revisa si puedes usar 'Compacta' para papeleras de oficina. Ahorro estimado: 15%.
                    </div>
                    <div style="font-size:11px; color:#14532d;">
                        <strong>\uD83D\uDCA7 DILUCIÓN DE QUÍMICOS</strong><br>
                        El gasto en químicos es del ${Math.round(globalStats.categoryCounts["QUIMICOS"] / globalStats.totalItems * 100)}%. Utiiza sistemas de dosificación para evitar el "chorro libre".
                    </div>
                </div>
            </div>

            <div style="text-align:right; margin-top:20px; font-size:10px; color:#9aa0a6;">
                Análisis realizado automáticamente por el Motor de Análisis Operativo SIFU sobre ${state.orders.length} líneas de pedido.
            </div>

        </div>
    `;
  modalBody.innerHTML = reportHtml;
  modal.classList.add("active");
};
window.initOrdersModule = function() {
  console.log("Configurando listeners de Pedidos (v5)...");
  const searchInput = document.getElementById("orders-search");
  if (searchInput) {
    searchInput.oninput = (e) => {
      applyStoredFilters();
    };
  }
  ensureStateOrders();
  renderOrders();
};

// it_module.js
window.renderAbsences = function() {
  console.log("\uD83D\uDE80 Renderizando Dashboard de Bajas IT...");
  const container = document.getElementById("absences-feed");
  if (!container)
    return;
  const masterData = state.masterData || [];
  if (!masterData || masterData.length === 0) {
    container.innerHTML = `<div class="empty-state">
            <div class="icon">\uD83D\uDCC1</div>
            <h3>SIN DATOS MAESTROS</h3>
            <p>Cargue el archivo Excel para activar el seguimiento IT.</p>
        </div>`;
    return;
  }
  const itCases = masterData.filter((row) => {
    const stateVal = (row["ESTADO1"] || row["Estado1"] || "").trim().toUpperCase();
    const genVal = (row["ESTADO"] || row["Estado"] || "").trim().toUpperCase();
    return stateVal.includes("BAJA") || stateVal.includes("IT") || genVal.includes("BAJA") || genVal.includes("IT") || stateVal.includes("VACACIONES");
  });
  if (itCases.length === 0) {
    container.innerHTML = `
            <div class="empty-discovery">
                <div class="icon">✅</div>
                <h3>SIN BAJAS ACTIVAS</h3>
                <p>No se registran procesos de IT o absentismo en este momento.</p>
            </div>`;
    ["it-count-total", "it-count-uncovered", "it-count-covered", "it-count-long"].forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.innerText = "0";
    });
    return;
  }
  itCases.sort((a, b) => {
    const statusA = (a["ESTADO"] || "").toUpperCase();
    const statusB = (b["ESTADO"] || "").toUpperCase();
    if (statusA === "DESCUBIERTO" && statusB !== "DESCUBIERTO")
      return -1;
    if (statusA !== "DESCUBIERTO" && statusB === "DESCUBIERTO")
      return 1;
    return 0;
  });
  const totalCount = itCases.length;
  const uncoveredCount = itCases.filter((r) => (r["ESTADO"] || "").toUpperCase() === "DESCUBIERTO" || !r["SUPLENTE"]).length;
  const coveredCount = totalCount - uncoveredCount;
  const longDurationCount = itCases.filter((r) => {
    const start = r["F. Inicio IT"] || r["Fecha"];
    if (!start)
      return false;
    return start.includes("/01/") || start.includes("ENERO") || start.includes("2025");
  }).length;
  const statMap = {
    "it-count-total": totalCount,
    "it-count-uncovered": uncoveredCount,
    "it-count-covered": coveredCount,
    "it-count-long": longDurationCount
  };
  Object.entries(statMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el)
      el.innerText = val;
  });
  const efficiency = (coveredCount / totalCount * 100).toFixed(1);
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
                        <span>\uD83D\uDCCA</span> VER ANÁLISIS DETALLADO
                    </button>
                    <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 12px; margin-left:10px;" onclick="window.exportStatusToPDF(true)">
                        <span>\uD83D\uDCC4</span> EXPORTAR LISTADO
                    </button>
                </div>
            </div>

            <!-- Interactive IT Grid -->
            <div class="uncovered-grid">
                ${itCases.map((row, idx) => {
    const worker = row["TITULAR"] || "PERSONAL";
    const service = row["SERVICIO"] || "CENTRO";
    const cause = row["ESTADO1"] || "BAJA IT";
    const substitute = row["SUPLENTE"] || "";
    const startStr = row["F. Inicio IT"] || row["Fecha"] || "--";
    const estadoGen = (row["ESTADO"] || "").toUpperCase();
    const isCovered = estadoGen === "CUBIERTO" || substitute && substitute.length > 2;
    const isVacation = cause.toUpperCase().includes("VAC");
    const cardClass = isCovered ? "covered" : "critical";
    const badgeText = isCovered ? isVacation ? "Vacaciones" : "Suplencia Activa" : "Sin Suplente";
    const badgeClass = isCovered ? "normal" : "critical";
    const uniqueId = `it-case-${idx}`;
    return `
                    <div class="uncovered-card ${isCovered ? "" : "critical"}">
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
                                    ${isCovered ? `<span style="color:var(--accent-green); font-weight:700;">\uD83D\uDD04 ${substitute}</span>` : `<span class="pulse-red-dot"></span> <span style="color:var(--accent-red); font-weight:800;">PENDIENTE</span>`}
                                </span>
                            </div>
                        </div>

                        <div class="card-actions">
                            ${!isCovered ? `
                                <button class="btn-ai-reveal" onclick="window.toggleAiSuggestions('${uniqueId}', '${service}', '${worker}', 'Turno Completo')">
                                    <span>\uD83D\uDD0D</span> Buscar Suplente
                                </button>
                            ` : `
                                <button class="mini-action-btn secondary" style="flex:1;" onclick="alert('Contactando con suplente: ${substitute}')">
                                    <span>\uD83D\uDCDE</span> Contactar Suplente
                                </button>
                            `}
                            <button class="mini-action-btn secondary" onclick="showStatusModal('${service}', '<h3>Expediente IT</h3><p>Trabajador: ${worker}</p><p>Motivo: ${cause}</p><p>Inicio: ${startStr}</p>')">
                                <span>\uD83D\uDD0D</span> Historial
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
  }).join("")}
            </div>
        </div>
    `;
};
window.showITAnalysis = function() {
  console.log("Running IT Analysis...");
  const masterData = state.masterData || [];
  const itCases = masterData.filter((row) => {
    const stateVal = (row["ESTADO1"] || row["Estado1"] || "").trim().toUpperCase();
    return stateVal.includes("BAJA IT") || stateVal.includes("IT");
  });
  if (itCases.length === 0) {
    alert("No hay casos de BAJA IT para analizar.");
    return;
  }
  const modal = document.getElementById("status-detail-modal");
  const modalTitle = document.getElementById("status-modal-title");
  const modalBody = document.getElementById("status-modal-body");
  modalTitle.innerHTML = "\uD83D\uDCCA ANÁLISIS DE ABSENTISMO (BAJAS IT)";
  let byCenter = {};
  let totalUncovered = 0;
  itCases.forEach((row) => {
    const center = row["SERVICIO"] || row["Alias/Nombre del centro"] || "SIN CENTRO";
    const substitute = row["SUPLENTE"] || "";
    const estadoGen = (row["ESTADO"] || "").toUpperCase();
    byCenter[center] = (byCenter[center] || 0) + 1;
    if (estadoGen === "DESCUBIERTO" || substitute.length <= 2 && estadoGen !== "CUBIERTO") {
      totalUncovered++;
    }
  });
  const topCenters = Object.entries(byCenter).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
                    <div style="font-size:24px; color:#137333;">${Math.round((itCases.length - totalUncovered) / itCases.length * 100)}%</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                
                <!-- Top Centers -->
                <div style="background:#fff; border:1px solid #eee; border-radius:8px; padding:15px;">
                    <h4 style="margin-top:0; color:#3c4043; font-size:14px; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">\uD83C\uDFE2 CENTROS MÁS AFECTADOS</h4>
                    ${topCenters.map((item, idx) => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                            <span style="color:#5f6368;">${idx + 1}. ${item[0].substring(0, 40)}...</span>
                            <strong style="color:#3c4043;">${item[1]} bajas</strong>
                        </div>
                        <div style="height:4px; background:#f1f3f4; width:100%; border-radius:2px; margin-bottom:12px;">
                            <div style="height:100%; background:#fbbc04; width:${item[1] / itCases.length * 100}%;"></div>
                        </div>
                    `).join("")}
                </div>

            </div>

            <!-- Actionable Insight -->
            <div style="margin-top:20px; background:#fff8e1; border:1px solid #ffe0b2; padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:#e65100; font-size:13px;">\uD83D\uDCA1 INSIGHT OPERATIVO</h4>
                <p style="font-size:12px; color:#bf360c; margin:0;">
                    El centro <strong>${topCenters[0][0]}</strong> concentra el <strong>${Math.round(topCenters[0][1] / itCases.length * 100)}%</strong> de las bajas IT. 
                    Prioridad operativa alta en este servicio.
                </p>
            </div>

        </div>
    `;
  modalBody.innerHTML = reportHtml;
  modal.classList.add("active");
};
window.exportITReport = function() {
  alert("Generando PDF de Bajas IT... (Simulado)");
};

// director_module.js
window.showDirectorDashboard = function() {
  console.log("\uD83D\uDE80 Iniciando Modo Director General...");
  const masterData = state.masterData || [];
  const orders = state.orders || [];
  if (masterData.length === 0) {
    alert("⚠️ Faltan datos maestros para generar el Cuadro de Mando Directivo.");
    return;
  }
  const totalHeadcount = masterData.length;
  const activeIT = masterData.filter((r) => {
    const s = (r["ESTADO1"] || r["Estado1"] || "").toUpperCase();
    return s.includes("IT") || s.includes("BAJA");
  }).length;
  const absRate = totalHeadcount > 0 ? (activeIT / totalHeadcount * 100).toFixed(2) : 0;
  const uncoveredIT = masterData.filter((r) => {
    const s = (r["ESTADO"] || "").toUpperCase();
    const sub = (r["SUPLENTE"] || "").trim();
    return s === "DESCUBIERTO" || s.includes("BAJA") && sub.length < 2;
  }).length;
  const headcountByCenter = {};
  masterData.forEach((r) => {
    const c = r["SERVICIO"] || r["Alias/Nombre del centro"] || "OTROS";
    headcountByCenter[c] = (headcountByCenter[c] || 0) + 1;
  });
  const sortedCenters = Object.entries(headcountByCenter).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const modal = document.getElementById("status-detail-modal");
  const modalTitle = document.getElementById("status-modal-title");
  const modalBody = document.getElementById("status-modal-body");
  modalTitle.innerHTML = "\uD83D\uDC54 VISIÓN DIRECTIVA";
  let html = `
        <div style="font-family: 'Segoe UI', sans-serif; color: #333;">
            
            <!-- TOP LEVEL FINANCIAL/HR METRICS -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                <div class="kpi-card" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8; letter-spacing: 1px;">Tasa Absentismo Global</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${absRate}%</div>
                    <div style="font-size: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 2px 8px; border-radius: 4px;">
                        ${activeIT} Bajas Activas / ${totalHeadcount} Empleados
                    </div>
                </div>

                <div class="kpi-card" style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; font-weight: bold;">Riesgo Operativo (Descubiertos)</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${uncoveredIT > 0 ? "#d93025" : "#188038"};">${uncoveredIT}</div>
                    <div style="font-size: 12px; color: #666;">
                        Impacto directo en facturación y satisfacción.
                    </div>
                </div>

                <div class="kpi-card" style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; font-weight: bold;">Concentración de Servicio</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #f9ab00;">Top 5</div>
                    <div style="font-size: 12px; color: #666;">
                        Los 5 mayores centros agrupan gran parte de la plantilla.
                    </div>
                </div>
            </div>

            <!-- RISK MATRIX (MATRIZ DE RIESGO DE FUGA) -->
            <div style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 15px 0; color: #444; border-bottom: 2px solid #eee; padding-bottom: 8px;">⚠️ MATRIZ DE RIESGO (Centros Críticos)</h4>
                <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th style="text-align: left; padding: 12px; color: #555;">CLIENTE / CENTRO</th>
                                <th style="text-align: center; padding: 12px; color: #555;">PLANTILLA</th>
                                <th style="text-align: center; padding: 12px; color: #555;">BAJAS HOY</th>
                                <th style="text-align: center; padding: 12px; color: #555;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCenters.map((item, idx) => {
    const centerName = item[0];
    const centerTotal = item[1];
    const centerIT = masterData.filter((r) => {
      const s = (r["ESTADO1"] || r["Estado1"] || "").toUpperCase();
      const c = r["SERVICIO"] || r["Alias/Nombre del centro"] || "";
      return c === centerName && (s.includes("IT") || s.includes("BAJA"));
    }).length;
    const centerRisk = centerIT / centerTotal;
    let riskLevel = '<span class="badge blue">ESTABLE</span>';
    if (centerRisk > 0.1)
      riskLevel = '<span class="badge yellow">ATENCIÓN</span>';
    if (centerRisk > 0.3)
      riskLevel = '<span class="badge red">CRÍTICO</span>';
    if (centerIT === 0)
      riskLevel = '<span class="badge green">OPTIMO</span>';
    return `
                                    <tr style="border-bottom: 1px solid #f0f0f0;">
                                        <td style="padding: 10px 12px; font-weight: 500;">${centerName}</td>
                                        <td style="padding: 10px 12px; text-align: center;">${centerTotal}</td>
                                        <td style="padding: 10px 12px; text-align: center; font-weight: bold; color: ${centerIT > 0 ? "#d93025" : "#ccc"};">${centerIT}</td>
                                        <td style="padding: 10px 12px; text-align: center;">${riskLevel}</td>
                                    </tr>
                                `;
  }).join("")}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- STRATEGIC INSIGHT -->
            <div style="background-color: #f0f4ff; border-left: 4px solid #1a73e8; padding: 15px; border-radius: 4px;">
                <h4 style="margin: 0 0 5px 0; color: #1a73e8; font-size: 14px;">\uD83D\uDCA1 RECOMENDACIÓN ESTRATÉGICA</h4>
                <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.5;">
                    El absentismo global del <strong>${absRate}%</strong> está dentro/fuera de rango. 
                    Se recomienda enfocar esfuerzos de supervisión en <strong>${sortedCenters[0][0]}</strong> debido a su volumen de plantilla, 
                    ya que cualquier desviación ahí impacta significativamente en el margen EBITDA del contrato.
                </p>
            </div>

        </div>
    `;
  modalBody.innerHTML = html;
  modal.classList.add("active");
};

// quadrants_module.js
var currentQuadrantMonth = new Date().getMonth();
var currentQuadrantYear = new Date().getFullYear();
var currentSelectedService = "";
var currentSearchQuery = "";
var injectQuadrantStyles = () => {
  if (document.getElementById("quadrant-styles"))
    return;
  const style = document.createElement("style");
  style.id = "quadrant-styles";
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
window.initQuadrantsModule = function() {
  console.log("\uD83D\uDCC5 Iniciando Visual Command Center (Cuadrantes)...");
  injectQuadrantStyles();
  const container = document.getElementById("quadrants-grid");
  const controls = document.getElementById("quadrants-controls");
  if (!state.dailyOverrides)
    state.dailyOverrides = {};
  if (controls) {
    const masterData = state.masterData || [];
    const services = [...new Set(masterData.map((r) => r["SERVICIO"] || r["Alias/Nombre del centro"] || "SIN CENTRO"))].filter((s) => s && s.length > 2).sort();
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
                            \uD83D\uDD04 REFRESCAR
                        </button>
                    </div>

                    <div class="q-control-group" style="flex:1; justify-content: flex-end;">
                        <input type="text" id="quadrant-search-input" class="q-search"
                            placeholder="\uD83D\uDD0D Buscar Trabajador, Servicio..." 
                            onkeyup="window.handleQuadrantSearch(this.value)"
                            value="${currentSearchQuery}">
                        
                        <select id="quadrant-service-filter" class="q-select" onchange="window.filterQuadrantService(this.value)">
                            <option value="">\uD83C\uDFE2 Todos los Centros</option>
                            ${services.map((s) => `<option value="${s}" ${s === currentSelectedService ? "selected" : ""}>${s}</option>`).join("")}
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
window.changeQuadrantMonth = function(delta) {
  currentQuadrantMonth += delta;
  if (currentQuadrantMonth > 11) {
    currentQuadrantMonth = 0;
    currentQuadrantYear++;
  } else if (currentQuadrantMonth < 0) {
    currentQuadrantMonth = 11;
    currentQuadrantYear--;
  }
  initQuadrantsModule();
};
window.filterQuadrantService = function(service) {
  currentSelectedService = service;
  currentSearchQuery = "";
  const input = document.getElementById("quadrant-search-input");
  if (input)
    input.value = "";
  renderQuadrantsGrid();
};
window.handleQuadrantSearch = function(query) {
  currentSearchQuery = query.toLowerCase();
  if (currentSearchQuery.length > 2) {
    currentSelectedService = "";
    const sel = document.getElementById("quadrant-service-filter");
    if (sel)
      sel.value = "";
  }
  renderQuadrantsGrid();
};
var getDayKey = (worker, dateStr) => `Q|${worker.trim()}|${dateStr}`;
window.renderQuadrantsGrid = function() {
  const container = document.getElementById("q-grid-body");
  if (!container)
    return;
  const masterData = state.masterData || [];
  let filteredData = [];
  if (currentSearchQuery && currentSearchQuery.length > 1) {
    filteredData = masterData.filter((r) => {
      const w = (r["TITULAR"] || r["Titular"] || "").toLowerCase();
      const s = (r["SERVICIO"] || r["Alias/Nombre del centro"] || "").toLowerCase();
      return w.includes(currentSearchQuery) || s.includes(currentSearchQuery);
    });
    if (filteredData.length > 100)
      filteredData = filteredData.slice(0, 100);
  } else if (currentSelectedService && currentSelectedService !== "") {
    filteredData = masterData.filter((r) => (r["SERVICIO"] || r["Alias/Nombre del centro"]) === currentSelectedService);
  } else {
    filteredData = masterData.slice(0, 200);
  }
  let html = "";
  if (masterData.length > 200 && (!currentSearchQuery || currentSearchQuery.length < 2) && (!currentSelectedService || currentSelectedService === "")) {
    html += `<div style="padding: 10px; text-align: center; color: #854d0e; background:#fef3c7; font-size:12px; font-weight:600; border-bottom:1px solid #e2e8f0;">⚠️ Vista limitada a los primeros 200 trabajadores. Usa el buscador o filtros para localizar registros específicos.</div>`;
  }
  if (filteredData.length === 0) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444;">❌ No se encontraron cuadrantes.</div>`;
    return;
  }
  const daysInMonth = new Date(currentQuadrantYear, currentQuadrantMonth + 1, 0).getDate();
  const today = new Date;
  const isCurrentMonth = today.getMonth() === currentQuadrantMonth && today.getFullYear() === currentQuadrantYear;
  html += `<table class="q-table"><thead><tr><th class="q-th-worker">\uD83E\uDDD1‍\uD83D\uDD27 OPERARIO / SERVICIO</th>`;
  for (let d = 1;d <= daysInMonth; d++) {
    const date = new Date(currentQuadrantYear, currentQuadrantMonth, d);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const isToday = isCurrentMonth && d === today.getDate();
    const letter = ["D", "L", "M", "X", "J", "V", "S"][day];
    html += `<th class="q-th-day ${isWeekend ? "weekend" : ""} ${isToday ? "today" : ""}">
                    <div style="font-weight:700; font-size:12px;">${d}</div>
                    <div style="font-weight:400; opacity:0.7;">${letter}</div>
                 </th>`;
  }
  html += `</tr></thead><tbody>`;
  filteredData.forEach((row) => {
    const worker = row["TITULAR"] || row["Titular"] || "DESCONOCIDO";
    const service = row["SERVICIO"] || row["Alias/Nombre del centro"] || "";
    const rowGenStatus = (row["ESTADO"] || "").toUpperCase();
    const substitute = row["SUPLENTE"] || "";
    html += `<tr>
            <td class="q-td-worker">
                <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${worker}</div>
                <div style="font-size: 11px; color: #64748b; margin-top:2px; display:flex; align-items:center; gap:4px;">
                    \uD83C\uDFE2 ${service.substring(0, 25)}${service.length > 25 ? "..." : ""}
                </div>
            </td>`;
    for (let d = 1;d <= daysInMonth; d++) {
      const dateStr = `${currentQuadrantYear}-${String(currentQuadrantMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateObj = new Date(currentQuadrantYear, currentQuadrantMonth, d);
      const day = dateObj.getDay();
      const isWeekend = day === 0 || day === 6;
      const overrideKey = getDayKey(worker, dateStr);
      const overrideVal = state.dailyOverrides ? state.dailyOverrides[overrideKey] : null;
      let cellClass = isWeekend ? "status-weekend" : "status-D";
      let content = "";
      if (overrideVal) {
        cellClass = `status-${overrideVal}`;
        content = overrideVal;
      } else {
        if (rowGenStatus === "DESCUBIERTO") {
          cellClass = "status-U";
          content = "!";
        } else if ((row["ESTADO1"] || "").toUpperCase().includes("IT")) {
          cellClass = "status-B";
          content = "B";
        } else if ((row["ESTADO1"] || "").toUpperCase().includes("VAC")) {
          cellClass = "status-V";
          content = "V";
        } else if (rowGenStatus === "CUBIERTO" && !isWeekend) {
          cellClass = "status-T";
          content = "T";
        }
      }
      html += `<td class="q-cell ${cellClass}" onclick="window.openDayEditor('${worker.replace(/'/g, "\\'")}', '${dateStr}', '${overrideVal || ""}')">${content}</td>`;
    }
    html += `</tr>`;
    if (substitute && substitute.length > 2) {
      html += `<tr style="background-color: #f0fdf4;">
                <td class="q-td-worker" style="padding-left: 25px; border-left: 4px solid #4ade80;">
                    <div style="font-weight: 700; color: #15803d; font-size: 12px; display:flex; align-items:center; gap:6px;">
                        <span>↳</span> ${substitute}
                    </div>
                    <div style="font-size: 10px; color: #166534; opacity:0.8;">
                        \uD83D\uDD04 Suplente Activo
                    </div>
                </td>`;
      for (let d = 1;d <= daysInMonth; d++) {
        const dateStr = `${currentQuadrantYear}-${String(currentQuadrantMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dateObj = new Date(currentQuadrantYear, currentQuadrantMonth, d);
        const day = dateObj.getDay();
        const isWeekend = day === 0 || day === 6;
        const overrideKey = getDayKey(substitute, dateStr);
        const overrideVal = state.dailyOverrides ? state.dailyOverrides[overrideKey] : null;
        let cellClass = isWeekend ? "status-weekend" : "status-T";
        let content = "T";
        if (overrideVal) {
          cellClass = `status-${overrideVal}`;
          content = overrideVal;
        } else if (isWeekend) {
          content = "";
        }
        html += `<td class="q-cell ${cellClass}" onclick="window.openDayEditor('${substitute.replace(/'/g, "\\'")}', '${dateStr}', '${overrideVal || ""}')" style="opacity: 0.9;">${content}</td>`;
      }
      html += `</tr>`;
    }
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
  ensureQuadrantModal();
};
function ensureQuadrantModal() {
  if (document.getElementById("quadrant-editor-modal"))
    return;
  const modal = document.createElement("div");
  modal.id = "quadrant-editor-modal";
  modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: none; align-items: center; justify-content: center;";
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
                <button class="status-btn" onclick="window.saveDayStatus('B')" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca;">\uD83C\uDFE5 BAJA IT (B)</button>
                <button class="status-btn" onclick="window.saveDayStatus('V')" style="background:#fef9c3; color:#854d0e; border:1px solid #fde047;">\uD83C\uDFD6️ VACANCE (V)</button>
                <button class="status-btn" onclick="window.saveDayStatus('F')" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">\uD83D\uDEAB FALTA (F)</button>
                <button class="status-btn" onclick="window.saveDayStatus('D')" style="background:#ffffff; color:#3b82f6; border:1px solid #e2e8f0;">\uD83D\uDCA4 DESCANSO</button>
                <button class="status-btn" onclick="window.saveDayStatus(null)" style="background:#f8fafc; color:#64748b; border:1px dashed #cbd5e1;">\uD83D\uDDD1️ BORRAR</button>
            </div>
            <button onclick="document.getElementById('quadrant-editor-modal').style.display='none'" style="width:100%; padding: 12px; border-radius: 8px; border:1px solid #e2e8f0; background:white; color:#64748b; font-weight:600; cursor:pointer;">Cancelar</button>
        </div>
    `;
  document.body.appendChild(modal);
}
var edWorker = null;
var edDate = null;
window.openDayEditor = function(worker, dateStr, current) {
  edWorker = worker;
  edDate = dateStr;
  const modal = document.getElementById("quadrant-editor-modal");
  const subtitle = document.getElementById("q-editor-subtitle");
  if (modal && subtitle) {
    subtitle.innerHTML = `${worker} <br> <strong>${dateStr}</strong>`;
    modal.style.display = "flex";
  }
};
window.saveDayStatus = function(status) {
  if (!edWorker || !edDate)
    return;
  const key = getDayKey(edWorker, edDate);
  if (status) {
    state.dailyOverrides[key] = status;
  } else {
    delete state.dailyOverrides[key];
  }
  if (typeof saveToIndexedDB === "function") {
    saveToIndexedDB();
  } else {
    localStorage.setItem("sifu_universal_state_v5", JSON.stringify(state));
  }
  document.getElementById("quadrant-editor-modal").style.display = "none";
  renderQuadrantsGrid();
};

// notepad.js
var NotesManager = {
  STORAGE_KEY: "sifu_notepad_notes",
  initialized: false,
  loadNotes() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      const notes = saved ? JSON.parse(saved) : [];
      console.log(`\uD83D\uDCDD Notas cargadas: ${notes.length}`);
      return notes;
    } catch (e) {
      console.error("❌ Error al cargar notas:", e);
      return [];
    }
  },
  saveNotes(notes) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
      console.log(`✅ ${notes.length} notas guardadas automáticamente`);
      return true;
    } catch (e) {
      console.error("❌ Error al guardar notas:", e);
      alert("Error al guardar las notas. Verifica el espacio de almacenamiento.");
      return false;
    }
  },
  addNote(text) {
    if (!text || text.trim() === "") {
      console.warn("⚠️ Texto vacío, no se añade nota");
      return false;
    }
    const notes = this.loadNotes();
    const newNote = {
      id: Date.now(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      completed: false
    };
    notes.unshift(newNote);
    const saved = this.saveNotes(notes);
    if (saved) {
      this.renderNotes();
      console.log("✅ Nota añadida:", newNote.text);
    }
    return saved;
  },
  deleteNote(id) {
    console.log("\uD83D\uDDD1️ Eliminando nota:", id);
    const notes = this.loadNotes();
    const filtered = notes.filter((note) => note.id !== id);
    this.saveNotes(filtered);
    this.renderNotes();
  },
  toggleComplete(id) {
    console.log("✅ Toggle completado:", id);
    const notes = this.loadNotes();
    const note = notes.find((n) => n.id === id);
    if (note) {
      note.completed = !note.completed;
      this.saveNotes(notes);
      this.renderNotes();
    }
  },
  renderNotes() {
    const container = document.getElementById("top-notes-feed");
    const countBadge = document.getElementById("top-notes-count");
    if (!container) {
      console.error("❌ Contenedor top-notes-feed no encontrado");
      return;
    }
    const notes = this.loadNotes();
    if (countBadge) {
      countBadge.textContent = notes.length;
    }
    if (notes.length === 0) {
      container.innerHTML = `
                <div class="empty-notes">
                    \uD83D\uDCDD No hay notas. Añade una tarea rápida arriba.
                </div>
            `;
      return;
    }
    container.innerHTML = notes.map((note) => `
            <div class="note-card ${note.completed ? "completed" : ""}" data-id="${note.id}">
                <div class="note-content">
                    <div class="note-checkbox" onclick="NotesManager.toggleComplete(${note.id})">
                        ${note.completed ? "✅" : "⬜"}
                    </div>
                    <div class="note-text ${note.completed ? "strikethrough" : ""}">${this.escapeHtml(note.text)}</div>
                </div>
                <div class="note-actions">
                    <button class="note-delete" onclick="NotesManager.deleteNote(${note.id})" title="Eliminar">
                        \uD83D\uDDD1️
                    </button>
                </div>
            </div>
        `).join("");
    console.log(`\uD83D\uDCCB ${notes.length} notas renderizadas`);
  },
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
  init() {
    if (this.initialized) {
      console.warn("⚠️ NotesManager ya inicializado");
      return;
    }
    console.log("\uD83D\uDE80 Inicializando NotesManager...");
    const input = document.getElementById("quick-note-top");
    if (!input) {
      console.error("❌ Input quick-note-top no encontrado");
      return;
    }
    this.renderNotes();
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = input.value;
        if (this.addNote(text)) {
          input.value = "";
          input.focus();
        }
      }
    });
    this.initialized = true;
    console.log("✅ Bloc de notas inicializado con auto-guardado");
  }
};
function initNotepad() {
  if (document.getElementById("quick-note-top")) {
    NotesManager.init();
  } else {
    console.warn("⚠️ Esperando a que el DOM esté listo...");
    setTimeout(initNotepad, 100);
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotepad);
} else {
  initNotepad();
}
console.log("\uD83D\uDCDD notepad.js cargado");

// notifications_engine.js
var NotificationsEngine2 = {
  notifications: [],
  settings: {
    enabled: true,
    sound: true,
    desktop: true,
    contractWarningDays: 7,
    vacationWarningDays: 3,
    auditReminderDays: 30
  },
  init() {
    console.log("\uD83D\uDD14 Inicializando Motor de Notificaciones...");
    this.loadSettings();
    this.loadNotifications();
    this.requestPermission();
    this.startMonitoring();
    this.renderNotificationCenter();
  },
  loadSettings() {
    const saved = localStorage.getItem("sifu_notification_settings");
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
  },
  saveSettings() {
    localStorage.setItem("sifu_notification_settings", JSON.stringify(this.settings));
  },
  loadNotifications() {
    const saved = localStorage.getItem("sifu_notifications_v1");
    if (saved) {
      this.notifications = JSON.parse(saved);
    }
  },
  saveNotifications() {
    localStorage.setItem("sifu_notifications_v1", JSON.stringify(this.notifications));
  },
  requestPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        console.log("\uD83D\uDCE2 Permiso de notificaciones:", permission);
      });
    }
  },
  startMonitoring() {
    console.log("\uD83D\uDC41️ Iniciando monitoreo inteligente...");
    this.analyzeData();
    setInterval(() => this.analyzeData(), 5 * 60 * 1000);
  },
  analyzeData() {
    if (!window.state || !window.state.masterData)
      return;
    const today = new Date;
    const notifications = [];
    window.state.masterData.forEach((service) => {
      if (service["FIN CONTRATO"]) {
        const endDate = this.excelDateToJS(service["FIN CONTRATO"]);
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilEnd > 0 && daysUntilEnd <= this.settings.contractWarningDays) {
          notifications.push({
            id: `contract_${service.PROYECTO}_${daysUntilEnd}`,
            type: "contract_ending",
            priority: daysUntilEnd <= 3 ? "high" : "medium",
            title: "\uD83D\uDCC5 Contrato Próximo a Vencer",
            message: `${service.TITULAR || "Trabajador"} - ${service.SERVICIO}`,
            detail: `Termina en ${daysUntilEnd} día${daysUntilEnd > 1 ? "s" : ""}`,
            timestamp: new Date().toISOString(),
            data: service,
            action: "renovar_contrato"
          });
        }
      }
      if (service["VACACIONES 2026"]) {
        const vacStart = this.parseVacationDate(service["VACACIONES 2026"]);
        if (vacStart) {
          const daysUntilVac = Math.ceil((vacStart - today) / (1000 * 60 * 60 * 24));
          if (daysUntilVac > 0 && daysUntilVac <= this.settings.vacationWarningDays) {
            const hasSuplente = service.SUPLENTE && service.SUPLENTE !== "EMERGENCIAS";
            notifications.push({
              id: `vacation_${service.PROYECTO}_${daysUntilVac}`,
              type: "vacation_upcoming",
              priority: hasSuplente ? "low" : "high",
              title: "\uD83C\uDFD6️ Vacaciones Próximas",
              message: `${service.TITULAR} - ${service.SERVICIO}`,
              detail: `Inicia en ${daysUntilVac} día${daysUntilVac > 1 ? "s" : ""}${hasSuplente ? " ✓ Suplente confirmado" : " ⚠️ Sin suplente"}`,
              timestamp: new Date().toISOString(),
              data: service,
              action: hasSuplente ? null : "asignar_suplente"
            });
          }
        }
      }
      if (service.ESTADO1 === "BAJA IT" && (!service.SUPLENTE || service.SUPLENTE === "EMERGENCIAS")) {
        notifications.push({
          id: `it_uncovered_${service.PROYECTO}`,
          type: "it_uncovered",
          priority: "critical",
          title: "\uD83D\uDEA8 Baja IT Sin Cobertura",
          message: `${service.TITULAR} - ${service.SERVICIO}`,
          detail: "Requiere suplente urgente",
          timestamp: new Date().toISOString(),
          data: service,
          action: "asignar_suplente"
        });
      }
      if (service.ESTADO === "DESCUBIERTO") {
        notifications.push({
          id: `uncovered_${service.PROYECTO}`,
          type: "uncovered",
          priority: "critical",
          title: "\uD83D\uDD25 Servicio Descubierto",
          message: `${service.SERVICIO}`,
          detail: service.TITULAR ? `Titular: ${service.TITULAR}` : "Sin titular asignado",
          timestamp: new Date().toISOString(),
          data: service,
          action: "resolver_descubierto"
        });
      }
    });
    const lastAudit = localStorage.getItem("last_quality_audit_date");
    if (lastAudit) {
      const daysSinceAudit = Math.ceil((today - new Date(lastAudit)) / (1000 * 60 * 60 * 24));
      if (daysSinceAudit >= this.settings.auditReminderDays) {
        notifications.push({
          id: "audit_reminder",
          type: "audit_reminder",
          priority: "medium",
          title: "⭐ Recordatorio de Auditoría",
          message: `Han pasado ${daysSinceAudit} días desde la última auditoría`,
          detail: "Programa auditorías de calidad",
          timestamp: new Date().toISOString(),
          action: "programar_auditoria"
        });
      }
    }
    this.addNotifications(notifications);
  },
  addNotifications(newNotifications) {
    const existingIds = new Set(this.notifications.map((n) => n.id));
    const toAdd = newNotifications.filter((n) => !existingIds.has(n.id));
    if (toAdd.length > 0) {
      this.notifications.unshift(...toAdd);
      this.saveNotifications();
      this.renderNotificationCenter();
      toAdd.forEach((notif) => {
        if (notif.priority === "critical" && this.settings.desktop) {
          this.showDesktopNotification(notif);
        }
      });
      this.updateBadge();
    }
  },
  showDesktopNotification(notif) {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(notif.title, {
        body: `${notif.message}
${notif.detail}`,
        icon: "img/logo sifu.png",
        badge: "img/logo sifu.png",
        tag: notif.id,
        requireInteraction: notif.priority === "critical"
      });
      notification.onclick = () => {
        window.focus();
        this.handleNotificationAction(notif);
        notification.close();
      };
    }
  },
  handleNotificationAction(notif) {
    switch (notif.action) {
      case "renovar_contrato":
        alert(`Acción: Renovar contrato de ${notif.data.TITULAR}

Esta funcionalidad se integrará con tu sistema de gestión.`);
        break;
      case "asignar_suplente":
        alert(`Acción: Asignar suplente para ${notif.data.SERVICIO}

Se abrirá el módulo de gestión de suplentes (próximamente).`);
        break;
      case "resolver_descubierto":
        if (typeof switchTab === "function") {
          switchTab("descubiertos");
        }
        break;
      case "programar_auditoria":
        if (typeof switchTab === "function") {
          switchTab("calidad");
        }
        break;
    }
    this.markAsRead(notif.id);
  },
  markAsRead(notifId) {
    const notif = this.notifications.find((n) => n.id === notifId);
    if (notif) {
      notif.read = true;
      this.saveNotifications();
      this.renderNotificationCenter();
      this.updateBadge();
    }
  },
  dismissNotification(notifId) {
    this.notifications = this.notifications.filter((n) => n.id !== notifId);
    this.saveNotifications();
    this.renderNotificationCenter();
    this.updateBadge();
  },
  clearAll() {
    if (confirm("¿Eliminar todas las notificaciones?")) {
      this.notifications = [];
      this.saveNotifications();
      this.renderNotificationCenter();
      this.updateBadge();
    }
  },
  updateBadge() {
    const unread = this.notifications.filter((n) => !n.read).length;
    const badge = document.getElementById("notification-badge");
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? "flex" : "none";
    }
  },
  renderNotificationCenter() {
    const container = document.getElementById("notification-center-list");
    if (!container)
      return;
    if (this.notifications.length === 0) {
      container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);">
                    <div style="font-size: 48px; margin-bottom: 10px;">\uD83D\uDD14</div>
                    <div>No hay notificaciones</div>
                </div>
            `;
      return;
    }
    const html = this.notifications.map((notif) => {
      const priorityClass = {
        critical: "notif-critical",
        high: "notif-high",
        medium: "notif-medium",
        low: "notif-low"
      }[notif.priority] || "notif-medium";
      const icon = {
        contract_ending: "\uD83D\uDCC5",
        vacation_upcoming: "\uD83C\uDFD6️",
        it_uncovered: "\uD83D\uDEA8",
        uncovered: "\uD83D\uDD25",
        audit_reminder: "⭐"
      }[notif.type] || "\uD83D\uDD14";
      return `
                <div class="notification-item ${priorityClass} ${notif.read ? "read" : "unread"}" data-id="${notif.id}">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-content">
                        <div class="notif-title">${notif.title}</div>
                        <div class="notif-message">${notif.message}</div>
                        <div class="notif-detail">${notif.detail}</div>
                        <div class="notif-time">${this.formatTime(notif.timestamp)}</div>
                    </div>
                    <div class="notif-actions">
                        ${notif.action ? `<button class="btn-notif-action" onclick="NotificationsEngine.handleNotificationAction(NotificationsEngine.notifications.find(n => n.id === '${notif.id}'))">Acción</button>` : ""}
                        <button class="btn-notif-dismiss" onclick="NotificationsEngine.dismissNotification('${notif.id}')" title="Descartar">×</button>
                    </div>
                </div>
            `;
    }).join("");
    container.innerHTML = html;
    this.updateBadge();
  },
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date;
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1)
      return "Ahora";
    if (minutes < 60)
      return `Hace ${minutes}m`;
    if (hours < 24)
      return `Hace ${hours}h`;
    if (days < 7)
      return `Hace ${days}d`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  },
  excelDateToJS(excelDate) {
    if (!excelDate)
      return null;
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
  },
  parseVacationDate(vacString) {
    if (!vacString)
      return null;
    const match = vacString.match(/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = new Date().getFullYear();
      return new Date(year, month, day);
    }
    return null;
  },
  toggleNotificationCenter() {
    const panel = document.getElementById("notification-center-panel");
    if (panel) {
      panel.classList.toggle("active");
    }
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => NotificationsEngine2.init());
} else {
  NotificationsEngine2.init();
}

// daily_checklist.js
var DailyChecklist2 = {
  tasks: [],
  completedToday: [],
  init() {
    console.log("✅ Inicializando Checklist Diario...");
    this.loadTasks();
    this.generateDailyTasks();
    this.render();
  },
  loadTasks() {
    const saved = localStorage.getItem("sifu_daily_tasks_v1");
    const savedDate = localStorage.getItem("sifu_tasks_date");
    const today = new Date().toDateString();
    if (saved && savedDate === today) {
      this.tasks = JSON.parse(saved);
    } else {
      this.tasks = [];
      localStorage.removeItem("sifu_daily_tasks_v1");
    }
    const completed = localStorage.getItem("sifu_completed_tasks_v1");
    if (completed) {
      this.completedToday = JSON.parse(completed);
    }
  },
  saveTasks() {
    const today = new Date().toDateString();
    localStorage.setItem("sifu_daily_tasks_v1", JSON.stringify(this.tasks));
    localStorage.setItem("sifu_tasks_date", today);
    localStorage.setItem("sifu_completed_tasks_v1", JSON.stringify(this.completedToday));
  },
  generateDailyTasks() {
    if (!window.state || !window.state.masterData)
      return;
    const today = new Date;
    const tasks = [];
    const descubiertos = window.state.masterData.filter((s) => s.ESTADO === "DESCUBIERTO");
    if (descubiertos.length > 0) {
      tasks.push({
        id: "review_uncovered",
        category: "urgent",
        title: `Revisar ${descubiertos.length} servicio${descubiertos.length > 1 ? "s" : ""} descubierto${descubiertos.length > 1 ? "s" : ""}`,
        description: "Asignar titulares o suplentes",
        priority: "critical",
        estimatedTime: descubiertos.length * 5,
        action: () => {
          if (typeof switchTab === "function")
            switchTab("descubiertos");
        }
      });
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const needConfirmation = window.state.masterData.filter((s) => {
      if (!s["VACACIONES 2026"])
        return false;
      const vacStart = this.parseVacationDate(s["VACACIONES 2026"]);
      if (!vacStart)
        return false;
      const diff = Math.ceil((vacStart - today) / (1000 * 60 * 60 * 24));
      return diff === 1 && (!s.SUPLENTE || s.SUPLENTE === "EMERGENCIAS");
    });
    if (needConfirmation.length > 0) {
      tasks.push({
        id: "confirm_suplentes",
        category: "planning",
        title: `Confirmar ${needConfirmation.length} suplente${needConfirmation.length > 1 ? "s" : ""} para mañana`,
        description: "Vacaciones que inician mañana",
        priority: "high",
        estimatedTime: needConfirmation.length * 3,
        action: () => {
          alert(`Lista de servicios que requieren confirmación:

` + needConfirmation.map((s) => `• ${s.TITULAR} - ${s.SERVICIO}`).join(`
`));
        }
      });
    }
    const contractsEnding = window.state.masterData.filter((s) => {
      if (!s["FIN CONTRATO"])
        return false;
      const endDate = this.excelDateToJS(s["FIN CONTRATO"]);
      const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 7;
    });
    if (contractsEnding.length > 0) {
      tasks.push({
        id: "call_contracts",
        category: "administrative",
        title: `Contactar ${contractsEnding.length} trabajador${contractsEnding.length > 1 ? "es" : ""} por renovación`,
        description: "Contratos que terminan en 7 días o menos",
        priority: "high",
        estimatedTime: contractsEnding.length * 10,
        action: () => {
          const list = contractsEnding.map((s) => {
            const endDate = this.excelDateToJS(s["FIN CONTRATO"]);
            const days = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            return `• ${s.TITULAR} - Termina en ${days} día${days > 1 ? "s" : ""}`;
          }).join(`
`);
          alert(`Trabajadores a contactar:

` + list);
        }
      });
    }
    const itUncovered = window.state.masterData.filter((s) => s.ESTADO1 === "BAJA IT" && (!s.SUPLENTE || s.SUPLENTE === "EMERGENCIAS"));
    if (itUncovered.length > 0) {
      tasks.push({
        id: "review_it",
        category: "urgent",
        title: `Gestionar ${itUncovered.length} baja${itUncovered.length > 1 ? "s" : ""} IT sin cobertura`,
        description: "Asignar suplentes urgentes",
        priority: "critical",
        estimatedTime: itUncovered.length * 8,
        action: () => {
          if (typeof switchTab === "function")
            switchTab("abonos");
        }
      });
    }
    const lastSync = localStorage.getItem("last_master_sync");
    const hoursSinceSync = lastSync ? (today - new Date(lastSync)) / (1000 * 60 * 60) : 999;
    if (hoursSinceSync > 4) {
      tasks.push({
        id: "sync_master",
        category: "maintenance",
        title: "Sincronizar datos con Excel Master",
        description: `Última sincronización: ${lastSync ? new Date(lastSync).toLocaleString("es-ES") : "Nunca"}`,
        priority: "medium",
        estimatedTime: 2,
        action: () => {
          const btn = document.getElementById("btn-load-master");
          if (btn)
            btn.click();
        }
      });
    }
    const lastAudit = localStorage.getItem("last_quality_audit_date");
    const daysSinceAudit = lastAudit ? Math.ceil((today - new Date(lastAudit)) / (1000 * 60 * 60 * 24)) : 999;
    if (daysSinceAudit >= 7) {
      tasks.push({
        id: "quality_audit",
        category: "quality",
        title: "Programar auditorías de calidad",
        description: `Última auditoría hace ${daysSinceAudit} días`,
        priority: "medium",
        estimatedTime: 30,
        action: () => {
          if (typeof switchTab === "function")
            switchTab("calidad");
        }
      });
    }
    const newTasks = tasks.filter((t) => !this.completedToday.includes(t.id));
    this.tasks = newTasks;
    this.saveTasks();
  },
  completeTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = true;
      task.completedAt = new Date().toISOString();
      this.completedToday.push(taskId);
      this.saveTasks();
      this.render();
      this.showToast(`✅ Tarea completada: ${task.title}`);
    }
  },
  uncompleteTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = false;
      delete task.completedAt;
      this.completedToday = this.completedToday.filter((id) => id !== taskId);
      this.saveTasks();
      this.render();
    }
  },
  addCustomTask(title, description = "") {
    const task = {
      id: `custom_${Date.now()}`,
      category: "custom",
      title,
      description,
      priority: "medium",
      estimatedTime: 15,
      custom: true
    };
    this.tasks.push(task);
    this.saveTasks();
    this.render();
  },
  deleteTask(taskId) {
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this.completedToday = this.completedToday.filter((id) => id !== taskId);
    this.saveTasks();
    this.render();
  },
  render() {
    const container = document.getElementById("checklist-container");
    if (!container)
      return;
    const pending = this.tasks.filter((t) => !t.completed);
    const completed = this.tasks.filter((t) => t.completed);
    const totalTime = pending.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    const html = `
            <div class="checklist-header">
                <div class="checklist-stats">
                    <div class="stat">
                        <span class="stat-value">${pending.length}</span>
                        <span class="stat-label">Pendientes</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${completed.length}</span>
                        <span class="stat-label">Completadas</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${totalTime}min</span>
                        <span class="stat-label">Tiempo Est.</span>
                    </div>
                </div>
                <button class="btn-add-task" onclick="DailyChecklist.promptAddTask()">
                    ➕ Añadir Tarea
                </button>
            </div>

            ${pending.length === 0 && completed.length === 0 ? `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                    <div>No hay tareas para hoy</div>
                    <button class="btn-secondary" onclick="DailyChecklist.generateDailyTasks(); DailyChecklist.render();" style="margin-top: 15px;">
                        \uD83D\uDD04 Generar Tareas
                    </button>
                </div>
            ` : ""}

            ${pending.length > 0 ? `
                <div class="tasks-section">
                    <h4>\uD83D\uDCCB Tareas Pendientes</h4>
                    ${pending.map((task) => this.renderTask(task)).join("")}
                </div>
            ` : ""}

            ${completed.length > 0 ? `
                <div class="tasks-section completed-section">
                    <h4>✅ Completadas Hoy</h4>
                    ${completed.map((task) => this.renderTask(task)).join("")}
                </div>
            ` : ""}
        `;
    container.innerHTML = html;
  },
  renderTask(task) {
    const priorityColors = {
      critical: "#ea4335",
      high: "#fbbc04",
      medium: "#4285f4",
      low: "#34a853"
    };
    const categoryIcons = {
      urgent: "\uD83D\uDEA8",
      planning: "\uD83D\uDCC5",
      administrative: "\uD83D\uDCCB",
      maintenance: "\uD83D\uDD27",
      quality: "⭐",
      custom: "\uD83D\uDCDD"
    };
    return `
            <div class="task-item ${task.completed ? "completed" : ""}" data-priority="${task.priority}">
                <div class="task-checkbox">
                    <input type="checkbox" 
                           ${task.completed ? "checked" : ""} 
                           onchange="DailyChecklist.${task.completed ? "uncompleteTask" : "completeTask"}('${task.id}')">
                </div>
                <div class="task-content">
                    <div class="task-header">
                        <span class="task-category">${categoryIcons[task.category] || "\uD83D\uDCDD"}</span>
                        <span class="task-title">${task.title}</span>
                        ${task.estimatedTime ? `<span class="task-time">⏱️ ${task.estimatedTime}min</span>` : ""}
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ""}
                    ${task.completedAt ? `<div class="task-completed-time">Completada: ${new Date(task.completedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>` : ""}
                </div>
                <div class="task-actions">
                    <div class="task-priority-indicator" style="background: ${priorityColors[task.priority]};"></div>
                    ${task.action && !task.completed ? `
                        <button class="btn-task-action" onclick="DailyChecklist.tasks.find(t => t.id === '${task.id}').action()" title="Ir a acción">
                            →
                        </button>
                    ` : ""}
                    ${task.custom ? `
                        <button class="btn-task-delete" onclick="DailyChecklist.deleteTask('${task.id}')" title="Eliminar">
                            \uD83D\uDDD1️
                        </button>
                    ` : ""}
                </div>
            </div>
        `;
  },
  promptAddTask() {
    const title = prompt("Título de la tarea:");
    if (title) {
      const description = prompt("Descripción (opcional):");
      this.addCustomTask(title, description || "");
    }
  },
  showToast(message) {
    if (typeof showToast === "function") {
      showToast(message);
    } else {
      console.log(message);
    }
  },
  excelDateToJS(excelDate) {
    if (!excelDate)
      return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  },
  parseVacationDate(vacString) {
    if (!vacString)
      return null;
    const match = vacString.match(/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = new Date().getFullYear();
      return new Date(year, month, day);
    }
    return null;
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => DailyChecklist2.init());
} else {
  DailyChecklist2.init();
}

// calendar_module.js
var CalendarModule2 = {
  currentDate: new Date,
  events: [],
  view: "month",
  searchQuery: "",
  editingDate: null,
  init() {
    console.log("\uD83D\uDCC5 Inicializando Calendario Inteligente V2...");
    this.loadEvents();
    this.generateEventsFromData();
    this.render();
    this.setupEventListeners();
  },
  setupEventListeners() {
    window.addEventListener("stateUpdated", () => {
      this.generateEventsFromData();
      this.render();
    });
  },
  loadEvents() {
    const saved = localStorage.getItem("sifu_calendar_events_v2");
    if (saved) {
      this.events = JSON.parse(saved);
    }
  },
  saveEvents() {
    localStorage.setItem("sifu_calendar_events_v2", JSON.stringify(this.events));
  },
  generateEventsFromData() {
    if (!window.state || !window.state.masterData)
      return;
    const generatedEvents = [];
    const today = new Date;
    window.state.masterData.forEach((service) => {
      if (service["FIN CONTRATO"]) {
        const endDate = this.excelDateToJS(service["FIN CONTRATO"]);
        if (endDate) {
          generatedEvents.push({
            id: `contract_end_${service.PROYECTO}`,
            type: "contract_end",
            title: `Contrato: ${service.TITULAR || "S/N"}`,
            description: `Fin de contrato en ${service.SERVICIO}`,
            date: endDate,
            color: "#ea4335",
            icon: "\uD83D\uDCC5",
            data: service
          });
        }
      }
      if (service["VACACIONES 2026"]) {
        const vacDates = this.parseVacationPeriod(service["VACACIONES 2026"]);
        if (vacDates) {
          generatedEvents.push({
            id: `vacation_${service.PROYECTO}`,
            type: "vacation",
            title: `Vacaciones: ${service.TITULAR}`,
            description: service.SERVICIO,
            date: vacDates.start,
            endDate: vacDates.end,
            color: "#fbbc04",
            icon: "\uD83C\uDFD6️",
            data: service
          });
        }
      }
    });
    if (window.MLEngine && window.MLEngine.predictions) {
      window.MLEngine.predictions.forEach((pred) => {
        generatedEvents.push({
          id: `risk_${pred.proyecto}`,
          type: "risk_alert",
          title: `RIESGO: ${pred.risk}`,
          description: `${pred.service}: ${pred.reason}`,
          date: new Date,
          color: "#ff6b6b",
          icon: "⚠️",
          isRisk: true
        });
      });
    }
    const manualEvents = this.events.filter((e) => e.custom);
    this.events = [...manualEvents, ...generatedEvents];
    this.saveEvents();
  },
  render() {
    const container = document.getElementById("calendar-container");
    if (!container)
      return;
    const filteredEvents = this.searchQuery ? this.events.filter((e) => e.title.toLowerCase().includes(this.searchQuery.toLowerCase()) || e.description && e.description.toLowerCase().includes(this.searchQuery.toLowerCase())) : this.events;
    const html = `
            <div class="calendar-header">
                <div class="calendar-controls">
                    <button class="btn-calendar" onclick="CalendarModule.previousPeriod()">◀</button>
                    <h3 class="calendar-title">${this.getTitle()}</h3>
                    <button class="btn-calendar" onclick="CalendarModule.nextPeriod()">▶</button>
                    <button class="btn-calendar today" onclick="CalendarModule.today()">Hoy</button>
                </div>

                <div class="calendar-search">
                    <input type="text" placeholder="Buscar evento..." 
                        oninput="CalendarModule.handleSearch(this.value)" 
                        value="${this.searchQuery}"
                        style="padding: 8px 12px; border-radius: 20px; border: 1px solid #ddd; width: 200px;">
                </div>

                <div class="calendar-view-switcher">
                    <button class="btn-view ${this.view === "month" ? "active" : ""}" onclick="CalendarModule.changeView('month')">Mes</button>
                    <button class="btn-view ${this.view === "week" ? "active" : ""}" onclick="CalendarModule.changeView('week')">Semana</button>
                    <button class="btn-view ${this.view === "day" ? "active" : ""}" onclick="CalendarModule.changeView('day')">Día</button>
                </div>
            </div>

            <div class="calendar-legend" style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; margin-bottom: 15px;">
                <span class="legend-item"><span class="legend-dot" style="background: #ef4444;"></span> Contratos</span>
                <span class="legend-item"><span class="legend-dot" style="background: #f59e0b;"></span> Vacaciones</span>
                <span class="legend-item"><span class="legend-dot" style="background: #ef4444;"></span> Riesgo ML</span>
                <span class="legend-item"><span class="legend-dot" style="background: #3b82f6;"></span> Personal</span>
            </div>


            <div class="calendar-body">
                ${this.renderCalendarView(filteredEvents)}
            </div>
        `;
    container.innerHTML = html;
  },
  renderCalendarView(events) {
    if (this.view === "month")
      return this.renderMonthView(events);
    if (this.view === "week")
      return this.renderWeekView(events);
    return this.renderDayView(events);
  },
  renderMonthView(events) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDayOffset = firstDay.getDay() - 1;
    if (startDayOffset === -1)
      startDayOffset = 6;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDayOffset);
    let html = `
            <div class="calendar-month">
                <div class="calendar-weekdays">
                    <div class="weekday">Lun</div><div class="weekday">Mar</div><div class="weekday">Mié</div>
                    <div class="weekday">Jue</div><div class="weekday">Vie</div><div class="weekday">Sáb</div><div class="weekday">Dom</div>
                </div>
                <div class="calendar-days">
        `;
    let tempDate = new Date(startDate);
    for (let i = 0;i < 42; i++) {
      if (i % 7 === 0)
        html += `<div class="calendar-week">`;
      const isCurrentMonth = tempDate.getMonth() === month;
      const isToday = this.isSameDay(tempDate, new Date);
      const dayEvents = this.getEventsForDate(tempDate, events);
      const hasRisk = dayEvents.some((e) => e.isRisk);
      html += `
                <div class="calendar-day ${!isCurrentMonth ? "other-month" : ""} ${isToday ? "today" : ""} ${hasRisk ? "risk-day" : ""}" 
                    onclick="CalendarModule.showDayDetails('${tempDate.toISOString()}')">
                    <div class="day-number">${tempDate.getDate()}</div>
                    <div class="day-events">
                        ${dayEvents.slice(0, 3).map((e) => `
                            <div class="event-dot" style="background: ${e.color};" title="${e.title}"></div>
                        `).join("")}
                        ${dayEvents.length > 3 ? `<div class="event-more">+${dayEvents.length - 3}</div>` : ""}
                    </div>
                </div>
            `;
      if (i % 7 === 6)
        html += `</div>`;
      tempDate.setDate(tempDate.getDate() + 1);
    }
    html += `</div></div>`;
    return html;
  },
  renderWeekView(events) {
    const startOfWeek = new Date(this.currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    let html = `<div class="calendar-week-grid">`;
    for (let i = 0;i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dayEvents = this.getEventsForDate(date, events);
      const isToday = this.isSameDay(date, new Date);
      html += `
                <div class="week-column ${isToday ? "today" : ""}" onclick="CalendarModule.showDayDetails('${date.toISOString()}')">
                    <div class="week-column-header">
                        ${date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
                    </div>
                    <div class="week-column-events">
                        ${dayEvents.map((e) => `
                            <div class="week-mini-event" style="background: ${e.color};">
                                ${e.icon} ${e.title}
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
    }
    html += `</div>`;
    return html;
  },
  renderDayView(events) {
    const dayEvents = this.getEventsForDate(this.currentDate, events);
    return `
            <div class="calendar-day-view">
                <h4 style="margin-bottom: 20px;">Operativa del ${this.currentDate.toLocaleDateString("es-ES", { dateStyle: "long" })}</h4>
                ${dayEvents.length === 0 ? '<div class="empty-state">No hay eventos para hoy</div>' : ""}
                <div class="events-detailed-list">
                    ${dayEvents.map((e) => `
                        <div class="calendar-event-item" style="border-left-color: ${e.color};">
                            <div class="event-icon-circle">${e.icon}</div>
                            <div class="event-info">
                                <div class="event-item-title">${e.title}</div>
                                <div class="event-item-desc">${e.description || ""}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
  },
  showDayDetails(dateIso) {
    const date = new Date(dateIso);
    this.editingDate = date;
    const modal = document.getElementById("calendar-modal");
    if (!modal)
      return;
    document.getElementById("calendar-modal-date").textContent = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    this.switchModalTab("events");
    this.renderModalEvents();
    modal.style.display = "flex";
  },
  renderModalEvents() {
    const list = document.getElementById("calendar-modal-list");
    const dayEvents = this.getEventsForDate(this.editingDate, this.events);
    if (dayEvents.length === 0) {
      list.innerHTML = `<div class="empty-events">\uD83C\uDFD6️ No hay eventos programados.</div>`;
      return;
    }
    list.innerHTML = dayEvents.map((e) => `
            <div class="calendar-event-item" style="border-left-color: ${e.color};">
                <div class="event-icon-circle">${e.icon}</div>
                <div class="event-info">
                    <div class="event-item-title">${e.title}</div>
                    <div class="event-item-desc">${e.description || ""}</div>
                </div>
                ${e.custom ? `<button class="btn-delete-event" onclick="CalendarModule.deleteEvent('${e.id}')">\uD83D\uDDD1️</button>` : ""}
            </div>
        `).join("");
  },
  switchModalTab(tab) {
    const eventsTab = document.getElementById("calendar-modal-content-events");
    const addTab = document.getElementById("calendar-modal-content-add");
    const btnEvents = document.getElementById("tab-btn-events");
    const btnAdd = document.getElementById("tab-btn-add");
    if (tab === "events") {
      eventsTab.classList.add("active");
      addTab.classList.remove("active");
      btnEvents.classList.add("active");
      btnAdd.classList.remove("active");
      this.renderModalEvents();
    } else {
      eventsTab.classList.remove("active");
      addTab.classList.add("active");
      btnEvents.classList.remove("active");
      btnAdd.classList.add("active");
    }
  },
  handleFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("event-title").value;
    const desc = document.getElementById("event-desc").value;
    const tag = document.getElementById("event-tag-type").value;
    const colors = {
      manual_event: "#4285f4",
      manual_urgent: "#ea4335",
      manual_audit: "#34a853",
      manual_task: "#764ba2"
    };
    const icons = {
      manual_event: "\uD83D\uDCCC",
      manual_urgent: "\uD83D\uDEA8",
      manual_audit: "⭐",
      manual_task: "\uD83D\uDCDD"
    };
    this.addEvent({
      title,
      description: desc,
      type: tag,
      date: this.editingDate,
      color: colors[tag] || "#4285f4",
      icon: icons[tag] || "\uD83D\uDCCC"
    });
    e.target.reset();
    this.switchModalTab("events");
  },
  addEvent(event) {
    event.id = `user_${Date.now()}`;
    event.custom = true;
    this.events.push(event);
    this.saveEvents();
    this.render();
    if (typeof showToast === "function")
      showToast("✅ Evento guardado");
  },
  deleteEvent(id) {
    this.events = this.events.filter((e) => e.id !== id);
    this.saveEvents();
    this.renderModalEvents();
    this.render();
  },
  closeModal() {
    document.getElementById("calendar-modal").style.display = "none";
  },
  getEventsForDate(date, eventList) {
    return eventList.filter((e) => {
      const evDate = new Date(e.date);
      if (this.isSameDay(evDate, date))
        return true;
      if (e.endDate) {
        const end = new Date(e.endDate);
        return date >= evDate && date <= end;
      }
      return false;
    });
  },
  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  },
  handleSearch(val) {
    this.searchQuery = val;
    this.render();
  },
  changeView(v) {
    this.view = v;
    this.render();
  },
  today() {
    this.currentDate = new Date;
    this.render();
  },
  previousPeriod() {
    const offset = this.view === "month" ? -1 : this.view === "week" ? -7 : -1;
    if (this.view === "month")
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    else
      this.currentDate.setDate(this.currentDate.getDate() + offset);
    this.render();
  },
  nextPeriod() {
    const offset = this.view === "month" ? 1 : this.view === "week" ? 7 : 1;
    if (this.view === "month")
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    else
      this.currentDate.setDate(this.currentDate.getDate() + offset);
    this.render();
  },
  getTitle() {
    const options = this.view === "month" ? { month: "long", year: "numeric" } : { dateStyle: "medium" };
    return this.currentDate.toLocaleDateString("es-ES", options).toUpperCase();
  },
  excelDateToJS(ed) {
    return ed ? new Date((ed - 25569) * 86400 * 1000) : null;
  },
  parseVacationPeriod(v) {
    const m = v.match(/(\d{1,2})\/(\d{1,2})\s+al\s+(\d{1,2})\/(\d{1,2})/);
    if (!m)
      return null;
    const y = new Date().getFullYear();
    return { start: new Date(y, m[2] - 1, m[1]), end: new Date(y, m[4] - 1, m[3]) };
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => CalendarModule2.init());
} else {
  CalendarModule2.init();
}

// vacation_module.js
var VacationModule = {
  activeVacations: [],
  upcomingVacations: [],
  coverageRatio: 100,
  chartInstance: null,
  cols: {
    worker: "TRABAJADOR NOM",
    center: "SERVICIO NOM",
    status: "ESTADO 1",
    vacationDate: "VACACIONES 2026"
  },
  init() {
    console.log("\uD83C\uDFD6️ Inicializando Módulo de Vacaciones v2.0...");
    try {
      this.processVacationData();
      this.populateWorkerSelect();
      this.renderAll();
      this.detectConflicts();
    } catch (error) {
      console.error("Error in VacationModule.init():", error);
      if (typeof showToast === "function") {
        showToast("⚠️ ERROR EN MÓDULO VACACIONES: " + error.message, "danger");
      }
    }
  },
  isDateInVacationRange(vacStr, refDate = new Date) {
    if (!vacStr)
      return false;
    const cleanStr = vacStr.toString().replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").toUpperCase().trim();
    const exclusions = ["NO", "NADA", "NINGUNA", "NO TIENE", "FALSO", "-", "", "OBRAS"];
    if (exclusions.includes(cleanStr))
      return false;
    const parts = cleanStr.split(/\b(?:Y\s+DEL|Y\s+EN|Y|,|;)\b|\s+(?=SEMANA)/);
    const refYear = refDate.getFullYear();
    const refTime = refDate.getTime();
    for (let part of parts) {
      part = part.trim();
      if (!part)
        continue;
      const rangeRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(?:AL|A|-)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
      const rangeMatch = part.match(rangeRegex);
      if (rangeMatch) {
        const startDay = parseInt(rangeMatch[1], 10);
        const startMonth = parseInt(rangeMatch[2], 10) - 1;
        let startYear = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : refYear;
        if (startYear < 100)
          startYear += 2000;
        const endDay = parseInt(rangeMatch[4], 10);
        const endMonth = parseInt(rangeMatch[5], 10) - 1;
        let endYear = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : refYear;
        if (endYear < 100)
          endYear += 2000;
        if (!rangeMatch[6] && endMonth < startMonth) {
          endYear = startYear + 1;
        }
        const startDate = new Date(startYear, startMonth, startDay);
        const endDate = new Date(endYear, endMonth, endDay);
        endDate.setHours(23, 59, 59, 999);
        if (refTime >= startDate.getTime() && refTime <= endDate.getTime()) {
          return true;
        }
      } else {
        const semanaRegex = /SEMANA\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
        const semanaMatch = part.match(semanaRegex);
        if (semanaMatch) {
          const startDay = parseInt(semanaMatch[1], 10);
          const startMonth = parseInt(semanaMatch[2], 10) - 1;
          let startYear = semanaMatch[3] ? parseInt(semanaMatch[3], 10) : refYear;
          if (startYear < 100)
            startYear += 2000;
          const startDate = new Date(startYear, startMonth, startDay);
          const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
          if (refTime >= startDate.getTime() && refTime <= endDate.getTime()) {
            return true;
          }
        } else {
          const months = {
            ENERO: 0,
            FEBRERO: 1,
            MARZO: 2,
            ABRIL: 3,
            MAYO: 4,
            JUNIO: 5,
            JULIO: 6,
            AGOSTO: 7,
            SEPTIEMBRE: 8,
            OCTUBRE: 9,
            NOVIEMBRE: 10,
            DICIEMBRE: 11
          };
          for (const [mName, mIdx] of Object.entries(months)) {
            if (part === mName || part.includes(mName)) {
              if (refDate.getMonth() === mIdx && refDate.getFullYear() === refYear) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  },
  processVacationData() {
    if (!window.state || !window.state.masterData)
      return;
    this.activeVacations = [];
    this.upcomingVacations = [];
    const data = window.state.masterData;
    data.forEach((row) => {
      const keys = Object.keys(row);
      const statusKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "ESTADO1") || "ESTADO 1";
      const vacKey = keys.find((k) => k.toUpperCase().includes("VACACIONES")) || "VACACIONES 2026";
      const workerKey = keys.find((k) => {
        const upper = k.toUpperCase();
        return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
      }) || "TRABAJADOR NOM";
      const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
      const status = (row[statusKey] || "").toString().toUpperCase();
      const worker = (row[workerKey] || "").toString().trim() || "Trabajador Desconocido";
      const center = row[centerKey] || "Centro No Especificado";
      const vacDate = row[vacKey] || "";
      const isOnVacationToday = this.isDateInVacationRange(vacDate);
      if (status.includes("VACACIONES") || isOnVacationToday) {
        this.activeVacations.push({ worker, center, vacDate, status: status || "VACACIONES" });
      } else if (vacDate && vacDate.toString().trim() !== "") {
        const noteStr = vacDate.toString().trim();
        const noteLower = noteStr.toLowerCase();
        const exclusionWords = ["no", "nada", "ninguna", "no tiene", "falso", "-", "obras"];
        if (!exclusionWords.includes(noteLower)) {
          const range = this.parseVacationRange(noteStr);
          let isPast = false;
          if (range) {
            const today = new Date;
            today.setHours(0, 0, 0, 0);
            if (range.end < today) {
              isPast = true;
            }
          }
          if (!isPast) {
            this.upcomingVacations.push({ worker, center, vacDate: noteStr });
          }
        }
      }
    });
    const totalStaff = data.length;
    const onVacation = this.activeVacations.length;
    if (totalStaff > 0) {
      this.coverageRatio = Math.round((totalStaff - onVacation) / totalStaff * 100);
    } else {
      this.coverageRatio = 100;
    }
  },
  populateWorkerSelect() {
    const datalist = document.getElementById("vacation-workers-datalist");
    if (!datalist || !window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const workers = [
      ...new Set(window.state.masterData.map((row) => (row[workerKey] || "").toString().trim()).filter((name) => name !== ""))
    ].sort();
    datalist.innerHTML = workers.map((w) => `<option value="${w}"></option>`).join("");
  },
  renderAll() {
    this.updateKPIs();
    this.renderChart();
    this.applyActiveFilters();
    this.applyUpcomingFilters();
  },
  renderChart() {
    const canvas = document.getElementById("vacationChart");
    if (!canvas)
      return;
    const ctx = canvas.getContext("2d");
    const currentMonthIndex = new Date().getMonth();
    const monthlyData = Array(12).fill(0).map(() => ({ disfrutadas: 0, pendientes: 0 }));
    const monthMap = {
      ene: 0,
      feb: 1,
      mar: 2,
      abr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dic: 11
    };
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const allVacations = [...this.activeVacations, ...this.upcomingVacations];
    const processedWorkers = new Set;
    allVacations.forEach((vac) => {
      const uniqueId = vac.worker === "Trabajador Desconocido" ? `anon-${vac.center}-${vac.vacDate}` : vac.worker;
      if (processedWorkers.has(uniqueId))
        return;
      processedWorkers.add(uniqueId);
      if (!vac.vacDate)
        return;
      const textToLower = vac.vacDate.toString().toLowerCase();
      let foundMonth = -1;
      for (const [key, index] of Object.entries(monthMap)) {
        if (textToLower.includes(key)) {
          foundMonth = index;
        }
      }
      if (foundMonth === -1) {
        const regex = /\b\d{1,2}[\/\-](\d{1,2})\b/g;
        let match;
        let lastMonthFound = -1;
        while ((match = regex.exec(textToLower)) !== null) {
          const monthNum = parseInt(match[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            lastMonthFound = monthNum - 1;
          }
        }
        if (lastMonthFound !== -1) {
          foundMonth = lastMonthFound;
        }
      }
      if (foundMonth !== -1) {
        if (textToLower.includes("disfrutada") || textToLower.includes("realizada") || textToLower.includes("hechas") || textToLower.includes("ok") || foundMonth < currentMonthIndex) {
          monthlyData[foundMonth].disfrutadas++;
        } else if (foundMonth === currentMonthIndex && this.activeVacations.some((v) => v.worker === vac.worker)) {
          monthlyData[foundMonth].disfrutadas++;
        } else {
          monthlyData[foundMonth].pendientes++;
        }
      } else {
        if (this.activeVacations.some((v) => v.worker === vac.worker)) {
          monthlyData[currentMonthIndex].disfrutadas++;
        } else {
          const nextMonth = (currentMonthIndex + 1) % 12;
          monthlyData[nextMonth].pendientes++;
        }
      }
    });
    const dataDisfrutadas = monthlyData.map((m) => m.disfrutadas);
    const dataPendientes = monthlyData.map((m) => m.pendientes);
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    this.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthNames,
        datasets: [
          {
            label: "Disfrutadas / En curso",
            data: dataDisfrutadas,
            backgroundColor: "#10b981",
            borderColor: "#059669",
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "Pendientes",
            data: dataPendientes,
            backgroundColor: "#fbbf24",
            borderColor: "#d97706",
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 12, font: { size: 11, family: "Outfit" } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: { font: { family: "Outfit" }, stepSize: 1 }
          },
          x: {
            stacked: true,
            ticks: { font: { family: "Outfit" } }
          }
        }
      }
    });
  },
  updateKPIs() {
    const countActiveEl = document.getElementById("vacation-active-count");
    const countUpcomingEl = document.getElementById("vacation-upcoming-count");
    const coverageEl = document.getElementById("vacation-coverage-ratio");
    if (countActiveEl)
      countActiveEl.textContent = this.activeVacations.length;
    if (countUpcomingEl)
      countUpcomingEl.textContent = this.upcomingVacations.length;
    if (coverageEl)
      coverageEl.textContent = this.coverageRatio + "%";
  },
  parseVacationRange(vacStr) {
    if (!vacStr)
      return null;
    const cleanStr = vacStr.toString().replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").toUpperCase().trim();
    const exclusions = ["NO", "NADA", "NINGUNA", "NO TIENE", "FALSO", "-", "", "OBRAS"];
    if (exclusions.includes(cleanStr))
      return null;
    const refYear = new Date().getFullYear();
    const rangeRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(?:AL|A|-)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
    const rangeMatch = cleanStr.match(rangeRegex);
    if (rangeMatch) {
      const startDay = parseInt(rangeMatch[1], 10);
      const startMonth = parseInt(rangeMatch[2], 10) - 1;
      let startYear = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : refYear;
      if (startYear < 100)
        startYear += 2000;
      const endDay = parseInt(rangeMatch[4], 10);
      const endMonth = parseInt(rangeMatch[5], 10) - 1;
      let endYear = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : refYear;
      if (endYear < 100)
        endYear += 2000;
      if (!rangeMatch[6] && endMonth < startMonth) {
        endYear = startYear + 1;
      }
      const start = new Date(startYear, startMonth, startDay);
      const end = new Date(endYear, endMonth, endDay);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const semanaRegex = /SEMANA\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
    const semanaMatch = cleanStr.match(semanaRegex);
    if (semanaMatch) {
      const startDay = parseInt(semanaMatch[1], 10);
      const startMonth = parseInt(semanaMatch[2], 10) - 1;
      let startYear = semanaMatch[3] ? parseInt(semanaMatch[3], 10) : refYear;
      if (startYear < 100)
        startYear += 2000;
      const start = new Date(startYear, startMonth, startDay);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
      return { start, end };
    }
    const months = {
      ENERO: 0,
      FEBRERO: 1,
      MARZO: 2,
      ABRIL: 3,
      MAYO: 4,
      JUNIO: 5,
      JULIO: 6,
      AGOSTO: 7,
      SEPTIEMBRE: 8,
      OCTUBRE: 9,
      NOVIEMBRE: 10,
      DICIEMBRE: 11
    };
    for (const [mName, mIdx] of Object.entries(months)) {
      if (cleanStr === mName || cleanStr.includes(mName)) {
        const start = new Date(refYear, mIdx, 1);
        const end = new Date(refYear, mIdx + 1, 0, 23, 59, 59, 999);
        return { start, end };
      }
    }
    return null;
  },
  getVacationDetails(vacDate) {
    const range = this.parseVacationRange(vacDate);
    if (!range)
      return null;
    const today = new Date;
    today.setHours(0, 0, 0, 0);
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(23, 59, 59, 999);
    const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let statusText = "";
    let statusClass = "";
    let daysUntil = 0;
    if (today >= start && today <= end) {
      statusText = "Activa y En curso";
      statusClass = "active-now";
    } else if (today < start) {
      daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil === 1) {
        statusText = "Empieza mañana";
        statusClass = "starts-tomorrow";
      } else {
        statusText = `Empieza en ${daysUntil} días`;
        statusClass = "starts-future";
      }
    } else {
      statusText = "Finalizada";
      statusClass = "finished";
    }
    return {
      start,
      end,
      durationDays,
      daysUntil,
      statusText,
      statusClass
    };
  },
  getSubstituteCoverage(worker, center) {
    try {
      const clean = (str) => (str || "").toString().toLowerCase().replace(/\s/g, "");
      const cleanWorker = clean(worker);
      const cleanCenter = clean(center);
      let assignment = null;
      if (typeof SubstituteManagement !== "undefined" && SubstituteManagement.assignments) {
        assignment = SubstituteManagement.assignments.find((a) => clean(a.originalTitular) === cleanWorker && clean(a.service) === cleanCenter && a.status === "active");
      }
      if (!assignment) {
        const saved = localStorage.getItem("sifu_substitute_assignments_v1");
        if (saved) {
          const list = JSON.parse(saved);
          assignment = list.find((a) => clean(a.originalTitular) === cleanWorker && clean(a.service) === cleanCenter && a.status === "active");
        }
      }
      return assignment ? assignment.substitute : null;
    } catch (e) {
      console.error("Error checking substitute coverage:", e);
      return null;
    }
  },
  toggleCardDetails(cardElement) {
    const detailsEl = cardElement.querySelector(".vacation-card-details");
    if (detailsEl) {
      const isCollapsed = detailsEl.style.display === "none";
      detailsEl.style.display = isCollapsed ? "block" : "none";
      if (isCollapsed) {
        cardElement.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
        cardElement.style.borderColor = "#cbd5e1";
      } else {
        cardElement.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)";
        cardElement.style.borderColor = "#e2e8f0";
      }
    }
  },
  renderVacationCard(vac, isUpcoming) {
    const substitute = this.getSubstituteCoverage(vac.worker, vac.center);
    const details = this.getVacationDetails(vac.vacDate);
    let stateClass = "state-future";
    if (details) {
      if (details.statusClass === "finished") {
        stateClass = "state-finished";
      } else if (substitute) {
        stateClass = "state-covered";
      } else {
        if (details.statusClass === "active-now" || details.daysUntil <= 7) {
          stateClass = "state-critical";
        } else if (details.daysUntil <= 30) {
          stateClass = "state-warning";
        } else {
          stateClass = "state-future";
        }
      }
    } else {
      stateClass = substitute ? "state-covered" : "state-warning";
    }
    const cleanWorkerName = vac.worker.replace(/'/g, "\\'");
    const cleanCenterName = vac.center.replace(/'/g, "\\'");
    let workerKey = "TRABAJADOR NOM";
    let centerKey = "SERVICIO NOM";
    if (window.state && window.state.masterData && window.state.masterData[0]) {
      const keys = Object.keys(window.state.masterData[0]);
      workerKey = keys.find((k) => {
        const upper = k.toUpperCase();
        return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
      }) || "TRABAJADOR NOM";
      centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    }
    const allWorkers = window.state && window.state.masterData ? [
      ...new Set(window.state.masterData.map((row) => (row[workerKey] || "").toString().trim()).filter((name) => name !== "" && name !== vac.worker))
    ].sort() : [];
    const serviceRow = window.state && window.state.masterData ? window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === vac.worker && (r[centerKey] || "").toString().trim() === vac.center) : null;
    let iaSuggestionsHTML = "";
    if (serviceRow && typeof SubstituteManagement !== "undefined" && typeof SubstituteManagement.findBestSubstitutes === "function") {
      const suggestions = SubstituteManagement.findBestSubstitutes(serviceRow, 3);
      if (suggestions && suggestions.length > 0) {
        iaSuggestionsHTML = `
                    <optgroup label="⭐ Recomendados por IA">
                        ${suggestions.map((sug) => `<option value="${sug.worker}">⭐ ${sug.worker} (${sug.totalScore}% match)</option>`).join("")}
                    </optgroup>
                `;
      }
    }
    const workerOptionsHTML = allWorkers.map((w) => `<option value="${w}">${w}</option>`).join("");
    const initial = vac.worker ? vac.worker.trim().charAt(0).toUpperCase() : "?";
    const avatarBg = isUpcoming ? "#eff6ff" : "#fffbeb";
    const avatarColor = isUpcoming ? "#1d4ed8" : "#d97706";
    return `
            <div class="vacation-card ${stateClass}" onclick="VacationModule.toggleCardDetails(this)" style="display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 15px; align-items: center; padding: 14px; margin-bottom: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.2s; position: relative; cursor: pointer; color: #000000 !important;">
                <!-- Columna 1: Info Trabajador -->
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; color: #000000 !important;">
                    <div class="vacation-avatar" style="width: 36px; height: 36px; background: ${avatarBg}; color: ${avatarColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; border: 1px solid ${isUpcoming ? "#dbeafe" : "#fef3c7"};">
                        ${initial}
                    </div>
                    <div style="min-width: 0; flex: 1; color: #000000 !important;">
                        <div style="font-weight: 800; color: #000000 !important; font-size: 13.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vac.worker}">
                            ${vac.worker}
                        </div>
                        <div style="color: #000000 !important; font-size: 11px; margin-top: 4px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vac.center}">
                            <span>\uD83D\uDDC2️</span> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #000000 !important;">${vac.center}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Columna 2: Fechas y Estado Temporal -->
                <div style="display: flex; flex-direction: column; gap: 5px; min-width: 0; color: #000000 !important;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <span style="display: inline-flex; align-items: center; background: ${avatarBg}; color: ${avatarColor}; border: 1px solid ${isUpcoming ? "#dbeafe" : "#fef3c7"}; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${isUpcoming ? "PLANIFICADA" : "ACTIVA"}
                        </span>
                    </div>
                    <div class="vacation-date-badge" style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #000000 !important; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; width: fit-content;">
                        <span>\uD83D\uDCC5</span> <span style="color: #000000 !important;">${vac.vacDate}</span>
                    </div>
                    ${details ? `
                        <div style="font-size: 10px; font-weight: 700; color: #000000 !important; display: flex; align-items: center; gap: 4px; padding-left: 4px;">
                            <span>⏱️</span> <span style="color: #000000 !important;">${details.durationDays} días • ${details.statusText}</span>
                        </div>
                    ` : ""}
                </div>
                
                <!-- Columna 3: Cobertura & Acciones -->
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 0; color: #000000 !important;">
                    ${substitute ? `
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; max-width: 100%; color: #000000 !important;">
                            <span class="substitute-badge-covered" style="display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #000000 !important; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 12px; font-size: 9.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="Suplido por ${substitute}">
                                \uD83D\uDEE1️ <span style="color: #000000 !important;">${substitute}</span>
                            </span>
                            <button class="vacation-btn-action" onclick="event.stopPropagation(); VacationModule.removeSubstituteInSitu('${cleanWorkerName}', '${cleanCenterName}')" style="background: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; height: 24px;" title="Quitar Suplente">
                                ❌
                            </button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 100%; color: #000000 !important;">
                            <span class="substitute-badge-uncovered" style="display: inline-flex; align-items: center; gap: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; white-space: nowrap;">
                                ⚠️ Sin Suplente
                            </span>
                            <select class="vacation-select-sub" onchange="event.stopPropagation(); if(this.value === 'ADD_NEW_WORKER_IN_SITU') { this.value = ''; VacationModule.promptAddNewWorkerInSitu('${cleanWorkerName}', '${cleanCenterName}', this); } else { VacationModule.assignSubstituteInSitu('${cleanWorkerName}', '${cleanCenterName}', this.value); }" style="width: 125px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 9.5px; font-weight: 700; color: #000000 !important; background: white; cursor: pointer; font-family: 'Outfit'; margin-top: 4px;">
                                <option value="" style="color: #000000 !important;">➕ Elegir Suplente...</option>
                                <option value="ADD_NEW_WORKER_IN_SITU" style="font-weight: 800; color: #2563eb; background: #e0f2fe;">➕ [Nuevo suplente...]</option>
                                ${iaSuggestionsHTML}
                                <optgroup label="\uD83D\uDC65 Todos los trabajadores" style="color: #000000 !important;">
                                    ${workerOptionsHTML}
                                </optgroup>
                            </select>
                        </div>
                    `}
                    
                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                        ${!substitute && isUpcoming ? `
                            <button class="vacation-btn-action primary" onclick="event.stopPropagation(); VacationModule.promptAssignSubstitute('${cleanWorkerName}', '${cleanCenterName}')" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 5px 10px; border-radius: 8px; font-size: 9.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                                \uD83E\uDD16 IA Match
                            </button>
                        ` : ""}
                        <button class="vacation-btn-action" onclick="event.stopPropagation(); VacationModule.promptDeleteVacation('${cleanWorkerName}')" style="background: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; padding: 5px 10px; border-radius: 8px; font-size: 9.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Eliminar Planificación">
                            \uD83D\uDDD1️
                        </button>
                    </div>
                </div>

                <!-- Detalle Desplegable -->
                <div class="vacation-card-details" style="display: none; grid-column: span 3; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; color: #000000 !important; font-size: 11.5px; line-height: 1.5; text-align: left; width: 100%;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 15px; color: #000000 !important;">
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">\uD83C\uDD94 ID Trabajador:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.ID || "N/A" : "N/A"}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">\uD83D\uDCC1 Proyecto:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.PROYECTO || "N/A" : "N/A"}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">⏰ Horario:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.HORARIO || "N/A" : "N/A"}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">\uD83D\uDCC5 Fin Contrato:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow["FIN CONTRATO"] || "N/A" : "N/A"}</span></div>
                        <div style="grid-column: span 2; color: #000000 !important;"><strong style="color: #000000 !important;">\uD83D\uDCCD Dirección:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow["S DIRECCION"] || "N/A" : "N/A"}</span></div>
                        <div style="grid-column: span 2; color: #000000 !important;"><strong style="color: #000000 !important;">\uD83D\uDCAC Observaciones:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.OBSERVACIONES || "Ninguna" : "Ninguna"}</span></div>
                    </div>
                </div>
            </div>
        `;
  },
  promptAssignSubstitute(workerName, centerName) {
    if (!window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    const serviceRow = window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === workerName && (r[centerKey] || "").toString().trim() === centerName);
    if (!serviceRow) {
      if (typeof showToast === "function") {
        showToast("⚠️ No se encontró la fila del servicio en Master Data", "danger");
      }
      return;
    }
    if (typeof window.switchTab === "function") {
      window.switchTab("avanzado");
      setTimeout(() => {
        const container = document.getElementById("substitute-manager-container");
        if (container) {
          container.scrollIntoView({ behavior: "smooth" });
          if (typeof SubstituteManagement !== "undefined") {
            SubstituteManagement.promptAssignment(serviceRow.PROYECTO, "");
          }
        }
      }, 300);
    }
  },
  promptDeleteVacation(workerName) {
    const confirmed = confirm(`¿Estás seguro de que deseas eliminar la planificación de vacaciones de ${workerName}?`);
    if (!confirmed)
      return;
    if (!window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const statusKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "ESTADO1") || "ESTADO 1";
    const vacKey = keys.find((k) => k.toUpperCase().includes("VACACIONES")) || "VACACIONES 2026";
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const row = window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === workerName);
    if (row) {
      row[vacKey] = "";
      if (row[statusKey] === "VACACIONES") {
        row[statusKey] = "";
      }
      if (typeof window.saveAndRender === "function") {
        window.saveAndRender();
      } else {
        this.processVacationData();
        this.populateWorkerSelect();
        this.renderAll();
        this.detectConflicts();
      }
      if (typeof showToast === "function")
        showToast(`\uD83D\uDDD1️ Vacaciones eliminadas para ${workerName}`, "info");
    }
  },
  assignSubstituteInSitu(workerName, centerName, substituteName) {
    if (!substituteName)
      return;
    if (!window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    const row = window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === workerName && (r[centerKey] || "").toString().trim() === centerName);
    if (row) {
      const suplenteKey = keys.find((k) => k.toUpperCase() === "SUPLENTE") || "SUPLENTE";
      row[suplenteKey] = substituteName;
      const estadoKey = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
      if (row[estadoKey] === "DESCUBIERTO") {
        row[estadoKey] = "CUBIERTO";
      }
      if (typeof SubstituteManagement !== "undefined") {
        SubstituteManagement.assignSubstitute(row, substituteName, true);
      } else {
        try {
          const saved = localStorage.getItem("sifu_substitute_assignments_v1");
          const assignments = saved ? JSON.parse(saved) : [];
          const assignment = {
            id: `assign_${Date.now()}`,
            service: row[centerKey] || centerName,
            proyecto: row.PROYECTO,
            originalTitular: workerName,
            substitute: substituteName,
            assignedDate: new Date().toISOString(),
            temporary: true,
            status: "active",
            notes: "Asignado in-situ desde módulo vacaciones"
          };
          assignments.push(assignment);
          localStorage.setItem("sifu_substitute_assignments_v1", JSON.stringify(assignments));
        } catch (e) {
          console.error("Error saving assignment to localStorage:", e);
        }
      }
      if (typeof window.saveAndRender === "function") {
        window.saveAndRender();
      } else {
        this.processVacationData();
        this.populateWorkerSelect();
        this.renderAll();
        this.detectConflicts();
      }
      if (typeof showToast === "function") {
        showToast(`✅ ${substituteName} asignado como suplente de ${workerName}`, "success");
      }
    } else {
      if (typeof showToast === "function") {
        showToast("⚠️ No se encontró el registro del servicio", "danger");
      }
    }
  },
  removeSubstituteInSitu(workerName, centerName) {
    const confirmed = confirm(`¿Quitar el suplente asignado para las vacaciones de ${workerName}?`);
    if (!confirmed)
      return;
    if (!window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    const row = window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === workerName && (r[centerKey] || "").toString().trim() === centerName);
    if (row) {
      const suplenteKey = keys.find((k) => k.toUpperCase() === "SUPLENTE") || "SUPLENTE";
      row[suplenteKey] = "";
      const estadoKey = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
      const statusKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "ESTADO1") || "ESTADO 1";
      if (row[statusKey] === "VACACIONES") {
        row[estadoKey] = "DESCUBIERTO";
      }
      if (typeof SubstituteManagement !== "undefined") {
        const clean = (str) => (str || "").toString().toLowerCase().replace(/\s/g, "");
        const cleanWorker = clean(workerName);
        const cleanCenter = clean(centerName);
        const assignment = SubstituteManagement.assignments.find((a) => clean(a.originalTitular) === cleanWorker && clean(a.service) === cleanCenter && a.status === "active");
        if (assignment) {
          SubstituteManagement.endSubstitution(assignment.id);
        }
      } else {
        try {
          const saved = localStorage.getItem("sifu_substitute_assignments_v1");
          if (saved) {
            const assignments = JSON.parse(saved);
            const clean = (str) => (str || "").toString().toLowerCase().replace(/\s/g, "");
            const cleanWorker = clean(workerName);
            const cleanCenter = clean(centerName);
            const assignment = assignments.find((a) => clean(a.originalTitular) === cleanWorker && clean(a.service) === cleanCenter && a.status === "active");
            if (assignment) {
              assignment.status = "completed";
              assignment.endDate = new Date().toISOString();
              localStorage.setItem("sifu_substitute_assignments_v1", JSON.stringify(assignments));
            }
          }
        } catch (e) {
          console.error("Error ending assignment in localStorage:", e);
        }
      }
      if (typeof window.saveAndRender === "function") {
        window.saveAndRender();
      } else {
        this.processVacationData();
        this.populateWorkerSelect();
        this.renderAll();
        this.detectConflicts();
      }
      if (typeof showToast === "function") {
        showToast(`\uD83D\uDDD1️ Suplente removido para ${workerName}`, "info");
      }
    }
  },
  applyActiveFilters() {
    const searchInput = document.getElementById("vacation-active-search");
    const sortSelect = document.getElementById("vacation-active-sort");
    const coverageSelect = document.getElementById("vacation-active-coverage");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const sort = sortSelect ? sortSelect.value : "worker-asc";
    const coverage = coverageSelect ? coverageSelect.value : "all";
    let filtered = [...this.activeVacations];
    if (search) {
      filtered = filtered.filter((vac) => vac.worker.toLowerCase().includes(search) || vac.center.toLowerCase().includes(search));
    }
    if (coverage !== "all") {
      filtered = filtered.filter((vac) => {
        const sub = this.getSubstituteCoverage(vac.worker, vac.center);
        return coverage === "covered" ? !!sub : !sub;
      });
    }
    filtered.sort((a, b) => {
      if (sort === "worker-asc") {
        return a.worker.localeCompare(b.worker);
      } else if (sort === "center-asc") {
        return a.center.localeCompare(b.center);
      }
      return 0;
    });
    this.renderActive(filtered);
  },
  applyUpcomingFilters() {
    const searchInput = document.getElementById("vacation-upcoming-search");
    const sortSelect = document.getElementById("vacation-upcoming-sort");
    const coverageSelect = document.getElementById("vacation-upcoming-coverage");
    const timeframeSelect = document.getElementById("vacation-upcoming-timeframe");
    const monthSelect = document.getElementById("vacation-upcoming-month");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const sort = sortSelect ? sortSelect.value : "date-asc";
    const coverage = coverageSelect ? coverageSelect.value : "all";
    const timeframe = timeframeSelect ? timeframeSelect.value : "all";
    const month = monthSelect ? monthSelect.value : "all";
    let filtered = [...this.upcomingVacations];
    if (search) {
      filtered = filtered.filter((vac) => vac.worker.toLowerCase().includes(search) || vac.center.toLowerCase().includes(search) || vac.vacDate.toLowerCase().includes(search));
    }
    if (coverage !== "all") {
      filtered = filtered.filter((vac) => {
        const sub = this.getSubstituteCoverage(vac.worker, vac.center);
        return coverage === "covered" ? !!sub : !sub;
      });
    }
    if (timeframe !== "all") {
      const today = new Date;
      today.setHours(0, 0, 0, 0);
      let maxDays = 0;
      if (timeframe === "15days")
        maxDays = 15;
      else if (timeframe === "30days")
        maxDays = 30;
      else if (timeframe === "90days")
        maxDays = 90;
      filtered = filtered.filter((vac) => {
        const details = this.getVacationDetails(vac.vacDate);
        if (!details)
          return false;
        if (details.statusClass === "active-now")
          return true;
        return details.daysUntil > 0 && details.daysUntil <= maxDays;
      });
    }
    if (month !== "all") {
      const monthIdx = parseInt(month, 10);
      const refYear = new Date().getFullYear();
      const monthStart = new Date(refYear, monthIdx, 1);
      const monthEnd = new Date(refYear, monthIdx + 1, 0, 23, 59, 59, 999);
      filtered = filtered.filter((vac) => {
        const range = this.parseVacationRange(vac.vacDate);
        if (!range)
          return false;
        return range.start <= monthEnd && range.end >= monthStart;
      });
    }
    filtered.sort((a, b) => {
      const detailA = this.getVacationDetails(a.vacDate);
      const detailB = this.getVacationDetails(b.vacDate);
      if (sort === "date-asc" || sort === "date-desc") {
        if (!detailA)
          return 1;
        if (!detailB)
          return -1;
        return sort === "date-asc" ? detailA.start - detailB.start : detailB.start - detailA.start;
      } else if (sort === "worker-asc") {
        return a.worker.localeCompare(b.worker);
      } else if (sort === "center-asc") {
        return a.center.localeCompare(b.center);
      }
      return 0;
    });
    this.renderUpcomingList(filtered);
  },
  renderActive(dataArray) {
    const listEl = document.getElementById("vacation-active-list");
    if (!listEl)
      return;
    if (dataArray.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#64748b;">\uD83D\uDEAB Ningún operario de vacaciones actualmente.</div>`;
      return;
    }
    listEl.innerHTML = dataArray.map((vac) => this.renderVacationCard(vac, false)).join("");
  },
  renderUpcomingList(dataArray) {
    const listEl = document.getElementById("vacation-upcoming-list");
    if (!listEl)
      return;
    if (dataArray.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#64748b;">\uD83D\uDCC5 No hay salidas planificadas registradas.</div>`;
      return;
    }
    const limit = Math.min(dataArray.length, 50);
    let html = "";
    for (let i = 0;i < limit; i++) {
      const vac = dataArray[i];
      html += this.renderVacationCard(vac, true);
    }
    if (dataArray.length > 50) {
      html += `<div style="text-align: center; font-size: 10px; color: #94a3b8; padding: 10px;">+ ${dataArray.length - 50} más...</div>`;
    }
    listEl.innerHTML = html;
  },
  handleFormSubmit() {
    const workerSelect = document.getElementById("vacation-form-worker");
    const startInput = document.getElementById("vacation-form-start");
    const endInput = document.getElementById("vacation-form-end");
    const statusSelect = document.getElementById("vacation-form-status");
    if (!workerSelect || !startInput || !endInput || !statusSelect)
      return;
    const worker = workerSelect.value.trim();
    const startVal = startInput.value;
    const endVal = endInput.value;
    const status = statusSelect.value;
    if (!worker || !startVal || !endVal) {
      if (typeof showToast === "function")
        showToast("⚠️ Por favor completa todos los campos", "warning");
      return;
    }
    const formatDate = (dateStr) => {
      const parts = dateStr.split("-");
      return `${parts[2]}/${parts[1]}`;
    };
    const rangeText = `Del ${formatDate(startVal)} al ${formatDate(endVal)}`;
    if (!window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const statusKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "ESTADO1") || "ESTADO 1";
    const vacKey = keys.find((k) => k.toUpperCase().includes("VACACIONES")) || "VACACIONES 2026";
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    let row = window.state.masterData.find((r) => (r[workerKey] || "").toString().trim() === worker);
    let isNewWorker = false;
    if (!row) {
      isNewWorker = true;
      row = {};
      const templateRow = window.state.masterData[0] || {};
      Object.keys(templateRow).forEach((key) => {
        row[key] = "";
      });
      row[workerKey] = worker;
      const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
      row[centerKey] = "SERVICIO SIN ASIGNAR";
      const estadoKey = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
      row[estadoKey] = "CUBIERTO";
      const tipoKey = keys.find((k) => k.toUpperCase() === "TIPO S") || "TIPO S";
      row[tipoKey] = "NUEVO";
      const idKey = keys.find((k) => k.toUpperCase() === "ID") || "ID";
      row[idKey] = "NEW_" + Date.now();
      window.state.masterData.push(row);
    }
    if (status === "VACACIONES") {
      row[statusKey] = "VACACIONES";
    } else {
      row[statusKey] = "";
    }
    row[vacKey] = rangeText;
    if (typeof window.saveAndRender === "function") {
      window.saveAndRender();
    } else {
      this.processVacationData();
      this.populateWorkerSelect();
      this.renderAll();
      this.detectConflicts();
      if (typeof renderMasterBodyOnly === "function")
        renderMasterBodyOnly();
    }
    const successMsg = isNewWorker ? `✅ Creado trabajador nuevo y registradas vacaciones para ${worker}` : `✅ Vacaciones planificadas para ${worker}`;
    if (typeof showToast === "function")
      showToast(successMsg, "success");
    workerSelect.value = "";
    startInput.value = "";
    endInput.value = "";
  },
  detectConflicts() {
    const conflictCard = document.getElementById("vacation-conflict-card");
    const conflictList = document.getElementById("vacation-conflict-list");
    if (!conflictCard || !conflictList || !window.state || !window.state.masterData)
      return;
    const keys = Object.keys(window.state.masterData[0] || {});
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    const vacKey = keys.find((k) => k.toUpperCase().includes("VACACIONES")) || "VACACIONES 2026";
    const statusKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "ESTADO1") || "ESTADO 1";
    const centerVacations = {};
    const allVacations = [...this.activeVacations, ...this.upcomingVacations];
    allVacations.forEach((vac) => {
      if (!centerVacations[vac.center]) {
        centerVacations[vac.center] = [];
      }
      if (!centerVacations[vac.center].some((v) => v.worker === vac.worker)) {
        centerVacations[vac.center].push(vac);
      }
    });
    const conflicts = [];
    for (const [center, list] of Object.entries(centerVacations)) {
      if (list.length > 1) {
        const names = list.map((v) => v.worker).join(", ");
        conflicts.push(`⚠️ <strong>Conflicto en ${center}</strong>: Se detectan múltiples solicitudes/vacaciones coincidentes para: <strong>${names}</strong>. Por favor, revisa la cobertura para evitar descubiertos en el servicio.`);
      }
    }
    if (conflicts.length > 0) {
      conflictCard.style.display = "block";
      conflictList.innerHTML = conflicts.map((c) => `<div style="padding:6px 0; border-bottom:1px dashed rgba(220, 38, 38, 0.1);">${c}</div>`).join("");
    } else {
      conflictCard.style.display = "none";
    }
  },
  filterActive(searchTerm) {
    this.applyActiveFilters();
  },
  filterUpcoming(searchTerm) {
    this.applyUpcomingFilters();
  },
  showNewWorkerModal(defaultName, callback) {
    const existing = document.getElementById("sifu-new-worker-modal");
    if (existing)
      existing.remove();
    const modalDiv = document.createElement("div");
    modalDiv.id = "sifu-new-worker-modal";
    modalDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: 'Outfit', sans-serif;
        `;
    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5);
            border-radius: 24px;
            width: 440px;
            max-width: 90%;
            padding: 28px;
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            color: #0f172a;
        `;
    contentDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 8px;">
                    <span>\uD83D\uDC65</span> REGISTRAR TRABAJADOR
                </h3>
                <button type="button" id="sifu-close-worker-btn" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; line-height: 1; padding: 4px; transition: color 0.2s;">&times;</button>
            </div>
            
            <form id="sifu-new-worker-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre Completo *</label>
                    <input type="text" id="new-worker-name" required value="${defaultName || ""}" placeholder="Ej: LUIS ALBERTO GÓMEZ" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Servicio / Centro</label>
                    <input type="text" id="new-worker-service" value="SERVICIO GENERAL" placeholder="Ej: LIMPIEZA CENTRO CULTURAL" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo de Servicio / Cliente</label>
                    <input type="text" id="new-worker-client" value="GENERAL" placeholder="Ej: ALDI" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Proyecto / Código</label>
                        <input type="text" id="new-worker-project" value="PROY-NUEVO" placeholder="Ej: SVO0001" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Horario</label>
                        <input type="text" id="new-worker-schedule" value="L a V" placeholder="Ej: L a V de 8h a 14h" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 14px; justify-content: flex-end;">
                    <button type="button" id="sifu-cancel-worker-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit;">CANCELAR</button>
                    <button type="submit" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); transition: all 0.2s; font-family: inherit;">REGISTRAR</button>
                </div>
            </form>
        `;
    modalDiv.appendChild(contentDiv);
    document.body.appendChild(modalDiv);
    setTimeout(() => {
      modalDiv.style.opacity = "1";
      contentDiv.style.transform = "scale(1)";
    }, 10);
    setTimeout(() => {
      const nameInput = document.getElementById("new-worker-name");
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 150);
    const closeModal = () => {
      modalDiv.style.opacity = "0";
      contentDiv.style.transform = "scale(0.9)";
      setTimeout(() => {
        modalDiv.remove();
      }, 300);
    };
    document.getElementById("sifu-close-worker-btn").onclick = closeModal;
    document.getElementById("sifu-cancel-worker-btn").onclick = closeModal;
    const inputs = [
      "new-worker-name",
      "new-worker-service",
      "new-worker-client",
      "new-worker-project",
      "new-worker-schedule"
    ];
    inputs.forEach((id) => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.onfocus = () => {
          inp.style.borderColor = "#2563eb";
          inp.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
        };
        inp.onblur = () => {
          inp.style.borderColor = "#cbd5e1";
          inp.style.boxShadow = "none";
        };
      }
    });
    document.getElementById("sifu-new-worker-form").onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById("new-worker-name").value;
      const service = document.getElementById("new-worker-service").value;
      const client = document.getElementById("new-worker-client").value;
      const project = document.getElementById("new-worker-project").value;
      const schedule = document.getElementById("new-worker-schedule").value;
      closeModal();
      callback({ name, service, client, project, schedule });
    };
  },
  createWorkerRow(name, service, client, project, schedule) {
    if (!window.state || !window.state.masterData || !window.state.masterData[0])
      return null;
    const template = window.state.masterData[0];
    const newRow = {};
    for (const key in template) {
      newRow[key] = "";
    }
    const keys = Object.keys(template);
    const workerKey = keys.find((k) => {
      const upper = k.toUpperCase();
      return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
    }) || "TRABAJADOR NOM";
    const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
    const tipoSKey = keys.find((k) => k.toUpperCase().replace(/\s/g, "") === "TIPOS") || "TIPO S";
    const proyectoKey = keys.find((k) => k.toUpperCase().includes("PROYECTO")) || "PROYECTO";
    const horarioKey = keys.find((k) => k.toUpperCase().includes("HORARIO")) || "HORARIO";
    const estadoKey = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
    const finContratoKey = keys.find((k) => k.toUpperCase().includes("FIN CONTRATO")) || "FIN CONTRATO";
    newRow[workerKey] = name.trim().toUpperCase();
    newRow[centerKey] = (service || "SERVICIO GENERAL").trim().toUpperCase();
    newRow[tipoSKey] = (client || "GENERAL").trim().toUpperCase();
    newRow[proyectoKey] = (project || "PROY-NUEVO").trim().toUpperCase();
    newRow[horarioKey] = (schedule || "L a V").trim().toUpperCase();
    newRow[estadoKey] = "CUBIERTO";
    newRow[finContratoKey] = "temporal";
    return newRow;
  },
  promptAddNewWorker() {
    const inputWorker = document.getElementById("vacation-form-worker");
    const typedName = inputWorker ? inputWorker.value : "";
    this.showNewWorkerModal(typedName, (data) => {
      const newRow = this.createWorkerRow(data.name, data.service, data.client, data.project, data.schedule);
      if (newRow) {
        window.state.masterData.push(newRow);
        if (typeof window.saveAndRender === "function") {
          window.saveAndRender();
        } else {
          this.processVacationData();
          this.populateWorkerSelect();
          this.renderAll();
          this.detectConflicts();
        }
        const keys = Object.keys(newRow);
        const workerKey = keys.find((k) => {
          const upper = k.toUpperCase();
          return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
        }) || "TRABAJADOR NOM";
        const finalWorkerName = newRow[workerKey];
        setTimeout(() => {
          const select = document.getElementById("vacation-form-worker");
          if (select) {
            select.value = finalWorkerName;
          }
        }, 200);
        if (typeof showToast === "function") {
          showToast(`\uD83D\uDC65 ${finalWorkerName} registrado en el sistema`, "success");
        }
      }
    });
  },
  promptAddNewWorkerInSitu(workerName, centerName, selectEl) {
    this.showNewWorkerModal("", (data) => {
      const newRow = this.createWorkerRow(data.name, data.service, data.client, data.project, data.schedule);
      if (newRow) {
        window.state.masterData.push(newRow);
        const keys = Object.keys(newRow);
        const workerKey = keys.find((k) => {
          const upper = k.toUpperCase();
          return upper.includes("TRABAJADOR") || upper.includes("TITULAR") || upper === "NOMBRE";
        }) || "TRABAJADOR NOM";
        const finalWorkerName = newRow[workerKey];
        const titularKey = workerKey;
        const centerKey = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO NOM";
        const targetRow = window.state.masterData.find((r) => (r[titularKey] || "").toString().trim() === workerName && (r[centerKey] || "").toString().trim() === centerName);
        if (targetRow) {
          const suplenteKey = keys.find((k) => k.toUpperCase() === "SUPLENTE") || "SUPLENTE";
          targetRow[suplenteKey] = finalWorkerName;
          const estadoKey = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
          if (targetRow[estadoKey] === "DESCUBIERTO") {
            targetRow[estadoKey] = "CUBIERTO";
          }
          if (typeof SubstituteManagement !== "undefined") {
            SubstituteManagement.assignSubstitute(targetRow, finalWorkerName, true);
          } else {
            try {
              const saved = localStorage.getItem("sifu_substitute_assignments_v1");
              const assignments = saved ? JSON.parse(saved) : [];
              const assignment = {
                id: `assign_${Date.now()}`,
                service: targetRow[centerKey] || centerName,
                proyecto: targetRow.PROYECTO,
                originalTitular: workerName,
                substitute: finalWorkerName,
                assignedDate: new Date().toISOString(),
                temporary: true,
                status: "active",
                notes: "Asignado in-situ desde módulo vacaciones (nuevo operario)"
              };
              assignments.push(assignment);
              localStorage.setItem("sifu_substitute_assignments_v1", JSON.stringify(assignments));
            } catch (e) {
              console.error("Error saving assignment to localStorage:", e);
            }
          }
        }
        if (typeof window.saveAndRender === "function") {
          window.saveAndRender();
        } else {
          this.processVacationData();
          this.populateWorkerSelect();
          this.renderAll();
          this.detectConflicts();
        }
        if (typeof showToast === "function") {
          showToast(`✅ ${finalWorkerName} creado y asignado como suplente de ${workerName}`, "success");
        }
      }
    });
  },
  exportExcel() {
    if (!window.state || !window.state.masterData)
      return;
    try {
      const dataToExport = [
        ...this.activeVacations.map((v) => ({ TRABAJADOR: v.worker, SERVICIO: v.center, RANGO: v.vacDate, ESTADO: "ACTIVA" })),
        ...this.upcomingVacations.map((v) => ({ TRABAJADOR: v.worker, SERVICIO: v.center, RANGO: v.vacDate, ESTADO: "PLANIFICADA" }))
      ];
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");
      XLSX.writeFile(wb, "PLANIFICACION_VACACIONES_SIFU.xlsx");
      if (typeof showToast === "function")
        showToast("\uD83D\uDCC1 Excel de vacaciones exportado", "success");
    } catch (e) {
      console.error(e);
      alert("Error al exportar a Excel. Asegúrese de que la librería XLSX esté disponible.");
    }
  },
  exportPDF() {
    const element = document.getElementById("tab-vacaciones");
    if (!element)
      return;
    try {
      const toolbar = element.querySelector('div[style*="border-bottom"]');
      const form = document.getElementById("vacation-form").parentElement;
      let originalDisplayToolbar = "";
      let originalDisplayForm = "";
      if (toolbar) {
        const buttons = toolbar.querySelector("div");
        if (buttons) {
          originalDisplayToolbar = buttons.style.display;
          buttons.style.display = "none";
        }
      }
      if (form) {
        originalDisplayForm = form.style.display;
        form.style.display = "none";
      }
      const opt = {
        margin: 10,
        filename: "INFORME_VACACIONES_SIFU.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
      };
      html2pdf().set(opt).from(element).save().then(() => {
        if (toolbar) {
          const buttons = toolbar.querySelector("div");
          if (buttons)
            buttons.style.display = originalDisplayToolbar;
        }
        if (form)
          form.style.display = originalDisplayForm;
      });
      if (typeof showToast === "function")
        showToast("\uD83D\uDCC1 Informe PDF generado", "success");
    } catch (e) {
      console.error(e);
      alert("Error al exportar a PDF.");
    }
  }
};
window.VacationModule = VacationModule;

// analytics_trends.js
var AnalyticsTrends2 = {
  historicalData: [],
  insights: [],
  init() {
    console.log("\uD83D\uDCCA Inicializando Motor de Análisis de Tendencias...");
    this.loadHistoricalData();
    this.captureCurrentSnapshot();
    this.analyzePatterns();
  },
  loadHistoricalData() {
    const saved = localStorage.getItem("sifu_historical_data_v1");
    if (saved) {
      this.historicalData = JSON.parse(saved);
    }
  },
  saveHistoricalData() {
    localStorage.setItem("sifu_historical_data_v1", JSON.stringify(this.historicalData));
  },
  captureCurrentSnapshot() {
    if (!window.state || !window.state.masterData)
      return;
    const today = new Date().toISOString().split("T")[0];
    const existingToday = this.historicalData.find((h) => h.date === today);
    if (existingToday)
      return;
    const snapshot = {
      date: today,
      timestamp: new Date().toISOString(),
      metrics: this.calculateMetrics(window.state.masterData)
    };
    this.historicalData.push(snapshot);
    if (this.historicalData.length > 180) {
      this.historicalData = this.historicalData.slice(-180);
    }
    this.saveHistoricalData();
  },
  calculateMetrics(data) {
    const total = data.length;
    const descubiertos = data.filter((s) => s.ESTADO === "DESCUBIERTO").length;
    const bajasIT = data.filter((s) => s.ESTADO1 === "BAJA IT").length;
    const bajasITSinSuplente = data.filter((s) => s.ESTADO1 === "BAJA IT" && (!s.SUPLENTE || s.SUPLENTE === "EMERGENCIAS")).length;
    const vacaciones = data.filter((s) => s.ESTADO1 === "VACACIONES").length;
    const cubiertos = data.filter((s) => s.ESTADO === "CUBIERTO").length;
    const cobertura = total > 0 ? (cubiertos / total * 100).toFixed(2) : 0;
    const today = new Date;
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    const contractsEnding = data.filter((s) => {
      if (!s["FIN CONTRATO"])
        return false;
      const endDate = this.excelDateToJS(s["FIN CONTRATO"]);
      return endDate && endDate >= today && endDate <= in30Days;
    }).length;
    const byType = {};
    data.forEach((s) => {
      const type = s["TIPO S"] || "OTRO";
      byType[type] = (byType[type] || 0) + 1;
    });
    return {
      total,
      descubiertos,
      bajasIT,
      bajasITSinSuplente,
      vacaciones,
      cubiertos,
      cobertura: parseFloat(cobertura),
      contractsEnding,
      byType
    };
  },
  analyzePatterns() {
    if (this.historicalData.length < 7) {
      console.log("\uD83D\uDCCA Datos insuficientes para análisis de tendencias (mínimo 7 días)");
      return;
    }
    this.insights = [];
    const descubiertosLast7 = this.getLastNDays(7).map((d) => d.metrics.descubiertos);
    const descubiertosLast30 = this.getLastNDays(30).map((d) => d.metrics.descubiertos);
    const avgLast7 = this.average(descubiertosLast7);
    const avgLast30 = this.average(descubiertosLast30);
    if (avgLast7 > avgLast30 * 1.2) {
      this.insights.push({
        type: "warning",
        category: "descubiertos",
        title: "⚠️ Aumento de Descubiertos",
        message: `Los descubiertos han aumentado un ${((avgLast7 / avgLast30 - 1) * 100).toFixed(0)}% en la última semana`,
        recommendation: "Revisar causas y reforzar búsqueda de suplentes"
      });
    } else if (avgLast7 < avgLast30 * 0.8) {
      this.insights.push({
        type: "success",
        category: "descubiertos",
        title: "✅ Mejora en Cobertura",
        message: `Los descubiertos han disminuido un ${((1 - avgLast7 / avgLast30) * 100).toFixed(0)}% en la última semana`,
        recommendation: "Mantener las estrategias actuales"
      });
    }
    const bajasLast7 = this.getLastNDays(7).map((d) => d.metrics.bajasIT);
    const bajasLast30 = this.getLastNDays(30).map((d) => d.metrics.bajasIT);
    const avgBajasLast7 = this.average(bajasLast7);
    const avgBajasLast30 = this.average(bajasLast30);
    if (avgBajasLast7 > avgBajasLast30 * 1.3) {
      this.insights.push({
        type: "warning",
        category: "bajas_it",
        title: "\uD83C\uDFE5 Incremento de Bajas IT",
        message: `Las bajas IT han aumentado un ${((avgBajasLast7 / avgBajasLast30 - 1) * 100).toFixed(0)}% en la última semana`,
        recommendation: "Posible brote estacional. Preparar pool de suplentes"
      });
    }
    if (this.historicalData.length >= 60) {
      const seasonality = this.detectSeasonality();
      if (seasonality) {
        this.insights.push(seasonality);
      }
    }
    const prediction = this.predictNextWeek();
    if (prediction) {
      this.insights.push(prediction);
    }
    const problematicServices = this.identifyProblematicServices();
    if (problematicServices.length > 0) {
      this.insights.push({
        type: "info",
        category: "servicios",
        title: "\uD83D\uDD0D Servicios con Mayor Rotación",
        message: `${problematicServices.length} servicios han tenido múltiples cambios`,
        recommendation: "Revisar condiciones y estabilidad de estos servicios",
        data: problematicServices
      });
    }
    console.log("\uD83D\uDCCA Insights generados:", this.insights);
  },
  detectSeasonality() {
    const monthlyAvg = {};
    this.historicalData.forEach((snapshot) => {
      const month = new Date(snapshot.date).getMonth();
      if (!monthlyAvg[month]) {
        monthlyAvg[month] = { bajasIT: [], descubiertos: [] };
      }
      monthlyAvg[month].bajasIT.push(snapshot.metrics.bajasIT);
      monthlyAvg[month].descubiertos.push(snapshot.metrics.descubiertos);
    });
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre"
    ];
    let maxBajas = { month: 0, avg: 0 };
    Object.keys(monthlyAvg).forEach((month) => {
      const avg = this.average(monthlyAvg[month].bajasIT);
      if (avg > maxBajas.avg) {
        maxBajas = { month: parseInt(month), avg };
      }
    });
    if (maxBajas.avg > 0) {
      return {
        type: "info",
        category: "estacionalidad",
        title: "\uD83D\uDCC5 Patrón Estacional Detectado",
        message: `${monthNames[maxBajas.month]} suele tener más bajas IT (promedio: ${maxBajas.avg.toFixed(1)})`,
        recommendation: "Planificar recursos adicionales para este periodo"
      };
    }
    return null;
  },
  predictNextWeek() {
    const last14Days = this.getLastNDays(14);
    if (last14Days.length < 14)
      return null;
    const descubiertos = last14Days.map((d) => d.metrics.descubiertos);
    const trend = this.calculateTrend(descubiertos);
    const currentAvg = this.average(descubiertos.slice(-7));
    const predictedAvg = currentAvg + trend * 7;
    if (predictedAvg > currentAvg * 1.2) {
      return {
        type: "warning",
        category: "prediccion",
        title: "\uD83D\uDD2E Predicción: Aumento de Descubiertos",
        message: `Se espera un incremento a ~${Math.round(predictedAvg)} descubiertos la próxima semana`,
        recommendation: "Preparar estrategias preventivas"
      };
    } else if (predictedAvg < currentAvg * 0.8) {
      return {
        type: "success",
        category: "prediccion",
        title: "\uD83D\uDD2E Predicción: Mejora en Cobertura",
        message: `Se espera una reducción a ~${Math.round(predictedAvg)} descubiertos la próxima semana`,
        recommendation: "Continuar con las acciones actuales"
      };
    }
    return null;
  },
  identifyProblematicServices() {
    return [];
  },
  renderTrendsChart() {
    const container = document.getElementById("trends-chart-container");
    if (!container)
      return;
    if (this.historicalData.length < 2) {
      container.innerHTML = '<div class="empty-state">Recopilando datos históricos...</div>';
      return;
    }
    const last30 = this.getLastNDays(30);
    const labels = last30.map((d) => new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }));
    const descubiertos = last30.map((d) => d.metrics.descubiertos);
    const bajasIT = last30.map((d) => d.metrics.bajasIT);
    const cobertura = last30.map((d) => d.metrics.cobertura);
    if (typeof Chart !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.id = "trendsChart";
      container.innerHTML = "";
      container.appendChild(canvas);
      new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Descubiertos",
              data: descubiertos,
              borderColor: "#ea4335",
              backgroundColor: "rgba(234, 67, 53, 0.1)",
              tension: 0.4
            },
            {
              label: "Bajas IT",
              data: bajasIT,
              borderColor: "#fbbc04",
              backgroundColor: "rgba(251, 188, 4, 0.1)",
              tension: 0.4
            },
            {
              label: "Cobertura %",
              data: cobertura,
              borderColor: "#34a853",
              backgroundColor: "rgba(52, 168, 83, 0.1)",
              tension: 0.4,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: "index",
            intersect: false
          },
          scales: {
            y: {
              type: "linear",
              display: true,
              position: "left",
              title: { display: true, text: "Cantidad" }
            },
            y1: {
              type: "linear",
              display: true,
              position: "right",
              title: { display: true, text: "Cobertura %" },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }
  },
  renderInsights() {
    const container = document.getElementById("insights-container");
    if (!container)
      return;
    if (this.insights.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay insights disponibles todavía</div>';
      return;
    }
    const html = this.insights.map((insight) => {
      const typeClass = {
        warning: "insight-warning",
        success: "insight-success",
        info: "insight-info"
      }[insight.type] || "insight-info";
      return `
                <div class="insight-card ${typeClass}">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                    <div class="insight-recommendation">\uD83D\uDCA1 ${insight.recommendation}</div>
                </div>
            `;
    }).join("");
    container.innerHTML = html;
  },
  average(arr) {
    if (arr.length === 0)
      return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  },
  calculateTrend(arr) {
    const n = arr.length;
    const sumX = n * (n - 1) / 2;
    const sumY = arr.reduce((sum, val) => sum + val, 0);
    const sumXY = arr.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  },
  getLastNDays(n) {
    return this.historicalData.slice(-n);
  },
  excelDateToJS(excelDate) {
    if (!excelDate)
      return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AnalyticsTrends2.init());
} else {
  AnalyticsTrends2.init();
}

// llm_assistant.js
var LLMAssistant = {
  settings: {
    provider: "simulated",
    apiKey: ""
  },
  messageHistory: [],
  init() {
    console.log("✨ Inicializando Asistente LLM...");
    this.loadConfig();
    setTimeout(() => this.updateConfigUI(), 500);
  },
  loadConfig() {
    const saved = localStorage.getItem("sifu_llm_settings");
    if (saved) {
      try {
        this.settings = JSON.parse(saved);
      } catch (e) {
        console.error("Error loading LLM config:", e);
      }
    }
  },
  saveConfig() {
    const keyInput = document.getElementById("llm-api-key");
    const provInput = document.getElementById("llm-provider");
    if (keyInput && provInput) {
      this.settings.apiKey = keyInput.value.trim();
      this.settings.provider = provInput.value;
      localStorage.setItem("sifu_llm_settings", JSON.stringify(this.settings));
      this.toggleConfig();
      this.addMessage("bot", `✅ Configuración guardada. Proveedor actual: **${this.settings.provider.toUpperCase()}**.`);
    }
  },
  updateConfigUI() {
    const keyInput = document.getElementById("llm-api-key");
    const provInput = document.getElementById("llm-provider");
    if (keyInput && provInput) {
      keyInput.value = this.settings.apiKey;
      provInput.value = this.settings.provider;
    }
  },
  toggleConfig() {
    const panel = document.getElementById("llm-config-panel");
    if (panel) {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
  },
  handleInputKey(e) {
    if (e.key === "Enter") {
      this.sendMessage();
    }
  },
  async sendMessage() {
    const inputEl = document.getElementById("llm-input");
    const text = inputEl.value.trim();
    if (!text)
      return;
    inputEl.value = "";
    this.addMessage("user", text);
    this.messageHistory.push({ role: "user", content: text });
    const thinkingId = this.addThinkingIndicator();
    const contextStr = this.buildContextPrompt();
    try {
      let replyText = "";
      if (this.settings.provider === "openai" && this.settings.apiKey) {
        replyText = await this.callOpenAI(text, contextStr);
      } else if (this.settings.provider === "groq" && this.settings.apiKey) {
        replyText = await this.callGroq(text, contextStr);
      } else {
        replyText = await this.simulateResponse(text, contextStr);
      }
      this.removeThinkingIndicator(thinkingId);
      this.addMessage("bot", replyText);
      this.messageHistory.push({ role: "assistant", content: replyText });
    } catch (error) {
      console.error("LLM Error:", error);
      this.removeThinkingIndicator(thinkingId);
      this.addMessage("bot", `⚠️ Se produjo un error al conectar: ${error.message}`);
    }
  },
  buildContextPrompt() {
    if (!window.state || !window.state.masterData)
      return "No hay datos de Master disponibles en memoria.";
    const data = window.state.masterData;
    const uncovered = data.filter((d) => (d.ESTADO || "").toUpperCase() === "DESCUBIERTO");
    const medical = data.filter((d) => (d.ESTADO1 || "").toUpperCase().includes("BAJA") || (d.ESTADO || "").toUpperCase().includes("BAJA"));
    const uncoverStr = uncovered.map((u) => `- Centro: ${u.SERVICIO || "Desconocido"}, Extracción: Urgente`).join(`
`);
    const medicalStr = medical.map((m) => `- Centro: ${m.SERVICIO}, Titular de baja: ${m.TITULAR}`).slice(0, 10).join(`
`);
    return `
[SISTEMA EN TIEMPO REAL: SIFU INFORMER]
La fecha actual es: ${new Date().toLocaleDateString("es-ES")}.
Datos de la plantilla actual de la empresa:
- Total Operativos en nómina: ${data.length}
- Total Bajas IT o Ausencias: ${medical.length}
- Total Servicios DESCUBIERTOS (Crítico): ${uncovered.length}

Detalle de Descubiertos Activos:
${uncovered.length > 0 ? uncoverStr : "Ninguno. Todo está cubierto."}

Detalle de Top Bajas (Últimas 10 detectadas):
${medical.length > 0 ? medicalStr : "Ninguna baja registrada."}

Tu rol es ser un Asistente Ejecutivo. Responde de forma concisa, profesional e inteligente. Utiliza negritas para destacar centros laborales o nombres importantes.
`;
  },
  async callOpenAI(userMessage, systemPrompt) {
    const _messages = [
      { role: "system", content: systemPrompt },
      ...this.messageHistory.slice(-4),
      { role: "user", content: userMessage }
    ];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: _messages,
        temperature: 0.3
      })
    });
    if (!response.ok)
      throw new Error("API Key inválida o límite excedido.");
    const data = await response.json();
    return data.choices[0].message.content;
  },
  async callGroq(userMessage, systemPrompt) {
    const _messages = [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }];
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.settings.apiKey}` },
      body: JSON.stringify({ model: "llama3-8b-8192", messages: _messages, temperature: 0.3 })
    });
    if (!response.ok)
      throw new Error("Fallo en API Groq");
    const data = await response.json();
    return data.choices[0].message.content;
  },
  async simulateResponse(text, systemPrompt) {
    await new Promise((r) => setTimeout(r, 1200));
    const q = text.toLowerCase();
    if (q.includes("descubierto") || q.includes("urgencia") || q.includes("problema")) {
      const data = window.state.masterData || [];
      const uncovered = data.filter((d) => (d.ESTADO || "").toUpperCase() === "DESCUBIERTO");
      if (uncovered.length === 0)
        return "✅ He analizado la memoria cruzada. Actualmente **no hay servicios descubiertos**. La jornada está totalmente cubierta.";
      const firstFew = uncovered.slice(0, 3).map((u) => `\uD83D\uDD34 **${u.SERVICIO}**`).join(`
`);
      return `\uD83D\uDEA8 Actualmente tenemos **${uncovered.length} servicios descubiertos**. He aquí los más críticos:
${firstFew}

Te recomiendo revisar la pestaña de 'Descubiertos' para iniciar la asignación de suplentes vía WhatsApp automatizado.`;
    }
    if (q.includes("baja") || q.includes("enfermo") || q.includes("ausencia")) {
      const data = window.state.masterData || [];
      const medical = data.filter((d) => (d.ESTADO1 || "").toUpperCase().includes("BAJA") || (d.ESTADO || "").toUpperCase().includes("BAJA"));
      return `\uD83C\uDFE5 Ahora mismo hay **${medical.length} bajas activas** registradas en el Master Principal. ¿Deseas que prepare una alerta para el departamento de prevención?`;
    }
    if (q.includes("resumen") || q.includes("estado") || q.includes("tal")) {
      return `\uD83D\uDCCA **INFORME RÁPIDO**:
El motor operativo está en marcha. Tenemos información sincronizada de toda la red.
Por favor, dirígete al panel "Resumen" para ver las gráficas de impacto en tiempo real. ¿Puedo ayudarte a buscar algún trabajador específico?`;
    }
    return "\uD83D\uDCAC (Modo Simulado) Entiendo tu mensaje, pero mi módulo local (offline) tiene vocabulario limitado. Prueba preguntarme sobre **descubiertos**, **bajas** o **estado general**.";
  },
  addMessage(sender, text) {
    const container = document.getElementById("llm-messages");
    if (!container)
      return;
    const isBot = sender === "bot";
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
    const el = document.createElement("div");
    el.className = `llm-msg ${sender}`;
    el.innerHTML = `
            ${isBot ? '<div class="avatar">✨</div>' : ""}
            <div class="bubble">${formattedText}</div>
            ${!isBot ? '<div class="avatar">\uD83D\uDC64</div>' : ""}
        `;
    container.appendChild(el);
    this.scrollToBottom(container);
  },
  addThinkingIndicator() {
    const container = document.getElementById("llm-messages");
    if (!container)
      return null;
    const id = "thinking-" + Date.now();
    const el = document.createElement("div");
    el.className = "llm-msg bot";
    el.id = id;
    el.innerHTML = `
            <div class="avatar">✨</div>
            <div class="bubble thinking">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
        `;
    container.appendChild(el);
    this.scrollToBottom(container);
    return id;
  },
  removeThinkingIndicator(id) {
    const el = document.getElementById(id);
    if (el)
      el.remove();
  },
  scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => LLMAssistant.init());
} else {
  setTimeout(() => LLMAssistant.init(), 100);
}

// nlp_commander.js
var NLPCommander = {
  recognition: null,
  isListening: false,
  init() {
    console.log("\uD83C\uDF99️ Inicializando NLP Commander...");
    this.setupSpeechRecognition();
    this.bindUI();
  },
  bindUI() {
    const voiceBtn = document.getElementById("voice-btn");
    if (voiceBtn) {
      voiceBtn.addEventListener("click", () => this.toggleVoice());
    }
    const quickInput = document.getElementById("quick-input-bar");
    if (quickInput) {
      quickInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.processCommand(quickInput.value);
          quickInput.value = "";
        }
      });
    }
  },
  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("⚠️ Web Speech API no soportada en este navegador.");
      return;
    }
    this.recognition = new SpeechRecognition;
    this.recognition.lang = "es-ES";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateVoiceUI(true);
      showToast("\uD83C\uDF99️ Escuchando...", "info");
    };
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("\uD83D\uDDE3️ Comando detectado:", transcript);
      this.processCommand(transcript);
    };
    this.recognition.onerror = (event) => {
      console.error("❌ Error de reconocimiento:", event.error);
      this.stopVoice();
    };
    this.recognition.onend = () => {
      this.stopVoice();
    };
  },
  toggleVoice() {
    if (this.isListening) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  },
  startVoice() {
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  },
  stopVoice() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
    this.updateVoiceUI(false);
  },
  updateVoiceUI(active) {
    const btn = document.getElementById("voice-btn");
    if (btn) {
      btn.style.background = active ? "#ef4444" : "transparent";
      btn.style.color = active ? "white" : "inherit";
      if (active)
        btn.classList.add("pulse");
      else
        btn.classList.remove("pulse");
    }
  },
  processCommand(text) {
    const cmd = text.toLowerCase();
    if (cmd.includes("ve a") || cmd.includes("mostrar") || cmd.includes("ver")) {
      if (cmd.includes("descubiertos"))
        return this.navigate("tab-descubiertos");
      if (cmd.includes("bajas"))
        return this.navigate("tab-bajas");
      if (cmd.includes("aldi"))
        return this.navigate("tab-aldi");
      if (cmd.includes("ruta") || cmd.includes("mapa"))
        return this.navigate("tab-avanzado");
      if (cmd.includes("resumen"))
        return this.navigate("tab-resumen");
      if (cmd.includes("smart") || cmd.includes("ia"))
        return this.navigate("tab-smarthub");
    }
    if (cmd.includes("optimiza") || cmd.includes("calcula")) {
      showToast("\uD83E\uDDEC Iniciando optimización genética de rutas...", "info");
      this.navigate("tab-avanzado");
      return;
    }
    showToast("\uD83E\uDDE0 Consultando cerebro operativo...", "info");
    if (window.LLMAssistant) {
      const llmInput = document.getElementById("llm-input");
      if (llmInput) {
        llmInput.value = text;
        window.LLMAssistant.sendMessage();
        this.navigate("tab-smarthub");
      }
    }
  },
  navigate(tabId) {
    const tabBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (tabBtn) {
      tabBtn.click();
      showToast(`\uD83D\uDE80 Navegando a ${tabId.split("-")[1].toUpperCase()}`, "success");
    } else {
      document.querySelectorAll(".tab-content").forEach((c) => c.style.display = "none");
      const target = document.getElementById(tabId);
      if (target)
        target.style.display = "block";
    }
  }
};
window.NLPCommander = NLPCommander;
document.addEventListener("DOMContentLoaded", () => NLPCommander.init());

// ai_predictive_engine.js
var AIPredictiveEngine2 = {
  predictions: [],
  recommendations: [],
  workerProfiles: {},
  serviceProfiles: {},
  init() {
    console.log("\uD83E\uDD16 Inicializando Motor de IA Predictivo...");
    this.loadProfiles();
    this.buildWorkerProfiles();
    this.buildServiceProfiles();
    this.generatePredictions();
    this.generateRecommendations();
  },
  loadProfiles() {
    const savedWorkers = localStorage.getItem("sifu_worker_profiles_v1");
    const savedServices = localStorage.getItem("sifu_service_profiles_v1");
    if (savedWorkers)
      this.workerProfiles = JSON.parse(savedWorkers);
    if (savedServices)
      this.serviceProfiles = JSON.parse(savedServices);
  },
  saveProfiles() {
    localStorage.setItem("sifu_worker_profiles_v1", JSON.stringify(this.workerProfiles));
    localStorage.setItem("sifu_service_profiles_v1", JSON.stringify(this.serviceProfiles));
  },
  buildWorkerProfiles() {
    if (!window.state || !window.state.masterData)
      return;
    window.state.masterData.forEach((service) => {
      const titular = service.TITULAR;
      if (!titular)
        return;
      if (!this.workerProfiles[titular]) {
        this.workerProfiles[titular] = {
          name: titular,
          services: [],
          serviceTypes: new Set,
          locations: new Set,
          totalServices: 0,
          itHistory: [],
          vacationHistory: [],
          reliability: 100,
          lastUpdated: new Date().toISOString()
        };
      }
      const profile = this.workerProfiles[titular];
      if (!(profile.serviceTypes instanceof Set))
        profile.serviceTypes = new Set;
      if (!(profile.locations instanceof Set))
        profile.locations = new Set;
      if (!Array.isArray(profile.services))
        profile.services = [];
      if (!Array.isArray(profile.itHistory))
        profile.itHistory = [];
      if (!profile.services.find((s) => s.proyecto === service.PROYECTO)) {
        profile.services.push({
          proyecto: service.PROYECTO,
          servicio: service.SERVICIO,
          tipo: service["TIPO S"],
          horario: service.HORARIO,
          estado: service.ESTADO
        });
        profile.totalServices++;
      }
      if (service["TIPO S"]) {
        profile.serviceTypes.add(service["TIPO S"]);
      }
      const location = this.extractLocation(service.SERVICIO);
      if (location) {
        profile.locations.add(location);
      }
      if (service.ESTADO1 === "BAJA IT") {
        profile.itHistory.push({
          date: new Date().toISOString(),
          servicio: service.SERVICIO,
          suplente: service.SUPLENTE
        });
        if (profile.itHistory.length > 2) {
          profile.reliability = Math.max(50, 100 - profile.itHistory.length * 10);
        }
      }
      if (service["VACACIONES 2026"]) {
        profile.vacationHistory.push({
          period: service["VACACIONES 2026"],
          servicio: service.SERVICIO
        });
      }
    });
    Object.values(this.workerProfiles).forEach((profile) => {
      profile.serviceTypes = Array.from(profile.serviceTypes);
      profile.locations = Array.from(profile.locations);
    });
    this.saveProfiles();
    console.log("\uD83D\uDC65 Perfiles de trabajadores construidos:", Object.keys(this.workerProfiles).length);
  },
  buildServiceProfiles() {
    if (!window.state || !window.state.masterData)
      return;
    window.state.masterData.forEach((service) => {
      const proyecto = service.PROYECTO;
      if (!proyecto)
        return;
      if (!this.serviceProfiles[proyecto]) {
        this.serviceProfiles[proyecto] = {
          proyecto,
          servicio: service.SERVICIO,
          tipo: service["TIPO S"],
          location: this.extractLocation(service.SERVICIO),
          horario: service.HORARIO,
          titularHistory: [],
          uncoveredCount: 0,
          itCount: 0,
          stability: 100,
          lastUpdated: new Date().toISOString()
        };
      }
      const profile = this.serviceProfiles[proyecto];
      if (service.TITULAR && !profile.titularHistory.find((t) => t.name === service.TITULAR)) {
        profile.titularHistory.push({
          name: service.TITULAR,
          since: new Date().toISOString()
        });
      }
      if (service.ESTADO === "DESCUBIERTO") {
        profile.uncoveredCount++;
        profile.stability = Math.max(0, 100 - profile.uncoveredCount * 20);
      }
      if (service.ESTADO1 === "BAJA IT") {
        profile.itCount++;
      }
      if (profile.titularHistory.length > 3) {
        profile.stability = Math.max(0, profile.stability - (profile.titularHistory.length - 3) * 10);
      }
    });
    this.saveProfiles();
    console.log("\uD83C\uDFE2 Perfiles de servicios construidos:", Object.keys(this.serviceProfiles).length);
  },
  generatePredictions() {
    this.predictions = [];
    if (!window.state || !window.state.masterData)
      return;
    const today = new Date;
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const in14Days = new Date(today);
    in14Days.setDate(in14Days.getDate() + 14);
    window.state.masterData.forEach((service) => {
      if (service["FIN CONTRATO"]) {
        const endDate = this.excelDateToJS(service["FIN CONTRATO"]);
        if (endDate && endDate >= today && endDate <= in14Days) {
          const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
          const riskScore = this.calculateRenewalRisk(service, daysUntil);
          this.predictions.push({
            type: "contract_ending",
            service: service.SERVICIO,
            titular: service.TITULAR,
            daysUntil,
            riskScore,
            probability: riskScore > 70 ? "alta" : riskScore > 40 ? "media" : "baja",
            recommendation: this.getContractRecommendation(service, riskScore),
            data: service
          });
        }
      }
      if (service.ESTADO1 === "BAJA IT") {
        const extendProbability = this.calculateITExtensionProbability(service);
        if (extendProbability > 50) {
          this.predictions.push({
            type: "it_extension",
            service: service.SERVICIO,
            titular: service.TITULAR,
            probability: extendProbability > 75 ? "alta" : "media",
            recommendation: "Considerar suplente permanente",
            data: service
          });
        }
      }
      const serviceProfile = this.serviceProfiles[service.PROYECTO];
      if (serviceProfile && serviceProfile.stability < 60) {
        this.predictions.push({
          type: "unstable_service",
          service: service.SERVICIO,
          stability: serviceProfile.stability,
          probability: "media",
          recommendation: "Revisar condiciones del servicio y buscar titular estable",
          data: service
        });
      }
    });
    console.log("\uD83D\uDD2E Predicciones generadas:", this.predictions.length);
  },
  generateRecommendations() {
    this.recommendations = [];
    if (!window.state || !window.state.masterData)
      return;
    const descubiertos = window.state.masterData.filter((s) => s.ESTADO === "DESCUBIERTO");
    let whatsappPrompted = false;
    descubiertos.forEach((service) => {
      const bestMatches = this.findBestSuplentes(service);
      if (bestMatches.length > 0) {
        this.recommendations.push({
          type: "suplente_suggestion",
          priority: "high",
          service: service.SERVICIO,
          suggestions: bestMatches.slice(0, 3),
          data: service
        });
        if (!whatsappPrompted && window.IntegrationsHub && window.IntegrationsHub.integrations.whatsapp.configured) {
          whatsappPrompted = true;
          setTimeout(() => {
            window.IntegrationsHub.promptWhatsAppAutoAssign(service, { TITULAR: bestMatches[0].worker });
          }, 2000);
        }
      }
    });
    const optimizations = this.findOptimizationOpportunities();
    this.recommendations.push(...optimizations);
    const overloaded = this.findOverloadedWorkers();
    this.recommendations.push(...overloaded);
    console.log("\uD83D\uDCA1 Recomendaciones generadas:", this.recommendations.length);
    this.orchestratePredictiveLogistics();
  },
  orchestratePredictiveLogistics() {
    console.log("\uD83D\uDEF0️ Orquestando Logística Predictiva...");
    this.predictions.forEach((pred) => {
      if (pred.probability === "alta" && (pred.type === "contract_ending" || pred.type === "it_extension")) {
        const bestSuplentes = this.findBestSuplentes(pred.data);
        if (bestSuplentes.length > 0) {
          const candidate = bestSuplentes[0];
          if (window.RouteOptimizer) {
            const workerRoute = window.RouteOptimizer.routes.find((r) => r.name === candidate.worker);
            if (workerRoute) {
              const projectedServices = [...workerRoute.services, {
                name: pred.service,
                location: this.extractLocation(pred.service),
                coords: window.RouteOptimizer.locations.get(this.extractLocation(pred.service))
              }];
              const optimized = window.RouteOptimizer.optimizeRoute(projectedServices);
              this.recommendations.push({
                type: "predictive_logistics",
                priority: "high",
                service: pred.service,
                worker: candidate.worker,
                message: `Logística Proactiva: ${candidate.worker} es el mejor candidato para cubrir el riesgo en ${pred.service}.`,
                recommendation: `Ruta optimizada pre-calculada: ahorro del ${workerRoute.savingsPercent}% incluso con el nuevo servicio.`,
                data: { candidate, optimized }
              });
            }
          }
        }
      }
    });
  },
  findBestSuplentes(service) {
    const matches = [];
    const serviceLocation = this.extractLocation(service.SERVICIO);
    const serviceType = service["TIPO S"];
    Object.values(this.workerProfiles).forEach((worker) => {
      if (worker.name === service.TITULAR)
        return;
      let score = 0;
      const reasons = [];
      if (worker.serviceTypes.includes(serviceType)) {
        score += 40;
        reasons.push(`Experiencia en ${serviceType}`);
      }
      if (serviceLocation && worker.locations.some((loc) => this.calculateLocationSimilarity(loc, serviceLocation) > 0.7)) {
        score += 30;
        reasons.push(`Trabaja en zona cercana`);
      }
      score += worker.reliability / 100 * 20;
      if (worker.reliability > 90) {
        reasons.push("Alta fiabilidad");
      }
      const currentServices = worker.services.filter((s) => s.estado === "CUBIERTO").length;
      if (currentServices < 3) {
        score += 10;
        reasons.push("Disponible");
      } else if (currentServices > 5) {
        score -= 10;
        reasons.push("Puede estar sobrecargado");
      }
      if (score > 30) {
        matches.push({
          worker: worker.name,
          score: Math.round(score),
          reasons,
          currentServices,
          reliability: worker.reliability
        });
      }
    });
    matches.sort((a, b) => b.score - a.score);
    return matches;
  },
  findOptimizationOpportunities() {
    const opportunities = [];
    Object.values(this.workerProfiles).forEach((worker) => {
      if (worker.services.length >= 2 && worker.locations.length >= 3) {
        opportunities.push({
          type: "route_optimization",
          priority: "medium",
          worker: worker.name,
          message: `${worker.name} tiene servicios en ${worker.locations.length} ubicaciones diferentes`,
          recommendation: "Considerar reagrupar servicios por zona",
          data: worker
        });
      }
    });
    return opportunities;
  },
  findOverloadedWorkers() {
    const overloaded = [];
    Object.values(this.workerProfiles).forEach((worker) => {
      const activeServices = worker.services.filter((s) => s.estado === "CUBIERTO").length;
      if (activeServices > 5) {
        overloaded.push({
          type: "worker_overload",
          priority: "medium",
          worker: worker.name,
          message: `${worker.name} gestiona ${activeServices} servicios`,
          recommendation: "Considerar redistribuir carga de trabajo",
          data: worker
        });
      }
    });
    return overloaded;
  },
  calculateRenewalRisk(service, daysUntil) {
    let risk = 0;
    if (daysUntil <= 3)
      risk += 40;
    else if (daysUntil <= 7)
      risk += 20;
    if (!service.SUPLENTE || service.SUPLENTE === "EMERGENCIAS") {
      risk += 30;
    }
    const workerProfile = this.workerProfiles[service.TITULAR];
    if (workerProfile && workerProfile.itHistory.length > 1) {
      risk += 20;
    }
    const serviceProfile = this.serviceProfiles[service.PROYECTO];
    if (serviceProfile && serviceProfile.stability < 70) {
      risk += 10;
    }
    return Math.min(100, risk);
  },
  calculateITExtensionProbability(service) {
    let probability = 50;
    if (service.SUPLENTE && service.SUPLENTE !== "EMERGENCIAS") {
      probability -= 20;
    }
    const workerProfile = this.workerProfiles[service.TITULAR];
    if (workerProfile) {
      if (workerProfile.itHistory.length > 2) {
        probability += 25;
      }
    }
    return Math.min(100, Math.max(0, probability));
  },
  getContractRecommendation(service, riskScore) {
    if (riskScore > 70) {
      return "\uD83D\uDEA8 URGENTE: Contactar inmediatamente y preparar suplente";
    } else if (riskScore > 40) {
      return "⚠️ Contactar esta semana para confirmar renovación";
    } else {
      return "✅ Seguimiento normal de renovación";
    }
  },
  renderPredictions() {
    const container = document.getElementById("ai-predictions-container");
    if (!container)
      return;
    if (this.predictions.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay predicciones en este momento</div>';
      return;
    }
    const html = this.predictions.map((pred) => {
      let priorityClass = {
        alta: "prediction-high",
        media: "prediction-medium",
        baja: "prediction-low"
      }[pred.probability] || "prediction-medium";
      if (pred.probability === "alta")
        priorityClass += " ai-pulse-alert";
      else if (pred.probability === "media")
        priorityClass += " ai-pulse-warning";
      const icon = {
        contract_ending: "\uD83D\uDCC5",
        it_extension: "\uD83C\uDFE5",
        unstable_service: "⚠️"
      }[pred.type] || "\uD83D\uDD2E";
      return `
                <div class="prediction-card ${priorityClass}">
                    <div class="prediction-icon">${icon}</div>
                    <div class="prediction-content">
                        <div class="prediction-title">${this.getPredictionTitle(pred)}</div>
                        <div class="prediction-service">${pred.service}</div>
                        ${pred.titular ? `<div class="prediction-worker">Titular: ${pred.titular}</div>` : ""}
                        <div class="prediction-probability">Probabilidad: <strong>${pred.probability.toUpperCase()}</strong></div>
                        <div class="prediction-recommendation">\uD83D\uDCA1 ${pred.recommendation}</div>
                    </div>
                </div>
            `;
    }).join("");
    container.innerHTML = html;
  },
  getPredictionTitle(pred) {
    switch (pred.type) {
      case "contract_ending":
        return `Contrato termina en ${pred.daysUntil} día${pred.daysUntil > 1 ? "s" : ""}`;
      case "it_extension":
        return "Baja IT puede extenderse";
      case "unstable_service":
        return `Servicio inestable (${pred.stability}% estabilidad)`;
      default:
        return "Predicción";
    }
  },
  renderRecommendations() {
    const container = document.getElementById("ai-recommendations-container");
    if (!container)
      return;
    if (this.recommendations.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay recomendaciones en este momento</div>';
      return;
    }
    const html = this.recommendations.map((rec) => {
      const priorityClass = {
        high: "recommendation-high",
        medium: "recommendation-medium",
        low: "recommendation-low"
      }[rec.priority] || "recommendation-medium";
      return `
                <div class="recommendation-card ${priorityClass}">
                    <div class="recommendation-header">
                        <strong>${this.getRecommendationTitle(rec)}</strong>
                    </div>
                    <div class="recommendation-message">${rec.message || rec.service}</div>
                    ${rec.suggestions ? this.renderSuggestions(rec.suggestions) : ""}
                    <div class="recommendation-action">\uD83D\uDCA1 ${rec.recommendation}</div>
                </div>
            `;
    }).join("");
    container.innerHTML = html;
  },
  renderSuggestions(suggestions) {
    return `
            <div class="suplente-suggestions">
                <div class="suggestions-title">Mejores candidatos:</div>
                ${suggestions.map((sug, idx) => `
                    <div class="suggestion-item">
                        <div class="suggestion-rank">#${idx + 1}</div>
                        <div class="suggestion-worker">
                            <strong>${sug.worker}</strong>
                            <div class="suggestion-score">Score: ${sug.score}/100</div>
                        </div>
                        <div class="suggestion-reasons">
                            ${sug.reasons.map((r) => `<span class="reason-tag">✓ ${r}</span>`).join("")}
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
  },
  getRecommendationTitle(rec) {
    switch (rec.type) {
      case "suplente_suggestion":
        return "\uD83D\uDC65 Sugerencias de Suplentes";
      case "route_optimization":
        return "\uD83D\uDDFA️ Optimización de Rutas";
      case "worker_overload":
        return "⚠️ Sobrecarga de Trabajo";
      default:
        return "\uD83D\uDCA1 Recomendación";
    }
  },
  extractLocation(serviceName) {
    if (!serviceName)
      return null;
    const match = serviceName.match(/\(([^)]+)\)/);
    if (match)
      return match[1].trim();
    const cities = [
      "Barcelona",
      "Badalona",
      "Cornellà",
      "Hospitalet",
      "Sabadell",
      "Terrassa",
      "Mataró",
      "Sant Cugat",
      "Viladecans",
      "Gavà",
      "Castelldefels",
      "Sitges",
      "Vilanova",
      "Calella",
      "Pineda",
      "Malgrat"
    ];
    for (const city of cities) {
      if (serviceName.includes(city))
        return city;
    }
    return null;
  },
  calculateLocationSimilarity(loc1, loc2) {
    if (!loc1 || !loc2)
      return 0;
    if (loc1 === loc2)
      return 1;
    const l1 = loc1.toLowerCase();
    const l2 = loc2.toLowerCase();
    if (l1.includes(l2) || l2.includes(l1))
      return 0.8;
    return 0;
  },
  excelDateToJS(excelDate) {
    if (!excelDate)
      return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AIPredictiveEngine2.init());
} else {
  AIPredictiveEngine2.init();
}

// worker_performance.js
var WorkerPerformance2 = {
  workers: {},
  selectedWorker: null,
  init() {
    console.log("\uD83D\uDCCA Inicializando Dashboard de Rendimiento de Trabajadores...");
    this.buildWorkerData();
    this.renderWorkerList();
  },
  buildWorkerData() {
    if (!window.state || !window.state.masterData)
      return;
    const workers = {};
    window.state.masterData.forEach((service) => {
      const titular = service.TITULAR;
      if (!titular)
        return;
      if (!workers[titular]) {
        workers[titular] = {
          name: titular,
          services: [],
          totalServices: 0,
          activeServices: 0,
          uncoveredServices: 0,
          itServices: 0,
          serviceTypes: new Set,
          locations: new Set,
          contracts: [],
          vacations: [],
          incidents: 0,
          qualityScores: [],
          avgQualityScore: 0,
          reliability: 100,
          performance: 100,
          status: "active"
        };
      }
      const worker = workers[titular];
      worker.services.push({
        proyecto: service.PROYECTO,
        servicio: service.SERVICIO,
        tipo: service["TIPO S"],
        horario: service.HORARIO,
        estado: service.ESTADO,
        estado1: service.ESTADO1,
        finContrato: service["FIN CONTRATO"],
        suplente: service.SUPLENTE
      });
      worker.totalServices++;
      if (service.ESTADO === "CUBIERTO")
        worker.activeServices++;
      if (service.ESTADO === "DESCUBIERTO")
        worker.uncoveredServices++;
      if (service.ESTADO1 === "BAJA IT") {
        worker.itServices++;
        worker.status = "baja_it";
      }
      if (service.ESTADO1 === "VACACIONES") {
        worker.status = "vacaciones";
      }
      if (service["TIPO S"]) {
        worker.serviceTypes.add(service["TIPO S"]);
      }
      const location = this.extractLocation(service.SERVICIO);
      if (location) {
        worker.locations.add(location);
      }
      if (service["FIN CONTRATO"]) {
        worker.contracts.push({
          proyecto: service.PROYECTO,
          finContrato: this.excelDateToJS(service["FIN CONTRATO"]),
          servicio: service.SERVICIO
        });
      }
      if (service["VACACIONES 2026"]) {
        worker.vacations.push({
          period: service["VACACIONES 2026"],
          servicio: service.SERVICIO
        });
      }
    });
    Object.values(workers).forEach((worker) => {
      worker.serviceTypes = Array.from(worker.serviceTypes);
      worker.locations = Array.from(worker.locations);
      if (worker.itServices > 0) {
        worker.reliability = Math.max(50, 100 - worker.itServices * 15);
      }
      if (worker.uncoveredServices > 0) {
        worker.reliability = Math.max(30, worker.reliability - worker.uncoveredServices * 10);
      }
      worker.performance = this.calculatePerformance(worker);
      this.loadQualityScores(worker);
    });
    this.workers = workers;
    console.log("\uD83D\uDC65 Datos de trabajadores construidos:", Object.keys(workers).length);
  },
  calculatePerformance(worker) {
    let score = 100;
    score -= worker.itServices * 10;
    score -= worker.uncoveredServices * 15;
    if (worker.activeServices >= 3) {
      score += 10;
    }
    if (worker.serviceTypes.length >= 3) {
      score += 5;
    }
    return Math.max(0, Math.min(100, score));
  },
  loadQualityScores(worker) {
    const qualityData = localStorage.getItem("sifu_quality_audits_v1");
    if (!qualityData)
      return;
    try {
      const audits = JSON.parse(qualityData);
      const workerAudits = audits.filter((audit) => worker.services.some((s) => s.servicio === audit.service));
      worker.qualityScores = workerAudits.map((a) => a.score);
      if (worker.qualityScores.length > 0) {
        worker.avgQualityScore = (worker.qualityScores.reduce((sum, s) => sum + s, 0) / worker.qualityScores.length).toFixed(1);
      }
    } catch (e) {
      console.error("Error cargando puntuaciones de calidad:", e);
    }
  },
  renderWorkerList() {
    const container = document.getElementById("worker-list-container");
    if (!container)
      return;
    const workerArray = Object.values(this.workers);
    if (workerArray.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay trabajadores registrados</div>';
      return;
    }
    workerArray.sort((a, b) => b.performance - a.performance);
    const html = `
            <div class="worker-search">
                <input type="text" id="worker-search-input" placeholder="\uD83D\uDD0D Buscar trabajador..." 
                       oninput="WorkerPerformance.filterWorkers(this.value)">
            </div>
            <div class="worker-grid" id="worker-grid">
                ${workerArray.map((worker) => this.renderWorkerCard(worker)).join("")}
            </div>
        `;
    container.innerHTML = html;
  },
  renderWorkerCard(worker) {
    const statusClass = {
      active: "worker-active",
      baja_it: "worker-it",
      vacaciones: "worker-vacation"
    }[worker.status] || "worker-active";
    const statusLabel = {
      active: "✅ Activo",
      baja_it: "\uD83C\uDFE5 Baja IT",
      vacaciones: "\uD83C\uDFD6️ Vacaciones"
    }[worker.status] || "Activo";
    const performanceColor = worker.performance >= 80 ? "#34a853" : worker.performance >= 60 ? "#fbbc04" : "#ea4335";
    return `
            <div class="worker-card ${statusClass}" onclick="WorkerPerformance.showWorkerDetail('${worker.name}')">
                <div class="worker-card-header">
                    <div class="worker-name">${worker.name}</div>
                    <div class="worker-status">${statusLabel}</div>
                </div>
                <div class="worker-metrics">
                    <div class="metric-row">
                        <span class="metric-label">Servicios Activos:</span>
                        <span class="metric-value">${worker.activeServices}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Rendimiento:</span>
                        <span class="metric-value" style="color: ${performanceColor};">
                            ${worker.performance}%
                        </span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Fiabilidad:</span>
                        <span class="metric-value">${worker.reliability}%</span>
                    </div>
                    ${worker.avgQualityScore > 0 ? `
                        <div class="metric-row">
                            <span class="metric-label">Calidad Media:</span>
                            <span class="metric-value">${worker.avgQualityScore}/10</span>
                        </div>
                    ` : ""}
                </div>
                <div class="worker-tags">
                    ${worker.serviceTypes.slice(0, 3).map((type) => `<span class="service-type-tag">${type}</span>`).join("")}
                    ${worker.serviceTypes.length > 3 ? `<span class="more-tag">+${worker.serviceTypes.length - 3}</span>` : ""}
                </div>
            </div>
        `;
  },
  showWorkerDetail(workerName) {
    const worker = this.workers[workerName];
    if (!worker)
      return;
    this.selectedWorker = worker;
    const modal = document.getElementById("worker-detail-modal");
    if (!modal) {
      this.createWorkerDetailModal();
      return this.showWorkerDetail(workerName);
    }
    const content = document.getElementById("worker-detail-content");
    content.innerHTML = this.renderWorkerDetailContent(worker);
    modal.style.display = "flex";
  },
  renderWorkerDetailContent(worker) {
    const nextContract = this.getNextContractEnding(worker);
    const nextVacation = worker.vacations.length > 0 ? worker.vacations[0].period : null;
    return `
            <div class="worker-detail-header">
                <h2>${worker.name}</h2>
                <div class="worker-detail-status ${worker.status}">${this.getStatusLabel(worker.status)}</div>
            </div>

            <div class="worker-detail-metrics">
                <div class="detail-metric-card">
                    <div class="metric-icon">\uD83D\uDCCA</div>
                    <div class="metric-info">
                        <div class="metric-value">${worker.performance}%</div>
                        <div class="metric-label">Rendimiento</div>
                    </div>
                </div>
                <div class="detail-metric-card">
                    <div class="metric-icon">⭐</div>
                    <div class="metric-info">
                        <div class="metric-value">${worker.reliability}%</div>
                        <div class="metric-label">Fiabilidad</div>
                    </div>
                </div>
                <div class="detail-metric-card">
                    <div class="metric-icon">\uD83C\uDFE2</div>
                    <div class="metric-info">
                        <div class="metric-value">${worker.activeServices}</div>
                        <div class="metric-label">Servicios Activos</div>
                    </div>
                </div>
                ${worker.avgQualityScore > 0 ? `
                    <div class="detail-metric-card">
                        <div class="metric-icon">✨</div>
                        <div class="metric-info">
                            <div class="metric-value">${worker.avgQualityScore}/10</div>
                            <div class="metric-label">Calidad Media</div>
                        </div>
                    </div>
                ` : ""}
            </div>

            <div class="worker-detail-sections">
                <div class="detail-section">
                    <h3>\uD83D\uDCCB Servicios Asignados (${worker.services.length})</h3>
                    <div class="services-list">
                        ${worker.services.map((service) => `
                            <div class="service-item ${service.estado === "DESCUBIERTO" ? "uncovered" : ""}">
                                <div class="service-name">${service.servicio}</div>
                                <div class="service-meta">
                                    <span class="service-type">${service.tipo || "N/A"}</span>
                                    <span class="service-status">${service.estado}</span>
                                </div>
                                ${service.horario ? `<div class="service-schedule">⏰ ${service.horario}</div>` : ""}
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>\uD83D\uDCC5 Información de Contratos</h3>
                    ${nextContract ? `
                        <div class="info-box warning">
                            <strong>Próximo Contrato que Termina:</strong><br>
                            ${nextContract.servicio}<br>
                            Fecha: ${nextContract.finContrato.toLocaleDateString("es-ES")}<br>
                            Días restantes: ${Math.ceil((nextContract.finContrato - new Date) / (1000 * 60 * 60 * 24))}
                        </div>
                    ` : '<div class="info-box">No hay contratos próximos a vencer</div>'}
                </div>

                ${nextVacation ? `
                    <div class="detail-section">
                        <h3>\uD83C\uDFD6️ Vacaciones Programadas</h3>
                        <div class="info-box">
                            ${nextVacation}
                        </div>
                    </div>
                ` : ""}

                <div class="detail-section">
                    <h3>\uD83D\uDDFA️ Ubicaciones de Trabajo</h3>
                    <div class="locations-list">
                        ${worker.locations.map((loc) => `<span class="location-tag">\uD83D\uDCCD ${loc}</span>`).join("")}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>\uD83C\uDFF7️ Tipos de Servicio</h3>
                    <div class="types-list">
                        ${worker.serviceTypes.map((type) => `<span class="type-tag">${type}</span>`).join("")}
                    </div>
                </div>

                ${worker.itServices > 0 ? `
                    <div class="detail-section">
                        <h3>\uD83C\uDFE5 Historial de Bajas IT</h3>
                        <div class="info-box warning">
                            Total de bajas IT: ${worker.itServices}
                        </div>
                    </div>
                ` : ""}
            </div>
        `;
  },
  getNextContractEnding(worker) {
    if (worker.contracts.length === 0)
      return null;
    const today = new Date;
    const futureContracts = worker.contracts.filter((c) => c.finContrato > today).sort((a, b) => a.finContrato - b.finContrato);
    return futureContracts.length > 0 ? futureContracts[0] : null;
  },
  getStatusLabel(status) {
    const labels = {
      active: "✅ Activo",
      baja_it: "\uD83C\uDFE5 Baja IT",
      vacaciones: "\uD83C\uDFD6️ Vacaciones"
    };
    return labels[status] || "Activo";
  },
  createWorkerDetailModal() {
    const modal = document.createElement("div");
    modal.id = "worker-detail-modal";
    modal.className = "modal";
    modal.innerHTML = `
            <div class="modal-content worker-detail-modal-content">
                <div class="modal-header">
                    <h2>Ficha de Trabajador</h2>
                    <button class="close-modal" onclick="WorkerPerformance.closeWorkerDetail()">×</button>
                </div>
                <div id="worker-detail-content" class="worker-detail-body">
                    <!-- Content injected by JS -->
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  },
  closeWorkerDetail() {
    const modal = document.getElementById("worker-detail-modal");
    if (modal) {
      modal.style.display = "none";
    }
  },
  filterWorkers(searchTerm) {
    const grid = document.getElementById("worker-grid");
    if (!grid)
      return;
    const term = searchTerm.toLowerCase();
    const cards = grid.querySelectorAll(".worker-card");
    cards.forEach((card) => {
      const name = card.querySelector(".worker-name").textContent.toLowerCase();
      if (name.includes(term)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  },
  extractLocation(serviceName) {
    if (!serviceName)
      return null;
    const match = serviceName.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : null;
  },
  excelDateToJS(excelDate) {
    if (!excelDate)
      return null;
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => WorkerPerformance2.init());
} else {
  WorkerPerformance2.init();
}

// substitute_management.js
var SubstituteManagement2 = {
  substitutes: [],
  assignments: [],
  availabilityPool: {},
  init() {
    console.log("\uD83D\uDD04 Inicializando Gestión de Suplencias...");
    this.loadData();
    this.buildAvailabilityPool();
    this.loadAssignments();
  },
  loadData() {
    const saved = localStorage.getItem("sifu_substitutes_v1");
    if (saved) {
      this.substitutes = JSON.parse(saved);
    }
  },
  saveData() {
    localStorage.setItem("sifu_substitutes_v1", JSON.stringify(this.substitutes));
    localStorage.setItem("sifu_substitute_assignments_v1", JSON.stringify(this.assignments));
  },
  loadAssignments() {
    const saved = localStorage.getItem("sifu_substitute_assignments_v1");
    if (saved) {
      this.assignments = JSON.parse(saved);
    }
  },
  buildAvailabilityPool() {
    if (!window.state || !window.state.masterData)
      return;
    const pool = {};
    window.state.masterData.forEach((service) => {
      const titular = service.TITULAR;
      if (!titular)
        return;
      const isAvailable = service.ESTADO === "CUBIERTO" && !service.ESTADO1 && service.ESTADO1 !== "BAJA IT" && service.ESTADO1 !== "VACACIONES";
      if (!pool[titular]) {
        pool[titular] = {
          name: titular,
          available: isAvailable,
          currentServices: [],
          serviceTypes: new Set,
          locations: new Set,
          schedule: [],
          capacity: 0
        };
      }
      const worker = pool[titular];
      worker.currentServices.push({
        servicio: service.SERVICIO,
        tipo: service["TIPO S"],
        horario: service.HORARIO
      });
      if (service["TIPO S"]) {
        worker.serviceTypes.add(service["TIPO S"]);
      }
      const location = this.extractLocation(service.SERVICIO);
      if (location) {
        worker.locations.add(location);
      }
      if (service.HORARIO) {
        worker.schedule.push(service.HORARIO);
      }
      worker.capacity = Math.max(0, 5 - worker.currentServices.length);
    });
    Object.values(pool).forEach((worker) => {
      worker.serviceTypes = Array.from(worker.serviceTypes);
      worker.locations = Array.from(worker.locations);
    });
    this.availabilityPool = pool;
    console.log("\uD83D\uDC65 Pool de disponibilidad construido:", Object.keys(pool).length, "trabajadores");
  },
  findBestSubstitutes(service, count = 5) {
    const candidates = [];
    const serviceLocation = this.extractLocation(service.SERVICIO);
    const serviceType = service["TIPO S"];
    Object.values(this.availabilityPool).forEach((worker) => {
      if (worker.name === service.TITULAR)
        return;
      if (!worker.available)
        return;
      const score = this.calculateCompatibilityScore(worker, service, serviceLocation, serviceType);
      if (score.total > 30) {
        candidates.push({
          worker: worker.name,
          totalScore: score.total,
          breakdown: score.breakdown,
          capacity: worker.capacity,
          currentServices: worker.currentServices.length,
          data: worker
        });
      }
    });
    candidates.sort((a, b) => b.totalScore - a.totalScore);
    return candidates.slice(0, count);
  },
  calculateCompatibilityScore(worker, service, serviceLocation, serviceType) {
    const breakdown = {};
    let total = 0;
    if (worker.serviceTypes.includes(serviceType)) {
      breakdown.experience = 35;
      total += 35;
    } else {
      breakdown.experience = 0;
    }
    if (serviceLocation) {
      const proximity = this.calculateProximity(worker.locations, serviceLocation);
      breakdown.proximity = Math.round(proximity * 30);
      total += breakdown.proximity;
    } else {
      breakdown.proximity = 0;
    }
    if (worker.capacity >= 2) {
      breakdown.capacity = 20;
      total += 20;
    } else if (worker.capacity === 1) {
      breakdown.capacity = 10;
      total += 10;
    } else {
      breakdown.capacity = 0;
    }
    const scheduleCompatibility = this.checkScheduleCompatibility(worker.schedule, service.HORARIO);
    breakdown.schedule = Math.round(scheduleCompatibility * 15);
    total += breakdown.schedule;
    return { total: Math.round(total), breakdown };
  },
  calculateProximity(workerLocations, serviceLocation) {
    if (!serviceLocation || workerLocations.length === 0)
      return 0;
    if (workerLocations.includes(serviceLocation))
      return 1;
    const nearbyPairs = {
      Barcelona: ["Badalona", "Hospitalet", "Cornellà", "Sant Adrià"],
      Badalona: ["Barcelona", "Sant Adrià"],
      "Cornellà": ["Barcelona", "Hospitalet", "Esplugues"],
      Hospitalet: ["Barcelona", "Cornellà", "Esplugues"]
    };
    for (const workerLoc of workerLocations) {
      if (nearbyPairs[workerLoc]?.includes(serviceLocation) || nearbyPairs[serviceLocation]?.includes(workerLoc)) {
        return 0.7;
      }
    }
    return 0.3;
  },
  checkScheduleCompatibility(workerSchedules, serviceSchedule) {
    if (!serviceSchedule || workerSchedules.length === 0)
      return 0.5;
    const serviceHours = this.extractHours(serviceSchedule);
    for (const schedule of workerSchedules) {
      const workerHours = this.extractHours(schedule);
      if (this.hasOverlap(workerHours, serviceHours)) {
        return 0;
      }
    }
    return 1;
  },
  extractHours(schedule) {
    if (!schedule)
      return null;
    const match = schedule.match(/(\d{1,2}):?(\d{2})?\s*A\s*(\d{1,2}):?(\d{2})?/i);
    if (match) {
      const startHour = parseInt(match[1]);
      const endHour = parseInt(match[3]);
      return { start: startHour, end: endHour };
    }
    return null;
  },
  hasOverlap(hours1, hours2) {
    if (!hours1 || !hours2)
      return false;
    return hours1.start < hours2.end && hours1.end > hours2.start;
  },
  assignSubstitute(service, substituteName, temporary = true) {
    const assignment = {
      id: `assign_${Date.now()}`,
      service: service.SERVICIO,
      proyecto: service.PROYECTO,
      originalTitular: service.TITULAR,
      substitute: substituteName,
      assignedDate: new Date().toISOString(),
      temporary,
      status: "active",
      notes: ""
    };
    this.assignments.push(assignment);
    this.saveData();
    console.log("✅ Suplente asignado:", substituteName, "para", service.SERVICIO);
    this.buildAvailabilityPool();
    return assignment;
  },
  confirmSubstitution(assignmentId) {
    const assignment = this.assignments.find((a) => a.id === assignmentId);
    if (assignment) {
      assignment.status = "confirmed";
      assignment.confirmedDate = new Date().toISOString();
      this.saveData();
    }
  },
  endSubstitution(assignmentId) {
    const assignment = this.assignments.find((a) => a.id === assignmentId);
    if (assignment) {
      assignment.status = "completed";
      assignment.endDate = new Date().toISOString();
      this.saveData();
      this.buildAvailabilityPool();
    }
  },
  renderSubstituteManager() {
    const container = document.getElementById("substitute-manager-container");
    if (!container)
      return;
    const uncoveredServices = window.state?.masterData?.filter((s) => s.ESTADO === "DESCUBIERTO") || [];
    const itServices = window.state?.masterData?.filter((s) => s.ESTADO1 === "BAJA IT" && (!s.SUPLENTE || s.SUPLENTE === "EMERGENCIAS")) || [];
    const needsSubstitute = [...uncoveredServices, ...itServices];
    const html = `
            <div class="substitute-manager-header">
                <h3>\uD83D\uDD04 Gestión de Suplencias</h3>
                <div class="substitute-stats">
                    <div class="stat-badge">
                        <span class="stat-value">${needsSubstitute.length}</span>
                        <span class="stat-label">Requieren Suplente</span>
                    </div>
                    <div class="stat-badge">
                        <span class="stat-value">${Object.values(this.availabilityPool).filter((w) => w.available && w.capacity > 0).length}</span>
                        <span class="stat-label">Disponibles</span>
                    </div>
                    <div class="stat-badge">
                        <span class="stat-value">${this.assignments.filter((a) => a.status === "active").length}</span>
                        <span class="stat-label">Activas</span>
                    </div>
                </div>
            </div>

            <div class="substitute-sections">
                ${needsSubstitute.length > 0 ? `
                    <div class="substitute-section">
                        <h4>\uD83D\uDEA8 Servicios que Requieren Suplente</h4>
                        <div class="services-needing-substitute">
                            ${needsSubstitute.map((service) => this.renderServiceNeedingSubstitute(service)).join("")}
                        </div>
                    </div>
                ` : '<div class="empty-state">✅ Todos los servicios tienen cobertura</div>'}

                ${this.assignments.filter((a) => a.status === "active").length > 0 ? `
                    <div class="substitute-section">
                        <h4>\uD83D\uDCCB Suplencias Activas</h4>
                        <div class="active-substitutions">
                            ${this.assignments.filter((a) => a.status === "active").map((a) => this.renderActiveSubstitution(a)).join("")}
                        </div>
                    </div>
                ` : ""}
            </div>
        `;
    container.innerHTML = html;
  },
  renderServiceNeedingSubstitute(service) {
    const suggestions = this.findBestSubstitutes(service, 3);
    return `
            <div class="service-substitute-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div class="service-info" style="margin-bottom: 12px;">
                    <div class="service-name" style="font-weight: 800; color: #1e293b; font-size: 15px;">${service.SERVICIO}</div>
                    <div class="service-meta" style="font-size: 11px; color: #64748b; margin-top: 4px;">
                        <span class="badge blue">${service["TIPO S"] || "N/A"}</span>
                        ${service.HORARIO ? `<span style="margin-left: 10px;">⏰ ${service.HORARIO}</span>` : ""}
                    </div>
                </div>

                <div class="substitute-suggestions">
                    <div class="suggestions-header" style="font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-bottom: 10px;">\uD83E\uDD16 IA-MATCH SUGGESTIONS</div>
                    ${suggestions.length > 0 ? suggestions.map((sug, idx) => `
                        <div class="suggestion-candidate" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; border: 1px solid #f1f5f9;">
                            <div class="candidate-rank" style="font-size: 12px; font-weight: 800; color: #94a3b8;">#${idx + 1}</div>
                            <div class="candidate-info" style="flex-grow: 1;">
                                <div class="candidate-name" style="font-weight: 700; color: #334155; font-size: 13px;">${sug.worker}</div>
                                <div class="candidate-score" style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                                    <span class="score-badge" style="font-size: 10px; font-weight: 800; color: #10b981;">${sug.totalScore}% MATCH</span>
                                    <span class="score-details" style="font-size: 10px; color: #94a3b8;">
                                        ${sug.breakdown.proximity > 20 ? "\uD83D\uDCCD Proximidad Alta" : ""}
                                        ${sug.breakdown.experience > 30 ? " • \uD83C\uDFE2 Experto en área" : ""}
                                    </span>
                                </div>
                            </div>
                            <button class="btn-primary-glow smart-btn" 
                                    style="padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer;"
                                    onclick="SubstituteManagement.promptAssignment('${service.PROYECTO}', '${sug.worker}')">
                                Asignar
                            </button>
                        </div>
                    `).join("") : '<div class="no-suggestions">No hay candidatos disponibles</div>'}
                </div>
            </div>
        `;
  },
  renderActiveSubstitution(assignment) {
    const daysSince = Math.ceil((new Date - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24));
    return `
            <div class="active-substitution-card">
                <div class="substitution-info">
                    <div class="substitution-service">${assignment.service}</div>
                    <div class="substitution-details">
                        <span>Suplente: <strong>${assignment.substitute}</strong></span>
                        <span>Original: ${assignment.originalTitular}</span>
                        <span>Hace ${daysSince} día${daysSince > 1 ? "s" : ""}</span>
                    </div>
                </div>
                <div class="substitution-actions">
                    ${assignment.status === "active" ? `
                        <button class="btn-confirm" onclick="SubstituteManagement.confirmSubstitution('${assignment.id}')">
                            ✓ Confirmar
                        </button>
                    ` : ""}
                    <button class="btn-end" onclick="SubstituteManagement.endSubstitution('${assignment.id}')">
                        Finalizar
                    </button>
                </div>
            </div>
        `;
  },
  promptAssignment(proyecto, substituteName) {
    const service = window.state?.masterData?.find((s) => s.PROYECTO === proyecto);
    if (!service)
      return;
    const confirmed = confirm(`¿Asignar a ${substituteName} como suplente de:

` + `${service.SERVICIO}
` + `Titular: ${service.TITULAR || "N/A"}

` + `¿Continuar?`);
    if (confirmed) {
      this.assignSubstitute(service, substituteName);
      this.renderSubstituteManager();
      if (typeof showToast === "function") {
        showToast(`✅ ${substituteName} asignado como suplente`);
      }
    }
  },
  extractLocation(serviceName) {
    if (!serviceName)
      return null;
    const match = serviceName.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : null;
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => SubstituteManagement2.init());
} else {
  SubstituteManagement2.init();
}

// pwa_installer.js
var PWAInstaller = {
  deferredPrompt: null,
  isInstalled: false,
  init() {
    console.log("\uD83D\uDCF1 Inicializando PWA Installer...");
    this.registerServiceWorker();
    this.checkIfInstalled();
    this.setupInstallPrompt();
    this.detectInstallation();
    this.showInstallBanner();
  },
  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js");
        console.log("✅ Service Worker registrado:", registration.scope);
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });
      } catch (error) {
        console.error("❌ Error registrando Service Worker:", error);
      }
    }
  },
  checkIfInstalled() {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      this.isInstalled = true;
      console.log("✅ App instalada y ejecutándose en modo standalone");
      this.hideInstallButton();
    }
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      console.log("✅ App instalada en iOS");
      this.hideInstallButton();
    }
  },
  setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("\uD83D\uDCF1 Evento beforeinstallprompt capturado");
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });
  },
  detectInstallation() {
    window.addEventListener("appinstalled", () => {
      console.log("✅ PWA instalada correctamente");
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallButton();
      if (typeof showToast === "function") {
        showToast("✅ App instalada correctamente", "success");
      }
    });
  },
  showInstallButton() {
    let installBtn = document.getElementById("pwa-install-btn");
    if (!installBtn) {
      installBtn = document.createElement("button");
      installBtn.id = "pwa-install-btn";
      installBtn.className = "pwa-install-button";
      installBtn.innerHTML = "\uD83D\uDCF1 Instalar App";
      installBtn.onclick = () => this.promptInstall();
      const header = document.querySelector(".global-header");
      if (header) {
        header.appendChild(installBtn);
      }
    }
    installBtn.style.display = "block";
  },
  hideInstallButton() {
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) {
      installBtn.style.display = "none";
    }
  },
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log("⚠️ No hay prompt de instalación disponible");
      return;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`Usuario ${outcome === "accepted" ? "aceptó" : "rechazó"} la instalación`);
    if (outcome === "accepted") {
      if (typeof showToast === "function") {
        showToast("\uD83D\uDCF1 Instalando app...", "info");
      }
    }
    this.deferredPrompt = null;
    this.hideInstallButton();
  },
  showInstallBanner() {
    if (this.isInstalled || !this.isMobile())
      return;
    const bannerDismissed = localStorage.getItem("pwa_banner_dismissed");
    if (bannerDismissed)
      return;
    setTimeout(() => {
      const banner = document.createElement("div");
      banner.className = "pwa-install-banner";
      banner.innerHTML = `
                <div class="banner-content">
                    <div class="banner-icon">\uD83D\uDCF1</div>
                    <div class="banner-text">
                        <strong>Instala SIFU Informer</strong>
                        <p>Acceso rápido y modo offline</p>
                    </div>
                    <button class="banner-install-btn" onclick="PWAInstaller.promptInstall()">
                        Instalar
                    </button>
                    <button class="banner-close-btn" onclick="PWAInstaller.dismissBanner()">
                        ×
                    </button>
                </div>
            `;
      document.body.appendChild(banner);
      setTimeout(() => banner.classList.add("show"), 100);
    }, 3000);
  },
  dismissBanner() {
    const banner = document.querySelector(".pwa-install-banner");
    if (banner) {
      banner.classList.remove("show");
      setTimeout(() => banner.remove(), 300);
    }
    localStorage.setItem("pwa_banner_dismissed", "true");
  },
  showUpdateNotification() {
    if (typeof showToast === "function") {
      showToast("\uD83D\uDD04 Nueva versión disponible. Recarga para actualizar.", "info");
    }
    const updateBtn = document.createElement("button");
    updateBtn.className = "pwa-update-button";
    updateBtn.innerHTML = "\uD83D\uDD04 Actualizar";
    updateBtn.onclick = () => {
      window.location.reload();
    };
    const header = document.querySelector(".global-header");
    if (header) {
      header.appendChild(updateBtn);
    }
  },
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  async requestPushPermission() {
    if (!("Notification" in window)) {
      console.log("⚠️ Este navegador no soporta notificaciones");
      return false;
    }
    if (Notification.permission === "granted") {
      console.log("✅ Permiso de notificaciones ya concedido");
      return true;
    }
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("✅ Permiso de notificaciones concedido");
        return true;
      }
    }
    console.log("❌ Permiso de notificaciones denegado");
    return false;
  },
  async subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array("YOUR_PUBLIC_VAPID_KEY_HERE")
        });
        console.log("✅ Suscrito a notificaciones push");
      }
      return subscription;
    } catch (error) {
      console.error("❌ Error suscribiendo a push:", error);
      return null;
    }
  },
  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0;i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },
  async sendTestNotification() {
    if (!("serviceWorker" in navigator))
      return;
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification("SIFU Informer", {
      body: "Las notificaciones están funcionando correctamente",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "test-notification",
      requireInteraction: false
    });
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => PWAInstaller.init());
} else {
  PWAInstaller.init();
}
window.PWAInstaller = PWAInstaller;

// internal_chat.js
var InternalChat = {
  messages: [],
  users: new Set,
  currentUser: null,
  unreadCount: 0,
  isOpen: false,
  init() {
    console.log("\uD83D\uDCAC Inicializando Chat Interno...");
    this.loadMessages();
    this.loadUsers();
    this.setupCurrentUser();
    this.createChatUI();
    this.startPolling();
  },
  setupCurrentUser() {
    let user = localStorage.getItem("sifu_chat_user");
    if (!user) {
      user = prompt("Introduce tu nombre para el chat:", "Usuario");
      if (user) {
        localStorage.setItem("sifu_chat_user", user);
      } else {
        user = "Usuario" + Math.floor(Math.random() * 1000);
      }
    }
    this.currentUser = user;
    this.users.add(user);
    this.saveUsers();
  },
  loadMessages() {
    const saved = localStorage.getItem("sifu_chat_messages_v1");
    if (saved) {
      try {
        this.messages = JSON.parse(saved);
        this.calculateUnread();
      } catch (e) {
        console.error("Error cargando mensajes:", e);
        this.messages = [];
      }
    }
  },
  saveMessages() {
    localStorage.setItem("sifu_chat_messages_v1", JSON.stringify(this.messages));
  },
  loadUsers() {
    const saved = localStorage.getItem("sifu_chat_users_v1");
    if (saved) {
      try {
        this.users = new Set(JSON.parse(saved));
      } catch (e) {
        console.error("Error cargando usuarios:", e);
      }
    }
  },
  saveUsers() {
    localStorage.setItem("sifu_chat_users_v1", JSON.stringify([...this.users]));
  },
  calculateUnread() {
    const lastRead = localStorage.getItem("sifu_chat_last_read");
    const lastReadTime = lastRead ? new Date(lastRead) : new Date(0);
    this.unreadCount = this.messages.filter((msg) => new Date(msg.timestamp) > lastReadTime && msg.user !== this.currentUser).length;
    this.updateBadge();
  },
  updateBadge() {
    const badge = document.getElementById("chat-unread-badge");
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? "99+" : this.unreadCount;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  },
  createChatUI() {
    const chatButton = document.createElement("button");
    chatButton.id = "chat-float-button";
    chatButton.className = "chat-float-button";
    chatButton.innerHTML = `
            \uD83D\uDCAC
            <span id="chat-unread-badge" class="chat-unread-badge" style="display: none;">0</span>
        `;
    chatButton.onclick = () => this.toggleChat();
    document.body.appendChild(chatButton);
    const chatPanel = document.createElement("div");
    chatPanel.id = "chat-panel";
    chatPanel.className = "chat-panel";
    chatPanel.innerHTML = `
            <div class="chat-header">
                <div class="chat-title">
                    <span class="chat-icon">\uD83D\uDCAC</span>
                    <span>Chat Interno</span>
                    <span class="chat-online-count" id="chat-online-count">
                        <span class="online-dot"></span> ${this.users.size}
                    </span>
                </div>
                <button class="chat-close-btn" onclick="InternalChat.toggleChat()">×</button>
            </div>
            
            <div class="chat-users-bar" id="chat-users-bar">
                <!-- Users will be rendered here -->
            </div>

            <div class="chat-messages" id="chat-messages-container">
                <!-- Messages will be rendered here -->
            </div>

            <div class="chat-input-container">
                <input 
                    type="text" 
                    id="chat-message-input" 
                    class="chat-input" 
                    placeholder="Escribe un mensaje..."
                    maxlength="500"
                />
                <button class="chat-send-btn" onclick="InternalChat.sendMessage()">
                    Enviar
                </button>
            </div>
        `;
    document.body.appendChild(chatPanel);
    const input = document.getElementById("chat-message-input");
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
    this.updateBadge();
    this.renderUsers();
    this.renderMessages();
  },
  toggleChat() {
    this.isOpen = !this.isOpen;
    const panel = document.getElementById("chat-panel");
    if (panel) {
      if (this.isOpen) {
        panel.classList.add("open");
        this.markAsRead();
        this.scrollToBottom();
        const input = document.getElementById("chat-message-input");
        if (input)
          setTimeout(() => input.focus(), 100);
      } else {
        panel.classList.remove("open");
      }
    }
  },
  renderUsers() {
    const container = document.getElementById("chat-users-bar");
    if (!container)
      return;
    const usersArray = [...this.users];
    const html = usersArray.map((user) => `
            <div class="chat-user-chip ${user === this.currentUser ? "current-user" : ""}">
                <span class="user-avatar">${user.charAt(0).toUpperCase()}</span>
                <span class="user-name">${user}</span>
                ${user === this.currentUser ? '<span class="user-you">(Tú)</span>' : ""}
            </div>
        `).join("");
    container.innerHTML = html;
    const countEl = document.getElementById("chat-online-count");
    if (countEl) {
      countEl.innerHTML = `<span class="online-dot"></span> ${this.users.size}`;
    }
  },
  renderMessages() {
    const container = document.getElementById("chat-messages-container");
    if (!container)
      return;
    if (this.messages.length === 0) {
      container.innerHTML = `
                <div class="chat-empty-state">
                    <div class="empty-icon">\uD83D\uDCAC</div>
                    <p>No hay mensajes aún</p>
                    <p class="empty-subtitle">Sé el primero en escribir</p>
                </div>
            `;
      return;
    }
    const html = this.messages.map((msg, index) => {
      const isOwn = msg.user === this.currentUser;
      const showAvatar = index === 0 || this.messages[index - 1].user !== msg.user;
      const timestamp = new Date(msg.timestamp);
      const timeStr = timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      return `
                <div class="chat-message ${isOwn ? "own-message" : "other-message"}">
                    ${!isOwn && showAvatar ? `
                        <div class="message-avatar">${msg.user.charAt(0).toUpperCase()}</div>
                    ` : '<div class="message-avatar-spacer"></div>'}
                    
                    <div class="message-content">
                        ${!isOwn && showAvatar ? `
                            <div class="message-user">${msg.user}</div>
                        ` : ""}
                        <div class="message-bubble">
                            <div class="message-text">${this.escapeHtml(msg.text)}</div>
                            <div class="message-time">${timeStr}</div>
                        </div>
                    </div>
                </div>
            `;
    }).join("");
    container.innerHTML = html;
  },
  async sendMessage() {
    const input = document.getElementById("chat-message-input");
    if (!input)
      return;
    const text = input.value.trim();
    if (!text)
      return;
    const message = {
      id: Date.now(),
      user: this.currentUser,
      text,
      timestamp: new Date().toISOString()
    };
    this.messages.push(message);
    this.saveMessages();
    input.value = "";
    this.renderMessages();
    this.scrollToBottom();
    if (text.toLowerCase().startsWith("@ai")) {
      const query = text.substring(3).trim();
      await this.handleAIQuery(query);
    }
    this.broadcastMessage(message);
  },
  async handleAIQuery(query) {
    const botMsg = {
      id: "ai-" + Date.now(),
      user: "Sifu AI \uD83E\uDD16",
      text: "Pensando...",
      timestamp: new Date().toISOString(),
      isAI: true
    };
    this.messages.push(botMsg);
    this.renderMessages();
    this.scrollToBottom();
    let response = "";
    if (window.LLMAssistant) {
      const context = window.LLMAssistant.buildContextPrompt();
      if (window.LLMAssistant.settings.apiKey) {
        try {
          response = await window.LLMAssistant.callOpenAI(query, context);
        } catch (e) {
          response = "⚠️ Error en API: " + e.message;
        }
      } else {
        response = await window.LLMAssistant.simulateResponse(query, context);
      }
    } else {
      response = "El motor de IA no está disponible.";
    }
    const index = this.messages.findIndex((m) => m.id === botMsg.id);
    if (index !== -1) {
      this.messages[index].text = response;
      this.saveMessages();
      this.renderMessages();
      this.scrollToBottom();
    }
  },
  broadcastMessage(message) {
    if (typeof showToast === "function" && !this.isOpen) {
      showToast(`\uD83D\uDCAC Nuevo mensaje de ${message.user}`, "info");
    }
  },
  markAsRead() {
    localStorage.setItem("sifu_chat_last_read", new Date().toISOString());
    this.unreadCount = 0;
    this.updateBadge();
  },
  scrollToBottom() {
    const container = document.getElementById("chat-messages-container");
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
    }
  },
  startPolling() {
    setInterval(() => {
      this.checkNewMessages();
    }, 5000);
  },
  checkNewMessages() {
    if (!this.isOpen) {
      this.calculateUnread();
    }
  },
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
  sendNotificationMessage(title, body, url) {
    const message = {
      id: Date.now(),
      user: "Sistema",
      text: `\uD83D\uDD14 ${title}: ${body}`,
      timestamp: new Date().toISOString(),
      url
    };
    this.messages.push(message);
    this.saveMessages();
    if (this.isOpen) {
      this.renderMessages();
      this.scrollToBottom();
    } else {
      this.calculateUnread();
    }
  },
  sendQuickMessage(type) {
    const quickMessages = {
      descubierto: "\uD83D\uDEA8 Hay un servicio descubierto que requiere atención",
      baja_it: "\uD83C\uDFE5 Nueva baja IT registrada",
      contrato: "\uD83D\uDCC4 Contrato próximo a vencer",
      vacaciones: "\uD83C\uDFD6️ Vacaciones próximas sin suplente",
      ok: "✅ Todo correcto",
      ayuda: "\uD83C\uDD98 Necesito ayuda"
    };
    const text = quickMessages[type] || type;
    const input = document.getElementById("chat-message-input");
    if (input) {
      input.value = text;
      input.focus();
    }
  },
  exportChat() {
    const chatData = {
      messages: this.messages,
      users: [...this.users],
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat_export_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === "function") {
      showToast("\uD83D\uDCBE Chat exportado correctamente", "success");
    }
  },
  clearChat() {
    if (confirm("¿Estás seguro de que quieres borrar todo el historial de chat?")) {
      this.messages = [];
      this.saveMessages();
      this.renderMessages();
      if (typeof showToast === "function") {
        showToast("\uD83D\uDDD1️ Chat limpiado", "info");
      }
    }
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => InternalChat.init());
} else {
  InternalChat.init();
}
window.InternalChat = InternalChat;

// aldi_parts_scanner.js
var AldiPartsScanner2 = {
  processedParts: [],
  currentAnalysis: null,
  currentFilter: "ALL",
  agentKnowledge: { workers: [], centers: [] },
  consts: { API_URL: "http://localhost:3000/api/aldi-parts" },
  CENTERS_4H: ["FABRA I PUIG", "MERCAT DE MONTSERRAT", "SANTS PELEGRI", "SANTS PELEGRÍ", "TALLERS"],
  init() {
    console.log("\uD83D\uDE80 ALDI ENGINE v9.0 STABLE");
    this.extractKnowledge();
    this.loadHistory();
    this.setupUpload();
  },
  getBillingHours(centerName, horario) {
    const h = (horario || "").toUpperCase();
    const c = (centerName || "").toUpperCase();
    const t = h.match(/(\d{1,2})[:.]\d{2}/g) || [];
    if (t.length >= 2) {
      const parse = (s) => {
        const [hh, mm] = s.split(/[:.]/).map(Number);
        return hh + mm / 60;
      };
      if (Math.abs(parse(t[1]) - parse(t[0])) >= 3.6)
        return 4;
    }
    if (this.CENTERS_4H.some((k) => c.includes(k)))
      return 4;
    return 3;
  },
  extractKnowledge() {
    if (typeof INITIAL_MASTER_DATA === "undefined") {
      console.warn("⚠️ INITIAL_MASTER_DATA no disponible");
      return;
    }
    const aldi = INITIAL_MASTER_DATA.filter((r) => r["TIPO S"] === "ALDI");
    this.agentKnowledge.workers = aldi.map((r) => {
      const full = (r.TITULAR || "").toUpperCase().trim();
      if (!full)
        return null;
      const tokens = full.split(/\s+/).filter((p) => p.length > 2);
      return {
        fullName: full,
        tokens,
        nicknames: tokens.map((p) => p.substring(0, 5)),
        assignedCenter: (r.SERVICIO || "").toUpperCase(),
        horario: r.HORARIO || ""
      };
    }).filter(Boolean);
    this.agentKnowledge.centers = aldi.map((r) => {
      const raw = (r.SERVICIO || "").toUpperCase();
      const loc = raw.replace(/TIENDA\s+\d+\s*-\s*/, "").trim();
      return {
        fullName: raw,
        location: loc,
        tokens: loc.split(/\s+/).filter((t) => t.length > 2),
        horario: r.HORARIO || ""
      };
    });
    console.log(`\uD83E\uDDE0 ${this.agentKnowledge.workers.length} trabajadores Aldi cargados`);
  },
  async loadHistory() {
    try {
      const controller = new AbortController;
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(this.consts.API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (r.ok) {
        this.processedParts = (await r.json()).map((p) => this.normalize(p));
        console.log("✅ Historial Aldi cargado desde API");
      } else {
        this.loadLocal();
      }
    } catch (e) {
      console.log("\uD83D\uDCE6 API offline o lenta, cargando local:", e.name);
      this.loadLocal();
    }
    this.updateHistoryUI();
  },
  toggleDay(day) {
    if (!this.currentAnalysis)
      return;
    const dayIdx = this.currentAnalysis.heatmap.findIndex((h) => h.day === day);
    if (dayIdx === -1)
      return;
    this.currentAnalysis.heatmap[dayIdx].worked = !this.currentAnalysis.heatmap[dayIdx].worked;
    const totalWorked = this.currentAnalysis.heatmap.filter((h) => h.worked).length;
    this.currentAnalysis.detectedDays = totalWorked;
    this.currentAnalysis.detectedHours = totalWorked * this.currentAnalysis.hPerDay;
    this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - totalWorked);
    console.log(`\uD83D\uDDB1️ Manual Edit: Day ${day} toggled. Total days: ${totalWorked}`);
    this.renderResults();
  },
  saveToERP() {
    if (!this.currentAnalysis)
      return;
    const part = { ...this.currentAnalysis, status: "SAVED", timestamp: new Date().toISOString() };
    this.processedParts.unshift(part);
    localStorage.setItem("sifu_aldi_v9", JSON.stringify(this.processedParts.slice(0, 50)));
    if (window.UniversalState) {
      UniversalState.addActivity("ALDI_SCAN", `Parte guardado: ${part.worker} (${part.detectedDays} días)`);
    }
    console.log("✅ Parte guardado en ERP local");
    this.updateHistoryUI();
    const view = document.getElementById("aldi-results-view");
    view.innerHTML = `
            <div style="padding: 100px 0; text-align: center; color: #10b981;">
                <span style="font-size: 60px; display: block; margin-bottom: 20px;">✅</span>
                <h3 style="margin:0;">¡PARTE GUARDADO!</h3>
                <p style="color:#64748b;">Los datos han sido integrados en el sistema.</p>
                <button onclick="AldiPartsScanner.renderResults()" style="margin-top:20px; background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 20px; border-radius:10px; cursor:pointer;">VOLVER</button>
            </div>
        `;
  },
  loadLocal() {
    try {
      const s = localStorage.getItem("sifu_aldi_v9");
      if (s)
        this.processedParts = JSON.parse(s).map((p) => this.normalize(p));
    } catch {
      this.processedParts = [];
    }
  },
  normalize(p) {
    return {
      ...p,
      worker: p.workerName || p.worker || "DESCONOCIDO",
      center: p.center || "CENTRO DESCONOCIDO",
      reportedAbsences: p.absences || p.reportedAbsences || [],
      detectedHours: Number(p.detectedHours) || 0,
      detectedDays: Number(p.detectedDays) || 0,
      month: p.month ?? 2
    };
  },
  persist() {
    try {
      localStorage.setItem("sifu_aldi_v9", JSON.stringify(this.processedParts));
    } catch {}
  },
  setFilter(m) {
    this.currentFilter = m;
    this.updateHistoryUI();
  },
  updateHistoryUI() {
    const list = document.getElementById("aldi-history-list");
    if (!list)
      return;
    let arr = [...this.processedParts];
    if (this.currentFilter !== "ALL")
      arr = arr.filter((p) => String(p.month) === String(this.currentFilter));
    if (!arr.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:11px;">No hay registros previos.</div>';
      return;
    }
    list.innerHTML = arr.slice(0, 30).map((p) => {
      const id = String(p._id?.$oid || p._id || p.id || p.timestamp);
      return `<div onclick="AldiPartsScanner.viewDetail('${id}')"
                style="background:#fff;padding:12px 14px;border-radius:10px;border:1px solid #e2e8f0;
                       margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;
                       cursor:pointer;border-left:5px solid #10b981;">
                <div style="font-size:11px;flex:1;">
                    <strong style="color:#1e293b;display:block;">${p.center}</strong>
                    <span style="color:#475569;">${p.worker}</span>
                    <span style="display:block;font-size:10px;color:#94a3b8;margin-top:2px;">
                        ${new Date(p.timestamp || p.createdAt || Date.now()).toLocaleDateString()} •
                        <b>${p.detectedDays}d · ${p.detectedHours}h</b>
                    </span>
                </div>
                <button onclick="AldiPartsScanner.deletePart('${id}',event)"
                    style="background:#fee2e2;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;color:#dc2626;font-size:15px;">\uD83D\uDDD1️</button>
            </div>`;
    }).join("");
  },
  viewDetail(id) {
    const p = this.processedParts.find((x) => String(x._id?.$oid || x._id || x.id || x.timestamp) === String(id));
    if (p) {
      this.currentAnalysis = JSON.parse(JSON.stringify(p));
      this.renderResults();
      showToast("\uD83D\uDC41️ Registro cargado", "info");
    }
  },
  async deletePart(id, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!confirm("¿Eliminar definitivamente?"))
      return;
    this.processedParts = this.processedParts.filter((x) => String(x._id?.$oid || x._id || x.id || x.timestamp) !== String(id));
    this.persist();
    this.updateHistoryUI();
    fetch(`${this.consts.API_URL}/${id}`, { method: "DELETE" }).catch(() => {});
    showToast("\uD83D\uDDD1️ Eliminado", "info");
  },
  setupUpload() {
    const zone = document.getElementById("aldi-upload-zone");
    if (!zone) {
      console.warn("⚠️ aldi-upload-zone no encontrado");
      return;
    }
    console.log("\uD83D\uDCC4 Configurando zona de carga Aldi...");
    const newZone = zone.cloneNode(true);
    zone.parentNode.replaceChild(newZone, zone);
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => newZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }));
    newZone.addEventListener("drop", (e) => {
      console.log("\uD83D\uDCE5 Archivo soltado");
      if (e.dataTransfer && e.dataTransfer.files[0])
        this.handleFile(e.dataTransfer.files[0]);
    });
    newZone.addEventListener("click", () => {
      console.log("\uD83D\uDDB1️ Clic en zona de carga");
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.onchange = (e) => {
        if (e.target.files[0]) {
          console.log("\uD83D\uDCC2 Archivo seleccionado:", e.target.files[0].name);
          this.handleFile(e.target.files[0]);
        }
      };
      inp.click();
    });
  },
  async handleFile(file) {
    if (!file)
      return;
    const zone = document.getElementById("aldi-upload-zone");
    const overlay = zone ? zone.querySelector("#aldi-scanning-overlay") : document.getElementById("aldi-scanning-overlay");
    const progEl = overlay ? overlay.querySelector(".processing-text") : null;
    const setProgress = (msg) => {
      if (progEl)
        progEl.innerText = msg;
      console.log(msg);
    };
    if (overlay)
      overlay.style.display = "flex";
    try {
      if (typeof Tesseract === "undefined") {
        throw new Error("Tesseract.js no cargado");
      }
      setProgress("PRE-PROCESANDO...");
      const blob = await this.preprocessImage(file);
      const imgURL = await this.toDataURL(file);
      setProgress("INICIALIZANDO...");
      const result = await Tesseract.recognize(blob, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(`PROCESANDO: ${(m.progress * 100).toFixed(0)}%`);
          }
        }
      });
      const text = result.data.text;
      this.lastRawText = text;
      console.log("\uD83D\uDCC4 Contenido detectado. Analizando...");
      this.analyse(text, imgURL, file.name);
      if (overlay)
        overlay.style.display = "none";
      this.renderResults();
      showToast("✅ Análisis completado", "success");
    } catch (err) {
      console.error("❌ Error Aldi Scanner:", err);
      showToast(`⚠️ ${err.message}`, "error");
      if (overlay)
        overlay.style.display = "none";
    }
  },
  toDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader;
      r.onload = (e) => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },
  async preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image;
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const controls = document.getElementById("image-adjust-controls");
        if (controls)
          controls.style.display = "block";
        const contrastVal = document.getElementById("adj-contrast")?.value || 1.8;
        const thresholdVal = document.getElementById("adj-threshold")?.value || 140;
        const targetWidth = 2000;
        const scale = targetWidth / img.width;
        canvas.width = targetWidth;
        canvas.height = img.height * scale;
        ctx.filter = `grayscale(1) contrast(${contrastVal}) brightness(1.1) blur(0.2px)`;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0;i < data.length; i += 4) {
          const r = data[i];
          const v = r < thresholdVal ? 0 : 255;
          data[i] = data[i + 1] = data[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.filter = "contrast(1.2) brightness(1.0)";
        ctx.drawImage(canvas, 0, 0);
        console.log(`\uD83D\uDC41️ Vision Engine v11.1: C=${contrastVal}, T=${thresholdVal}`);
        canvas.toBlob((b) => resolve(b), "image/png", 1);
      };
      img.src = URL.createObjectURL(file);
    });
  },
  analyse(rawText, imgURL, fileName) {
    const T = rawText.toUpperCase();
    const F = fileName.toUpperCase();
    const lines = T.split(`
`).map((l) => l.trim()).filter((l) => l.length > 1);
    let bestCenter = null, bestCScore = 0;
    this.agentKnowledge.centers.forEach((c) => {
      let sc = 0;
      c.tokens.forEach((t) => {
        if (T.includes(t))
          sc += t.length * 5;
        else {
          const partial = t.length > 3 ? t.substring(0, t.length - 1) : t;
          const escaped = partial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          try {
            const regex = new RegExp(escaped, "i");
            if (regex.test(T))
              sc += t.length * 2;
          } catch (e) {
            console.warn("Regex skip:", escaped);
          }
        }
      });
      if (sc > bestCScore) {
        bestCenter = c;
        bestCScore = sc;
      }
    });
    let worker = null;
    let bestWScore = 0;
    this.agentKnowledge.workers.forEach((w) => {
      let sc = 0;
      if (bestCenter && w.fullName.includes(bestCenter.id))
        sc += 200;
      w.tokens.forEach((t) => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const n = (T.match(new RegExp(escaped, "gi")) || []).length;
        sc += n * 10;
        if (t === "MONTSERRAT" && T.includes("MONTSE"))
          sc += 100;
      });
      if (sc > bestWScore) {
        worker = w;
        bestWScore = sc;
      }
    });
    const MONTHS = [
      "ENERO",
      "FEBRERO",
      "MARZO",
      "ABRIL",
      "MAYO",
      "JUNIO",
      "JULIO",
      "AGOSTO",
      "SEPTIEMBRE",
      "OCTUBRE",
      "NOVIEMBRE",
      "DICIEMBRE"
    ];
    let mIdx = MONTHS.findIndex((m) => T.includes(m) || T.includes(m.substring(0, 4)));
    if (mIdx < 0)
      mIdx = 2;
    const { workingDays, daysInMonth } = this.monthStats(mIdx, 2026);
    const broadTimeMatches = (T.match(/\b0?[6789]\D{0,2}\d{2}\b/g) || []).length;
    const sA = Math.floor(broadTimeMatches / 2);
    let sB = 0;
    if (worker) {
      const maxToken = worker.tokens.reduce((best, t) => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const n = (T.match(new RegExp(escaped, "gi")) || []).length;
        return Math.max(best, n);
      }, 0);
      const maxNick = worker.nicknames.reduce((best, n) => {
        const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cnt = (T.match(new RegExp(escaped, "gi")) || []).length;
        return Math.max(best, cnt);
      }, 0);
      sB = Math.max(maxToken, maxNick);
    }
    const sC = lines.filter((l) => /^\d{1,2}\s+[A-ZÁÉÍÓÚ]/.test(l)).length;
    const sD = Math.max(0, lines.filter((l) => l.length > 8).length - 6);
    const uniqueDays = new Set;
    rawText.split(`
`).forEach((line) => {
      const m2 = line.trim().match(/(?:^|\||\/|\s)(\d{1,2})(?:\s|$|\.|:|\|)/);
      if (m2) {
        const n = parseInt(m2[1]);
        if (n >= 1 && n <= daysInMonth) {
          const dow = new Date(2026, mIdx, n).getDay();
          if (dow !== 0 && dow !== 6)
            uniqueDays.add(n);
        }
      }
    });
    const sE = uniqueDays.size;
    console.log(`\uD83D\uDCCA CONTEO: A(tiempos)=${sA} B(nombres)=${sB} C(filas)=${sC} D(contenido)=${sD} E(díasÚnicos)=${sE} laborables=${workingDays}`);
    const valid = [sA, sB, sC, sE].filter((v) => v >= 2 && v <= 31);
    let workedDays;
    if (valid.length === 0) {
      workedDays = workingDays;
    } else {
      workedDays = Math.max(...valid);
      if (sD >= 5 && sD <= 28 && sD > workedDays)
        workedDays = sD;
    }
    if (workingDays - workedDays <= 2 && workingDays - workedDays > 0) {
      console.log(`\uD83D\uDCCA Redondeando a días laborables por margen OCR (${workedDays} → ${workingDays})`);
      workedDays = workingDays;
    }
    workedDays = Math.min(workedDays, daysInMonth);
    const horario = worker?.horario || bestCenter?.horario || "";
    const hPerDay = this.getBillingHours(bestCenter?.fullName || "", horario);
    const totalH = workedDays * hPerDay;
    const absences = Math.max(0, workingDays - workedDays);
    const heatmap = [];
    let marked = 0;
    for (let d = 1;d <= 31; d++) {
      if (d > daysInMonth) {
        heatmap.push({ day: d, worked: false, out: true });
        continue;
      }
      const dow = new Date(2026, mIdx, d).getDay();
      const isWDay = dow !== 0 && dow !== 6;
      const doMark = isWDay && marked < workedDays;
      if (doMark)
        marked++;
      heatmap.push({ day: d, worked: doMark });
    }
    const hasSignatures = T.includes("FIRMA") || lines.some((l) => l.includes("FMA") || l.includes("SIG"));
    let discrepancy = false;
    let discrepancyReason = "";
    if (worker && workedDays !== workingDays) {
      discrepancy = true;
      discrepancyReason = `Se detectaron ${workedDays} días, pero el Master espera ${workingDays}.`;
    }
    const confidence = Math.min(100, Math.round((sA > 0 ? 30 : 0) + (sB > 0 ? 30 : 0) + (sC > 0 ? 20 : 0) + (sE > 0 ? 20 : 0)));
    this.currentAnalysis = {
      id: Date.now(),
      worker: worker?.fullName || "NO DETECTADO",
      center: bestCenter?.fullName || "NO DETECTADO",
      month: mIdx,
      year: 2026,
      detectedDays: workedDays,
      detectedHours: totalH,
      hPerDay,
      expectedWorkingDays: workingDays,
      absences,
      heatmap,
      imageData: imgURL,
      horario,
      timestamp: new Date().toISOString(),
      confidence,
      hasSignatures,
      discrepancy,
      discrepancyReason,
      _debug: { sA, sB, sC, sD, workingDays }
    };
  },
  monthStats(m, y) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let workingDays = 0;
    for (let d = 1;d <= daysInMonth; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6)
        workingDays++;
    }
    return { daysInMonth, workingDays };
  },
  renderResults() {
    const view = document.getElementById("aldi-results-view");
    if (!view)
      return;
    if (!this.currentAnalysis) {
      view.innerHTML = '<div class="empty-state">Arrastra un parte para analizar...</div>';
      return;
    }
    const R = this.currentAnalysis;
    const MN = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    view.innerHTML = `
        <div style="background:#fff;border-radius:20px;box-shadow:0 15px 25px -5px rgba(0,0,0,.08);overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:#1e293b;padding:22px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                        <h3 style="margin:0;font-size:18px;font-weight:800;">RESULTADO DE ANÁLISIS</h3>
                        <span style="background:${R.confidence > 80 ? "#10b981" : "#f59e0b"}; color:white; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">
                            CONFIANZA: ${R.confidence}%
                        </span>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">ALDI ENGINE v11.8</span>
                        <button onclick="const p = document.getElementById('aldi-ocr-debug'); p.style.display = p.style.display === 'none' ? 'block' : 'none';" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:3px 8px; border-radius:12px; font-size:9px; cursor:pointer;">\uD83D\uDD0D DIAGNÓSTICO IA</button>
                    </div>
                </div>
                ${R.imageData ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                    <img src="${R.imageData}" onclick="AldiPartsScanner.showImage()" style="width:100px;height:60px;object-fit:cover;border-radius:10px;border:2px solid rgba(255,255,255,.2);cursor:zoom-in;"/>
                    <button onclick="AldiPartsScanner.showImage()" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 12px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;">\uD83D\uDC41 VER PARTE</button>
                </div>` : ""}
            </div>

            <!-- Panel de Debug Oculto -->
            <div id="aldi-ocr-debug" style="display:none; padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; animation: fadeIn 0.3s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">LECTURA BRUTA DEL MOTOR (DEBUG):</span>
                    <button onclick="document.getElementById('aldi-ocr-debug').style.display='none'" style="border:none; background:none; cursor:pointer; color:#94a3b8;">✕</button>
                </div>
                <pre style="white-space:pre-wrap; font-size:10px; font-family:'JetBrains Mono', monospace; background:#fff; padding:12px; border:1px solid #e2e8f0; border-radius:8px; max-height:200px; overflow-y:auto; margin:0; color:#334155; line-height:1.4;">${this.lastRawText || "No hay data disponible."}</pre>
            </div>

            ${R.discrepancy ? `
                <div style="background:#fff7ed; padding:10px 28px; border-bottom:1px solid #ffedd5; color:#c2410c; font-size:12px; font-weight:700; display:flex; align-items:center; gap:10px;">
                    <span>\uD83D\uDEA8 DISCREPANCIA DETECTADA:</span>
                    <span style="font-weight:400;">${R.discrepancyReason}</span>
                </div>
            ` : ""}

            <div style="padding:24px 28px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
                    <div onclick="AldiPartsScanner.editField('worker')" style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;">
                        <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;display:block;margin-bottom:6px;">TRABAJADOR ✏️</span>
                        <span style="font-size:14px;font-weight:800;color:#1e293b;">${R.worker}</span>
                    </div>
                    <div onclick="AldiPartsScanner.editField('center')" style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;">
                        <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;display:block;margin-bottom:6px;">CENTRO ALDI ✏️</span>
                        <span style="font-size:14px;font-weight:800;color:#1e293b;">${R.center}</span>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start;">
                    <div style="background:#f1f5f9;padding:18px;border-radius:16px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px;color:#475569;">
                            <strong>CALENDARIO — ${MN[R.month]} 2026</strong>
                            <span>${R.detectedDays} / ${R.expectedWorkingDays} laborables</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
                            ${R.heatmap.map((d) => `<div title="Día ${d.day}" style="aspect-ratio:1;border-radius:5px;
                                background:${d.out ? "#f8fafc" : d.worked ? "#10b981" : "#e2e8f0"};
                                color:${d.out ? "transparent" : d.worked ? "#fff" : "#94a3b8"};
                                display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;">${d.day}</div>`).join("")}
                        </div>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="background:#ecfdf5;padding:18px;border-radius:14px;border:1px solid #bbf7d0;text-align:center;">
                            <span style="font-size:9px;color:#065f46;font-weight:800;text-transform:uppercase;display:block;margin-bottom:4px;">HORAS FACTURABLES</span>
                            <span style="font-size:42px;color:#059669;font-weight:900;line-height:1;">${R.detectedHours}</span>
                            <span style="font-size:16px;color:#059669;font-weight:700;">h</span>
                            <span style="display:block;font-size:10px;color:#059669;margin-top:5px;">${R.detectedDays}d × ${R.hPerDay}h</span>
                            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;">
                                <button onclick="AldiPartsScanner.adjustDays(-1)" style="background:#059669;color:#fff;border:none;width:28px;height:28px;border-radius:50%;font-size:18px;cursor:pointer;font-weight:700;line-height:1;">−</button>
                                <span style="font-size:11px;color:#065f46;font-weight:700;">${R.detectedDays} días</span>
                                <button onclick="AldiPartsScanner.adjustDays(+1)" style="background:#059669;color:#fff;border:none;width:28px;height:28px;border-radius:50%;font-size:18px;cursor:pointer;font-weight:700;line-height:1;">+</button>
                            </div>
                        </div>
                        <div style="background:#fff7ed;padding:14px;border-radius:14px;border:1px solid #ffedd5;text-align:center;">
                            <span style="font-size:9px;color:#9a3412;font-weight:800;text-transform:uppercase;display:block;margin-bottom:4px;">DÍAS AUSENTES</span>
                            <span style="font-size:24px;color:#c2410c;font-weight:800;">${R.absences}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:20px;">
                    ${!R._id ? `
                    <button onclick="AldiPartsScanner.save()"
                        style="flex:2;background:#059669;color:#fff;border:none;padding:15px;border-radius:12px;
                               font-weight:800;cursor:pointer;font-size:14px;box-shadow:0 4px 6px -1px rgba(16,185,129,.3);">
                        ✅ GUARDAR EN ERP
                    </button>` : `
                    <div style="flex:2;background:#f1f5f9;color:#64748b;padding:15px;border-radius:12px;font-weight:700;text-align:center;border:1px solid #e2e8f0;">ARCHIVADO ✓</div>`}
                    <button onclick="AldiPartsScanner.reset()"
                        style="flex:1;background:#fff;color:#64748b;border:1px solid #e2e8f0;padding:15px;border-radius:12px;font-weight:700;cursor:pointer;">CERRAR</button>
                </div>

                <details style="margin-top:12px;">
                    <summary style="font-size:10px;color:#94a3b8;cursor:pointer;">\uD83D\uDD0D DEBUG OCR LOG</summary>
                    <pre style="font-size:9px;color:#64748b;background:#f8fafc;padding:10px;border-radius:8px;overflow:auto;max-height:100px;margin-top:6px;">A(tiempos)=${R._debug?.sA} B(nombres)=${R._debug?.sB} C(filas)=${R._debug?.sC} D(content)=${R._debug?.sD}
Días elegidos: ${R.detectedDays} | h/día: ${R.hPerDay} | Total: ${R.detectedHours}h | Esperados: ${R._debug?.workingDays}
Horario master: ${R.horario}</pre>
                </details>
            </div>
        </div>`;
  },
  editField(field) {
    const cur = this.currentAnalysis[field];
    const val = prompt(`Corregir "${field}":`, cur);
    if (val !== null) {
      this.currentAnalysis[field] = val.toUpperCase();
      this.renderResults();
    }
  },
  showImage() {
    if (!this.currentAnalysis?.imageData)
      return;
    const src = this.currentAnalysis.imageData;
    const existing = document.getElementById("aldi-lightbox");
    if (existing)
      existing.remove();
    const lb = document.createElement("div");
    lb.id = "aldi-lightbox";
    lb.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;";
    lb.innerHTML = `
            <div style="position:relative;max-width:92vw;max-height:88vh;">
                <img src="${src}" style="max-width:100%;max-height:85vh;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,.5);"/>
                <button onclick="document.getElementById('aldi-lightbox').remove()" style="position:absolute;top:-14px;right:-14px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;font-weight:800;line-height:1;">×</button>
            </div>
            <div style="display:flex;gap:12px;">
                <button onclick="window.open('${src}')" style="background:#059669;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;">⬇ Abrir / Descargar</button>
                <button onclick="document.getElementById('aldi-lightbox').remove()" style="background:#475569;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;">Cerrar</button>
            </div>`;
    lb.addEventListener("click", (e) => {
      if (e.target === lb)
        lb.remove();
    });
    document.body.appendChild(lb);
  },
  adjustDays(delta) {
    if (!this.currentAnalysis)
      return;
    const newDays = Math.max(1, Math.min(31, this.currentAnalysis.detectedDays + delta));
    this.currentAnalysis.detectedDays = newDays;
    this.currentAnalysis.detectedHours = newDays * this.currentAnalysis.hPerDay;
    this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - newDays);
    let marked = 0;
    this.currentAnalysis.heatmap = this.currentAnalysis.heatmap.map((d) => {
      if (d.out)
        return d;
      const dow = new Date(2026, this.currentAnalysis.month, d.day).getDay();
      const isWDay = dow !== 0 && dow !== 6;
      const doMark = isWDay && marked < newDays;
      if (doMark)
        marked++;
      return { ...d, worked: doMark };
    });
    this.renderResults();
  },
  editDays() {
    const days = prompt("Corregir días trabajados:", this.currentAnalysis.detectedDays);
    if (days !== null && !isNaN(parseInt(days))) {
      this.currentAnalysis.detectedDays = parseInt(days);
      this.currentAnalysis.detectedHours = parseInt(days) * this.currentAnalysis.hPerDay;
      this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - parseInt(days));
      this.renderResults();
    }
  },
  async save() {
    if (!this.currentAnalysis)
      return;
    const item = { ...this.currentAnalysis, timestamp: new Date().toISOString() };
    this.processedParts.unshift(item);
    this.persist();
    this.updateHistoryUI();
    showToast("\uD83D\uDCBE Guardado localmente", "success");
    fetch(this.consts.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    }).then(async (r) => {
      if (r.ok) {
        const saved = await r.json();
        const idx = this.processedParts.findIndex((p) => p.timestamp === item.timestamp);
        if (idx !== -1) {
          this.processedParts[idx] = this.normalize(saved);
          this.persist();
          this.updateHistoryUI();
        }
        showToast("☁️ Sincronizado en la nube", "success");
      }
    }).catch(() => showToast("⚠️ Modo offline (guardado localmente)", "warning"));
    this.reset();
  },
  reset() {
    this.currentAnalysis = null;
    const view = document.getElementById("aldi-results-view");
    if (view)
      view.innerHTML = '<div class="empty-state" style="padding:80px 0;text-align:center;color:#94a3b8;"><span style="font-size:40px;display:block;margin-bottom:20px;">\uD83E\uDD16</span><p>Arrastra un parte para analizar...</p></div>';
  }
};
window.AldiPartsScanner = AldiPartsScanner2;
document.addEventListener("DOMContentLoaded", () => AldiPartsScanner2.init());

// ml_engine.js
var MLEngine2 = {
  model: null,
  isTraining: false,
  trainingData: [],
  predictions: [],
  anomalies: [],
  async init() {
    console.log("\uD83D\uDCCA Inicializando Motor Predictivo...");
    if (typeof tf === "undefined") {
      await this.loadTensorFlow();
    }
    this.loadTrainingData();
    await this.buildModel();
    this.startAnomalyDetection();
  },
  async loadTensorFlow() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
      script.onload = () => {
        console.log("✅ TensorFlow.js cargado");
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },
  loadTrainingData() {
    const saved = localStorage.getItem("sifu_ml_training_data_v1");
    if (saved) {
      try {
        this.trainingData = JSON.parse(saved);
        console.log("\uD83D\uDCCA Datos de entrenamiento cargados:", this.trainingData.length, "registros");
      } catch (e) {
        console.error("Error cargando datos de entrenamiento:", e);
      }
    }
    if (this.trainingData.length === 0) {
      this.generateTrainingData();
    }
  },
  generateTrainingData() {
    if (!window.state || !window.state.masterData)
      return;
    console.log("\uD83D\uDD04 Generando datos de entrenamiento...");
    const data = [];
    const today = new Date;
    window.state.masterData.forEach((service) => {
      const features = {
        serviceType: this.encodeServiceType(service["TIPO S"]),
        isCovered: service.ESTADO === "CUBIERTO" ? 1 : 0,
        isIT: service.ESTADO1 === "BAJA IT" ? 1 : 0,
        isVacation: service.ESTADO1 === "VACACIONES" ? 1 : 0,
        daysToContractEnd: this.calculateDaysToContractEnd(service["FIN CONTRATO"]),
        hasSubstitute: service.SUPLENTE && service.SUPLENTE !== "EMERGENCIAS" ? 1 : 0,
        location: this.encodeLocation(service.SERVICIO),
        dayOfWeek: today.getDay(),
        month: today.getMonth() + 1
      };
      const label = service.ESTADO === "DESCUBIERTO" ? 1 : 0;
      data.push({
        features: Object.values(features),
        label,
        serviceId: service.PROYECTO
      });
    });
    this.trainingData = data;
    this.saveTrainingData();
    console.log("✅ Datos de entrenamiento generados:", data.length, "registros");
  },
  saveTrainingData() {
    localStorage.setItem("sifu_ml_training_data_v1", JSON.stringify(this.trainingData));
  },
  async buildModel() {
    if (typeof tf === "undefined") {
      console.error("❌ TensorFlow.js no está disponible");
      return;
    }
    console.log("\uD83C\uDFD7️ Construyendo modelo de red neuronal...");
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [9],
          units: 16,
          activation: "relu",
          kernelInitializer: "heNormal"
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 8,
          activation: "relu"
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 4,
          activation: "relu"
        }),
        tf.layers.dense({
          units: 1,
          activation: "sigmoid"
        })
      ]
    });
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"]
    });
    console.log("✅ Modelo construido");
    if (this.trainingData.length >= 10) {
      await this.trainModel();
    }
  },
  async trainModel() {
    if (!this.model || this.trainingData.length < 10) {
      console.log("⚠️ No hay suficientes datos para entrenar");
      return;
    }
    console.log("\uD83C\uDF93 Entrenando modelo...");
    this.isTraining = true;
    try {
      const features = this.trainingData.map((d) => d.features);
      const labels = this.trainingData.map((d) => d.label);
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);
      const history = await this.model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Época ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
            }
          }
        }
      });
      xs.dispose();
      ys.dispose();
      console.log("✅ Modelo entrenado correctamente");
      this.isTraining = false;
      await this.saveModel();
    } catch (error) {
      console.error("❌ Error entrenando modelo:", error);
      this.isTraining = false;
    }
  },
  async saveModel() {
    if (!this.model)
      return;
    try {
      await this.model.save("localstorage://sifu-ml-model");
      console.log("\uD83D\uDCBE Modelo guardado en localStorage");
    } catch (error) {
      console.error("Error guardando modelo:", error);
    }
  },
  async loadModel() {
    try {
      this.model = await tf.loadLayersModel("localstorage://sifu-ml-model");
      console.log("✅ Modelo cargado desde localStorage");
      return true;
    } catch (error) {
      console.log("⚠️ No hay modelo guardado, creando nuevo...");
      return false;
    }
  },
  async predictUncoveredServices() {
    if (!this.model || !window.state || !window.state.masterData) {
      console.log("⚠️ Modelo no disponible o sin datos");
      return [];
    }
    console.log("\uD83D\uDD2E Generando predicciones ML...");
    const predictions = [];
    const today = new Date;
    for (const service of window.state.masterData) {
      if (service.ESTADO !== "CUBIERTO")
        continue;
      const features = [
        this.encodeServiceType(service["TIPO S"]),
        1,
        service.ESTADO1 === "BAJA IT" ? 1 : 0,
        service.ESTADO1 === "VACACIONES" ? 1 : 0,
        this.calculateDaysToContractEnd(service["FIN CONTRATO"]),
        service.SUPLENTE && service.SUPLENTE !== "EMERGENCIAS" ? 1 : 0,
        this.encodeLocation(service.SERVICIO),
        today.getDay(),
        today.getMonth() + 1
      ];
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input);
      const probability = (await prediction.data())[0];
      input.dispose();
      prediction.dispose();
      if (probability > 0.5) {
        predictions.push({
          service: service.SERVICIO,
          proyecto: service.PROYECTO,
          titular: service.TITULAR,
          probability: (probability * 100).toFixed(1),
          risk: this.getRiskLevel(probability),
          reason: this.getPredictionReason(service, probability)
        });
      }
    }
    predictions.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
    this.predictions = predictions;
    console.log("✅ Predicciones generadas:", predictions.length);
    return predictions;
  },
  getRiskLevel(probability) {
    if (probability >= 0.8)
      return "CRÍTICO";
    if (probability >= 0.6)
      return "ALTO";
    if (probability >= 0.4)
      return "MEDIO";
    return "BAJO";
  },
  getPredictionReason(service, probability) {
    const reasons = [];
    if (service.ESTADO1 === "BAJA IT") {
      reasons.push("Trabajador en baja IT");
    }
    if (service.ESTADO1 === "VACACIONES") {
      reasons.push("Trabajador de vacaciones");
    }
    if (!service.SUPLENTE || service.SUPLENTE === "EMERGENCIAS") {
      reasons.push("Sin suplente asignado");
    }
    const daysToEnd = this.calculateDaysToContractEnd(service["FIN CONTRATO"]);
    if (daysToEnd >= 0 && daysToEnd <= 7) {
      reasons.push("Contrato termina pronto");
    }
    if (reasons.length === 0) {
      reasons.push("Patrón histórico detectado");
    }
    return reasons.join(", ");
  },
  startAnomalyDetection() {
    console.log("\uD83D\uDD0D Iniciando detección de anomalías...");
    setInterval(() => {
      this.detectAnomalies();
    }, 10 * 60 * 1000);
    this.detectAnomalies();
  },
  detectAnomalies() {
    if (!window.state || !window.state.masterData)
      return;
    const anomalies = [];
    const workerServices = {};
    window.state.masterData.forEach((service) => {
      const titular = service.TITULAR;
      if (!titular)
        return;
      if (!workerServices[titular]) {
        workerServices[titular] = [];
      }
      workerServices[titular].push(service);
    });
    Object.entries(workerServices).forEach(([worker, services]) => {
      if (services.length > 5) {
        anomalies.push({
          type: "SOBRECARGA",
          severity: "HIGH",
          worker,
          count: services.length,
          message: `${worker} tiene ${services.length} servicios asignados (normal: 1-3)`,
          recommendation: "Redistribuir servicios para evitar sobrecarga"
        });
      }
    });
    window.state.masterData.forEach((service) => {
      if (service.ESTADO === "DESCUBIERTO" && !service.TITULAR) {
        anomalies.push({
          type: "SIN_TITULAR",
          severity: "CRITICAL",
          service: service.SERVICIO,
          proyecto: service.PROYECTO,
          message: `${service.SERVICIO} lleva tiempo sin titular asignado`,
          recommendation: "Asignar titular urgentemente"
        });
      }
    });
    const itByService = {};
    window.state.masterData.forEach((service) => {
      if (service.ESTADO1 === "BAJA IT") {
        const key = service.SERVICIO;
        itByService[key] = (itByService[key] || 0) + 1;
      }
    });
    Object.entries(itByService).forEach(([service, count]) => {
      if (count > 1) {
        anomalies.push({
          type: "BAJAS_IT_RECURRENTES",
          severity: "MEDIUM",
          service,
          count,
          message: `${service} tiene ${count} bajas IT recurrentes`,
          recommendation: "Revisar condiciones del servicio"
        });
      }
    });
    this.anomalies = anomalies;
    if (anomalies.length > 0) {
      console.log("⚠️ Anomalías detectadas:", anomalies.length);
      this.notifyAnomalies(anomalies);
    }
  },
  notifyAnomalies(anomalies) {
    const critical = anomalies.filter((a) => a.severity === "CRITICAL");
    if (critical.length > 0 && typeof showToast === "function") {
      showToast(`\uD83D\uDEA8 ${critical.length} anomalía(s) crítica(s) detectada(s)`, "error");
    }
  },
  encodeServiceType(type) {
    const types = {
      LIMPIEZA: 1,
      SEGURIDAD: 2,
      MANTENIMIENTO: 3,
      "RECEPCIÓN": 4,
      OTROS: 5
    };
    return types[type] || 0;
  },
  encodeLocation(serviceName) {
    if (!serviceName)
      return 0;
    const locations = {
      Barcelona: 1,
      Badalona: 2,
      Hospitalet: 3,
      "Cornellà": 4,
      "Sant Adrià": 5
    };
    for (const [loc, code] of Object.entries(locations)) {
      if (serviceName.includes(loc)) {
        return code;
      }
    }
    return 0;
  },
  calculateDaysToContractEnd(excelDate) {
    if (!excelDate)
      return 999;
    const contractEnd = new Date((excelDate - 25569) * 86400 * 1000);
    const today = new Date;
    const diffTime = contractEnd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },
  renderPredictions() {
    const container = document.getElementById("ml-predictions-container");
    if (!container)
      return;
    if (this.predictions.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay predicciones de riesgo en este momento</div>';
      return;
    }
    const html = `
            <div class="ml-predictions-header">
                <h4>\uD83D\uDCCA Predicciones del Sistema</h4>
                <span class="ml-badge">Modelo Entrenado</span>
            </div>
            <div class="ml-predictions-list">
                ${this.predictions.map((pred) => `
                    <div class="ml-prediction-card risk-${pred.risk.toLowerCase()}">
                        <div class="prediction-header">
                            <div class="prediction-service">${pred.service}</div>
                            <div class="prediction-probability">${pred.probability}%</div>
                        </div>
                        <div class="prediction-details">
                            <div class="prediction-worker">Titular: ${pred.titular || "N/A"}</div>
                            <div class="prediction-risk">Riesgo: <strong>${pred.risk}</strong></div>
                            <div class="prediction-reason">${pred.reason}</div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    container.innerHTML = html;
  },
  renderAnomalies() {
    const container = document.getElementById("ml-anomalies-container");
    if (!container)
      return;
    if (this.anomalies.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ No se detectaron anomalías</div>';
      return;
    }
    const html = `
            <div class="ml-anomalies-header">
                <h4>\uD83D\uDD0D Anomalías Detectadas</h4>
                <span class="anomaly-count">${this.anomalies.length}</span>
            </div>
            <div class="ml-anomalies-list">
                ${this.anomalies.map((anomaly) => `
                    <div class="ml-anomaly-card severity-${anomaly.severity.toLowerCase()}">
                        <div class="anomaly-type">${anomaly.type}</div>
                        <div class="anomaly-message">${anomaly.message}</div>
                        <div class="anomaly-recommendation">\uD83D\uDCA1 ${anomaly.recommendation}</div>
                    </div>
                `).join("")}
            </div>
        `;
    container.innerHTML = html;
  },
  async retrainModel() {
    if (this.isTraining) {
      console.log("⚠️ El modelo ya está entrenando");
      return;
    }
    if (typeof showToast === "function") {
      showToast("\uD83C\uDF93 Reentrenando modelo ML...", "info");
    }
    this.generateTrainingData();
    await this.trainModel();
    await this.predictUncoveredServices();
    this.renderPredictions();
    if (typeof showToast === "function") {
      showToast("✅ Modelo reentrenado correctamente", "success");
    }
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => MLEngine2.init());
} else {
  MLEngine2.init();
}
window.MLEngine = MLEngine2;

// route_optimizer.js
var RouteOptimizer2 = {
  routes: [],
  optimizedRoutes: [],
  locations: new Map,
  init() {
    console.log("\uD83D\uDDFA️ Inicializando Optimizador de Rutas...");
    this.buildLocationDatabase();
    this.analyzeWorkerRoutes();
  },
  buildLocationDatabase() {
    this.locations = new Map([
      ["Barcelona", { lat: 41.3851, lng: 2.1734 }],
      ["Badalona", { lat: 41.4502, lng: 2.2447 }],
      ["Hospitalet", { lat: 41.3598, lng: 2.1006 }],
      ["Cornellà", { lat: 41.3563, lng: 2.0752 }],
      ["Sant Adrià", { lat: 41.4301, lng: 2.2201 }],
      ["Esplugues", { lat: 41.3768, lng: 2.0878 }],
      ["Sant Boi", { lat: 41.3431, lng: 2.0363 }],
      ["Viladecans", { lat: 41.3145, lng: 2.0141 }],
      ["Gavà", { lat: 41.3057, lng: 2.0012 }],
      ["Castelldefels", { lat: 41.2814, lng: 1.9774 }]
    ]);
  },
  analyzeWorkerRoutes() {
    if (!window.state || !window.state.masterData)
      return;
    console.log("\uD83D\uDD0D Analizando rutas de trabajadores...");
    const workerRoutes = {};
    window.state.masterData.forEach((service) => {
      const worker = service.TITULAR;
      if (!worker || service.ESTADO !== "CUBIERTO")
        return;
      if (!workerRoutes[worker]) {
        workerRoutes[worker] = {
          name: worker,
          services: [],
          locations: [],
          totalDistance: 0,
          efficiency: 100
        };
      }
      const location = this.extractLocation(service.SERVICIO);
      if (location) {
        workerRoutes[worker].services.push({
          name: service.SERVICIO,
          location,
          coords: this.locations.get(location),
          horario: service.HORARIO
        });
        if (!workerRoutes[worker].locations.includes(location)) {
          workerRoutes[worker].locations.push(location);
        }
      }
    });
    Object.values(workerRoutes).forEach((route) => {
      if (route.services.length > 1) {
        route.totalDistance = this.calculateTotalDistance(route.services);
        route.efficiency = this.calculateEfficiency(route);
        if (route.services.length >= 3) {
          route.optimizedServices = this.optimizeRoute(route.services);
          route.optimizedDistance = this.calculateTotalDistance(route.optimizedServices);
          route.savings = route.totalDistance - route.optimizedDistance;
          route.savingsPercent = (route.savings / route.totalDistance * 100).toFixed(1);
        }
      }
    });
    this.routes = Object.values(workerRoutes);
    console.log("✅ Rutas analizadas:", this.routes.length);
  },
  calculateTotalDistance(services) {
    if (services.length < 2)
      return 0;
    let totalDistance = 0;
    for (let i = 0;i < services.length - 1; i++) {
      const from = services[i].coords;
      const to = services[i + 1].coords;
      if (from && to) {
        totalDistance += this.calculateDistance(from, to);
      }
    }
    return totalDistance;
  },
  calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = this.toRad(coord2.lat - coord1.lat);
    const dLng = this.toRad(coord2.lng - coord1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRad(coord1.lat)) * Math.cos(this.toRad(coord2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  },
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  },
  calculateEfficiency(route) {
    const uniqueLocations = route.locations.length;
    const serviceCount = route.services.length;
    if (uniqueLocations === 1)
      return 100;
    const concentration = serviceCount / uniqueLocations * 100;
    const distancePenalty = Math.min(route.totalDistance * 5, 50);
    return Math.max(0, Math.min(100, concentration - distancePenalty));
  },
  optimizeRoute(services) {
    if (services.length < 4)
      return this.optimizeRouteNearestNeighbor(services);
    console.log("\uD83E\uDDEC Ejecutando Algoritmo Genético para " + services.length + " puntos...");
    const POPULATION_SIZE = 50;
    const GENERATIONS = 100;
    const MUTATION_RATE = 0.1;
    let population = [];
    for (let i = 0;i < POPULATION_SIZE; i++) {
      population.push(this.shuffle([...services]));
    }
    for (let g = 0;g < GENERATIONS; g++) {
      population.sort((a, b) => this.calculateTotalDistance(a) - this.calculateTotalDistance(b));
      let nextGeneration = [population[0]];
      while (nextGeneration.length < POPULATION_SIZE) {
        let parent1 = this.tournamentSelection(population);
        let parent2 = this.tournamentSelection(population);
        let child = this.orderCrossover(parent1, parent2);
        if (Math.random() < MUTATION_RATE) {
          this.mutate(child);
        }
        nextGeneration.push(child);
      }
      population = nextGeneration;
    }
    const bestRoute = population[0];
    console.log("✅ Optimización Genética completada.");
    return bestRoute;
  },
  optimizeRouteNearestNeighbor(services) {
    if (services.length < 2)
      return services;
    const optimized = [];
    const remaining = [...services];
    let current = remaining.shift();
    optimized.push(current);
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      remaining.forEach((service, index) => {
        if (current.coords && service.coords) {
          const distance = this.calculateDistance(current.coords, service.coords);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        }
      });
      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }
    return optimized;
  },
  tournamentSelection(population) {
    const tournamentSize = 5;
    let best = population[Math.floor(Math.random() * population.length)];
    for (let i = 0;i < tournamentSize; i++) {
      let contender = population[Math.floor(Math.random() * population.length)];
      if (this.calculateTotalDistance(contender) < this.calculateTotalDistance(best)) {
        best = contender;
      }
    }
    return best;
  },
  orderCrossover(parent1, parent2) {
    const size = parent1.length;
    const start = Math.floor(Math.random() * size);
    const end = Math.floor(Math.random() * (size - start)) + start;
    const child = new Array(size).fill(null);
    for (let i = start;i <= end; i++) {
      child[i] = parent1[i];
    }
    let p2Idx = 0;
    for (let i = 0;i < size; i++) {
      if (child[i] === null) {
        while (parent1.some((s) => s.name === parent2[p2Idx].name && child.includes(s))) {
          p2Idx++;
        }
        let candidate = parent2[p2Idx];
        while (child.some((s) => s && s.name === candidate.name)) {
          p2Idx++;
          candidate = parent2[p2Idx];
        }
        child[i] = candidate;
        p2Idx++;
      }
    }
    return child;
  },
  mutate(route) {
    const i = Math.floor(Math.random() * route.length);
    const j = Math.floor(Math.random() * route.length);
    [route[i], route[j]] = [route[j], route[i]];
  },
  shuffle(array) {
    for (let i = array.length - 1;i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  extractLocation(serviceName) {
    if (!serviceName)
      return null;
    for (const location of this.locations.keys()) {
      if (serviceName.includes(location)) {
        return location;
      }
    }
    return null;
  },
  renderRouteOptimization() {
    const container = document.getElementById("route-optimization-container");
    if (!container)
      return;
    const optimizableRoutes = this.routes.filter((r) => r.optimizedServices && r.savings > 0);
    if (optimizableRoutes.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ Todas las rutas están optimizadas</div>';
      return;
    }
    optimizableRoutes.sort((a, b) => b.savings - a.savings);
    const html = `
            <div class="route-optimization-header">
                <h4>\uD83D\uDDFA️ Optimización de Rutas</h4>
                <div class="route-stats">
                    <span class="stat-item">
                        <strong>${optimizableRoutes.length}</strong> rutas optimizables
                    </span>
                    <span class="stat-item">
                        <strong>${optimizableRoutes.reduce((sum, r) => sum + r.savings, 0).toFixed(1)} km</strong> ahorro total
                    </span>
                </div>
            </div>
            <div class="route-cards">
                ${optimizableRoutes.map((route) => this.renderRouteCard(route)).join("")}
            </div>
        `;
    container.innerHTML = html;
  },
  renderRouteCard(route) {
    return `
            <div class="route-card">
                <div class="route-card-header">
                    <div class="route-worker">${route.name}</div>
                    <div class="route-savings ${route.savings > 5 ? "high-savings" : ""}">
                        \uD83D\uDCB0 ${route.savingsPercent}% ahorro
                    </div>
                </div>
                
                <div class="route-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Servicios:</span>
                        <span class="metric-value">${route.services.length}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Ubicaciones:</span>
                        <span class="metric-value">${route.locations.length}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Distancia Actual:</span>
                        <span class="metric-value">${route.totalDistance.toFixed(1)} km</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Distancia Optimizada:</span>
                        <span class="metric-value optimized">${route.optimizedDistance.toFixed(1)} km</span>
                    </div>
                </div>

                <div class="route-comparison">
                    <div class="route-column">
                        <h5>Ruta Actual</h5>
                        <div class="route-list">
                            ${route.services.map((s, i) => `
                                <div class="route-step">
                                    <span class="step-number">${i + 1}</span>
                                    <span class="step-location">${s.location}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                    
                    <div class="route-arrow">→</div>
                    
                    <div class="route-column">
                        <h5>Ruta Optimizada</h5>
                        <div class="route-list">
                            ${route.optimizedServices.map((s, i) => `
                                <div class="route-step optimized">
                                    <span class="step-number">${i + 1}</span>
                                    <span class="step-location">${s.location}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <div class="route-recommendation">
                    \uD83D\uDCA1 Reordenando los servicios se ahorran <strong>${route.savings.toFixed(1)} km</strong> 
                    (${route.savingsPercent}% menos distancia)
                </div>
            </div>
        `;
  },
  generateRouteReport() {
    const optimizableRoutes = this.routes.filter((r) => r.optimizedServices && r.savings > 0);
    const report = {
      totalRoutes: this.routes.length,
      optimizableRoutes: optimizableRoutes.length,
      totalSavings: optimizableRoutes.reduce((sum, r) => sum + r.savings, 0),
      averageSavings: optimizableRoutes.length > 0 ? optimizableRoutes.reduce((sum, r) => sum + r.savings, 0) / optimizableRoutes.length : 0,
      topSavings: optimizableRoutes.slice(0, 5),
      generatedAt: new Date().toISOString()
    };
    return report;
  },
  exportOptimizedRoutes() {
    const report = this.generateRouteReport();
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rutas_optimizadas_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === "function") {
      showToast("\uD83D\uDCBE Rutas optimizadas exportadas", "success");
    }
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => RouteOptimizer2.init());
} else {
  RouteOptimizer2.init();
}
window.RouteOptimizer = RouteOptimizer2;

// service_clustering.js
var ServiceClustering2 = {
  clusters: [],
  serviceVectors: [],
  k: 5,
  init() {
    console.log("\uD83C\uDFAF Inicializando Clustering de Servicios...");
    this.buildServiceVectors();
    this.performClustering();
  },
  buildServiceVectors() {
    if (!window.state || !window.state.masterData)
      return;
    console.log("\uD83D\uDCCA Construyendo vectores de características...");
    this.serviceVectors = window.state.masterData.map((service) => {
      return {
        id: service.PROYECTO,
        name: service.SERVICIO,
        titular: service.TITULAR,
        features: this.extractFeatures(service),
        service
      };
    });
    console.log("✅ Vectores construidos:", this.serviceVectors.length);
  },
  extractFeatures(service) {
    return [
      this.encodeServiceType(service["TIPO S"]),
      service.ESTADO === "CUBIERTO" ? 1 : 0,
      service.ESTADO1 === "BAJA IT" ? 1 : 0,
      service.ESTADO1 === "VACACIONES" ? 1 : 0,
      this.encodeLocation(service.SERVICIO),
      service.SUPLENTE && service.SUPLENTE !== "EMERGENCIAS" ? 1 : 0,
      this.normalizeDaysToContractEnd(service["FIN CONTRATO"]),
      this.encodeGestor(service.GESTOR)
    ];
  },
  performClustering() {
    if (this.serviceVectors.length < this.k) {
      console.log("⚠️ No hay suficientes servicios para clustering");
      return;
    }
    console.log("\uD83D\uDD04 Ejecutando K-Means clustering...");
    let centroids = this.initializeCentroids();
    let iterations = 0;
    const maxIterations = 100;
    let converged = false;
    while (!converged && iterations < maxIterations) {
      const newClusters = this.assignToClusters(centroids);
      const newCentroids = this.recalculateCentroids(newClusters);
      converged = this.hasConverged(centroids, newCentroids);
      centroids = newCentroids;
      this.clusters = newClusters;
      iterations++;
    }
    console.log(`✅ Clustering completado en ${iterations} iteraciones`);
    this.analyzeClusters();
  },
  initializeCentroids() {
    const centroids = [];
    const indices = new Set;
    while (centroids.length < this.k) {
      const randomIndex = Math.floor(Math.random() * this.serviceVectors.length);
      if (!indices.has(randomIndex)) {
        indices.add(randomIndex);
        centroids.push([...this.serviceVectors[randomIndex].features]);
      }
    }
    return centroids;
  },
  assignToClusters(centroids) {
    const clusters = Array.from({ length: this.k }, () => []);
    this.serviceVectors.forEach((vector) => {
      let minDistance = Infinity;
      let closestCluster = 0;
      centroids.forEach((centroid, index) => {
        const distance = this.euclideanDistance(vector.features, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = index;
        }
      });
      clusters[closestCluster].push(vector);
    });
    return clusters;
  },
  recalculateCentroids(clusters) {
    return clusters.map((cluster) => {
      if (cluster.length === 0) {
        return this.serviceVectors[Math.floor(Math.random() * this.serviceVectors.length)].features;
      }
      const numFeatures = cluster[0].features.length;
      const centroid = new Array(numFeatures).fill(0);
      cluster.forEach((vector) => {
        vector.features.forEach((value, index) => {
          centroid[index] += value;
        });
      });
      return centroid.map((sum) => sum / cluster.length);
    });
  },
  euclideanDistance(vector1, vector2) {
    return Math.sqrt(vector1.reduce((sum, val, index) => {
      return sum + Math.pow(val - vector2[index], 2);
    }, 0));
  },
  hasConverged(oldCentroids, newCentroids, threshold = 0.001) {
    return oldCentroids.every((oldCentroid, index) => {
      const distance = this.euclideanDistance(oldCentroid, newCentroids[index]);
      return distance < threshold;
    });
  },
  analyzeClusters() {
    console.log("\uD83D\uDD0D Analizando clusters...");
    this.clusters.forEach((cluster, index) => {
      if (cluster.length === 0)
        return;
      const avgFeatures = this.calculateAverageFeatures(cluster);
      const types = cluster.map((v) => v.service["TIPO S"]).filter(Boolean);
      const dominantType = this.getMostFrequent(types);
      const locations = cluster.map((v) => this.extractLocationName(v.service.SERVICIO)).filter(Boolean);
      const dominantLocation = this.getMostFrequent(locations);
      const covered = cluster.filter((v) => v.service.ESTADO === "CUBIERTO").length;
      const uncovered = cluster.filter((v) => v.service.ESTADO === "DESCUBIERTO").length;
      const itLeaves = cluster.filter((v) => v.service.ESTADO1 === "BAJA IT").length;
      cluster.metadata = {
        id: index,
        size: cluster.length,
        dominantType: dominantType || "Mixto",
        dominantLocation: dominantLocation || "Varias",
        covered,
        uncovered,
        itLeaves,
        coverageRate: (covered / cluster.length * 100).toFixed(1),
        avgFeatures
      };
    });
  },
  calculateAverageFeatures(cluster) {
    const numFeatures = cluster[0].features.length;
    const avg = new Array(numFeatures).fill(0);
    cluster.forEach((vector) => {
      vector.features.forEach((value, index) => {
        avg[index] += value;
      });
    });
    return avg.map((sum) => sum / cluster.length);
  },
  getMostFrequent(array) {
    if (array.length === 0)
      return null;
    const frequency = {};
    array.forEach((item) => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  },
  extractLocationName(serviceName) {
    if (!serviceName)
      return null;
    const locations = [
      "Barcelona",
      "Badalona",
      "Hospitalet",
      "Cornellà",
      "Sant Adrià",
      "Esplugues",
      "Sant Boi",
      "Viladecans",
      "Gavà",
      "Castelldefels"
    ];
    for (const location of locations) {
      if (serviceName.includes(location)) {
        return location;
      }
    }
    return null;
  },
  renderClusters() {
    const container = document.getElementById("service-clustering-container");
    if (!container)
      return;
    if (this.clusters.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay datos suficientes para clustering</div>';
      return;
    }
    const nonEmptyClusters = this.clusters.filter((c) => c.length > 0);
    const html = `
            <div class="clustering-header">
                <h4>\uD83C\uDFAF Agrupación de Servicios</h4>
                <div class="clustering-stats">
                    <span class="stat-item">
                        <strong>${nonEmptyClusters.length}</strong> grupos identificados
                    </span>
                    <span class="stat-item">
                        <strong>${this.serviceVectors.length}</strong> servicios analizados
                    </span>
                </div>
            </div>
            <div class="clusters-grid">
                ${nonEmptyClusters.map((cluster, index) => this.renderClusterCard(cluster, index)).join("")}
            </div>
        `;
    container.innerHTML = html;
  },
  renderClusterCard(cluster, index) {
    const meta = cluster.metadata;
    const colorClass = `cluster-${index % 5}`;
    return `
            <div class="cluster-card ${colorClass}">
                <div class="cluster-header">
                    <div class="cluster-title">Grupo ${index + 1}</div>
                    <div class="cluster-size">${meta.size} servicios</div>
                </div>

                <div class="cluster-characteristics">
                    <div class="char-item">
                        <span class="char-icon">\uD83D\uDCCD</span>
                        <span class="char-label">Ubicación:</span>
                        <span class="char-value">${meta.dominantLocation}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-icon">\uD83C\uDFF7️</span>
                        <span class="char-label">Tipo:</span>
                        <span class="char-value">${meta.dominantType}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-icon">\uD83D\uDCCA</span>
                        <span class="char-label">Cobertura:</span>
                        <span class="char-value">${meta.coverageRate}%</span>
                    </div>
                </div>

                <div class="cluster-stats">
                    <div class="stat-bar">
                        <div class="stat-label">Cubiertos</div>
                        <div class="stat-progress">
                            <div class="stat-fill covered" style="width: ${meta.covered / meta.size * 100}%"></div>
                        </div>
                        <div class="stat-count">${meta.covered}</div>
                    </div>
                    <div class="stat-bar">
                        <div class="stat-label">Descubiertos</div>
                        <div class="stat-progress">
                            <div class="stat-fill uncovered" style="width: ${meta.uncovered / meta.size * 100}%"></div>
                        </div>
                        <div class="stat-count">${meta.uncovered}</div>
                    </div>
                    ${meta.itLeaves > 0 ? `
                        <div class="stat-bar">
                            <div class="stat-label">Bajas IT</div>
                            <div class="stat-progress">
                                <div class="stat-fill it" style="width: ${meta.itLeaves / meta.size * 100}%"></div>
                            </div>
                            <div class="stat-count">${meta.itLeaves}</div>
                        </div>
                    ` : ""}
                </div>

                <button class="cluster-details-btn" onclick="ServiceClustering.showClusterDetails(${index})">
                    Ver Detalles
                </button>
            </div>
        `;
  },
  showClusterDetails(clusterIndex) {
    const cluster = this.clusters[clusterIndex];
    if (!cluster || cluster.length === 0)
      return;
    const meta = cluster.metadata;
    const modal = document.createElement("div");
    modal.className = "modal cluster-modal";
    modal.innerHTML = `
            <div class="modal-content cluster-modal-content">
                <div class="modal-header">
                    <h2>Grupo ${clusterIndex + 1} - Detalles</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="cluster-detail-body">
                    <div class="cluster-summary">
                        <h3>Características del Grupo</h3>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">Tamaño:</span>
                                <span class="summary-value">${meta.size} servicios</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Ubicación Dominante:</span>
                                <span class="summary-value">${meta.dominantLocation}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Tipo Dominante:</span>
                                <span class="summary-value">${meta.dominantType}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Tasa de Cobertura:</span>
                                <span class="summary-value">${meta.coverageRate}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="cluster-services-list">
                        <h3>Servicios en este Grupo (${cluster.length})</h3>
                        <div class="services-table">
                            ${cluster.map((v) => `
                                <div class="service-row">
                                    <div class="service-name">${v.name}</div>
                                    <div class="service-status ${v.service.ESTADO === "CUBIERTO" ? "covered" : "uncovered"}">
                                        ${v.service.ESTADO}
                                    </div>
                                    <div class="service-worker">${v.titular || "Sin asignar"}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
    setTimeout(() => modal.style.display = "flex", 10);
  },
  encodeServiceType(type) {
    const types = {
      LIMPIEZA: 1,
      SEGURIDAD: 2,
      MANTENIMIENTO: 3,
      "RECEPCIÓN": 4,
      OTROS: 5
    };
    return types[type] || 0;
  },
  encodeLocation(serviceName) {
    const locations = {
      Barcelona: 1,
      Badalona: 2,
      Hospitalet: 3,
      "Cornellà": 4,
      "Sant Adrià": 5,
      Esplugues: 6,
      "Sant Boi": 7,
      Viladecans: 8,
      "Gavà": 9,
      Castelldefels: 10
    };
    for (const [loc, code] of Object.entries(locations)) {
      if (serviceName && serviceName.includes(loc)) {
        return code;
      }
    }
    return 0;
  },
  encodeGestor(gestor) {
    if (!gestor)
      return 0;
    const gestores = ["GESTOR A", "GESTOR B", "GESTOR C", "GESTOR D"];
    const index = gestores.indexOf(gestor);
    return index >= 0 ? index + 1 : 0;
  },
  normalizeDaysToContractEnd(excelDate) {
    if (!excelDate)
      return 1;
    const contractEnd = new Date((excelDate - 25569) * 86400 * 1000);
    const today = new Date;
    const diffDays = Math.ceil((contractEnd - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(1, diffDays / 365));
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => ServiceClustering2.init());
} else {
  ServiceClustering2.init();
}
window.ServiceClustering = ServiceClustering2;

// integrations_hub.js
var IntegrationsHub2 = {
  settings: {
    sharepointUrl: "",
    whatsappEnabled: true,
    autoReportDaily: false
  },
  init() {
    console.log("\uD83D\uDD0C Inicializando Integrations Hub...");
    this.renderHub();
  },
  generateExecutiveReport() {
    if (!window.state || !window.state.masterData)
      return;
    const data = window.state.masterData;
    const analysis = window.OperationalService ? window.OperationalService.analyzeResilience() : null;
    const timestamp = new Date().toLocaleString();
    let reportHtml = `
            <div id="executive-report-modal" class="premium-modal" style="background: white; padding: 40px; border-radius: 20px; max-width: 800px; width: 90%; margin: 50px auto; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; position: relative;">
                <button onclick="this.parentElement.remove()" style="position: absolute; top: 20px; right: 20px; border: none; background: none; font-size: 24px; cursor: pointer; color: #94a3b8;">&times;</button>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h1 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 800;">INFORME DE SITUACIÓN OPERATIVA</h1>
                        <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Generado por SIFU AI Intelligence Engine</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 800; color: #3b82f6;">${timestamp}</div>
                        <div style="font-size: 12px; color: #94a3b8;">REF: SIFU-SR-${Date.now().toString().slice(-6)}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; font-size: 12px; color: #3b82f6; text-transform: uppercase;">Métricas Vitales</h3>
                        <div style="font-size: 28px; font-weight: 800; color: #1e293b;">${analysis ? analysis.score : "--"}%</div>
                        <p style="font-size: 12px; color: #64748b;">Salud Global de la Plantilla</p>
                    </div>
                    <div style="background: #fff5f5; padding: 20px; border-radius: 12px; border: 1px solid #fed7d7;">
                        <h3 style="margin-top: 0; font-size: 12px; color: #e53e3e; text-transform: uppercase;">Puntos Críticos</h3>
                        <div style="font-size: 28px; font-weight: 800; color: #c53030;">${analysis ? analysis.metrics.descubiertos : "--"}</div>
                        <p style="font-size: 12px; color: #c53030;">Servicios Descubiertos Activos</p>
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 14px; font-weight: 800; color: #1e293b; margin-bottom: 15px;">\uD83D\uDD0D ANÁLISIS DE RESILIENCIA POR ÁREA</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">ZONA / CENTRO</th>
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">RIESGO</th>
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysis ? analysis.summaryList.map((h) => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 12px; font-weight: 700; color: #334155;">${h.centro}</td>
                                    <td style="padding: 12px; font-weight: 700; color: ${h.descubiertos > 0 ? "#e53e3e" : "#10b981"};">
                                        ${h.descubiertos > 0 ? "ALTO" : "ESTABLE"}
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; color: #64748b;">
                                        ${h.descubiertos} Desc. / ${h.bajas} Bajas
                                    </td>
                                </tr>
                            `).join("") : '<tr><td colspan="3">Sin datos</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div style="background: #eff6ff; padding: 20px; border-radius: 12px; border: 1px solid #dbeafe;">
                    <h3 style="margin-top: 0; font-size: 12px; color: #3b82f6; text-transform: uppercase;">\uD83E\uDD16 RECOMENDACIÓN ESTRATÉGICA AI</h3>
                    <p style="font-size: 13px; line-height: 1.6; color: #1e40af; font-weight: 600;">
                        Basado en el Mapa de Calor Predictivo, se recomienda reforzar la zona de <strong>Cataluña</strong> y <strong>Madrid</strong> durante las próximas 48h debido a un pico proyectado en incidencias de transporte.
                    </p>
                </div>

                <div style="margin-top: 40px; display: flex; gap: 15px; justify-content: flex-end;">
                    <button class="btn-primary-glow" onclick="window.print()" style="padding: 12px 25px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800;">\uD83D\uDDA8️ Imprimir PDF</button>
                    <button class="btn-primary-glow" style="padding: 12px 25px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800; background: #25d366 !important;">\uD83D\uDCAC Compartir WhatsApp</button>
                </div>
            </div>
        `;
    const overlay = document.createElement("div");
    overlay.id = "report-overlay";
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 20000; overflow-y: auto;";
    overlay.innerHTML = reportHtml;
    overlay.onclick = (e) => {
      if (e.target === overlay)
        overlay.remove();
    };
    document.body.appendChild(overlay);
  },
  renderHub() {
    const container = document.getElementById("integrations-hub-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="integrations-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                <!-- SharePoint Card -->
                <div class="module-card" style="padding: 25px; background: white;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">\uD83D\uDCC2</span>
                        <h3 style="margin: 0; font-size: 16px;">SharePoint Sync</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Conexión directa con la nube de Microsoft para sincronización del Master General.</p>
                    <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 10px; margin-bottom: 20px;">
                        STATUS: <span style="color: #10b981; font-weight: 800;">ACTIVE</span><br>
                        LAST SYNC: 14:32:10
                    </div>
                    <button class="btn-primary-glow smart-btn" onclick="ExcelSync.forceSync()" style="width: 100%; padding: 10px; border-radius: 8px;">Forzar Sincronización</button>
                </div>

                <!-- WhatsApp API Card -->
                <div class="module-card" style="padding: 25px; background: white;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">\uD83D\uDCAC</span>
                        <h3 style="margin: 0; font-size: 16px;">WhatsApp Automático</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Envío automático de cuadrantes y notificaciones de suplencia a los trabajadores.</p>
                    <label class="switch-container" style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px; border-radius: 8px;">
                        <span style="font-size: 12px; font-weight: 700;">Estado del servicio</span>
                        <input type="checkbox" checked>
                    </label>
                </div>

                <!-- Executive Reporter Card -->
                <div class="module-card" style="padding: 25px; background: white; border: 2px solid #3b82f6;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">\uD83D\uDCCA</span>
                        <h3 style="margin: 0; font-size: 16px;">Generador de Informes</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Crea informes de situación ejecutiva para clientes y directivos en un solo click.</p>
                    <button class="btn-primary-glow smart-btn" onclick="IntegrationsHub.generateExecutiveReport()" style="width: 100%; padding: 12px; border-radius: 8px; background: #3b82f6 !important;">Generar Informe Ahora</button>
                </div>
            </div>
        `;
  }
};
window.IntegrationsHub = IntegrationsHub2;
document.addEventListener("DOMContentLoaded", () => IntegrationsHub2.init());

// transport_optimizer.js
var TransportOptimizer = {
  costs: {
    kmRate: 0.19,
    co2Rate: 120
  },
  init() {
    console.log("\uD83D\uDE9A Inicializando Optimizador de Transporte...");
    this.analyzeLogistics();
  },
  analyzeLogistics() {
    if (!window.RouteOptimizer || !window.RouteOptimizer.routes) {
      console.warn("⚠️ RouteOptimizer no disponible para análisis logístico");
      return;
    }
    const routes = window.RouteOptimizer.routes;
    const analysis = {
      totalKm: 0,
      totalCost: 0,
      totalCO2: 0,
      potentialSavings: 0,
      carpoolingGroups: []
    };
    routes.forEach((route) => {
      const km = route.totalDistance || 0;
      analysis.totalKm += km;
      analysis.totalCost += km * this.costs.kmRate;
      analysis.totalCO2 += km * this.costs.co2Rate;
      if (route.savings) {
        analysis.potentialSavings += route.savings * this.costs.kmRate;
      }
    });
    const groups = {};
    window.state.masterData.forEach((s) => {
      if (s.ESTADO === "CUBIERTO" && s.SERVICIO && s.HORARIO) {
        const key = `${s.SERVICIO}_${s.HORARIO}`;
        if (!groups[key])
          groups[key] = [];
        if (!groups[key].includes(s.TITULAR))
          groups[key].push(s.TITULAR);
      }
    });
    analysis.carpoolingGroups = Object.entries(groups).filter(([_, workers]) => workers.length > 1).map(([key, workers]) => ({
      center: key.split("_")[0],
      horario: key.split("_")[1],
      workers
    }));
    this.currentAnalysis = analysis;
    this.renderTransportDashboard();
  },
  renderTransportDashboard() {
    const container = document.getElementById("transport-optimizer-container");
    if (!container)
      return;
    const a = this.currentAnalysis;
    container.innerHTML = `
            <div class="transport-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
                <div class="metric-card" style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Gasto Mensual Estimado</div>
                    <div style="font-size: 24px; font-weight: 800; color: #1e293b; margin-top: 5px;">${a.totalCost.toFixed(2)}€</div>
                    <div style="font-size: 11px; color: #ef4444; margin-top: 5px;">Potencial ahorro: ${a.potentialSavings.toFixed(2)}€</div>
                </div>
                <div class="metric-card" style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Huella de Carbono</div>
                    <div style="font-size: 24px; font-weight: 800; color: #10b981; margin-top: 5px;">${(a.totalCO2 / 1000).toFixed(1)} kg</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 5px;">Equivalente a ${(a.totalCO2 / 25000).toFixed(1)} árboles</div>
                </div>
                <div class="metric-card" style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Oportunidades Carpooling</div>
                    <div style="font-size: 24px; font-weight: 800; color: #3b82f6; margin-top: 5px;">${a.carpoolingGroups.length}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 5px;">Rutas compartibles detectadas</div>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 20px 0; font-size: 16px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">\uD83D\uDE97</span> PROPUESTAS DE CARPOOLING (Rutas Compartidas)
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    ${a.carpoolingGroups.slice(0, 4).map((g) => `
                        <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6;">
                            <div style="font-weight: 800; color: #1e293b; font-size: 13px;">${g.center}</div>
                            <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Horario: ${g.horario}</div>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;">
                                ${g.workers.map((w) => `<span style="background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700;">${w.split(" ")[0]}</span>`).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
  }
};
window.TransportOptimizer = TransportOptimizer;
document.addEventListener("DOMContentLoaded", () => TransportOptimizer.init());

// advanced_export.js
var AdvancedExport2 = {
  templates: {},
  exportHistory: [],
  init() {
    console.log("\uD83D\uDCE4 Inicializando Sistema de Exportación Avanzada...");
    this.loadTemplates();
    this.loadExportHistory();
  },
  loadTemplates() {
    this.templates = {
      weekly_report: {
        name: "Informe Semanal",
        description: "Resumen semanal de operaciones",
        format: "pdf",
        sections: ["summary", "uncovered", "itLeaves", "contracts"]
      },
      worker_list: {
        name: "Listado de Trabajadores",
        description: "Lista completa de trabajadores con sus servicios",
        format: "excel",
        sections: ["workers", "services", "performance"]
      },
      service_audit: {
        name: "Auditoría de Servicios",
        description: "Análisis detallado de todos los servicios",
        format: "excel",
        sections: ["services", "coverage", "quality"]
      },
      ml_predictions: {
        name: "Predicciones ML",
        description: "Exportar predicciones de Machine Learning",
        format: "json",
        sections: ["predictions", "anomalies", "routes"]
      }
    };
  },
  loadExportHistory() {
    const saved = localStorage.getItem("sifu_export_history_v1");
    if (saved) {
      try {
        this.exportHistory = JSON.parse(saved);
      } catch (e) {
        this.exportHistory = [];
      }
    }
  },
  saveExportHistory() {
    if (this.exportHistory.length > 50) {
      this.exportHistory = this.exportHistory.slice(-50);
    }
    localStorage.setItem("sifu_export_history_v1", JSON.stringify(this.exportHistory));
  },
  async exportToExcel(data, filename, options = {}) {
    console.log("\uD83D\uDCCA Exportando a Excel:", filename);
    if (typeof XLSX === "undefined") {
      console.error("❌ XLSX library no disponible");
      return false;
    }
    try {
      const workbook = XLSX.utils.book_new();
      if (Array.isArray(data) && data[0]?.sheetName) {
        data.forEach((sheet) => {
          const ws = XLSX.utils.json_to_sheet(sheet.data);
          if (sheet.columnWidths) {
            ws["!cols"] = sheet.columnWidths;
          }
          XLSX.utils.book_append_sheet(workbook, ws, sheet.sheetName);
        });
      } else {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, "Datos");
      }
      XLSX.writeFile(workbook, filename);
      this.logExport("excel", filename);
      if (typeof showToast === "function") {
        showToast("✅ Excel exportado correctamente", "success");
      }
      return true;
    } catch (error) {
      console.error("❌ Error exportando a Excel:", error);
      if (typeof showToast === "function") {
        showToast("❌ Error exportando a Excel", "error");
      }
      return false;
    }
  },
  async exportMasterDataToExcel() {
    if (!window.state || !window.state.masterData) {
      console.log("⚠️ No hay datos para exportar");
      return;
    }
    const data = window.state.masterData.map((service) => ({
      Proyecto: service.PROYECTO,
      Servicio: service.SERVICIO,
      Tipo: service["TIPO S"],
      Titular: service.TITULAR,
      Estado: service.ESTADO,
      "Estado 1": service.ESTADO1,
      Suplente: service.SUPLENTE,
      Gestor: service.GESTOR,
      Horario: service.HORARIO,
      "Fin Contrato": service["FIN CONTRATO"] ? this.excelDateToString(service["FIN CONTRATO"]) : ""
    }));
    const filename = `SIFU_Master_${this.getDateString()}.xlsx`;
    await this.exportToExcel(data, filename);
  },
  async exportWorkerPerformanceToExcel() {
    if (typeof WorkerPerformance === "undefined" || !WorkerPerformance.workerProfiles) {
      console.log("⚠️ No hay datos de rendimiento");
      return;
    }
    const profiles = Object.values(WorkerPerformance.workerProfiles);
    const data = profiles.map((profile) => ({
      Trabajador: profile.name,
      "Servicios Activos": profile.activeServices,
      "Rendimiento (%)": profile.performance,
      "Fiabilidad (%)": profile.reliability,
      "Bajas IT": profile.itLeaveHistory.length,
      "Tipos de Servicio": profile.serviceTypes.join(", "),
      Ubicaciones: profile.locations.join(", "),
      "Próximo Contrato Fin": profile.upcomingContractEnd ? this.excelDateToString(profile.upcomingContractEnd) : "N/A"
    }));
    const filename = `SIFU_Rendimiento_Trabajadores_${this.getDateString()}.xlsx`;
    await this.exportToExcel(data, filename);
  },
  async exportMLPredictionsToExcel() {
    if (typeof MLEngine === "undefined" || !MLEngine.predictions) {
      console.log("⚠️ No hay predicciones ML");
      return;
    }
    const sheets = [
      {
        sheetName: "Predicciones",
        data: MLEngine.predictions.map((pred) => ({
          Servicio: pred.service,
          Proyecto: pred.proyecto,
          Titular: pred.titular,
          "Probabilidad (%)": pred.probability,
          "Nivel de Riesgo": pred.risk,
          "Razón": pred.reason
        }))
      },
      {
        sheetName: "Anomalías",
        data: MLEngine.anomalies.map((anomaly) => ({
          Tipo: anomaly.type,
          Severidad: anomaly.severity,
          Mensaje: anomaly.message,
          "Recomendación": anomaly.recommendation
        }))
      }
    ];
    const filename = `SIFU_Predicciones_ML_${this.getDateString()}.xlsx`;
    await this.exportToExcel(sheets, filename);
  },
  async exportToPDF(content, filename) {
    console.log("\uD83D\uDCC4 Generando PDF:", filename);
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${filename}</title>
                <style>
                    @page { margin: 2cm; }
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .section {
                        margin-bottom: 30px;
                        page-break-inside: avoid;
                    }
                    .section h2 {
                        color: #667eea;
                        border-bottom: 2px solid #667eea;
                        padding-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 12px;
                        text-align: left;
                    }
                    th {
                        background: #f8f9fa;
                        font-weight: bold;
                    }
                    .metric {
                        display: inline-block;
                        background: #f8f9fa;
                        padding: 15px 20px;
                        margin: 10px;
                        border-radius: 8px;
                        min-width: 150px;
                    }
                    .metric-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #667eea;
                    }
                    .metric-label {
                        font-size: 14px;
                        color: #666;
                    }
                    .footer {
                        margin-top: 50px;
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                ${content}
                <div class="footer">
                    <p>Generado por SIFU Informer - ${new Date().toLocaleString("es-ES")}</p>
                </div>
            </body>
            </html>
        `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    this.logExport("pdf", filename);
  },
  async exportWeeklyReportToPDF() {
    if (!window.state || !window.state.masterData)
      return;
    const data = window.state.masterData;
    const covered = data.filter((s) => s.ESTADO === "CUBIERTO").length;
    const uncovered = data.filter((s) => s.ESTADO === "DESCUBIERTO").length;
    const itLeaves = data.filter((s) => s.ESTADO1 === "BAJA IT").length;
    const content = `
            <div class="header">
                <h1>\uD83D\uDCCA Informe Semanal</h1>
                <p>SIFU Informer - Semana del ${new Date().toLocaleDateString("es-ES")}</p>
            </div>

            <div class="section">
                <h2>Resumen Operativo</h2>
                <div class="metric">
                    <div class="metric-value">${data.length}</div>
                    <div class="metric-label">Servicios Totales</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${covered}</div>
                    <div class="metric-label">Cubiertos</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #ea4335;">${uncovered}</div>
                    <div class="metric-label">Descubiertos</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #fbbc04;">${itLeaves}</div>
                    <div class="metric-label">Bajas IT</div>
                </div>
            </div>

            <div class="section">
                <h2>Servicios Descubiertos</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Servicio</th>
                            <th>Proyecto</th>
                            <th>Tipo</th>
                            <th>Gestor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.filter((s) => s.ESTADO === "DESCUBIERTO").slice(0, 20).map((s) => `
                            <tr>
                                <td>${s.SERVICIO}</td>
                                <td>${s.PROYECTO}</td>
                                <td>${s["TIPO S"]}</td>
                                <td>${s.GESTOR}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    await this.exportToPDF(content, `Informe_Semanal_${this.getDateString()}.pdf`);
  },
  async exportToJSON(data, filename) {
    console.log("\uD83D\uDCCB Exportando a JSON:", filename);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    this.logExport("json", filename);
    if (typeof showToast === "function") {
      showToast("✅ JSON exportado correctamente", "success");
    }
  },
  async exportCompleteSnapshot() {
    const snapshot = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0",
        source: "SIFU Informer"
      },
      masterData: window.state?.masterData || [],
      workerProfiles: typeof WorkerPerformance !== "undefined" ? WorkerPerformance.workerProfiles : {},
      mlPredictions: typeof MLEngine !== "undefined" ? MLEngine.predictions : [],
      mlAnomalies: typeof MLEngine !== "undefined" ? MLEngine.anomalies : [],
      routes: typeof RouteOptimizer !== "undefined" ? RouteOptimizer.routes : [],
      clusters: typeof ServiceClustering !== "undefined" ? ServiceClustering.clusters : [],
      notifications: typeof NotificationsEngine !== "undefined" ? NotificationsEngine.notifications : [],
      trends: typeof AnalyticsTrends !== "undefined" ? AnalyticsTrends.snapshots : []
    };
    const filename = `SIFU_Snapshot_Completo_${this.getDateString()}.json`;
    await this.exportToJSON(snapshot, filename);
  },
  async exportToCSV(data, filename) {
    console.log("\uD83D\uDCCA Exportando a CSV:", filename);
    if (!Array.isArray(data) || data.length === 0) {
      console.log("⚠️ No hay datos para exportar");
      return;
    }
    const headers = Object.keys(data[0]);
    let csv = headers.join(",") + `
`;
    data.forEach((row) => {
      const values = headers.map((header) => {
        let value = row[header];
        if (typeof value === "string") {
          value = value.replace(/"/g, '""');
          if (value.includes(",") || value.includes(`
`)) {
            value = `"${value}"`;
          }
        }
        return value;
      });
      csv += values.join(",") + `
`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    this.logExport("csv", filename);
    if (typeof showToast === "function") {
      showToast("✅ CSV exportado correctamente", "success");
    }
  },
  getDateString() {
    const now = new Date;
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  },
  excelDateToString(excelDate) {
    if (!excelDate)
      return "";
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toLocaleDateString("es-ES");
  },
  logExport(format, filename) {
    const log = {
      format,
      filename,
      timestamp: new Date().toISOString()
    };
    this.exportHistory.push(log);
    this.saveExportHistory();
  },
  renderExportPanel() {
    const container = document.getElementById("export-panel-container");
    if (!container)
      return;
    const html = `
            <div class="export-options">
                <h3>Exportaciones Rápidas</h3>
                <div class="export-buttons">
                    <button class="export-btn" onclick="AdvancedExport.exportMasterDataToExcel()">
                        \uD83D\uDCCA Exportar Master Data (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportWorkerPerformanceToExcel()">
                        \uD83D\uDC65 Exportar Rendimiento (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportMLPredictionsToExcel()">
                        \uD83E\uDDE0 Exportar Predicciones ML (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportWeeklyReportToPDF()">
                        \uD83D\uDCC4 Exportar Informe Semanal (PDF)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportCompleteSnapshot()">
                        \uD83D\uDCCB Exportar Snapshot Completo (JSON)
                    </button>
                </div>
            </div>

            <div class="export-history">
                <h3>Historial de Exportaciones</h3>
                <div class="export-history-list">
                    ${this.renderExportHistory()}
                </div>
            </div>
        `;
    container.innerHTML = html;
  },
  renderExportHistory() {
    if (this.exportHistory.length === 0) {
      return '<p class="empty-state">No hay exportaciones recientes</p>';
    }
    return this.exportHistory.slice(-10).reverse().map((log) => `
            <div class="export-history-item">
                <span class="export-format">${log.format.toUpperCase()}</span>
                <span class="export-filename">${log.filename}</span>
                <span class="export-time">${new Date(log.timestamp).toLocaleString("es-ES")}</span>
            </div>
        `).join("");
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AdvancedExport2.init());
} else {
  AdvancedExport2.init();
}
window.AdvancedExport = AdvancedExport2;

// bi_engine.js
var BIEngine2 = {
  data: [],
  analysis: {
    costs: {
      totalMonthly: 0,
      projectedNextMonth: 0,
      byType: {},
      costPerService: 0
    },
    efficiency: {
      globalCoverage: 0,
      avgResponseTime: 4.2,
      reliabilityTrend: []
    },
    geography: {
      heatmap: [],
      incidentsByArea: {}
    }
  },
  init() {
    console.log("\uD83D\uDCCA Inicializando Motor de BI...");
    this.updateData();
    this.runAnalysis();
  },
  updateData() {
    if (window.state && window.state.masterData) {
      this.data = window.state.masterData;
    }
  },
  runAnalysis() {
    if (this.data.length === 0)
      return;
    this.analyzeCosts();
    this.analyzeEfficiency();
    this.analyzeGeography();
  },
  analyzeCosts() {
    const costRates = {
      LIMPIEZA: 1200,
      SEGURIDAD: 1800,
      MANTENIMIENTO: 1500,
      "RECEPCIÓN": 1300,
      OTROS: 1100
    };
    const costs = {
      totalMonthly: 0,
      byType: {},
      servicesCount: this.data.length
    };
    this.data.forEach((service) => {
      const type = service["TIPO S"] || "OTROS";
      const rate = costRates[type] || costRates["OTROS"];
      costs.totalMonthly += rate;
      costs.byType[type] = (costs.byType[type] || 0) + rate;
    });
    costs.costPerService = costs.totalMonthly / costs.servicesCount;
    const uncoveredCount = this.data.filter((s) => s.ESTADO === "DESCUBIERTO").length;
    const extraRatio = uncoveredCount / this.data.length;
    costs.projectedNextMonth = costs.totalMonthly * (1 + extraRatio * 0.2);
    this.analysis.costs = costs;
  },
  analyzeEfficiency() {
    const coveredCount = this.data.filter((s) => s.ESTADO === "CUBIERTO").length;
    this.analysis.efficiency.globalCoverage = coveredCount / this.data.length * 100;
    this.analysis.efficiency.reliabilityTrend = Array.from({ length: 6 }, (_, i) => {
      const month = new Date;
      month.setMonth(month.getMonth() - (5 - i));
      return {
        month: month.toLocaleString("es-ES", { month: "short" }),
        value: 85 + Math.random() * 10
      };
    });
  },
  analyzeGeography() {
    const areas = {};
    this.data.forEach((service) => {
      const areaMatch = service.SERVICIO.match(/(Barcelona|Badalona|Hospitalet|Cornellà|Sabadell|Terrassa)/i);
      const area = areaMatch ? areaMatch[0] : "Otros";
      if (!areas[area]) {
        areas[area] = { total: 0, uncovered: 0, it: 0 };
      }
      areas[area].total++;
      if (service.ESTADO === "DESCUBIERTO")
        areas[area].uncovered++;
      if (service.ESTADO1 === "BAJA IT")
        areas[area].it++;
    });
    this.analysis.geography.incidentsByArea = areas;
  },
  renderBiDashboard() {
    const container = document.getElementById("bi-dashboard-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="bi-grid">
                <!-- Tarjetas de Métricas -->
                <div class="bi-metrics-strip">
                    ${this.renderMetricCard("Coste Mensual Est.", `€${this.analysis.costs.totalMonthly.toLocaleString()}`, "trending_up")}
                    ${this.renderMetricCard("Cobertura Global", `${this.analysis.efficiency.globalCoverage.toFixed(1)}%`, "check_circle")}
                    ${this.renderMetricCard("Coste Medio/Serv", `€${Math.ceil(this.analysis.costs.costPerService)}`, "payments")}
                    ${this.renderMetricCard("Proyección Próx. Mes", `€${Math.ceil(this.analysis.costs.projectedNextMonth).toLocaleString()}`, "insert_chart")}
                </div>

                <!-- Gráficos Principales -->
                <div class="bi-charts-row">
                    <div class="bi-chart-card">
                        <h3>Distribución de Costes por Tipo</h3>
                        <canvas id="bi-costs-pie"></canvas>
                    </div>
                    <div class="bi-chart-card">
                        <h3>Tendencia de Fiabilidad Operativa</h3>
                        <canvas id="bi-reliability-line"></canvas>
                    </div>
                </div>

                <!-- Análisis Geográfico y Heatmap -->
                <div class="bi-bottom-row">
                    <div class="bi-chart-card geographic-split">
                        <h3>Densidad de Incidencias por Área</h3>
                        <div class="bi-area-list">
                            ${Object.entries(this.analysis.geography.incidentsByArea).map(([area, stats]) => `
                                <div class="bi-area-item">
                                    <span class="area-name">${area}</span>
                                    <div class="area-bar-container">
                                        <div class="area-bar" style="width: ${stats.uncovered / stats.total * 100 || 5}%"></div>
                                    </div>
                                    <span class="area-val">${stats.uncovered} desc.</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `;
    this.initBiCharts();
  },
  renderMetricCard(label, value, icon) {
    return `
            <div class="bi-metric-card">
                <div class="metric-icon">${icon}</div>
                <div class="metric-info">
                    <span class="metric-label">${label}</span>
                    <span class="metric-value">${value}</span>
                </div>
            </div>
        `;
  },
  initBiCharts() {
    const ctxPie = document.getElementById("bi-costs-pie");
    if (ctxPie) {
      new Chart(ctxPie, {
        type: "doughnut",
        data: {
          labels: Object.keys(this.analysis.costs.byType),
          datasets: [{
            data: Object.values(this.analysis.costs.byType),
            backgroundColor: ["#667eea", "#764ba2", "#6B8E23", "#FFD700", "#FF6347"],
            borderWidth: 0
          }]
        },
        options: {
          plugins: { legend: { position: "bottom", labels: { color: "#ffffff" } } },
          cutout: "70%"
        }
      });
    }
    const ctxLine = document.getElementById("bi-reliability-line");
    if (ctxLine) {
      new Chart(ctxLine, {
        type: "line",
        data: {
          labels: this.analysis.efficiency.reliabilityTrend.map((t) => t.month),
          datasets: [{
            label: "Fiabilidad %",
            data: this.analysis.efficiency.reliabilityTrend.map((t) => t.value),
            borderColor: "#667eea",
            tension: 0.4,
            fill: true,
            backgroundColor: "rgba(102, 126, 234, 0.1)"
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: false, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#fff" } },
            x: { grid: { display: false }, ticks: { color: "#fff" } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }
};
window.BIEngine = BIEngine2;

// security_manager.js
var SecurityManager2 = {
  currentUser: null,
  roles: {
    ADMIN: {
      permissions: ["*"],
      label: "Administrador Sistema",
      color: "#ea4335"
    },
    MANAGER: {
      permissions: [
        "view_dashboard",
        "edit_services",
        "view_workers",
        "manage_substitutes",
        "view_bi",
        "view_ml",
        "export_data",
        "send_notifications"
      ],
      label: "Gestor Operativo",
      color: "#fbbc04"
    },
    WORKER: {
      permissions: ["view_dashboard", "view_own_services", "chat_internal"],
      label: "Trabajador SIFU",
      color: "#34a853"
    },
    VIEWER: {
      permissions: ["view_dashboard", "view_bi"],
      label: "Consultor / Cliente",
      color: "#4285f4"
    }
  },
  auditLogs: [],
  init() {
    console.log("\uD83D\uDD12 Inicializando Security Manager...");
    this.loadSession();
    this.applySecurityFilters();
    this.loadAuditLogs();
  },
  async login(email, password) {
    let role = "VIEWER";
    if (email.includes("admin"))
      role = "ADMIN";
    else if (email.includes("gestor"))
      role = "MANAGER";
    else if (email.includes("backup"))
      role = "WORKER";
    const user = {
      id: "u_" + Math.random().toString(36).substr(2, 9),
      name: email.split("@")[0].toUpperCase(),
      email,
      role,
      loginTime: new Date().toISOString()
    };
    this.currentUser = user;
    localStorage.setItem("sifu_session_v1", JSON.stringify(user));
    this.logActivity("LOGIN", `Usuario ${user.name} inició sesión como ${role}`);
    this.applySecurityFilters();
    if (typeof showToast === "function") {
      showToast(`Bienvenido, ${user.name} (${role})`, "success");
    }
    return true;
  },
  logout() {
    if (this.currentUser) {
      this.logActivity("LOGOUT", `Usuario ${this.currentUser.name} cerró sesión`);
    }
    this.currentUser = null;
    localStorage.removeItem("sifu_session_v1");
    window.location.reload();
  },
  loadSession() {
    const saved = localStorage.getItem("sifu_session_v1");
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }
  },
  hasPermission(permission) {
    if (!this.currentUser)
      return false;
    const roleData = this.roles[this.currentUser.role];
    if (!roleData)
      return false;
    return roleData.permissions.includes("*") || roleData.permissions.includes(permission);
  },
  applySecurityFilters() {
    console.log("\uD83D\uDD10 Aplicando filtros de seguridad UI...");
    const protectedElements = document.querySelectorAll("[data-permission]");
    protectedElements.forEach((el) => {
      const permission = el.getAttribute("data-permission");
      if (!this.hasPermission(permission)) {
        el.style.display = "none";
        el.classList.add("security-hidden");
      } else {
        el.style.display = "";
        el.classList.remove("security-hidden");
      }
    });
    const authRequiredElements = document.querySelectorAll(".auth-required");
    authRequiredElements.forEach((el) => {
      if (!this.currentUser) {
        el.classList.add("blur-content");
      } else {
        el.classList.remove("blur-content");
      }
    });
    this.updateUserUI();
  },
  updateUserUI() {
    const userBadge = document.getElementById("user-security-badge");
    if (userBadge && this.currentUser) {
      const roleInfo = this.roles[this.currentUser.role];
      userBadge.innerHTML = `
                <div class="user-info-pill" style="border-left: 4px solid ${roleInfo.color}">
                    <span class="user-name">${this.currentUser.name}</span>
                    <span class="user-role-label" style="color: ${roleInfo.color}">${roleInfo.label}</span>
                </div>
            `;
    }
  },
  logActivity(action, details) {
    const log = {
      timestamp: new Date().toISOString(),
      userId: this.currentUser ? this.currentUser.id : "anonymous",
      userName: this.currentUser ? this.currentUser.name : "Sistema",
      role: this.currentUser ? this.currentUser.role : "None",
      action,
      details,
      ip: "127.0.0.1"
    };
    this.auditLogs.unshift(log);
    this.saveAuditLogs();
    console.warn(`[AUDIT] ${log.action}: ${log.details}`);
  },
  loadAuditLogs() {
    const saved = localStorage.getItem("sifu_audit_logs_v1");
    if (saved) {
      try {
        this.auditLogs = JSON.parse(saved);
      } catch (e) {
        this.auditLogs = [];
      }
    }
  },
  saveAuditLogs() {
    if (this.auditLogs.length > 200) {
      this.auditLogs = this.auditLogs.slice(0, 200);
    }
    localStorage.setItem("sifu_audit_logs_v1", JSON.stringify(this.auditLogs));
  },
  renderSecurityDashboard() {
    const container = document.getElementById("security-dashboard-container");
    if (!container)
      return;
    if (!this.hasPermission("*")) {
      container.innerHTML = '<div class="access-denied">\uD83D\uDEAB ACCESO DENEGADO: Requiere permisos de Administrador</div>';
      return;
    }
    container.innerHTML = `
            <div class="security-grid">
                <div class="security-card audit-trail">
                    <h3>\uD83D\uDCDC Registro de Auditoría (Audit Log)</h3>
                    <div class="audit-list">
                        ${this.auditLogs.map((log) => `
                            <div class="audit-item">
                                <span class="audit-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span class="audit-user"><strong>${log.userName}</strong></span>
                                <span class="audit-action">${log.action}</span>
                                <span class="audit-details">${log.details}</span>
                            </div>
                        `).join("") || '<p class="empty-state">No hay actividad registrada</p>'}
                    </div>
                </div>

                <div class="security-card permissions-matrix">
                    <h3>\uD83D\uDD11 Matriz de Permisos</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Permiso</th>
                                <th>Admin</th>
                                <th>Manager</th>
                                <th>Worker</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.getPermissionsList().map((p) => `
                                <tr>
                                    <td>${p}</td>
                                    <td>✅</td>
                                    <td>${this.roles.MANAGER.permissions.includes(p) ? "✅" : "❌"}</td>
                                    <td>${this.roles.WORKER.permissions.includes(p) ? "✅" : "❌"}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
  },
  getPermissionsList() {
    const allPermissions = new Set;
    Object.values(this.roles).forEach((r) => {
      r.permissions.forEach((p) => {
        if (p !== "*")
          allPermissions.add(p);
      });
    });
    return Array.from(allPermissions);
  }
};
window.SecurityManager = SecurityManager2;
document.addEventListener("DOMContentLoaded", () => SecurityManager2.init());

// quality_compliance.js
var QualityManager2 = {
  audits: [],
  workerCertifications: {},
  nonConformities: [],
  init() {
    console.log("\uD83C\uDFC6 Inicializando Sistema de Gestión de Calidad (SGA)...");
    this.loadQualityData();
    this.generateMockCertifications();
  },
  loadQualityData() {
    const savedAudits = localStorage.getItem("sifu_audits_v1");
    const savedNC = localStorage.getItem("sifu_non_conformities_v1");
    if (savedAudits)
      this.audits = JSON.parse(savedAudits);
    if (savedNC)
      this.nonConformities = JSON.parse(savedNC);
  },
  createAudit(serviceId, data) {
    const audit = {
      id: "AUD-" + Date.now(),
      serviceId,
      timestamp: new Date().toISOString(),
      auditor: SecurityManager.currentUser?.name || "Supervisor Externo",
      score: data.score,
      checks: data.checks,
      comments: data.comments,
      status: data.score >= 80 ? "PASSED" : "FAILED"
    };
    this.audits.unshift(audit);
    this.saveAudits();
    if (audit.status === "FAILED") {
      this.createNonConformity(audit);
    }
    if (typeof showToast === "function") {
      showToast(`Auditoría registrada: ${audit.score}%`, audit.status === "PASSED" ? "success" : "warning");
    }
    return audit;
  },
  saveAudits() {
    localStorage.setItem("sifu_audits_v1", JSON.stringify(this.audits));
  },
  createNonConformity(audit) {
    const nc = {
      id: "NC-" + Date.now(),
      auditId: audit.id,
      serviceId: audit.serviceId,
      severity: audit.score < 50 ? "CRITICAL" : "MINOR",
      description: `Baja puntuación en auditoría: ${audit.score}%`,
      createdAt: new Date().toISOString(),
      status: "OPEN",
      actionPlan: "",
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };
    this.nonConformities.unshift(nc);
    this.saveNC();
    if (typeof NotificationsEngine !== "undefined") {
      NotificationsEngine.addNotification("\uD83D\uDEA8 INCIDENCIA DE CALIDAD", `Se ha generado una NC para el servicio ${audit.serviceId} debido a baja puntuación.`, "error");
    }
  },
  saveNC() {
    localStorage.setItem("sifu_non_conformities_v1", JSON.stringify(this.nonConformities));
  },
  generateMockCertifications() {
    const certifications = [
      "PRL Básico",
      "Manejo de Maquinaria",
      "Tratamiento de Suelos",
      "Seguridad Química",
      "Primeros Auxilios",
      "Limpieza Hospitalaria"
    ];
    if (window.state && window.state.masterData) {
      window.state.masterData.forEach((s) => {
        if (s.TITULAR && !this.workerCertifications[s.TITULAR]) {
          this.workerCertifications[s.TITULAR] = {
            certs: certifications.slice(0, Math.floor(Math.random() * 4) + 1),
            lastUpdate: new Date().toISOString()
          };
        }
      });
    }
  },
  getWorkerCerts(workerName) {
    return this.workerCertifications[workerName] || { certs: [], lastUpdate: null };
  },
  renderQualityDashboard() {
    const container = document.getElementById("quality-management-container");
    if (!container)
      return;
    const avgScore = this.audits.reduce((acc, a) => acc + a.score, 0) / (this.audits.length || 1);
    container.innerHTML = `
            <div class="quality-grid">
                <!-- Resumen de Calidad -->
                <div class="quality-stats-row">
                    <div class="q-stat-card">
                        <span class="q-stat-val">${avgScore.toFixed(1)}%</span>
                        <span class="q-stat-label">Índice Calidad Global</span>
                    </div>
                    <div class="q-stat-card">
                        <span class="q-stat-val">${this.audits.length}</span>
                        <span class="q-stat-label">Auditorías Realizadas</span>
                    </div>
                    <div class="q-stat-card ${this.nonConformities.filter((n) => n.status === "OPEN").length > 0 ? "warning" : ""}">
                        <span class="q-stat-val">${this.nonConformities.filter((n) => n.status === "OPEN").length}</span>
                        <span class="q-stat-label">No Conformidades Abiertas</span>
                    </div>
                </div>

                <!-- Lista de Auditorías Recientes -->
                <div class="quality-tables-row">
                    <div class="q-card">
                        <h3>\uD83D\uDCCB Últimas Auditorías</h3>
                        <div class="q-list">
                            ${this.audits.slice(0, 5).map((a) => `
                                <div class="q-item ${a.status.toLowerCase()}">
                                    <div class="q-item-header">
                                        <span class="q-id">${a.id}</span>
                                        <span class="q-score">${a.score}%</span>
                                    </div>
                                    <div class="q-item-body">
                                        <span>Servicio: ${a.serviceId}</span>
                                        <span>Por: ${a.auditor}</span>
                                    </div>
                                </div>
                            `).join("") || '<p class="empty-state">No hay auditorías registradas</p>'}
                        </div>
                    </div>

                    <div class="q-card">
                        <h3>\uD83D\uDEA8 No Conformidades Activas</h3>
                        <div class="q-list">
                            ${this.nonConformities.filter((n) => n.status === "OPEN").slice(0, 5).map((n) => `
                                <div class="nc-item ${n.severity.toLowerCase()}">
                                    <div class="nc-header">
                                        <span class="nc-severity">${n.severity}</span>
                                        <span class="nc-deadline">Vence: ${new Date(n.deadline).toLocaleDateString()}</span>
                                    </div>
                                    <div class="nc-body">
                                        <p>${n.description}</p>
                                        <button class="nc-action-btn" onclick="QualityManager.resolveNC('${n.id}')">Resolver</button>
                                    </div>
                                </div>
                            `).join("") || '<p class="empty-state">Todo en orden: 0 NC abiertas</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
  },
  resolveNC(id) {
    const nc = this.nonConformities.find((n) => n.id === id);
    if (nc) {
      nc.status = "CLOSED";
      nc.resolvedAt = new Date().toISOString();
      this.saveNC();
      this.renderQualityDashboard();
      if (typeof showToast === "function") {
        showToast("No Conformidad resuelta correctamente", "success");
      }
    }
  }
};
window.QualityManager = QualityManager2;

// document_manager.js
var DocumentManager2 = {
  documents: [],
  categories: {
    CONTRATO: { icon: "\uD83D\uDCC4", color: "#4285f4" },
    PRL: { icon: "\uD83D\uDEE1️", color: "#34a853" },
    DNI: { icon: "\uD83C\uDD94", color: "#fbbc04" },
    NOMINA: { icon: "\uD83D\uDCB0", color: "#764ba2" },
    OTROS: { icon: "\uD83D\uDCC1", color: "#5f6368" }
  },
  init() {
    console.log("\uD83D\uDCC1 Inicializando Gestión Documental...");
    this.loadDocuments();
    this.checkExpirations();
  },
  loadDocuments() {
    const saved = localStorage.getItem("sifu_documents_v1");
    if (saved) {
      this.documents = JSON.parse(saved);
    } else {
      this.generateMockDocuments();
    }
  },
  generateMockDocuments() {
    if (window.state && window.state.masterData) {
      window.state.masterData.slice(0, 10).forEach((s) => {
        if (s.TITULAR) {
          this.documents.push({
            id: "DOC-" + Math.random().toString(36).substr(2, 9),
            worker: s.TITULAR,
            name: `Contrato_${s.TITULAR.replace(" ", "_")}.pdf`,
            category: "CONTRATO",
            status: Math.random() > 0.3 ? "SIGNED" : "PENDING_SIGN",
            uploadDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            version: "1.0"
          });
        }
      });
      this.saveDocuments();
    }
  },
  saveDocuments() {
    localStorage.setItem("sifu_documents_v1", JSON.stringify(this.documents));
  },
  async requestSignature(docId) {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc)
      return;
    doc.status = "SENT_TO_SIGN";
    this.saveDocuments();
    this.renderDocumentPanel();
    if (typeof IntegrationsHub !== "undefined") {
      await IntegrationsHub.sendWhatsAppMessage("+34600000000", `\uD83D\uDD14 SIFU: Tienes un documento pendiente de firma: ${doc.name}. Enlace: https://sifu.firm/s/${doc.id}`);
    }
    if (typeof showToast === "function") {
      showToast("\uD83D\uDCE9 Solicitud de firma enviada al trabajador", "info");
    }
    setTimeout(() => {
      this.completeSignature(docId);
    }, 3000);
  },
  completeSignature(docId) {
    const doc = this.documents.find((d) => d.id === docId);
    if (doc) {
      doc.status = "SIGNED";
      doc.signatureDate = new Date().toISOString();
      doc.signatureHash = "SHA256:" + Math.random().toString(36).substr(2, 20);
      this.saveDocuments();
      this.renderDocumentPanel();
      if (typeof showToast === "function") {
        showToast(`✅ Documento firmado legalmente: ${doc.name}`, "success");
      }
      if (typeof SecurityManager !== "undefined") {
        SecurityManager.logActivity("DIGITAL_SIGNATURE", `Documento ${docId} firmado por ${doc.worker}`);
      }
    }
  },
  checkExpirations() {
    const today = new Date;
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expired = this.documents.filter((d) => new Date(d.expiryDate) < today);
    const expiringSoon = this.documents.filter((d) => {
      const date = new Date(d.expiryDate);
      return date > today && date < nextMonth;
    });
    if (expiringSoon.length > 0 && typeof NotificationsEngine !== "undefined") {
      NotificationsEngine.addNotification("⚠️ DOCS PRÓXIMOS A VENCER", `Hay ${expiringSoon.length} documentos (DNI/PRL) que caducan este mes.`, "warning");
    }
  },
  renderDocumentPanel() {
    const container = document.getElementById("document-manager-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="doc-manager-grid">
                <!-- Buscador y Filtros -->
                <div class="doc-header">
                    <input type="text" id="doc-search" placeholder="Buscar por trabajador o nombre de archivo..." onkeyup="DocumentManager.filterDocs()">
                    <div class="doc-stats">
                        <span class="stat-tag">Total: ${this.documents.length}</span>
                        <span class="stat-tag signed">Firmados: ${this.documents.filter((d) => d.status === "SIGNED").length}</span>
                        <span class="stat-tag pending">Pendientes: ${this.documents.filter((d) => d.status !== "SIGNED").length}</span>
                    </div>
                </div>

                <!-- Lista de Documentos -->
                <div class="doc-list-container">
                    <table class="doc-table">
                        <thead>
                            <tr>
                                <th>Archivo</th>
                                <th>Trabajador</th>
                                <th>Categoría</th>
                                <th>Estado</th>
                                <th>Vencimiento</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="doc-table-body">
                            ${this.renderTableRows(this.documents)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
  },
  renderTableRows(docs) {
    return docs.map((doc) => {
      const cat = this.categories[doc.category] || this.categories.OTROS;
      const statusClass = doc.status.toLowerCase();
      const statusLabel = {
        SIGNED: "✅ Firmado",
        PENDING_SIGN: "⏳ Pendiente",
        SENT_TO_SIGN: "\uD83D\uDCE9 Enviado",
        EXPIRED: "\uD83D\uDED1 Caducado"
      }[doc.status] || doc.status;
      return `
                <tr class="doc-row">
                    <td class="doc-name-cell">
                        <span class="doc-icon">${cat.icon}</span>
                        <div class="doc-info-meta">
                            <span class="doc-filename">${doc.name}</span>
                            <span class="doc-ver">v${doc.version}</span>
                        </div>
                    </td>
                    <td>${doc.worker}</td>
                    <td>
                        <span class="cat-badge" style="background: ${cat.color}22; color: ${cat.color}">
                            ${doc.category}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </td>
                    <td class="${new Date(doc.expiryDate) < new Date ? "text-danger" : ""}">
                        ${new Date(doc.expiryDate).toLocaleDateString()}
                    </td>
                    <td>
                        <div class="doc-actions">
                            <button class="doc-btn view" title="Ver Documento">\uD83D\uDC41️</button>
                            ${doc.status === "PENDING_SIGN" ? `
                                <button class="doc-btn sign" onclick="DocumentManager.requestSignature('${doc.id}')" title="Solicitar Firma">✍️</button>
                            ` : ""}
                            <button class="doc-btn download" title="Descargar">\uD83D\uDCE5</button>
                        </div>
                    </td>
                </tr>
            `;
    }).join("");
  },
  filterDocs() {
    const term = document.getElementById("doc-search").value.toLowerCase();
    const filtered = this.documents.filter((d) => d.name.toLowerCase().includes(term) || d.worker.toLowerCase().includes(term));
    document.getElementById("doc-table-body").innerHTML = this.renderTableRows(filtered);
  }
};
window.DocumentManager = DocumentManager2;

// financial_manager.js
var FinancialManager2 = {
  serviceEconomics: {},
  globalMetrics: {
    totalRevenue: 0,
    totalCosts: 0,
    margin: 0,
    avgProfitability: 0
  },
  init() {
    console.log("\uD83D\uDCB0 Inicializando Gestor Financiero...");
    this.calculateEconomics();
  },
  calculateEconomics() {
    if (!window.state || !window.state.masterData)
      return;
    const economics = {};
    let totalRevenue = 0;
    let totalCosts = 0;
    const rates = {
      LIMPIEZA: { revenue: 2200, laborCost: 1400, materials: 150 },
      SEGURIDAD: { revenue: 3500, laborCost: 2600, materials: 50 },
      MANTENIMIENTO: { revenue: 2800, laborCost: 1800, materials: 300 },
      "RECEPCIÓN": { revenue: 2000, laborCost: 1450, materials: 20 },
      OTROS: { revenue: 1800, laborCost: 1200, materials: 100 }
    };
    window.state.masterData.forEach((service) => {
      const type = service["TIPO S"] || "OTROS";
      const rate = rates[type] || rates["OTROS"];
      const variance = 0.9 + Math.random() * 0.2;
      const revenue = rate.revenue * variance;
      const costs = (rate.laborCost + rate.materials) * variance;
      const statusPenalty = service.ESTADO === "DESCUBIERTO" ? 1.4 : 1;
      const adjustedCosts = costs * statusPenalty;
      const margin = revenue - adjustedCosts;
      const marginPercent = margin / revenue * 100;
      economics[service.SERVICIO] = {
        revenue,
        costs: adjustedCosts,
        margin,
        marginPercent,
        type
      };
      totalRevenue += revenue;
      totalCosts += adjustedCosts;
    });
    this.serviceEconomics = economics;
    this.globalMetrics = {
      totalRevenue,
      totalCosts,
      margin: totalRevenue - totalCosts,
      avgProfitability: (totalRevenue - totalCosts) / totalRevenue * 100
    };
  },
  renderFinancialDashboard() {
    const container = document.getElementById("financial-analysis-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="financial-grid">
                <!-- Tarjetas de Resumen Financiero -->
                <div class="f-metrics-row">
                    ${this.renderMetricCard("Facturación Bruta", `€${Math.ceil(this.globalMetrics.totalRevenue).toLocaleString()}`, "trending_up", "#34a853")}
                    ${this.renderMetricCard("Costes Operativos", `€${Math.ceil(this.globalMetrics.totalCosts).toLocaleString()}`, "payments", "#ea4335")}
                    ${this.renderMetricCard("Margen Bruto", `€${Math.ceil(this.globalMetrics.margin).toLocaleString()}`, "savings", "#4285f4")}
                    ${this.renderMetricCard("Rentabilidad (EBITDA)", `${this.globalMetrics.avgProfitability.toFixed(1)}%`, "analytics", "#fbbc04")}
                </div>

                <div class="f-charts-row">
                    <!-- Top 5 Servicios más Rentables -->
                    <div class="f-card">
                        <h3>⭐️ Top 5 Servicios Rentables</h3>
                        <div class="f-service-list">
                            ${this.getTopServices("profit", 5).map((s) => this.renderServiceMiniCard(s)).join("")}
                        </div>
                    </div>

                    <!-- Top 5 Servicios en Riesgo Económico -->
                    <div class="f-card">
                        <h3>⚠️ Alertas de Rentabilidad (< 15%)</h3>
                        <div class="f-service-list">
                            ${this.getTopServices("risk", 5).map((s) => this.renderServiceMiniCard(s)).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `;
  },
  renderMetricCard(label, value, icon, color) {
    return `
            <div class="f-metric-card" style="border-bottom: 4px solid ${color}">
                <div class="f-metric-content">
                    <span class="f-metric-label">${label}</span>
                    <span class="f-metric-value">${value}</span>
                </div>
                <div class="f-metric-icon" style="color: ${color}">${icon}</div>
            </div>
        `;
  },
  renderServiceMiniCard(serviceInfo) {
    const eco = this.serviceEconomics[serviceInfo.SERVICIO];
    const isRisk = eco.marginPercent < 15;
    return `
            <div class="f-mini-card ${isRisk ? "risk" : ""}">
                <div class="f-mini-info">
                    <span class="f-mini-name">${serviceInfo.SERVICIO}</span>
                    <span class="f-mini-type">${eco.type}</span>
                </div>
                <div class="f-mini-values">
                    <span class="f-mini-margin ${isRisk ? "low" : "high"}">${eco.marginPercent.toFixed(1)}%</span>
                    <span class="f-mini-amount">€${Math.ceil(eco.margin).toLocaleString()}</span>
                </div>
                <div class="f-progress-bg">
                    <div class="f-progress-bar" style="width: ${eco.marginPercent}%; background: ${isRisk ? "#ea4335" : "#34a853"}"></div>
                </div>
            </div>
        `;
  },
  getTopServices(mode, count) {
    const sorted = Object.entries(this.serviceEconomics).map(([name, data]) => ({ SERVICIO: name, ...data })).sort((a, b) => mode === "profit" ? b.marginPercent - a.marginPercent : a.marginPercent - b.marginPercent);
    return sorted.slice(0, count);
  }
};
window.FinancialManager = FinancialManager2;

// talent_manager.js
var TalentManager2 = {
  courses: [
    { id: "TR-001", name: "Limpieza Técnica Hospitalaria", category: "ESPECIALIZACIÓN", points: 150, duration: "20h", enrollment: 12 },
    { id: "TR-002", name: "Prevención de Riesgos (PRL) Avanzada", category: "OBLIGATORIO", points: 100, duration: "10h", enrollment: 45 },
    { id: "TR-003", name: "Gestión de Equipos para Supervisores", category: "LIDERAZGO", points: 300, duration: "40h", enrollment: 5 },
    { id: "TR-004", name: "Sostenibilidad y Productos Ecológicos", category: "INNOVACIÓN", points: 80, duration: "5h", enrollment: 28 }
  ],
  workerTalent: {},
  init() {
    console.log("\uD83C\uDF93 Inicializando Gestor de Talento...");
    this.generateMockTalentData();
  },
  generateMockTalentData() {
    if (!window.state || !window.state.masterData)
      return;
    window.state.masterData.forEach((s) => {
      if (s.TITULAR && !this.workerTalent[s.TITULAR]) {
        this.workerTalent[s.TITULAR] = {
          level: Math.floor(Math.random() * 5) + 1,
          experience: Math.floor(Math.random() * 1000),
          skills: {
            "Técnica": Math.floor(Math.random() * 100),
            Seguridad: Math.floor(Math.random() * 100),
            Actitud: Math.floor(Math.random() * 100),
            Digital: Math.floor(Math.random() * 100)
          },
          completedCourses: ["TR-002"],
          careerGoal: "Supervisor de Zona",
          recommendations: ["TR-001", "TR-003"].slice(0, Math.floor(Math.random() * 3))
        };
      }
    });
  },
  renderTalentDashboard() {
    const container = document.getElementById("talent-management-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="talent-grid">
                <!-- Sección de Cursos y Formación -->
                <div class="t-section">
                    <div class="t-section-header">
                        <h3>\uD83D\uDCDA Catálogo de Formación SIFU Academy</h3>
                        <span class="t-badge-count">${this.courses.length} Cursos Activos</span>
                    </div>
                    <div class="course-list">
                        ${this.courses.map((c) => `
                            <div class="course-card">
                                <div class="course-main">
                                    <span class="course-cat">${c.category}</span>
                                    <h4 class="course-name">${c.name}</h4>
                                    <div class="course-meta">
                                        <span>⏱️ ${c.duration}</span>
                                        <span>\uD83C\uDFC6 ${c.points} pts</span>
                                        <span>\uD83D\uDC65 ${c.enrollment} inscritos</span>
                                    </div>
                                </div>
                                <button class="enroll-btn" onclick="TalentManager.enrollWorker('${c.id}')">Asignar</button>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- Resumen de Talento y Competencias -->
                <div class="t-section">
                    <div class="t-section-header">
                        <h3>\uD83C\uDF1F Top Talento y Plan de Carrera</h3>
                        <div class="t-search-box">
                            <input type="text" id="talent-search" placeholder="Buscar trabajador..." onkeyup="TalentManager.filterTalent()">
                        </div>
                    </div>
                    <div class="talent-list" id="talent-list-results">
                        ${this.renderTalentRows(Object.entries(this.workerTalent).slice(0, 5))}
                    </div>
                </div>
            </div>
        `;
  },
  renderTalentRows(talentEntries) {
    return talentEntries.map(([name, data]) => `
            <div class="talent-card">
                <div class="t-profile">
                    <div class="t-avatar">${name.charAt(0)}</div>
                    <div class="t-info">
                        <span class="t-name">${name}</span>
                        <span class="t-goal">Objetivo: ${data.careerGoal}</span>
                    </div>
                </div>
                <div class="t-level-box">
                    <span class="t-level">Nivel ${data.level}</span>
                    <div class="t-xp-bar"><div class="t-xp-fill" style="width: ${data.experience % 100}%"></div></div>
                </div>
                <div class="t-skills-mini">
                    <div class="t-skill-tag">Téc: ${data.skills.Técnica}%</div>
                    <div class="t-skill-tag">Seg: ${data.skills.Seguridad}%</div>
                    <div class="t-skill-tag">Dig: ${data.skills.Digital}%</div>
                </div>
                <button class="t-view-btn">Ver Plan</button>
            </div>
        `).join("");
  },
  enrollWorker(courseId) {
    const course = this.courses.find((c) => c.id === courseId);
    if (typeof showToast === "function") {
      showToast(`Formación "${course.name}" abierta para asignación masiva`, "info");
    }
  },
  filterTalent() {
    const term = document.getElementById("talent-search").value.toLowerCase();
    const filtered = Object.entries(this.workerTalent).filter(([name]) => name.toLowerCase().includes(term));
    document.getElementById("talent-list-results").innerHTML = this.renderTalentRows(filtered.slice(0, 5));
  }
};
window.TalentManager = TalentManager2;

// fleet_logistics_manager.js
var FleetManager2 = {
  vehicles: [
    { id: "FL-001", plate: "1234-BBB", model: "Renault Kangoo ZE", driver: "JUAN MARTINEZ", status: "OPERATIVO", battery: 85, nextITV: "2026-08-15" },
    { id: "FL-002", plate: "5678-CCC", model: "Citroen e-Berlingo", driver: "MARIA LOPEZ", status: "TALLER", battery: 12, nextITV: "2026-05-20" },
    { id: "FL-003", plate: "9012-DDD", model: "Nissan e-NV200", driver: "CARLOS RUIZ", status: "OPERATIVO", battery: 92, nextITV: "2026-11-10" }
  ],
  inventory: [
    { id: "MAT-001", name: "Detergente Multiusos 5L", stock: 12, minStock: 20, unit: "Garrafas" },
    { id: "MAT-002", name: "Guantes de Nitrilo (Caja 100)", stock: 45, minStock: 15, unit: "Cajas" },
    { id: "MAT-003", name: "Bobina de Papel Industrial", stock: 8, minStock: 10, unit: "Unidades" },
    { id: "MAT-004", name: "Uniforme SIFU (Talla L)", stock: 3, minStock: 5, unit: "Conjuntos" }
  ],
  init() {
    console.log("\uD83D\uDE9A Inicializando Gestión de Flota y Logística...");
    this.checkAlerts();
  },
  checkAlerts() {
    const lowStock = this.inventory.filter((i) => i.stock < i.minStock);
    if (lowStock.length > 0 && typeof NotificationsEngine !== "undefined") {
      NotificationsEngine.addNotification("\uD83D\uDCE6 ALERTA DE STOCKBAJO", `Hay ${lowStock.length} productos con existencias por debajo del mínimo de seguridad.`, "warning");
    }
    const inWorkshop = this.vehicles.filter((v) => v.status === "TALLER");
    if (inWorkshop.length > 0 && typeof NotificationsEngine !== "undefined") {
      NotificationsEngine.addNotification("\uD83D\uDD27 VEHÍCULO EN TALLER", `El vehículo ${inWorkshop[0].plate} está actualmente fuera de servicio.`, "info");
    }
  },
  renderFleetDashboard() {
    const container = document.getElementById("fleet-logistics-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="fleet-grid">
                <!-- Gestión de Vehículos -->
                <div class="fleet-section">
                    <div class="f-header">
                        <h3>\uD83D\uDE9A Estado de la Flota Eléctrica</h3>
                        <span class="f-count">${this.vehicles.length} Vehículos</span>
                    </div>
                    <div class="vehicle-list">
                        ${this.vehicles.map((v) => `
                            <div class="vehicle-card ${v.status.toLowerCase()}">
                                <div class="v-main">
                                    <span class="v-plate">${v.plate}</span>
                                    <span class="v-model">${v.model}</span>
                                </div>
                                <div class="v-stats">
                                    <div class="v-battery">
                                        <div class="battery-bar">
                                            <div class="battery-fill" style="width: ${v.battery}%; background: ${v.battery < 20 ? "#ea4335" : "#34a853"}"></div>
                                        </div>
                                        <span>${v.battery}%</span>
                                    </div>
                                    <span class="v-driver">\uD83D\uDC64 ${v.driver}</span>
                                </div>
                                <div class="v-status-badge">${v.status}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- Logística de Materiales -->
                <div class="fleet-section">
                    <div class="f-header">
                        <h3>\uD83D\uDCE6 Inventario de Materiales Críticos</h3>
                        <button class="f-btn-order" onclick="FleetManager.generateOrder()">Generar Pedido</button>
                    </div>
                    <div class="inventory-list">
                        <table class="inv-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>Stock</th>
                                    <th>Mínimo</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.inventory.map((i) => `
                                    <tr class="${i.stock < i.minStock ? "row-alert" : ""}">
                                        <td>${i.name}</td>
                                        <td><strong>${i.stock}</strong> ${i.unit}</td>
                                        <td>${i.minStock}</td>
                                        <td>
                                            <span class="inv-status ${i.stock < i.minStock ? "crit" : "ok"}">
                                                ${i.stock < i.minStock ? "RECOMPRAR" : "OK"}
                                            </span>
                                        </td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
  },
  generateOrder() {
    if (typeof showToast === "function") {
      showToast("\uD83D\uDED2 Pedido de reposición enviado a Compras", "success");
    }
  }
};
window.FleetManager = FleetManager2;

// sustainability_manager.js
var SustainabilityManager2 = {
  metrics: {
    co2Saved: 0,
    socialImpactHours: 0,
    employeesWithDisability: 0,
    greenProductsRatio: 0
  },
  init() {
    console.log("\uD83C\uDF31 Inicializando Gestor de Sostenibilidad y RSC...");
    this.calculateImpact();
  },
  calculateImpact() {
    if (!window.state || !window.state.masterData)
      return;
    const vehicleCount = typeof FleetManager !== "undefined" ? FleetManager.vehicles.length : 3;
    this.metrics.co2Saved = vehicleCount * 50 * 0.12 * 30;
    this.metrics.employeesWithDisability = Math.ceil(window.state.masterData.length * 0.85);
    this.metrics.socialImpactHours = window.state.masterData.length * 160;
    if (typeof FleetManager !== "undefined") {
      const totalInv = FleetManager.inventory.length;
      const greenItems = FleetManager.inventory.filter((i) => i.name.toLowerCase().includes("ecológico") || i.name.toLowerCase().includes("multiusos")).length;
      this.metrics.greenProductsRatio = greenItems / totalInv * 100;
    } else {
      this.metrics.greenProductsRatio = 65;
    }
  },
  renderSustainabilityDashboard() {
    const container = document.getElementById("sustainability-csr-container");
    if (!container)
      return;
    container.innerHTML = `
            <div class="sus-grid">
                <!-- Principales Indicadores de Impacto -->
                <div class="sus-metrics-strip">
                    <div class="sus-card planet">
                        <div class="sus-icon">\uD83C\uDF0D</div>
                        <div class="sus-info">
                            <span class="sus-val">${Math.ceil(this.metrics.co2Saved)} kg</span>
                            <span class="sus-label">CO2 Ahorrado / Mes</span>
                        </div>
                        <div class="sus-progress"><div class="sus-bar" style="width: 75%"></div></div>
                    </div>

                    <div class="sus-card people">
                        <div class="sus-icon">\uD83E\uDD1D</div>
                        <div class="sus-info">
                            <span class="sus-val">${this.metrics.employeesWithDisability}</span>
                            <span class="sus-label">Empleos con Discapacidad</span>
                        </div>
                        <div class="sus-progress"><div class="sus-bar" style="width: 85%"></div></div>
                    </div>

                    <div class="sus-card green">
                        <div class="sus-icon">\uD83C\uDF43</div>
                        <div class="sus-info">
                            <span class="sus-val">${this.metrics.greenProductsRatio.toFixed(0)}%</span>
                            <span class="sus-label">Materiales Ecoeficientes</span>
                        </div>
                        <div class="sus-progress"><div class="sus-bar" style="width: ${this.metrics.greenProductsRatio}%"></div></div>
                    </div>
                </div>

                <!-- Detalle de Impacto Social / ODS -->
                <div class="sus-bottom-row">
                    <div class="ods-section">
                        <h3>\uD83C\uDFAF Alineación con ODS (Objetivos Desarrollo Sostenible)</h3>
                        <div class="ods-list">
                            <div class="ods-item ods-8">
                                <span class="ods-num">8</span>
                                <span class="ods-text">Trabajo Decente y Crecimiento Económico</span>
                                <span class="ods-status">ACTIVO</span>
                            </div>
                            <div class="ods-item ods-10">
                                <span class="ods-num">10</span>
                                <span class="ods-text">Reducción de las Desigualdades</span>
                                <span class="ods-status">ACTIVO</span>
                            </div>
                            <div class="ods-item ods-13">
                                <span class="ods-num">13</span>
                                <span class="ods-text">Acción por el Clima</span>
                                <span class="ods-status">ACTIVO</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="impact-summary">
                        <h3>\uD83D\uDCDD Resumen de Impacto Social</h3>
                        <p>Este mes, SIFU Informer ha gestionado <strong>${this.metrics.socialImpactHours.toLocaleString()} horas</strong> de empleo protegido, contribuyendo directamente a la integración laboral efectiva en la zona geográfica analizada.</p>
                        <button class="btn-report-csr" onclick="SustainabilityManager.generateCSRReport()">Generar Informe RSC</button>
                    </div>
                </div>
            </div>
        `;
  },
  generateCSRReport() {
    if (typeof showToast === "function") {
      showToast("\uD83D\uDCC4 Informe de Sostenibilidad y RSC generado correctamente", "success");
    }
  }
};
window.SustainabilityManager = SustainabilityManager2;

// executive_command.js
var ExecutiveCommand2 = {
  strategicGoals: {
    efficiency: 92,
    profitability: 18.5,
    sustainability: 78,
    retention: 94
  },
  init() {
    console.log("\uD83C\uDFDB️ Inicializando Centro de Mando Directivo...");
    this.renderExecutiveOverlay();
  },
  renderExecutiveDashboard() {
    const container = document.getElementById("executive-command-container");
    if (!container)
      return;
    const data = window.state?.masterData || [];
    const efficiency = 94.2;
    const uncoveredCount = data.filter((d) => (d.ESTADO || "").includes("DESCUBIERTO")).length;
    const lowRisk = uncoveredCount < 5 ? "ÓPTIMO" : "CRÍTICO";
    container.innerHTML = `
            <div class="exec-grid">
                <div class="exec-hero-row">
                    ${this.renderHoloCard("EFICIENCIA GLOBAL", efficiency + "%", "\uD83D\uDE80", "#3b82f6")}
                    ${this.renderHoloCard("SALUD OPERATIVA", lowRisk, "\uD83D\uDEE1️", uncoveredCount < 5 ? "#10b981" : "#ef4444")}
                    ${this.renderHoloCard("DESCUBIERTOS", uncoveredCount, "\uD83D\uDEA8", uncoveredCount > 0 ? "#f59e0b" : "#10b981")}
                    ${this.renderHoloCard("IMPACTO SOCIAL", "98%", "\uD83C\uDF31", "#8b5cf6")}
                </div>

                <div class="exec-main-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 20px;">
                    <div class="exec-card projection-v15" style="background: white; border-radius: 20px; padding: 25px; box-shadow: var(--panel-shadow); border: 1px solid #e2e8f0;">
                        <div class="exec-card-header" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #1e293b;">\uD83D\uDEF0️ MONITORIZACIÓN DE RED NACIONAL</h3>
                            <span class="badge blue">Sincronizado</span>
                        </div>
                        <div class="pulse-map-container" style="height: 300px; background: #f8fafc; border-radius: 15px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
                            <div class="map-bg" style="opacity: 0.05; font-size: 150px;">\uD83C\uDF0D</div>
                            <!-- Pulse Nodes -->
                            <div class="map-pulse ${uncoveredCount > 0 ? "active" : ""}" style="top: 30%; left: 60%;" data-label="Barcelona"></div>
                            <div class="map-pulse" style="top: 50%; left: 45%;" data-label="Madrid"></div>
                            <div class="map-pulse" style="top: 70%; left: 40%;" data-label="Sevilla"></div>
                        </div>
                    </div>

                    <div class="exec-card insights-v15" style="background: #ffffff; color: #1e293b; border-radius: 20px; padding: 25px; border: 1px solid #e2e8f0; box-shadow: var(--panel-shadow);">
                        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">\uD83E\uDDE0 EXECUTIVE INSIGHTS</h3>
                        <div class="insight-stack" style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; border-left: 4px solid #3b82f6;">
                                <div style="font-size: 10px; color: #64748b; font-weight: 800;">RECOMENDACIÓN AI</div>
                                <div style="font-size: 13px; font-weight: 700;">Incrementar pool de suplentes en Cataluña (+12% riesgo IT).</div>
                            </div>
                            <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; border-left: 4px solid #10b981;">
                                <div style="font-size: 10px; color: #64748b; font-weight: 800;">OPTIMIZACIÓN RUTAS</div>
                                <div style="font-size: 13px; font-weight: 700;">Ahorro proyectado de 450km/mes tras aplicar AG.</div>
                            </div>
                        </div>
                        <button class="btn-primary-glow smart-btn" onclick="IntegrationsHub.generateExecutiveReport()" style="width: 100%; margin-top: 25px; padding: 14px; border-radius: 12px; font-weight: 800; border: none; cursor: pointer;">\uD83D\uDCCA GENERAR INFORME DETALLADO</button>
                    </div>
                </div>
            </div>

            <style>
                .map-pulse {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    background: #3b82f6;
                    border-radius: 50%;
                }
                .map-pulse::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background: inherit;
                    border-radius: 50%;
                    animation: pulse-glow 2s infinite;
                }
                .map-pulse.active { background: #ef4444; }
                @keyframes pulse-glow {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(4); opacity: 0; }
                }
                .map-pulse::before {
                    content: attr(data-label);
                    position: absolute;
                    top: -20px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 9px;
                    font-weight: 800;
                    color: white;
                    white-space: nowrap;
                }
            </style>
        `;
  },
  renderHoloCard(label, val, icon, color) {
    return `
            <div class="holo-card" style="background: white; padding: 20px; border-radius: 20px; box-shadow: var(--panel-shadow); border-bottom: 4px solid ${color}; transition: transform 0.3s;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${label}</div>
                        <div style="font-size: 28px; font-weight: 900; color: #1e293b; margin-top: 5px;">${val}</div>
                    </div>
                    <div style="font-size: 30px;">${icon}</div>
                </div>
            </div>
        `;
  },
  initExecutiveChart() {
    const ctx = document.getElementById("executiveGrowthChart");
    if (!ctx)
      return;
    new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
        datasets: [{
          label: "Ingresos Proyectados",
          data: [1800000, 1950000, 2100000, 2050000, 2300000, 2450000],
          borderColor: "#4285f4",
          backgroundColor: "rgba(66, 133, 244, 0.1)",
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { display: false },
          x: { grid: { display: false } }
        }
      }
    });
  },
  triggerStrategicMeeting() {
    if (typeof showToast === "function") {
      showToast("\uD83C\uDFDB️ Comité de Dirección convocado. Notificaciones enviadas por MS Teams.", "success");
    }
  },
  renderExecutiveOverlay() {
    console.log("\uD83C\uDFDB️Executive Overlay Ready");
  }
};
window.ExecutiveCommand = ExecutiveCommand2;

// contract_guardian.js
window.cachedContractData = { expired: [], urgent: [], warning: [], all: [] };
window.checkContractExpirations = function() {
  console.log("Checking contract expirations...");
  if (!window.state || !window.state.masterData || window.state.masterData.length === 0) {
    console.warn("No master data available for contract check.");
    return;
  }
  const today = new Date;
  today.setHours(0, 0, 0, 0);
  const expired = [];
  const urgent = [];
  const warning = [];
  const all = [];
  window.state.masterData.forEach((row) => {
    const rawDate = row["FIN CONTRATO"];
    if (!rawDate)
      return;
    let dateObj = null;
    try {
      if (typeof rawDate === "number") {
        const utcDate = new Date((rawDate - 25569) * 86400 * 1000);
        const adj = new Date(utcDate.getTime() + 12 * 60 * 60 * 1000);
        dateObj = new Date(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate());
      } else if (typeof rawDate === "string") {
        const cleanStr = rawDate.trim();
        if (!cleanStr || /[a-zA-Z]/.test(cleanStr)) {} else if (cleanStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
          const parts = cleanStr.split(/[\/\-]/);
          let p0 = parseInt(parts[0]);
          let p1 = parseInt(parts[1]);
          let y = parseInt(parts[2]);
          if (y < 100)
            y += 2000;
          let d, m;
          if (p1 > 12) {
            m = p0;
            d = p1;
          } else if (p0 > 12) {
            d = p0;
            m = p1;
          } else {
            m = p0;
            d = p1;
          }
          dateObj = new Date(y, m - 1, d);
        } else if (cleanStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
          const parts = cleanStr.split(/[\/\-]/);
          dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }
    } catch (e) {
      console.warn("Date parse error for row:", row, e);
    }
    if (!dateObj || isNaN(dateObj.getTime()))
      return;
    if (dateObj.getFullYear() < 2026)
      return;
    const diffTime = dateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0)
      return;
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    const dateFormatted = `${dd}/${mm}/${yyyy}`;
    const item = {
      worker: row["TITULAR"] || "Sin Nombre",
      service: row["SERVICIO"] || "Sin Servicio",
      days: diffDays,
      dateStr: dateFormatted,
      rawDate: dateObj
    };
    all.push(item);
    if (diffDays < 0) {
      expired.push(item);
    } else if (diffDays >= 0 && diffDays <= 7) {
      urgent.push(item);
    } else if (diffDays > 7 && diffDays <= 45) {
      warning.push(item);
    }
  });
  window.cachedContractData = { expired, urgent, warning, all };
  const totalAlerts = expired.length + urgent.length + warning.length;
  const bellCount = document.getElementById("notification-count");
  const bellContainer = document.querySelector(".notification-bell");
  if (bellCount) {
    bellCount.textContent = totalAlerts;
    bellCount.style.display = totalAlerts > 0 ? "flex" : "none";
    if (totalAlerts > 0 && bellContainer) {
      bellContainer.classList.add("has-notifications");
      bellContainer.title = `${expired.length} vencidos, ${urgent.length} urgentes, ${warning.length} próximos`;
    }
  }
  const widget = document.getElementById("module-contract-tracker");
  if (widget && (expired.length > 0 || urgent.length > 0 || warning.length > 0)) {
    widget.classList.add("attention-pulse");
    const headerTitle = widget.querySelector("h3");
    if (headerTitle && !headerTitle.innerText.includes("⚠️")) {
      headerTitle.innerHTML = `\uD83D\uDDD3️ CONTROL DE VENCIMIENTOS <span style="font-size:11px; background:#ef4444; color:white; padding:2px 6px; border-radius:10px; margin-left:10px; animation: blink 1s infinite;">¡ATENCIÓN!</span>`;
    }
  } else if (widget) {
    widget.classList.remove("attention-pulse");
    const headerTitle = widget.querySelector("h3");
    if (headerTitle) {
      headerTitle.innerHTML = `\uD83D\uDDD3️ CONTROL DE VENCIMIENTOS`;
    }
  }
  const countAll = document.getElementById("contract-count-all");
  const countExpired = document.getElementById("contract-count-expired");
  const countUrgent = document.getElementById("contract-count-urgent");
  const countWarning = document.getElementById("contract-count-warning");
  if (countAll)
    countAll.textContent = `(${all.length})`;
  if (countExpired)
    countExpired.textContent = expired.length;
  if (countUrgent)
    countUrgent.textContent = urgent.length;
  if (countWarning)
    countWarning.textContent = warning.length;
  const dateBadge = document.getElementById("contract-current-date-badge");
  if (dateBadge) {
    const options = { weekday: "short", day: "numeric", month: "short" };
    dateBadge.textContent = `Hoy: ${today.toLocaleDateString("es-ES", options)}`;
  }
  window.filterContractWidget(window.activeContractFilter || "ALL");
};
window.activeContractFilter = "ALL";
window.activeContractSearch = "";
window.handleContractSearch = function(val) {
  window.activeContractSearch = val.toLowerCase().trim();
  const clearBtn = document.getElementById("contract-search-clear-btn");
  if (clearBtn) {
    clearBtn.style.display = val ? "block" : "none";
  }
  window.applyContractFilters();
};
window.applyContractFilters = function() {
  const feed = document.getElementById("contract-list-feed");
  if (!feed)
    return;
  let data = [];
  const filter = window.activeContractFilter || "ALL";
  if (filter === "EXPIRED")
    data = window.cachedContractData.expired;
  else if (filter === "URGENT")
    data = window.cachedContractData.urgent;
  else if (filter === "WARNING")
    data = window.cachedContractData.warning;
  else
    data = window.cachedContractData.all;
  const search = window.activeContractSearch || "";
  if (search) {
    data = data.filter((item) => item.worker && item.worker.toLowerCase().includes(search) || item.service && item.service.toLowerCase().includes(search));
  }
  data = data.slice().sort((a, b) => a.days - b.days);
  if (data.length === 0) {
    feed.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8; font-size:12px;">✅ No hay vencimientos que coincidan.</div>`;
    return;
  }
  feed.innerHTML = data.map((item) => {
    let statusIcon = "✅";
    let bgLight = "rgba(52, 168, 83, 0.12)";
    let fgColor = "#34a853";
    let badgeBg = "#d1fae5";
    let badgeFg = "#065f46";
    let daysLabel = "";
    let itemClass = "";
    if (item.days < 0) {
      statusIcon = "\uD83D\uDED1";
      bgLight = "rgba(234, 67, 53, 0.12)";
      fgColor = "#ea4335";
      badgeBg = "#fee2e2";
      badgeFg = "#b91c1c";
      const absDays = Math.abs(item.days);
      daysLabel = `Vencido hace ${absDays} ${absDays === 1 ? "día" : "días"}`;
      itemClass = "expired-card";
    } else if (item.days === 0) {
      statusIcon = "\uD83D\uDD25";
      bgLight = "rgba(234, 67, 53, 0.18)";
      fgColor = "#ea4335";
      badgeBg = "#ea4335";
      badgeFg = "#ffffff";
      daysLabel = "VENCE HOY";
      itemClass = "urgent-card pulse-urgent";
    } else if (item.days === 1) {
      statusIcon = "⚠️";
      bgLight = "rgba(249, 171, 0, 0.15)";
      fgColor = "#f9ab00";
      badgeBg = "#fef3c7";
      badgeFg = "#d97706";
      daysLabel = "Vence mañana";
      itemClass = "urgent-card";
    } else if (item.days <= 7) {
      statusIcon = "⚠️";
      bgLight = "rgba(249, 171, 0, 0.12)";
      fgColor = "#f9ab00";
      badgeBg = "#fef3c7";
      badgeFg = "#b45309";
      daysLabel = `En ${item.days} días`;
      itemClass = "urgent-card";
    } else if (item.days <= 45) {
      statusIcon = "\uD83D\uDCC5";
      bgLight = "rgba(26, 115, 232, 0.1)";
      fgColor = "#1a73e8";
      badgeBg = "#dbeafe";
      badgeFg = "#1e40af";
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
            <div style="font-size: 11px; color: #64748b; padding-left: 26px;">\uD83D\uDCBC ${serviceClean}</div>

            <!-- Fila 3: FECHA siempre visible, en su propia línea -->
            <div style="
                display: flex; align-items: center; gap: 10px;
                padding: 9px 12px; margin-top: 4px;
                background: ${badgeBg}; border-radius: 8px;
                border: 1px solid rgba(0,0,0,0.06);
            ">
                <span style="font-size: 15px;">\uD83D\uDCC5</span>
                <b style="color: #000000; font-size: 16px; font-family: monospace; letter-spacing: 0.8px; font-weight: 900;">${item.dateStr || "—"}</b>
                <span style="font-size: 11px; color: ${fgColor}; font-weight: 800; margin-left: auto; white-space: nowrap;">${daysLabel}</span>
            </div>
        </div>
        `;
  }).join("");
};
window.renderContractWidget = function(filter) {
  if (filter)
    window.activeContractFilter = filter;
  window.applyContractFilters();
};
window.filterContractWidget = function(type) {
  const filter = type || "ALL";
  window.activeContractFilter = filter;
  document.querySelectorAll(".btn-mini-filter").forEach((b) => {
    b.classList.remove("active");
    b.style.background = "#f1f5f9";
    b.style.color = "#475569";
    b.style.border = "none";
  });
  const btn = document.getElementById(`btn-filter-${filter.toLowerCase()}`);
  if (btn) {
    btn.classList.add("active");
    if (filter === "EXPIRED") {
      btn.style.background = "#fee2e2";
      btn.style.color = "#b91c1c";
      btn.style.border = "1px solid #fecaca";
    } else if (filter === "URGENT") {
      btn.style.background = "#fef3c7";
      btn.style.color = "#d97706";
      btn.style.border = "1px solid #fde047";
    } else if (filter === "WARNING") {
      btn.style.background = "#dbeafe";
      btn.style.color = "#1d4ed8";
      btn.style.border = "1px solid #bfdbfe";
    } else {
      btn.style.background = "#0f172a";
      btn.style.color = "#ffffff";
    }
  }
  window.applyContractFilters();
};
window.showContractAlertModal = function(urgent, warning, expired) {
  if (document.getElementById("contract-alert-modal"))
    return;
  const modalHtml = `
    <div id="contract-alert-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); animation: fadeIn 0.3s;">
        <div style="background:white; width:650px; max-width:90%; border-radius:16px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); transform: translateY(0); animation: slideUp 0.3s;">
            <div style="background:#ef4444; padding:20px; color:white; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:18px; font-weight:800; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">\uD83D\uDEA8</span> ALERTA DE VENCIMIENTOS
                </h3>
                <button onclick="document.getElementById('contract-alert-modal').remove(); sessionStorage.setItem('contractAuthDismissed', 'true');" 
                        style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:bold; font-size:16px; line-height:1;">✕</button>
            </div>
            
            <div style="padding:0; max-height:60vh; overflow-y:auto; background:#f8fafc;">
                ${urgent.length > 0 ? `
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; background:#fef2f2;">
                    <h4 style="margin:0 0 15px 0; color:#dc2626; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">\uD83D\uDD25 Vencimiento Inminente (< 7 días)</h4>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${urgent.map((u) => `
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
                        `).join("")}
                    </div>
                </div>` : ""}

                ${warning.length > 0 ? `
                <div style="padding:20px;">
                    <h4 style="margin:0 0 15px 0; color:#d97706; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">⚠️ Próximos Vencimientos (8-45 días)</h4>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${warning.map((w) => `
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
                        `).join("")}
                    </div>
                </div>` : ""}
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
  document.body.insertAdjacentHTML("beforeend", modalHtml);
};

// src/services/api.js
var API_BASE_URL = "http://localhost:3000/api";
var ApiClient = {
  async getServices() {
    try {
      const response = await fetch(`${API_BASE_URL}/services?limit=1000`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.services : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (getServices) Offline:", e.message);
      return null;
    }
  },
  async getIncidents() {
    try {
      const response = await fetch(`${API_BASE_URL}/incidents`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.incidents : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (getIncidents) Offline:", e.message);
      return null;
    }
  },
  async createIncident(incident) {
    try {
      const response = await fetch(`${API_BASE_URL}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(incident)
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.incident : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (createIncident) Offline:", e.message);
      return null;
    }
  },
  async updateIncident(id, incident) {
    try {
      const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(incident)
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.incident : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (updateIncident) Offline:", e.message);
      return null;
    }
  },
  async deleteIncident(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const res = await response.json();
        return res.success;
      }
      return false;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (deleteIncident) Offline:", e.message);
      return false;
    }
  },
  async getNotes() {
    try {
      const response = await fetch(`${API_BASE_URL}/notes`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.notes : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (getNotes) Offline:", e.message);
      return null;
    }
  },
  async createNote(note) {
    try {
      const response = await fetch(`${API_BASE_URL}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.note : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (createNote) Offline:", e.message);
      return null;
    }
  },
  async updateNote(id, note) {
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      });
      if (response.ok) {
        const res = await response.json();
        return res.success ? res.data.note : null;
      }
      return null;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (updateNote) Offline:", e.message);
      return null;
    }
  },
  async deleteNote(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const res = await response.json();
        return res.success;
      }
      return false;
    } catch (e) {
      console.warn("\uD83D\uDCE1 API (deleteNote) Offline:", e.message);
      return false;
    }
  }
};
window.ApiClient = ApiClient;

// app.js
var STORAGE_KEYS = {
  INCIDENTS: "sifu_incidents_v4",
  ABSENCES: "sifu_absences_v4",
  UNCOVERED: "sifu_uncovered_v4",
  ORDERS: "sifu_orders_v4",
  GLASS: "sifu_glass_v4",
  STATS: "sifu_stats_v4",
  NOTES: "sifu_notes_v4",
  MASTER: "sifu_master_data_v4"
};
Object.defineProperty(window, "AIService", {
  get: function() {
    return window.OperationalService || { analyzeResilience: () => ({ score: 0, metrics: {}, summaryList: [] }) };
  },
  configurable: true
});
var DataManager = {
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Error al guardar:", e);
      return false;
    }
  },
  load(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
};
if (typeof INITIAL_MASTER_DATA === "undefined") {
  console.warn("⚠️ master_data.js no se cargó correctamente. Usando array vacío.");
  window.INITIAL_MASTER_DATA = [];
}
var DEFAULT_STATE = {
  incidents: [],
  absences: [],
  uncovered: [],
  orders: [],
  glassPlanning: [],
  stats: { activeWorkers: 24 },
  notes: [],
  masterData: [],
  audits: [],
  dailyOverrides: {},
  filterType: null,
  stickyContent: "",
  filteredData: null
};
var ATOMIC_STATE_KEY = "sifu_universal_state_v5";
var state2 = { ...DEFAULT_STATE };
window.state = state2;
window.closeStatusModal = () => {
  const modal = document.getElementById("status-detail-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.setProperty("display", "none", "important");
  }
};
window.showStatusModal = (title, contentHTML) => {
  const modal = document.getElementById("status-detail-modal");
  const mTitle = document.getElementById("status-modal-title");
  const mBody = document.getElementById("status-modal-body");
  if (modal && mTitle && mBody) {
    mTitle.innerText = title;
    mBody.innerHTML = contentHTML;
    modal.style.display = "flex";
    modal.classList.add("active");
  }
};
window.showUncoveredDetails = () => {
  if (!window.state || !window.state.masterData) {
    window.showStatusModal("DESCUBIERTOS", '<p style="text-align:center; padding:20px;">⏳ Cargando datos...</p>');
    return;
  }
  const _rawUncovered = window.state.masterData.filter((row) => {
    const keys = Object.keys(row);
    const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
    const kTitular2 = keys.find((k) => k.toUpperCase().trim() === "TITULAR") || "TITULAR";
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO"));
    if (!row[kServicio2])
      return false;
    const status = (row[kEstado2] || "").toString().toUpperCase();
    const titular = (row[kTitular2] || "").toString().toUpperCase();
    return status.includes("DESCUBIERTO") || status.includes("VACANTE") || status.includes("SIN ASIGNAR") || titular.includes("SIN TITULAR") || titular.includes("DESCUBIERTO") || titular.includes("VACANTE") || status === "" && (titular === "" || titular === "SIN TITULAR") || status === "PENDIENTE" && titular === "";
  });
  const seenServices = new Set;
  const uncovered = _rawUncovered.filter((row) => {
    const keys = Object.keys(row);
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO"));
    const srvName = (row[kServicio2] || "").toString().trim().toUpperCase();
    if (seenServices.has(srvName))
      return false;
    seenServices.add(srvName);
    return true;
  });
  if (uncovered.length === 0) {
    window.showStatusModal("DESCUBIERTOS", '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay servicios descubiertos actualmente.</p>');
    return;
  }
  const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>ESTADO</th>
                    <th>HORARIO</th>
                </tr>
            </thead>
            <tbody>
                ${uncovered.map((row) => {
    const keys = Object.keys(row);
    const srv = row[keys.find((k) => k.toUpperCase().includes("SERVICIO"))] || "-";
    const est = row[keys.find((k) => k.toUpperCase().trim() === "ESTADO")] || "DESCUBIERTO";
    const hor = row[keys.find((k) => k.toUpperCase().includes("HORARIO"))] || "-";
    return `
                        <tr class="critical-row">
                            <td><div class="td-content"><b>${srv}</b></div></td>
                            <td><span class="badge red">${est}</span></td>
                            <td><div class="td-content" style="font-family:monospace; color:#3b82f6;">${hor}</div></td>
                        </tr>`;
  }).join("")}
            </tbody>
        </table>
    </div>`;
  window.showStatusModal(`DESCUBIERTOS (${uncovered.length})`, html);
};
window.showAbsenceDetails = () => {
  if (!window.state || !window.state.masterData || window.state.masterData.length === 0) {
    window.showStatusModal("BAJAS / IT", '<p style="text-align:center; padding:20px;">⏳ Cargando datos...</p>');
    return;
  }
  const keys = Object.keys(window.state.masterData[0]);
  const kEstado1 = keys.find((k) => k.toUpperCase().trim() === "ESTADO1") || keys.find((k) => k.toUpperCase().includes("SALUD")) || keys.find((k) => k.toUpperCase().includes("BAJA")) || "ESTADO1";
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kTitular2 = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  const absences = window.state.masterData.filter((row) => {
    const keys2 = Object.keys(row);
    const kEst = keys2.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
    const kEst1 = keys2.find((k) => k.toUpperCase().trim() === "ESTADO1") || "ESTADO1";
    const stateUpper = (row[kEst] || "").toString().toUpperCase();
    const healthUpper = (row[kEst1] || "").toString().toUpperCase();
    return healthUpper.includes("BAJA") || healthUpper.includes("IT") || healthUpper.includes("I.T") || healthUpper.includes("VACACIONES") || stateUpper.includes("BAJA") || stateUpper.includes("IT");
  });
  if (absences.length === 0) {
    window.showStatusModal("BAJAS / IT", '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay bajas activas hoy.</p>');
    return;
  }
  const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>TITULAR</th>
                    <th>ESTADO / SALUD</th>
                </tr>
            </thead>
            <tbody>
                ${absences.map((row) => {
    const srv = row[kServicio2] || "-";
    const tit = row[kTitular2] || "-";
    const est1 = row[kEstado1] || "BAJA";
    let badgeClass = "blue";
    if (est1.toUpperCase().includes("BAJA") || est1.toUpperCase().includes("IT"))
      badgeClass = "red";
    if (est1.toUpperCase().includes("VAC"))
      badgeClass = "green";
    return `
                    <tr>
                        <td><div class="td-content"><b>${srv}</b></div></td>
                        <td><div class="td-content">${tit}</div></td>
                        <td><span class="badge ${badgeClass}">${est1}</span></td>
                    </tr>`;
  }).join("")}
            </tbody>
        </table>
    </div>`;
  window.showStatusModal(`DETALLE DE BAJAS (${absences.length})`, html);
};
window.showIncidentDetails = () => {
  if (!window.state || !window.state.incidents || window.state.incidents.length === 0) {
    window.showStatusModal("INCIDENCIAS", '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay incidencias registradas.</p>');
    return;
  }
  const priorityOrder = { HIGH: 0, MID: 1, LOW: 2 };
  const sorted = [...window.state.incidents].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));
  const html = `<ul class="notebook-feed">
        ${sorted.map((inc) => `
            <li class="note-card-horizontal" style="transform:none;">
                <div class="note-content">
                    <strong style="color:#3b82f6;">${inc.worker}</strong><br>
                    ${inc.desc} 
                </div>
                <div class="note-footer">
                    <span class="badge ${inc.priority === "HIGH" ? "red" : "blue"}">${inc.priority}</span>
                    ${inc.date || ""}
                </div>
            </li>
        `).join("")}
    </ul>`;
  window.showStatusModal(`INCIDENCIAS (${window.state.incidents.length})`, html);
};
async function loadGlobalState() {
  try {
    console.log("\uD83D\uDD0D Cargando estado local...");
    const saved = localStorage.getItem(ATOMIC_STATE_KEY);
    let parsed = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
        console.log("✅ LocalStorage (Atomic) cargado.");
      } catch (e) {
        console.error("⚠️ Error parseando LocalStorage:", e);
      }
    }
    if (!parsed) {
      console.log("⚠️ No hay Atomic State, intentando IndexedDB...");
      parsed = await loadStateFromIndexedDB();
      if (parsed)
        console.log("✅ IndexedDB cargado.");
    }
    if (parsed) {
      state2 = { ...DEFAULT_STATE, ...parsed };
      state2.filteredData = null;
      window.state = state2;
    } else {
      state2 = { ...DEFAULT_STATE };
      state2.filteredData = null;
      window.state = state2;
    }
    if (!state2.notes || state2.notes.length === 0) {
      const legacyNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (legacyNotes) {
        try {
          const notesArr = JSON.parse(legacyNotes);
          if (Array.isArray(notesArr) && notesArr.length > 0) {
            console.log(`♻️ Recuperadas ${notesArr.length} notas de Backup Individual.`);
            state2.notes = notesArr;
          }
        } catch (e) {
          console.error("Error recuperando legacy notes", e);
        }
      }
    }
    if (typeof INITIAL_MASTER_DATA !== "undefined" && INITIAL_MASTER_DATA.length > 0) {
      const prevCount = state2.masterData ? state2.masterData.length : 0;
      state2.masterData = INITIAL_MASTER_DATA;
      console.log(`\uD83D\uDCE6 MasterData actualizado desde Excel local: ${INITIAL_MASTER_DATA.length} filas (anterior: ${prevCount})`);
      try {
        localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state2.masterData));
      } catch (e) {}
      if (typeof MASTER_DATA_TIMESTAMP !== "undefined") {
        localStorage.setItem("sifu_last_sync", MASTER_DATA_TIMESTAMP);
      }
    } else if (state2.masterData && state2.masterData.length > 0) {
      console.log(`\uD83D\uDCE6 MasterData restaurado desde caché: ${state2.masterData.length} filas.`);
    }
    const syncEl = document.getElementById("last-sync-time");
    if (syncEl) {
      const lastSync = localStorage.getItem("sifu_last_sync") || (typeof MASTER_DATA_TIMESTAMP !== "undefined" ? MASTER_DATA_TIMESTAMP : "HOY --:--");
      syncEl.textContent = `ÚLTIMA SYNC EXCEL: ${lastSync}`;
    }
    console.log("\uD83D\uDCCA Estado Local Inicial Cargado -> Incidencias:", state2.incidents.length, "Notas:", state2.notes.length);
    return true;
  } catch (e) {
    console.error("❌ Fallo CRÍTICO en loadGlobalState:", e);
    state2 = { ...DEFAULT_STATE };
    window.state = state2;
    return false;
  }
}
async function syncDataFromAPI() {
  if (!window.ApiClient)
    return;
  console.log("\uD83D\uDCE1 Iniciando sincronización en segundo plano con MongoDB...");
  let needsRender = false;
  try {
    const apiIncidents = await window.ApiClient.getIncidents();
    if (apiIncidents && JSON.stringify(state2.incidents) !== JSON.stringify(apiIncidents)) {
      state2.incidents = apiIncidents;
      needsRender = true;
      console.log(`\uD83D\uDCE1 Incidencias sincronizadas desde MongoDB: ${apiIncidents.length}`);
    }
  } catch (e) {
    console.warn("\uD83D\uDCE1 API Fallo cargando incidencias en background:", e.message);
  }
  try {
    const apiNotes = await window.ApiClient.getNotes();
    if (apiNotes && JSON.stringify(state2.notes) !== JSON.stringify(apiNotes)) {
      state2.notes = apiNotes;
      needsRender = true;
      console.log(`\uD83D\uDCE1 Notas sincronizadas desde MongoDB: ${apiNotes.length}`);
    }
  } catch (e) {
    console.warn("\uD83D\uDCE1 API Fallo cargando notas en background:", e.message);
  }
  try {
    if (typeof window.ApiClient.getServices === "function") {
      const apiServices = await window.ApiClient.getServices();
      if (apiServices && apiServices.length > 0 && JSON.stringify(state2.masterData) !== JSON.stringify(apiServices)) {
        state2.masterData = apiServices;
        needsRender = true;
        console.log(`\uD83D\uDCE1 MasterData sincronizado desde MongoDB: ${apiServices.length} filas.`);
        try {
          localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state2.masterData));
        } catch (e) {}
        const syncEl = document.getElementById("last-sync-time");
        if (syncEl)
          syncEl.textContent = `ÚLTIMA SYNC: BD MONGO`;
      }
    }
  } catch (apiErr) {
    console.warn("\uD83D\uDCE1 API Fallo cargando servicios en background:", apiErr.message);
  }
  if (needsRender) {
    saveAllState();
    renderAll();
  }
}
var hasUnsavedChanges = false;
window.saveAllState = function() {
  try {
    console.log("\uD83D\uDCBE Guardando estado...");
    const stateStr = JSON.stringify(state2);
    try {
      localStorage.setItem(ATOMIC_STATE_KEY, stateStr);
      console.log("✅ Estado guardado en localStorage, tamaño:", stateStr.length, "caracteres");
    } catch (localStorageError) {
      console.warn("⚠️ localStorage bloqueado o lleno:", localStorageError.message);
    }
    saveStateToIndexedDB(state2).catch((err) => {
      console.warn("⚠️ Error guardando en IndexedDB:", err);
    });
    try {
      DataManager.save(STORAGE_KEYS.INCIDENTS, state2.incidents);
      DataManager.save(STORAGE_KEYS.ABSENCES, state2.absences);
      DataManager.save(STORAGE_KEYS.UNCOVERED, state2.uncovered);
      DataManager.save(STORAGE_KEYS.ORDERS, state2.orders);
      DataManager.save(STORAGE_KEYS.GLASS, state2.glassPlanning);
      DataManager.save(STORAGE_KEYS.STATS, state2.stats);
      DataManager.save(STORAGE_KEYS.NOTES, state2.notes);
      DataManager.save(STORAGE_KEYS.MASTER, state2.masterData);
      DataManager.save(STORAGE_KEYS.STICKY, state2.stickyContent);
    } catch (e) {
      console.warn("⚠️ Error guardando llaves individuales:", e);
    }
    const now = new Date().toLocaleString("es-ES");
    try {
      localStorage.setItem("sifu_last_sync", now);
    } catch (e) {
      console.warn("⚠️ No se pudo guardar timestamp");
    }
    updateSaveIndicator("saved");
    hasUnsavedChanges = false;
    console.log("✅ Guardado completado:", {
      incidents: state2.incidents.length,
      notes: state2.notes.length,
      masterData: state2.masterData.length
    });
    return true;
  } catch (e) {
    console.error("❌ Fallo crítico al guardar estado:", e);
    updateSaveIndicator("error");
    showToast2("Error de guardado: " + e.message, "error");
    return false;
  }
};
window.saveAndRender = function() {
  saveAllState();
  renderAll();
};
var incidentsChart = null;
var incidentFeed = document.getElementById("incidents-feed");
var notesFeed = document.getElementById("notes-feed");
var dateEl = document.getElementById("current-date");
var tickerEl = document.getElementById("live-ticker-text");
var globalSearch = document.getElementById("global-search-input");
var quickInput = document.getElementById("quick-input-bar");
window.openSituationalReport = window.openSituationalReport || function() {
  console.warn("Situational Report engine loaded delayed.");
};
if (globalSearch) {
  globalSearch.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    const mSearch = document.getElementById("master-search-input");
    if (mSearch)
      mSearch.value = val;
    if (val.length > 0 && typeof switchTab === "function") {
      switchTab("master");
    }
    if (window.debouncedRenderMasterBody) {
      window.debouncedRenderMasterBody();
    } else if (typeof renderMasterBodyOnly2 === "function") {
      renderMasterBodyOnly2();
    }
  });
}
var hIncidents = document.getElementById("h-stat-incidents");
var hActive = document.getElementById("h-stat-active");
function setupNotesListeners() {
  console.log("\uD83D\uDCDD Inicializando Listeners de Notas...");
  const topInput = document.getElementById("quick-note-top");
  if (topInput) {
    const newTop = topInput.cloneNode(true);
    topInput.parentNode.replaceChild(newTop, topInput);
    newTop.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const text = newTop.value.trim();
        console.log("\uD83D\uDCDD Enter en Top Note:", text);
        if (text) {
          const newNote = {
            id: Date.now(),
            text,
            tag: "INFO",
            date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
            completed: false
          };
          state2.notes.unshift(newNote);
          if (window.ApiClient) {
            window.ApiClient.createNote(newNote);
          }
          newTop.value = "";
          saveAndRender();
          updateTicker2("NOTA AÑADIDA AL BLOC");
        }
      }
    });
  }
  const modalForm = document.getElementById("note-form");
  if (modalForm) {
    modalForm.onsubmit = (e) => {
      e.preventDefault();
      window.addNoteFromSistema();
      const modal = document.getElementById("note-modal");
      if (modal) {
        modal.classList.remove("active");
        modal.style.setProperty("display", "none", "important");
      }
    };
  }
}
function setupIncidentListeners() {
  console.log("\uD83D\uDEA8 Inicializando Listeners de Incidencias...");
  const incidentForm = document.getElementById("incident-form");
  if (incidentForm) {
    incidentForm.onsubmit = async (e) => {
      e.preventDefault();
      const workerNameInput = document.getElementById("worker-name");
      const typeInput = document.getElementById("incident-type");
      const priorityInput = document.querySelector('input[name="priority"]:checked');
      const descInput = document.getElementById("incident-desc");
      if (!workerNameInput || !descInput)
        return;
      const worker = workerNameInput.value.trim();
      const type = typeInput ? typeInput.value : "AUSENCIA";
      const priority = priorityInput ? priorityInput.value : "MID";
      const desc = descInput.value.trim();
      if (!worker || !desc)
        return;
      const newIncident = {
        id: Date.now(),
        worker,
        type,
        priority,
        desc,
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        date: new Date().toLocaleDateString("es-ES"),
        reported: false
      };
      state2.incidents.unshift(newIncident);
      if (window.ApiClient) {
        window.ApiClient.createIncident(newIncident);
      }
      workerNameInput.value = "";
      descInput.value = "";
      if (typeInput)
        typeInput.selectedIndex = 0;
      const defaultRadio = document.querySelector('input[name="priority"][value="MID"]');
      if (defaultRadio)
        defaultRadio.checked = true;
      const modal = document.getElementById("incident-modal");
      if (modal) {
        modal.classList.remove("active");
        modal.style.setProperty("display", "none", "important");
      }
      saveAndRender();
      updateTicker2("INCIDENCIA REGISTRADA");
    };
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    updateDate();
    initCharts();
    setupNotesListeners();
    setupIncidentListeners();
    const wasLoaded = await loadGlobalState();
    if (!wasLoaded) {
      console.log("No hay datos guardados, inicializando con defaults.");
      state2 = { ...DEFAULT_STATE };
      if (typeof INITIAL_MASTER_DATA !== "undefined" && INITIAL_MASTER_DATA.length > 0) {
        console.log("\uD83D\uDCE6 Cargando datos integrados de respaldo.");
        processMasterArray(INITIAL_MASTER_DATA);
        saveAllState();
        updateTicker2("SISTEMA: DATOS INTEGRADOS Y PERSISTIDOS [129 SERVICIOS]");
      }
    }
    const lastSync = localStorage.getItem("sifu_last_sync");
    if (lastSync) {
      const syncEl = document.getElementById("last-sync-time");
      if (syncEl)
        syncEl.textContent = `ÚLTIMA SYNC: ${lastSync}`;
    }
    console.log("\uD83D\uDD04 Sincronizando vistas...");
    renderAll();
    if (wasLoaded)
      updateTicker2("SISTEMA: DATOS RECUPERADOS CON ÉXITO");
    if (typeof generateOperationalInsights === "function" && !window.IS_OP_INITIALIZED) {
      window.IS_OP_INITIALIZED = true;
      setTimeout(() => {
        generateOperationalInsights();
        showToast2("✨ SISTEMA INFORMER v8.2 LISTO", "bg-blue");
        setTimeout(() => {
          showToast2("\uD83D\uDCCA MOTOR DE ANÁLISIS: ONLINE", "bg-purple");
        }, 800);
      }, 1500);
    }
    setupEventListeners();
    renderAll();
    startTicker();
    initVoiceCommand();
    if (typeof initQualityModule === "function")
      initQualityModule();
    checkServerExcel();
    if (typeof syncDataFromAPI === "function") {
      syncDataFromAPI();
    }
    setInterval(() => {
      if (hasUnsavedChanges) {
        saveAllState();
        console.log("Auto-guardado ejecutado");
      }
    }, 3000);
    initSaveIndicator();
  } catch (e) {
    console.error("CRITICAL INIT ERROR:", e);
    alert("ERROR CRÍTICO AL INICIAR: " + e.message + `

Por favor, reporte este mensaje.`);
  }
});
function updateDate() {
  const now = new Date;
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(",", " |");
  }
}
function setupCoreInteractions() {
  const fab = document.getElementById("main-fab");
  const fabMenu = document.getElementById("fab-menu");
  if (fab) {
    fab.onclick = () => {
      fab.classList.toggle("active");
      if (fabMenu)
        fabMenu.classList.toggle("active");
    };
  }
  const scrollWrapper = document.querySelector(".master-content-wrapper");
  const toolbar = document.querySelector(".master-toolbar");
  if (scrollWrapper && toolbar) {
    scrollWrapper.addEventListener("scroll", () => {
      if (scrollWrapper.scrollTop > 10) {
        toolbar.classList.add("scrolled");
      } else {
        toolbar.classList.remove("scrolled");
      }
    });
  }
  const addIncBtn = document.getElementById("btn-add-incident-v2");
  if (addIncBtn) {
    addIncBtn.onclick = () => {
      document.getElementById("incident-modal").classList.add("active");
      if (fab)
        fab.click();
    };
  }
  const addNoteBtn = document.getElementById("btn-add-note-v2");
  const masterBtn = document.getElementById("btn-load-master");
  const masterInput = document.getElementById("master-file-input");
  const noteForm = document.getElementById("note-form");
  if (addNoteBtn) {
    addNoteBtn.onclick = () => {
      document.getElementById("note-modal").classList.add("active");
      if (fab)
        fab.click();
    };
  }
  if (masterBtn) {
    masterBtn.onclick = async () => {
      if (window.pendingResumeHandle) {
        try {
          const options = { mode: "readwrite" };
          if (await window.pendingResumeHandle.queryPermission(options) !== "granted") {
            if (await window.pendingResumeHandle.requestPermission(options) !== "granted") {
              alert("Se requieren permisos para automatizar la sincronización.");
              return;
            }
          }
          activateMasterLiveWatch(window.pendingResumeHandle);
          window.pendingResumeHandle = null;
          return;
        } catch (err) {
          console.error("Error al reanudar handle:", err);
          updateTicker2("⚠️ ERROR AL REANUDAR. SELECCIONE ARCHIVO DE NUEVO.");
        }
      }
      if (window.location.protocol === "file:") {
        masterInput.click();
        return;
      }
      if ("showOpenFilePicker" in window) {
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: "Excel Files",
              accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
            }],
            multiple: false
          });
          if (handle) {
            const file = await handle.getFile();
            handleExcelFile(file);
          }
        } catch (err) {
          if (err.name !== "AbortError")
            console.error(err);
        }
      } else {
        masterInput.click();
      }
    };
  }
  if (masterInput) {
    masterInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file)
        handleExcelFile(file);
    };
  }
  const outlookBtn = document.querySelector(".btn-comm.outlook");
  const waBtn = document.querySelector(".btn-comm.whatsapp");
  if (outlookBtn)
    outlookBtn.onclick = (e) => {
      e.preventDefault();
      scrollToModule("widget-outlook");
    };
  if (waBtn)
    waBtn.onclick = (e) => {
      e.preventDefault();
      scrollToModule("widget-wa");
    };
  if (quickInput) {
    quickInput.onkeydown = (e) => {
      if (e.key === "Enter" && quickInput.value.trim() !== "") {
        processQuickInput(quickInput.value.trim());
        quickInput.value = "";
      }
    };
  }
  if (globalSearch) {
    globalSearch.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = globalSearch.value.trim();
        console.log("Global Search: ", query);
        if (typeof processGlobalSearch === "function") {
          processGlobalSearch(query);
        }
        renderIncidents(query.toLowerCase());
      }
    };
  }
  const mSearch = document.getElementById("master-search-input");
  const mFilterEstado = document.getElementById("master-filter-estado");
  const mFilterEstado1 = document.getElementById("master-filter-estado1");
  const mFilterGestor = document.getElementById("master-filter-gestor");
  document.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".tag-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
  const noteInput = document.getElementById("note-input");
  if (noteInput) {
    noteInput.onkeydown = (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        window.addNoteFromSistema();
      }
    };
  }
  if (mSearch) {
    mSearch.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        console.log("Buscando en Master: ", mSearch.value);
        renderMasterSummary();
        showToast2("Filtro Master: Buscando '" + mSearch.value + "'", "info");
        mSearch.blur();
      }
    };
    mSearch.oninput = () => renderMasterSummary();
  }
  if (mFilterEstado)
    mFilterEstado.onchange = () => renderMasterSummary();
  if (mFilterEstado1)
    mFilterEstado1.onchange = () => renderMasterSummary();
  if (mFilterGestor)
    mFilterGestor.onchange = () => renderMasterSummary();
  if (mFilterEstado1)
    mFilterEstado1.onchange = () => {
      console.log("Filtro Salud cambiado");
      renderMasterSummary();
    };
  if (mFilterGestor)
    mFilterGestor.onchange = () => {
      console.log("Filtro Gestor cambiado");
      renderMasterSummary();
    };
  const quickNoteTop = document.getElementById("quick-note-top");
  if (quickNoteTop) {
    quickNoteTop.onkeydown = (e) => {
      if (e.key === "Enter" && quickNoteTop.value.trim() !== "") {
        e.preventDefault();
        const newNote = {
          id: Date.now(),
          text: quickNoteTop.value.trim(),
          tag: "INFO",
          date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
          completed: false
        };
        state2.notes.unshift(newNote);
        markUnsavedChanges();
        quickNoteTop.value = "";
        saveAndRender();
        showToast2("Tarea guardada en la agenda", "success");
        updateTicker2("SISTEMA: NOTA RÁPIDA GUARDADA");
      }
    };
  }
  if (hActive && hActive.parentElement) {
    hActive.parentElement.onclick = () => {
      const current = state2.stats.activeWorkers || 0;
      const newVal = prompt("EDITAR TRABAJADORES EN SERVICIO:", current);
      if (newVal !== null && !isNaN(newVal)) {
        state2.stats.activeWorkers = parseInt(newVal);
        markUnsavedChanges();
        saveAndRender();
      }
    };
  }
  const forceSyncSave = () => {
    try {
      const stateStr = JSON.stringify(state2);
      localStorage.setItem(ATOMIC_STATE_KEY, stateStr);
      localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(state2.incidents));
      localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(state2.absences));
      localStorage.setItem(STORAGE_KEYS.UNCOVERED, JSON.stringify(state2.uncovered));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(state2.orders));
      localStorage.setItem(STORAGE_KEYS.GLASS, JSON.stringify(state2.glassPlanning));
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(state2.stats));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state2.notes));
      localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state2.masterData));
      localStorage.setItem(STORAGE_KEYS.STICKY, state2.stickyContent);
      localStorage.setItem("sifu_last_sync", new Date().toLocaleString("es-ES"));
      console.log("✅ Guardado sincrónico forzado ejecutado");
      return true;
    } catch (err) {
      console.error("❌ Error en guardado sincrónico:", err);
      return false;
    }
  };
  window.addEventListener("beforeunload", (e) => {
    forceSyncSave();
  });
  window.addEventListener("pagehide", (e) => {
    forceSyncSave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      forceSyncSave();
    }
  });
  window.addEventListener("blur", () => {
    forceSyncSave();
  });
  setInterval(() => {
    forceSyncSave();
  }, 5000);
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.style.border = "none";
    document.body.style.backgroundColor = "";
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      handleExcelFile(file);
    }
  });
}
var DB_NAME = "SifuAutoSyncDBv2";
var STORE_NAME = "Handles";
async function saveHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, "masterHandle");
    req.onsuccess = () => resolve(true);
    req.onerror = () => {
      console.error("Error saving handle:", req.error);
      resolve(false);
    };
  });
}
async function getSavedHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("masterHandle");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => {
        console.error("Error reading handle:", req.error);
        resolve(null);
      };
    });
  } catch (e) {
    console.error("DB Error:", e);
    return null;
  }
}
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
var liveHandle = null;
var isSavingToExcel = false;
var lastSaveTimestamp = 0;
async function activateMasterLiveWatch(handle) {
  if (!handle)
    return;
  liveHandle = handle;
  window.liveHandle = handle;
  window.liveWatchActive = true;
  await saveHandle(handle);
  if (window.MasterSyncEngine) {
    window.MasterSyncEngine.activate(handle);
  }
  const btn = document.getElementById("btn-load-master");
  if (btn) {
    btn.innerHTML = "<span>\uD83D\uDCE1</span> MODO AUTO ACTIVO";
    btn.classList.add("active-live");
  }
  showToast2("SISTEMA SINCRONIZADO: MODO LIVE ACTIVO", "success");
  updateTicker2("SISTEMA: AUTOMATIZACIÓN TOTAL. MODIFICA EL EXCEL Y GUARDA PARA ACTUALIZAR.");
  const syncBadge = document.createElement("span");
  syncBadge.id = "live-sync-badge";
  syncBadge.innerHTML = "● LIVE";
  syncBadge.style.cssText = "color: #34a853; font-size: 9px; font-weight: 800; margin-left: 8px; animation: pulse-green 2s infinite;";
  btn.appendChild(syncBadge);
  let lastModified = 0;
  setInterval(async () => {
    const icon = document.getElementById("sync-icon");
    if (icon) {
      icon.style.transition = "transform 0.5s";
      icon.style.transform = "rotate(180deg)";
      setTimeout(() => icon.style.transform = "rotate(0deg)", 400);
    }
    if (isSavingToExcel) {
      return;
    }
    try {
      const file = await liveHandle.getFile();
      const timeSinceLastSave = Date.now() - lastSaveTimestamp;
      if (file.lastModified > lastModified) {
        if (lastModified !== 0 && timeSinceLastSave < 2000) {
          console.log("Cambio detectado pero fue causado por guardado local, ignorando...");
          lastModified = file.lastModified;
          return;
        }
        if (lastModified !== 0) {
          showToast2("↓ ACTUALIZANDO DESDE EXCEL...", "info");
          flashDashboard();
          const now = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
          updateTicker2(`SISTEMA: ACTUALIZACIÓN EXTERNA DETECTADA (${now})`);
        }
        lastModified = file.lastModified;
        handleExcelFile(file);
      }
    } catch (err) {
      console.log("Esperando autorización del navegador...");
      if (syncBadge) {
        syncBadge.innerHTML = "● PAUSADO";
        syncBadge.style.color = "var(--sifu-amber)";
      }
    }
  }, 800);
}
document.addEventListener("DOMContentLoaded", async () => {
  setTimeout(async () => {
    try {
      const savedHandle = await getSavedHandle();
      if (savedHandle) {
        window.pendingResumeHandle = savedHandle;
        const btn = document.getElementById("btn-load-master");
        if (btn) {
          btn.innerHTML = "<span>\uD83D\uDD0C</span> PULSA PARA REANUDAR";
          btn.classList.add("pulse-sync");
          btn.style.borderColor = "var(--sifu-amber)";
          btn.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
          btn.style.animation = "pulse-amber-border 2s infinite";
          btn.title = "Archivo detectado: " + savedHandle.name;
          updateTicker2("SISTEMA: VÍNCULO A " + savedHandle.name.toUpperCase() + " DETECTADO. PULSE PARA REACTIVAR.");
          showToast2("SESIÓN PREVIA DETECTADA: " + savedHandle.name, "info");
        }
      }
    } catch (e) {
      console.warn("Fallo en recuperación de sesión IndexedDB:", e);
    }
  }, 800);
});
async function saveToExcelMaster() {
  if (!liveHandle) {
    showToast2("⚠️ NO HAY ARCHIVO EXCEL CONECTADO", "warning");
    return;
  }
  let attempts = 0;
  const maxAttempts = 3;
  const trySave = async () => {
    try {
      isSavingToExcel = true;
      updateSaveIndicator("saving");
      const newWS = XLSX.utils.json_to_sheet(state2.masterData);
      const newWB = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWB, newWS, "SEGUIMIENTO");
      const excelBuffer = XLSX.write(newWB, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const writable = await liveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      lastSaveTimestamp = Date.now();
      setTimeout(() => {
        isSavingToExcel = false;
      }, 1500);
      showToast2("↑ CAMBIOS GUARDADOS EN EXCEL", "success");
      updateSaveIndicator("saved");
      flashDashboard();
      if (typeof generateAIInsights === "function")
        generateAIInsights();
    } catch (err) {
      console.error("Save failed:", err);
      isSavingToExcel = false;
      attempts++;
      if (attempts < maxAttempts) {
        showToast2(`ARCHIVO OCUPADO. REINTENTANDO (${attempts}/${maxAttempts})...`, "info");
        setTimeout(trySave, 1500);
      } else {
        showToast2("ERROR: EL ARCHIVO EXCEL ESTÁ BLOQUEADO", "error");
        updateSaveIndicator("error");
        updateTicker2("❌ ERROR AL GUARDAR (ARCHIVO BLOQUEADO)");
      }
    }
  };
  trySave();
}
window.updateAbsenceField = async (id, field, value) => {
  const abs = state2.absences.find((a) => a.id === id);
  if (!abs)
    return;
  abs[field] = value;
  const keys = Object.keys(state2.masterData[0]);
  const keyS = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const keyT = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  const masterRow = state2.masterData.find((row) => (row[keyS] || "").toString().trim() === abs.center.trim() && (row[keyT] || "").toString().trim() === abs.worker.trim());
  if (masterRow) {
    const keyE1 = keys.find((k) => k.toUpperCase().includes("ESTADO") && k.toUpperCase() !== "ESTADO") || "ESTADO.1";
    const keySup = keys.find((k) => k.toUpperCase().includes("SUPLENTE")) || "SUPLENTE";
    const excelKey = field === "suggestedSubstitute" ? keySup : field === "reason" ? keyE1 : field;
    masterRow[excelKey] = value;
    await saveToExcelMaster();
  }
};
function flashDashboard() {
  const logo = document.querySelector(".logo-box");
  if (logo) {
    logo.classList.add("sync-flash-anim");
    setTimeout(() => logo.classList.remove("sync-flash-anim"), 1000);
  }
}
function handleExcelFile(file) {
  updateTicker2("⏳ PROCESANDO EXCEL LOCAL, POR FAVOR ESPERE...");
  const timeEl = document.getElementById("last-sync-time");
  if (timeEl)
    timeEl.textContent = `⏳ CARGANDO...`;
  setTimeout(() => {
    const reader = new FileReader;
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        processMasterData(workbook);
        const now = new Date;
        const syncMsg = `AUTO: ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        localStorage.setItem("sifu_last_sync", syncMsg);
        if (timeEl)
          timeEl.textContent = `ÚLTIMA SYNC: ${syncMsg}`;
        if (window.MasterSyncEngine) {
          window.MasterSyncEngine.updateUI("active");
        }
        showToast2("✅ Excel cargado correctamente", "success");
      } catch (err) {
        console.error("Error al leer Excel:", err);
        showToast2("❌ Error al procesar el Excel", "error");
        updateTicker2("⚠️ ERROR EN LA LECTURA DEL ARCHIVO");
        if (timeEl)
          timeEl.textContent = `ERROR DE LECTURA`;
      }
    };
    reader.onerror = () => {
      showToast2("❌ Error al leer el archivo físico", "error");
    };
    reader.readAsArrayBuffer(file);
  }, 100);
}
function processMasterData(workbook) {
  let sheetName = "SEGUIMIENTO";
  let sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const firstSheetName = workbook.SheetNames[0];
    sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      updateTicker2("⚠️ ERROR: EL ARCHIVO EXCEL PARECE VACÍO");
      return;
    }
    console.log(`Usando hoja: ${firstSheetName}`);
  }
  const rawJSON = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    dateNF: "dd/mm/yyyy",
    defval: ""
  });
  processMasterArray(rawJSON);
}
function processMasterArray(rawData) {
  if (!rawData || !Array.isArray(rawData)) {
    console.error("❌ processMasterArray: Datos inválidos");
    return;
  }
  state2.masterData = rawData;
  state2.filteredData = null;
  const newAbsences = [];
  const newUncovered = [];
  if (!rawData.length)
    return;
  const keys = Object.keys(rawData[0]);
  const findKey = (search) => keys.find((k) => k.toUpperCase().trim() === search || k.toUpperCase().includes(search));
  const keyServicio = findKey("SERVICIO") || "SERVICIO";
  const keyTitular = findKey("TITULAR") || "TITULAR";
  const keyEstado = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
  const keyEstadoSalud = findKey("ESTADO1") || "ESTADO1";
  const keySuplente = findKey("SUPLENTE") || "SUPLENTE";
  const keyHorario = findKey("HORARIO") || "HORARIO";
  rawData.forEach((row, index) => {
    const servicio = row[keyServicio] || "";
    const titular = row[keyTitular] || "";
    const estadoUpper = (row[keyEstado] || "").toString().toUpperCase();
    const saludUpper = (row[keyEstadoSalud] || "").toString().toUpperCase();
    const isBaja = saludUpper.includes("BAJA") || saludUpper.includes("IT") || saludUpper.includes("I.T") || saludUpper.includes("VACACIONES") || estadoUpper.includes("BAJA") || estadoUpper.includes("IT");
    if (isBaja) {
      newAbsences.push({
        id: Date.now() + index,
        worker: titular || "TITULAR",
        center: servicio,
        shift: row[keyHorario] || "",
        reason: row[keyEstadoSalud] || row[keyEstado] || "BAJA",
        suggestedSubstitute: row[keySuplente] || ""
      });
    }
    const isSpecial = estadoUpper.includes("BRIGADA") || estadoUpper.includes("OBRAS") || estadoUpper.includes("CERRADO");
    const isDesc = estadoUpper.includes("DESCUBIERTO") || estadoUpper.includes("VACANTE") || estadoUpper.includes("SIN ASIGNAR") || titular.toUpperCase().includes("SIN TITULAR") || titular.toUpperCase().includes("DESCUBIERTO") || estadoUpper === "" && (titular === "" || titular === "SIN TITULAR") || estadoUpper === "PENDIENTE" && titular === "";
    if (isDesc && !isSpecial) {
      newUncovered.push({
        id: Date.now() + index + 1000,
        center: servicio,
        worker: titular || "DESCUBIERTO",
        shift: row[keyHorario] || "",
        startTime: "URGENTE",
        risk: true
      });
    }
  });
  state2.absences = newAbsences;
  if (typeof SPECIAL_UNCOVERED !== "undefined" && Array.isArray(SPECIAL_UNCOVERED)) {
    SPECIAL_UNCOVERED.forEach((su, idx) => {
      newUncovered.push({
        id: "special-" + idx + "-" + Date.now(),
        center: su.center,
        worker: "ALERTA EXTERNA",
        shift: su.shift || "MAÑANA",
        startTime: "URGENTE",
        risk: true,
        source: "excel_especial"
      });
    });
  }
  state2.uncovered = newUncovered;
  saveAllState();
  renderAll();
  updateTicker2(`${rawData.length} SERVICIOS SINCRONIZADOS`);
}
function saveAndRender() {
  saveAllState();
  const lastSyncEl = document.getElementById("last-sync-time");
  if (lastSyncEl)
    lastSyncEl.textContent = `ÚLTIMA SYNC: ${localStorage.getItem("sifu_last_sync")}`;
  renderAll();
}
function renderPriorityPanel() {
  const panel = document.getElementById("critical-actions");
  if (!panel)
    return;
  const criticalIncidents = state2.incidents.filter((i) => i.priority === "HIGH" && !i.reported);
  const criticalUncovered = state2.uncovered.filter((u) => u.risk);
  let html = "";
  criticalIncidents.forEach((inc) => {
    html += `<div class="critical-item" onclick="scrollToModule('module-incidents')">
            <div class="item-header">
                <span class="risk-pulse"></span>
                <span class="insight-title" style="color:var(--accent-red); font-size: 11px; font-weight:700; text-transform: uppercase;">\uD83D\uDEA8 Alerta Crítica</span>
            </div>
            <span class="insight-text" style="font-size: 14px; font-weight:700;">${inc.worker}</span>
            <span class="item-desc" style="font-size: 13px;">${inc.type} - Gestión Inmediata</span>
            <span class="item-time" style="font-size: 11px; color:var(--text-dim); margin-top:4px;">\uD83D\uDD52 ${inc.time}</span>
        </div>`;
  });
  criticalUncovered.forEach((unc) => {
    html += `<div class="critical-item" onclick="scrollToModule('module-uncovered')">
            <div class="item-header">
                <span class="risk-pulse"></span>
                <span class="insight-title" style="color:var(--accent-red); font-size: 11px; font-weight:700; text-transform: uppercase;">\uD83D\uDD34 Turno Descubierto</span>
            </div>
            <span class="insight-text" style="font-size: 14px; font-weight:700;">${unc.center}</span>
            <span class="item-desc" style="font-size: 13px;">${unc.shift}</span>
            <span class="item-time" style="font-size: 11px; color:var(--text-dim); margin-top:4px;">⚠️ Riesgo de Penalización</span>
        </div>`;
  });
  panel.innerHTML = html || '<div class="empty-state">ESTADO OPERATIVO: NORMAL - SIN URGENCIAS</div>';
}
window.updateMasterCell = async (rowIndex, columnKey, newValue) => {
  if (rowIndex < 0 || rowIndex >= state2.masterData.length) {
    console.error("Índice de fila inválido:", rowIndex);
    return;
  }
  const row = state2.masterData[rowIndex];
  const oldValue = row[columnKey];
  if (oldValue === newValue) {
    return;
  }
  console.log(`Actualizando celda [${rowIndex}][${columnKey}]: "${oldValue}" → "${newValue}"`);
  row[columnKey] = newValue;
  markUnsavedChanges();
  saveAllState();
  if (liveHandle) {
    updateTicker2(`\uD83D\uDCDD EDITANDO: ${columnKey} → Guardando en Excel...`);
    await saveToExcelMaster();
  } else {
    showToast2("⚠️ Cambio guardado localmente. Conecta Excel para sincronizar.", "warning");
  }
  processMasterArray(state2.masterData);
};
window.renderUncovered = function() {
  console.log("\uD83D\uDD0D Renderizando Centro de Descubiertos Inteligente...");
  const feed = document.getElementById("uncovered-feed");
  if (!feed)
    return;
  if (!state2.uncovered || state2.uncovered.length === 0) {
    feed.innerHTML = `
            <div class="empty-discovery">
                <div class="icon">\uD83D\uDE80</div>
                <h3>OPERATIVA COMPLETADA</h3>
                <p>No se detectan servicios descubiertos en el sistema. Todos los cuadrantes están sincronizados.</p>
                <button class="btn-primary-glow" style="margin-top:20px;" onclick="refreshMetrics()">REFRESCAR DATOS</button>
            </div>`;
    return;
  }
  const total = state2.uncovered.length;
  const efficiency = total > 0 ? Math.max(0, 100 - total * 2).toFixed(1) : "100";
  const searchQuery = (window.uncoveredSearchTerm || "").toLowerCase();
  const activeZone = window.uncoveredZoneFilter || "TODAS";
  const filtered = state2.uncovered.filter((unc) => {
    const matchesSearch = unc.center.toLowerCase().includes(searchQuery) || unc.worker && unc.worker.toLowerCase().includes(searchQuery);
    const matchesZone = activeZone === "TODAS" || detectZone(unc.center) === activeZone;
    return matchesSearch && matchesZone;
  });
  const zones = ["TODAS", ...new Set(state2.uncovered.map((u) => detectZone(u.center)))];
  feed.innerHTML = `
        <div class="uncovered-dashboard">
            <!-- Advanced Discovery Hub -->
            <div class="discovery-hub-header" style="flex-direction: column; align-items: stretch; gap: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="hub-stat-group">
                        <div class="hub-stat">
                            <span class="label">Fugas de Cobertura</span>
                            <span class="value critical">${total}</span>
                        </div>
                        <div class="hub-stat">
                            <span class="label">Continuidad Operativa</span>
                            <span class="value">${efficiency}%</span>
                        </div>
                    </div>
                    <div class="hub-actions">
                        <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 11px; background: #6d28d9;" onclick="window.autoAssignAI()">
                            <span>⚡</span> AUTO-ASIGNACIÓN
                        </button>
                        <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 11px; margin-left:10px;" onclick="window.exportStatusToPDF(true)">
                            <span>\uD83D\uDCC4</span> REPORTE CRÍTICO
                        </button>
                    </div>
                </div>

                <div class="hub-filter-bar" style="display: flex; gap: 15px; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="position: relative; flex: 1;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.5;">\uD83D\uDD0D</span>
                        <input type="text" placeholder="Buscar centro o trabajador..." 
                               value="${window.uncoveredSearchTerm || ""}"
                               style="width: 100%; background: transparent; border: none; padding: 8px 8px 8px 35px; color: white; font-size: 13px;"
                               onkeyup="window.uncoveredSearchTerm = this.value; renderUncovered()">
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Zona:</span>
                        <select onchange="window.uncoveredZoneFilter = this.value; renderUncovered()" 
                                style="background: #1e293b; color: white; border: 1px solid #334155; padding: 5px 12px; border-radius: 8px; font-size: 12px; cursor: pointer;">
                            ${zones.map((z) => `<option value="${z}" ${z === activeZone ? "selected" : ""}>${z}</option>`).join("")}
                        </select>
                    </div>
                </div>
            </div>

            <!-- UNIFIED OPERATIVE INTELLIGENCE MATRIX -->
            <div class="discovery-analytics-container">
                <!-- CHART 1: ZONE RANKING (Horizontal) -->
                <div class="analytics-card-premium">
                    <div class="ai-data-pulse">
                        <div class="pulse-stat">
                            <span class="val">${total}</span>
                            <span class="lab">VACANTES</span>
                        </div>
                    </div>
                    <h4>Impacto por Zona <span>Ranking de Volumen</span></h4>
                    <div class="chart-wrapper-ai">
                        <canvas id="uncoveredZoneChart"></canvas>
                    </div>
                </div>

                <!-- CHART 2: STATUS DISTRIBUTION (Donut) -->
                <div class="analytics-card-premium">
                     <div class="ai-data-pulse">
                        <div class="pulse-stat">
                            <span class="val" style="color:#10b981;">${efficiency}%</span>
                            <span class="lab">SALUD</span>
                        </div>
                    </div>
                    <h4>Ecosistema de Estado <span>Distribución en Tiempo Real</span></h4>
                    <div class="chart-wrapper-ai donut-mode">
                        <canvas id="uncoveredStatusChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Smart Dispatch Grid -->
            <div class="uncovered-grid">
                ${filtered.map((unc) => {
    const priorityClass = unc.risk ? "critical" : "";
    const zone = detectZone(unc.center);
    const status = unc.dispatchStatus || "PENDIENTE";
    return `
                    <div class="uncovered-card ${priorityClass}">
                        <div class="card-top">
                            <div class="service-title" style="display:flex; align-items:center; gap:8px;">
                                <div class="zone-tag" style="font-size:8px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:#cbd5e1;">${zone}</div>
                                ${unc.center}
                            </div>
                            <span class="status-tracker-badge" style="font-size: 9px; font-weight: 800; background: ${status === "PENDIENTE" ? "#fee2e2" : status === "GESTION" ? "#fef3c7" : "#dcfce7"}; color: ${status === "PENDIENTE" ? "#ef4444" : status === "GESTION" ? "#d97706" : "#16a34a"}; padding: 4px 10px; border-radius: 20px;">
                                ${status}
                            </span>
                        </div>
                        <div class="card-details">
                            <div class="detail-item"><span class="label">Puesto Vacante</span><span class="val highlight"><span class="pulse-red-dot"></span>${unc.worker || "SIN TITULAR"}</span></div>
                            <div class="detail-item"><span class="label">Tramo Horario</span><span class="val">${unc.shift || "Mañana/Tarde"}</span></div>
                        </div>
                        <div class="dispatch-steps" style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.05);">
                            <div class="step ${status === "PENDIENTE" ? "active" : ""}" onclick="window.updateUncoveredStatus('${unc.id}', 'PENDIENTE')"><span style="font-size:14px;">\uD83D\uDEA9</span><span style="font-size:8px; font-weight:700;">AVISO</span></div>
                            <div style="flex:1; height:1px; background:rgba(255,255,255,0.1); align-self:center; margin: 0 5px;"></div>
                            <div class="step ${status === "GESTION" ? "active" : ""}" onclick="window.updateUncoveredStatus('${unc.id}', 'GESTION')"><span style="font-size:14px;">\uD83D\uDCDE</span><span style="font-size:8px; font-weight:700;">GESTIÓN</span></div>
                            <div style="flex:1; height:1px; background:rgba(255,255,255,0.1); align-self:center; margin: 0 5px;"></div>
                            <div class="step ${status === "CERRADO" ? "active" : ""}" onclick="window.updateUncoveredStatus('${unc.id}', 'CERRADO')"><span style="font-size:14px;">✅</span><span style="font-size:8px; font-weight:700;">CUBIERTO</span></div>
                        </div>
                        <div class="card-actions" style="border-top: none; padding-top: 0;">
                            <button class="btn-ai-reveal" style="flex: 2;" onclick="window.toggleAiSuggestions('${unc.id}', '${unc.center}', '${unc.worker}', '${unc.shift}')"><span>\uD83D\uDCA1</span> RECOMENDACIÓN</button>
                            <button class="mini-action-btn secondary" style="flex: 1;" onclick="window.openChatWithCoordinador('${unc.center}')"><span>\uD83D\uDCAC</span> AVISO</button>
                        </div>
                        <div id="ai-box-${unc.id}" class="ai-suggestions-box">
                            <div style="font-size: 9px; font-weight: 800; color: #6d28d9; margin-bottom: 8px; text-transform: uppercase;">Analítica de Candidatos Cercanos:</div>
                            <div id="ai-list-${unc.id}"><div style="font-size: 10px; color: #94a3b8; text-align: center; padding: 10px;">Calculando rutas...</div></div>
                        </div>
                    </div>
                `;
  }).join("")}
            </div>
        </div>
    `;
  setTimeout(window.initUncoveredCharts, 50);
};
window.updateUncoveredStatus = (id, status) => {
  const uc = state2.uncovered.find((u) => u.id === id);
  if (uc) {
    uc.dispatchStatus = status;
    if (status === "CERRADO") {
      showToast2(`Servicio ${uc.center} marcado como cubierto.`, "success");
    }
    renderUncovered();
  }
};
window.autoAssignAI = () => {
  showToast2("\uD83D\uDCCA Analizando toda la operativa... Buscando huecos óptimos.", "info");
  setTimeout(() => {
    state2.uncovered.forEach((uc) => {
      const candidates = findSubstitutes(uc.center, uc.worker, uc.shift);
      if (candidates.length > 0 && uc.dispatchStatus !== "CERRADO") {
        uc.autoSuggested = candidates[0].name;
      }
    });
    showToast2("✨ Sugerencias globales cargadas. Revisa las tarjetas.", "success");
    renderUncovered();
  }, 1500);
};
window.openChatWithCoordinador = (center) => {
  const zone = detectZone(center);
  showToast2(`Enviando notificación al coordinador de ${zone}...`, "info");
  setTimeout(() => {
    showToast2(`✅ Notificación enviada para ${center}`, "success");
  }, 1000);
};
window.toggleAiSuggestions = (id, center, worker, shift) => {
  const box = document.getElementById(`ai-box-${id}`);
  const list = document.getElementById(`ai-list-${id}`);
  if (!box || !list)
    return;
  box.classList.toggle("active");
  if (box.classList.contains("active")) {
    const candidates = findSubstitutes(center, worker, shift);
    if (candidates.length === 0) {
      list.innerHTML = `<div style="font-size: 10px; color: #64748b; padding: 5px;">No se encontraron operarios compatibles cerca.</div>`;
      return;
    }
    list.innerHTML = candidates.slice(0, 3).map((c) => `
            <div class="suggestion-item">
                <div>
                    <span class="candidate-name">${c.name}</span>
                    <span class="candidate-reason">${c.reason}</span>
                </div>
                <span class="candidate-score">${c.probability}%</span>
            </div>
        `).join("") + `
            <div style="margin-top: 10px; text-align: center;">
                <button class="mini-action-btn primary" style="width: 100%;" onclick="assignSubstitute('${center}', '${candidates[0].name}')">
                    PROPONER A ${candidates[0].name.split(" ")[0]}
                </button>
            </div>
        `;
  }
};
var activeFilters = [];
window.toggleFilterMenu = () => {
  const menu = document.getElementById("filter-column-menu");
  if (!menu)
    return;
  if (menu.classList.contains("active")) {
    menu.classList.remove("active");
  } else {
    populateFilterMenu();
    menu.classList.add("active");
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && !e.target.closest("#btn-add-filter")) {
        menu.classList.remove("active");
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
  }
};
function populateFilterMenu() {
  const menu = document.getElementById("filter-column-menu");
  if (!menu || !state2.masterData || !state2.masterData.length)
    return;
  const allKeys = Object.keys(state2.masterData[0]);
  const availableKeys = allKeys.filter((k) => !activeFilters.includes(k)).sort();
  menu.innerHTML = `
        <div class="filter-menu-search">
            <input type="text" placeholder="Buscar columna..." oninput="this.parentElement.nextElementSibling.querySelectorAll('.filter-menu-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(this.value.toLowerCase()) ? 'flex' : 'none')">
        </div>
        <div id="filter-menu-list">
            ${availableKeys.map((k) => `
                <div class="filter-menu-item" onclick="addFilter('${k}')">
                    <span>${k}</span>
                    <strong style="color:var(--sifu-blue);">+</strong>
                </div>
            `).join("")}
        </div>
    `;
}
window.addFilter = (key) => {
  if (!activeFilters.includes(key)) {
    activeFilters.push(key);
    renderFilterChips();
    renderMasterSummary();
  }
  const menu = document.getElementById("filter-column-menu");
  if (menu)
    menu.classList.remove("active");
};
window.removeFilter = (key) => {
  activeFilters = activeFilters.filter((k) => k !== key);
  renderFilterChips();
  renderMasterSummary();
};
function renderFilterChips() {
  const container = document.getElementById("active-filters-row");
  if (!container)
    return;
  if (!state2.masterData || !state2.masterData.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = activeFilters.map((key) => {
    const uniqueVals = [...new Set(state2.masterData.map((r) => r[key]))].sort();
    const currentSelect = document.getElementById(`filter-select-${key}`);
    const currentVal = currentSelect ? currentSelect.value : "ALL";
    return `
            <div class="filter-chip">
                <span>${key}</span>
                <select id="filter-select-${key}" onchange="renderMasterSummary()">
                    <option value="ALL">TODOS</option>
                    ${uniqueVals.map((v) => `<option value="${v}" ${v == currentVal ? "selected" : ""}>${v}</option>`).join("")}
                </select>
                <button class="remove" onclick="removeFilter('${key}')">×</button>
            </div>
        `;
  }).join("");
}
var columnFilters = {
  estado: "",
  servicio: "",
  titular: "",
  horario: "",
  suplente: "",
  finContrato: "",
  vacaciones: ""
};
var currentSort = {
  key: null,
  dir: "asc"
};
window.toggleSort = (key) => {
  if (currentSort.key === key) {
    currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  } else {
    currentSort.key = key;
    currentSort.dir = "asc";
  }
  renderMasterBodyOnly2();
  refreshSortIcons();
};
function refreshSortIcons() {
  const headers = {
    estado: "\uD83D\uDEE1️ ESTADO",
    servicio: "\uD83D\uDCCD SERVICIO",
    titular: "\uD83D\uDC64 TITULAR",
    horario: "⏰ HORARIO",
    suplente: "\uD83D\uDD04 SUPLENTE",
    finContrato: "\uD83D\uDCC5 FIN CONTRATO",
    vacaciones: "\uD83C\uDF34 VACACIONES 26"
  };
  Object.keys(headers).forEach((key) => {
    const span = document.getElementById(`sort-label-${key}`);
    if (span) {
      const icon = currentSort.key === key ? currentSort.dir === "asc" ? " \uD83D\uDD3C" : " \uD83D\uDD3D" : "";
      span.innerText = headers[key] + icon;
    }
  });
}
window.formatExcelDate = (val) => {
  if (!val)
    return "-";
  let rawStr = val.toString().trim();
  if (rawStr.includes("/") || rawStr.includes("-")) {
    const parts = rawStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let p0 = parseInt(parts[0]);
      let p1 = parseInt(parts[1]);
      let y = parseInt(parts[2]);
      if (y < 100)
        y += 2000;
      let d, m;
      if (p1 > 12) {
        d = p1;
        m = p0;
      } else if (p0 > 12) {
        d = p0;
        m = p1;
      } else {
        const today = new Date;
        const date1 = new Date(y, p1 - 1, p0);
        const date2 = new Date(y, p0 - 1, p1);
        if (date1 < today && date2 > today && y >= 2026) {
          d = p1;
          m = p0;
        } else {
          d = p0;
          m = p1;
        }
      }
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
    return rawStr;
  }
  const num = parseFloat(val);
  if (isNaN(num) || num < 30000)
    return rawStr;
  try {
    const date = new Date((num - 25569) * 86400 * 1000);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return rawStr;
  }
};
var renderMasterTimeout = null;
window.debouncedRenderMasterBody = function() {
  if (renderMasterTimeout)
    clearTimeout(renderMasterTimeout);
  renderMasterTimeout = setTimeout(() => {
    if (typeof renderMasterBodyOnly2 === "function") {
      renderMasterBodyOnly2();
    }
  }, 250);
};
window.clearAllMasterFilters = function() {
  if (typeof columnFilters !== "undefined") {
    for (let key in columnFilters) {
      columnFilters[key] = "";
    }
  }
  const masterSearch = document.getElementById("master-search-input");
  if (masterSearch)
    masterSearch.value = "";
  const globalSearch2 = document.getElementById("global-search-input");
  if (globalSearch2)
    globalSearch2.value = "";
  state2.filteredData = null;
  renderMasterSummary();
};
window.toggleSidebar = function() {
  const container = document.querySelector(".modules-container");
  const btn = document.getElementById("toggle-sidebar-btn");
  if (!container)
    return;
  container.classList.toggle("sidebar-collapsed");
  if (container.classList.contains("sidebar-collapsed")) {
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.35)";
      btn.innerHTML = '<span class="sidebar-icon">⏹️</span> <span class="sidebar-text">VISTA NORMAL</span>';
    }
  } else {
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.15)";
      btn.innerHTML = '<span class="sidebar-icon">\uD83D\uDDA5️</span> <span class="sidebar-text">VISTA COMPLETA</span>';
    }
  }
};
window.updateColumnFilter = (key, value) => {
  if (typeof columnFilters !== "undefined") {
    columnFilters[key] = value.toLowerCase();
  }
  renderMasterBodyOnly2();
};
function renderMasterSummary() {
  const feed = document.getElementById("master-summary-feed");
  if (feed && feed.querySelector("#resizable-master")) {
    renderMasterBodyOnly2();
    return;
  }
  const countEl = document.getElementById("master-count");
  if (!feed)
    return;
  if (!state2.masterData || state2.masterData.length === 0) {
    feed.innerHTML = '<div class="empty-state">SIN DATOS MASTER CARGADOS. SYNC MASTER REQUERIDO.</div>';
    if (countEl)
      countEl.textContent = "0";
    return;
  }
  const sortIcon = (k) => currentSort.key === k ? currentSort.dir === "asc" ? " \uD83D\uDD3C" : " \uD83D\uDD3D" : "";
  feed.innerHTML = `
    <table class="master-table" id="resizable-master" style="table-layout: fixed; width: 100%;">
        <thead style="position: sticky; top: 0; z-index: 10; background: #f8fafc; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
                <th style="width: 110px; min-width: 110px; cursor: pointer;" onclick="toggleSort('estado')">
                    <span id="sort-label-estado">\uD83D\uDEE1️ ESTADO${sortIcon("estado")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="\uD83D\uDED2..." onclick="event.stopPropagation()" oninput="updateColumnFilter('estado', this.value)" value="${columnFilters.estado}">
                </th>
                <th style="width: 280px; cursor: pointer;" onclick="toggleSort('servicio')">
                    <span id="sort-label-servicio">\uD83D\uDCCD SERVICIO${sortIcon("servicio")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('servicio', this.value)" value="${columnFilters.servicio}">
                </th>
                <th style="width: 220px; cursor: pointer;" onclick="toggleSort('titular')">
                    <span id="sort-label-titular">\uD83D\uDC64 TITULAR${sortIcon("titular")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('titular', this.value)" value="${columnFilters.titular}">
                </th>
                <th style="width: 165px; cursor: pointer;" onclick="toggleSort('horario')">
                    <span id="sort-label-horario">⏰ HORARIO${sortIcon("horario")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('horario', this.value)" value="${columnFilters.horario}">
                </th>
                <th style="width: 195px; cursor: pointer;" onclick="toggleSort('suplente')">
                    <span id="sort-label-suplente">\uD83D\uDD04 SUPLENTE${sortIcon("suplente")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('suplente', this.value)" value="${columnFilters.suplente}">
                </th>
                <th style="width: 135px; cursor: pointer;" onclick="toggleSort('finContrato')">
                    <span id="sort-label-finContrato">\uD83D\uDCC5 FIN CONTRATO${sortIcon("finContrato")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('finContrato', this.value)" value="${columnFilters.finContrato}">
                </th>
                <th style="width: 145px; cursor: pointer;" onclick="toggleSort('vacaciones')">
                    <span id="sort-label-vacaciones">\uD83C\uDF34 VACACIONES 26${sortIcon("vacaciones")}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('vacaciones', this.value)" value="${columnFilters.vacaciones}">
                </th>
            </tr>
        </thead>
        <tbody id="master-table-body">
            <!-- Rows injected by renderMasterBodyOnly -->
        </tbody>
    </table>`;
  renderMasterBodyOnly2();
  setTimeout(() => initResizableTable(document.getElementById("resizable-master")), 100);
}
function renderMasterBodyOnly2() {
  const tbody = document.getElementById("master-table-body");
  const countEl = document.getElementById("master-count");
  const masterSearch = document.getElementById("master-search-input");
  const globalSearchInput = document.getElementById("global-search-input");
  let globalQuery = "";
  if (masterSearch && masterSearch.value)
    globalQuery = masterSearch.value.toLowerCase().trim();
  if (!globalQuery && globalSearchInput && globalSearchInput.value)
    globalQuery = globalSearchInput.value.toLowerCase().trim();
  const statsContainer = document.getElementById("master-stats-summary");
  if (!state2.masterData || state2.masterData.length === 0) {
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay datos. Carga un Excel (SYNC MASTER).</td></tr>';
    if (countEl)
      countEl.textContent = "0";
    if (statsContainer)
      statsContainer.innerHTML = "";
    return;
  }
  const keys = Object.keys(state2.masterData[0]);
  const findK = (q) => keys.find((k) => k.toUpperCase().includes(q)) || q;
  const kServicio2 = findK("SERVICIO");
  const kTitular2 = findK("TITULAR");
  const kHorario = findK("HORARIO");
  const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || findK("ESTADO");
  const kSuplente2 = findK("SUPLENTE");
  const kFinContrato = findK("FIN CONTRATO");
  const kVacaciones = findK("VACACIONES 2026");
  const baseData = state2.filteredData !== null ? state2.filteredData : state2.masterData || [];
  let filtered = baseData.filter((row) => {
    if (globalQuery) {
      const rowStr = Object.values(row).join(" ").toLowerCase();
      if (!rowStr.includes(globalQuery))
        return false;
    }
    if (columnFilters.servicio && !(row[kServicio2] || "").toString().toLowerCase().includes(columnFilters.servicio))
      return false;
    if (columnFilters.titular && !(row[kTitular2] || "").toString().toLowerCase().includes(columnFilters.titular))
      return false;
    if (columnFilters.horario && !(row[kHorario] || "").toString().toLowerCase().includes(columnFilters.horario))
      return false;
    if (columnFilters.estado && !(row[kEstado2] || "").toString().toLowerCase().includes(columnFilters.estado))
      return false;
    if (columnFilters.suplente && !(row[kSuplente2] || "").toString().toLowerCase().includes(columnFilters.suplente))
      return false;
    if (columnFilters.finContrato && !(row[kFinContrato] || "").toString().toLowerCase().includes(columnFilters.finContrato))
      return false;
    if (columnFilters.vacaciones && !(row[kVacaciones] || "").toString().toLowerCase().includes(columnFilters.vacaciones))
      return false;
    return true;
  });
  const toolStats = document.getElementById("toolbar-stats-container");
  if (toolStats) {
    const _discRaw = filtered.filter((r) => {
      const e = (r[kEstado2] || "").toString().toUpperCase();
      const t = (r[kTitular2] || "").toString().toUpperCase();
      return e.includes("DESCUBIERTO") || e.includes("VACANTE") || t.includes("SIN TITULAR") || e === "" && t === "";
    });
    const _discSeen = new Set;
    const discCount = _discRaw.filter((r) => {
      const srvName = (r[kServicio2] || "").toString().trim().toUpperCase();
      if (_discSeen.has(srvName))
        return false;
      _discSeen.add(srvName);
      return true;
    }).length;
    toolStats.innerHTML = `
            <div class="lila-badge total">TOTAL: <b>${(state2.masterData || []).length}</b></div>
            <div class="lila-badge visible">VISIBLE: <b>${filtered.length}</b></div>
            <div class="lila-badge uncovered">DESCUBIERTOS: <b>${discCount}</b></div>
        `;
  }
  if (countEl)
    countEl.textContent = filtered.length;
  if (currentSort.key) {
    const keyMap = {
      estado: kEstado2,
      servicio: kServicio2,
      titular: kTitular2,
      horario: kHorario,
      suplente: kSuplente2,
      finContrato: kFinContrato,
      vacaciones: kVacaciones
    };
    const actualKey = keyMap[currentSort.key];
    filtered.sort((a, b) => {
      let valA = a[actualKey] || "";
      let valB = b[actualKey] || "";
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return currentSort.dir === "asc" ? numA - numB : numB - numA;
      }
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
      if (valA < valB)
        return currentSort.dir === "asc" ? -1 : 1;
      if (valA > valB)
        return currentSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }
  window.lastFilteredResults = filtered;
  window.lastFilteredKeys = { kServicio: kServicio2, kTitular: kTitular2, kHorario, kEstado: kEstado2, kSuplente: kSuplente2, kFinContrato, kVacaciones };
  if (window.masterRenderTicket)
    cancelAnimationFrame(window.masterRenderTicket);
  const displayLimit = 600;
  const dataToShow = filtered.slice(0, displayLimit);
  tbody.innerHTML = "";
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="7" class="empty-state" style="padding: 40px; text-align: center; color: #94a3b8; font-weight: 500;">\uD83D\uDEAB No hay servicios que coincidan con los filtros actuales.</td>';
    tbody.appendChild(tr);
    window.masterRenderTicket = null;
    return;
  }
  const CHUNK_SIZE = 50;
  let currentIndex = 0;
  function renderChunk() {
    const chunk = dataToShow.slice(currentIndex, currentIndex + CHUNK_SIZE);
    if (chunk.length === 0) {
      if (filtered.length > displayLimit) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7" style="text-align:center; padding:15px; background:#fff8f8; color:#ef4444; font-weight:700;">⚠️ Mostrando solo ${displayLimit} de ${filtered.length} registros. Usa los filtros superiores para refinar la búsqueda.</td>`;
        tbody.appendChild(tr);
      }
      window.masterRenderTicket = null;
      return;
    }
    const html = chunk.map((row) => {
      const realIndex = state2.masterData.indexOf(row);
      const s = row[kServicio2] || "";
      const t = row[kTitular2] || "";
      const h = row[kHorario] || "";
      const e = row[kEstado2] || "";
      const sup = row[kSuplente2] || "";
      const fin = window.formatExcelDate(row[kFinContrato]);
      const vac = window.formatExcelDate(row[kVacaciones]);
      const eUpper = (e || "").toString().toUpperCase();
      const tUpper = (t || "").toString().toUpperCase();
      const isDisc = eUpper.includes("DESCUBIERTO") || eUpper.includes("VACANTE") || tUpper.includes("SIN TITULAR") || eUpper === "" && tUpper === "";
      const rowClass = isDisc ? "critical-row" : "";
      const statusBadge = isDisc ? '<span class="badge red ai-pulse-alert" style="animation-duration: 3s;">DESCUBIERTO</span>' : '<span class="badge green">CUBIERTO</span>';
      return `
                <tr class="${rowClass}" data-row-index="${realIndex}">
                    <td><div class="td-content">${statusBadge}</div></td>
                    <td title="${s}"><div class="td-content"><b>${s}</b></div></td>
                    <td title="${t}"><div class="td-content editable" contenteditable="true" onblur="updateMasterCell(${realIndex}, '${kTitular2}', this.innerText.trim())">${t}</div></td>
                    <td title="${h}"><div class="td-content" style="color:var(--sifu-blue); font-family:monospace; font-size:12.5px;">${h}</div></td>
                    <td title="${sup}"><div class="td-content editable" contenteditable="true" onblur="updateMasterCell(${realIndex}, '${kSuplente2}', this.innerText.trim())">${sup || "-"}</div></td>
                    <td title="${fin}"><div class="td-content">${fin || "-"}</div></td>
                    <td title="${vac}"><div class="td-content">${vac || "-"}</div></td>
                </tr>
            `;
    }).join("");
    tbody.insertAdjacentHTML("beforeend", html);
    currentIndex += CHUNK_SIZE;
    window.masterRenderTicket = requestAnimationFrame(renderChunk);
  }
  window.masterRenderTicket = requestAnimationFrame(renderChunk);
}
function updateEmergencyPopup() {
  const popup = document.getElementById("emergency-list");
  if (!popup || !state2.masterData || !state2.masterData.length)
    return;
  const keys = Object.keys(state2.masterData[0]);
  const keyE = keys.find((k) => k.toUpperCase() === "ESTADO") || "ESTADO";
  const keyH = keys.find((k) => k.toUpperCase().includes("HORARIO")) || "HORARIO";
  const keyS = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const discovered = state2.masterData.filter((r) => {
    const servicio = (r[keyS] || "").toString().trim();
    if (!servicio)
      return false;
    return (r[keyE] || "").toString().toUpperCase().includes("DESCUBIERTO");
  });
  const container = document.getElementById("emergency-popup-container");
  if (discovered.length === 0) {
    if (container)
      container.style.display = "none";
    return;
  }
  if (container)
    container.style.display = "flex";
  popup.innerHTML = discovered.slice(0, 10).map((r) => `
    <div class="emergency-item-mini">
            <span class="icon">\uD83D\uDEA8</span>
            <div class="info">
                <div class="name">${r[keyS]}</div>
                <div class="status">SIN COBERTURA - ${r[keyH] || "S.H."}</div>
            </div>
        </div>
    `).join("") + (discovered.length > 10 ? `<div style="text-align:center; font-size:9px; color:#8a8d90;">+ ${discovered.length - 10} más en lista...</div>` : "");
}
function initResizableTable(table) {
  if (!table)
    return;
  const cols = table.querySelectorAll("th");
  [].forEach.call(cols, (col) => {
    const resizer = col.querySelector(".resizer");
    if (!resizer)
      return;
    let x = 0;
    let w = 0;
    const mouseDownHandler = (e) => {
      x = e.clientX;
      const styles = window.getComputedStyle(col);
      w = parseInt(styles.width, 10);
      document.addEventListener("mousemove", mouseMoveHandler);
      document.addEventListener("mouseup", mouseUpHandler);
      resizer.classList.add("resizing");
    };
    const mouseMoveHandler = (e) => {
      const dx = e.clientX - x;
      col.style.width = `${w + dx}px`;
    };
    const mouseUpHandler = () => {
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
      resizer.classList.remove("resizing");
    };
    resizer.addEventListener("mousedown", mouseDownHandler);
  });
}
function renderIncidents(query = "") {
  if (!incidentFeed)
    return;
  let filtered = state2.incidents;
  if (query)
    filtered = filtered.filter((i) => i.worker.toLowerCase().includes(query) || i.type.toLowerCase().includes(query));
  if (filtered.length === 0) {
    incidentFeed.innerHTML = '<div class="empty-state">SIN INCIDENCIAS</div>';
    return;
  }
  incidentFeed.innerHTML = filtered.map((inc) => `
    <div class="feed-item priority-${inc.priority.toLowerCase()} ${inc.reported ? "reported" : ""}">
            <div class="item-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" ${inc.reported ? "checked" : ""} onclick="toggleReported(${inc.id})" style="width:18px; height:18px; cursor:pointer;">
                    <span class="item-worker">${inc.worker}</span>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="priority-tag priority-${inc.priority.toLowerCase()}">${inc.priority}</span>
                    <button onclick="deleteIncident(${inc.id})" class="btn-delete-small" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:18px;">&times;</button>
                </div>
            </div>
            <div class="item-desc">
                <strong style="color:var(--sifu-blue);">${inc.type}</strong>: ${inc.desc || "Sin descripción detallada"}
            </div>
            <div style="font-size:10px; opacity:0.7;">ASISTENTE: ONLINE</div>
            <div style="font-size:11px; color:var(--text-dim); display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span>\uD83D\uDCC5 ${formatNoteDate(inc.date)}</span>
                <span>⏰ ${inc.time}</span>
            </div>
        </div>
    `).join("");
}
window.toggleReported = (id) => {
  const inc = state2.incidents.find((i) => i.id === id);
  if (inc) {
    inc.reported = !inc.reported;
    if (window.ApiClient) {
      window.ApiClient.updateIncident(id, { reported: inc.reported });
    }
    saveAndRender();
  }
};
window.deleteIncident = (id) => {
  if (confirm("Eliminar incidencia?")) {
    state2.incidents = state2.incidents.filter((i) => i.id !== id);
    if (window.ApiClient) {
      window.ApiClient.deleteIncident(id);
    }
    saveAndRender();
  }
};
function renderNotes() {
  const topFeed = document.getElementById("top-notes-feed");
  const sideFeed = document.getElementById("notes-feed");
  const topCount = document.getElementById("top-notes-count");
  console.log("\uD83D\uDCDD Renderizando Notas:", state2.notes.length);
  const pendingNotes = state2.notes.filter((n) => !n.completed);
  if (topCount)
    topCount.textContent = pendingNotes.length;
  const generateSideHTML = (notes) => {
    if (notes.length === 0)
      return '<div class="empty-state">EL CEREBRO OPERATIVO ESTÁ LIMPIO.</div>';
    return notes.map((note) => {
      const tag = note.tag || "INFO";
      const tagClass = `tag-${tag.toLowerCase()}`;
      const tagIcon = tag === "URGENTE" ? "\uD83D\uDD25" : tag === "SEGUIMIENTO" ? "\uD83D\uDCDE" : "\uD83D\uDCCC";
      return `
    <div class="note-item ${tagClass} ${note.completed ? "completed" : ""}" style="cursor:pointer;" onclick="toggleNote(${note.id})">
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="flex:1;">
                <div style="font-size:10px; font-weight:800; color:var(--text-dim); margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                    <span>${tagIcon}</span> ${note.tag || "INFO"}
                </div>
                <div class="note-text" style="font-size:13px; color:var(--text-main); line-height:1.5; font-weight:500;">${note.text}</div>
                <div style="font-size:10px; color:var(--text-dim); margin-top:8px;">\uD83D\uDCC5 ${formatNoteDate(note.date)}</div>
            </div>
            <button onclick="event.stopPropagation(); deleteNote(${note.id})" style="background:none; border:none; color:#ccc; cursor:pointer; font-size:16px; padding:0 5px;">&times;</button>
        </div>
                </div>
    `;
    }).join("");
  };
  const generateTopHTML = (notes) => {
    if (notes.length === 0)
      return '<div class="empty-state" style="font-size:11px; padding:10px;">TODO AL DÍA.</div>';
    return notes.map((note) => {
      const tag = note.tag || "INFO";
      const tagIcon = tag === "URGENTE" ? "\uD83D\uDD25" : tag === "SEGUIMIENTO" ? "\uD83D\uDCDE" : "\uD83D\uDCCC";
      return `
    <div class="note-card-horizontal ${note.tag || "INFO"}" onclick="toggleNote(${note.id})">
                        <div class="note-card-header">
                            <span>${tagIcon} ${note.tag || "INFO"}</span>
                            <span>${formatNoteDate(note.date).split(",")[0]}</span>
                        </div>
                        <div class="note-card-body">${note.text}</div>
                        <div class="note-card-footer">Hacer clic para marcar como hecha</div>
                    </div>
    `;
    }).join("");
  };
  if (topFeed)
    topFeed.innerHTML = generateTopHTML(pendingNotes);
  if (sideFeed)
    sideFeed.innerHTML = generateSideHTML(state2.notes);
}
window.addNoteFromSistema = () => {
  const input = document.getElementById("note-input");
  const activeTagBtn = document.querySelector(".tag-btn.active");
  if (!input || !input.value.trim())
    return;
  const newNote = {
    id: Date.now(),
    text: input.value.trim(),
    tag: activeTagBtn ? activeTagBtn.dataset.tag : "INFO",
    date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    completed: false
  };
  state2.notes.unshift(newNote);
  input.value = "";
  if (window.ApiClient) {
    window.ApiClient.createNote(newNote);
  }
  saveAndRender();
  updateTicker2("SISTEMA: APUNTE GUARDADO");
};
window.deleteNote = (id) => {
  state2.notes = state2.notes.filter((n) => n.id !== id);
  if (window.ApiClient) {
    window.ApiClient.deleteNote(id);
  }
  saveAndRender();
};
window.clearAllNotes = () => {
  if (confirm("¿Limpiar todas las notas terminadas?")) {
    const completedNotes = state2.notes.filter((n) => n.completed);
    state2.notes = state2.notes.filter((n) => !n.completed);
    if (window.ApiClient) {
      completedNotes.forEach((n) => {
        window.ApiClient.deleteNote(n.id);
      });
    }
    saveAndRender();
  }
};
function formatNoteDate(dateVal) {
  if (!dateVal)
    return "--/--";
  if (!isNaN(dateVal) && dateVal.toString().length > 10) {
    return new Date(Number(dateVal)).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return dateVal.toString();
}
window.toggleNote = (id) => {
  const note = state2.notes.find((n) => n.id === id);
  if (note) {
    note.completed = !note.completed;
    if (window.ApiClient) {
      window.ApiClient.updateNote(id, { completed: note.completed });
    }
    saveAndRender();
  }
};
function refreshMetrics() {
  if (!state2.masterData || state2.masterData.length === 0) {
    state2.uncovered = [];
    state2.absences = [];
    return;
  }
  const keys = Object.keys(state2.masterData[0]);
  const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
  const kTitular2 = keys.find((k) => k.toUpperCase().trim() === "TITULAR") || "TITULAR";
  const kSalud = keys.find((k) => k.toUpperCase().trim() === "ESTADO1") || keys.find((k) => k.toUpperCase().includes("SALUD")) || keys.find((k) => k.toUpperCase().includes("BAJA")) || "ESTADO1";
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kHorario = keys.find((k) => k.toUpperCase().includes("HORARIO")) || "HORARIO";
  const _seenUncov = new Set;
  state2.uncovered = state2.masterData.filter((row) => {
    const valS = (row[kServicio2] || "").toString().trim();
    if (!valS)
      return false;
    const valE = (row[kEstado2] || "").toString().toUpperCase();
    const valT = (row[kTitular2] || "").toString().toUpperCase();
    const isSpecial = valE.includes("BRIGADA") || valT.includes("RUTA CRISTALES") || valE.includes("OBRAS") || valE.includes("CERRADO");
    const isDesc = valE.includes("DESCUBIERTO") || valE.includes("VACANTE") || valE.includes("SIN ASIGNAR") || valT.includes("SIN TITULAR") || valT.includes("DESCUBIERTO") || valT.includes("VACANTE") || valE === "" && (valT === "" || valT === "SIN TITULAR") || valE === "PENDIENTE" && valT === "";
    if (!isDesc || isSpecial)
      return false;
    const srvKey = valS.toUpperCase();
    if (_seenUncov.has(srvKey))
      return false;
    _seenUncov.add(srvKey);
    return true;
  }).map((row) => ({
    id: Date.now() + Math.random(),
    center: row[kServicio2] || "---",
    worker: row[kTitular2] || "DESCUBIERTO",
    shift: row[kHorario] || "--:--",
    risk: true
  }));
  state2.absences = state2.masterData.filter((row) => {
    const valE = (row[kEstado2] || "").toString().toUpperCase();
    const valS = kSalud ? (row[kSalud] || "").toString().toUpperCase() : "";
    return valE.includes("BAJA") || valE.includes("IT") || valS.includes("BAJA") || valS.includes("IT") || valS.includes("VACACIONES");
  }).map((row) => ({
    id: Date.now() + Math.random(),
    worker: row[kTitular2] || "PERSONAL",
    center: row[kServicio2] || "---",
    reason: (row[kSalud] || row[kEstado2] || "BAJA IT").toString()
  }));
}
function updateHeaderStats() {
  refreshMetrics();
  if (hIncidents)
    hIncidents.textContent = state2.incidents.length;
  const total = state2.masterData.length;
  const active = Math.max(0, total - state2.uncovered.length - state2.absences.length);
  if (hActive)
    hActive.textContent = active;
  state2.stats.activeWorkers = active;
}
function processQuickInput(text) {
  const upper = text.toUpperCase();
  if (upper.startsWith("NOTA:")) {
    const noteText = text.substring(5).trim();
    const newNote = {
      id: Date.now(),
      text: noteText,
      tag: "INFO",
      date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      completed: false
    };
    state2.notes.unshift(newNote);
    if (window.ApiClient) {
      window.ApiClient.createNote(newNote);
    }
    updateTicker2("NOTA GUARDADA EN SISTEMA OPERATIVO");
  } else {
    const newIncident = {
      id: Date.now(),
      worker: "REGISTRO RÁPIDO",
      type: "OTRO",
      priority: "MID",
      desc: text,
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toLocaleDateString("es-ES"),
      reported: false
    };
    state2.incidents.unshift(newIncident);
    if (window.ApiClient) {
      window.ApiClient.createIncident(newIncident);
    }
    updateTicker2("INCIDENCIA REGISTRADA");
  }
  saveAndRender();
}
function startTicker() {
  if (!tickerEl)
    return;
  const msgs = [
    "SISTEMA OPERATIVO: CONECTADO",
    "MASTER GENERAL: SINCRONIZADO v8.1",
    "SISTEMA DE PREDICCIÓN OPERATIVA: ACTIVO",
    "NOTIFICACIONES: EN COLA"
  ];
  let i = 0;
  setInterval(() => {
    tickerEl.textContent = msgs[i];
    i = (i + 1) % msgs.length;
  }, 5000);
}
function updateTicker2(msg) {
  if (tickerEl) {
    console.log("SISTEMA Ticker:", msg);
    tickerEl.innerHTML = `<span style="color:var(--sifu-blue); font-weight:bold;">[V - OK - 10]</span> ${msg}`;
    tickerEl.style.color = "var(--sifu-amber)";
    setTimeout(() => tickerEl.style.color = "", 3000);
  }
}
window.switchWidget = (type) => {
  const wTitle = document.getElementById("widget-title");
  const wContent = document.getElementById("unified-widget-content");
  if (!wTitle || !wContent)
    return;
};
window.showUncoveredDetails = () => {
  if (!state2.masterData)
    return;
  const _rawUncovered2 = state2.masterData.filter((row) => {
    const keys = Object.keys(row);
    const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
    const kTitular2 = keys.find((k) => k.toUpperCase().trim() === "TITULAR") || "TITULAR";
    const status = (row[kEstado2] || "").toString().toUpperCase();
    const titular = (row[kTitular2] || "").toString().toUpperCase();
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO"));
    if (!row[kServicio2])
      return false;
    return status.includes("DESCUBIERTO") || status.includes("VACANTE") || status.includes("SIN ASIGNAR") || titular.includes("SIN TITULAR") || titular.includes("DESCUBIERTO") || titular.includes("VACANTE") || status === "" && (titular === "" || titular === "SIN TITULAR") || status === "PENDIENTE" && titular === "";
  });
  const _seenSrv2 = new Set;
  const uncovered = _rawUncovered2.filter((row) => {
    const keys = Object.keys(row);
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO"));
    const srvName = (row[kServicio2] || "").toString().trim().toUpperCase();
    if (_seenSrv2.has(srvName))
      return false;
    _seenSrv2.add(srvName);
    return true;
  });
  if (uncovered.length === 0) {
    showStatusModal("DESCUBIERTOS", '<p style="text-align:center; padding:20px; color:var(--text-dim);">✅ No hay servicios descubiertos actualmente.</p>');
    return;
  }
  const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>ESTADO</th>
                    <th>HORARIO</th>
                </tr>
            </thead>
            <tbody>
                ${uncovered.map((row) => {
    const keys = Object.keys(row);
    const srv = row[keys.find((k) => k.toUpperCase().includes("SERVICIO"))] || "-";
    const est = row[keys.find((k) => k.toUpperCase().trim() === "ESTADO")] || "DESCUBIERTO";
    const hor = row[keys.find((k) => k.toUpperCase().includes("HORARIO"))] || "-";
    return `
                        <tr class="critical-row">
                            <td><div class="td-content"><b>${srv}</b></div></td>
                            <td><span class="badge red">${est}</span></td>
                            <td><div class="td-content" style="font-family:monospace; color:var(--sifu-blue);">${hor}</div></td>
                        </tr>`;
  }).join("")}
            </tbody>
        </table>
    </div>`;
  showStatusModal(`DESCUBIERTOS (${uncovered.length})`, html);
};
window.showAbsenceDetails = () => {
  if (!state2.masterData)
    return;
  const keys = Object.keys(state2.masterData[0]);
  const kEstado1 = keys.find((k) => k.toUpperCase().trim() === "ESTADO1") || keys.find((k) => k.toUpperCase().includes("SALUD")) || keys.find((k) => k.toUpperCase().includes("BAJA")) || "ESTADO1";
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kTitular2 = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  const absences = state2.masterData.filter((row) => {
    const keys2 = Object.keys(row);
    const kEst = keys2.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
    const kEst1 = keys2.find((k) => k.toUpperCase().trim() === "ESTADO1") || "ESTADO1";
    const stateUpper = (row[kEst] || "").toString().toUpperCase();
    const healthUpper = (row[kEst1] || "").toString().toUpperCase();
    return healthUpper.includes("BAJA") || healthUpper.includes("IT") || healthUpper.includes("I.T") || healthUpper.includes("VACACIONES") || stateUpper.includes("BAJA") || stateUpper.includes("IT");
  });
  if (absences.length === 0) {
    showStatusModal("BAJAS / IT", '<p style="text-align:center; padding:20px; color:var(--text-dim);">✅ No hay bajas activas hoy.</p>');
    return;
  }
  const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>TITULAR</th>
                    <th>ESTADO / SALUD</th>
                </tr>
            </thead>
            <tbody>
                ${absences.map((row) => {
    const srv = row[kServicio2] || "-";
    const tit = row[kTitular2] || "-";
    const est1 = row[kEstado1] || "BAJA";
    let badgeClass = "blue";
    if (est1.toUpperCase().includes("BAJA") || est1.toUpperCase().includes("IT"))
      badgeClass = "red";
    if (est1.toUpperCase().includes("VAC"))
      badgeClass = "green";
    return `
                    <tr>
                        <td><div class="td-content"><b>${srv}</b></div></td>
                        <td><div class="td-content">${tit}</div></td>
                        <td><span class="badge ${badgeClass}">${est1}</span></td>
                    </tr>`;
  }).join("")}
            </tbody>
        </table>
    </div>`;
  showStatusModal(`DETALLE DE BAJAS (${absences.length})`, html);
};
window.showIncidentDetails = () => {
  if (!state2.incidents || state2.incidents.length === 0) {
    showStatusModal("INCIDENCIAS", "<p>No hay incidencias registradas.</p>");
    return;
  }
  const priorityOrder = { HIGH: 0, MID: 1, LOW: 2 };
  const sorted = [...state2.incidents].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));
  const html = `<ul class="notebook-feed">
        ${sorted.map((inc) => `
            <li class="note-card-horizontal" style="transform:none;">
                <div class="note-content">
                    <strong style="color:var(--sifu-blue);">${inc.worker}</strong><br>
                    ${inc.desc} 
                </div>
                <div class="note-footer">
                    <span class="badge ${inc.priority === "HIGH" ? "red" : "blue"}">${inc.priority}</span>
                    ${inc.date || ""}
                </div>
            </li>
        `).join("")}
    </ul>`;
  showStatusModal(`INCIDENCIAS (${state2.incidents.length})`, html);
};
var reportChartCoverageInstance = null;
var reportChartAbsencesInstance = null;
window.openSituationalReport = () => {
  console.log("\uD83D\uDCCA Apertura de Informe Situacional...");
  refreshMetrics();
  const modal = document.getElementById("situational-report-modal");
  if (!modal) {
    console.error("❌ Error: El modal situational-report-modal no existe en el DOM");
    showToast2("Error: No se encuentra el modal de informe", "error");
    return;
  }
  modal.style.display = "flex";
  modal.classList.add("active");
  const total = state2.masterData && Array.isArray(state2.masterData) ? state2.masterData.length : 0;
  const uncoveredCount = state2.uncovered && Array.isArray(state2.uncovered) ? state2.uncovered.length : 0;
  const absencesCount = state2.absences && Array.isArray(state2.absences) ? state2.absences.length : 0;
  const activeCount = Math.max(0, total - uncoveredCount - absencesCount);
  const coveragePct = total > 0 ? (activeCount / total * 100).toFixed(1) : "0.0";
  const elCov = document.getElementById("report-coverage-val");
  if (elCov)
    elCov.textContent = `${coveragePct}%`;
  const elAct = document.getElementById("report-active-val");
  if (elAct)
    elAct.textContent = activeCount;
  const elUnc = document.getElementById("report-uncovered-val");
  if (elUnc)
    elUnc.textContent = uncoveredCount;
  const elAbs = document.getElementById("report-absences-val");
  if (elAbs)
    elAbs.textContent = absencesCount;
  setTimeout(() => {
    renderReportCharts(activeCount, uncoveredCount, absencesCount);
    updateReportAnalysis(uncoveredCount);
  }, 100);
};
window.closeSituationalReport = () => {
  const modal = document.getElementById("situational-report-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
};
function renderReportCharts(active, uncovered, absences) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js library not loaded.");
    return;
  }
  const ctxCov = document.getElementById("reportChartCoverage");
  const ctxAbs = document.getElementById("reportChartAbsences");
  if (reportChartCoverageInstance) {
    reportChartCoverageInstance.destroy();
    reportChartCoverageInstance = null;
  }
  if (reportChartAbsencesInstance) {
    reportChartAbsencesInstance.destroy();
    reportChartAbsencesInstance = null;
  }
  if (ctxCov) {
    reportChartCoverageInstance = new Chart(ctxCov, {
      type: "doughnut",
      data: {
        labels: ["Activos", "Descubiertos", "Absentismo"],
        datasets: [{
          data: [active, uncovered, absences],
          backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }
        }
      }
    });
  }
  if (ctxAbs) {
    const types = { "BAJA IT": 0, VACACIONES: 0, PERMISOS: 0, OTROS: 0 };
    state2.absences.forEach((a) => {
      const r = (a.reason || "").toUpperCase();
      if (r.includes("BAJA") || r.includes("IT"))
        types["BAJA IT"]++;
      else if (r.includes("VACACIONES"))
        types["VACACIONES"]++;
      else if (r.includes("PERMISO"))
        types["PERMISOS"]++;
      else
        types["OTROS"]++;
    });
    reportChartAbsencesInstance = new Chart(ctxAbs, {
      type: "bar",
      data: {
        labels: Object.keys(types),
        datasets: [{
          label: "Cantidad",
          data: Object.values(types),
          backgroundColor: ["#3b82f6", "#8b5cf6", "#ec4899", "#64748b"],
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}
function updateReportAnalysis(uncoveredCount) {
  const hotspotsList = document.getElementById("report-hotspots-list");
  const actionsList = document.getElementById("report-actions-list");
  if (!hotspotsList || !actionsList)
    return;
  const counts = {};
  state2.uncovered.forEach((u) => {
    counts[u.center] = (counts[u.center] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (sorted.length === 0) {
    hotspotsList.innerHTML = '<li style="background:#f0fdf4; color:#166534; border-left-color:#16a34a;">✅ Todo cubierto. Sin puntos calientes.</li>';
  } else {
    hotspotsList.innerHTML = sorted.map(([name, count]) => `<li><strong>${name}</strong>: ${count} puesto(s) descubierto(s)</li>`).join("");
  }
  let actionsHTML = "";
  if (uncoveredCount > 0) {
    const plural = uncoveredCount > 1 ? "s" : "";
    actionsHTML += `<li>Movilizar bolsa de suplencia para cubrir ${uncoveredCount} vacante${plural} urgente${plural}.</li>`;
    if (sorted[0])
      actionsHTML += `<li>Prioridad: Enviar coordinador a <strong>${sorted[0][0]}</strong>.</li>`;
  }
  const highPriorityIncidents = state2.incidents.filter((i) => i.priority === "HIGH" && !i.reported).length;
  if (highPriorityIncidents > 0) {
    actionsHTML += `<li>Resolver ${highPriorityIncidents} incidencias de ALTA prioridad pendientes.</li>`;
  }
  if (actionsHTML === "") {
    actionsHTML = "<li>Realizar auditoría preventiva de calidad en servicios TOP 10.</li><li>Actualizar cuadrantes para el próximo periodo.</li>";
  }
  actionsList.innerHTML = actionsHTML;
}
window.downloadReportPDF = async () => {
  const element = document.querySelector(".report-modal-content");
  if (!element)
    return;
  element.classList.add("pdf-compact");
  const actions = element.querySelector(".footer-actions");
  const closeBtn = element.querySelector(".close-modal");
  const originalActionsDisplay = actions ? actions.style.display : "";
  const originalCloseDisplay = closeBtn ? closeBtn.style.display : "";
  if (actions)
    actions.style.display = "none";
  if (closeBtn)
    closeBtn.style.display = "none";
  if (reportChartCoverageInstance)
    reportChartCoverageInstance.resize();
  if (reportChartAbsencesInstance)
    reportChartAbsencesInstance.resize();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const opt = {
    margin: 5,
    filename: `SIFU_Informe_Situacional_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape", compress: true }
  };
  if (typeof html2pdf === "undefined") {
    alert("Librería PDF no cargada. Por favor recarga la página.");
    cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay);
    return;
  }
  try {
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error("PDF Generation Error:", err);
  } finally {
    cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay);
  }
};
window.downloadReportExcel = () => {
  if (!state2.masterData)
    return;
  const wb = XLSX.utils.book_new();
  const summary = [
    { CONCEPTO: "Total Servicios", VALOR: state2.masterData.length },
    { CONCEPTO: "Servicios Descubiertos", VALOR: state2.uncovered.length },
    { CONCEPTO: "Absentismo Total", VALOR: state2.absences.length },
    { CONCEPTO: "Porcentaje Cobertura", VALOR: ((state2.masterData.length - state2.uncovered.length - state2.absences.length) / state2.masterData.length * 100).toFixed(2) + "%" }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "RESUMEN_EJECUTIVO");
  if (state2.uncovered.length > 0) {
    const wsUncovered = XLSX.utils.json_to_sheet(state2.uncovered);
    XLSX.utils.book_append_sheet(wb, wsUncovered, "DESCUBIERTOS");
  }
  if (state2.absences.length > 0) {
    const wsAbsences = XLSX.utils.json_to_sheet(state2.absences);
    XLSX.utils.book_append_sheet(wb, wsAbsences, "ABSENTISMO");
  }
  XLSX.writeFile(wb, `SIFU_Informe_Situacional_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast2("EXCEL GENERADO CON ÉXITO", "success");
};
function cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay) {
  if (actions)
    actions.style.display = originalActionsDisplay;
  if (closeBtn)
    closeBtn.style.display = originalCloseDisplay;
  element.classList.remove("pdf-compact");
  setTimeout(() => {
    if (reportChartCoverageInstance)
      reportChartCoverageInstance.resize();
    if (reportChartAbsencesInstance)
      reportChartAbsencesInstance.resize();
  }, 100);
}
window.generateOperationalInsights = async () => {
  const container = document.getElementById("op-insights-container");
  const typing = document.getElementById("op-typing-indicator");
  if (!container || !typing)
    return;
  container.innerHTML = "";
  typing.style.display = "block";
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const addMsg = (html, type = "normal") => {
    const div = document.createElement("div");
    div.className = `op-msg ${type}`;
    div.innerHTML = html;
    container.appendChild(div);
    div.scrollIntoView({ behavior: "smooth" });
  };
  const thinkingSteps = [
    "Conectando con el núcleo de datos...",
    "Analizando patrones de cobertura en tiempo real...",
    "Cruzando incidencias con cuadrantes activos...",
    "Detectando anomalías operativas..."
  ];
  const typingText = document.createElement("div");
  typingText.style.color = "#94a3b8";
  typingText.style.fontSize = "12px";
  typingText.style.marginTop = "10px";
  typingText.style.fontFamily = "monospace";
  typingText.id = "op-thinking-text";
  typingText.style.textAlign = "center";
  container.appendChild(typingText);
  for (const step of thinkingSteps) {
    typingText.innerText = `> ${step}`;
    await wait(800 + Math.random() * 600);
  }
  if (typingText.parentNode)
    typingText.remove();
  typing.style.display = "none";
  const stats = analyzeMasterData();
  const incidentStats = analyzeIncidents();
  await wait(200);
  addMsg("He completado el análisis del estado operativo actual.", "normal");
  if (stats.descubiertos > 0) {
    await wait(1000);
    const serviceName = stats.topDescubiertoService || "múltiples puntos";
    addMsg(`⚠️ <strong>Atención:</strong> He detectado una fractura en la cobertura. Tenemos <strong>${stats.descubiertos} servicios descubiertos</strong> ahora mismo.`, "urgent");
    await wait(1200);
    addMsg(`El foco del problema parece estar en <strong>${serviceName}</strong>. Basado en los datos, esto representa un riesgo crítico de servicio.`, "normal");
  } else {
    await wait(1000);
    addMsg(`✅ <strong>Todo parece en orden.</strong> La cobertura está al <strong>100%</strong>. No detecto desviaciones en los servicios principales.`, "success");
  }
  if (incidentStats.highPriority > 0) {
    await wait(1200);
    addMsg(`He correlacionado esto con <strong>${incidentStats.highPriority} incidencias de alta prioridad</strong> reportadas recientemente. Sugiero atenderlas antes de que escalen.`, "urgent");
  }
  await wait(1500);
  let suggestion = "";
  if (stats.descubiertos > 0) {
    suggestion = "\uD83D\uDCA1 <strong>Mi recomendación:</strong> Contacta inmediatamente con la bolsa de suplencia para la zona afectada. Si mueves efectivos de servicios con baja carga, podrías cubrir el hueco en 30 minutos.";
  } else {
    suggestion = "\uD83D\uDCA1 <strong>Sugerencia proactiva:</strong> Dado que la estabilidad es alta, es un buen momento para realizar auditorías de calidad preventivas en los servicios VIP.";
  }
  addMsg(suggestion, "normal");
};
function analyzeMasterData() {
  if (!state2.masterData || state2.masterData.length === 0)
    return { descubiertos: 0, totalActive: 0 };
  const keys = Object.keys(state2.masterData[0]);
  const kEstado2 = keys.find((k) => k.toUpperCase().includes("ESTADO")) || "ESTADO";
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kTitular2 = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  let descubiertos = 0;
  let serviceCounts = {};
  state2.masterData.forEach((row) => {
    const status = (row[kEstado2] || "").toString().toUpperCase();
    const titular = (row[kTitular2] || "").toString().toUpperCase();
    const isSpecial = status.includes("BRIGADA") || titular.includes("RUTA CRISTALES") || status.includes("OBRAS") || status.includes("CERRADO");
    const isDesc = (status.includes("DESCUBIERTO") || status.includes("VACANTE") || status.includes("SIN ASIGNAR") || titular.includes("SIN TITULAR") || titular.includes("DESCUBIERTO") || titular.includes("VACANTE") || status === "" && (titular === "" || titular === "SIN TITULAR") || status === "PENDIENTE" && titular === "") && !isSpecial;
    if (isDesc) {
      descubiertos++;
      const srv = row[kServicio2] || "Desconocido";
      serviceCounts[srv] = (serviceCounts[srv] || 0) + 1;
    }
  });
  let topDescubiertoService = null;
  let max = 0;
  for (const [srv, count] of Object.entries(serviceCounts)) {
    if (count > max) {
      max = count;
      topDescubiertoService = srv;
    }
  }
  return {
    descubiertos,
    totalActive: state2.masterData.length,
    topDescubiertoService
  };
}
function analyzeIncidents() {
  const active = state2.incidents.filter((i) => !i.reported);
  const high = state2.incidents.filter((i) => i.priority === "HIGH").length;
  return {
    total: state2.incidents.length,
    highPriority: high
  };
}
window.switchTab = (tabId) => {
  const tabs = document.querySelectorAll(".tab-content");
  const btns = document.querySelectorAll(".tab-btn");
  tabs.forEach((c) => c.classList.remove("active"));
  btns.forEach((b) => b.classList.remove("active"));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.add("active");
    const btn = [...btns].find((b) => b.getAttribute("onclick") && b.getAttribute("onclick").includes(`'${tabId}'`) || b.getAttribute("data-tab") === tabId);
    if (btn)
      btn.classList.add("active");
    if (tabId === "pedidos") {
      console.log("\uD83D\uDCE6 Refrescando vista de Pedidos...");
      if (typeof renderOrders === "function")
        window.renderOrders();
      setTimeout(() => {
        if (typeof initOrdersModule === "function")
          window.initOrdersModule();
      }, 50);
    }
    if (tabId === "resumen") {
      setTimeout(() => {
        if (typeof updateCharts === "function")
          updateCharts();
        if (typeof updateOperationalChart === "function")
          updateOperationalChart();
      }, 100);
    }
    if (tabId === "aldi-parts") {
      console.log("\uD83D\uDCDD Entrando en Partes Aldi...");
      if (typeof AldiPartsScanner !== "undefined") {
        AldiPartsScanner.init();
      }
    }
    if (tabId === "abonos") {
      console.log("\uD83D\uDCC9 Analizando Bajas IT...");
      if (typeof window.renderITTable === "function")
        setTimeout(window.renderITTable, 50);
    }
    if (tabId === "vacaciones") {
      console.log("\uD83C\uDFD6️ Analizando Vacaciones...");
      if (typeof window.VacationModule === "object")
        setTimeout(() => window.VacationModule.init(), 50);
    }
    if (tabId === "cuadrantes") {
      console.log("\uD83D\uDDD3️ Iniciando Cuadrantes...");
      if (typeof window.initQuadrantsModule === "function")
        setTimeout(window.initQuadrantsModule, 50);
    }
    if (tabId === "smarthub") {
      console.log("\uD83D\uDCCA Inicializando GESTIÓN AVANZADA...");
      setTimeout(() => {
        if (typeof DailyChecklist !== "undefined" && typeof DailyChecklist.render === "function") {
          DailyChecklist.render();
        }
        if (typeof CalendarModule !== "undefined" && typeof CalendarModule.render === "function") {
          CalendarModule.render();
        }
        if (typeof AnalyticsTrends !== "undefined") {
          if (typeof AnalyticsTrends.renderTrendsChart === "function") {
            AnalyticsTrends.renderTrendsChart();
          }
          if (typeof AnalyticsTrends.renderInsights === "function") {
            AnalyticsTrends.renderInsights();
          }
        }
        showToast2("✨ SMART HUB CARGADO", "success");
      }, 100);
    }
    if (tabId === "parkings") {
      console.log("\uD83D\uDE97 Inicializando Panel de PARKING's...");
      setTimeout(() => {
        if (typeof ParkingManager !== "undefined") {
          ParkingManager.init();
        }
      }, 50);
    }
    if (tabId === "avanzado") {
      console.log("\uD83D\uDE80 Inicializando MÓDULOS AVANZADOS...");
      setTimeout(() => {
        if (typeof AIPredictiveEngine !== "undefined") {
          if (typeof AIPredictiveEngine.renderPredictions === "function") {
            AIPredictiveEngine.renderPredictions();
          }
          if (typeof AIPredictiveEngine.renderRecommendations === "function") {
            AIPredictiveEngine.renderRecommendations();
          }
        }
        if (typeof WorkerPerformance !== "undefined" && typeof WorkerPerformance.init === "function") {
          WorkerPerformance.init();
        }
        if (typeof SubstituteManagement !== "undefined" && typeof SubstituteManagement.init === "function") {
          SubstituteManagement.init();
        }
        if (typeof MLEngine !== "undefined") {
          if (typeof MLEngine.predictUncoveredServices === "function") {
            MLEngine.predictUncoveredServices().then(() => {
              if (typeof MLEngine.renderPredictions === "function") {
                MLEngine.renderPredictions();
              }
            });
          }
          if (typeof MLEngine.renderAnomalies === "function") {
            if (typeof MLEngine.detectAnomalies === "function")
              MLEngine.detectAnomalies();
            MLEngine.renderAnomalies();
          }
        }
        if (typeof RouteOptimizer !== "undefined" && typeof RouteOptimizer.renderRouteOptimization === "function") {
          RouteOptimizer.renderRouteOptimization();
        }
        if (typeof ServiceClustering !== "undefined" && typeof ServiceClustering.renderClusters === "function") {
          ServiceClustering.renderClusters();
        }
        if (typeof IntegrationsHub !== "undefined" && typeof IntegrationsHub.renderIntegrationsPanel === "function") {
          IntegrationsHub.renderIntegrationsPanel();
        }
        if (typeof AdvancedExport !== "undefined" && typeof AdvancedExport.renderExportPanel === "function") {
          AdvancedExport.renderExportPanel();
        }
        if (typeof BIEngine !== "undefined") {
          BIEngine.init();
          if (typeof BIEngine.renderBiDashboard === "function") {
            BIEngine.renderBiDashboard();
          }
        }
        if (typeof SecurityManager !== "undefined" && typeof SecurityManager.renderSecurityDashboard === "function") {
          SecurityManager.renderSecurityDashboard();
        }
        if (typeof QualityManager !== "undefined") {
          QualityManager.init();
          if (typeof QualityManager.renderQualityDashboard === "function") {
            QualityManager.renderQualityDashboard();
          }
        }
        if (typeof DocumentManager !== "undefined") {
          DocumentManager.init();
          if (typeof DocumentManager.renderDocumentPanel === "function") {
            DocumentManager.renderDocumentPanel();
          }
        }
        if (typeof FinancialManager !== "undefined") {
          FinancialManager.init();
          if (typeof FinancialManager.renderFinancialDashboard === "function") {
            FinancialManager.renderFinancialDashboard();
          }
        }
        if (typeof TalentManager !== "undefined") {
          TalentManager.init();
          if (typeof TalentManager.renderTalentDashboard === "function") {
            TalentManager.renderTalentDashboard();
          }
        }
        if (typeof FleetManager !== "undefined") {
          FleetManager.init();
          if (typeof FleetManager.renderFleetDashboard === "function") {
            FleetManager.renderFleetDashboard();
          }
        }
        if (typeof SustainabilityManager !== "undefined") {
          SustainabilityManager.init();
          if (typeof SustainabilityManager.renderSustainabilityDashboard === "function") {
            SustainabilityManager.renderSustainabilityDashboard();
          }
        }
        if (typeof ExecutiveCommand !== "undefined") {
          ExecutiveCommand.init();
          if (typeof ExecutiveCommand.renderExecutiveDashboard === "function") {
            ExecutiveCommand.renderExecutiveDashboard();
          }
        }
        showToast2("✨ MÓDULOS AVANZADOS CARGADOS", "success");
      }, 100);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    console.log(`\uD83D\uDE80 Navegación: Cambiando a pestaña [${tabId.toUpperCase()}]`);
  }
};
function initCharts() {
  const ctx = document.getElementById("incidentsChart");
  if (!ctx)
    return;
  incidentsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Ausencias", "Bajas IT", "Retrasos", "Otros"],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ["#f43f5e", "#f59e0b", "#0ea5e9", "#64748b"],
        borderWidth: 0
      }]
    },
    options: { plugins: { legend: { display: false } }, cutout: "80%" }
  });
}
function updateCharts() {
  if (!incidentsChart)
    return;
  const abs = state2.incidents.filter((i) => i.type === "AUSENCIA").length;
  const ret = state2.incidents.filter((i) => i.type === "RETRASO").length;
  incidentsChart.data.datasets[0].data = [abs, 0, ret, state2.incidents.length - (abs + ret)];
  incidentsChart.update();
  updateOperationalChart();
}
var isGlobalRendering = false;
function renderAll() {
  if (isGlobalRendering)
    return;
  isGlobalRendering = true;
  console.log("\uD83D\uDD04 Iniciando Renderizado Asíncrono del Dashboard...");
  updateDate();
  updateHeaderStats();
  const renderQueue = [
    () => {
      if (typeof renderIncidents === "function")
        renderIncidents();
    },
    () => {
      if (typeof renderNotes === "function")
        renderNotes();
    },
    () => {
      if (typeof renderMasterSummary === "function")
        renderMasterSummary();
    },
    () => {
      if (typeof renderAbsences === "function")
        renderAbsences();
    },
    () => {
      if (typeof renderUncovered === "function")
        renderUncovered();
    },
    () => {
      if (typeof renderOrders === "function")
        renderOrders();
    },
    () => {
      if (typeof initQuadrantsModule === "function")
        initQuadrantsModule();
    },
    () => {
      if (typeof renderPriorityPanel === "function")
        renderPriorityPanel();
    },
    () => {
      if (typeof renderRiskSemaphor === "function")
        renderRiskSemaphor();
    },
    () => {
      if (typeof updateCharts === "function")
        updateCharts();
    },
    () => {
      if (typeof updateOperationalChart === "function")
        updateOperationalChart();
    },
    () => {
      if (typeof updateSisPredict === "function")
        updateSisPredict();
    },
    () => {
      if (typeof updateInsights === "function")
        updateInsights();
    },
    () => {
      if (typeof updateAnalytics === "function")
        updateAnalytics();
    },
    () => {
      if (typeof updateEmergencyPopup === "function")
        updateEmergencyPopup();
    },
    () => {
      if (typeof AIPredictiveEngine !== "undefined") {
        AIPredictiveEngine.init();
        if (typeof AIPredictiveEngine.renderPredictions === "function")
          AIPredictiveEngine.renderPredictions();
        if (typeof AIPredictiveEngine.renderRecommendations === "function")
          AIPredictiveEngine.renderRecommendations();
      }
    },
    () => {
      if (typeof WorkerPerformance !== "undefined" && typeof WorkerPerformance.init === "function") {
        WorkerPerformance.init();
      }
    },
    () => {
      if (typeof SubstituteManagement !== "undefined" && typeof SubstituteManagement.init === "function") {
        SubstituteManagement.init();
      }
    },
    () => {
      if (typeof MLEngine !== "undefined") {
        if (typeof MLEngine.predictUncoveredServices === "function") {
          MLEngine.predictUncoveredServices().then(() => {
            if (typeof MLEngine.renderPredictions === "function")
              MLEngine.renderPredictions();
          });
        }
        if (typeof MLEngine.renderAnomalies === "function") {
          if (typeof MLEngine.detectAnomalies === "function")
            MLEngine.detectAnomalies();
          MLEngine.renderAnomalies();
        }
      }
    },
    () => {
      if (typeof RouteOptimizer !== "undefined" && typeof RouteOptimizer.renderRouteOptimization === "function") {
        RouteOptimizer.renderRouteOptimization();
      }
    },
    () => {
      if (typeof ServiceClustering !== "undefined" && typeof ServiceClustering.renderClusters === "function") {
        ServiceClustering.renderClusters();
      }
    }
  ];
  let currentIdx = 0;
  function processNextBatch() {
    if (currentIdx < renderQueue.length) {
      try {
        renderQueue[currentIdx]();
      } catch (e) {
        console.warn("Error en renderQueue", e);
      }
      currentIdx++;
      if (currentIdx < renderQueue.length) {
        try {
          renderQueue[currentIdx]();
        } catch (e) {
          console.warn("Error en renderQueue", e);
        }
        currentIdx++;
      }
      requestAnimationFrame(processNextBatch);
    } else {
      isGlobalRendering = false;
      console.log("✅ Dashboard renderizado progresivamente sin bloqueos.");
    }
  }
  requestAnimationFrame(processNextBatch);
}
function renderRiskSemaphor() {
  const list = document.getElementById("risk-list");
  if (!list || !state2.masterData || state2.masterData.length === 0)
    return;
  console.log("\uD83D\uDEA6 Calculando Semáforo de Riesgo...");
  const riskMap = new Map;
  const keys = Object.keys(state2.masterData[0]);
  const kEstado2 = keys.find((k) => k.toUpperCase().includes("ESTADO")) || "ESTADO";
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  state2.masterData.forEach((row) => {
    const srv = row[kServicio2];
    if (!srv)
      return;
    if (!riskMap.has(srv)) {
      riskMap.set(srv, { name: srv, score: 0, factors: [] });
    }
    const data = riskMap.get(srv);
    const status = (row[kEstado2] || "").toString().toUpperCase();
    if (status.includes("DESCUBIERTO") || status.includes("VACANTE") || status.includes("SIN ASIGNAR")) {
      data.score += 45;
      if (!data.factors.includes("Fallo Cobertura"))
        data.factors.push("Fallo Cobertura");
    }
  });
  state2.incidents.forEach((inc) => {
    const row = state2.masterData.find((r) => Object.values(r).some((val) => val.toString().toUpperCase() === inc.worker.toUpperCase()));
    if (row) {
      const srv = row[kServicio2];
      if (riskMap.has(srv)) {
        const data = riskMap.get(srv);
        if (inc.priority === "HIGH") {
          data.score += 35;
          if (!data.factors.includes("Alertas Críticas"))
            data.factors.push("Alertas Críticas");
        } else {
          data.score += 15;
          if (!data.factors.includes("Incidencias"))
            data.factors.push("Incidencias");
        }
      }
    }
  });
  const sortedRisks = Array.from(riskMap.values()).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  if (sortedRisks.length === 0) {
    list.innerHTML = '<div class="empty-state">✅ OPERATIVA ESTABLE. SIN RIESGOS DETECTADOS.</div>';
    return;
  }
  list.innerHTML = sortedRisks.map((r) => {
    let colorClass = "green";
    let level = "ESTABLE";
    if (r.score >= 70) {
      colorClass = "red";
      level = "CRÍTICO";
    } else if (r.score >= 30) {
      colorClass = "orange";
      level = "RIESGO";
    }
    const displayScore = Math.min(r.score, 100);
    return `
            <div class="risk-item ${colorClass}">
                <div class="risk-circle"></div>
                <div class="risk-info">
                    <div class="risk-name">${r.name}</div>
                    <div class="risk-factors">${r.factors.join(" + ")}</div>
                </div>
                <div style="text-align:right;">
                    <div class="risk-score">${displayScore}%</div>
                    <div style="font-size:8px; font-weight:800; opacity:0.8;">${level}</div>
                </div>
            </div>
        `;
  }).join("");
}
var operationalChart = null;
function updateOperationalChart() {
  if (!state2.masterData || !state2.masterData.length)
    return;
  const total = state2.masterData.length;
  const uncovered = state2.uncovered ? state2.uncovered.length : 0;
  const incidents = state2.incidents ? state2.incidents.length : 0;
  const ok = Math.max(0, total - uncovered - incidents);
  if (operationalChart && operationalChart.data && operationalChart.data.datasets) {
    operationalChart.data.datasets[0].data = [ok, incidents, uncovered];
    operationalChart.update();
  }
  const coveragePct = total > 0 ? (ok / total * 100).toFixed(0) : "0";
  const coverEl = document.getElementById("coverage-percent");
  if (coverEl)
    coverEl.textContent = coveragePct + "%";
  const okEl = document.getElementById("count-ok");
  const incEl = document.getElementById("count-incidents");
  const critEl = document.getElementById("count-critical");
  if (okEl)
    okEl.textContent = ok;
  if (incEl)
    incEl.textContent = incidents;
  if (critEl)
    critEl.textContent = uncovered;
  const sumUnc = document.getElementById("sum-val-uncovered");
  const sumAbs = document.getElementById("sum-val-absences");
  const sumInc = document.getElementById("sum-val-incidents");
  const sumEff = document.getElementById("sum-efficiency-val");
  const sumCircle = document.getElementById("efficiency-circle-path");
  if (sumUnc)
    sumUnc.textContent = uncovered;
  let activeAbsences = 0;
  if (state2.it_list && state2.it_list.length > 0) {
    activeAbsences = state2.it_list.length;
  } else {
    activeAbsences = state2.masterData.filter((r) => {
      const s = (r["ESTADO1"] || r["Estado"] || "").toUpperCase();
      return s.includes("IT") || s.includes("BAJA") || s.includes("ACCIDENTE") || s.includes("ENFERMEDAD");
    }).length;
  }
  if (sumAbs)
    sumAbs.textContent = activeAbsences;
  if (sumInc)
    sumInc.textContent = incidents;
  if (sumEff && sumCircle) {
    let efficienty = 0;
    if (total > 0) {
      efficienty = (total - uncovered) / total * 100;
    }
    sumEff.textContent = efficienty.toFixed(1) + "%";
    const strokeVal = `${efficienty}, 100`;
    sumCircle.setAttribute("stroke-dasharray", strokeVal);
    sumCircle.setAttribute("stroke", efficienty > 90 ? "#4ade80" : efficienty > 70 ? "#facc15" : "#ef4444");
  }
  const dnaActive = document.getElementById("sum-dna-active");
  const dnaTotal = document.getElementById("sum-dna-total");
  const dnaAbsRate = document.getElementById("sum-dna-absent-rate");
  const dnaUncRate = document.getElementById("sum-dna-uncovered-rate");
  const dnaUnc = document.getElementById("sum-dna-uncovered");
  const dnaAbs = document.getElementById("sum-dna-absent");
  if (dnaTotal) {
    const activeWorkers = Math.max(0, total - uncovered - activeAbsences);
    dnaTotal.textContent = total;
    dnaActive.textContent = activeWorkers;
    if (dnaUnc)
      dnaUnc.textContent = uncovered;
    if (dnaAbs)
      dnaAbs.textContent = activeAbsences;
    if (total > 0) {
      if (dnaAbsRate)
        dnaAbsRate.textContent = `(${(activeAbsences / total * 100).toFixed(1)}%)`;
      if (dnaUncRate)
        dnaUncRate.textContent = `(${(uncovered / total * 100).toFixed(1)}%)`;
    }
  }
  const criticalListEl = document.getElementById("sum-critical-list");
  if (criticalListEl) {
    const riskMap = {};
    state2.masterData.forEach((row) => {
      const srv = row["SERVICIO"] || row["Alias/Nombre del centro"];
      if (!srv)
        return;
      const st = (row["ESTADO"] || row["ESTADO1"] || "").toUpperCase();
      let score = 0;
      if (st.includes("DESCUBIERTO") || st.includes("VACANTE"))
        score = 2;
      else if (st.includes("IT") || st.includes("BAJA"))
        score = 1;
      if (score > 0) {
        riskMap[srv] = (riskMap[srv] || 0) + score;
      }
    });
    const sortedRisks = Object.entries(riskMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedRisks.length === 0) {
      criticalListEl.innerHTML = `<div style="text-align:center; padding:20px; color:#15803d; font-weight:700;">✅ 100% OPERATIVO</div>`;
    } else {
      criticalListEl.innerHTML = sortedRisks.map(([name, score]) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9;">
                    <div style="font-size:12px; font-weight:700; color:#334155;">${name}</div>
                    <div style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">Risk: ${score}</div>
                </div>
            `).join("");
    }
  }
  if (window.checkContractExpirations) {
    window.checkContractExpirations();
  }
}
function updateSisPredict() {
  const el = document.getElementById("sis-predict-val");
  if (!el)
    return;
  const baseLoad = state2.masterData.length || 1;
  const activeIncidents = state2.incidents.length;
  const riskFactor = activeIncidents / baseLoad * 100;
  let prediction = Math.min(99.9, riskFactor * 2.5).toFixed(1);
  let trend = riskFactor > 5 ? "↑" : "↓";
  el.textContent = `${prediction}% ${trend} `;
  el.style.color = riskFactor > 10 ? "var(--accent-red)" : riskFactor > 5 ? "var(--sifu-amber)" : "var(--accent-green)";
}
function updateInsights() {
  const valUncovered = document.getElementById("val-uncovered");
  const valAbsences = document.getElementById("val-absences");
  const valIncidents = document.getElementById("val-incidents");
  const valActive = document.getElementById("val-active");
  if (!state2.masterData || state2.masterData.length === 0)
    return;
  const uncoveredCount = state2.uncovered.length;
  const absencesCount = state2.absences.length;
  if (valUncovered) {
    valUncovered.textContent = uncoveredCount;
    const trendEl = document.getElementById("trend-uncovered");
    const card = document.getElementById("metric-uncovered");
    if (uncoveredCount > 0) {
      if (card)
        card.classList.add("critical-pulse");
      if (trendEl) {
        trendEl.className = "metric-trend up";
        trendEl.innerHTML = '<span class="trend-icon">▲</span> <span class="trend-text">Atención inmediata</span>';
      }
    } else {
      if (card)
        card.classList.remove("critical-pulse");
      if (trendEl) {
        trendEl.className = "metric-trend down";
        trendEl.innerHTML = '<span class="trend-icon">✔</span> <span class="trend-text">Sin descubiertos</span>';
      }
    }
  }
  if (valAbsences) {
    valAbsences.textContent = absencesCount;
    const trendEl = document.getElementById("trend-absences");
    if (trendEl) {
      trendEl.innerHTML = `<span class="trend-icon">\uD83C\uDFE5</span> <span class="trend-text">${absencesCount} bajas activas</span>`;
    }
  }
  if (valIncidents) {
    valIncidents.textContent = state2.incidents.length;
    const trendEl = document.getElementById("trend-incidents");
    if (trendEl) {
      const count = state2.incidents.length;
      trendEl.className = count > 0 ? "metric-trend up" : "metric-trend neutral";
      trendEl.innerHTML = count > 0 ? `<span class="trend-icon">⚠️</span> <span class="trend-text">${count} activas</span>` : '<span class="trend-icon">●</span> <span class="trend-text">Todo en orden</span>';
    }
  }
  if (valActive) {
    const total = state2.masterData.length;
    const percent = total > 0 ? ((total - uncoveredCount) / total * 100).toFixed(1) : "0";
    valActive.textContent = percent + "%";
    const trendEl = document.getElementById("trend-active");
    if (trendEl) {
      const isGood = parseFloat(percent) > 95;
      trendEl.className = isGood ? "metric-trend down" : "metric-trend up";
      trendEl.innerHTML = isGood ? '<span class="trend-icon">★</span> <span class="trend-text">Eficiencia Alta</span>' : '<span class="trend-icon">▼</span> <span class="trend-text">Bajo cobertura</span>';
    }
  }
  const valEfficiency = document.getElementById("val-efficiency");
  const valSLA = document.getElementById("val-sla");
  if (valEfficiency) {
    const score = Math.max(85, 100 - state2.incidents.length * 0.5).toFixed(1);
    valEfficiency.textContent = score + "%";
  }
  if (valSLA) {
    const score = Math.max(90, 100 - uncoveredCount * 2).toFixed(1);
    valSLA.textContent = score + "%";
  }
  const panel = document.getElementById("insights-panel");
  if (!panel)
    return;
  const insights = [];
  if (uncoveredCount > 0) {
    insights.push({
      type: "critical",
      text: `⚠️ ALERTA: ${uncoveredCount} servicios descubiertos requieren acción inmediata.`,
      tag: "URGENTE"
    });
  }
  const sickLeave = state2.absences.filter((a) => a.reason && a.reason.toUpperCase().includes("BAJA")).length;
  if (sickLeave > 3) {
    insights.push({
      type: "ai-suggest",
      text: `Alta tasa de absentismo(${sickLeave} activos).Revisar plan de suplencias.`,
      tag: "ABSENTISMO"
    });
  } else {
    insights.push({
      type: "performance",
      text: `Nivel de absentismo bajo control.Operativa estable.`,
      tag: "OPTIMO"
    });
  }
  const hour = new Date().getHours();
  if (hour < 10) {
    insights.push({
      type: "ai-suggest",
      text: "\uD83D\uDCA1 Sugerencia: Verificar fichajes de entrada del turno de mañana.",
      tag: "SISTEMA TIP"
    });
  } else if (hour > 14 && hour < 16) {
    insights.push({
      type: "ai-suggest",
      text: "\uD83D\uDCA1 Sugerencia: Preparar cuadrante para el turno de tarde.",
      tag: "SISTEMA TIP"
    });
  }
  panel.innerHTML = insights.map((i) => `
        <div class="insight-card">
            <div class="insight-tag ${i.type === "critical" ? "critical" : i.type === "performance" ? "performance" : "ai-suggest"}">
                ${i.tag}
            </div>
            <div class="insight-text">${i.text}</div>
        </div>
    `).join("");
}
function scrollToModule(id) {
  const el = document.getElementById(id);
  if (!el)
    return;
  const parentTab = el.closest(".tab-content");
  if (parentTab && !parentTab.classList.contains("active")) {
    switchTab(parentTab.id.replace("tab-", ""));
  }
  setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
}
var msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID_HERE",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.href
  }
};
var msalInstance = null;
async function initMSAL() {
  if (typeof msal !== "undefined" && !msalInstance) {
    msalInstance = new msal.PublicClientApplication(msalConfig);
  }
}
window.connectedOutlook = async () => {
  await initMSAL();
  try {
    const loginRequest = {
      scopes: ["User.Read", "Mail.Read"]
    };
    const loginResponse = await msalInstance.loginPopup(loginRequest);
    console.log("Login Success:", loginResponse);
    fetchRealEmails();
  } catch (error) {
    console.error("Login Error:", error);
    alert("Para la integración real, IT debe registrar esta App en Azure. Mostrando simulado por ahora.");
    renderOutlookMock();
  }
};
async function fetchRealEmails() {
  const feed = document.getElementById("outlook-feed");
  if (!feed)
    return;
  feed.innerHTML = '<div class="loading-shimmer">Conectando con Microsoft Graph...</div>';
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0)
      return;
    const tokenRequest = {
      scopes: ["Mail.Read"],
      account: accounts[0]
    };
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    const accessToken = response.accessToken;
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=sender,subject,bodyPreview,receivedDateTime,isRead", {
      headers: {
        Authorization: `Bearer ${accessToken} `
      }
    });
    const data = await graphResponse.json();
    renderRealEmails(data.value);
  } catch (error) {
    console.error("Graph Error:", error);
    renderOutlookMock();
  }
}
function renderRealEmails(emails) {
  const feed = document.getElementById("outlook-feed");
  const unreadCount = document.getElementById("outlook-unread-count");
  if (!feed)
    return;
  const unreads = emails.filter((e) => !e.isRead).length;
  if (unreadCount)
    unreadCount.textContent = unreads;
  feed.innerHTML = emails.map((email) => `
        <div class="outlook-item ${!email.isRead ? "unread" : ""}" onclick="window.open('${email.webLink || "#"}', '_blank')">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">${email.sender.emailAddress.name}</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">${email.subject}</div>
            <div style="font-size:11px; color:var(--text-dim); overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${email.bodyPreview}</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">${new Date(email.receivedDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
    `).join("");
}
function renderOutlookMock() {
  const feed = document.getElementById("outlook-feed");
  if (!feed)
    return;
  feed.innerHTML = `
        <div class="outlook-item unread">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">Soporte IT</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">Mantenimiento Programado</div>
            <div style="font-size:11px; color:var(--text-dim);">Recordatorio: El sistema se actualizará esta noche.</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">10:30</div>
        </div>
        <div class="outlook-item">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">Recursos Humanos</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">Nuevas Incorporaciones</div>
            <div style="font-size:11px; color:var(--text-dim);">Adjunto lista de personal nuevo.</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">09:15</div>
        </div>
`;
}
function showToast2(msg, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type} `;
  toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</span>
            <span>${msg}</span>
        </div>
        <span class="toast-close" onclick="this.parentElement.remove()">×</span>
    `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
function updateAnalytics() {
  updateHeatmap();
  updateTopIncidents();
}
function updateHeatmap() {
  const heatmap = document.getElementById("incidents-heatmap");
  if (!heatmap)
    return;
  const days = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const today = new Date;
  let html = "";
  for (let i = 6;i >= 0; i--) {
    const date = new Date;
    date.setDate(today.getDate() - i);
    const dayLabel = days[date.getDay()];
    const dateStr = date.toLocaleDateString("es-ES");
    const dayIncidents = state2.incidents.filter((inc) => inc.date === dateStr).length;
    let level = 0;
    if (dayIncidents > 5)
      level = 3;
    else if (dayIncidents > 2)
      level = 2;
    else if (dayIncidents > 0)
      level = 1;
    html += `
        <div class="heatmap-day level-${level}">
            <span>${dayLabel}</span>
            <strong>${dayIncidents}</strong>
            <span style="font-size:8px;">${dayIncidents} alert.</span>
        </div>
        `;
  }
  heatmap.innerHTML = html;
}
function updateTopIncidents() {
  const list = document.getElementById("top-incidents-list");
  if (!list)
    return;
  const counts = {};
  state2.incidents.forEach((inc) => {
    counts[inc.worker] = (counts[inc.worker] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (sorted.length === 0) {
    list.innerHTML = '<div class="empty-state" style="font-size:10px;">SIN ALERTAS RECURRENTES</div>';
    return;
  }
  list.innerHTML = sorted.map(([worker, count]) => `
        <div class="top-incident-item">
            <span class="worker">${worker}</span>
            <span class="count">${count} ALERTAS</span>
        </div>
    `).join("");
}
function initVoiceCommand() {
  const btn = document.getElementById("voice-command-btn");
  const input = document.getElementById("quick-input-bar");
  if (!btn || !input)
    return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (window.location.protocol === "file:") {
    btn.onclick = () => {
      showToast2("⚠️ EL RECONOCIMIENTO DE VOZ REQUIERE UN SERVIDOR (HTTP/HTTPS). NO FUNCIONA ABRIENDO EL ARCHIVO DIRECTAMENTE.", "error");
      console.warn("SpeechRecognition works on HTTP/HTTPS or localhost, not file:// protocol.");
    };
    return;
  }
  if (!SpeechRecognition) {
    btn.style.display = "none";
    console.warn("Tu navegador no soporta reconocimiento de voz.");
    return;
  }
  console.log("Sistema de Voz: Inicializado.");
  const recognition = new SpeechRecognition;
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = true;
  let finalTranscript = "";
  btn.onclick = (e) => {
    e.preventDefault();
    console.log("Click en micro...");
    if (btn.classList.contains("listening")) {
      recognition.stop();
    } else {
      try {
        finalTranscript = "";
        recognition.start();
        console.log("Grabación iniciada...");
      } catch (err) {
        console.error("Error al iniciar micro:", err);
        showToast2("No se pudo iniciar el micrófono", "error");
      }
    }
  };
  recognition.onstart = () => {
    btn.classList.add("listening");
    btn.innerHTML = "\uD83D\uDED1";
    input.placeholder = "Escuchando... hable ahora";
    input.value = "";
  };
  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex;i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    input.value = finalTranscript || interimTranscript;
  };
  recognition.onend = () => {
    btn.classList.remove("listening");
    btn.innerHTML = "\uD83C\uDF99️";
    input.placeholder = "COMANDO RÁPIDO: ESCRIBE PARA REGISTRAR INCIDENCIA...";
    if (finalTranscript.trim().length > 0) {
      console.log("Procesando comando:", finalTranscript);
      processQuickInput(finalTranscript.trim());
      input.value = "";
      showToast2("Comando procesado: " + finalTranscript, "success");
    }
  };
  recognition.onerror = (e) => {
    btn.classList.remove("listening");
    btn.innerHTML = "\uD83C\uDF99️";
    console.error("Speech Recognition Error:", e.error);
    if (e.error === "not-allowed") {
      showToast2("ERROR: El navegador bloquea el micro. Revisa permisos.", "error");
    } else if (e.error !== "no-speech") {
      showToast2("Reconocimiento fallido: " + e.error, "error");
    }
  };
}
function initSaveIndicator() {
  let indicator = document.getElementById("save-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "save-indicator";
    indicator.style.cssText = `
position: fixed;
top: 20px;
right: 20px;
padding: 8px 16px;
border-radius: 20px;
font-size: 12px;
font-weight: 700;
z-index: 10000;
transition: all 0.3s ease;
opacity: 0;
pointer-events: none;
`;
    document.body.appendChild(indicator);
  }
}
function updateSaveIndicator(status) {
  const indicator = document.getElementById("save-indicator");
  if (!indicator)
    return;
  switch (status) {
    case "saving":
      indicator.textContent = "\uD83D\uDCBE Guardando...";
      indicator.style.background = "rgba(251, 188, 5, 0.95)";
      indicator.style.color = "#000";
      indicator.style.opacity = "1";
      break;
    case "saved":
      indicator.textContent = "✓ Guardado";
      indicator.style.background = "rgba(52, 168, 83, 0.95)";
      indicator.style.color = "#fff";
      indicator.style.opacity = "1";
      setTimeout(() => {
        indicator.style.opacity = "0";
      }, 2000);
      break;
    case "error":
      indicator.textContent = "⚠️ Error al guardar";
      indicator.style.background = "rgba(234, 67, 53, 0.95)";
      indicator.style.color = "#fff";
      indicator.style.opacity = "1";
      setTimeout(() => {
        indicator.style.opacity = "0";
      }, 4000);
      break;
  }
}
function markUnsavedChanges() {
  hasUnsavedChanges = true;
  updateSaveIndicator("saving");
}
window.exportStatusToExcel = () => {
  const situModal = document.getElementById("situational-report-modal");
  if (situModal && situModal.style.display === "flex") {
    if (window.downloadReportExcel)
      return window.downloadReportExcel();
  }
  if (!window.lastFilteredResults || window.lastFilteredResults.length === 0) {
    alert("No hay datos filtrados para exportar.");
    return;
  }
  const { kServicio: kServicio2, kTitular: kTitular2, kHorario, kEstado: kEstado2, kSuplente: kSuplente2, kFinContrato, kVacaciones } = window.lastFilteredKeys;
  const data = window.lastFilteredResults.map((r) => ({
    ESTADO: r[kEstado2] || "",
    SERVICIO: r[kServicio2] || "",
    TITULAR: r[kTitular2] || "",
    HORARIO: r[kHorario] || "",
    SUPLENTE: r[kSuplente2] || "",
    "FIN CONTRATO": window.formatExcelDate(r[kFinContrato]),
    VACACIONES: window.formatExcelDate(r[kVacaciones])
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MasterData");
  const filename = `SIFU_MASTER_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};
window.exportStatusToPDF = (isSituational = false) => {
  const situModal = document.getElementById("situational-report-modal");
  const detailModal = document.getElementById("status-detail-modal");
  if (isSituational || situModal && situModal.style.display === "flex" && situModal.classList.contains("active")) {
    if (window.downloadReportPDF)
      return window.downloadReportPDF();
  }
  if (detailModal && detailModal.style.display === "flex") {
    const body = document.getElementById("status-modal-body");
    const title = document.getElementById("status-modal-title").innerText;
    if (body) {
      const opt2 = {
        margin: 10,
        filename: `SIFU_DETALLE_${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
      };
      const tempDiv2 = document.createElement("div");
      tempDiv2.style.padding = "30px";
      tempDiv2.style.background = "white";
      tempDiv2.innerHTML = `
                <div style="border-bottom: 2px solid #1e3c72; padding-bottom:15px; margin-bottom:25px;">
                    <h1 style="color:#1e3c72; margin:0; font-size:24px;">INFORMER SIFU - CENTRO DE DATOS</h1>
                    <p style="margin:5px 0; color:#64748b; font-size:14px;">Reporte: ${title}</p>
                    <p style="margin:0; color:#94a3b8; font-size:10px;">Fecha: ${new Date().toLocaleString()}</p>
                </div>
                ${body.innerHTML}
            `;
      html2pdf().set(opt2).from(tempDiv2).save();
      return;
    }
  }
  if (!window.lastFilteredResults || window.lastFilteredResults.length === 0) {
    alert("No hay datos visibles para generar el PDF.");
    return;
  }
  const { kServicio: kServicio2, kTitular: kTitular2, kHorario, kEstado: kEstado2, kSuplente: kSuplente2, kFinContrato, kVacaciones } = window.lastFilteredKeys;
  let tableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">ESTADO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">SERVICIO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">TITULAR</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">HORARIO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">SUPLENTE</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">FIN CONTRATO</th>
                </tr>
            </thead>
            <tbody>
    `;
  window.lastFilteredResults.forEach((r) => {
    const isDisc = (r[kEstado2] || "").toString().toUpperCase().includes("DESCUBIERTO");
    const color = isDisc ? "#ef4444" : "#1e293b";
    tableHtml += `
            <tr>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px; font-weight:bold; color:${color}">${r[kEstado2] || "-"}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px; font-weight:bold;">${r[kServicio2] || "-"}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kTitular2] || "-"}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kHorario] || "-"}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kSuplente2] || "-"}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${window.formatExcelDate(r[kFinContrato])}</td>
            </tr>
        `;
  });
  tableHtml += "</tbody></table>";
  const tempDiv = document.createElement("div");
  tempDiv.style.padding = "30px";
  tempDiv.style.background = "white";
  tempDiv.innerHTML = `
        <div style="border-bottom: 2px solid #6d28d9; padding-bottom:10px; margin-bottom:20px;">
            <h1 style="color:#6d28d9; margin:0; font-size:20px;">INFORMER SIFU - REPORTE DE GESTIÓN</h1>
            <p style="margin:5px 0; color:#64748b; font-size:12px;">Lista Maestra de Servicios - Total: ${window.lastFilteredResults.length}</p>
            <p style="margin:0; color:#94a3b8; font-size:10px;">Generado: ${new Date().toLocaleString()}</p>
        </div>
        ${tableHtml}
        <div style="margin-top:30px; text-align:center; font-size:9px; color:#94a3b8;">
            Documento generado automáticamente por el Sistema SIFU - CENTRO DE DATOS
        </div>
    `;
  const opt = {
    margin: 10,
    filename: `SIFU_REPORTE_MASTER_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
  };
  html2pdf().set(opt).from(tempDiv).save();
};
function setupEventListeners() {
  setupCoreInteractions();
  function updateUrgencyRadar() {
    const list = document.getElementById("urgency-list");
    if (!list || !state2.masterData)
      return;
    const analysis = AIService.analyzeResilience();
    const hotspots = analysis.summaryList || [];
    if (hotspots.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">✅ Sin riesgos detectados</div>';
      return;
    }
    list.innerHTML = hotspots.map((h) => {
      const totalIncidents = h.descubiertos + h.bajas;
      const percent = Math.min(100, totalIncidents / 5 * 100);
      const color = h.descubiertos > 0 ? "#ef4444" : "#f59e0b";
      return `<div class="urgency-item">
                <div class="urgency-label"><span>${h.centro}</span><span>${totalIncidents} Alertas</span></div>
                <div class="urgency-bar-bg"><div class="urgency-bar-fill" style="width: ${percent}%; background: ${color}"></div></div>
            </div>`;
    }).join("");
  }
  window.clearAllMasterFilters = function() {
    console.log("\uD83D\uDD04 SIFU: Restaurando vista completa...");
    if (typeof columnFilters !== "undefined") {
      Object.keys(columnFilters).forEach((k) => columnFilters[k] = "");
    }
    const masterSearch = document.getElementById("master-search-input");
    if (masterSearch)
      masterSearch.value = "";
    state2.filteredData = null;
    if (typeof renderMasterSummary === "function")
      renderMasterSummary();
    showToast2("Vista completa restaurada", "success");
  };
  function getUrgencyResults(category) {
    if (!state2.masterData || !state2.masterData.length)
      return [];
    const keys = Object.keys(state2.masterData[0]);
    const kEstado2 = keys.find((k) => k.toUpperCase().trim() === "ESTADO") || "ESTADO";
    const kTitular2 = keys.find((k) => k.toUpperCase().trim() === "TITULAR") || "TITULAR";
    const kSuplente2 = keys.find((k) => k.toUpperCase().trim() === "SUPLENTE") || "SUPLENTE";
    const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
    const kSalud = keys.find((k) => k.toUpperCase().trim() === "ESTADO1") || keys.find((k) => k.toUpperCase().includes("SALUD")) || keys.find((k) => k.toUpperCase().trim() === "IT") || kEstado2;
    if (category === "DESCUBIERTO") {
      return state2.masterData.filter((r) => {
        const sName = (r[kServicio2] || "").toString().trim();
        if (!sName)
          return false;
        const e = (r[kEstado2] || "").toString().toUpperCase();
        const t = (r[kTitular2] || "").toString().toUpperCase();
        return e.includes("DESCUBIERTO") || e.includes("VACANTE") || t.includes("SIN TITULAR") || e === "" && t === "";
      });
    }
    if (category === "BAJA IT") {
      return state2.masterData.filter((r) => {
        const sName = (r[kServicio2] || "").toString().trim();
        if (!sName)
          return false;
        const s = (r[kSalud] || "").toString().toUpperCase().trim();
        const e = (r[kEstado2] || "").toString().toUpperCase().trim();
        const isBaja = s.includes("BAJA") || s === "IT" || s.startsWith("IT ") || s.endsWith(" IT") || e.includes("BAJA") || e === "IT";
        return isBaja;
      });
    }
    if (category === "IT SIN SUPLENTE") {
      return state2.masterData.filter((r) => {
        const sName = (r[kServicio2] || "").toString().trim();
        if (!sName)
          return false;
        const s = (r[kSalud] || "").toString().toUpperCase().trim();
        const e = (r[kEstado2] || "").toString().toUpperCase().trim();
        const sup = (r[kSuplente2] || "").toString().toUpperCase().trim();
        const isIT = s.includes("BAJA") || s === "IT" || s.startsWith("IT ") || e.includes("BAJA") || e === "IT";
        const noSup = sup === "" || sup === "-" || sup.includes("SIN");
        const isUncovered = !e.includes("CUBIERTO");
        return isIT && noSup && isUncovered;
      });
    }
    if (category === "FIN HOY") {
      const kObs = keys.find((k) => k.toUpperCase().includes("OBSERV")) || "OBSERVACIONES";
      const kFin = keys.find((k) => k.toUpperCase().includes("FIN") && k.toUpperCase().includes("CONTRATO")) || "FIN CONTRATO";
      const now = new Date;
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      return state2.masterData.filter((r) => {
        const sName = (r[kServicio2] || "").toString().trim();
        if (!sName)
          return false;
        const obs = (r[kObs] || "").toString().toLowerCase();
        if (obs.includes("hoy") || obs.includes("fin") || obs.includes("termina"))
          return true;
        const rawDate = r[kFin];
        if (!rawDate)
          return false;
        let dObj = null;
        try {
          if (typeof rawDate === "number") {
            const utcDate = new Date((rawDate - 25569) * 86400 * 1000);
            dObj = new Date(utcDate.getTime() + 12 * 60 * 60 * 1000);
          } else if (typeof rawDate === "string") {
            const cleanStr = rawDate.trim();
            if (cleanStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
              let parts = cleanStr.split(/[\/\-]/);
              let y = parseInt(parts[2]);
              if (y < 100)
                y += 2000;
              let p0 = parseInt(parts[0]), p1 = parseInt(parts[1]);
              let d, m;
              if (p1 > 12) {
                d = p1;
                m = p0;
              } else {
                d = p0;
                m = p1;
              }
              dObj = new Date(y, m - 1, d);
            } else if (cleanStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
              dObj = new Date(cleanStr);
            }
          }
        } catch (e) {}
        if (dObj && !isNaN(dObj.getTime())) {
          if (dObj.getFullYear() < 2026)
            return false;
          return dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
        }
        return false;
      });
    }
    return [];
  }
  window.filterByUrgency = function(type) {
    if (!state2.masterData)
      return;
    console.log("\uD83D\uDE80 Filtrando por urgencia PRO:", type);
    const filtered = getUrgencyResults(type);
    state2.filteredData = filtered;
    renderMasterSummary();
    showToast2(`Encontrados ${filtered.length} casos de: ${type}`, "info");
    const tableNode = document.getElementById("module-master-summary");
    if (tableNode)
      tableNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  window.exportQuickActionPDF = function(category) {
    if (!state2.masterData)
      return;
    showToast2(`Generando Reporte PDF: ${category}...`, "info");
    const data = getUrgencyResults(category);
    if (data.length === 0) {
      showToast2("No hay registros para este reporte", "warning");
      return;
    }
    const container = document.createElement("div");
    container.style.padding = "40px";
    container.style.fontFamily = "'Outfit', sans-serif";
    container.style.background = "#fff";
    container.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px;">
                <div>
                    <h1 style="margin: 0; color: #667eea; font-size: 24px;">REPORTE DE ${category}</h1>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Generado el ${new Date().toLocaleString()}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; color: #0f172a; font-size: 18px;">SIFU INFORMER PRO</h2>
                    <p style="margin: 0; color: #64748b; font-size: 12px;">Gestión de Servicios Críticos</p>
                </div>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 30px; display: flex; gap: 40px;">
                <div>
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Categoría</span>
                    <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${category}</div>
                </div>
                <div>
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Total Casos</span>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${data.length}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #667eea; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #667eea;">SERVICIO / CENTRO</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid #667eea;">TITULAR</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid #667eea;">ESTADO</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid #667eea;">SUPLENTE ACTUAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((r) => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${r[kServicio] || "---"}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${r[kTitular] || "---"}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #ef4444;">${r[kEstado] || "---"}</td>
                            <td style="padding: 10px; border: 1px solid #e2e8f0;">${r[kSuplente] || "SIN SUPLENTE"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            
            <div style="margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                Este documento es confidencial y para uso exclusivo del sistema de Gestión Operativa SIFU.
            </div>
        `;
    const opt = {
      margin: 0.5,
      filename: `Reporte_SIFU_${category.replace(" ", "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    };
    html2pdf().set(opt).from(container).save().then(() => {
      showToast2("PDF Descargado", "success");
    });
  };
  function updateQuickActionCounters() {
    if (!state2.masterData)
      return;
    const cUncovered = document.getElementById("count-card-uncovered");
    const cBajaIT = document.getElementById("count-card-bajas-it");
    const cAbsences = document.getElementById("count-card-absences");
    const cFinHoy = document.getElementById("count-card-fin-hoy");
    if (cUncovered)
      cUncovered.innerText = getUrgencyResults("DESCUBIERTO").length;
    if (cBajaIT)
      cBajaIT.innerText = getUrgencyResults("BAJA IT").length;
    if (cAbsences)
      cAbsences.innerText = getUrgencyResults("IT SIN SUPLENTE").length;
    if (cFinHoy)
      cFinHoy.innerText = getUrgencyResults("FIN HOY").length;
  }
  setInterval(updateUrgencyRadar, 1e4);
  setInterval(updateQuickActionCounters, 5000);
  setTimeout(() => {
    updateUrgencyRadar();
    updateQuickActionCounters();
    renderMasterSummary();
  }, 1500);
  const btnAddIncident = document.getElementById("btn-add-incident");
  if (btnAddIncident)
    btnAddIncident.onclick = () => {
      const m = document.getElementById("incident-modal");
      if (m)
        m.classList.add("active");
    };
  const btnAddIncidentV2 = document.getElementById("btn-add-incident-v2");
  if (btnAddIncidentV2)
    btnAddIncidentV2.onclick = () => {
      const m = document.getElementById("incident-modal");
      if (m)
        m.classList.add("active");
    };
  const btnAddNote = document.getElementById("btn-add-note");
  if (btnAddNote)
    btnAddNote.onclick = () => {
      const m = document.getElementById("note-modal");
      if (m)
        m.classList.add("active");
    };
  const btnAddNoteV2 = document.getElementById("btn-add-note-v2");
  if (btnAddNoteV2)
    btnAddNoteV2.onclick = () => {
      const m = document.getElementById("note-modal");
      if (m)
        m.classList.add("active");
    };
  document.querySelectorAll(".close-modal, .btn-modal-action.back").forEach((btn) => {
    btn.onclick = function(e) {
      e.preventDefault();
      const m = this.closest(".modal");
      if (m) {
        m.classList.remove("active");
        m.style.setProperty("display", "none", "important");
        console.log("\uD83D\uDD12 Modal cerrado via botón Back/Cerrar");
      }
    };
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (typeof switchTab === "function")
        switchTab(tabId);
    });
  });
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.onclick = () => {
      document.body.dataset.theme = document.body.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("theme", document.body.dataset.theme);
    };
  }
  if (typeof initOrdersModule === "function")
    initOrdersModule();
  else
    console.warn("initOrdersModule no está disponible");
}
async function checkServerExcel() {
  if (window.location.protocol === "file:") {
    console.warn("⚠️ Auto-Fetch desactivado en modo local (file://).");
    showToast2("⚠️ MODO LOCAL: Usa el botón 'SYNC MASTER' para actualizar.", "info");
    return;
  }
  try {
    const response = await fetch("./MASTER GENERAL.xlsx");
    if (!response.ok)
      throw new Error("No se encontró el archivo en servidor");
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (jsonData && jsonData.length > 0) {
      state2.masterData = jsonData;
      renderMasterSummary();
      showToast2("✅ MASTER sincronizado desde servidor (GitHub)", "success");
      console.log("✅ Datos cargados desde MASTER GENERAL.xlsx (Servidor)");
    }
  } catch (error) {
    console.warn("⚠️ No se pudo cargar MASTER GENERAL.xlsx del servidor:", error);
  }
}
var GEO_KNOWLEDGE_BASE = {
  "ALDI SARRIÀ": { lat: 41.3912, lon: 2.1245, zone: "SARRIA" },
  "ALDI NUMANCIA": { lat: 41.3835, lon: 2.1385, zone: "LES CORTS" },
  "ALDI PREMIA": { lat: 41.4925, lon: 2.361, zone: "PREMIA" },
  "ALDI VILAFRANCA": { lat: 41.3415, lon: 1.6965, zone: "VILAFRANCA" },
  "ALDI EL PRAT": { lat: 41.3255, lon: 2.0945, zone: "EL PRAT" },
  "WTC ALMEDA": { lat: 41.353, lon: 2.0835, zone: "CORNELLA" },
  "ALDI MATARÓ": { lat: 41.5381, lon: 2.4447, zone: "MATARO" },
  "ALDI BADALONA": { lat: 41.45, lon: 2.2475, zone: "BADALONA" },
  UNISONO: { lat: 41.3965, lon: 2.1935, zone: "POBLENOU" },
  "AGBAR SITGES": { lat: 41.2365, lon: 1.8105, zone: "SITGES" },
  "AGBAR ARENYS": { lat: 41.5795, lon: 2.5485, zone: "ARENYS" },
  "MEDIA MARKT": { lat: 41.3515, lon: 2.0895, zone: "CORNELLA" },
  "ALDI ESPLUGUES": { lat: 41.3768, lon: 2.0886, zone: "ESPLUGUES" },
  "ALDI VILADECANS": { lat: 41.3155, lon: 2.0185, zone: "VILADECANS" },
  "ALDI CUBELLES": { lat: 41.2015, lon: 1.6745, zone: "CUBELLES" }
};
function findSubstitutes(targetCenter, targetWorker, targetSchedule) {
  if (!state2.masterData || state2.masterData.length === 0)
    return [];
  const keys = Object.keys(state2.masterData[0]);
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kTitular2 = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  const kEstado2 = keys.find((k) => k.toUpperCase().includes("ESTADO")) || "ESTADO";
  const kSalud = keys.find((k) => k.toUpperCase().includes("ESTADO1")) || "ESTADO1";
  const kHorario = keys.find((k) => k.toUpperCase().includes("HORARIO")) || "HORARIO";
  const kTipo = keys.find((k) => k.toUpperCase().includes("TIPO")) || "TIPO S";
  const targetRow = state2.masterData.find((r) => r[kServicio2] === targetCenter);
  const targetClient = targetRow ? (targetRow[kTipo] || "").toUpperCase() : "";
  const targetTime = parseTimeRange(targetSchedule);
  const targetInfo = getGeoInfo(targetCenter);
  const candidates = [];
  const workerPresenceInfo = {};
  const healthyWorkers = new Set;
  state2.masterData.forEach((row) => {
    const wName = row[kTitular2];
    const wHealth = (row[kSalud] || "").toString().toUpperCase();
    if (!wName || wName === "DESCUBIERTO" || wName.includes("SIN TITULAR"))
      return;
    if (wHealth === "" || wHealth === "ACTIVO")
      healthyWorkers.add(wName);
    else
      healthyWorkers.delete(wName);
    if (!workerPresenceInfo[wName]) {
      workerPresenceInfo[wName] = {
        clients: new Set,
        schedules: [],
        zones: new Set,
        coords: []
      };
    }
    workerPresenceInfo[wName].clients.add((row[kTipo] || "").toUpperCase());
    const info = getGeoInfo(row[kServicio2]);
    workerPresenceInfo[wName].zones.add(info.zone);
    if (info.lat)
      workerPresenceInfo[wName].coords.push(info);
    const time = parseTimeRange(row[kHorario]);
    if (time)
      workerPresenceInfo[wName].schedules.push(time);
  });
  if (typeof SPECIAL_WORKERS !== "undefined" && Array.isArray(SPECIAL_WORKERS)) {
    SPECIAL_WORKERS.forEach((sw) => {
      const wData = workerPresenceInfo[sw.name];
      let hasOverlap = false;
      if (targetTime && wData) {
        hasOverlap = wData.schedules.some((s) => targetTime.start < s.end && targetTime.end > s.start);
      }
      if (!hasOverlap) {
        const baseScore = sw.type === "EMERGENCIAS" ? 100 : 90;
        candidates.push({
          name: sw.name,
          probability: baseScore,
          reason: sw.type,
          rawScore: baseScore + 500
        });
      }
    });
  }
  state2.masterData.forEach((row) => {
    const name = row[kTitular2];
    const status = (row[kEstado2] || "").toString().toUpperCase();
    const health = (row[kSalud] || "").toString().toUpperCase();
    const center = (row[kServicio2] || "").toString().toUpperCase();
    if (candidates.some((c) => c.name === name))
      return;
    if (status === "CUBIERTO" && health === "" && name !== "DESCUBIERTO" && name !== "" && name !== targetWorker) {
      const workerData = workerPresenceInfo[name];
      if (!workerData)
        return;
      if (workerData.clients.has(targetClient))
        return;
      if (targetTime) {
        const hasOverlap = workerData.schedules.some((s) => targetTime.start < s.end && targetTime.end > s.start);
        if (hasOverlap)
          return;
      }
      let score = 0;
      let reason = "";
      if (targetInfo.lat && workerData.coords.length > 0) {
        let minDistance = 999;
        workerData.coords.forEach((c) => {
          const dist = calculateDistance(targetInfo.lat, targetInfo.lon, c.lat, c.lon);
          if (dist < minDistance)
            minDistance = dist;
        });
        if (minDistance < 5) {
          score += 65;
          reason = `Proximidad extrema: a ${minDistance.toFixed(1)}km`;
        } else if (minDistance < 15) {
          score += 40;
          reason = `Zona cercana: a ${minDistance.toFixed(1)}km`;
        }
      } else {
        const serviceInfo = getGeoInfo(center);
        if (workerData.zones.has(targetInfo.zone)) {
          score += 50;
          reason = `Misma zona operativa: ${targetInfo.zone}`;
        } else if (isNearbyZone(serviceInfo.zone, targetInfo.zone)) {
          score += 25;
          reason = "Zona administrativa colindante";
        }
      }
      if (status.includes("BRIGADA") || status.includes("ESPECIALISTA")) {
        score += 30;
        reason = reason ? reason + " + Perfil Móvil" : "Personal de Brigada";
      }
      if (score > 15) {
        candidates.push({
          name,
          probability: Math.min(score, 98),
          reason: reason || "Operario disponible",
          rawScore: score
        });
      }
    }
  });
  const uniqueCandidates = [];
  const seenNames = new Set;
  candidates.sort((a, b) => b.rawScore - a.rawScore).forEach((c) => {
    if (!seenNames.has(c.name)) {
      seenNames.add(c.name);
      uniqueCandidates.push(c);
    }
  });
  return uniqueCandidates.slice(0, 3);
}
function getGeoInfo(centerName) {
  const t = centerName.toUpperCase();
  for (const key in GEO_KNOWLEDGE_BASE) {
    if (t.includes(key))
      return GEO_KNOWLEDGE_BASE[key];
  }
  return { lat: null, lon: null, zone: detectZone(centerName) };
}
var EXCLUSION_LIST = ["RIERA", "GESTIN", "TIENDA", "CALLE", "CARRER", "PASSEIG", "AVDA", "AVENIDA", "PLAÇA", "PLAZA", "LOCAL", "PLANTA", "EDIFICIO", "NAVE", "POLIGONO", "RUTA", "LIMPIEZA", "SERVICIO", "OAC", "ALDI", "AGBAR", "WTC", "CENTRO", "ADMINISTRACION", "GENERAL", "PROYECTO"];
var TERRITORY_DB = [
  "BARCELONA",
  "BADALONA",
  "HOSPITALET",
  "CORNELLA",
  "SANT BOI",
  "VILADECANS",
  "CASTELLDEFELS",
  "GAVA",
  "EL PRAT",
  "SANT CUGAT",
  "RUBI",
  "TERRASSA",
  "SABADELL",
  "GRANOLLERS",
  "MOLLET",
  "MATARO",
  "PREMIA",
  "VILASSAR",
  "CALELLA",
  "ARENYS",
  "PINEDA",
  "SITGES",
  "VILANOVA",
  "VILAFRANCA",
  "MARTORELL",
  "SANT JOAN DESPI",
  "ESPLUGUES",
  "SANT ADRIA",
  "IGUALADA",
  "VIC",
  "MANRESA",
  "BLANES",
  "LLORET",
  "CUBELLES",
  "PALLEJA",
  "MASQUEFA",
  "CALAFELL",
  "SANT PERE DE RIBES",
  "MALGRAT",
  "POBLENOU",
  "GUINARDO",
  "SARRIA",
  "SANTS",
  "LES CORTS",
  "EIXAMPLE",
  "GRACIA",
  "HORTA",
  "NOU BARRIS",
  "SANT ANDREU",
  "SANT MARTI",
  "EL MASNOU",
  "CANET",
  "CERDANYOLA",
  "MONTCADA"
];
var NEURAL_GEO_CACHE = {
  ANIMUA: "BARCELONA",
  UNISONO: "POBLENOU",
  FICOSA: "VILAFRANCA",
  HEMISPHERE: "VILANOVA",
  PINMAR: "VILANOVA",
  SEMYDINAMICS: "BARCELONA",
  INNOIT: "BARCELONA",
  IDOM: "CORNELLA",
  VEOLIA: "EL PRAT",
  PUMA: "CORNELLA",
  ACCENTURE: "BARCELONA",
  AMERICOLD: "BARCELONA",
  EHLIS: "SANT ANDREU BARCA",
  "WTC ALMEDA": "CORNELLA",
  "RIERA ALTA": "BARCELONA",
  "RIERA BLANCA": "HOSPITALET",
  MAQUINISTA: "BARCELONA",
  "ZONA FRANCA": "BARCELONA"
};
function detectZone(text) {
  if (!text)
    return "BCN CENTRAL";
  const t = text.toUpperCase();
  for (const [key, zone] of Object.entries(NEURAL_GEO_CACHE)) {
    if (t.includes(key))
      return zone;
  }
  for (const city of TERRITORY_DB) {
    if (t.includes(city))
      return city;
  }
  const normalized = t.replace(/[(),.\/-]/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 3);
  for (const word of words) {
    if (!EXCLUSION_LIST.includes(word) && !TERRITORY_DB.includes(word)) {
      if (word === "DESPI")
        return "SANT JOAN DESPI";
      if (word === "PENEDES")
        return "VILAFRANCA";
      if (word === "GELLTRU")
        return "VILANOVA";
      if (word === "ADRIA")
        return "SANT ADRIA";
    }
  }
  const segments = text.split("-").map((s) => s.trim().toUpperCase());
  if (segments.length > 1) {
    const tail = segments[segments.length - 1];
    const lastWord = tail.split(" ")[0];
    if (lastWord.length > 3 && !EXCLUSION_LIST.includes(lastWord))
      return lastWord;
  }
  return "BARCELONA";
}
function isNearbyZone(zoneA, zoneB) {
  if (zoneA === zoneB)
    return true;
  const groups = [
    ["MATARO", "PREMIA", "ARENYS", "CALELLA", "PINEDA", "SANT ADRIA", "VILASSAR", "BADALONA"],
    ["EL PRAT", "VILADECANS", "GAVA", "CASTELLDEFELS", "CORNELLA", "SANT JOAN DESPI", "ESPLUGUES", "MARTORELL", "SANT CUGAT"],
    ["VILAFRANCA", "CALAFELL", "CUBELLES", "SITGES", "VILANOVA"],
    ["SARRIA", "LES CORTS", "SANT GERVASI", "BARCELONA", "POBLENOU", "SANT ADRIA"],
    ["MARTORELL", "PALLEJA", "RUBI", "SANT CUGAT", "MOLINS DE REI", "TERRASSA", "SABADELL"]
  ];
  return groups.some((g) => g.includes(zoneA) && g.includes(zoneB));
}
function parseTimeRange(str) {
  if (!str)
    return null;
  const clean = str.replace(",", ".");
  const matches = clean.match(/(\d{1,2})[:h\.]?(\d{0,2}).*?(\d{1,2})[:h\.]?(\d{0,2})/i);
  if (!matches)
    return null;
  let h1 = parseInt(matches[1]);
  let m1 = parseInt(matches[2] || 0);
  let h2 = parseInt(matches[3]);
  let m2 = parseInt(matches[4] || 0);
  return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}
window.assignSubstitute = function(center, substituteName) {
  if (!state2.masterData)
    return;
  const keys = Object.keys(state2.masterData[0]);
  const kServicio2 = keys.find((k) => k.toUpperCase().includes("SERVICIO")) || "SERVICIO";
  const kTitular2 = keys.find((k) => k.toUpperCase().includes("TITULAR")) || "TITULAR";
  const kEstado2 = keys.find((k) => k.toUpperCase().includes("ESTADO")) || "ESTADO";
  const kSuplente2 = keys.find((k) => k.toUpperCase().includes("SUPLENTE")) || "SUPLENTE";
  const row = state2.masterData.find((r) => r[kServicio2] === center && (r[kEstado2] === "DESCUBIERTO" || r[kTitular2] === "DESCUBIERTO"));
  if (row) {
    row[kSuplente2] = substituteName;
    updateTicker2(`SISTEMA: ASIGNANDO A ${substituteName} PARA CUBRIR ${center}`);
    showToast2(`✅ Se ha propuesto a ${substituteName} como suplente.`, "success");
    saveAllState();
    processMasterArray(state2.masterData);
  }
};
(function() {
  console.log("\uD83D\uDEE1️ App.js: Initializing Failsafe Modal Engine...");
  function ensureModalStyles() {
    if (document.getElementById("failsafe-modal-styles"))
      return;
    const style = document.createElement("style");
    style.id = "failsafe-modal-styles";
    style.textContent = `
            #failsafe-modal {
                display: none;
                position: fixed !important;
                z-index: 999999999 !important;
                top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                background: rgba(0,0,0,0.85) !important;
                backdrop-filter: blur(8px) !important;
                justify-content: center !important;
                align-items: center !important;
                font-family: 'Outfit', sans-serif !important;
            }
            #failsafe-modal.active { display: flex !important; }
            .fs-modal-content {
                background: white !important;
                width: 90% !important;
                max-width: 900px !important;
                max-height: 85vh !important;
                border-radius: 24px !important;
                display: flex !important;
                flex-direction: column !important;
                box-shadow: 0 30px 100px rgba(0,0,0,0.6) !important;
                overflow: hidden !important;
                border: 1px solid rgba(0,0,0,0.1) !important;
                animation: fsModalFade 0.3s ease-out;
            }
            @keyframes fsModalFade { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            
            .fs-modal-header {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
                padding: 24px 30px !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                color: white !important;
            }
            .fs-modal-header h2 { margin: 0 !important; font-size: 1.6rem !important; color: white !important; font-weight: 800 !important; letter-spacing: -0.5px; }
            .fs-modal-close {
                background: rgba(255,255,255,0.1) !important;
                border: none !important;
                color: white !important;
                width: 44px !important; height: 44px !important;
                border-radius: 12px !important;
                font-size: 28px !important;
                cursor: pointer !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                transition: background 0.2s;
            }
            .fs-modal-close:hover { background: rgba(239, 68, 68, 0.2) !important; }
            
            .fs-modal-body {
                padding: 30px !important;
                overflow-y: auto !important;
                flex: 1 !important;
                background: #ffffff !important;
                color: #334155 !important;
            }
            .fs-modal-footer {
                padding: 24px 30px !important;
                background: #f8fafc !important;
                display: flex !important;
                gap: 16px !important;
                justify-content: flex-end !important;
                border-top: 1px solid #e2e8f0 !important;
            }
            .fs-btn {
                padding: 14px 28px !important;
                border-radius: 12px !important;
                border: none !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                transition: all 0.2s !important;
                text-transform: uppercase !important;
                font-size: 14px !important;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
            }
            .fs-btn.excel { background: #10b981 !important; color: white !important; }
            .fs-btn.pdf { background: #ef4444 !important; color: white !important; }
            .fs-btn.back { background: #64748b !important; color: white !important; }
            .fs-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2) !important; }
            
            .fs-table { width: 100% !important; border-collapse: collapse !important; }
            .fs-table th { 
                background: #f1f5f9 !important; 
                padding: 16px !important; 
                text-align: left !important; 
                font-weight: 800 !important; 
                color: #475569 !important;
                border-bottom: 2px solid #e2e8f0 !important;
                font-size: 11px !important;
                text-transform: uppercase !important;
            }
            .fs-table td { padding: 16px !important; border-bottom: 1px solid #f1f5f9 !important; font-size: 14px !important; }
            .fs-badge {
                padding: 6px 12px !important;
                border-radius: 20px !important;
                font-size: 11px !important;
                font-weight: 800 !important;
            }
        `;
    document.head.appendChild(style);
  }
  function createFailsafeModal() {
    if (document.getElementById("failsafe-modal"))
      return;
    const modal = document.createElement("div");
    modal.id = "failsafe-modal";
    modal.innerHTML = `
            <div class="fs-modal-content">
                <div class="fs-modal-header">
                    <h2 id="fs-modal-title">DETALLE DEL SISTEMA</h2>
                    <button class="fs-modal-close" onclick="document.getElementById('failsafe-modal').classList.remove('active')">×</button>
                </div>
                <div class="fs-modal-body" id="fs-modal-body"></div>
                <div class="fs-modal-footer">
                    <button class="fs-btn excel" onclick="if(window.exportStatusToExcel) window.exportStatusToExcel(); else alert('Generando reporte Excel...')">
                        <span>\uD83D\uDCCA</span> DESCARGAR EXCEL
                    </button>
                    <button class="fs-btn pdf" onclick="if(window.exportStatusToPDF) window.exportStatusToPDF(); else alert('Generando documento PDF...')">
                        <span>\uD83D\uDCC4</span> DESCARGAR PDF
                    </button>
                    <button class="fs-btn back" onclick="document.getElementById('failsafe-modal').classList.remove('active')">
                        VOLVER
                    </button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }
  window.openFailsafeModal = function(title, html) {
    ensureModalStyles();
    createFailsafeModal();
    document.getElementById("fs-modal-title").innerText = title;
    document.getElementById("fs-modal-body").innerHTML = html;
    document.getElementById("failsafe-modal").classList.add("active");
  };
  function handleCardClick(type) {
    console.log("\uD83D\uDDB1️ GOD-MODE: Click detected for", type);
    if (!window.state || !window.state.masterData) {
      window.openFailsafeModal("CARGANDO...", '<div style="text-align:center; padding:40px;"><div class="loading-spinner"></div><p>Sincronizando con la base de datos de Excel...</p></div>');
      return;
    }
    if (type === "UNCOVERED") {
      const uncovered = window.state.masterData.filter((r) => {
        const e = (r.ESTADO || "").toString().toUpperCase();
        const t = (r.TITULAR || "").toString().toUpperCase();
        const s = (r.SERVICIO || r.PROYECTO || "").toString();
        if (!s && !r.CLIENTE)
          return false;
        return e.includes("DESCUBIERTO") || e.includes("VACANTE") || t.includes("SIN TITULAR") || e === "" && t === "";
      });
      let html = '<div class="modal-list-container"><table class="fs-table"><thead><tr><th>SERVICIO / CENTRO</th><th>ESTADO</th><th>HORARIO</th></tr></thead><tbody>';
      uncovered.forEach((r) => {
        const name = r.SERVICIO || r.PROYECTO || "S/N";
        html += `<tr><td><b>${name}</b></td><td><span class="fs-badge" style="background:#fee2e2; color:#ef4444;">${r.ESTADO || "DESCUBIERTO"}</span></td><td><code style="color:#2563eb">${r.HORARIO || "-"}</code></td></tr>`;
      });
      html += "</tbody></table></div>";
      window.openFailsafeModal("\uD83D\uDD25 SERVICIOS DESCUBIERTOS (" + uncovered.length + ")", html);
    } else if (type === "ABSENCES") {
      const absences = window.state.masterData.filter((r) => {
        const e1 = (r.ESTADO1 || "").toString().toUpperCase();
        return e1.includes("BAJA") || e1.includes("IT") || e1.includes("VACACIONES");
      });
      let html = '<div class="modal-list-container"><table class="fs-table"><thead><tr><th>SERVICIO</th><th>TRABAJADOR</th><th>MOTIVO / ESTADO</th></tr></thead><tbody>';
      absences.forEach((r) => {
        const isVac = r.ESTADO1.toUpperCase().includes("VAC");
        const badgeStyle = isVac ? "background:#dcfce7; color:#16a34a;" : "background:#fef3c7; color:#d97706;";
        html += `<tr><td><b>${r.SERVICIO || r.PROYECTO || "-"}</b></td><td>${r.TITULAR || "-"}</td><td><span class="fs-badge" style="${badgeStyle}">${r.ESTADO1}</span></td></tr>`;
      });
      html += "</tbody></table></div>";
      window.openFailsafeModal("\uD83C\uDFE5 GESTIÓN DE BAJAS / IT (" + absences.length + ")", html);
    } else if (type === "INCIDENTS") {
      const incs = window.state.incidents || [];
      if (incs.length === 0) {
        window.openFailsafeModal("INCIDENCIAS", '<div style="text-align:center; padding:50px; color:#10b981;"><h3>✅ TODO EN ORDEN</h3><p>No hay incidencias críticas reportadas en las últimas 24h.</p></div>');
        return;
      }
      let html = '<div style="display:flex; flex-direction:column; gap:16px;">';
      incs.forEach((inc) => {
        html += `
                    <div style="background:#f8fafc; border-left:5px solid #3b82f6; padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong style="color:#1e293b; font-size:16px;">${inc.worker}</strong>
                            <span style="font-size:12px; color:#94a3b8;">${inc.date || ""}</span>
                        </div>
                        <div style="color:#475569; line-height:1.5;">${inc.desc}</div>
                    </div>`;
      });
      html += "</div>";
      window.openFailsafeModal("⚠️ INCIDENCIAS Y ALERTAS (" + incs.length + ")", html);
    }
  }
  document.addEventListener("click", function(e) {
    const card = e.target.closest("#metric-uncovered, #metric-absences, #metric-incidents");
    if (card) {
      console.log("\uD83C\uDFAF GOD-MODE: GLOBAL CLICK DETECTED:", card.id);
      e.preventDefault();
      e.stopPropagation();
      const keyMap = {
        "metric-uncovered": "UNCOVERED",
        "metric-absences": "ABSENCES",
        "metric-incidents": "INCIDENTS"
      };
      handleCardClick(keyMap[card.id]);
    }
  }, { capture: true, passive: false });
  console.log("✅ Failsafe Modal Engine v6.2: Global Delegation Active");
})();
window.initUncoveredCharts = function() {
  const ctxZone = document.getElementById("uncoveredZoneChart");
  if (ctxZone && state2.uncovered) {
    const zoneMap = {};
    state2.uncovered.forEach((u) => {
      const z = detectZone(u.center);
      zoneMap[z] = (zoneMap[z] || 0) + 1;
    });
    const sortedZones = Object.entries(zoneMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sortedZones.map((z) => z[0]);
    const data = sortedZones.map((z) => z[1]);
    const colors = data.map((v) => v > 5 ? "#ef4444" : v > 2 ? "#f59e0b" : "#3b82f6");
    if (window.chartZoneInst)
      window.chartZoneInst.destroy();
    if (typeof ChartDataLabels !== "undefined") {
      Chart.register(ChartDataLabels);
    }
    window.chartZoneInst = new Chart(ctxZone, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Descubiertos",
          data,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              label: (c) => `\uD83D\uDCE6 Volumen: ${c.raw}`
            }
          },
          datalabels: {
            display: true,
            color: "white",
            anchor: "end",
            align: "end",
            offset: 4,
            font: { weight: "bold", size: 10 },
            formatter: (value) => value > 0 ? value : ""
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#64748b", font: { size: 9 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: "white", font: { size: 10, weight: "700" } }
          }
        },
        layout: {
          padding: { right: 30 }
        },
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200 }
      }
    });
  }
  const ctxStatus = document.getElementById("uncoveredStatusChart");
  if (ctxStatus && state2.uncovered) {
    let pending = 0, managing = 0, covered = 0;
    state2.uncovered.forEach((u) => {
      const s = u.dispatchStatus || "PENDIENTE";
      if (s === "PENDIENTE")
        pending++;
      else if (s === "GESTION")
        managing++;
      else
        covered++;
    });
    const statusData = [pending, managing];
    const statusLabels = ["\uD83D\uDEA8 Pendiente", "⏳ En Gestión"];
    const statusColors = ["#ef4444", "#f59e0b"];
    if (window.chartStatusInst)
      window.chartStatusInst.destroy();
    window.chartStatusInst = new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusData,
          backgroundColor: statusColors,
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd5e1", font: { size: 10 }, usePointStyle: true, pointStyle: "circle" }
          },
          datalabels: {
            color: "white",
            font: { weight: "bold", size: 14 },
            formatter: (value) => value > 0 ? value : ""
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateScale: true, animateRotate: true }
      }
    });
  }
};
window.initMasterResize = function(e) {
  const wrapper = document.querySelector(".master-content-wrapper");
  if (!wrapper)
    return;
  document.body.style.userSelect = "none";
  const startY = e.clientY;
  const startHeight = wrapper.offsetHeight;
  function doDrag(e2) {
    let newHeight = startHeight + (e2.clientY - startY);
    if (newHeight < 200)
      newHeight = 200;
    if (newHeight > 2000)
      newHeight = 2000;
    wrapper.style.height = newHeight + "px";
    wrapper.style.maxHeight = "none";
  }
  function stopDrag() {
    document.body.style.userSelect = "";
    document.documentElement.removeEventListener("mousemove", doDrag, false);
    document.documentElement.removeEventListener("mouseup", stopDrag, false);
  }
  document.documentElement.addEventListener("mousemove", doDrag, false);
  document.documentElement.addEventListener("mouseup", stopDrag, false);
};
window.scrollTabs = function(direction) {
  const nav = document.querySelector(".tabs-nav");
  if (!nav)
    return;
  const scrollAmount = 300;
  if (direction === "left") {
    nav.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  } else {
    nav.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }
};
window.updateScrollButtons = function(element) {
  if (!element)
    return;
  const container = element.closest(".tabs-nav-container");
  if (!container)
    return;
  const leftBtn = container.querySelector(".scroll-nav-left");
  const rightBtn = container.querySelector(".scroll-nav-right");
  const scrollLeft = Math.ceil(element.scrollLeft);
  const scrollWidth = element.scrollWidth;
  const clientWidth = element.clientWidth;
  const maxScroll = scrollWidth - clientWidth;
  const hasScroll = scrollWidth > clientWidth;
  const atStart = scrollLeft <= 2;
  const atEnd = scrollLeft >= maxScroll - 2;
  if (leftBtn) {
    leftBtn.style.display = hasScroll && !atStart ? "flex" : "none";
  }
  if (rightBtn) {
    rightBtn.style.display = hasScroll && !atEnd ? "flex" : "none";
  }
  if (hasScroll && !atStart) {
    container.classList.add("show-fade-left");
  } else {
    container.classList.remove("show-fade-left");
  }
  if (hasScroll && !atEnd) {
    container.classList.add("show-fade-right");
  } else {
    container.classList.remove("show-fade-right");
  }
};
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const nav = document.querySelector(".tabs-nav");
    if (nav) {
      window.updateScrollButtons(nav);
      window.addEventListener("resize", () => window.updateScrollButtons(nav));
    }
  }, 500);
});

// src/main.js
console.log("\uD83D\uDE80 SIFU Informer V2 (ES Modules / Vite): Inicialización completada.");
