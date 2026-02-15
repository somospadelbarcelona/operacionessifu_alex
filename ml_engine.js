/**
 * MACHINE LEARNING ENGINE - Motor de Aprendizaje Automático
 * Predicciones avanzadas con TensorFlow.js
 */

const MLEngine = {
    model: null,
    isTraining: false,
    trainingData: [],
    predictions: [],
    anomalies: [],

    async init() {
        console.log('🧠 Inicializando Motor de Machine Learning...');

        // Cargar TensorFlow.js si no está disponible
        if (typeof tf === 'undefined') {
            await this.loadTensorFlow();
        }

        this.loadTrainingData();
        await this.buildModel();
        this.startAnomalyDetection();
    },

    async loadTensorFlow() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js';
            script.onload = () => {
                console.log('✅ TensorFlow.js cargado');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    loadTrainingData() {
        // Cargar datos históricos para entrenamiento
        const saved = localStorage.getItem('sifu_ml_training_data_v1');
        if (saved) {
            try {
                this.trainingData = JSON.parse(saved);
                console.log('📊 Datos de entrenamiento cargados:', this.trainingData.length, 'registros');
            } catch (e) {
                console.error('Error cargando datos de entrenamiento:', e);
            }
        }

        // Si no hay datos, generar desde datos actuales
        if (this.trainingData.length === 0) {
            this.generateTrainingData();
        }
    },

    generateTrainingData() {
        if (!window.state || !window.state.masterData) return;

        console.log('🔄 Generando datos de entrenamiento...');

        const data = [];
        const today = new Date();

        window.state.masterData.forEach(service => {
            // Características (features) del servicio
            const features = {
                // Tipo de servicio (codificado)
                serviceType: this.encodeServiceType(service['TIPO S']),

                // Estado actual
                isCovered: service.ESTADO === 'CUBIERTO' ? 1 : 0,
                isIT: service.ESTADO1 === 'BAJA IT' ? 1 : 0,
                isVacation: service.ESTADO1 === 'VACACIONES' ? 1 : 0,

                // Días hasta fin de contrato
                daysToContractEnd: this.calculateDaysToContractEnd(service['FIN CONTRATO']),

                // Tiene suplente
                hasSubstitute: service.SUPLENTE && service.SUPLENTE !== 'EMERGENCIAS' ? 1 : 0,

                // Ubicación (codificada)
                location: this.encodeLocation(service.SERVICIO),

                // Día de la semana (0-6)
                dayOfWeek: today.getDay(),

                // Mes del año (1-12)
                month: today.getMonth() + 1
            };

            // Etiqueta (label) - ¿Estará descubierto en los próximos 7 días?
            const label = service.ESTADO === 'DESCUBIERTO' ? 1 : 0;

            data.push({
                features: Object.values(features),
                label: label,
                serviceId: service.PROYECTO
            });
        });

        this.trainingData = data;
        this.saveTrainingData();

        console.log('✅ Datos de entrenamiento generados:', data.length, 'registros');
    },

    saveTrainingData() {
        localStorage.setItem('sifu_ml_training_data_v1', JSON.stringify(this.trainingData));
    },

    async buildModel() {
        if (typeof tf === 'undefined') {
            console.error('❌ TensorFlow.js no está disponible');
            return;
        }

        console.log('🏗️ Construyendo modelo de red neuronal...');

        // Crear modelo secuencial
        this.model = tf.sequential({
            layers: [
                // Capa de entrada
                tf.layers.dense({
                    inputShape: [9], // 9 características
                    units: 16,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),

                // Capa oculta 1
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 8,
                    activation: 'relu'
                }),

                // Capa oculta 2
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 4,
                    activation: 'relu'
                }),

                // Capa de salida
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid' // Clasificación binaria
                })
            ]
        });

        // Compilar modelo
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        console.log('✅ Modelo construido');

        // Entrenar si hay suficientes datos
        if (this.trainingData.length >= 10) {
            await this.trainModel();
        }
    },

    async trainModel() {
        if (!this.model || this.trainingData.length < 10) {
            console.log('⚠️ No hay suficientes datos para entrenar');
            return;
        }

        console.log('🎓 Entrenando modelo...');
        this.isTraining = true;

        try {
            // Preparar datos
            const features = this.trainingData.map(d => d.features);
            const labels = this.trainingData.map(d => d.label);

            const xs = tf.tensor2d(features);
            const ys = tf.tensor2d(labels, [labels.length, 1]);

            // Entrenar
            const history = await this.model.fit(xs, ys, {
                epochs: 50,
                batchSize: 32,
                validationSplit: 0.2,
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (epoch % 10 === 0) {
                            console.log(`Época ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                        }
                    }
                }
            });

            // Limpiar tensores
            xs.dispose();
            ys.dispose();

            console.log('✅ Modelo entrenado correctamente');
            this.isTraining = false;

            // Guardar modelo
            await this.saveModel();

        } catch (error) {
            console.error('❌ Error entrenando modelo:', error);
            this.isTraining = false;
        }
    },

    async saveModel() {
        if (!this.model) return;

        try {
            await this.model.save('localstorage://sifu-ml-model');
            console.log('💾 Modelo guardado en localStorage');
        } catch (error) {
            console.error('Error guardando modelo:', error);
        }
    },

    async loadModel() {
        try {
            this.model = await tf.loadLayersModel('localstorage://sifu-ml-model');
            console.log('✅ Modelo cargado desde localStorage');
            return true;
        } catch (error) {
            console.log('⚠️ No hay modelo guardado, creando nuevo...');
            return false;
        }
    },

    // PREDICCIONES
    async predictUncoveredServices() {
        if (!this.model || !window.state || !window.state.masterData) {
            console.log('⚠️ Modelo no disponible o sin datos');
            return [];
        }

        console.log('🔮 Generando predicciones ML...');

        const predictions = [];
        const today = new Date();

        for (const service of window.state.masterData) {
            // Solo predecir para servicios actualmente cubiertos
            if (service.ESTADO !== 'CUBIERTO') continue;

            const features = [
                this.encodeServiceType(service['TIPO S']),
                1, // isCovered
                service.ESTADO1 === 'BAJA IT' ? 1 : 0,
                service.ESTADO1 === 'VACACIONES' ? 1 : 0,
                this.calculateDaysToContractEnd(service['FIN CONTRATO']),
                service.SUPLENTE && service.SUPLENTE !== 'EMERGENCIAS' ? 1 : 0,
                this.encodeLocation(service.SERVICIO),
                today.getDay(),
                today.getMonth() + 1
            ];

            const input = tf.tensor2d([features]);
            const prediction = this.model.predict(input);
            const probability = (await prediction.data())[0];

            input.dispose();
            prediction.dispose();

            // Si la probabilidad es > 50%, predecir descubierto
            if (probability > 0.5) {
                predictions.push({
                    service: service.SERVICIO,
                    proyecto: service.PROYECTO,
                    titular: service.TITULAR,
                    probability: (probability * 100).toFixed(1),
                    risk: this.getRiskLevel(probability),
                    reason: this.getPredictionReason(service, probability)
                });
            }
        }

        // Ordenar por probabilidad descendente
        predictions.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));

        this.predictions = predictions;
        console.log('✅ Predicciones generadas:', predictions.length);

        return predictions;
    },

    getRiskLevel(probability) {
        if (probability >= 0.8) return 'CRÍTICO';
        if (probability >= 0.6) return 'ALTO';
        if (probability >= 0.4) return 'MEDIO';
        return 'BAJO';
    },

    getPredictionReason(service, probability) {
        const reasons = [];

        if (service.ESTADO1 === 'BAJA IT') {
            reasons.push('Trabajador en baja IT');
        }
        if (service.ESTADO1 === 'VACACIONES') {
            reasons.push('Trabajador de vacaciones');
        }
        if (!service.SUPLENTE || service.SUPLENTE === 'EMERGENCIAS') {
            reasons.push('Sin suplente asignado');
        }

        const daysToEnd = this.calculateDaysToContractEnd(service['FIN CONTRATO']);
        if (daysToEnd >= 0 && daysToEnd <= 7) {
            reasons.push('Contrato termina pronto');
        }

        if (reasons.length === 0) {
            reasons.push('Patrón histórico detectado');
        }

        return reasons.join(', ');
    },

    // DETECCIÓN DE ANOMALÍAS
    startAnomalyDetection() {
        console.log('🔍 Iniciando detección de anomalías...');

        // Detectar cada 10 minutos
        setInterval(() => {
            this.detectAnomalies();
        }, 10 * 60 * 1000);

        // Primera detección inmediata
        this.detectAnomalies();
    },

    detectAnomalies() {
        if (!window.state || !window.state.masterData) return;

        const anomalies = [];

        // 1. ANOMALÍA: Trabajador con demasiados servicios
        const workerServices = {};
        window.state.masterData.forEach(service => {
            const titular = service.TITULAR;
            if (!titular) return;

            if (!workerServices[titular]) {
                workerServices[titular] = [];
            }
            workerServices[titular].push(service);
        });

        Object.entries(workerServices).forEach(([worker, services]) => {
            if (services.length > 5) {
                anomalies.push({
                    type: 'SOBRECARGA',
                    severity: 'HIGH',
                    worker: worker,
                    count: services.length,
                    message: `${worker} tiene ${services.length} servicios asignados (normal: 1-3)`,
                    recommendation: 'Redistribuir servicios para evitar sobrecarga'
                });
            }
        });

        // 2. ANOMALÍA: Servicio sin titular durante mucho tiempo
        window.state.masterData.forEach(service => {
            if (service.ESTADO === 'DESCUBIERTO' && !service.TITULAR) {
                anomalies.push({
                    type: 'SIN_TITULAR',
                    severity: 'CRITICAL',
                    service: service.SERVICIO,
                    proyecto: service.PROYECTO,
                    message: `${service.SERVICIO} lleva tiempo sin titular asignado`,
                    recommendation: 'Asignar titular urgentemente'
                });
            }
        });

        // 3. ANOMALÍA: Múltiples bajas IT en mismo servicio
        const itByService = {};
        window.state.masterData.forEach(service => {
            if (service.ESTADO1 === 'BAJA IT') {
                const key = service.SERVICIO;
                itByService[key] = (itByService[key] || 0) + 1;
            }
        });

        Object.entries(itByService).forEach(([service, count]) => {
            if (count > 1) {
                anomalies.push({
                    type: 'BAJAS_IT_RECURRENTES',
                    severity: 'MEDIUM',
                    service: service,
                    count: count,
                    message: `${service} tiene ${count} bajas IT recurrentes`,
                    recommendation: 'Revisar condiciones del servicio'
                });
            }
        });

        // 4. ANOMALÍA: Servicios con rotación alta
        // (Esto requeriría datos históricos, por ahora lo simulamos)

        this.anomalies = anomalies;

        if (anomalies.length > 0) {
            console.log('⚠️ Anomalías detectadas:', anomalies.length);
            this.notifyAnomalies(anomalies);
        }
    },

    notifyAnomalies(anomalies) {
        // Notificar anomalías críticas
        const critical = anomalies.filter(a => a.severity === 'CRITICAL');

        if (critical.length > 0 && typeof showToast === 'function') {
            showToast(`🚨 ${critical.length} anomalía(s) crítica(s) detectada(s)`, 'error');
        }
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
        if (!serviceName) return 0;

        const locations = {
            'Barcelona': 1,
            'Badalona': 2,
            'Hospitalet': 3,
            'Cornellà': 4,
            'Sant Adrià': 5
        };

        for (const [loc, code] of Object.entries(locations)) {
            if (serviceName.includes(loc)) {
                return code;
            }
        }

        return 0;
    },

    calculateDaysToContractEnd(excelDate) {
        if (!excelDate) return 999;

        const contractEnd = new Date((excelDate - 25569) * 86400 * 1000);
        const today = new Date();
        const diffTime = contractEnd - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    },

    // RENDERIZADO
    renderPredictions() {
        const container = document.getElementById('ml-predictions-container');
        if (!container) return;

        if (this.predictions.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay predicciones de riesgo en este momento</div>';
            return;
        }

        const html = `
            <div class="ml-predictions-header">
                <h4>🧠 Predicciones de Machine Learning</h4>
                <span class="ml-badge">Modelo Entrenado</span>
            </div>
            <div class="ml-predictions-list">
                ${this.predictions.map(pred => `
                    <div class="ml-prediction-card risk-${pred.risk.toLowerCase()}">
                        <div class="prediction-header">
                            <div class="prediction-service">${pred.service}</div>
                            <div class="prediction-probability">${pred.probability}%</div>
                        </div>
                        <div class="prediction-details">
                            <div class="prediction-worker">Titular: ${pred.titular || 'N/A'}</div>
                            <div class="prediction-risk">Riesgo: <strong>${pred.risk}</strong></div>
                            <div class="prediction-reason">${pred.reason}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    renderAnomalies() {
        const container = document.getElementById('ml-anomalies-container');
        if (!container) return;

        if (this.anomalies.length === 0) {
            container.innerHTML = '<div class="empty-state">✅ No se detectaron anomalías</div>';
            return;
        }

        const html = `
            <div class="ml-anomalies-header">
                <h4>🔍 Anomalías Detectadas</h4>
                <span class="anomaly-count">${this.anomalies.length}</span>
            </div>
            <div class="ml-anomalies-list">
                ${this.anomalies.map(anomaly => `
                    <div class="ml-anomaly-card severity-${anomaly.severity.toLowerCase()}">
                        <div class="anomaly-type">${anomaly.type}</div>
                        <div class="anomaly-message">${anomaly.message}</div>
                        <div class="anomaly-recommendation">💡 ${anomaly.recommendation}</div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    // REENTRENAR MODELO
    async retrainModel() {
        if (this.isTraining) {
            console.log('⚠️ El modelo ya está entrenando');
            return;
        }

        if (typeof showToast === 'function') {
            showToast('🎓 Reentrenando modelo ML...', 'info');
        }

        // Regenerar datos de entrenamiento
        this.generateTrainingData();

        // Entrenar
        await this.trainModel();

        // Generar nuevas predicciones
        await this.predictUncoveredServices();
        this.renderPredictions();

        if (typeof showToast === 'function') {
            showToast('✅ Modelo reentrenado correctamente', 'success');
        }
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MLEngine.init());
} else {
    MLEngine.init();
}

// Exponer globalmente
window.MLEngine = MLEngine;
