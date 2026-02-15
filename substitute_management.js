/**
 * SUBSTITUTE MANAGEMENT - Gestión Avanzada de Suplencias
 * Sistema completo para gestionar suplentes con matching inteligente
 */

const SubstituteManagement = {
    substitutes: [],
    assignments: [],
    availabilityPool: {},

    init() {
        console.log('🔄 Inicializando Gestión de Suplencias...');
        this.loadData();
        this.buildAvailabilityPool();
        this.loadAssignments();
    },

    loadData() {
        const saved = localStorage.getItem('sifu_substitutes_v1');
        if (saved) {
            this.substitutes = JSON.parse(saved);
        }
    },

    saveData() {
        localStorage.setItem('sifu_substitutes_v1', JSON.stringify(this.substitutes));
        localStorage.setItem('sifu_substitute_assignments_v1', JSON.stringify(this.assignments));
    },

    loadAssignments() {
        const saved = localStorage.getItem('sifu_substitute_assignments_v1');
        if (saved) {
            this.assignments = JSON.parse(saved);
        }
    },

    // CONSTRUIR POOL DE DISPONIBILIDAD
    buildAvailabilityPool() {
        if (!window.state || !window.state.masterData) return;

        const pool = {};

        window.state.masterData.forEach(service => {
            const titular = service.TITULAR;
            if (!titular) return;

            // Solo incluir trabajadores activos (no en baja IT ni vacaciones)
            const isAvailable = service.ESTADO === 'CUBIERTO' &&
                !service.ESTADO1 &&
                service.ESTADO1 !== 'BAJA IT' &&
                service.ESTADO1 !== 'VACACIONES';

            if (!pool[titular]) {
                pool[titular] = {
                    name: titular,
                    available: isAvailable,
                    currentServices: [],
                    serviceTypes: new Set(),
                    locations: new Set(),
                    schedule: [],
                    capacity: 0
                };
            }

            const worker = pool[titular];

            // Agregar servicio actual
            worker.currentServices.push({
                servicio: service.SERVICIO,
                tipo: service['TIPO S'],
                horario: service.HORARIO
            });

            // Tipos de servicio
            if (service['TIPO S']) {
                worker.serviceTypes.add(service['TIPO S']);
            }

            // Ubicaciones
            const location = this.extractLocation(service.SERVICIO);
            if (location) {
                worker.locations.add(location);
            }

            // Horarios
            if (service.HORARIO) {
                worker.schedule.push(service.HORARIO);
            }

            // Calcular capacidad (máximo 5 servicios)
            worker.capacity = Math.max(0, 5 - worker.currentServices.length);
        });

        // Convertir Sets a Arrays
        Object.values(pool).forEach(worker => {
            worker.serviceTypes = Array.from(worker.serviceTypes);
            worker.locations = Array.from(worker.locations);
        });

        this.availabilityPool = pool;
        console.log('👥 Pool de disponibilidad construido:', Object.keys(pool).length, 'trabajadores');
    },

    // ENCONTRAR MEJORES SUPLENTES PARA UN SERVICIO
    findBestSubstitutes(service, count = 5) {
        const candidates = [];
        const serviceLocation = this.extractLocation(service.SERVICIO);
        const serviceType = service['TIPO S'];

        Object.values(this.availabilityPool).forEach(worker => {
            // Excluir al titular actual
            if (worker.name === service.TITULAR) return;

            // Solo trabajadores disponibles
            if (!worker.available) return;

            // Calcular score de compatibilidad
            const score = this.calculateCompatibilityScore(worker, service, serviceLocation, serviceType);

            if (score.total > 30) {
                candidates.push({
                    worker: worker.name,
                    totalScore: score.total,
                    breakdown: score.breakdown,
                    capacity: worker.capacity,
                    currentServices: worker.currentServices.length,
                    data: worker
                });
            }
        });

        // Ordenar por score descendente
        candidates.sort((a, b) => b.totalScore - a.totalScore);

        return candidates.slice(0, count);
    },

    calculateCompatibilityScore(worker, service, serviceLocation, serviceType) {
        const breakdown = {};
        let total = 0;

        // 1. EXPERIENCIA EN TIPO DE SERVICIO (35 puntos)
        if (worker.serviceTypes.includes(serviceType)) {
            breakdown.experience = 35;
            total += 35;
        } else {
            breakdown.experience = 0;
        }

        // 2. PROXIMIDAD GEOGRÁFICA (30 puntos)
        if (serviceLocation) {
            const proximity = this.calculateProximity(worker.locations, serviceLocation);
            breakdown.proximity = Math.round(proximity * 30);
            total += breakdown.proximity;
        } else {
            breakdown.proximity = 0;
        }

        // 3. CAPACIDAD DISPONIBLE (20 puntos)
        if (worker.capacity >= 2) {
            breakdown.capacity = 20;
            total += 20;
        } else if (worker.capacity === 1) {
            breakdown.capacity = 10;
            total += 10;
        } else {
            breakdown.capacity = 0;
        }

        // 4. COMPATIBILIDAD HORARIA (15 puntos)
        const scheduleCompatibility = this.checkScheduleCompatibility(worker.schedule, service.HORARIO);
        breakdown.schedule = Math.round(scheduleCompatibility * 15);
        total += breakdown.schedule;

        return { total: Math.round(total), breakdown };
    },

    calculateProximity(workerLocations, serviceLocation) {
        if (!serviceLocation || workerLocations.length === 0) return 0;

        // Verificar si trabaja en la misma ubicación
        if (workerLocations.includes(serviceLocation)) return 1;

        // Verificar ubicaciones cercanas (simplificado)
        const nearbyPairs = {
            'Barcelona': ['Badalona', 'Hospitalet', 'Cornellà', 'Sant Adrià'],
            'Badalona': ['Barcelona', 'Sant Adrià'],
            'Cornellà': ['Barcelona', 'Hospitalet', 'Esplugues'],
            'Hospitalet': ['Barcelona', 'Cornellà', 'Esplugues']
        };

        for (const workerLoc of workerLocations) {
            if (nearbyPairs[workerLoc]?.includes(serviceLocation) ||
                nearbyPairs[serviceLocation]?.includes(workerLoc)) {
                return 0.7;
            }
        }

        return 0.3; // Ubicación lejana pero posible
    },

    checkScheduleCompatibility(workerSchedules, serviceSchedule) {
        if (!serviceSchedule || workerSchedules.length === 0) return 0.5;

        // Extraer horarios (simplificado)
        const serviceHours = this.extractHours(serviceSchedule);

        for (const schedule of workerSchedules) {
            const workerHours = this.extractHours(schedule);

            // Verificar si hay solapamiento
            if (this.hasOverlap(workerHours, serviceHours)) {
                return 0; // Conflicto de horario
            }
        }

        return 1; // Sin conflictos
    },

    extractHours(schedule) {
        if (!schedule) return null;

        // Extraer horas del formato "L A V DE 6:30 A 9:30"
        const match = schedule.match(/(\d{1,2}):?(\d{2})?\s*A\s*(\d{1,2}):?(\d{2})?/i);
        if (match) {
            const startHour = parseInt(match[1]);
            const endHour = parseInt(match[3]);
            return { start: startHour, end: endHour };
        }
        return null;
    },

    hasOverlap(hours1, hours2) {
        if (!hours1 || !hours2) return false;

        return (hours1.start < hours2.end && hours1.end > hours2.start);
    },

    // ASIGNAR SUPLENTE
    assignSubstitute(service, substituteName, temporary = true) {
        const assignment = {
            id: `assign_${Date.now()}`,
            service: service.SERVICIO,
            proyecto: service.PROYECTO,
            originalTitular: service.TITULAR,
            substitute: substituteName,
            assignedDate: new Date().toISOString(),
            temporary: temporary,
            status: 'active',
            notes: ''
        };

        this.assignments.push(assignment);
        this.saveData();

        console.log('✅ Suplente asignado:', substituteName, 'para', service.SERVICIO);

        // Actualizar disponibilidad
        this.buildAvailabilityPool();

        return assignment;
    },

    // CONFIRMAR SUPLENCIA
    confirmSubstitution(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (assignment) {
            assignment.status = 'confirmed';
            assignment.confirmedDate = new Date().toISOString();
            this.saveData();
        }
    },

    // FINALIZAR SUPLENCIA
    endSubstitution(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (assignment) {
            assignment.status = 'completed';
            assignment.endDate = new Date().toISOString();
            this.saveData();
            this.buildAvailabilityPool();
        }
    },

    // RENDERIZAR INTERFAZ DE SUPLENCIAS
    renderSubstituteManager() {
        const container = document.getElementById('substitute-manager-container');
        if (!container) return;

        const uncoveredServices = window.state?.masterData?.filter(s => s.ESTADO === 'DESCUBIERTO') || [];
        const itServices = window.state?.masterData?.filter(s =>
            s.ESTADO1 === 'BAJA IT' && (!s.SUPLENTE || s.SUPLENTE === 'EMERGENCIAS')
        ) || [];

        const needsSubstitute = [...uncoveredServices, ...itServices];

        const html = `
            <div class="substitute-manager-header">
                <h3>🔄 Gestión de Suplencias</h3>
                <div class="substitute-stats">
                    <div class="stat-badge">
                        <span class="stat-value">${needsSubstitute.length}</span>
                        <span class="stat-label">Requieren Suplente</span>
                    </div>
                    <div class="stat-badge">
                        <span class="stat-value">${Object.values(this.availabilityPool).filter(w => w.available && w.capacity > 0).length}</span>
                        <span class="stat-label">Disponibles</span>
                    </div>
                    <div class="stat-badge">
                        <span class="stat-value">${this.assignments.filter(a => a.status === 'active').length}</span>
                        <span class="stat-label">Activas</span>
                    </div>
                </div>
            </div>

            <div class="substitute-sections">
                ${needsSubstitute.length > 0 ? `
                    <div class="substitute-section">
                        <h4>🚨 Servicios que Requieren Suplente</h4>
                        <div class="services-needing-substitute">
                            ${needsSubstitute.map(service => this.renderServiceNeedingSubstitute(service)).join('')}
                        </div>
                    </div>
                ` : '<div class="empty-state">✅ Todos los servicios tienen cobertura</div>'}

                ${this.assignments.filter(a => a.status === 'active').length > 0 ? `
                    <div class="substitute-section">
                        <h4>📋 Suplencias Activas</h4>
                        <div class="active-substitutions">
                            ${this.assignments.filter(a => a.status === 'active').map(a => this.renderActiveSubstitution(a)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;
    },

    renderServiceNeedingSubstitute(service) {
        const suggestions = this.findBestSubstitutes(service, 3);

        return `
            <div class="service-substitute-card">
                <div class="service-info">
                    <div class="service-name">${service.SERVICIO}</div>
                    <div class="service-meta">
                        <span class="service-type">${service['TIPO S'] || 'N/A'}</span>
                        ${service.HORARIO ? `<span class="service-schedule">⏰ ${service.HORARIO}</span>` : ''}
                    </div>
                    ${service.TITULAR ? `<div class="service-titular">Titular: ${service.TITULAR}</div>` : ''}
                </div>

                <div class="substitute-suggestions">
                    <div class="suggestions-header">💡 Mejores Candidatos:</div>
                    ${suggestions.length > 0 ? suggestions.map((sug, idx) => `
                        <div class="suggestion-candidate">
                            <div class="candidate-rank">#${idx + 1}</div>
                            <div class="candidate-info">
                                <div class="candidate-name">${sug.worker}</div>
                                <div class="candidate-score">
                                    <span class="score-badge">${sug.totalScore}/100</span>
                                    <span class="score-details">
                                        ${sug.breakdown.experience > 0 ? '✓ Experiencia ' : ''}
                                        ${sug.breakdown.proximity > 20 ? '✓ Cerca ' : ''}
                                        ${sug.breakdown.capacity > 0 ? '✓ Disponible' : ''}
                                    </span>
                                </div>
                            </div>
                            <button class="btn-assign-substitute" 
                                    onclick="SubstituteManagement.promptAssignment('${service.PROYECTO}', '${sug.worker}')">
                                Asignar
                            </button>
                        </div>
                    `).join('') : '<div class="no-suggestions">No hay candidatos disponibles</div>'}
                </div>
            </div>
        `;
    },

    renderActiveSubstitution(assignment) {
        const daysSince = Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24));

        return `
            <div class="active-substitution-card">
                <div class="substitution-info">
                    <div class="substitution-service">${assignment.service}</div>
                    <div class="substitution-details">
                        <span>Suplente: <strong>${assignment.substitute}</strong></span>
                        <span>Original: ${assignment.originalTitular}</span>
                        <span>Hace ${daysSince} día${daysSince > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="substitution-actions">
                    ${assignment.status === 'active' ? `
                        <button class="btn-confirm" onclick="SubstituteManagement.confirmSubstitution('${assignment.id}')">
                            ✓ Confirmar
                        </button>
                    ` : ''}
                    <button class="btn-end" onclick="SubstituteManagement.endSubstitution('${assignment.id}')">
                        Finalizar
                    </button>
                </div>
            </div>
        `;
    },

    promptAssignment(proyecto, substituteName) {
        const service = window.state?.masterData?.find(s => s.PROYECTO === proyecto);
        if (!service) return;

        const confirmed = confirm(
            `¿Asignar a ${substituteName} como suplente de:\n\n` +
            `${service.SERVICIO}\n` +
            `Titular: ${service.TITULAR || 'N/A'}\n\n` +
            `¿Continuar?`
        );

        if (confirmed) {
            this.assignSubstitute(service, substituteName);
            this.renderSubstituteManager();

            if (typeof showToast === 'function') {
                showToast(`✅ ${substituteName} asignado como suplente`);
            }
        }
    },

    extractLocation(serviceName) {
        if (!serviceName) return null;
        const match = serviceName.match(/\(([^)]+)\)/);
        return match ? match[1].trim() : null;
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SubstituteManagement.init());
} else {
    SubstituteManagement.init();
}
