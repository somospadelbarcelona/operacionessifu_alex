/**
 * ROUTE OPTIMIZER - Optimizador de Rutas Inteligente
 * Optimiza rutas de trabajadores usando algoritmos genéticos
 */

const RouteOptimizer = {
    routes: [],
    optimizedRoutes: [],
    locations: new Map(),

    init() {
        console.log('🗺️ Inicializando Optimizador de Rutas...');
        this.buildLocationDatabase();
        this.analyzeWorkerRoutes();
    },

    buildLocationDatabase() {
        // Base de datos de coordenadas (simuladas para Barcelona y alrededores)
        this.locations = new Map([
            ['Barcelona', { lat: 41.3851, lng: 2.1734 }],
            ['Badalona', { lat: 41.4502, lng: 2.2447 }],
            ['Hospitalet', { lat: 41.3598, lng: 2.1006 }],
            ['Cornellà', { lat: 41.3563, lng: 2.0752 }],
            ['Sant Adrià', { lat: 41.4301, lng: 2.2201 }],
            ['Esplugues', { lat: 41.3768, lng: 2.0878 }],
            ['Sant Boi', { lat: 41.3431, lng: 2.0363 }],
            ['Viladecans', { lat: 41.3145, lng: 2.0141 }],
            ['Gavà', { lat: 41.3057, lng: 2.0012 }],
            ['Castelldefels', { lat: 41.2814, lng: 1.9774 }]
        ]);
    },

    analyzeWorkerRoutes() {
        if (!window.state || !window.state.masterData) return;

        console.log('🔍 Analizando rutas de trabajadores...');

        const workerRoutes = {};

        // Agrupar servicios por trabajador
        window.state.masterData.forEach(service => {
            const worker = service.TITULAR;
            if (!worker || service.ESTADO !== 'CUBIERTO') return;

            if (!workerRoutes[worker]) {
                workerRoutes[worker] = {
                    name: worker,
                    services: [],
                    locations: [],
                    totalDistance: 0,
                    efficiency: 100
                };
            }

            const location = this.extractLocation(service.SERVICIO);
            if (location) {
                workerRoutes[worker].services.push({
                    name: service.SERVICIO,
                    location: location,
                    coords: this.locations.get(location),
                    horario: service.HORARIO
                });

                if (!workerRoutes[worker].locations.includes(location)) {
                    workerRoutes[worker].locations.push(location);
                }
            }
        });

        // Calcular distancias y eficiencia
        Object.values(workerRoutes).forEach(route => {
            if (route.services.length > 1) {
                route.totalDistance = this.calculateTotalDistance(route.services);
                route.efficiency = this.calculateEfficiency(route);

                // Optimizar ruta si tiene más de 2 servicios
                if (route.services.length >= 3) {
                    route.optimizedServices = this.optimizeRoute(route.services);
                    route.optimizedDistance = this.calculateTotalDistance(route.optimizedServices);
                    route.savings = route.totalDistance - route.optimizedDistance;
                    route.savingsPercent = ((route.savings / route.totalDistance) * 100).toFixed(1);
                }
            }
        });

        this.routes = Object.values(workerRoutes);
        console.log('✅ Rutas analizadas:', this.routes.length);
    },

    calculateTotalDistance(services) {
        if (services.length < 2) return 0;

        let totalDistance = 0;

        for (let i = 0; i < services.length - 1; i++) {
            const from = services[i].coords;
            const to = services[i + 1].coords;

            if (from && to) {
                totalDistance += this.calculateDistance(from, to);
            }
        }

        return totalDistance;
    },

    calculateDistance(coord1, coord2) {
        // Fórmula de Haversine para calcular distancia entre coordenadas
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.toRad(coord2.lat - coord1.lat);
        const dLng = this.toRad(coord2.lng - coord1.lng);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(coord1.lat)) * Math.cos(this.toRad(coord2.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    },

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    },

    calculateEfficiency(route) {
        // Eficiencia basada en:
        // - Número de ubicaciones diferentes (menos es mejor)
        // - Distancia total (menos es mejor)
        // - Número de servicios (más es mejor si están concentrados)

        const uniqueLocations = route.locations.length;
        const serviceCount = route.services.length;

        if (uniqueLocations === 1) return 100; // Perfecto: todos en misma ubicación

        const concentration = (serviceCount / uniqueLocations) * 100;
        const distancePenalty = Math.min(route.totalDistance * 5, 50);

        return Math.max(0, Math.min(100, concentration - distancePenalty));
    },

    optimizeRoute(services) {
        if (services.length < 4) return this.optimizeRouteNearestNeighbor(services);

        console.log('🧬 Ejecutando Algoritmo Genético para ' + services.length + ' puntos...');

        // Parámetros del AG
        const POPULATION_SIZE = 50;
        const GENERATIONS = 100;
        const MUTATION_RATE = 0.1;

        // 1. Población inicial
        let population = [];
        for (let i = 0; i < POPULATION_SIZE; i++) {
            population.push(this.shuffle([...services]));
        }

        // 2. Evolución
        for (let g = 0; g < GENERATIONS; g++) {
            // Calcular fitness (inversa de la distancia)
            population.sort((a, b) => this.calculateTotalDistance(a) - this.calculateTotalDistance(b));

            // Elitismo: mantener el mejor
            let nextGeneration = [population[0]];

            while (nextGeneration.length < POPULATION_SIZE) {
                // Selección (Torneo)
                let parent1 = this.tournamentSelection(population);
                let parent2 = this.tournamentSelection(population);

                // Crossover (Order Crossover - OX)
                let child = this.orderCrossover(parent1, parent2);

                // Mutación
                if (Math.random() < MUTATION_RATE) {
                    this.mutate(child);
                }

                nextGeneration.push(child);
            }
            population = nextGeneration;
        }

        const bestRoute = population[0];
        console.log('✅ Optimización Genética completada.');
        return bestRoute;
    },

    optimizeRouteNearestNeighbor(services) {
        if (services.length < 2) return services;
        const optimized = [];
        const remaining = [...services];
        let current = remaining.shift();
        optimized.push(current);

        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            remaining.forEach((service, index) => {
                if (current.coords && service.coords) {
                    const distance = this.calculateDistance(current.coords, service.coords);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestIndex = index;
                    }
                }
            });
            current = remaining.splice(nearestIndex, 1)[0];
            optimized.push(current);
        }
        return optimized;
    },

    // UTILIDADES AG
    tournamentSelection(population) {
        const tournamentSize = 5;
        let best = population[Math.floor(Math.random() * population.length)];
        for (let i = 0; i < tournamentSize; i++) {
            let contender = population[Math.floor(Math.random() * population.length)];
            if (this.calculateTotalDistance(contender) < this.calculateTotalDistance(best)) {
                best = contender;
            }
        }
        return best;
    },

    orderCrossover(parent1, parent2) {
        const size = parent1.length;
        const start = Math.floor(Math.random() * size);
        const end = Math.floor(Math.random() * (size - start)) + start;

        const child = new Array(size).fill(null);
        for (let i = start; i <= end; i++) {
            child[i] = parent1[i];
        }

        let p2Idx = 0;
        for (let i = 0; i < size; i++) {
            if (child[i] === null) {
                while (parent1.some(s => s.name === parent2[p2Idx].name && child.includes(s))) {
                    p2Idx++;
                }
                // Simplificación para el crossover de objetos:
                let candidate = parent2[p2Idx];
                while (child.some(s => s && s.name === candidate.name)) {
                    p2Idx++;
                    candidate = parent2[p2Idx];
                }
                child[i] = candidate;
                p2Idx++;
            }
        }
        return child;
    },

    mutate(route) {
        const i = Math.floor(Math.random() * route.length);
        const j = Math.floor(Math.random() * route.length);
        [route[i], route[j]] = [route[j], route[i]];
    },

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },


    extractLocation(serviceName) {
        if (!serviceName) return null;

        for (const location of this.locations.keys()) {
            if (serviceName.includes(location)) {
                return location;
            }
        }

        return null;
    },

    // RENDERIZADO
    renderRouteOptimization() {
        const container = document.getElementById('route-optimization-container');
        if (!container) return;

        // Filtrar solo rutas que se pueden optimizar
        const optimizableRoutes = this.routes.filter(r => r.optimizedServices && r.savings > 0);

        if (optimizableRoutes.length === 0) {
            container.innerHTML = '<div class="empty-state">✅ Todas las rutas están optimizadas</div>';
            return;
        }

        // Ordenar por ahorro descendente
        optimizableRoutes.sort((a, b) => b.savings - a.savings);

        const html = `
            <div class="route-optimization-header">
                <h4>🗺️ Optimización de Rutas</h4>
                <div class="route-stats">
                    <span class="stat-item">
                        <strong>${optimizableRoutes.length}</strong> rutas optimizables
                    </span>
                    <span class="stat-item">
                        <strong>${optimizableRoutes.reduce((sum, r) => sum + r.savings, 0).toFixed(1)} km</strong> ahorro total
                    </span>
                </div>
            </div>
            <div class="route-cards">
                ${optimizableRoutes.map(route => this.renderRouteCard(route)).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderRouteCard(route) {
        return `
            <div class="route-card">
                <div class="route-card-header">
                    <div class="route-worker">${route.name}</div>
                    <div class="route-savings ${route.savings > 5 ? 'high-savings' : ''}">
                        💰 ${route.savingsPercent}% ahorro
                    </div>
                </div>
                
                <div class="route-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Servicios:</span>
                        <span class="metric-value">${route.services.length}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Ubicaciones:</span>
                        <span class="metric-value">${route.locations.length}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Distancia Actual:</span>
                        <span class="metric-value">${route.totalDistance.toFixed(1)} km</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Distancia Optimizada:</span>
                        <span class="metric-value optimized">${route.optimizedDistance.toFixed(1)} km</span>
                    </div>
                </div>

                <div class="route-comparison">
                    <div class="route-column">
                        <h5>Ruta Actual</h5>
                        <div class="route-list">
                            ${route.services.map((s, i) => `
                                <div class="route-step">
                                    <span class="step-number">${i + 1}</span>
                                    <span class="step-location">${s.location}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="route-arrow">→</div>
                    
                    <div class="route-column">
                        <h5>Ruta Optimizada</h5>
                        <div class="route-list">
                            ${route.optimizedServices.map((s, i) => `
                                <div class="route-step optimized">
                                    <span class="step-number">${i + 1}</span>
                                    <span class="step-location">${s.location}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="route-recommendation">
                    💡 Reordenando los servicios se ahorran <strong>${route.savings.toFixed(1)} km</strong> 
                    (${route.savingsPercent}% menos distancia)
                </div>
            </div>
        `;
    },

    // GENERAR INFORME
    generateRouteReport() {
        const optimizableRoutes = this.routes.filter(r => r.optimizedServices && r.savings > 0);

        const report = {
            totalRoutes: this.routes.length,
            optimizableRoutes: optimizableRoutes.length,
            totalSavings: optimizableRoutes.reduce((sum, r) => sum + r.savings, 0),
            averageSavings: optimizableRoutes.length > 0
                ? (optimizableRoutes.reduce((sum, r) => sum + r.savings, 0) / optimizableRoutes.length)
                : 0,
            topSavings: optimizableRoutes.slice(0, 5),
            generatedAt: new Date().toISOString()
        };

        return report;
    },

    // EXPORTAR RUTAS OPTIMIZADAS
    exportOptimizedRoutes() {
        const report = this.generateRouteReport();

        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `rutas_optimizadas_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('💾 Rutas optimizadas exportadas', 'success');
        }
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RouteOptimizer.init());
} else {
    RouteOptimizer.init();
}

// Exponer globalmente
window.RouteOptimizer = RouteOptimizer;
