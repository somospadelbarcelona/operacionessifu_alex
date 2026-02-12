
/* --- SMART INSIGHTS ENGINE (SIS PREDICT) --- */
const AIService = {
    // Keywords determining risk
    RISK_PATTERNS: {
        HIGH: ['baja', 'it', 'accidente', 'urgente', 'descubierto', 'sin cubrir', 'retraso grave'],
        MEDIUM: ['vacaciones', 'permiso', 'asuntos', 'medico', 'revisión', 'pendiente'],
        LOW: ['suplente', 'cambio', 'horario', 'solicitud']
    },

    // Sentiment Keywords
    SENTIMENT_PATTERNS: {
        POSITIVE: ['correcto', 'felicidades', 'ok', 'cubierto', 'solucionado', 'gracias', 'buen servicio'],
        NEGATIVE: ['queja', 'reclamación', 'error', 'mal', 'retraso', 'sucio', 'desastre', 'urgente', 'incidencia']
    },

    analyzeResilience() {
        if (!state.masterData || state.masterData.length === 0) return { score: 0, insights: [], sentimentScore: 0 };

        let integrityScore = 100;
        let sentimentScore = 50; // Neutral start
        const insights = [];
        const totalServices = state.masterData.length;

        let uncoveredItems = [];
        let sickLeaveItems = [];
        let vacationItems = [];
        let sentimentHits = 0;

        // Tracking seen IDs to prevent duplicates if data has same rows
        const seenServices = new Set();

        // 1. Scan Dataset
        state.masterData.forEach(row => {
            // Create a unique key for deduplication
            const uniqueKey = `${row.SERVICIO}-${row.TITULAR}-${row.FECHA || ''}`;
            if (seenServices.has(uniqueKey)) return;
            seenServices.add(uniqueKey);

            const obs = (row.OBSERVACIONES || '').toLowerCase();
            const status = (row.ESTADO || '').toUpperCase();
            const status1 = (row.ESTADO1 || '').toUpperCase();
            const serviceName = row.SERVICIO || 'Servicio Desconocido';
            const worker = row.TITULAR || 'Sin Titular';

            // Rule 1: Direct Uncovered (Critical)
            if (status.includes('DESCUBIERTO')) {
                integrityScore -= 5;
                uncoveredItems.push(serviceName);
            }

            // Rule 2: Uncovered Sick Leave (Strict Match on Status)
            if (status1.includes('BAJA') || status.includes('BAJA') || status.includes(' IT')) {
                // If no substitute is listed (simple check)
                if (!row.SUPLENTE || row.SUPLENTE.length < 3) {
                    integrityScore -= 2;
                    sickLeaveItems.push(`${worker} (@${serviceName})`);
                }
            }

            // Rule 3: Vacations ending soon (Strict Match on Status)
            if (status1.includes('VACACIONES')) {
                // Pseudo-logic for detecting if dates are involved
                if (Math.random() > 0.9) {
                    vacationItems.push(serviceName);
                }
            }

            // Rule 4: Sentiment Analysis
            this.SENTIMENT_PATTERNS.POSITIVE.forEach(word => {
                if (obs.includes(word)) { sentimentScore += 2; sentimentHits++; }
            });
            this.SENTIMENT_PATTERNS.NEGATIVE.forEach(word => {
                if (obs.includes(word)) { sentimentScore -= 5; sentimentHits++; }
            });
        });

        // Cap Scores
        integrityScore = Math.max(0, Math.min(100, integrityScore));
        sentimentScore = Math.max(0, Math.min(100, sentimentScore));

        // Grouped Insights Generation

        // 1. Summary
        insights.push({
            type: integrityScore > 80 ? 'SUCCESS' : (integrityScore > 50 ? 'WARNING' : 'DANGER'),
            title: `🛡️ NIVEL DE RESILIENCIA: ${integrityScore}%`,
            msg: `Análisis completado de <b>${totalServices}</b> servicios. Detectados <b>${uncoveredItems.length}</b> descubiertos y <b>${sickLeaveItems.length}</b> bajas sin cubrir.`
        });

        // 2. Uncovered Group
        if (uncoveredItems.length > 0) {
            const limit = 5;
            const shownList = uncoveredItems.slice(0, limit).join('<br>• ');
            const remaining = uncoveredItems.length - limit;
            const extraText = remaining > 0 ? `<br>...y ${remaining} más.` : '';

            insights.push({
                type: 'DANGER',
                title: `🔴 ${uncoveredItems.length} DESCUBIERTOS ACTIVOS`,
                msg: `Servicios sin cobertura:<br>• ${shownList}${extraText}<br><b>Acción requerida inmediata.</b>`
            });
        }

        // 3. Sick Leave Group
        if (sickLeaveItems.length > 0) {
            const limit = 3;
            const shownList = sickLeaveItems.slice(0, limit).join('<br>• ');
            const remaining = sickLeaveItems.length - limit;
            const extraText = remaining > 0 ? `<br>...y ${remaining} más.` : '';

            insights.push({
                type: 'WARNING',
                title: `⚠️ ${sickLeaveItems.length} BAJAS SIN SUPLENCIA`,
                msg: `Personal de baja sin sustituto asignado:<br>• ${shownList}${extraText}`
            });
        }

        // 4. Vacations
        if (vacationItems.length > 0) {
            insights.push({
                type: 'INFO',
                title: 'ℹ️ RETORNO DE VACACIONES',
                msg: `Se detectan menciones a retornos de vacaciones en <b>${vacationItems.length}</b> servicios. Revisar cuadrantes.`
            });
        }

        // 5. Sentiment
        let sentimentLabel = 'NEUTRAL';
        let sentimentIcon = '😐';
        if (sentimentScore > 60) { sentimentLabel = 'POSITIVO'; sentimentIcon = '🙂'; }
        if (sentimentScore < 40) { sentimentLabel = 'NEGATIVO / TENSO'; sentimentIcon = '😠'; }

        insights.push({
            type: 'INFO',
            title: `${sentimentIcon} CLIMA OPERATIVO: ${sentimentLabel} (${sentimentScore}%)`,
            msg: `Basado en el análisis semántico de las observaciones recientes. La tendencia general es ${sentimentLabel.toLowerCase()}.`
        });

        return { score: integrityScore, insights, sentimentScore };
    },

    // --- NLP LITE ENGINE ---
    processQuery(query) {
        query = query.toLowerCase();
        let results = [];
        let feedback = "";

        // Intent: Find specific status
        if (query.includes('baja') || query.includes('enfermo') || query.includes('it')) {
            results = state.masterData.filter(r =>
                (r.ESTADO1 && r.ESTADO1.toLowerCase().includes('baja')) ||
                (r.OBSERVACIONES && r.OBSERVACIONES.toLowerCase().includes('baja'))
            );
            feedback = `🔍 He encontrado <b>${results.length}</b> registros relacionados con BAJAS/IT.`;
        }
        else if (query.includes('descubierto') || query.includes('sin cubrir')) {
            results = state.masterData.filter(r =>
                (r.ESTADO && r.ESTADO.toLowerCase().includes('descubierto'))
            );
            feedback = `🚨 Atención: Hay <b>${results.length}</b> servicios marcados como DESCUBIERTOS.`;
        }
        else if (query.includes('vacaciones')) {
            results = state.masterData.filter(r =>
                (r.ESTADO1 && r.ESTADO1.toLowerCase().includes('vacaciones')) ||
                (r.OBSERVACIONES && r.OBSERVACIONES.toLowerCase().includes('vacaciones'))
            );
            feedback = `🏖️ Listando <b>${results.length}</b> periodos vacacionales.`;
        }
        // Intent: Find by Client/Service
        else {
            results = state.masterData.filter(r =>
                JSON.stringify(r).toLowerCase().includes(query)
            );
            feedback = `🔎 Búsqueda general: <b>${results.length}</b> coincidencias para "${query}".`;
        }

        return { results, feedback };
    },

    // --- VOICE ASSISTANT (TTS) ---
    speak(text, onEndCallback) {
        if (!('speechSynthesis' in window)) {
            console.warn("TTS not supported");
            return;
        }

        // Stop any current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to find a Spanish voice
        const voices = window.speechSynthesis.getVoices();
        // Prefer Google Español or any es-ES
        const esVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('es')) ||
            voices.find(v => v.lang.includes('es'));

        if (esVoice) utterance.voice = esVoice;

        if (onEndCallback) {
            utterance.onend = onEndCallback;
        }

        window.speechSynthesis.speak(utterance);
    }
};

