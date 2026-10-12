/**
 * FINANCIAL MANAGER - Control de Facturación, Costes y Rentabilidad
 * Gestiona el análisis económico de los servicios en tiempo real.
 */

const FinancialManager = {
    serviceEconomics: {},
    globalMetrics: {
        totalRevenue: 0,
        totalCosts: 0,
        margin: 0,
        avgProfitability: 0
    },

    init() {
        console.log('💰 Inicializando Gestor Financiero...');
        this.calculateEconomics();
    },

    calculateEconomics() {
        if (!window.state || !window.state.masterData) return;

        const economics = {};
        let totalRevenue = 0;
        let totalCosts = 0;

        // Tasas estimadas por tipo de servicio (Euros/Mes)
        const rates = {
            'LIMPIEZA': { revenue: 2200, laborCost: 1400, materials: 150 },
            'SEGURIDAD': { revenue: 3500, laborCost: 2600, materials: 50 },
            'MANTENIMIENTO': { revenue: 2800, laborCost: 1800, materials: 300 },
            'RECEPCIÓN': { revenue: 2000, laborCost: 1450, materials: 20 },
            'OTROS': { revenue: 1800, laborCost: 1200, materials: 100 }
        };

        window.state.masterData.forEach(service => {
            const type = service['TIPO S'] || 'OTROS';
            const rate = rates[type] || rates['OTROS'];

            // Variabilidad aleatoria para realismo
            const variance = 0.9 + Math.random() * 0.2;
            const revenue = rate.revenue * variance;
            const costs = (rate.laborCost + rate.materials) * variance;

            // Ajuste por estado (si está descubierto, el coste sube por horas extra/urgencia)
            const statusPenalty = service.ESTADO === 'DESCUBIERTO' ? 1.4 : 1.0;
            const adjustedCosts = costs * statusPenalty;

            const margin = revenue - adjustedCosts;
            const marginPercent = (margin / revenue) * 100;

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
            avgProfitability: ((totalRevenue - totalCosts) / totalRevenue) * 100
        };
    },

    // ========================================
    // RENDERIZADO UI
    // ========================================

    renderFinancialDashboard() {
        const container = document.getElementById('financial-analysis-container');
        if (!container) return;

        container.innerHTML = `
            <div class="financial-grid">
                <!-- Tarjetas de Resumen Financiero -->
                <div class="f-metrics-row">
                    ${this.renderMetricCard('Facturación Bruta', `€${Math.ceil(this.globalMetrics.totalRevenue).toLocaleString()}`, 'trending_up', '#34a853')}
                    ${this.renderMetricCard('Costes Operativos', `€${Math.ceil(this.globalMetrics.totalCosts).toLocaleString()}`, 'payments', '#ea4335')}
                    ${this.renderMetricCard('Margen Bruto', `€${Math.ceil(this.globalMetrics.margin).toLocaleString()}`, 'savings', '#4285f4')}
                    ${this.renderMetricCard('Rentabilidad (EBITDA)', `${this.globalMetrics.avgProfitability.toFixed(1)}%`, 'analytics', '#fbbc04')}
                </div>

                <div class="f-charts-row">
                    <!-- Top 5 Servicios más Rentables -->
                    <div class="f-card">
                        <h3>⭐️ Top 5 Servicios Rentables</h3>
                        <div class="f-service-list">
                            ${this.getTopServices('profit', 5).map(s => this.renderServiceMiniCard(s)).join('')}
                        </div>
                    </div>

                    <!-- Top 5 Servicios en Riesgo Económico -->
                    <div class="f-card">
                        <h3>⚠️ Alertas de Rentabilidad (< 15%)</h3>
                        <div class="f-service-list">
                            ${this.getTopServices('risk', 5).map(s => this.renderServiceMiniCard(s)).join('')}
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
            <div class="f-mini-card ${isRisk ? 'risk' : ''}">
                <div class="f-mini-info">
                    <span class="f-mini-name">${serviceInfo.SERVICIO}</span>
                    <span class="f-mini-type">${eco.type}</span>
                </div>
                <div class="f-mini-values">
                    <span class="f-mini-margin ${isRisk ? 'low' : 'high'}">${eco.marginPercent.toFixed(1)}%</span>
                    <span class="f-mini-amount">€${Math.ceil(eco.margin).toLocaleString()}</span>
                </div>
                <div class="f-progress-bg">
                    <div class="f-progress-bar" style="width: ${eco.marginPercent}%; background: ${isRisk ? '#ea4335' : '#34a853'}"></div>
                </div>
            </div>
        `;
    },

    getTopServices(mode, count) {
        const sorted = Object.entries(this.serviceEconomics)
            .map(([name, data]) => ({ SERVICIO: name, ...data }))
            .sort((a, b) => mode === 'profit' ? b.marginPercent - a.marginPercent : a.marginPercent - b.marginPercent);

        return sorted.slice(0, count);
    }
};

window.FinancialManager = FinancialManager;
