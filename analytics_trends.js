/**
 * ANALYTICS TRENDS - Motor de Análisis de Tendencias
 * Analiza patrones históricos y genera insights predictivos
 */

const AnalyticsTrends = {
    historicalData: [],
    insights: [],

    init() {
        console.log('📊 Inicializando Motor de Análisis de Tendencias...');
        this.loadHistoricalData();
        this.captureCurrentSnapshot();
        this.analyzePatterns();
    },

    loadHistoricalData() {
        const saved = localStorage.getItem('sifu_historical_data_v1');
        if (saved) {
            this.historicalData = JSON.parse(saved);
        }
    },

    saveHistoricalData() {
        localStorage.setItem('sifu_historical_data_v1', JSON.stringify(this.historicalData));
    },

    captureCurrentSnapshot() {
        if (!window.state || !window.state.masterData) return;

        const today = new Date().toISOString().split('T')[0];

        // Verificar si ya existe snapshot de hoy
        const existingToday = this.historicalData.find(h => h.date === today);
        if (existingToday) return;

        const snapshot = {
            date: today,
            timestamp: new Date().toISOString(),
            metrics: this.calculateMetrics(window.state.masterData)
        };

        this.historicalData.push(snapshot);

        // Mantener solo últimos 180 días
        if (this.historicalData.length > 180) {
            this.historicalData = this.historicalData.slice(-180);
        }

        this.saveHistoricalData();
    },

    calculateMetrics(data) {
        const total = data.length;
        const descubiertos = data.filter(s => s.ESTADO === 'DESCUBIERTO').length;
        const bajasIT = data.filter(s => s.ESTADO1 === 'BAJA IT').length;
        const bajasITSinSuplente = data.filter(s => s.ESTADO1 === 'BAJA IT' && (!s.SUPLENTE || s.SUPLENTE === 'EMERGENCIAS')).length;
        const vacaciones = data.filter(s => s.ESTADO1 === 'VACACIONES').length;
        const cubiertos = data.filter(s => s.ESTADO === 'CUBIERTO').length;
        const cobertura = total > 0 ? (cubiertos / total * 100).toFixed(2) : 0;

        // Contratos que terminan en próximos 30 días
        const today = new Date();
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);

        const contractsEnding = data.filter(s => {
            if (!s['FIN CONTRATO']) return false;
            const endDate = this.excelDateToJS(s['FIN CONTRATO']);
            return endDate && endDate >= today && endDate <= in30Days;
        }).length;

        // Servicios por tipo
        const byType = {};
        data.forEach(s => {
            const type = s['TIPO S'] || 'OTRO';
            byType[type] = (byType[type] || 0) + 1;
        });

        return {
            total,
            descubiertos,
            bajasIT,
            bajasITSinSuplente,
            vacaciones,
            cubiertos,
            cobertura: parseFloat(cobertura),
            contractsEnding,
            byType
        };
    },

    analyzePatterns() {
        if (this.historicalData.length < 7) {
            console.log('📊 Datos insuficientes para análisis de tendencias (mínimo 7 días)');
            return;
        }

        this.insights = [];

        // 1. TENDENCIA DE DESCUBIERTOS
        const descubiertosLast7 = this.getLastNDays(7).map(d => d.metrics.descubiertos);
        const descubiertosLast30 = this.getLastNDays(30).map(d => d.metrics.descubiertos);
        const avgLast7 = this.average(descubiertosLast7);
        const avgLast30 = this.average(descubiertosLast30);

        if (avgLast7 > avgLast30 * 1.2) {
            this.insights.push({
                type: 'warning',
                category: 'descubiertos',
                title: '⚠️ Aumento de Descubiertos',
                message: `Los descubiertos han aumentado un ${((avgLast7 / avgLast30 - 1) * 100).toFixed(0)}% en la última semana`,
                recommendation: 'Revisar causas y reforzar búsqueda de suplentes'
            });
        } else if (avgLast7 < avgLast30 * 0.8) {
            this.insights.push({
                type: 'success',
                category: 'descubiertos',
                title: '✅ Mejora en Cobertura',
                message: `Los descubiertos han disminuido un ${((1 - avgLast7 / avgLast30) * 100).toFixed(0)}% en la última semana`,
                recommendation: 'Mantener las estrategias actuales'
            });
        }

        // 2. TENDENCIA DE BAJAS IT
        const bajasLast7 = this.getLastNDays(7).map(d => d.metrics.bajasIT);
        const bajasLast30 = this.getLastNDays(30).map(d => d.metrics.bajasIT);
        const avgBajasLast7 = this.average(bajasLast7);
        const avgBajasLast30 = this.average(bajasLast30);

        if (avgBajasLast7 > avgBajasLast30 * 1.3) {
            this.insights.push({
                type: 'warning',
                category: 'bajas_it',
                title: '🏥 Incremento de Bajas IT',
                message: `Las bajas IT han aumentado un ${((avgBajasLast7 / avgBajasLast30 - 1) * 100).toFixed(0)}% en la última semana`,
                recommendation: 'Posible brote estacional. Preparar pool de suplentes'
            });
        }

        // 3. ESTACIONALIDAD (si hay datos de varios meses)
        if (this.historicalData.length >= 60) {
            const seasonality = this.detectSeasonality();
            if (seasonality) {
                this.insights.push(seasonality);
            }
        }

        // 4. PREDICCIÓN PARA PRÓXIMA SEMANA
        const prediction = this.predictNextWeek();
        if (prediction) {
            this.insights.push(prediction);
        }

        // 5. SERVICIOS MÁS PROBLEMÁTICOS
        const problematicServices = this.identifyProblematicServices();
        if (problematicServices.length > 0) {
            this.insights.push({
                type: 'info',
                category: 'servicios',
                title: '🔍 Servicios con Mayor Rotación',
                message: `${problematicServices.length} servicios han tenido múltiples cambios`,
                recommendation: 'Revisar condiciones y estabilidad de estos servicios',
                data: problematicServices
            });
        }

        console.log('📊 Insights generados:', this.insights);
    },

    detectSeasonality() {
        // Detectar si hay patrones estacionales (ej: más bajas en invierno)
        const monthlyAvg = {};

        this.historicalData.forEach(snapshot => {
            const month = new Date(snapshot.date).getMonth();
            if (!monthlyAvg[month]) {
                monthlyAvg[month] = { bajasIT: [], descubiertos: [] };
            }
            monthlyAvg[month].bajasIT.push(snapshot.metrics.bajasIT);
            monthlyAvg[month].descubiertos.push(snapshot.metrics.descubiertos);
        });

        // Calcular promedios por mes
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        let maxBajas = { month: 0, avg: 0 };
        Object.keys(monthlyAvg).forEach(month => {
            const avg = this.average(monthlyAvg[month].bajasIT);
            if (avg > maxBajas.avg) {
                maxBajas = { month: parseInt(month), avg };
            }
        });

        if (maxBajas.avg > 0) {
            return {
                type: 'info',
                category: 'estacionalidad',
                title: '📅 Patrón Estacional Detectado',
                message: `${monthNames[maxBajas.month]} suele tener más bajas IT (promedio: ${maxBajas.avg.toFixed(1)})`,
                recommendation: 'Planificar recursos adicionales para este periodo'
            };
        }

        return null;
    },

    predictNextWeek() {
        const last14Days = this.getLastNDays(14);
        if (last14Days.length < 14) return null;

        const descubiertos = last14Days.map(d => d.metrics.descubiertos);
        const trend = this.calculateTrend(descubiertos);

        const currentAvg = this.average(descubiertos.slice(-7));
        const predictedAvg = currentAvg + trend * 7;

        if (predictedAvg > currentAvg * 1.2) {
            return {
                type: 'warning',
                category: 'prediccion',
                title: '🔮 Predicción: Aumento de Descubiertos',
                message: `Se espera un incremento a ~${Math.round(predictedAvg)} descubiertos la próxima semana`,
                recommendation: 'Preparar estrategias preventivas'
            };
        } else if (predictedAvg < currentAvg * 0.8) {
            return {
                type: 'success',
                category: 'prediccion',
                title: '🔮 Predicción: Mejora en Cobertura',
                message: `Se espera una reducción a ~${Math.round(predictedAvg)} descubiertos la próxima semana`,
                recommendation: 'Continuar con las acciones actuales'
            };
        }

        return null;
    },

    identifyProblematicServices() {
        // Identificar servicios que aparecen frecuentemente como descubiertos
        // (Requiere datos históricos más detallados - placeholder)
        return [];
    },

    renderTrendsChart() {
        const container = document.getElementById('trends-chart-container');
        if (!container) return;

        if (this.historicalData.length < 2) {
            container.innerHTML = '<div class="empty-state">Recopilando datos históricos...</div>';
            return;
        }

        const last30 = this.getLastNDays(30);
        const labels = last30.map(d => new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }));
        const descubiertos = last30.map(d => d.metrics.descubiertos);
        const bajasIT = last30.map(d => d.metrics.bajasIT);
        const cobertura = last30.map(d => d.metrics.cobertura);

        // Usar Chart.js si está disponible
        if (typeof Chart !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.id = 'trendsChart';
            container.innerHTML = '';
            container.appendChild(canvas);

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Descubiertos',
                            data: descubiertos,
                            borderColor: '#ea4335',
                            backgroundColor: 'rgba(234, 67, 53, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Bajas IT',
                            data: bajasIT,
                            borderColor: '#fbbc04',
                            backgroundColor: 'rgba(251, 188, 4, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Cobertura %',
                            data: cobertura,
                            borderColor: '#34a853',
                            backgroundColor: 'rgba(52, 168, 83, 0.1)',
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Cantidad' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Cobertura %' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    },

    renderInsights() {
        const container = document.getElementById('insights-container');
        if (!container) return;

        if (this.insights.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay insights disponibles todavía</div>';
            return;
        }

        const html = this.insights.map(insight => {
            const typeClass = {
                'warning': 'insight-warning',
                'success': 'insight-success',
                'info': 'insight-info'
            }[insight.type] || 'insight-info';

            return `
                <div class="insight-card ${typeClass}">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                    <div class="insight-recommendation">💡 ${insight.recommendation}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    // Utilidades matemáticas
    average(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    },

    calculateTrend(arr) {
        // Regresión lineal simple
        const n = arr.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = arr.reduce((sum, val) => sum + val, 0);
        const sumXY = arr.reduce((sum, val, i) => sum + i * val, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    },

    getLastNDays(n) {
        return this.historicalData.slice(-n);
    },

    excelDateToJS(excelDate) {
        if (!excelDate) return null;
        return new Date((excelDate - 25569) * 86400 * 1000);
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AnalyticsTrends.init());
} else {
    AnalyticsTrends.init();
}