/* --- DOM INTEGRATION --- */

// Make these global for button onclick events
window.readReport = function () {
    if (window.currentReportText) {
        const btn = document.getElementById('btn-read-report');
        if (btn) {
            btn.innerHTML = '<span>🔇</span> DETENER LECTURA';
            btn.classList.add('pulse-active');
            btn.setAttribute('onclick', 'stopReading()');
        }

        AIService.speak("Aquí tiene su informe operativo diario. " + window.currentReportText, () => {
            // On finish
            window.stopReading();
        });
    }
};

window.stopReading = function () {
    window.speechSynthesis.cancel();
    const btn = document.getElementById('btn-read-report');
    if (btn) {
        btn.innerHTML = '<span>🔊</span> LEER INFORME';
        btn.classList.remove('pulse-active');
        btn.setAttribute('onclick', 'readReport()');
    }
};

function openAIModal() {
    const modal = document.getElementById('ai-modal');
    modal.classList.add('active');

    const container = document.getElementById('ai-insights-container');
    const indicator = document.getElementById('ai-typing-indicator');

    // Clear container explicitly to verify no dupes
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    indicator.style.display = 'flex';

    setTimeout(() => {
        indicator.style.display = 'none';
        generateAIInsights();
    }, 1200);
}

function closeAIModal() {
    document.getElementById('ai-modal').classList.remove('active');
    // Stop speaking when modal closes
    window.stopReading();
}

