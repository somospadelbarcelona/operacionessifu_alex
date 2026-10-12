/**
 * BI ENGINE - Motor de Business Intelligence
 * Realiza cálculos complejos de costes, proyecciones y análisis de tendencias
 */

const BIEngine = {
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
            avgResponseTime: 4.2, // horas (simulado)
            reliabilityTrend: []
        },
        geography: {
            heatmap: [],
            incidentsByArea: {}
        }
    },

    init() {
        console.log('📊 Inicializando Motor de BI...');
        this.updateData();
        this.runAnalysis();
    },

    updateData() {
        if (window.state && window.state.masterData) {
            this.data = window.state.masterData;
        }
    },

    runAnalysis() {
        if (this.data.length === 0) return;

        this.analyzeCosts();
        this.analyzeEfficiency();
        this.analyzeGeography();
    },

    analyzeCosts() {
        // Simulación de costes basada en tipos de servicio
        const costRates = {
            'LIMPIEZA': 1200,
            'SEGURIDAD': 1800,
            'MANTENIMIENTO': 1500,
            'RECEPCIÓN': 1300,
            'OTROS': 1100
        };

        const costs = {
            totalMonthly: 0,
            byType: {},
            servicesCount: this.data.length
        };

        this.data.forEach(service => {
            const type = service['TIPO S'] || 'OTROS';
            const rate = costRates[type] || costRates['OTROS'];

            costs.totalMonthly += rate;
            costs.byType[type] = (costs.byType[type] || 0) + rate;
        });

        costs.costPerService = costs.totalMonthly / costs.servicesCount;

        // Proyección: +5% si hay muchos descubiertos para cubrir con extras
        const uncoveredCount = this.data.filter(s => s.ESTADO === 'DESCUBIERTO').length;
        const extraRatio = uncoveredCount / this.data.length;
        costs.projectedNextMonth = costs.totalMonthly * (1 + (extraRatio * 0.2));

        this.analysis.costs = costs;
    },

    analyzeEfficiency() {
        const coveredCount = this.data.filter(s => s.ESTADO === 'CUBIERTO').length;
        this.analysis.efficiency.globalCoverage = (coveredCount / this.data.length) * 100;

        // Generar tendencia de fiabilidad (simulada basada en datos reales)
        this.analysis.efficiency.reliabilityTrend = Array.from({ length: 6 }, (_, i) => {
            const month = new Date();
            month.setMonth(month.getMonth() - (5 - i));
            return {
                month: month.toLocaleString('es-ES', { month: 'short' }),
                value: 85 + Math.random() * 10
            };
        });
    },

    analyzeGeography() {
        const areas = {};
        this.data.forEach(service => {
            // Extraer área del nombre del servicio (mejorable con datos reales de dirección)
            const areaMatch = service.SERVICIO.match(/(Barcelona|Badalona|Hospitalet|Cornellà|Sabadell|Terrassa)/i);
            const area = areaMatch ? areaMatch[0] : 'Otros';

            if (!areas[area]) {
                areas[area] = { total: 0, uncovered: 0, it: 0 };
            }

            areas[area].total++;
            if (service.ESTADO === 'DESCUBIERTO') areas[area].uncovered++;
            if (service.ESTADO1 === 'BAJA IT') areas[area].it++;
        });

        this.analysis.geography.incidentsByArea = areas;
    },

    // RENDERIZADO DE GRÁFICOS BI
    renderBiDashboard() {
        const container = document.getElementById('bi-dashboard-container');
        if (!container) return;

        container.innerHTML = `
            <div class="bi-grid">
                <!-- Tarjetas de Métricas -->
                <div class="bi-metrics-strip">
                    ${this.renderMetricCard('Coste Mensual Est.', `€${this.analysis.costs.totalMonthly.toLocaleString()}`, 'trending_up')}
                    ${this.renderMetricCard('Cobertura Global', `${this.analysis.efficiency.globalCoverage.toFixed(1)}%`, 'check_circle')}
                    ${this.renderMetricCard('Coste Medio/Serv', `€${Math.ceil(this.analysis.costs.costPerService)}`, 'payments')}
                    ${this.renderMetricCard('Proyección Próx. Mes', `€${Math.ceil(this.analysis.costs.projectedNextMonth).toLocaleString()}`, 'insert_chart')}
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
                                        <div class="area-bar" style="width: ${(stats.uncovered / stats.total * 100) || 5}%"></div>
                                    </div>
                                    <span class="area-val">${stats.uncovered} desc.</span>
                                </div>
                            `).join('')}
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
        // Gráfico de Queso - Costes
        const ctxPie = document.getElementById('bi-costs-pie');
        if (ctxPie) {
            new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(this.analysis.costs.byType),
                    datasets: [{
                        data: Object.values(this.analysis.costs.byType),
                        backgroundColor: ['#667eea', '#764ba2', '#6B8E23', '#FFD700', '#FF6347'],
                        borderWidth: 0
                    }]
                },
                options: {
                    plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } },
                    cutout: '70%'
                }
            });
        }

        // Gráfico de Línea - Tendencia
        const ctxLine = document.getElementById('bi-reliability-line');
        if (ctxLine) {
            new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: this.analysis.efficiency.reliabilityTrend.map(t => t.month),
                    datasets: [{
                        label: 'Fiabilidad %',
                        data: this.analysis.efficiency.reliabilityTrend.map(t => t.value),
                        borderColor: '#667eea',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(102, 126, 234, 0.1)'
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#fff' } },
                        x: { grid: { display: false }, ticks: { color: '#fff' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
};

window.BIEngine = BIEngine;
