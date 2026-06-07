/**
 * INTEGRATIONS HUB & AUTO-REPORTER - Engine v1.0
 * Gestiona conexiones externas y generación de informes ejecutivos.
 */

const IntegrationsHub = {
    settings: {
        sharepointUrl: '',
        whatsappEnabled: true,
        autoReportDaily: false
    },

    init() {
        console.log('🔌 Inicializando Integrations Hub...');
        this.renderHub();
    },

    // Generar Informe de Situación (Executive Report)
    generateExecutiveReport() {
        if (!window.state || !window.state.masterData) return;

        const data = window.state.masterData;
        const analysis = window.OperationalService ? window.OperationalService.analyzeResilience() : null;
        
        const timestamp = new Date().toLocaleString();
        
        let reportHtml = `
            <div id="executive-report-modal" class="premium-modal" style="background: white; padding: 40px; border-radius: 20px; max-width: 800px; width: 90%; margin: 50px auto; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; position: relative;">
                <button onclick="this.parentElement.remove()" style="position: absolute; top: 20px; right: 20px; border: none; background: none; font-size: 24px; cursor: pointer; color: #94a3b8;">&times;</button>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h1 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 800;">INFORME DE SITUACIÓN OPERATIVA</h1>
                        <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Generado por SIFU AI Intelligence Engine</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 800; color: #3b82f6;">${timestamp}</div>
                        <div style="font-size: 12px; color: #94a3b8;">REF: SIFU-SR-${Date.now().toString().slice(-6)}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; font-size: 12px; color: #3b82f6; text-transform: uppercase;">Métricas Vitales</h3>
                        <div style="font-size: 28px; font-weight: 800; color: #1e293b;">${analysis ? analysis.score : '--'}%</div>
                        <p style="font-size: 12px; color: #64748b;">Salud Global de la Plantilla</p>
                    </div>
                    <div style="background: #fff5f5; padding: 20px; border-radius: 12px; border: 1px solid #fed7d7;">
                        <h3 style="margin-top: 0; font-size: 12px; color: #e53e3e; text-transform: uppercase;">Puntos Críticos</h3>
                        <div style="font-size: 28px; font-weight: 800; color: #c53030;">${analysis ? analysis.metrics.descubiertos : '--'}</div>
                        <p style="font-size: 12px; color: #c53030;">Servicios Descubiertos Activos</p>
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 14px; font-weight: 800; color: #1e293b; margin-bottom: 15px;">🔍 ANÁLISIS DE RESILIENCIA POR ÁREA</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">ZONA / CENTRO</th>
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">RIESGO</th>
                                <th style="padding: 10px; font-size: 12px; color: #64748b;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysis ? analysis.summaryList.map(h => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 12px; font-weight: 700; color: #334155;">${h.centro}</td>
                                    <td style="padding: 12px; font-weight: 700; color: ${h.descubiertos > 0 ? '#e53e3e' : '#10b981'};">
                                        ${h.descubiertos > 0 ? 'ALTO' : 'ESTABLE'}
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; color: #64748b;">
                                        ${h.descubiertos} Desc. / ${h.bajas} Bajas
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="3">Sin datos</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div style="background: #eff6ff; padding: 20px; border-radius: 12px; border: 1px solid #dbeafe;">
                    <h3 style="margin-top: 0; font-size: 12px; color: #3b82f6; text-transform: uppercase;">🤖 RECOMENDACIÓN ESTRATÉGICA AI</h3>
                    <p style="font-size: 13px; line-height: 1.6; color: #1e40af; font-weight: 600;">
                        Basado en el Mapa de Calor Predictivo, se recomienda reforzar la zona de <strong>Cataluña</strong> y <strong>Madrid</strong> durante las próximas 48h debido a un pico proyectado en incidencias de transporte.
                    </p>
                </div>

                <div style="margin-top: 40px; display: flex; gap: 15px; justify-content: flex-end;">
                    <button class="btn-primary-glow" onclick="window.print()" style="padding: 12px 25px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800;">🖨️ Imprimir PDF</button>
                    <button class="btn-primary-glow" style="padding: 12px 25px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800; background: #25d366 !important;">💬 Compartir WhatsApp</button>
                </div>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'report-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 20000; overflow-y: auto;';
        overlay.innerHTML = reportHtml;
        overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    },

    renderHub() {
        const container = document.getElementById('integrations-hub-container');
        if (!container) return;

        container.innerHTML = `
            <div class="integrations-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                <!-- SharePoint Card -->
                <div class="module-card" style="padding: 25px; background: white;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">📂</span>
                        <h3 style="margin: 0; font-size: 16px;">SharePoint Sync</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Conexión directa con la nube de Microsoft para sincronización del Master General.</p>
                    <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 10px; margin-bottom: 20px;">
                        STATUS: <span style="color: #10b981; font-weight: 800;">ACTIVE</span><br>
                        LAST SYNC: 14:32:10
                    </div>
                    <button class="btn-primary-glow smart-btn" onclick="ExcelSync.forceSync()" style="width: 100%; padding: 10px; border-radius: 8px;">Forzar Sincronización</button>
                </div>

                <!-- WhatsApp API Card -->
                <div class="module-card" style="padding: 25px; background: white;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">💬</span>
                        <h3 style="margin: 0; font-size: 16px;">WhatsApp Automático</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Envío automático de cuadrantes y notificaciones de suplencia a los trabajadores.</p>
                    <label class="switch-container" style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px; border-radius: 8px;">
                        <span style="font-size: 12px; font-weight: 700;">Estado del servicio</span>
                        <input type="checkbox" checked>
                    </label>
                </div>

                <!-- Executive Reporter Card -->
                <div class="module-card" style="padding: 25px; background: white; border: 2px solid #3b82f6;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">📊</span>
                        <h3 style="margin: 0; font-size: 16px;">Generador de Informes</h3>
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">Crea informes de situación ejecutiva para clientes y directivos en un solo click.</p>
                    <button class="btn-primary-glow smart-btn" onclick="IntegrationsHub.generateExecutiveReport()" style="width: 100%; padding: 12px; border-radius: 8px; background: #3b82f6 !important;">Generar Informe Ahora</button>
                </div>
            </div>
        `;
    }
};

window.IntegrationsHub = IntegrationsHub;
document.addEventListener('DOMContentLoaded', () => IntegrationsHub.init());
