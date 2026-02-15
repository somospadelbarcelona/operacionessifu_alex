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

        container.innerHTML = `
            <div class="exec-grid">
                <!-- Visión Holográfica de KPIs (Simulada 3D) -->
                <div class="exec-hero-row">
                    ${this.renderHoloCard('EFICIENCIA OPERATIVA', this.strategicGoals.efficiency + '%', 'trending_up', '#4285f4')}
                    ${this.renderHoloCard('MARGEN EBITDA', this.strategicGoals.profitability + '%', 'payments', '#34a853')}
                    ${this.renderHoloCard('SCORE ESG', this.strategicGoals.sustainability + '/100', 'eco', '#fbbc04')}
                    ${this.renderHoloCard('RETENCIÓN TALENTO', this.strategicGoals.retention + '%', 'groups', '#764ba2')}
                </div>

                <!-- Proyecciones y Alertas Críticas -->
                <div class="exec-main-row">
                    <div class="exec-card projection-v15">
                        <div class="exec-card-header">
                            <h3>📈 Proyección de Crecimiento Trimestral</h3>
                            <span class="status-tag pulse">LIVE</span>
                        </div>
                        <canvas id="executiveGrowthChart"></canvas>
                        <div class="projection-meta">
                            <div class="p-item">
                                <span class="p-label">Previsión Ingresos</span>
                                <span class="p-val">€2.4M</span>
                            </div>
                            <div class="p-item">
                                <span class="p-label">Coste Proyectado</span>
                                <span class="p-val">€1.9M</span>
                            </div>
                        </div>
                    </div>

                    <div class="exec-card insights-v15">
                        <div class="exec-card-header">
                            <h3>🧠 Insights Cognitivos IA</h3>
                        </div>
                        <div class="insight-list">
                            <div class="insight-item">
                                <div class="insight-icon">💡</div>
                                <div class="insight-text">
                                    <strong>Optimización Flota:</strong> La transición al 100% eléctrica en la Zona Norte reduciría costes en un 12%.
                                </div>
                            </div>
                            <div class="insight-item">
                                <div class="insight-icon">⚠️</div>
                                <div class="insight-text">
                                    <strong>Riesgo de Rotación:</strong> 3 supervisores clave muestran fatiga operativa (Basado en KPI de incidencias).
                                </div>
                            </div>
                            <div class="insight-item">
                                <div class="insight-icon">✅</div>
                                <div class="insight-text">
                                    <strong>Compliance SGA:</strong> Auditorías de Calidad han subido un 8% tras implementar NC preventivas.
                                </div>
                            </div>
                        </div>
                        <button class="btn-exec-action" onclick="ExecutiveCommand.triggerStrategicMeeting()">Convocar Comité</button>
                    </div>
                </div>

                <!-- Mapa de Calor de Operaciones (Abstracción) -->
                <div class="exec-footer-row">
                    <div class="exec-card heat-map-abstract">
                        <h3>📍 Estado Global de Operaciones (Zonas Críticas)</h3>
                        <div class="map-placeholder-exec">
                            <div class="map-node crit" style="top: 20%; left: 30%;">BCN</div>
                            <div class="map-node ok" style="top: 50%; left: 15%;">MAD</div>
                            <div class="map-node warn" style="top: 70%; left: 45%;">VLC</div>
                            <div class="map-node ok" style="top: 40%; left: 80%;">BIO</div>
                            <div class="map-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initExecutiveChart();
    },

    renderHoloCard(label, val, icon, color) {
        return `
            <div class="holo-card" style="--holo-color: ${color}">
                <div class="holo-inner">
                    <span class="holo-label">${label}</span>
                    <span class="holo-val">${val}</span>
                    <div class="holo-icon">${icon}</div>
                    <div class="holo-glow"></div>
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
