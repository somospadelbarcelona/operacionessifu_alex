/**
 * LLM ASSISTANT ENGINE (Enterprise Phase)
 * Convierte el MasterData en un "Prompt Context" y permite consultas en Lenguaje Natural.
 */

const LLMAssistant = {
    settings: {
        provider: 'simulated',
        apiKey: ''
    },
    messageHistory: [],

    init() {
        console.log("✨ Inicializando Asistente LLM...");
        this.loadConfig();
        // Wait briefly for DOM
        setTimeout(() => this.updateConfigUI(), 500);
    },

    loadConfig() {
        const saved = localStorage.getItem('sifu_llm_settings');
        if (saved) {
            try {
                this.settings = JSON.parse(saved);
            } catch (e) { console.error("Error loading LLM config:", e); }
        }
    },

    saveConfig() {
        const keyInput = document.getElementById('llm-api-key');
        const provInput = document.getElementById('llm-provider');

        if (keyInput && provInput) {
            this.settings.apiKey = keyInput.value.trim();
            this.settings.provider = provInput.value;
            localStorage.setItem('sifu_llm_settings', JSON.stringify(this.settings));
            this.toggleConfig();

            // System Notification
            this.addMessage('bot', `✅ Configuración guardada. Proveedor actual: **${this.settings.provider.toUpperCase()}**.`);
        }
    },

    updateConfigUI() {
        const keyInput = document.getElementById('llm-api-key');
        const provInput = document.getElementById('llm-provider');
        if (keyInput && provInput) {
            keyInput.value = this.settings.apiKey;
            provInput.value = this.settings.provider;
        }
    },

    toggleConfig() {
        const panel = document.getElementById('llm-config-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    },

    // ------------------------------------------------------------------------
    // CORE CHAT LOGIC
    // ------------------------------------------------------------------------

    handleInputKey(e) {
        if (e.key === 'Enter') {
            this.sendMessage();
        }
    },

    async sendMessage() {
        const inputEl = document.getElementById('llm-input');
        const text = inputEl.value.trim();
        if (!text) return;

        // Limpiar Input
        inputEl.value = '';

        // Add user message
        this.addMessage('user', text);
        this.messageHistory.push({ role: 'user', content: text });

        // Show thinking indicator
        const thinkingId = this.addThinkingIndicator();

        // 1. EXTRAER CONTEXTO (Magia en tiempo real)
        const contextStr = this.buildContextPrompt();

        try {
            let replyText = "";

            if (this.settings.provider === 'openai' && this.settings.apiKey) {
                replyText = await this.callOpenAI(text, contextStr);
            } else if (this.settings.provider === 'groq' && this.settings.apiKey) {
                // Compatible with OpenAI API specs usually, but let's mock the fetch for safety
                replyText = await this.callGroq(text, contextStr);
            } else {
                // Fallback Simulado (Lógica RegEx Local sobre MasterData)
                replyText = await this.simulateResponse(text, contextStr);
            }

            this.removeThinkingIndicator(thinkingId);
            this.addMessage('bot', replyText);
            this.messageHistory.push({ role: 'assistant', content: replyText });

        } catch (error) {
            console.error("LLM Error:", error);
            this.removeThinkingIndicator(thinkingId);
            this.addMessage('bot', `⚠️ Se produjo un error al conectar: ${error.message}`);
        }
    },

    buildContextPrompt() {
        if (!window.state || !window.state.masterData) return "No hay datos de Master disponibles en memoria.";

        const data = window.state.masterData;

        // Extraer métricas vitales
        const uncovered = data.filter(d => (d.ESTADO || '').toUpperCase() === 'DESCUBIERTO');
        const medical = data.filter(d => (d.ESTADO1 || '').toUpperCase().includes('BAJA') || (d.ESTADO || '').toUpperCase().includes('BAJA'));

        const uncoverStr = uncovered.map(u => `- Centro: ${u.SERVICIO || 'Desconocido'}, Extracción: Urgente`).join("\n");
        const medicalStr = medical.map(m => `- Centro: ${m.SERVICIO}, Titular de baja: ${m.TITULAR}`).slice(0, 10).join("\n"); // Limit 10 to avoid token explosion

        return `
[SISTEMA EN TIEMPO REAL: SIFU INFORMER]
La fecha actual es: ${new Date().toLocaleDateString('es-ES')}.
Datos de la plantilla actual de la empresa:
- Total Operativos en nómina: ${data.length}
- Total Bajas IT o Ausencias: ${medical.length}
- Total Servicios DESCUBIERTOS (Crítico): ${uncovered.length}

Detalle de Descubiertos Activos:
${uncovered.length > 0 ? uncoverStr : 'Ninguno. Todo está cubierto.'}

Detalle de Top Bajas (Últimas 10 detectadas):
${medical.length > 0 ? medicalStr : 'Ninguna baja registrada.'}

Tu rol es ser un Asistente Ejecutivo. Responde de forma concisa, profesional e inteligente. Utiliza negritas para destacar centros laborales o nombres importantes.
`;
    },

    // ------------------------------------------------------------------------
    // API CALLS (OpenAI, Groq, Simulated)
    // ------------------------------------------------------------------------

    async callOpenAI(userMessage, systemPrompt) {
        const _messages = [
            { role: "system", content: systemPrompt },
            ...this.messageHistory.slice(-4), // keep context of last 4 msgs
            { role: "user", content: userMessage }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: _messages,
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error("API Key inválida o límite excedido.");
        const data = await response.json();
        return data.choices[0].message.content;
    },

    async callGroq(userMessage, systemPrompt) {
        const _messages = [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }];
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.settings.apiKey}` },
            body: JSON.stringify({ model: "llama3-8b-8192", messages: _messages, temperature: 0.3 })
        });
        if (!response.ok) throw new Error("Fallo en API Groq");
        const data = await response.json();
        return data.choices[0].message.content;
    },

    async simulateResponse(text, systemPrompt) {
        // NLP Básico basado en RegEx para versión gratuita/offline
        await new Promise(r => setTimeout(r, 1200)); // Simulate delay

        const q = text.toLowerCase();

        if (q.includes("descubierto") || q.includes("urgencia") || q.includes("problema")) {
            const data = window.state.masterData || [];
            const uncovered = data.filter(d => (d.ESTADO || '').toUpperCase() === 'DESCUBIERTO');
            if (uncovered.length === 0) return "✅ He analizado la memoria cruzada. Actualmente **no hay servicios descubiertos**. La jornada está totalmente cubierta.";
            const firstFew = uncovered.slice(0, 3).map(u => `🔴 **${u.SERVICIO}**`).join("\n");
            return `🚨 Actualmente tenemos **${uncovered.length} servicios descubiertos**. He aquí los más críticos:\n${firstFew}\n\nTe recomiendo revisar la pestaña de 'Descubiertos' para iniciar la asignación de suplentes vía WhatsApp automatizado.`;
        }

        if (q.includes("baja") || q.includes("enfermo") || q.includes("ausencia")) {
            const data = window.state.masterData || [];
            const medical = data.filter(d => (d.ESTADO1 || '').toUpperCase().includes('BAJA') || (d.ESTADO || '').toUpperCase().includes('BAJA'));
            return `🏥 Ahora mismo hay **${medical.length} bajas activas** registradas en el Master Principal. ¿Deseas que prepare una alerta para el departamento de prevención?`;
        }

        if (q.includes("resumen") || q.includes("estado") || q.includes("tal")) {
            return `📊 **INFORME RÁPIDO**:\nEl motor operativo está en marcha. Tenemos información sincronizada de toda la red.\nPor favor, dirígete al panel "Resumen" para ver las gráficas de impacto en tiempo real. ¿Puedo ayudarte a buscar algún trabajador específico?`;
        }

        return "💬 (Modo Simulado) Entiendo tu mensaje, pero mi módulo local (offline) tiene vocabulario limitado. Prueba preguntarme sobre **descubiertos**, **bajas** o **estado general**.";
    },

    // ------------------------------------------------------------------------
    // UI HELPERS
    // ------------------------------------------------------------------------

    addMessage(sender, text) {
        const container = document.getElementById('llm-messages');
        if (!container) return;

        const isBot = sender === 'bot';

        // Basic Markdown parser for robust UI formatting
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        const el = document.createElement('div');
        el.className = `llm-msg ${sender}`;
        el.innerHTML = `
            ${isBot ? '<div class="avatar">✨</div>' : ''}
            <div class="bubble">${formattedText}</div>
            ${!isBot ? '<div class="avatar">👤</div>' : ''}
        `;

        container.appendChild(el);
        this.scrollToBottom(container);
    },

    addThinkingIndicator() {
        const container = document.getElementById('llm-messages');
        if (!container) return null;

        const id = 'thinking-' + Date.now();
        const el = document.createElement('div');
        el.className = 'llm-msg bot';
        el.id = id;
        el.innerHTML = `
            <div class="avatar">✨</div>
            <div class="bubble thinking">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
        `;
        container.appendChild(el);
        this.scrollToBottom(container);
        return id;
    },

    removeThinkingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    scrollToBottom(container) {
        container.scrollTop = container.scrollHeight;
    }
};

// Start System
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LLMAssistant.init());
} else {
    setTimeout(() => LLMAssistant.init(), 100);
}
