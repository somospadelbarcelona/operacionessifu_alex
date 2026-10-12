/**
 * ADVANCED EXPORT SYSTEM - Sistema de Exportación Avanzada
 * Exporta datos en múltiples formatos con plantillas personalizables
 */

const AdvancedExport = {
    templates: {},
    exportHistory: [],

    init() {
        console.log('📤 Inicializando Sistema de Exportación Avanzada...');
        this.loadTemplates();
        this.loadExportHistory();
    },

    loadTemplates() {
        // Plantillas predefinidas
        this.templates = {
            'weekly_report': {
                name: 'Informe Semanal',
                description: 'Resumen semanal de operaciones',
                format: 'pdf',
                sections: ['summary', 'uncovered', 'itLeaves', 'contracts']
            },
            'worker_list': {
                name: 'Listado de Trabajadores',
                description: 'Lista completa de trabajadores con sus servicios',
                format: 'excel',
                sections: ['workers', 'services', 'performance']
            },
            'service_audit': {
                name: 'Auditoría de Servicios',
                description: 'Análisis detallado de todos los servicios',
                format: 'excel',
                sections: ['services', 'coverage', 'quality']
            },
            'ml_predictions': {
                name: 'Predicciones ML',
                description: 'Exportar predicciones de Machine Learning',
                format: 'json',
                sections: ['predictions', 'anomalies', 'routes']
            }
        };
    },

    loadExportHistory() {
        const saved = localStorage.getItem('sifu_export_history_v1');
        if (saved) {
            try {
                this.exportHistory = JSON.parse(saved);
            } catch (e) {
                this.exportHistory = [];
            }
        }
    },

    saveExportHistory() {
        // Mantener solo los últimos 50 exports
        if (this.exportHistory.length > 50) {
            this.exportHistory = this.exportHistory.slice(-50);
        }
        localStorage.setItem('sifu_export_history_v1', JSON.stringify(this.exportHistory));
    },

    // ========================================
    // EXPORTACIÓN A EXCEL
    // ========================================

    async exportToExcel(data, filename, options = {}) {
        console.log('📊 Exportando a Excel:', filename);

        if (typeof XLSX === 'undefined') {
            console.error('❌ XLSX library no disponible');
            return false;
        }

        try {
            const workbook = XLSX.utils.book_new();

            // Si data es un array de hojas
            if (Array.isArray(data) && data[0]?.sheetName) {
                data.forEach(sheet => {
                    const ws = XLSX.utils.json_to_sheet(sheet.data);

                    // Aplicar estilos si están disponibles
                    if (sheet.columnWidths) {
                        ws['!cols'] = sheet.columnWidths;
                    }

                    XLSX.utils.book_append_sheet(workbook, ws, sheet.sheetName);
                });
            } else {
                // Data simple
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(workbook, ws, 'Datos');
            }

            // Generar archivo
            XLSX.writeFile(workbook, filename);

            this.logExport('excel', filename);

            if (typeof showToast === 'function') {
                showToast('✅ Excel exportado correctamente', 'success');
            }

            return true;

        } catch (error) {
            console.error('❌ Error exportando a Excel:', error);
            if (typeof showToast === 'function') {
                showToast('❌ Error exportando a Excel', 'error');
            }
            return false;
        }
    },

    async exportMasterDataToExcel() {
        if (!window.state || !window.state.masterData) {
            console.log('⚠️ No hay datos para exportar');
            return;
        }

        const data = window.state.masterData.map(service => ({
            'Proyecto': service.PROYECTO,
            'Servicio': service.SERVICIO,
            'Tipo': service['TIPO S'],
            'Titular': service.TITULAR,
            'Estado': service.ESTADO,
            'Estado 1': service.ESTADO1,
            'Suplente': service.SUPLENTE,
            'Gestor': service.GESTOR,
            'Horario': service.HORARIO,
            'Fin Contrato': service['FIN CONTRATO'] ? this.excelDateToString(service['FIN CONTRATO']) : ''
        }));

        const filename = `SIFU_Master_${this.getDateString()}.xlsx`;
        await this.exportToExcel(data, filename);
    },

    async exportWorkerPerformanceToExcel() {
        if (typeof WorkerPerformance === 'undefined' || !WorkerPerformance.workerProfiles) {
            console.log('⚠️ No hay datos de rendimiento');
            return;
        }

        const profiles = Object.values(WorkerPerformance.workerProfiles);

        const data = profiles.map(profile => ({
            'Trabajador': profile.name,
            'Servicios Activos': profile.activeServices,
            'Rendimiento (%)': profile.performance,
            'Fiabilidad (%)': profile.reliability,
            'Bajas IT': profile.itLeaveHistory.length,
            'Tipos de Servicio': profile.serviceTypes.join(', '),
            'Ubicaciones': profile.locations.join(', '),
            'Próximo Contrato Fin': profile.upcomingContractEnd ? this.excelDateToString(profile.upcomingContractEnd) : 'N/A'
        }));

        const filename = `SIFU_Rendimiento_Trabajadores_${this.getDateString()}.xlsx`;
        await this.exportToExcel(data, filename);
    },

    async exportMLPredictionsToExcel() {
        if (typeof MLEngine === 'undefined' || !MLEngine.predictions) {
            console.log('⚠️ No hay predicciones ML');
            return;
        }

        const sheets = [
            {
                sheetName: 'Predicciones',
                data: MLEngine.predictions.map(pred => ({
                    'Servicio': pred.service,
                    'Proyecto': pred.proyecto,
                    'Titular': pred.titular,
                    'Probabilidad (%)': pred.probability,
                    'Nivel de Riesgo': pred.risk,
                    'Razón': pred.reason
                }))
            },
            {
                sheetName: 'Anomalías',
                data: MLEngine.anomalies.map(anomaly => ({
                    'Tipo': anomaly.type,
                    'Severidad': anomaly.severity,
                    'Mensaje': anomaly.message,
                    'Recomendación': anomaly.recommendation
                }))
            }
        ];

        const filename = `SIFU_Predicciones_ML_${this.getDateString()}.xlsx`;
        await this.exportToExcel(sheets, filename);
    },

    // ========================================
    // EXPORTACIÓN A PDF
    // ========================================

    async exportToPDF(content, filename) {
        console.log('📄 Generando PDF:', filename);

        // Para generar PDFs reales, necesitarías una librería como jsPDF
        // Por ahora, creamos un HTML que se puede imprimir como PDF

        const printWindow = window.open('', '_blank');

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
                    <p>Generado por SIFU Informer - ${new Date().toLocaleString('es-ES')}</p>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 500);

        this.logExport('pdf', filename);
    },

    async exportWeeklyReportToPDF() {
        if (!window.state || !window.state.masterData) return;

        const data = window.state.masterData;
        const covered = data.filter(s => s.ESTADO === 'CUBIERTO').length;
        const uncovered = data.filter(s => s.ESTADO === 'DESCUBIERTO').length;
        const itLeaves = data.filter(s => s.ESTADO1 === 'BAJA IT').length;

        const content = `
            <div class="header">
                <h1>📊 Informe Semanal</h1>
                <p>SIFU Informer - Semana del ${new Date().toLocaleDateString('es-ES')}</p>
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
                        ${data.filter(s => s.ESTADO === 'DESCUBIERTO').slice(0, 20).map(s => `
                            <tr>
                                <td>${s.SERVICIO}</td>
                                <td>${s.PROYECTO}</td>
                                <td>${s['TIPO S']}</td>
                                <td>${s.GESTOR}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        await this.exportToPDF(content, `Informe_Semanal_${this.getDateString()}.pdf`);
    },

    // ========================================
    // EXPORTACIÓN A JSON
    // ========================================

    async exportToJSON(data, filename) {
        console.log('📋 Exportando a JSON:', filename);

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);

        this.logExport('json', filename);

        if (typeof showToast === 'function') {
            showToast('✅ JSON exportado correctamente', 'success');
        }
    },

    async exportCompleteSnapshot() {
        const snapshot = {
            metadata: {
                exportDate: new Date().toISOString(),
                version: '1.0',
                source: 'SIFU Informer'
            },
            masterData: window.state?.masterData || [],
            workerProfiles: typeof WorkerPerformance !== 'undefined' ? WorkerPerformance.workerProfiles : {},
            mlPredictions: typeof MLEngine !== 'undefined' ? MLEngine.predictions : [],
            mlAnomalies: typeof MLEngine !== 'undefined' ? MLEngine.anomalies : [],
            routes: typeof RouteOptimizer !== 'undefined' ? RouteOptimizer.routes : [],
            clusters: typeof ServiceClustering !== 'undefined' ? ServiceClustering.clusters : [],
            notifications: typeof NotificationsEngine !== 'undefined' ? NotificationsEngine.notifications : [],
            trends: typeof AnalyticsTrends !== 'undefined' ? AnalyticsTrends.snapshots : []
        };

        const filename = `SIFU_Snapshot_Completo_${this.getDateString()}.json`;
        await this.exportToJSON(snapshot, filename);
    },

    // ========================================
    // EXPORTACIÓN A CSV
    // ========================================

    async exportToCSV(data, filename) {
        console.log('📊 Exportando a CSV:', filename);

        if (!Array.isArray(data) || data.length === 0) {
            console.log('⚠️ No hay datos para exportar');
            return;
        }

        // Obtener headers
        const headers = Object.keys(data[0]);

        // Crear CSV
        let csv = headers.join(',') + '\n';

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];

                // Escapar comillas y comas
                if (typeof value === 'string') {
                    value = value.replace(/"/g, '""');
                    if (value.includes(',') || value.includes('\n')) {
                        value = `"${value}"`;
                    }
                }

                return value;
            });

            csv += values.join(',') + '\n';
        });

        // Descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);

        this.logExport('csv', filename);

        if (typeof showToast === 'function') {
            showToast('✅ CSV exportado correctamente', 'success');
        }
    },

    // ========================================
    // UTILIDADES
    // ========================================

    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    },

    excelDateToString(excelDate) {
        if (!excelDate) return '';
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toLocaleDateString('es-ES');
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

    // ========================================
    // RENDERIZADO
    // ========================================

    renderExportPanel() {
        const container = document.getElementById('export-panel-container');
        if (!container) return;

        const html = `
            <div class="export-options">
                <h3>Exportaciones Rápidas</h3>
                <div class="export-buttons">
                    <button class="export-btn" onclick="AdvancedExport.exportMasterDataToExcel()">
                        📊 Exportar Master Data (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportWorkerPerformanceToExcel()">
                        👥 Exportar Rendimiento (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportMLPredictionsToExcel()">
                        🧠 Exportar Predicciones ML (Excel)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportWeeklyReportToPDF()">
                        📄 Exportar Informe Semanal (PDF)
                    </button>
                    <button class="export-btn" onclick="AdvancedExport.exportCompleteSnapshot()">
                        📋 Exportar Snapshot Completo (JSON)
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

        return this.exportHistory.slice(-10).reverse().map(log => `
            <div class="export-history-item">
                <span class="export-format">${log.format.toUpperCase()}</span>
                <span class="export-filename">${log.filename}</span>
                <span class="export-time">${new Date(log.timestamp).toLocaleString('es-ES')}</span>
            </div>
        `).join('');
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdvancedExport.init());
} else {
    AdvancedExport.init();
}

// Exponer globalmente
window.AdvancedExport = AdvancedExport;
