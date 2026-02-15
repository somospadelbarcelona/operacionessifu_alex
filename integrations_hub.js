/**
 * INTEGRATIONS HUB - Centro de Integraciones Externas
 * Conecta con WhatsApp, Google Calendar, Email y más
 */

const IntegrationsHub = {
    integrations: {
        whatsapp: { enabled: false, configured: false },
        googleCalendar: { enabled: false, configured: false },
        email: { enabled: false, configured: false },
        webhooks: { enabled: false, configured: false }
    },

    settings: {},

    init() {
        console.log('🔌 Inicializando Hub de Integraciones...');
        this.loadSettings();
        this.checkIntegrations();
        this.createIntegrationsUI();
    },

    loadSettings() {
        const saved = localStorage.getItem('sifu_integrations_settings_v1');
        if (saved) {
            try {
                this.settings = JSON.parse(saved);
                console.log('✅ Configuración de integraciones cargada');
            } catch (e) {
                console.error('Error cargando configuración:', e);
            }
        }
    },

    saveSettings() {
        localStorage.setItem('sifu_integrations_settings_v1', JSON.stringify(this.settings));
    },

    checkIntegrations() {
        // WhatsApp
        if (this.settings.whatsapp?.apiKey && this.settings.whatsapp?.phoneNumber) {
            this.integrations.whatsapp.configured = true;
        }

        // Google Calendar
        if (this.settings.googleCalendar?.apiKey) {
            this.integrations.googleCalendar.configured = true;
        }

        // Email
        if (this.settings.email?.smtpHost && this.settings.email?.smtpUser) {
            this.integrations.email.configured = true;
        }

        // Webhooks
        if (this.settings.webhooks?.endpoints?.length > 0) {
            this.integrations.webhooks.configured = true;
        }
    },

    createIntegrationsUI() {
        // UI se creará en el Smart Hub
        console.log('🎨 UI de integraciones lista');
    },

    // ========================================
    // WHATSAPP BUSINESS API
    // ========================================

    async sendWhatsAppMessage(phoneNumber, message, options = {}) {
        if (!this.integrations.whatsapp.configured) {
            console.error('❌ WhatsApp no configurado');
            return { success: false, error: 'WhatsApp no configurado' };
        }

        console.log('📱 Enviando mensaje WhatsApp a:', phoneNumber);

        // En producción, esto haría una llamada real a la API de WhatsApp Business
        // Por ahora, simulamos el envío

        try {
            const payload = {
                to: phoneNumber,
                type: 'text',
                text: { body: message },
                ...options
            };

            // Simular llamada API
            const response = await this.simulateAPICall('whatsapp', payload);

            if (response.success) {
                console.log('✅ Mensaje WhatsApp enviado');
                this.logIntegrationActivity('whatsapp', 'message_sent', { to: phoneNumber });
            }

            return response;

        } catch (error) {
            console.error('❌ Error enviando WhatsApp:', error);
            return { success: false, error: error.message };
        }
    },

    async sendWhatsAppTemplate(phoneNumber, templateName, parameters) {
        if (!this.integrations.whatsapp.configured) {
            console.error('❌ WhatsApp no configurado');
            return { success: false, error: 'WhatsApp no configurado' };
        }

        console.log('📱 Enviando template WhatsApp:', templateName);

        const payload = {
            to: phoneNumber,
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'es' },
                components: parameters
            }
        };

        const response = await this.simulateAPICall('whatsapp', payload);

        if (response.success) {
            this.logIntegrationActivity('whatsapp', 'template_sent', { to: phoneNumber, template: templateName });
        }

        return response;
    },

    // Templates predefinidos
    async notifyContractEnding(worker, service, daysLeft) {
        const message = `🔔 *SIFU Informer*\n\nHola ${worker},\n\nTu contrato en *${service}* termina en *${daysLeft} días*.\n\nPor favor, confirma si deseas renovar.\n\n¿Necesitas ayuda? Responde a este mensaje.`;

        return await this.sendWhatsAppMessage(this.settings.whatsapp?.phoneNumber, message);
    },

    async notifySubstituteAssignment(worker, service, date) {
        const message = `🔔 *SIFU Informer*\n\nHola ${worker},\n\nSe te ha asignado como suplente en:\n\n📍 *${service}*\n📅 *${date}*\n\nPor favor, confirma tu disponibilidad.`;

        return await this.sendWhatsAppMessage(this.settings.whatsapp?.phoneNumber, message);
    },

    async notifyUncoveredService(manager, service) {
        const message = `🚨 *ALERTA - SIFU Informer*\n\nServicio descubierto:\n\n📍 *${service}*\n⏰ *Requiere atención inmediata*\n\nAccede al panel para gestionar.`;

        return await this.sendWhatsAppMessage(this.settings.whatsapp?.phoneNumber, message);
    },

    // ========================================
    // GOOGLE CALENDAR API
    // ========================================

    async createCalendarEvent(eventData) {
        if (!this.integrations.googleCalendar.configured) {
            console.error('❌ Google Calendar no configurado');
            return { success: false, error: 'Google Calendar no configurado' };
        }

        console.log('📅 Creando evento en Google Calendar:', eventData.summary);

        const event = {
            summary: eventData.summary,
            description: eventData.description || '',
            start: {
                dateTime: eventData.startTime,
                timeZone: 'Europe/Madrid'
            },
            end: {
                dateTime: eventData.endTime,
                timeZone: 'Europe/Madrid'
            },
            attendees: eventData.attendees || [],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 30 }
                ]
            }
        };

        const response = await this.simulateAPICall('googleCalendar', event);

        if (response.success) {
            this.logIntegrationActivity('googleCalendar', 'event_created', { summary: eventData.summary });
        }

        return response;
    },

    async syncVacationsToCalendar() {
        if (!window.state || !window.state.masterData) {
            console.log('⚠️ No hay datos para sincronizar');
            return;
        }

        console.log('🔄 Sincronizando vacaciones a Google Calendar...');

        const vacations = window.state.masterData.filter(s => s.ESTADO1 === 'VACACIONES');
        let synced = 0;

        for (const vacation of vacations) {
            const eventData = {
                summary: `Vacaciones - ${vacation.TITULAR}`,
                description: `Servicio: ${vacation.SERVICIO}\nTrabajador: ${vacation.TITULAR}`,
                startTime: this.excelDateToISO(vacation['INICIO VACACIONES']),
                endTime: this.excelDateToISO(vacation['FIN VACACIONES']),
                attendees: []
            };

            const result = await this.createCalendarEvent(eventData);
            if (result.success) synced++;
        }

        console.log(`✅ ${synced} vacaciones sincronizadas`);

        if (typeof showToast === 'function') {
            showToast(`📅 ${synced} vacaciones sincronizadas a Google Calendar`, 'success');
        }

        return { synced, total: vacations.length };
    },

    async syncContractEndingsToCalendar() {
        if (!window.state || !window.state.masterData) return;

        console.log('🔄 Sincronizando finales de contrato a Google Calendar...');

        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const endingContracts = window.state.masterData.filter(s => {
            if (!s['FIN CONTRATO']) return false;
            const endDate = new Date((s['FIN CONTRATO'] - 25569) * 86400 * 1000);
            return endDate >= today && endDate <= in30Days;
        });

        let synced = 0;

        for (const contract of endingContracts) {
            const endDate = new Date((contract['FIN CONTRATO'] - 25569) * 86400 * 1000);

            const eventData = {
                summary: `⚠️ Fin de Contrato - ${contract.TITULAR}`,
                description: `Servicio: ${contract.SERVICIO}\nTrabajador: ${contract.TITULAR}\n\n⚠️ Verificar renovación`,
                startTime: endDate.toISOString(),
                endTime: new Date(endDate.getTime() + 60 * 60 * 1000).toISOString(),
                attendees: []
            };

            const result = await this.createCalendarEvent(eventData);
            if (result.success) synced++;
        }

        console.log(`✅ ${synced} finales de contrato sincronizados`);

        if (typeof showToast === 'function') {
            showToast(`📅 ${synced} finales de contrato sincronizados`, 'success');
        }

        return { synced, total: endingContracts.length };
    },

    // ========================================
    // EMAIL AUTOMATION
    // ========================================

    async sendEmail(to, subject, body, options = {}) {
        if (!this.integrations.email.configured) {
            console.error('❌ Email no configurado');
            return { success: false, error: 'Email no configurado' };
        }

        console.log('📧 Enviando email a:', to);

        const email = {
            from: this.settings.email.smtpUser,
            to: to,
            subject: subject,
            html: body,
            ...options
        };

        const response = await this.simulateAPICall('email', email);

        if (response.success) {
            this.logIntegrationActivity('email', 'email_sent', { to, subject });
        }

        return response;
    },

    async sendWeeklyReport(managerEmail) {
        console.log('📊 Generando informe semanal...');

        const report = this.generateWeeklyReport();

        const html = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
                    .content { padding: 20px; }
                    .metric { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }
                    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Informe Semanal - SIFU Informer</h1>
                    <p>Semana del ${new Date().toLocaleDateString('es-ES')}</p>
                </div>
                <div class="content">
                    <h2>Resumen Operativo</h2>
                    
                    <div class="metric">
                        <div>Servicios Totales</div>
                        <div class="metric-value">${report.totalServices}</div>
                    </div>
                    
                    <div class="metric">
                        <div>Servicios Cubiertos</div>
                        <div class="metric-value">${report.covered}</div>
                    </div>
                    
                    <div class="metric">
                        <div>Servicios Descubiertos</div>
                        <div class="metric-value" style="color: #ea4335;">${report.uncovered}</div>
                    </div>
                    
                    <div class="metric">
                        <div>Bajas IT Activas</div>
                        <div class="metric-value" style="color: #fbbc04;">${report.itLeaves}</div>
                    </div>
                    
                    <div class="metric">
                        <div>Contratos que Terminan (30 días)</div>
                        <div class="metric-value" style="color: #ea4335;">${report.endingContracts}</div>
                    </div>
                    
                    <h3>Acciones Recomendadas</h3>
                    <ul>
                        ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
                <div class="footer">
                    <p>Este es un informe automático generado por SIFU Informer</p>
                    <p>Accede al panel para más detalles</p>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(
            managerEmail,
            '📊 Informe Semanal - SIFU Informer',
            html
        );
    },

    generateWeeklyReport() {
        if (!window.state || !window.state.masterData) {
            return {
                totalServices: 0,
                covered: 0,
                uncovered: 0,
                itLeaves: 0,
                endingContracts: 0,
                recommendations: []
            };
        }

        const data = window.state.masterData;
        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const report = {
            totalServices: data.length,
            covered: data.filter(s => s.ESTADO === 'CUBIERTO').length,
            uncovered: data.filter(s => s.ESTADO === 'DESCUBIERTO').length,
            itLeaves: data.filter(s => s.ESTADO1 === 'BAJA IT').length,
            endingContracts: data.filter(s => {
                if (!s['FIN CONTRATO']) return false;
                const endDate = new Date((s['FIN CONTRATO'] - 25569) * 86400 * 1000);
                return endDate >= today && endDate <= in30Days;
            }).length,
            recommendations: []
        };

        // Generar recomendaciones
        if (report.uncovered > 0) {
            report.recommendations.push(`⚠️ Hay ${report.uncovered} servicios descubiertos que requieren atención`);
        }
        if (report.endingContracts > 0) {
            report.recommendations.push(`📄 ${report.endingContracts} contratos terminan en los próximos 30 días`);
        }
        if (report.itLeaves > 5) {
            report.recommendations.push(`🏥 Número elevado de bajas IT (${report.itLeaves})`);
        }

        return report;
    },

    // ========================================
    // WEBHOOKS
    // ========================================

    async sendWebhook(event, data) {
        if (!this.integrations.webhooks.configured) {
            console.log('⚠️ Webhooks no configurados');
            return;
        }

        console.log('🔗 Enviando webhook:', event);

        const endpoints = this.settings.webhooks?.endpoints || [];

        for (const endpoint of endpoints) {
            if (endpoint.events.includes(event) || endpoint.events.includes('*')) {
                await this.sendWebhookToEndpoint(endpoint.url, event, data);
            }
        }
    },

    async sendWebhookToEndpoint(url, event, data) {
        const payload = {
            event: event,
            timestamp: new Date().toISOString(),
            data: data
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-SIFU-Event': event
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('✅ Webhook enviado a:', url);
                this.logIntegrationActivity('webhook', 'sent', { url, event });
            } else {
                console.error('❌ Error enviando webhook:', response.status);
            }

        } catch (error) {
            console.error('❌ Error enviando webhook:', error);
        }
    },

    // Eventos de webhook
    async notifyServiceUncovered(service) {
        await this.sendWebhook('service.uncovered', {
            service: service.SERVICIO,
            proyecto: service.PROYECTO,
            titular: service.TITULAR
        });
    },

    async notifyContractEnding(service, daysLeft) {
        await this.sendWebhook('contract.ending', {
            service: service.SERVICIO,
            worker: service.TITULAR,
            daysLeft: daysLeft,
            endDate: service['FIN CONTRATO']
        });
    },

    // ========================================
    // UTILIDADES
    // ========================================

    async simulateAPICall(integration, payload) {
        // Simular latencia de red
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

        // Simular éxito (95% de las veces)
        const success = Math.random() > 0.05;

        if (success) {
            return {
                success: true,
                messageId: 'msg_' + Date.now(),
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                success: false,
                error: 'Simulated API error'
            };
        }
    },

    excelDateToISO(excelDate) {
        if (!excelDate) return new Date().toISOString();
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toISOString();
    },

    logIntegrationActivity(integration, action, details) {
        const log = {
            integration,
            action,
            details,
            timestamp: new Date().toISOString()
        };

        // Guardar en localStorage
        const logs = JSON.parse(localStorage.getItem('sifu_integration_logs_v1') || '[]');
        logs.push(log);

        // Mantener solo los últimos 100 logs
        if (logs.length > 100) {
            logs.shift();
        }

        localStorage.setItem('sifu_integration_logs_v1', JSON.stringify(logs));
    },

    // ========================================
    // RENDERIZADO
    // ========================================

    renderIntegrationsPanel() {
        const container = document.getElementById('integrations-panel-container');
        if (!container) return;

        const html = `
            <div class="integrations-grid">
                ${this.renderIntegrationCard('whatsapp', '📱', 'WhatsApp Business', 'Envía notificaciones por WhatsApp')}
                ${this.renderIntegrationCard('googleCalendar', '📅', 'Google Calendar', 'Sincroniza eventos automáticamente')}
                ${this.renderIntegrationCard('email', '📧', 'Email', 'Envía informes por correo')}
                ${this.renderIntegrationCard('webhooks', '🔗', 'Webhooks', 'Integra con sistemas externos')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderIntegrationCard(key, icon, name, description) {
        const integration = this.integrations[key];
        const statusClass = integration.configured ? 'configured' : 'not-configured';
        const statusText = integration.configured ? 'Configurado' : 'No configurado';

        return `
            <div class="integration-card ${statusClass}">
                <div class="integration-icon">${icon}</div>
                <div class="integration-info">
                    <h4>${name}</h4>
                    <p>${description}</p>
                    <div class="integration-status">${statusText}</div>
                </div>
                <button class="integration-config-btn" onclick="IntegrationsHub.configureIntegration('${key}')">
                    ${integration.configured ? 'Reconfigurar' : 'Configurar'}
                </button>
            </div>
        `;
    },

    configureIntegration(key) {
        console.log('⚙️ Configurando integración:', key);

        if (typeof showToast === 'function') {
            showToast(`⚙️ Configuración de ${key} - Próximamente`, 'info');
        }
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => IntegrationsHub.init());
} else {
    IntegrationsHub.init();
}

// Exponer globalmente
window.IntegrationsHub = IntegrationsHub;
