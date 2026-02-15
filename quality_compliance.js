/**
 * QUALITY & COMPLIANCE SYSTEM (SGA) - Gestión de Calidad y Cumplimiento
 * Gestiona auditorías, certificaciones y KPIs de calidad (SLAs).
 */

const QualityManager = {
    audits: [],
    workerCertifications: {},
    nonConformities: [],

    init() {
        console.log('🏆 Inicializando Sistema de Gestión de Calidad (SGA)...');
        this.loadQualityData();
        this.generateMockCertifications();
    },

    loadQualityData() {
        const savedAudits = localStorage.getItem('sifu_audits_v1');
        const savedNC = localStorage.getItem('sifu_non_conformities_v1');

        if (savedAudits) this.audits = JSON.parse(savedAudits);
        if (savedNC) this.nonConformities = JSON.parse(savedNC);
    },

    // ========================================
    // GESTIÓN DE AUDITORÍAS
    // ========================================

    createAudit(serviceId, data) {
        const audit = {
            id: 'AUD-' + Date.now(),
            serviceId: serviceId,
            timestamp: new Date().toISOString(),
            auditor: SecurityManager.currentUser?.name || 'Supervisor Externo',
            score: data.score, // 0-100
            checks: data.checks, // { cleanliness: 10, punctuality: 10, uniform: 5... }
            comments: data.comments,
            status: data.score >= 80 ? 'PASSED' : 'FAILED'
        };

        this.audits.unshift(audit);
        this.saveAudits();

        if (audit.status === 'FAILED') {
            this.createNonConformity(audit);
        }

        if (typeof showToast === 'function') {
            showToast(`Auditoría registrada: ${audit.score}%`, audit.status === 'PASSED' ? 'success' : 'warning');
        }

        return audit;
    },

    saveAudits() {
        localStorage.setItem('sifu_audits_v1', JSON.stringify(this.audits));
    },

    // ========================================
    // GESTIÓN DE NO CONFORMIDADES (NC)
    // ========================================

    createNonConformity(audit) {
        const nc = {
            id: 'NC-' + Date.now(),
            auditId: audit.id,
            serviceId: audit.serviceId,
            severity: audit.score < 50 ? 'CRITICAL' : 'MINOR',
            description: `Baja puntuación en auditoría: ${audit.score}%`,
            createdAt: new Date().toISOString(),
            status: 'OPEN',
            actionPlan: '',
            deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48h para resolver
        };

        this.nonConformities.unshift(nc);
        this.saveNC();

        // Notificar al gestor automáticamente
        if (typeof NotificationsEngine !== 'undefined') {
            NotificationsEngine.addNotification(
                '🚨 INCIDENCIA DE CALIDAD',
                `Se ha generado una NC para el servicio ${audit.serviceId} debido a baja puntuación.`,
                'error'
            );
        }
    },

    saveNC() {
        localStorage.setItem('sifu_non_conformities_v1', JSON.stringify(this.nonConformities));
    },

    // ========================================
    // CERTIFICACIONES Y FORMACIÓN (PRL)
    // ========================================

    generateMockCertifications() {
        // En un caso real, esto vendría del Master Data o DB
        const certifications = [
            'PRL Básico', 'Manejo de Maquinaria', 'Tratamiento de Suelos',
            'Seguridad Química', 'Primeros Auxilios', 'Limpieza Hospitalaria'
        ];

        if (window.state && window.state.masterData) {
            window.state.masterData.forEach(s => {
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

    // ========================================
    // RENDERIZADO UI
    // ========================================

    renderQualityDashboard() {
        const container = document.getElementById('quality-management-container');
        if (!container) return;

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
                    <div class="q-stat-card ${this.nonConformities.filter(n => n.status === 'OPEN').length > 0 ? 'warning' : ''}">
                        <span class="q-stat-val">${this.nonConformities.filter(n => n.status === 'OPEN').length}</span>
                        <span class="q-stat-label">No Conformidades Abiertas</span>
                    </div>
                </div>

                <!-- Lista de Auditorías Recientes -->
                <div class="quality-tables-row">
                    <div class="q-card">
                        <h3>📋 Últimas Auditorías</h3>
                        <div class="q-list">
                            ${this.audits.slice(0, 5).map(a => `
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
                            `).join('') || '<p class="empty-state">No hay auditorías registradas</p>'}
                        </div>
                    </div>

                    <div class="q-card">
                        <h3>🚨 No Conformidades Activas</h3>
                        <div class="q-list">
                            ${this.nonConformities.filter(n => n.status === 'OPEN').slice(0, 5).map(n => `
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
                            `).join('') || '<p class="empty-state">Todo en orden: 0 NC abiertas</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    resolveNC(id) {
        const nc = this.nonConformities.find(n => n.id === id);
        if (nc) {
            nc.status = 'CLOSED';
            nc.resolvedAt = new Date().toISOString();
            this.saveNC();
            this.renderQualityDashboard();
            if (typeof showToast === 'function') {
                showToast('No Conformidad resuelta correctamente', 'success');
            }
        }
    }
};

window.QualityManager = QualityManager;
