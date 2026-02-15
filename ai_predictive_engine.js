/**
 * AI PREDICTIVE ENGINE - Motor de Inteligencia Artificial Predictivo
 * Predice descubiertos, sugiere suplentes y optimiza asignaciones
 */

const AIPredictiveEngine = {
    predictions: [],
    recommendations: [],
    workerProfiles: {},
    serviceProfiles: {},

    init() {
        console.log('🤖 Inicializando Motor de IA Predictivo...');
        this.loadProfiles();
        this.buildWorkerProfiles();
        this.buildServiceProfiles();
        this.generatePredictions();
        this.generateRecommendations();
    },

    loadProfiles() {
        const savedWorkers = localStorage.getItem('sifu_worker_profiles_v1');
        const savedServices = localStorage.getItem('sifu_service_profiles_v1');

        if (savedWorkers) this.workerProfiles = JSON.parse(savedWorkers);
        if (savedServices) this.serviceProfiles = JSON.parse(savedServices);
    },

    saveProfiles() {
        localStorage.setItem('sifu_worker_profiles_v1', JSON.stringify(this.workerProfiles));
        localStorage.setItem('sifu_service_profiles_v1', JSON.stringify(this.serviceProfiles));
    },

    // CONSTRUCCIÓN DE PERFILES DE TRABAJADORES
    buildWorkerProfiles() {
        if (!window.state || !window.state.masterData) return;

        window.state.masterData.forEach(service => {
            const titular = service.TITULAR;
            if (!titular) return;

            if (!this.workerProfiles[titular]) {
                this.workerProfiles[titular] = {
                    name: titular,
                    services: [],
                    serviceTypes: new Set(),
                    locations: new Set(),
                    totalServices: 0,
                    itHistory: [],
                    vacationHistory: [],
                    reliability: 100, // Score 0-100
                    lastUpdated: new Date().toISOString()
                };
            }

            const profile = this.workerProfiles[titular];

            // Agregar servicio
            if (!profile.services.find(s => s.proyecto === service.PROYECTO)) {
                profile.services.push({
                    proyecto: service.PROYECTO,
                    servicio: service.SERVICIO,
                    tipo: service['TIPO S'],
                    horario: service.HORARIO,
                    estado: service.ESTADO
                });
                profile.totalServices++;
            }

            // Agregar tipo de servicio
            if (service['TIPO S']) {
                profile.serviceTypes.add(service['TIPO S']);
            }

            // Extraer ubicación del servicio
            const location = this.extractLocation(service.SERVICIO);
            if (location) {
                profile.locations.add(location);
            }

            // Historial de bajas IT
            if (service.ESTADO1 === 'BAJA IT') {
                profile.itHistory.push({
                    date: new Date().toISOString(),
                    servicio: service.SERVICIO,
                    suplente: service.SUPLENTE
                });
                // Reducir reliability si tiene muchas bajas
                if (profile.itHistory.length > 2) {
                    profile.reliability = Math.max(50, 100 - (profile.itHistory.length * 10));
                }
            }

            // Historial de vacaciones
            if (service['VACACIONES 2026']) {
                profile.vacationHistory.push({
                    period: service['VACACIONES 2026'],
                    servicio: service.SERVICIO
                });
            }
        });

        // Convertir Sets a Arrays para serialización
        Object.values(this.workerProfiles).forEach(profile => {
            profile.serviceTypes = Array.from(profile.serviceTypes);
            profile.locations = Array.from(profile.locations);
        });

        this.saveProfiles();
        console.log('👥 Perfiles de trabajadores construidos:', Object.keys(this.workerProfiles).length);
    },

    // CONSTRUCCIÓN DE PERFILES DE SERVICIOS
    buildServiceProfiles() {
        if (!window.state || !window.state.masterData) return;

        window.state.masterData.forEach(service => {
            const proyecto = service.PROYECTO;
            if (!proyecto) return;

            if (!this.serviceProfiles[proyecto]) {
                this.serviceProfiles[proyecto] = {
                    proyecto: proyecto,
                    servicio: service.SERVICIO,
                    tipo: service['TIPO S'],
                    location: this.extractLocation(service.SERVICIO),
                    horario: service.HORARIO,
                    titularHistory: [],
                    uncoveredCount: 0,
                    itCount: 0,
                    stability: 100, // Score 0-100
                    lastUpdated: new Date().toISOString()
                };
            }

            const profile = this.serviceProfiles[proyecto];

            // Historial de titulares
            if (service.TITULAR && !profile.titularHistory.find(t => t.name === service.TITULAR)) {
                profile.titularHistory.push({
                    name: service.TITULAR,
                    since: new Date().toISOString()
                });
            }

            // Contar descubiertos
            if (service.ESTADO === 'DESCUBIERTO') {
                profile.uncoveredCount++;
                profile.stability = Math.max(0, 100 - (profile.uncoveredCount * 20));
            }

            // Contar bajas IT
            if (service.ESTADO1 === 'BAJA IT') {
                profile.itCount++;
            }

            // Reducir estabilidad si hay mucha rotación
            if (profile.titularHistory.length > 3) {
                profile.stability = Math.max(0, profile.stability - ((profile.titularHistory.length - 3) * 10));
            }
        });

        this.saveProfiles();
        console.log('🏢 Perfiles de servicios construidos:', Object.keys(this.serviceProfiles).length);
    },

    // PREDICCIÓN DE DESCUBIERTOS
    generatePredictions() {
        this.predictions = [];

        if (!window.state || !window.state.masterData) return;

        const today = new Date();
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);
        const in14Days = new Date(today);
        in14Days.setDate(in14Days.getDate() + 14);

        window.state.masterData.forEach(service => {
            // PREDICCIÓN 1: Contratos que terminan pronto
            if (service['FIN CONTRATO']) {
                const endDate = this.excelDateToJS(service['FIN CONTRATO']);
                if (endDate && endDate >= today && endDate <= in14Days) {
                    const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                    const riskScore = this.calculateRenewalRisk(service, daysUntil);

                    this.predictions.push({
                        type: 'contract_ending',
                        service: service.SERVICIO,
                        titular: service.TITULAR,
                        daysUntil: daysUntil,
                        riskScore: riskScore,
                        probability: riskScore > 70 ? 'alta' : riskScore > 40 ? 'media' : 'baja',
                        recommendation: this.getContractRecommendation(service, riskScore),
                        data: service
                    });
                }
            }

            // PREDICCIÓN 2: Bajas IT prolongadas
            if (service.ESTADO1 === 'BAJA IT') {
                const extendProbability = this.calculateITExtensionProbability(service);

                if (extendProbability > 50) {
                    this.predictions.push({
                        type: 'it_extension',
                        service: service.SERVICIO,
                        titular: service.TITULAR,
                        probability: extendProbability > 75 ? 'alta' : 'media',
                        recommendation: 'Considerar suplente permanente',
                        data: service
                    });
                }
            }

            // PREDICCIÓN 3: Servicios inestables
            const serviceProfile = this.serviceProfiles[service.PROYECTO];
            if (serviceProfile && serviceProfile.stability < 60) {
                this.predictions.push({
                    type: 'unstable_service',
                    service: service.SERVICIO,
                    stability: serviceProfile.stability,
                    probability: 'media',
                    recommendation: 'Revisar condiciones del servicio y buscar titular estable',
                    data: service
                });
            }
        });

        console.log('🔮 Predicciones generadas:', this.predictions.length);
    },

    // GENERACIÓN DE RECOMENDACIONES INTELIGENTES
    generateRecommendations() {
        this.recommendations = [];

        if (!window.state || !window.state.masterData) return;

        // RECOMENDACIÓN 1: Mejores suplentes para cada descubierto
        const descubiertos = window.state.masterData.filter(s => s.ESTADO === 'DESCUBIERTO');

        descubiertos.forEach(service => {
            const bestMatches = this.findBestSuplentes(service);

            if (bestMatches.length > 0) {
                this.recommendations.push({
                    type: 'suplente_suggestion',
                    priority: 'high',
                    service: service.SERVICIO,
                    suggestions: bestMatches.slice(0, 3), // Top 3
                    data: service
                });
            }
        });

        // RECOMENDACIÓN 2: Optimización de asignaciones
        const optimizations = this.findOptimizationOpportunities();
        this.recommendations.push(...optimizations);

        // RECOMENDACIÓN 3: Trabajadores sobrecargados
        const overloaded = this.findOverloadedWorkers();
        this.recommendations.push(...overloaded);

        console.log('💡 Recomendaciones generadas:', this.recommendations.length);
    },

    // MATCHING INTELIGENTE DE SUPLENTES
    findBestSuplentes(service) {
        const matches = [];
        const serviceLocation = this.extractLocation(service.SERVICIO);
        const serviceType = service['TIPO S'];

        Object.values(this.workerProfiles).forEach(worker => {
            // Excluir al titular actual
            if (worker.name === service.TITULAR) return;

            // Calcular score de compatibilidad
            let score = 0;
            const reasons = [];

            // 1. Experiencia en el tipo de servicio (40 puntos)
            if (worker.serviceTypes.includes(serviceType)) {
                score += 40;
                reasons.push(`Experiencia en ${serviceType}`);
            }

            // 2. Proximidad geográfica (30 puntos)
            if (serviceLocation && worker.locations.some(loc =>
                this.calculateLocationSimilarity(loc, serviceLocation) > 0.7)) {
                score += 30;
                reasons.push(`Trabaja en zona cercana`);
            }

            // 3. Fiabilidad del trabajador (20 puntos)
            score += (worker.reliability / 100) * 20;
            if (worker.reliability > 90) {
                reasons.push('Alta fiabilidad');
            }

            // 4. Disponibilidad (10 puntos)
            const currentServices = worker.services.filter(s => s.estado === 'CUBIERTO').length;
            if (currentServices < 3) {
                score += 10;
                reasons.push('Disponible');
            } else if (currentServices > 5) {
                score -= 10;
                reasons.push('Puede estar sobrecargado');
            }

            // Solo incluir si el score es razonable
            if (score > 30) {
                matches.push({
                    worker: worker.name,
                    score: Math.round(score),
                    reasons: reasons,
                    currentServices: currentServices,
                    reliability: worker.reliability
                });
            }
        });

        // Ordenar por score descendente
        matches.sort((a, b) => b.score - a.score);

        return matches;
    },

    // IDENTIFICAR OPORTUNIDADES DE OPTIMIZACIÓN
    findOptimizationOpportunities() {
        const opportunities = [];

        // Buscar trabajadores con servicios muy dispersos geográficamente
        Object.values(this.workerProfiles).forEach(worker => {
            if (worker.services.length >= 2 && worker.locations.length >= 3) {
                opportunities.push({
                    type: 'route_optimization',
                    priority: 'medium',
                    worker: worker.name,
                    message: `${worker.name} tiene servicios en ${worker.locations.length} ubicaciones diferentes`,
                    recommendation: 'Considerar reagrupar servicios por zona',
                    data: worker
                });
            }
        });

        return opportunities;
    },

    // IDENTIFICAR TRABAJADORES SOBRECARGADOS
    findOverloadedWorkers() {
        const overloaded = [];

        Object.values(this.workerProfiles).forEach(worker => {
            const activeServices = worker.services.filter(s => s.estado === 'CUBIERTO').length;

            if (activeServices > 5) {
                overloaded.push({
                    type: 'worker_overload',
                    priority: 'medium',
                    worker: worker.name,
                    message: `${worker.name} gestiona ${activeServices} servicios`,
                    recommendation: 'Considerar redistribuir carga de trabajo',
                    data: worker
                });
            }
        });

        return overloaded;
    },

    // CÁLCULO DE RIESGO DE NO RENOVACIÓN
    calculateRenewalRisk(service, daysUntil) {
        let risk = 0;

        // Menos días = más riesgo
        if (daysUntil <= 3) risk += 40;
        else if (daysUntil <= 7) risk += 20;

        // Sin suplente preparado = más riesgo
        if (!service.SUPLENTE || service.SUPLENTE === 'EMERGENCIAS') {
            risk += 30;
        }

        // Historial de bajas IT = más riesgo
        const workerProfile = this.workerProfiles[service.TITULAR];
        if (workerProfile && workerProfile.itHistory.length > 1) {
            risk += 20;
        }

        // Servicio inestable = más riesgo
        const serviceProfile = this.serviceProfiles[service.PROYECTO];
        if (serviceProfile && serviceProfile.stability < 70) {
            risk += 10;
        }

        return Math.min(100, risk);
    },

    // PROBABILIDAD DE EXTENSIÓN DE BAJA IT
    calculateITExtensionProbability(service) {
        let probability = 50; // Base 50%

        // Si ya tiene suplente, menos probable que se extienda mucho
        if (service.SUPLENTE && service.SUPLENTE !== 'EMERGENCIAS') {
            probability -= 20;
        }

        // Historial del trabajador
        const workerProfile = this.workerProfiles[service.TITULAR];
        if (workerProfile) {
            // Muchas bajas previas = más probable extensión
            if (workerProfile.itHistory.length > 2) {
                probability += 25;
            }
        }

        return Math.min(100, Math.max(0, probability));
    },

    getContractRecommendation(service, riskScore) {
        if (riskScore > 70) {
            return '🚨 URGENTE: Contactar inmediatamente y preparar suplente';
        } else if (riskScore > 40) {
            return '⚠️ Contactar esta semana para confirmar renovación';
        } else {
            return '✅ Seguimiento normal de renovación';
        }
    },

    // RENDERIZADO DE PREDICCIONES
    renderPredictions() {
        const container = document.getElementById('ai-predictions-container');
        if (!container) return;

        if (this.predictions.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay predicciones en este momento</div>';
            return;
        }

        const html = this.predictions.map(pred => {
            const priorityClass = {
                'alta': 'prediction-high',
                'media': 'prediction-medium',
                'baja': 'prediction-low'
            }[pred.probability] || 'prediction-medium';

            const icon = {
                'contract_ending': '📅',
                'it_extension': '🏥',
                'unstable_service': '⚠️'
            }[pred.type] || '🔮';

            return `
                <div class="prediction-card ${priorityClass}">
                    <div class="prediction-icon">${icon}</div>
                    <div class="prediction-content">
                        <div class="prediction-title">${this.getPredictionTitle(pred)}</div>
                        <div class="prediction-service">${pred.service}</div>
                        ${pred.titular ? `<div class="prediction-worker">Titular: ${pred.titular}</div>` : ''}
                        <div class="prediction-probability">Probabilidad: <strong>${pred.probability.toUpperCase()}</strong></div>
                        <div class="prediction-recommendation">💡 ${pred.recommendation}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    getPredictionTitle(pred) {
        switch (pred.type) {
            case 'contract_ending':
                return `Contrato termina en ${pred.daysUntil} día${pred.daysUntil > 1 ? 's' : ''}`;
            case 'it_extension':
                return 'Baja IT puede extenderse';
            case 'unstable_service':
                return `Servicio inestable (${pred.stability}% estabilidad)`;
            default:
                return 'Predicción';
        }
    },

    // RENDERIZADO DE RECOMENDACIONES
    renderRecommendations() {
        const container = document.getElementById('ai-recommendations-container');
        if (!container) return;

        if (this.recommendations.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay recomendaciones en este momento</div>';
            return;
        }

        const html = this.recommendations.map(rec => {
            const priorityClass = {
                'high': 'recommendation-high',
                'medium': 'recommendation-medium',
                'low': 'recommendation-low'
            }[rec.priority] || 'recommendation-medium';

            return `
                <div class="recommendation-card ${priorityClass}">
                    <div class="recommendation-header">
                        <strong>${this.getRecommendationTitle(rec)}</strong>
                    </div>
                    <div class="recommendation-message">${rec.message || rec.service}</div>
                    ${rec.suggestions ? this.renderSuggestions(rec.suggestions) : ''}
                    <div class="recommendation-action">💡 ${rec.recommendation}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    renderSuggestions(suggestions) {
        return `
            <div class="suplente-suggestions">
                <div class="suggestions-title">Mejores candidatos:</div>
                ${suggestions.map((sug, idx) => `
                    <div class="suggestion-item">
                        <div class="suggestion-rank">#${idx + 1}</div>
                        <div class="suggestion-worker">
                            <strong>${sug.worker}</strong>
                            <div class="suggestion-score">Score: ${sug.score}/100</div>
                        </div>
                        <div class="suggestion-reasons">
                            ${sug.reasons.map(r => `<span class="reason-tag">✓ ${r}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    getRecommendationTitle(rec) {
        switch (rec.type) {
            case 'suplente_suggestion':
                return '👥 Sugerencias de Suplentes';
            case 'route_optimization':
                return '🗺️ Optimización de Rutas';
            case 'worker_overload':
                return '⚠️ Sobrecarga de Trabajo';
            default:
                return '💡 Recomendación';
        }
    },

    // UTILIDADES
    extractLocation(serviceName) {
        if (!serviceName) return null;

        // Extraer ubicación entre paréntesis
        const match = serviceName.match(/\(([^)]+)\)/);
        if (match) return match[1].trim();

        // Buscar nombres de ciudades comunes
        const cities = ['Barcelona', 'Badalona', 'Cornellà', 'Hospitalet', 'Sabadell', 'Terrassa',
            'Mataró', 'Sant Cugat', 'Viladecans', 'Gavà', 'Castelldefels', 'Sitges',
            'Vilanova', 'Calella', 'Pineda', 'Malgrat'];

        for (const city of cities) {
            if (serviceName.includes(city)) return city;
        }

        return null;
    },

    calculateLocationSimilarity(loc1, loc2) {
        if (!loc1 || !loc2) return 0;
        if (loc1 === loc2) return 1;

        // Similitud básica por substring
        const l1 = loc1.toLowerCase();
        const l2 = loc2.toLowerCase();

        if (l1.includes(l2) || l2.includes(l1)) return 0.8;

        return 0;
    },

    excelDateToJS(excelDate) {
        if (!excelDate) return null;
        return new Date((excelDate - 25569) * 86400 * 1000);
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AIPredictiveEngine.init());
} else {
    AIPredictiveEngine.init();
}
