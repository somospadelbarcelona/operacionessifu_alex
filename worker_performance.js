/**
 * WORKER PERFORMANCE DASHBOARD - Dashboard de Rendimiento por Trabajador
 * Fichas individuales con métricas completas de cada trabajador
 */

const WorkerPerformance = {
    workers: {},
    selectedWorker: null,

    init() {
        console.log('📊 Inicializando Dashboard de Rendimiento de Trabajadores...');
        this.buildWorkerData();
        this.renderWorkerList();
    },

    buildWorkerData() {
        if (!window.state || !window.state.masterData) return;

        const workers = {};

        window.state.masterData.forEach(service => {
            const titular = service.TITULAR;
            if (!titular) return;

            if (!workers[titular]) {
                workers[titular] = {
                    name: titular,
                    services: [],
                    totalServices: 0,
                    activeServices: 0,
                    uncoveredServices: 0,
                    itServices: 0,
                    serviceTypes: new Set(),
                    locations: new Set(),
                    contracts: [],
                    vacations: [],
                    incidents: 0,
                    qualityScores: [],
                    avgQualityScore: 0,
                    reliability: 100,
                    performance: 100,
                    status: 'active'
                };
            }

            const worker = workers[titular];

            // Agregar servicio
            worker.services.push({
                proyecto: service.PROYECTO,
                servicio: service.SERVICIO,
                tipo: service['TIPO S'],
                horario: service.HORARIO,
                estado: service.ESTADO,
                estado1: service.ESTADO1,
                finContrato: service['FIN CONTRATO'],
                suplente: service.SUPLENTE
            });

            worker.totalServices++;

            // Contar estados
            if (service.ESTADO === 'CUBIERTO') worker.activeServices++;
            if (service.ESTADO === 'DESCUBIERTO') worker.uncoveredServices++;
            if (service.ESTADO1 === 'BAJA IT') {
                worker.itServices++;
                worker.status = 'baja_it';
            }
            if (service.ESTADO1 === 'VACACIONES') {
                worker.status = 'vacaciones';
            }

            // Tipos de servicio
            if (service['TIPO S']) {
                worker.serviceTypes.add(service['TIPO S']);
            }

            // Ubicaciones
            const location = this.extractLocation(service.SERVICIO);
            if (location) {
                worker.locations.add(location);
            }

            // Contratos
            if (service['FIN CONTRATO']) {
                worker.contracts.push({
                    proyecto: service.PROYECTO,
                    finContrato: this.excelDateToJS(service['FIN CONTRATO']),
                    servicio: service.SERVICIO
                });
            }

            // Vacaciones
            if (service['VACACIONES 2026']) {
                worker.vacations.push({
                    period: service['VACACIONES 2026'],
                    servicio: service.SERVICIO
                });
            }
        });

        // Calcular métricas adicionales
        Object.values(workers).forEach(worker => {
            // Convertir Sets a Arrays
            worker.serviceTypes = Array.from(worker.serviceTypes);
            worker.locations = Array.from(worker.locations);

            // Calcular fiabilidad
            if (worker.itServices > 0) {
                worker.reliability = Math.max(50, 100 - (worker.itServices * 15));
            }
            if (worker.uncoveredServices > 0) {
                worker.reliability = Math.max(30, worker.reliability - (worker.uncoveredServices * 10));
            }

            // Calcular rendimiento
            worker.performance = this.calculatePerformance(worker);

            // Cargar puntuaciones de calidad (si existen)
            this.loadQualityScores(worker);
        });

        this.workers = workers;
        console.log('👥 Datos de trabajadores construidos:', Object.keys(workers).length);
    },

    calculatePerformance(worker) {
        let score = 100;

        // Penalizar por bajas IT
        score -= worker.itServices * 10;

        // Penalizar por descubiertos
        score -= worker.uncoveredServices * 15;

        // Bonificar por múltiples servicios activos
        if (worker.activeServices >= 3) {
            score += 10;
        }

        // Bonificar por diversidad de tipos de servicio
        if (worker.serviceTypes.length >= 3) {
            score += 5;
        }

        return Math.max(0, Math.min(100, score));
    },

    loadQualityScores(worker) {
        // Cargar puntuaciones de calidad desde el módulo de calidad
        const qualityData = localStorage.getItem('sifu_quality_audits_v1');
        if (!qualityData) return;

        try {
            const audits = JSON.parse(qualityData);
            const workerAudits = audits.filter(audit =>
                worker.services.some(s => s.servicio === audit.service)
            );

            worker.qualityScores = workerAudits.map(a => a.score);
            if (worker.qualityScores.length > 0) {
                worker.avgQualityScore = (
                    worker.qualityScores.reduce((sum, s) => sum + s, 0) / worker.qualityScores.length
                ).toFixed(1);
            }
        } catch (e) {
            console.error('Error cargando puntuaciones de calidad:', e);
        }
    },

    renderWorkerList() {
        const container = document.getElementById('worker-list-container');
        if (!container) return;

        const workerArray = Object.values(this.workers);

        if (workerArray.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay trabajadores registrados</div>';
            return;
        }

        // Ordenar por rendimiento descendente
        workerArray.sort((a, b) => b.performance - a.performance);

        const html = `
            <div class="worker-search">
                <input type="text" id="worker-search-input" placeholder="🔍 Buscar trabajador..." 
                       oninput="WorkerPerformance.filterWorkers(this.value)">
            </div>
            <div class="worker-grid" id="worker-grid">
                ${workerArray.map(worker => this.renderWorkerCard(worker)).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderWorkerCard(worker) {
        const statusClass = {
            'active': 'worker-active',
            'baja_it': 'worker-it',
            'vacaciones': 'worker-vacation'
        }[worker.status] || 'worker-active';

        const statusLabel = {
            'active': '✅ Activo',
            'baja_it': '🏥 Baja IT',
            'vacaciones': '🏖️ Vacaciones'
        }[worker.status] || 'Activo';

        const performanceColor = worker.performance >= 80 ? '#34a853' :
            worker.performance >= 60 ? '#fbbc04' : '#ea4335';

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
                    ` : ''}
                </div>
                <div class="worker-tags">
                    ${worker.serviceTypes.slice(0, 3).map(type =>
            `<span class="service-type-tag">${type}</span>`
        ).join('')}
                    ${worker.serviceTypes.length > 3 ? `<span class="more-tag">+${worker.serviceTypes.length - 3}</span>` : ''}
                </div>
            </div>
        `;
    },

    showWorkerDetail(workerName) {
        const worker = this.workers[workerName];
        if (!worker) return;

        this.selectedWorker = worker;

        const modal = document.getElementById('worker-detail-modal');
        if (!modal) {
            this.createWorkerDetailModal();
            return this.showWorkerDetail(workerName);
        }

        const content = document.getElementById('worker-detail-content');
        content.innerHTML = this.renderWorkerDetailContent(worker);

        modal.style.display = 'flex';
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
                    <div class="metric-icon">📊</div>
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
                    <div class="metric-icon">🏢</div>
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
                ` : ''}
            </div>

            <div class="worker-detail-sections">
                <div class="detail-section">
                    <h3>📋 Servicios Asignados (${worker.services.length})</h3>
                    <div class="services-list">
                        ${worker.services.map(service => `
                            <div class="service-item ${service.estado === 'DESCUBIERTO' ? 'uncovered' : ''}">
                                <div class="service-name">${service.servicio}</div>
                                <div class="service-meta">
                                    <span class="service-type">${service.tipo || 'N/A'}</span>
                                    <span class="service-status">${service.estado}</span>
                                </div>
                                ${service.horario ? `<div class="service-schedule">⏰ ${service.horario}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>📅 Información de Contratos</h3>
                    ${nextContract ? `
                        <div class="info-box warning">
                            <strong>Próximo Contrato que Termina:</strong><br>
                            ${nextContract.servicio}<br>
                            Fecha: ${nextContract.finContrato.toLocaleDateString('es-ES')}<br>
                            Días restantes: ${Math.ceil((nextContract.finContrato - new Date()) / (1000 * 60 * 60 * 24))}
                        </div>
                    ` : '<div class="info-box">No hay contratos próximos a vencer</div>'}
                </div>

                ${nextVacation ? `
                    <div class="detail-section">
                        <h3>🏖️ Vacaciones Programadas</h3>
                        <div class="info-box">
                            ${nextVacation}
                        </div>
                    </div>
                ` : ''}

                <div class="detail-section">
                    <h3>🗺️ Ubicaciones de Trabajo</h3>
                    <div class="locations-list">
                        ${worker.locations.map(loc => `<span class="location-tag">📍 ${loc}</span>`).join('')}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>🏷️ Tipos de Servicio</h3>
                    <div class="types-list">
                        ${worker.serviceTypes.map(type => `<span class="type-tag">${type}</span>`).join('')}
                    </div>
                </div>

                ${worker.itServices > 0 ? `
                    <div class="detail-section">
                        <h3>🏥 Historial de Bajas IT</h3>
                        <div class="info-box warning">
                            Total de bajas IT: ${worker.itServices}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    getNextContractEnding(worker) {
        if (worker.contracts.length === 0) return null;

        const today = new Date();
        const futureContracts = worker.contracts
            .filter(c => c.finContrato > today)
            .sort((a, b) => a.finContrato - b.finContrato);

        return futureContracts.length > 0 ? futureContracts[0] : null;
    },

    getStatusLabel(status) {
        const labels = {
            'active': '✅ Activo',
            'baja_it': '🏥 Baja IT',
            'vacaciones': '🏖️ Vacaciones'
        };
        return labels[status] || 'Activo';
    },

    createWorkerDetailModal() {
        const modal = document.createElement('div');
        modal.id = 'worker-detail-modal';
        modal.className = 'modal';
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
        const modal = document.getElementById('worker-detail-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    filterWorkers(searchTerm) {
        const grid = document.getElementById('worker-grid');
        if (!grid) return;

        const term = searchTerm.toLowerCase();
        const cards = grid.querySelectorAll('.worker-card');

        cards.forEach(card => {
            const name = card.querySelector('.worker-name').textContent.toLowerCase();
            if (name.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    },

    extractLocation(serviceName) {
        if (!serviceName) return null;
        const match = serviceName.match(/\(([^)]+)\)/);
        return match ? match[1].trim() : null;
    },

    excelDateToJS(excelDate) {
        if (!excelDate) return null;
        return new Date((excelDate - 25569) * 86400 * 1000);
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkerPerformance.init());
} else {
    WorkerPerformance.init();
}
