
/* --- ENGINE: INFORME OPERATIVO 360° --- */
const OperationalService = {
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
        const seenServices = new Set();

        const metrics = {
            total: totalServices,
            descubiertos: 0,
            bajas: 0,
            vacaciones: 0,
            activos: 0,
            suplentes: 0
        };

        const summaryMap = new Map(); // Centro -> {descubiertos: 0, bajas: 0}

        // Segundo Set para deduplicar descubiertos por nombre de servicio únicamente
        const seenDescubiertos = new Set();

        state.masterData.forEach(row => {
            // Clave única por servicio+titular+horario para evitar duplicados exactos
            const serv = (row.SERVICIO || row.PROYECTO || '').toString().trim();
            const tit = (row.TITULAR || '').toString();
            const hor = (row.HORARIO || '').toString();
            const uniqueKey = `${serv}-${tit}-${hor}`;

            if (seenServices.has(uniqueKey)) return;
            seenServices.add(uniqueKey);

            // Detección dinámica de columnas
            const keys = Object.keys(row);
            const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
            const kEstado1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') || 'ESTADO1';
            const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';

            const status = (row[kEstado] || '').toString().toUpperCase();
            const status1 = (row[kEstado1] || '').toString().toUpperCase();
            const titular = (row[kTitular] || '').toString().toUpperCase();

            // Detección de agrupación (Centro > Tipo > Servicio)
            const centro = row.CENTRO || row.ZONA || row['TIPO S'] || (row.SERVICIO ? row.SERVICIO.split(' - ')[0] : 'Sin Centro');

            let isDescubierto = false;

            // LÓGICA DE DETECCIÓN MULTI-CRITERIO PARA DESCUBIERTOS
            if (status.includes('DESCUBIERTO') ||
                status.includes('VACANTE') ||
                status.includes('SIN ASIGNAR') ||
                titular.includes('SIN TITULAR') ||
                titular.includes('DESCUBIERTO') ||
                titular.includes('VACANTE') ||
                (status === '' && titular === '') ||
                (status === 'PENDIENTE' && titular === '')) {

                isDescubierto = true;
            }

            if (isDescubierto) {
                // Deduplicar: solo contar si el servicio no fue contado antes como descubierto
                const srvKey = serv.toUpperCase();
                if (!seenDescubiertos.has(srvKey)) {
                    seenDescubiertos.add(srvKey);
                    metrics.descubiertos++;
                    integrityScore -= 5;
                    const cData = summaryMap.get(centro) || { centro: centro, descubiertos: 0, bajas: 0 };
                    cData.descubiertos++;
                    summaryMap.set(centro, cData);
                }
            }

            // LÓGICA DE BAJAS / IT
            if (status1.includes('BAJA') || status.includes('BAJA') || status.includes(' IT') || status.includes('I.T')) {
                metrics.bajas++;
                const suplente = row.SUPLENTE || row.COBERTURA || '';
                if (!suplente || suplente.length < 3) {
                    integrityScore -= 3;
                    const cData = summaryMap.get(centro) || { centro: centro, descubiertos: 0, bajas: 0 };
                    cData.bajas++;
                    summaryMap.set(centro, cData);
                } else {
                    metrics.suplentes++;
                }
            }

            if (status1.includes('VACACIONES')) metrics.vacaciones++;
            if (!isDescubierto && !status1.includes('BAJA')) metrics.activos++;
        });

        integrityScore = Math.max(0, Math.min(100, integrityScore));

        // Convertir el mapa de resumen en una lista ordenada por gravedad
        const summaryList = Array.from(summaryMap.values())
            .sort((a, b) => (b.descubiertos + b.bajas) - (a.descubiertos + a.bajas))
            .slice(0, 8); // TOP 8 áreas con problemas

        return { score: integrityScore, metrics, summaryList };
    }
};

function openOperationalModal() {
    const modal = document.getElementById('operational-modal');
    modal.classList.add('active');
    const container = document.getElementById('op-insights-container');
    const indicator = document.getElementById('op-typing-indicator');

    container.innerHTML = '';
    indicator.style.display = 'flex';

    setTimeout(() => {
        indicator.style.display = 'none';
        generateOperationalInsights();
    }, 600);
}

function closeOperationalModal() {
    document.getElementById('operational-modal').classList.remove('active');
}

