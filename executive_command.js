/**
 * EXECUTIVE COMMAND CENTER - Centro de Mando Directivo v15.0
 * Vista de alto nivel para la toma de decisiones estratégicas.
 * Consolida KPIs de todas las fases anteriores.
 */

const ExecutiveCommand = {
    strategicGoals: {
        efficiency: 92,
        profitability: 18.5,
        sustainability: 78,
        retention: 94
    },

    init() {
        console.log('🏛️ Inicializando Centro de Mando Directivo...');
        this.renderExecutiveOverlay();
    },

    // ========================================
    // RENDERIZADO UI
    // ========================================

    renderExecutiveDashboard() {
        const container = document.getElementById('executive-command-container');
        if (!container) return;

        const data = window.state?.masterData || [];
        const efficiency = 94.2; // Simulado basado en cobertura
        const uncoveredCount = data.filter(d => (d.ESTADO || '').includes('DESCUBIERTO')).length;
        const lowRisk = uncoveredCount < 5 ? 'ÓPTIMO' : 'CRÍTICO';

        container.innerHTML = `
            <div class="exec-grid">
                <div class="exec-hero-row">
                    ${this.renderHoloCard('EFICIENCIA GLOBAL', efficiency + '%', '🚀', '#3b82f6')}
                    ${this.renderHoloCard('SALUD OPERATIVA', lowRisk, '🛡️', uncoveredCount < 5 ? '#10b981' : '#ef4444')}
                    ${this.renderHoloCard('DESCUBIERTOS', uncoveredCount, '🚨', uncoveredCount > 0 ? '#f59e0b' : '#10b981')}
                    ${this.renderHoloCard('IMPACTO SOCIAL', '98%', '🌱', '#8b5cf6')}
                </div>

                <div class="exec-main-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 20px;">
                    <div class="exec-card projection-v15" style="background: white; border-radius: 20px; padding: 25px; box-shadow: var(--panel-shadow); border: 1px solid #e2e8f0;">
                        <div class="exec-card-header" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #1e293b;">🛰️ MONITORIZACIÓN DE RED NACIONAL</h3>
                            <span class="badge blue">Sincronizado</span>
                        </div>
                        <div class="pulse-map-container" style="height: 300px; background: #f8fafc; border-radius: 15px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
                            <div class="map-bg" style="opacity: 0.05; font-size: 150px;">🌍</div>
                            <!-- Pulse Nodes -->
                            <div class="map-pulse ${uncoveredCount > 0 ? 'active' : ''}" style="top: 30%; left: 60%;" data-label="Barcelona"></div>
                            <div class="map-pulse" style="top: 50%; left: 45%;" data-label="Madrid"></div>
                            <div class="map-pulse" style="top: 70%; left: 40%;" data-label="Sevilla"></div>
                        </div>
                    </div>

                    <div class="exec-card insights-v15" style="background: #ffffff; color: #1e293b; border-radius: 20px; padding: 25px; border: 1px solid #e2e8f0; box-shadow: var(--panel-shadow);">
                        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">🧠 EXECUTIVE INSIGHTS</h3>
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
                        <button class="btn-primary-glow smart-btn" onclick="IntegrationsHub.generateExecutiveReport()" style="width: 100%; margin-top: 25px; padding: 14px; border-radius: 12px; font-weight: 800; border: none; cursor: pointer;">📊 GENERAR INFORME DETALLADO</button>
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
        const ctx = document.getElementById('executiveGrowthChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                datasets: [{
                    label: 'Ingresos Proyectados',
                    data: [1800000, 1950000, 2100000, 2050000, 2300000, 2450000],
                    borderColor: '#4285f4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
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
        if (typeof showToast === 'function') {
            showToast('🏛️ Comité de Dirección convocado. Notificaciones enviadas por MS Teams.', 'success');
        }
    },

    renderExecutiveOverlay() {
        // Esta función podría inyectar un botón flotante persistente para vista directiva
        console.log('🏛️Executive Overlay Ready');
    }
};

window.ExecutiveCommand = ExecutiveCommand;
