/**
 * TRANSPORT OPTIMIZER - Motor de Logística y Sostenibilidad v1.0
 * Calcula costes, CO2 y oportunidades de carpooling.
 */

const TransportOptimizer = {
    costs: {
        kmRate: 0.19, // Precio por km (combustible + desgaste)
        co2Rate: 120   // g CO2 / km
    },

    init() {
        console.log('🚚 Inicializando Optimizador de Transporte...');
        this.analyzeLogistics();
    },

    analyzeLogistics() {
        if (!window.RouteOptimizer || !window.RouteOptimizer.routes) {
            console.warn('⚠️ RouteOptimizer no disponible para análisis logístico');
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

        // 1. Análisis de Costes y CO2
        routes.forEach(route => {
            const km = route.totalDistance || 0;
            analysis.totalKm += km;
            analysis.totalCost += km * this.costs.kmRate;
            analysis.totalCO2 += km * this.costs.co2Rate;
            
            if (route.savings) {
                analysis.potentialSavings += route.savings * this.costs.kmRate;
            }
        });

        // 2. Detección de Carpooling (Simplificada)
        // Agrupamos trabajadores por centro y horario
        const groups = {};
        window.state.masterData.forEach(s => {
            if (s.ESTADO === 'CUBIERTO' && s.SERVICIO && s.HORARIO) {
                const key = `${s.SERVICIO}_${s.HORARIO}`;
                if (!groups[key]) groups[key] = [];
                if (!groups[key].includes(s.TITULAR)) groups[key].push(s.TITULAR);
            }
        });

        analysis.carpoolingGroups = Object.entries(groups)
            .filter(([_, workers]) => workers.length > 1)
            .map(([key, workers]) => ({
                center: key.split('_')[0],
                horario: key.split('_')[1],
                workers
            }));

        this.currentAnalysis = analysis;
        this.renderTransportDashboard();
    },

    renderTransportDashboard() {
        const container = document.getElementById('transport-optimizer-container');
        if (!container) return;

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
                    <span style="font-size: 20px;">🚗</span> PROPUESTAS DE CARPOOLING (Rutas Compartidas)
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    ${a.carpoolingGroups.slice(0, 4).map(g => `
                        <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6;">
                            <div style="font-weight: 800; color: #1e293b; font-size: 13px;">${g.center}</div>
                            <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Horario: ${g.horario}</div>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;">
                                ${g.workers.map(w => `<span style="background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700;">${w.split(' ')[0]}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

window.TransportOptimizer = TransportOptimizer;
document.addEventListener('DOMContentLoaded', () => TransportOptimizer.init());