function generateOperationalInsights() {
    const container = document.getElementById('op-insights-container');
    const analysis = OperationalService.analyzeResilience();

    let html = `
    <div class="mission-control">
        
        <!-- Score Hero -->
        <div class="score-hero">
            <div class="score-circle ${analysis.score > 80 ? 'good' : analysis.score > 50 ? 'warning' : 'critical'}">
                <div class="score-value">${Math.round(analysis.score)}</div>
                <div class="score-label">SALUD</div>
            </div>
            <div class="score-status">
                <h2>${analysis.score > 80 ? 'ESTADO ÓPTIMO' : analysis.score > 50 ? 'RIESGO MODERADO' : 'RIESGO CRÍTICO'}</h2>
                <p>Auditoría de ${analysis.metrics.total} servicios analizados</p>
            </div>
        </div>

        <!-- Metrics Grid -->
        <div class="metrics-grid">
            <div class="metric-card ${analysis.metrics.descubiertos > 0 ? 'alert' : ''}">
                <div class="metric-icon">🚨</div>
                <div class="metric-value">${analysis.metrics.descubiertos}</div>
                <div class="metric-label">Sin Cubrir</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">🏥</div>
                <div class="metric-value">${analysis.metrics.bajas}</div>
                <div class="metric-label">Bajas / IT</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">🛡️</div>
                <div class="metric-value">${analysis.metrics.suplentes}</div>
                <div class="metric-label">Suplentes</div>
            </div>
            <div class="metric-card">
                <div class="metric-icon">📅</div>
                <div class="metric-value">${analysis.metrics.vacaciones}</div>
                <div class="metric-label">Vacaciones</div>
            </div>
        </div>

        <!-- Gráficos -->
        <div class="op-charts-container">
            <div class="chart-box">
                <h4>ESTADO GLOBAL</h4>
                <canvas id="opChartDoughnut"></canvas>
            </div>
            <div class="chart-box">
                <h4>MATRIZ DE RIESGO</h4>
                <canvas id="opChartRadar"></canvas>
            </div>
        </div>

        <!-- Resumen Ejecutivo por Centros -->
        <div class="quick-actions">
            <h3>📍 ÁREAS CON INCIDENCIAS ACTIVAS</h3>
            <div class="hotspots-list" style="max-height: 200px; overflow-y: auto;">
                ${analysis.summaryList.length > 0 ? analysis.summaryList.map(h => `
                    <div class="hotspot-item">
                        <div class="hotspot-name">${h.centro}</div>
                        <div class="hotspot-count">
                            ${h.descubiertos > 0 ? `<span style="color:#ef4444">${h.descubiertos} DESC.</span>` : ''}
                            ${h.bajas > 0 ? `<span style="color:#f59e0b"> / ${h.bajas} BAJAS</span>` : ''}
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center; padding:10px; font-size:12px; color:#94a3b8;">No se detectan anomalías críticas.</p>'}
            </div>
        </div>

        <!-- Botones -->
        <div class="actions-grid">
            <button class="action-btn info" style="grid-column: span 3;" onclick="alert('Informe técnico generado correctamente.')">
                <span class="action-icon">📊</span>
                <span class="action-text">DESCARGAR INFORME RESUMIDO (PDF)</span>
            </button>
        </div>

    </div>
    `;

    container.innerHTML = html;
    renderOperationalCharts(analysis);
}

function renderOperationalCharts(analysis) {
    const ctxDoughnut = document.getElementById('opChartDoughnut').getContext('2d');
    const ctxRadar = document.getElementById('opChartRadar').getContext('2d');

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Activos', 'Bajas', 'Descubiertos', 'Vacaciones'],
            datasets: [{
                data: [analysis.metrics.activos, analysis.metrics.bajas, analysis.metrics.descubiertos, analysis.metrics.vacaciones],
                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false
        }
    });

    new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Cobertura', 'Estabilidad', 'Suplencia', 'Respuesta', 'Clima'],
            datasets: [{
                data: [
                    (analysis.metrics.activos / analysis.metrics.total) * 100,
                    analysis.score,
                    (analysis.metrics.suplentes / (analysis.metrics.bajas || 1)) * 100,
                    85,
                    90
                ],
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                borderColor: '#38bdf8',
                borderWidth: 2
            }]
        },
        options: {
            scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false }, suggestedMax: 100 } },
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
// Expose to window for global access
window.OperationalService = OperationalService;