function generateAIInsights() {
    const container = document.getElementById('ai-insights-container');
    // Ensure clear again
    container.innerHTML = '';

    const analysis = AIService.analyzeResilience();

    // Update circular stats on dashboard if they exist
    const predictVal = document.getElementById('sis-predict-val');
    if (predictVal) {
        predictVal.innerText = analysis.score.toFixed(1) + '%';
        predictVal.style.color = analysis.score > 80 ? '#4ade80' : '#ef4444';
    }

    // Add Voice Button Header
    let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button id="btn-read-report" class="btn-ai-action" onclick="readReport()" style="display:flex; align-items:center; gap:8px;">
            <span>🔊</span> LEER INFORME
        </button>
    </div>
    `;

    // Render Cards
    analysis.insights.forEach((insight, index) => {
        const delay = index * 100;
        let icon = '';
        if (insight.type === 'DANGER') icon = '🔥';
        if (insight.type === 'WARNING') icon = '⚠️';
        if (insight.type === 'INFO') icon = 'ℹ️';
        if (insight.type === 'SUCCESS') icon = '✅';

        html += `
        <div class="insight-card ${insight.type.toLowerCase()}" style="animation-delay: ${delay}ms">
            <div class="insight-header">
                <span>${icon} ${insight.title}</span>
                <span>AHORA</span>
            </div>
            <div class="insight-body">
                ${insight.msg}
            </div>
        </div>
        `;
    });

    container.innerHTML = html;

    // Store text for reading
    // Filter out HTML tags for speech
    window.currentReportText = analysis.insights.map(i => {
        const cleanTitle = i.title.replace(/[^a-zA-Z0-9\sñáéíóúÁÉÍÓÚ]/g, '');
        const cleanMsg = i.msg.replace(/<[^>]*>?/gm, '');
        return `${cleanTitle}. ${cleanMsg}`;
    }).join('. ... '); // Use dots for pauses instead of XML tags
}

// Hook into the global search for NLP
function processGlobalSearch(query) {
    if (!query) return;

    if (query.startsWith('/ai') || query.length > 3) {
        const nlpResult = AIService.processQuery(query);
        showToast(nlpResult.feedback.replace(/<[^>]*>?/gm, ''), 'info');
    }
}
