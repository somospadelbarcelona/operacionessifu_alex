/**
 * NOTIFICATIONS ENGINE - Sistema de Notificaciones Inteligentes
 * Gestiona alertas proactivas, recordatorios y notificaciones push
 */

const NotificationsEngine = {
    notifications: [],
    settings: {
        enabled: true,
        sound: true,
        desktop: true,
        contractWarningDays: 7,
        vacationWarningDays: 3,
        auditReminderDays: 30
    },

    init() {
        console.log('🔔 Inicializando Motor de Notificaciones...');
        this.loadSettings();
        this.loadNotifications();
        this.requestPermission();
        this.startMonitoring();
        this.renderNotificationCenter();
    },

    loadSettings() {
        const saved = localStorage.getItem('sifu_notification_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    },

    saveSettings() {
        localStorage.setItem('sifu_notification_settings', JSON.stringify(this.settings));
    },

    loadNotifications() {
        const saved = localStorage.getItem('sifu_notifications_v1');
        if (saved) {
            this.notifications = JSON.parse(saved);
        }
    },

    saveNotifications() {
        localStorage.setItem('sifu_notifications_v1', JSON.stringify(this.notifications));
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('📢 Permiso de notificaciones:', permission);
            });
        }
    },

    // MOTOR DE ANÁLISIS - Genera notificaciones inteligentes
    startMonitoring() {
        console.log('👁️ Iniciando monitoreo inteligente...');
        this.analyzeData();
        // Re-analizar cada 5 minutos
        setInterval(() => this.analyzeData(), 5 * 60 * 1000);
    },

    analyzeData() {
        if (!window.state || !window.state.masterData) return;

        const today = new Date();
        const notifications = [];

        window.state.masterData.forEach(service => {
            // 1. CONTRATOS PRÓXIMOS A VENCER
            if (service['FIN CONTRATO']) {
                const endDate = this.excelDateToJS(service['FIN CONTRATO']);
                const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

                if (daysUntilEnd > 0 && daysUntilEnd <= this.settings.contractWarningDays) {
                    notifications.push({
                        id: `contract_${service.PROYECTO}_${daysUntilEnd}`,
                        type: 'contract_ending',
                        priority: daysUntilEnd <= 3 ? 'high' : 'medium',
                        title: '📅 Contrato Próximo a Vencer',
                        message: `${service.TITULAR || 'Trabajador'} - ${service.SERVICIO}`,
                        detail: `Termina en ${daysUntilEnd} día${daysUntilEnd > 1 ? 's' : ''}`,
                        timestamp: new Date().toISOString(),
                        data: service,
                        action: 'renovar_contrato'
                    });
                }
            }

            // 2. VACACIONES PRÓXIMAS
            if (service['VACACIONES 2026']) {
                const vacStart = this.parseVacationDate(service['VACACIONES 2026']);
                if (vacStart) {
                    const daysUntilVac = Math.ceil((vacStart - today) / (1000 * 60 * 60 * 24));

                    if (daysUntilVac > 0 && daysUntilVac <= this.settings.vacationWarningDays) {
                        const hasSuplente = service.SUPLENTE && service.SUPLENTE !== 'EMERGENCIAS';
                        notifications.push({
                            id: `vacation_${service.PROYECTO}_${daysUntilVac}`,
                            type: 'vacation_upcoming',
                            priority: hasSuplente ? 'low' : 'high',
                            title: '🏖️ Vacaciones Próximas',
                            message: `${service.TITULAR} - ${service.SERVICIO}`,
                            detail: `Inicia en ${daysUntilVac} día${daysUntilVac > 1 ? 's' : ''}${hasSuplente ? ' ✓ Suplente confirmado' : ' ⚠️ Sin suplente'}`,
                            timestamp: new Date().toISOString(),
                            data: service,
                            action: hasSuplente ? null : 'asignar_suplente'
                        });
                    }
                }
            }

            // 3. BAJAS IT SIN SUPLENTE
            if (service.ESTADO1 === 'BAJA IT' && (!service.SUPLENTE || service.SUPLENTE === 'EMERGENCIAS')) {
                notifications.push({
                    id: `it_uncovered_${service.PROYECTO}`,
                    type: 'it_uncovered',
                    priority: 'critical',
                    title: '🚨 Baja IT Sin Cobertura',
                    message: `${service.TITULAR} - ${service.SERVICIO}`,
                    detail: 'Requiere suplente urgente',
                    timestamp: new Date().toISOString(),
                    data: service,
                    action: 'asignar_suplente'
                });
            }

            // 4. DESCUBIERTOS CRÍTICOS
            if (service.ESTADO === 'DESCUBIERTO') {
                notifications.push({
                    id: `uncovered_${service.PROYECTO}`,
                    type: 'uncovered',
                    priority: 'critical',
                    title: '🔥 Servicio Descubierto',
                    message: `${service.SERVICIO}`,
                    detail: service.TITULAR ? `Titular: ${service.TITULAR}` : 'Sin titular asignado',
                    timestamp: new Date().toISOString(),
                    data: service,
                    action: 'resolver_descubierto'
                });
            }
        });

        // 5. AUDITORÍAS PENDIENTES (simulado - se puede mejorar con datos reales)
        const lastAudit = localStorage.getItem('last_quality_audit_date');
        if (lastAudit) {
            const daysSinceAudit = Math.ceil((today - new Date(lastAudit)) / (1000 * 60 * 60 * 24));
            if (daysSinceAudit >= this.settings.auditReminderDays) {
                notifications.push({
                    id: 'audit_reminder',
                    type: 'audit_reminder',
                    priority: 'medium',
                    title: '⭐ Recordatorio de Auditoría',
                    message: `Han pasado ${daysSinceAudit} días desde la última auditoría`,
                    detail: 'Programa auditorías de calidad',
                    timestamp: new Date().toISOString(),
                    action: 'programar_auditoria'
                });
            }
        }

        // Filtrar notificaciones duplicadas y agregar nuevas
        this.addNotifications(notifications);
    },

    addNotifications(newNotifications) {
        const existingIds = new Set(this.notifications.map(n => n.id));
        const toAdd = newNotifications.filter(n => !existingIds.has(n.id));

        if (toAdd.length > 0) {
            this.notifications.unshift(...toAdd);
            this.saveNotifications();
            this.renderNotificationCenter();

            // Mostrar notificación de escritorio para las críticas
            toAdd.forEach(notif => {
                if (notif.priority === 'critical' && this.settings.desktop) {
                    this.showDesktopNotification(notif);
                }
            });

            // Actualizar badge
            this.updateBadge();
        }
    },

    showDesktopNotification(notif) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(notif.title, {
                body: `${notif.message}\n${notif.detail}`,
                icon: 'img/logo sifu.png',
                badge: 'img/logo sifu.png',
                tag: notif.id,
                requireInteraction: notif.priority === 'critical'
            });

            notification.onclick = () => {
                window.focus();
                this.handleNotificationAction(notif);
                notification.close();
            };
        }
    },

    handleNotificationAction(notif) {
        switch (notif.action) {
            case 'renovar_contrato':
                alert(`Acción: Renovar contrato de ${notif.data.TITULAR}\n\nEsta funcionalidad se integrará con tu sistema de gestión.`);
                break;
            case 'asignar_suplente':
                alert(`Acción: Asignar suplente para ${notif.data.SERVICIO}\n\nSe abrirá el módulo de gestión de suplentes (próximamente).`);
                break;
            case 'resolver_descubierto':
                // Ir a la pestaña de descubiertos
                if (typeof switchTab === 'function') {
                    switchTab('descubiertos');
                }
                break;
            case 'programar_auditoria':
                if (typeof switchTab === 'function') {
                    switchTab('calidad');
                }
                break;
        }
        this.markAsRead(notif.id);
    },

    markAsRead(notifId) {
        const notif = this.notifications.find(n => n.id === notifId);
        if (notif) {
            notif.read = true;
            this.saveNotifications();
            this.renderNotificationCenter();
            this.updateBadge();
        }
    },

    dismissNotification(notifId) {
        this.notifications = this.notifications.filter(n => n.id !== notifId);
        this.saveNotifications();
        this.renderNotificationCenter();
        this.updateBadge();
    },

    clearAll() {
        if (confirm('¿Eliminar todas las notificaciones?')) {
            this.notifications = [];
            this.saveNotifications();
            this.renderNotificationCenter();
            this.updateBadge();
        }
    },

    updateBadge() {
        const unread = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    },

    renderNotificationCenter() {
        const container = document.getElementById('notification-center-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔔</div>
                    <div>No hay notificaciones</div>
                </div>
            `;
            return;
        }

        const html = this.notifications.map(notif => {
            const priorityClass = {
                'critical': 'notif-critical',
                'high': 'notif-high',
                'medium': 'notif-medium',
                'low': 'notif-low'
            }[notif.priority] || 'notif-medium';

            const icon = {
                'contract_ending': '📅',
                'vacation_upcoming': '🏖️',
                'it_uncovered': '🚨',
                'uncovered': '🔥',
                'audit_reminder': '⭐'
            }[notif.type] || '🔔';

            return `
                <div class="notification-item ${priorityClass} ${notif.read ? 'read' : 'unread'}" data-id="${notif.id}">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-content">
                        <div class="notif-title">${notif.title}</div>
                        <div class="notif-message">${notif.message}</div>
                        <div class="notif-detail">${notif.detail}</div>
                        <div class="notif-time">${this.formatTime(notif.timestamp)}</div>
                    </div>
                    <div class="notif-actions">
                        ${notif.action ? `<button class="btn-notif-action" onclick="NotificationsEngine.handleNotificationAction(NotificationsEngine.notifications.find(n => n.id === '${notif.id}'))">Acción</button>` : ''}
                        <button class="btn-notif-dismiss" onclick="NotificationsEngine.dismissNotification('${notif.id}')" title="Descartar">×</button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        this.updateBadge();
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `Hace ${minutes}m`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    },

    // Utilidades de conversión de fechas
    excelDateToJS(excelDate) {
        if (!excelDate) return null;
        // Excel date: días desde 1900-01-01
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date;
    },

    parseVacationDate(vacString) {
        if (!vacString) return null;
        // Formato: "28/07 al 31/08"
        const match = vacString.match(/(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const year = new Date().getFullYear();
            return new Date(year, month, day);
        }
        return null;
    },

    toggleNotificationCenter() {
        const panel = document.getElementById('notification-center-panel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }
};

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationsEngine.init());
} else {
    NotificationsEngine.init();
}
