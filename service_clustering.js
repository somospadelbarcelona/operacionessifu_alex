/**
 * SERVICE CLUSTERING - Agrupación Inteligente de Servicios
 * Agrupa servicios similares usando K-Means clustering
 */

const ServiceClustering = {
    clusters: [],
    serviceVectors: [],
    k: 5, // Número de clusters

    init() {
        console.log('🎯 Inicializando Clustering de Servicios...');
        this.buildServiceVectors();
        this.performClustering();
    },

    buildServiceVectors() {
        if (!window.state || !window.state.masterData) return;

        console.log('📊 Construyendo vectores de características...');

        this.serviceVectors = window.state.masterData.map(service => {
            return {
                id: service.PROYECTO,
                name: service.SERVICIO,
                titular: service.TITULAR,
                features: this.extractFeatures(service),
                service: service
            };
        });

        console.log('✅ Vectores construidos:', this.serviceVectors.length);
    },

    extractFeatures(service) {
        // Extraer características numéricas del servicio
        return [
            // Tipo de servicio (codificado)
            this.encodeServiceType(service['TIPO S']),

            // Estado (codificado)
            service.ESTADO === 'CUBIERTO' ? 1 : 0,
            service.ESTADO1 === 'BAJA IT' ? 1 : 0,
            service.ESTADO1 === 'VACACIONES' ? 1 : 0,

            // Ubicación (codificada)
            this.encodeLocation(service.SERVICIO),

            // Tiene suplente
            service.SUPLENTE && service.SUPLENTE !== 'EMERGENCIAS' ? 1 : 0,

            // Días hasta fin de contrato (normalizado)
            this.normalizeDaysToContractEnd(service['FIN CONTRATO']),

            // Gestor (codificado)
            this.encodeGestor(service.GESTOR)
        ];
    },

    performClustering() {
        if (this.serviceVectors.length < this.k) {
            console.log('⚠️ No hay suficientes servicios para clustering');
            return;
        }

        console.log('🔄 Ejecutando K-Means clustering...');

        // Inicializar centroides aleatoriamente
        let centroids = this.initializeCentroids();

        let iterations = 0;
        const maxIterations = 100;
        let converged = false;

        while (!converged && iterations < maxIterations) {
            // Asignar cada servicio al centroide más cercano
            const newClusters = this.assignToClusters(centroids);

            // Recalcular centroides
            const newCentroids = this.recalculateCentroids(newClusters);

            // Verificar convergencia
            converged = this.hasConverged(centroids, newCentroids);

            centroids = newCentroids;
            this.clusters = newClusters;
            iterations++;
        }

        console.log(`✅ Clustering completado en ${iterations} iteraciones`);
        this.analyzeClusters();
    },

    initializeCentroids() {
        // Seleccionar k servicios aleatorios como centroides iniciales
        const centroids = [];
        const indices = new Set();

        while (centroids.length < this.k) {
            const randomIndex = Math.floor(Math.random() * this.serviceVectors.length);
            if (!indices.has(randomIndex)) {
                indices.add(randomIndex);
                centroids.push([...this.serviceVectors[randomIndex].features]);
            }
        }

        return centroids;
    },

    assignToClusters(centroids) {
        const clusters = Array.from({ length: this.k }, () => []);

        this.serviceVectors.forEach(vector => {
            let minDistance = Infinity;
            let closestCluster = 0;

            centroids.forEach((centroid, index) => {
                const distance = this.euclideanDistance(vector.features, centroid);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCluster = index;
                }
            });

            clusters[closestCluster].push(vector);
        });

        return clusters;
    },

    recalculateCentroids(clusters) {
        return clusters.map(cluster => {
            if (cluster.length === 0) {
                // Si el cluster está vacío, generar centroide aleatorio
                return this.serviceVectors[Math.floor(Math.random() * this.serviceVectors.length)].features;
            }

            const numFeatures = cluster[0].features.length;
            const centroid = new Array(numFeatures).fill(0);

            cluster.forEach(vector => {
                vector.features.forEach((value, index) => {
                    centroid[index] += value;
                });
            });

            return centroid.map(sum => sum / cluster.length);
        });
    },

    euclideanDistance(vector1, vector2) {
        return Math.sqrt(
            vector1.reduce((sum, val, index) => {
                return sum + Math.pow(val - vector2[index], 2);
            }, 0)
        );
    },

    hasConverged(oldCentroids, newCentroids, threshold = 0.001) {
        return oldCentroids.every((oldCentroid, index) => {
            const distance = this.euclideanDistance(oldCentroid, newCentroids[index]);
            return distance < threshold;
        });
    },

    analyzeClusters() {
        console.log('🔍 Analizando clusters...');

        this.clusters.forEach((cluster, index) => {
            if (cluster.length === 0) return;

            // Características dominantes del cluster
            const avgFeatures = this.calculateAverageFeatures(cluster);

            // Identificar tipo dominante
            const types = cluster.map(v => v.service['TIPO S']).filter(Boolean);
            const dominantType = this.getMostFrequent(types);

            // Identificar ubicación dominante
            const locations = cluster.map(v => this.extractLocationName(v.service.SERVICIO)).filter(Boolean);
            const dominantLocation = this.getMostFrequent(locations);

            // Calcular estadísticas
            const covered = cluster.filter(v => v.service.ESTADO === 'CUBIERTO').length;
            const uncovered = cluster.filter(v => v.service.ESTADO === 'DESCUBIERTO').length;
            const itLeaves = cluster.filter(v => v.service.ESTADO1 === 'BAJA IT').length;

            cluster.metadata = {
                id: index,
                size: cluster.length,
                dominantType: dominantType || 'Mixto',
                dominantLocation: dominantLocation || 'Varias',
                covered: covered,
                uncovered: uncovered,
                itLeaves: itLeaves,
                coverageRate: ((covered / cluster.length) * 100).toFixed(1),
                avgFeatures: avgFeatures
            };
        });
    },

    calculateAverageFeatures(cluster) {
        const numFeatures = cluster[0].features.length;
        const avg = new Array(numFeatures).fill(0);

        cluster.forEach(vector => {
            vector.features.forEach((value, index) => {
                avg[index] += value;
            });
        });

        return avg.map(sum => sum / cluster.length);
    },

    getMostFrequent(array) {
        if (array.length === 0) return null;

        const frequency = {};
        array.forEach(item => {
            frequency[item] = (frequency[item] || 0) + 1;
        });

        return Object.keys(frequency).reduce((a, b) =>
            frequency[a] > frequency[b] ? a : b
        );
    },

    extractLocationName(serviceName) {
        if (!serviceName) return null;

        const locations = ['Barcelona', 'Badalona', 'Hospitalet', 'Cornellà', 'Sant Adrià',
            'Esplugues', 'Sant Boi', 'Viladecans', 'Gavà', 'Castelldefels'];

        for (const location of locations) {
            if (serviceName.includes(location)) {
                return location;
            }
        }

        return null;
    },

    // RENDERIZADO
    renderClusters() {
        const container = document.getElementById('service-clustering-container');
        if (!container) return;

        if (this.clusters.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay datos suficientes para clustering</div>';
            return;
        }

        // Filtrar clusters vacíos
        const nonEmptyClusters = this.clusters.filter(c => c.length > 0);

        const html = `
            <div class="clustering-header">
                <h4>🎯 Agrupación de Servicios</h4>
                <div class="clustering-stats">
                    <span class="stat-item">
                        <strong>${nonEmptyClusters.length}</strong> grupos identificados
                    </span>
                    <span class="stat-item">
                        <strong>${this.serviceVectors.length}</strong> servicios analizados
                    </span>
                </div>
            </div>
            <div class="clusters-grid">
                ${nonEmptyClusters.map((cluster, index) => this.renderClusterCard(cluster, index)).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderClusterCard(cluster, index) {
        const meta = cluster.metadata;
        const colorClass = `cluster-${index % 5}`;

        return `
            <div class="cluster-card ${colorClass}">
                <div class="cluster-header">
                    <div class="cluster-title">Grupo ${index + 1}</div>
                    <div class="cluster-size">${meta.size} servicios</div>
                </div>

                <div class="cluster-characteristics">
                    <div class="char-item">
                        <span class="char-icon">📍</span>
                        <span class="char-label">Ubicación:</span>
                        <span class="char-value">${meta.dominantLocation}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-icon">🏷️</span>
                        <span class="char-label">Tipo:</span>
                        <span class="char-value">${meta.dominantType}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-icon">📊</span>
                        <span class="char-label">Cobertura:</span>
                        <span class="char-value">${meta.coverageRate}%</span>
                    </div>
                </div>

                <div class="cluster-stats">
                    <div class="stat-bar">
                        <div class="stat-label">Cubiertos</div>
                        <div class="stat-progress">
                            <div class="stat-fill covered" style="width: ${(meta.covered / meta.size) * 100}%"></div>
                        </div>
                        <div class="stat-count">${meta.covered}</div>
                    </div>
                    <div class="stat-bar">
                        <div class="stat-label">Descubiertos</div>
                        <div class="stat-progress">
                            <div class="stat-fill uncovered" style="width: ${(meta.uncovered / meta.size) * 100}%"></div>
                        </div>
                        <div class="stat-count">${meta.uncovered}</div>
                    </div>
                    ${meta.itLeaves > 0 ? `
                        <div class="stat-bar">
                            <div class="stat-label">Bajas IT</div>
                            <div class="stat-progress">
                                <div class="stat-fill it" style="width: ${(meta.itLeaves / meta.size) * 100}%"></div>
                            </div>
                            <div class="stat-count">${meta.itLeaves}</div>
                        </div>
                    ` : ''}
                </div>

                <button class="cluster-details-btn" onclick="ServiceClustering.showClusterDetails(${index})">
                    Ver Detalles
                </button>
            </div>
        `;
    },

    showClusterDetails(clusterIndex) {
        const cluster = this.clusters[clusterIndex];
        if (!cluster || cluster.length === 0) return;

        const meta = cluster.metadata;

        const modal = document.createElement('div');
        modal.className = 'modal cluster-modal';
        modal.innerHTML = `
            <div class="modal-content cluster-modal-content">
                <div class="modal-header">
                    <h2>Grupo ${clusterIndex + 1} - Detalles</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="cluster-detail-body">
                    <div class="cluster-summary">
                        <h3>Características del Grupo</h3>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">Tamaño:</span>
                                <span class="summary-value">${meta.size} servicios</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Ubicación Dominante:</span>
                                <span class="summary-value">${meta.dominantLocation}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Tipo Dominante:</span>
                                <span class="summary-value">${meta.dominantType}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Tasa de Cobertura:</span>
                                <span class="summary-value">${meta.coverageRate}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="cluster-services-list">
                        <h3>Servicios en este Grupo (${cluster.length})</h3>
                        <div class="services-table">
                            ${cluster.map(v => `
                                <div class="service-row">
                                    <div class="service-name">${v.name}</div>
                                    <div class="service-status ${v.service.ESTADO === 'CUBIERTO' ? 'covered' : 'uncovered'}">
                                        ${v.service.ESTADO}
                                    </div>
                                    <div class="service-worker">${v.titular || 'Sin asignar'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.style.display = 'flex', 10);
    },

    // UTILIDADES
    encodeServiceType(type) {
        const types = {
            'LIMPIEZA': 1,
            'SEGURIDAD': 2,
            'MANTENIMIENTO': 3,
            'RECEPCIÓN': 4,
            'OTROS': 5
        };
        return types[type] || 0;
    },

    encodeLocation(serviceName) {
        const locations = {
            'Barcelona': 1,
            'Badalona': 2,
            'Hospitalet': 3,
            'Cornellà': 4,
            'Sant Adrià': 5,
            'Esplugues': 6,
            'Sant Boi': 7,
            'Viladecans': 8,
            'Gavà': 9,
            'Castelldefels': 10
        };

        for (const [loc, code] of Object.entries(locations)) {
            if (serviceName && serviceName.includes(loc)) {
                return code;
            }
        }

        return 0;
    },

    encodeGestor(gestor) {
        if (!gestor) return 0;

        const gestores = ['GESTOR A', 'GESTOR B', 'GESTOR C', 'GESTOR D'];
        const index = gestores.indexOf(gestor);
        return index >= 0 ? index + 1 : 0;
    },

    normalizeDaysToContractEnd(excelDate) {
        if (!excelDate) return 1; // Muy lejano

        const contractEnd = new Date((excelDate - 25569) * 86400 * 1000);
        const today = new Date();
        const diffDays = Math.ceil((contractEnd - today) / (1000 * 60 * 60 * 24));

        // Normalizar a 0-1 (0 = ya terminó, 1 = muy lejano)
        return Math.max(0, Math.min(1, diffDays / 365));
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ServiceClustering.init());
} else {
    ServiceClustering.init();
}

// Exponer globalmente
window.ServiceClustering = ServiceClustering;
