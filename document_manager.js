/**
 * ADVANCED DOCUMENT MANAGER - Gestión Documental y Firma Digital
 * Gestiona expedientes, contratos, PRL y procesos de firma electrónica.
 */

const DocumentManager = {
    documents: [],
    categories: {
        'CONTRATO': { icon: '📄', color: '#4285f4' },
        'PRL': { icon: '🛡️', color: '#34a853' },
        'DNI': { icon: '🆔', color: '#fbbc04' },
        'NOMINA': { icon: '💰', color: '#764ba2' },
        'OTROS': { icon: '📁', color: '#5f6368' }
    },

    init() {
        console.log('📁 Inicializando Gestión Documental...');
        this.loadDocuments();
        this.checkExpirations();
    },

    loadDocuments() {
        const saved = localStorage.getItem('sifu_documents_v1');
        if (saved) {
            this.documents = JSON.parse(saved);
        } else {
            this.generateMockDocuments();
        }
    },

    generateMockDocuments() {
        // Generar algunos documentos de prueba para trabajadores existentes
        if (window.state && window.state.masterData) {
            window.state.masterData.slice(0, 10).forEach(s => {
                if (s.TITULAR) {
                    this.documents.push({
                        id: 'DOC-' + Math.random().toString(36).substr(2, 9),
                        worker: s.TITULAR,
                        name: `Contrato_${s.TITULAR.replace(' ', '_')}.pdf`,
                        category: 'CONTRATO',
                        status: Math.random() > 0.3 ? 'SIGNED' : 'PENDING_SIGN',
                        uploadDate: new Date().toISOString(),
                        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        version: '1.0'
                    });
                }
            });
            this.saveDocuments();
        }
    },

    saveDocuments() {
        localStorage.setItem('sifu_documents_v1', JSON.stringify(this.documents));
    },

    // ========================================
    // FLUJO DE FIRMA DIGITAL
    // ========================================

    async requestSignature(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) return;

        doc.status = 'SENT_TO_SIGN';
        this.saveDocuments();
        this.renderDocumentPanel();

        // Simular notificación por WhatsApp/Email
        if (typeof IntegrationsHub !== 'undefined') {
            await IntegrationsHub.sendWhatsAppMessage(
                '+34600000000',
                `🔔 SIFU: Tienes un documento pendiente de firma: ${doc.name}. Enlace: https://sifu.firm/s/${doc.id}`
            );
        }

        if (typeof showToast === 'function') {
            showToast('📩 Solicitud de firma enviada al trabajador', 'info');
        }

        // Simular firma exitosa tras 3 segundos (para la demo)
        setTimeout(() => {
            this.completeSignature(docId);
        }, 3000);
    },

    completeSignature(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (doc) {
            doc.status = 'SIGNED';
            doc.signatureDate = new Date().toISOString();
            doc.signatureHash = 'SHA256:' + Math.random().toString(36).substr(2, 20);
            this.saveDocuments();
            this.renderDocumentPanel();

            if (typeof showToast === 'function') {
                showToast(`✅ Documento firmado legalmente: ${doc.name}`, 'success');
            }

            // Registrar en auditoría
            if (typeof SecurityManager !== 'undefined') {
                SecurityManager.logActivity('DIGITAL_SIGNATURE', `Documento ${docId} firmado por ${doc.worker}`);
            }
        }
    },

    // ========================================
    // ALERTAS DE VENCIMIENTO
    // ========================================

    checkExpirations() {
        const today = new Date();
        const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expired = this.documents.filter(d => new Date(d.expiryDate) < today);
        const expiringSoon = this.documents.filter(d => {
            const date = new Date(d.expiryDate);
            return date > today && date < nextMonth;
        });

        if (expiringSoon.length > 0 && typeof NotificationsEngine !== 'undefined') {
            NotificationsEngine.addNotification(
                '⚠️ DOCS PRÓXIMOS A VENCER',
                `Hay ${expiringSoon.length} documentos (DNI/PRL) que caducan este mes.`,
                'warning'
            );
        }
    },

    // ========================================
    // RENDERIZADO UI
    // ========================================

    renderDocumentPanel() {
        const container = document.getElementById('document-manager-container');
        if (!container) return;

        container.innerHTML = `
            <div class="doc-manager-grid">
                <!-- Buscador y Filtros -->
                <div class="doc-header">
                    <input type="text" id="doc-search" placeholder="Buscar por trabajador o nombre de archivo..." onkeyup="DocumentManager.filterDocs()">
                    <div class="doc-stats">
                        <span class="stat-tag">Total: ${this.documents.length}</span>
                        <span class="stat-tag signed">Firmados: ${this.documents.filter(d => d.status === 'SIGNED').length}</span>
                        <span class="stat-tag pending">Pendientes: ${this.documents.filter(d => d.status !== 'SIGNED').length}</span>
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
        return docs.map(doc => {
            const cat = this.categories[doc.category] || this.categories.OTROS;
            const statusClass = doc.status.toLowerCase();
            const statusLabel = {
                'SIGNED': '✅ Firmado',
                'PENDING_SIGN': '⏳ Pendiente',
                'SENT_TO_SIGN': '📩 Enviado',
                'EXPIRED': '🛑 Caducado'
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
                    <td class="${new Date(doc.expiryDate) < new Date() ? 'text-danger' : ''}">
                        ${new Date(doc.expiryDate).toLocaleDateString()}
                    </td>
                    <td>
                        <div class="doc-actions">
                            <button class="doc-btn view" title="Ver Documento">👁️</button>
                            ${doc.status === 'PENDING_SIGN' ? `
                                <button class="doc-btn sign" onclick="DocumentManager.requestSignature('${doc.id}')" title="Solicitar Firma">✍️</button>
                            ` : ''}
                            <button class="doc-btn download" title="Descargar">📥</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterDocs() {
        const term = document.getElementById('doc-search').value.toLowerCase();
        const filtered = this.documents.filter(d =>
            d.name.toLowerCase().includes(term) ||
            d.worker.toLowerCase().includes(term)
        );
        document.getElementById('doc-table-body').innerHTML = this.renderTableRows(filtered);
    }
};

window.DocumentManager = DocumentManager;
