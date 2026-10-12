/**
 * DAILY CHECKLIST - Sistema de Checklist Diario Automatizado
 * Genera tareas diarias basadas en el estado operativo
 */

const DailyChecklist = {
    tasks: [],
    completedToday: [],

    init() {
        console.log('✅ Inicializando Checklist Diario...');
        this.loadTasks();
        this.generateDailyTasks();
        this.render();
    },

    loadTasks() {
        const saved = localStorage.getItem('sifu_daily_tasks_v1');
        const savedDate = localStorage.getItem('sifu_tasks_date');
        const today = new Date().toDateString();

        if (saved && savedDate === today) {
            this.tasks = JSON.parse(saved);
        } else {
            // Nuevo día, resetear
            this.tasks = [];
            localStorage.removeItem('sifu_daily_tasks_v1');
        }

        const completed = localStorage.getItem('sifu_completed_tasks_v1');
        if (completed) {
            this.completedToday = JSON.parse(completed);
        }
    },

    saveTasks() {
        const today = new Date().toDateString();
        localStorage.setItem('sifu_daily_tasks_v1', JSON.stringify(this.tasks));
        localStorage.setItem('sifu_tasks_date', today);
        localStorage.setItem('sifu_completed_tasks_v1', JSON.stringify(this.completedToday));
    },

    generateDailyTasks() {
        if (!window.state || !window.state.masterData) return;

        const today = new Date();
        const tasks = [];

        // 1. REVISAR DESCUBIERTOS
        const descubiertos = window.state.masterData.filter(s => s.ESTADO === 'DESCUBIERTO');
        if (descubiertos.length > 0) {
            tasks.push({
                id: 'review_uncovered',
                category: 'urgent',
                title: `Revisar ${descubiertos.length} servicio${descubiertos.length > 1 ? 's' : ''} descubierto${descubiertos.length > 1 ? 's' : ''}`,
                description: 'Asignar titulares o suplentes',
                priority: 'critical',
                estimatedTime: descubiertos.length * 5,
                action: () => {
                    if (typeof switchTab === 'function') switchTab('descubiertos');
                }
            });
        }

        // 2. CONFIRMAR SUPLENTES PARA MAÑANA
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const needConfirmation = window.state.masterData.filter(s => {
            if (!s['VACACIONES 2026']) return false;
            const vacStart = this.parseVacationDate(s['VACACIONES 2026']);
            if (!vacStart) return false;
            const diff = Math.ceil((vacStart - today) / (1000 * 60 * 60 * 24));
            return diff === 1 && (!s.SUPLENTE || s.SUPLENTE === 'EMERGENCIAS');
        });

        if (needConfirmation.length > 0) {
            tasks.push({
                id: 'confirm_suplentes',
                category: 'planning',
                title: `Confirmar ${needConfirmation.length} suplente${needConfirmation.length > 1 ? 's' : ''} para mañana`,
                description: 'Vacaciones que inician mañana',
                priority: 'high',
                estimatedTime: needConfirmation.length * 3,
                action: () => {
                    alert('Lista de servicios que requieren confirmación:\n\n' +
                        needConfirmation.map(s => `• ${s.TITULAR} - ${s.SERVICIO}`).join('\n'));
                }
            });
        }

        // 3. LLAMAR A TRABAJADORES CON CONTRATOS PRÓXIMOS A VENCER
        const contractsEnding = window.state.masterData.filter(s => {
            if (!s['FIN CONTRATO']) return false;
            const endDate = this.excelDateToJS(s['FIN CONTRATO']);
            const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            return daysUntil > 0 && daysUntil <= 7;
        });

        if (contractsEnding.length > 0) {
            tasks.push({
                id: 'call_contracts',
                category: 'administrative',
                title: `Contactar ${contractsEnding.length} trabajador${contractsEnding.length > 1 ? 'es' : ''} por renovación`,
                description: 'Contratos que terminan en 7 días o menos',
                priority: 'high',
                estimatedTime: contractsEnding.length * 10,
                action: () => {
                    const list = contractsEnding.map(s => {
                        const endDate = this.excelDateToJS(s['FIN CONTRATO']);
                        const days = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                        return `• ${s.TITULAR} - Termina en ${days} día${days > 1 ? 's' : ''}`;
                    }).join('\n');
                    alert('Trabajadores a contactar:\n\n' + list);
                }
            });
        }

        // 4. REVISAR BAJAS IT SIN SUPLENTE
        const itUncovered = window.state.masterData.filter(s =>
            s.ESTADO1 === 'BAJA IT' && (!s.SUPLENTE || s.SUPLENTE === 'EMERGENCIAS')
        );

        if (itUncovered.length > 0) {
            tasks.push({
                id: 'review_it',
                category: 'urgent',
                title: `Gestionar ${itUncovered.length} baja${itUncovered.length > 1 ? 's' : ''} IT sin cobertura`,
                description: 'Asignar suplentes urgentes',
                priority: 'critical',
                estimatedTime: itUncovered.length * 8,
                action: () => {
                    if (typeof switchTab === 'function') switchTab('abonos');
                }
            });
        }

        // 5. SINCRONIZAR DATOS MASTER
        const lastSync = localStorage.getItem('last_master_sync');
        const hoursSinceSync = lastSync ? (today - new Date(lastSync)) / (1000 * 60 * 60) : 999;

        if (hoursSinceSync > 4) {
            tasks.push({
                id: 'sync_master',
                category: 'maintenance',
                title: 'Sincronizar datos con Excel Master',
                description: `Última sincronización: ${lastSync ? new Date(lastSync).toLocaleString('es-ES') : 'Nunca'}`,
                priority: 'medium',
                estimatedTime: 2,
                action: () => {
                    const btn = document.getElementById('btn-load-master');
                    if (btn) btn.click();
                }
            });
        }

        // 6. REALIZAR AUDITORÍA DE CALIDAD (si no se ha hecho esta semana)
        const lastAudit = localStorage.getItem('last_quality_audit_date');
        const daysSinceAudit = lastAudit ? Math.ceil((today - new Date(lastAudit)) / (1000 * 60 * 60 * 24)) : 999;

        if (daysSinceAudit >= 7) {
            tasks.push({
                id: 'quality_audit',
                category: 'quality',
                title: 'Programar auditorías de calidad',
                description: `Última auditoría hace ${daysSinceAudit} días`,
                priority: 'medium',
                estimatedTime: 30,
                action: () => {
                    if (typeof switchTab === 'function') switchTab('calidad');
                }
            });
        }

        // Filtrar tareas ya completadas hoy
        const newTasks = tasks.filter(t => !this.completedToday.includes(t.id));
        this.tasks = newTasks;
        this.saveTasks();
    },

    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = true;
            task.completedAt = new Date().toISOString();
            this.completedToday.push(taskId);
            this.saveTasks();
            this.render();

            // Mostrar feedback
            this.showToast(`✅ Tarea completada: ${task.title}`);
        }
    },

    uncompleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = false;
            delete task.completedAt;
            this.completedToday = this.completedToday.filter(id => id !== taskId);
            this.saveTasks();
            this.render();
        }
    },

    addCustomTask(title, description = '') {
        const task = {
            id: `custom_${Date.now()}`,
            category: 'custom',
            title: title,
            description: description,
            priority: 'medium',
            estimatedTime: 15,
            custom: true
        };
        this.tasks.push(task);
        this.saveTasks();
        this.render();
    },

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.completedToday = this.completedToday.filter(id => id !== taskId);
        this.saveTasks();
        this.render();
    },

    render() {
        const container = document.getElementById('checklist-container');
        if (!container) return;

        const pending = this.tasks.filter(t => !t.completed);
        const completed = this.tasks.filter(t => t.completed);
        const totalTime = pending.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        const html = `
            <div class="checklist-header">
                <div class="checklist-stats">
                    <div class="stat">
                        <span class="stat-value">${pending.length}</span>
                        <span class="stat-label">Pendientes</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${completed.length}</span>
                        <span class="stat-label">Completadas</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${totalTime}min</span>
                        <span class="stat-label">Tiempo Est.</span>
                    </div>
                </div>
                <button class="btn-add-task" onclick="DailyChecklist.promptAddTask()">
                    ➕ Añadir Tarea
                </button>
            </div>

            ${pending.length === 0 && completed.length === 0 ? `
                <div class="empty-state">
                    <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                    <div>No hay tareas para hoy</div>
                    <button class="btn-secondary" onclick="DailyChecklist.generateDailyTasks(); DailyChecklist.render();" style="margin-top: 15px;">
                        🔄 Generar Tareas
                    </button>
                </div>
            ` : ''}

            ${pending.length > 0 ? `
                <div class="tasks-section">
                    <h4>📋 Tareas Pendientes</h4>
                    ${pending.map(task => this.renderTask(task)).join('')}
                </div>
            ` : ''}

            ${completed.length > 0 ? `
                <div class="tasks-section completed-section">
                    <h4>✅ Completadas Hoy</h4>
                    ${completed.map(task => this.renderTask(task)).join('')}
                </div>
            ` : ''}
        `;

        container.innerHTML = html;
    },

    renderTask(task) {
        const priorityColors = {
            critical: '#ea4335',
            high: '#fbbc04',
            medium: '#4285f4',
            low: '#34a853'
        };

        const categoryIcons = {
            urgent: '🚨',
            planning: '📅',
            administrative: '📋',
            maintenance: '🔧',
            quality: '⭐',
            custom: '📝'
        };

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-priority="${task.priority}">
                <div class="task-checkbox">
                    <input type="checkbox" 
                           ${task.completed ? 'checked' : ''} 
                           onchange="DailyChecklist.${task.completed ? 'uncompleteTask' : 'completeTask'}('${task.id}')">
                </div>
                <div class="task-content">
                    <div class="task-header">
                        <span class="task-category">${categoryIcons[task.category] || '📝'}</span>
                        <span class="task-title">${task.title}</span>
                        ${task.estimatedTime ? `<span class="task-time">⏱️ ${task.estimatedTime}min</span>` : ''}
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    ${task.completedAt ? `<div class="task-completed-time">Completada: ${new Date(task.completedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                </div>
                <div class="task-actions">
                    <div class="task-priority-indicator" style="background: ${priorityColors[task.priority]};"></div>
                    ${task.action && !task.completed ? `
                        <button class="btn-task-action" onclick="DailyChecklist.tasks.find(t => t.id === '${task.id}').action()" title="Ir a acción">
                            →
                        </button>
                    ` : ''}
                    ${task.custom ? `
                        <button class="btn-task-delete" onclick="DailyChecklist.deleteTask('${task.id}')" title="Eliminar">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    promptAddTask() {
        const title = prompt('Título de la tarea:');
        if (title) {
            const description = prompt('Descripción (opcional):');
            this.addCustomTask(title, description || '');
        }
    },

    showToast(message) {
        if (typeof showToast === 'function') {
            showToast(message);
        } else {
            console.log(message);
        }
    },

    // Utilidades
    excelDateToJS(excelDate) {
        if (!excelDate) return null;
        return new Date((excelDate - 25569) * 86400 * 1000);
    },

    parseVacationDate(vacString) {
        if (!vacString) return null;
        const match = vacString.match(/(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const year = new Date().getFullYear();
            return new Date(year, month, day);
        }
        return null;
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DailyChecklist.init());
} else {
    DailyChecklist.init();
}
