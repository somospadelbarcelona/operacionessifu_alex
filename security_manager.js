/**
 * SECURITY MANAGER - Sistema de Roles, Permisos y Seguridad Avanzada
 * Gestiona el control de acceso (RBAC), sesiones y registros de auditoría.
 */

const SecurityManager = {
    currentUser: null,
    roles: {
        'ADMIN': {
            permissions: ['*'], // Acceso total
            label: 'Administrador Sistema',
            color: '#ea4335'
        },
        'MANAGER': {
            permissions: [
                'view_dashboard', 'edit_services', 'view_workers',
                'manage_substitutes', 'view_bi', 'view_ml',
                'export_data', 'send_notifications'
            ],
            label: 'Gestor Operativo',
            color: '#fbbc04'
        },
        'WORKER': {
            permissions: ['view_dashboard', 'view_own_services', 'chat_internal'],
            label: 'Trabajador SIFU',
            color: '#34a853'
        },
        'VIEWER': {
            permissions: ['view_dashboard', 'view_bi'],
            label: 'Consultor / Cliente',
            color: '#4285f4'
        }
    },
    auditLogs: [],

    init() {
        console.log('🔒 Inicializando Security Manager...');
        this.loadSession();
        this.applySecurityFilters();
        this.loadAuditLogs();
    },

    // ========================================
    // GESTIÓN DE SESIÓN Y LOGIN
    // ========================================

    async login(email, password) {
        // En un entorno real, esto llamaría al backend de la Fase 6
        // Para la demo, simulamos validación de roles basada en el email
        let role = 'VIEWER';
        if (email.includes('admin')) role = 'ADMIN';
        else if (email.includes('gestor')) role = 'MANAGER';
        else if (email.includes('backup')) role = 'WORKER';

        const user = {
            id: 'u_' + Math.random().toString(36).substr(2, 9),
            name: email.split('@')[0].toUpperCase(),
            email: email,
            role: role,
            loginTime: new Date().toISOString()
        };

        this.currentUser = user;
        localStorage.setItem('sifu_session_v1', JSON.stringify(user));

        this.logActivity('LOGIN', `Usuario ${user.name} inició sesión como ${role}`);
        this.applySecurityFilters();

        if (typeof showToast === 'function') {
            showToast(`Bienvenido, ${user.name} (${role})`, 'success');
        }

        return true;
    },

    logout() {
        if (this.currentUser) {
            this.logActivity('LOGOUT', `Usuario ${this.currentUser.name} cerró sesión`);
        }
        this.currentUser = null;
        localStorage.removeItem('sifu_session_v1');
        window.location.reload(); // Recargar para limpiar estado
    },

    loadSession() {
        const saved = localStorage.getItem('sifu_session_v1');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
            } catch (e) {
                this.currentUser = null;
            }
        }
    },

    // ========================================
    // CONTROL DE ACCESO (RBAC)
    // ========================================

    hasPermission(permission) {
        if (!this.currentUser) return false;
        const roleData = this.roles[this.currentUser.role];
        if (!roleData) return false;

        return roleData.permissions.includes('*') || roleData.permissions.includes(permission);
    },

    applySecurityFilters() {
        console.log('🔐 Aplicando filtros de seguridad UI...');

        // Elementos protegidos por data-permission
        const protectedElements = document.querySelectorAll('[data-permission]');
        protectedElements.forEach(el => {
            const permission = el.getAttribute('data-permission');
            if (!this.hasPermission(permission)) {
                el.style.display = 'none';
                el.classList.add('security-hidden');
            } else {
                el.style.display = '';
                el.classList.remove('security-hidden');
            }
        });

        // Bloqueo de secciones enteras si no hay sesión
        const authRequiredElements = document.querySelectorAll('.auth-required');
        authRequiredElements.forEach(el => {
            if (!this.currentUser) {
                el.classList.add('blur-content');
                // Podríamos mostrar un overlay de login aquí
            } else {
                el.classList.remove('blur-content');
            }
        });

        this.updateUserUI();
    },

    updateUserUI() {
        const userBadge = document.getElementById('user-security-badge');
        if (userBadge && this.currentUser) {
            const roleInfo = this.roles[this.currentUser.role];
            userBadge.innerHTML = `
                <div class="user-info-pill" style="border-left: 4px solid ${roleInfo.color}">
                    <span class="user-name">${this.currentUser.name}</span>
                    <span class="user-role-label" style="color: ${roleInfo.color}">${roleInfo.label}</span>
                </div>
            `;
        }
    },

    // ========================================
    // REGISTRO DE AUDITORÍA (AUDIT LOGS)
    // ========================================

    logActivity(action, details) {
        const log = {
            timestamp: new Date().toISOString(),
            userId: this.currentUser ? this.currentUser.id : 'anonymous',
            userName: this.currentUser ? this.currentUser.name : 'Sistema',
            role: this.currentUser ? this.currentUser.role : 'None',
            action: action,
            details: details,
            ip: '127.0.0.1' // Simulado
        };

        this.auditLogs.unshift(log);
        this.saveAuditLogs();

        // Enviar a consola de seguridad
        console.warn(`[AUDIT] ${log.action}: ${log.details}`);
    },

    loadAuditLogs() {
        const saved = localStorage.getItem('sifu_audit_logs_v1');
        if (saved) {
            try {
                this.auditLogs = JSON.parse(saved);
            } catch (e) {
                this.auditLogs = [];
            }
        }
    },

    saveAuditLogs() {
        // Mantener solo los últimos 200 logs
        if (this.auditLogs.length > 200) {
            this.auditLogs = this.auditLogs.slice(0, 200);
        }
        localStorage.setItem('sifu_audit_logs_v1', JSON.stringify(this.auditLogs));
    },

    // ========================================
    // RENDERIZADO PANEL SEGURIDAD
    // ========================================

    renderSecurityDashboard() {
        const container = document.getElementById('security-dashboard-container');
        if (!container) return;

        if (!this.hasPermission('*')) {
            container.innerHTML = '<div class="access-denied">🚫 ACCESO DENEGADO: Requiere permisos de Administrador</div>';
            return;
        }

        container.innerHTML = `
            <div class="security-grid">
                <div class="security-card audit-trail">
                    <h3>📜 Registro de Auditoría (Audit Log)</h3>
                    <div class="audit-list">
                        ${this.auditLogs.map(log => `
                            <div class="audit-item">
                                <span class="audit-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span class="audit-user"><strong>${log.userName}</strong></span>
                                <span class="audit-action">${log.action}</span>
                                <span class="audit-details">${log.details}</span>
                            </div>
                        `).join('') || '<p class="empty-state">No hay actividad registrada</p>'}
                    </div>
                </div>

                <div class="security-card permissions-matrix">
                    <h3>🔑 Matriz de Permisos</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Permiso</th>
                                <th>Admin</th>
                                <th>Manager</th>
                                <th>Worker</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.getPermissionsList().map(p => `
                                <tr>
                                    <td>${p}</td>
                                    <td>✅</td>
                                    <td>${this.roles.MANAGER.permissions.includes(p) ? '✅' : '❌'}</td>
                                    <td>${this.roles.WORKER.permissions.includes(p) ? '✅' : '❌'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    getPermissionsList() {
        // Lista única de permisos usados en el sistema
        const allPermissions = new Set();
        Object.values(this.roles).forEach(r => {
            r.permissions.forEach(p => {
                if (p !== '*') allPermissions.add(p);
            });
        });
        return Array.from(allPermissions);
    }
};

// Exportar
window.SecurityManager = SecurityManager;

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => SecurityManager.init());
