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
        // Base de datos geoespacial oficial de Municipios y Comarcas de BARCELONA (Delegación 0801)
        this.locations = new Map([
            ['Barcelona', { lat: 41.3851, lng: 2.1734, comarca: 'Barcelonès' }],
            ['L\'Hospitalet de Llobregat', { lat: 41.3597, lng: 2.0997, comarca: 'Barcelonès' }],
            ['Badalona', { lat: 41.4500, lng: 2.2474, comarca: 'Barcelonès' }],
            ['Santa Coloma de Gramenet', { lat: 41.4515, lng: 2.2082, comarca: 'Barcelonès' }],
            ['Sant Adrià de Besòs', { lat: 41.4306, lng: 2.2189, comarca: 'Barcelonès' }],
            ['Cornellà de Llobregat', { lat: 41.3570, lng: 2.0722, comarca: 'Baix Llobregat' }],
            ['El Prat de Llobregat', { lat: 41.3275, lng: 2.0947, comarca: 'Baix Llobregat' }],
            ['Sant Boi de Llobregat', { lat: 41.3461, lng: 2.0422, comarca: 'Baix Llobregat' }],
            ['Viladecans', { lat: 41.3142, lng: 2.0114, comarca: 'Baix Llobregat' }],
            ['Gavà', { lat: 41.3061, lng: 2.0039, comarca: 'Baix Llobregat' }],
            ['Castelldefels', { lat: 41.2800, lng: 1.9764, comarca: 'Baix Llobregat' }],
            ['Sant Feliu de Llobregat', { lat: 41.3833, lng: 2.0500, comarca: 'Baix Llobregat' }],
            ['Esplugues de Llobregat', { lat: 41.3769, lng: 2.0858, comarca: 'Baix Llobregat' }],
            ['Sant Joan Despí', { lat: 41.3703, lng: 2.0567, comarca: 'Baix Llobregat' }],
            ['Sant Cugat del Vallès', { lat: 41.4722, lng: 2.0858, comarca: 'Vallès Occidental' }],
            ['Sabadell', { lat: 41.5433, lng: 2.1094, comarca: 'Vallès Occidental' }],
            ['Terrassa', { lat: 41.5633, lng: 2.0089, comarca: 'Vallès Occidental' }],
            ['Rubí', { lat: 41.4925, lng: 2.0319, comarca: 'Vallès Occidental' }],
            ['Cerdanyola del Vallès', { lat: 41.4914, lng: 2.1408, comarca: 'Vallès Occidental' }],
            ['Ripollet', { lat: 41.4967, lng: 2.1578, comarca: 'Vallès Occidental' }],
            ['Barberà del Vallès', { lat: 41.5161, lng: 2.1264, comarca: 'Vallès Occidental' }],
            ['Granollers', { lat: 41.6078, lng: 2.2878, comarca: 'Vallès Oriental' }],
            ['Mollet del Vallès', { lat: 41.5369, lng: 2.2131, comarca: 'Vallès Oriental' }],
            ['Parets del Vallès', { lat: 41.5739, lng: 2.2333, comarca: 'Vallès Oriental' }],
            ['Montcada i Reixac', { lat: 41.4864, lng: 2.1878, comarca: 'Vallès Oriental' }],
            ['Mataró', { lat: 41.5381, lng: 2.4447, comarca: 'Maresme' }],
            ['El Masnou', { lat: 41.4819, lng: 2.3167, comarca: 'Maresme' }],
            ['Premià de Mar', { lat: 41.4917, lng: 2.3653, comarca: 'Maresme' }],
            ['Vilassar de Mar', { lat: 41.5039, lng: 2.3928, comarca: 'Maresme' }]
        ]);

        // Coordenadas centrales por Comarca de Barcelona
        this.comarcaCoords = {
            'Barcelonès': { lat: 41.3851, lng: 2.1734 },
            'Baix Llobregat': { lat: 41.3500, lng: 2.0500 },
            'Vallès Occidental': { lat: 41.5433, lng: 2.1094 },
            'Vallès Oriental': { lat: 41.6078, lng: 2.2878 },
            'Maresme': { lat: 41.5381, lng: 2.4447 },
            'Garraf / Penedès': { lat: 41.2239, lng: 1.7258 }
        };
    },

    getComarcaDistanceKm(comarcaA, comarcaB) {
        if (!comarcaA || !comarcaB) return 15;
        if (comarcaA === comarcaB) return 0;
        const c1 = this.comarcaCoords[comarcaA] || this.comarcaCoords['Barcelonès'];
        const c2 = this.comarcaCoords[comarcaB] || this.comarcaCoords['Barcelonès'];
        return Math.round(this.calculateDistance(c1, c2));
    },

    analyzeWorkerRoutes() {
        const sourceData = (window.state && window.state.masterData) || window.INITIAL_MASTER_DATA;
        if (!sourceData) return;

        console.log('🔍 Analizando rutas de trabajadores en Barcelona (Delegación 0801)...');

        const workerRoutes = {};

        // Agrupar servicios por trabajador
        sourceData.forEach(service => {
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
