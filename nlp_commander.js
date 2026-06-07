/**
 * NLP COMMANDER - Engine v1.0
 * Orquestador de Comandos por Voz y Texto para el ERP Inteligente.
 * Integra Web Speech API con el Asistente LLM y el Sistema de Navegación.
 */

const NLPCommander = {
    recognition: null,
    isListening: false,

    init() {
        console.log('🎙️ Inicializando NLP Commander...');
        this.setupSpeechRecognition();
        this.bindUI();
    },

    bindUI() {
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.toggleVoice());
        }

        const quickInput = document.getElementById('quick-input-bar');
        if (quickInput) {
            quickInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.processCommand(quickInput.value);
                    quickInput.value = '';
                }
            });
        }
    },

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('⚠️ Web Speech API no soportada en este navegador.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceUI(true);
            showToast('🎙️ Escuchando...', 'info');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('🗣️ Comando detectado:', transcript);
            this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Error de reconocimiento:', event.error);
            this.stopVoice();
        };

        this.recognition.onend = () => {
            this.stopVoice();
        };
    },

    toggleVoice() {
        if (this.isListening) {
            this.stopVoice();
        } else {
            this.startVoice();
        }
    },

    startVoice() {
        if (this.recognition) {
            try {
                this.recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    },

    stopVoice() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        this.isListening = false;
        this.updateVoiceUI(false);
    },

    updateVoiceUI(active) {
        const btn = document.getElementById('voice-btn');
        if (btn) {
            btn.style.background = active ? '#ef4444' : 'transparent';
            btn.style.color = active ? 'white' : 'inherit';
            if (active) btn.classList.add('pulse');
            else btn.classList.remove('pulse');
        }
    },

    processCommand(text) {
        const cmd = text.toLowerCase();
        
        // 1. INTENT: NAVEGACIÓN
        if (cmd.includes('ve a') || cmd.includes('mostrar') || cmd.includes('ver')) {
            if (cmd.includes('descubiertos')) return this.navigate('tab-descubiertos');
            if (cmd.includes('bajas')) return this.navigate('tab-bajas');
            if (cmd.includes('aldi')) return this.navigate('tab-aldi');
            if (cmd.includes('ruta') || cmd.includes('mapa')) return this.navigate('tab-avanzado');
            if (cmd.includes('resumen')) return this.navigate('tab-resumen');
            if (cmd.includes('smart') || cmd.includes('ia')) return this.navigate('tab-smarthub');
        }

        // 2. INTENT: ACCIONES
        if (cmd.includes('optimiza') || cmd.includes('calcula')) {
            showToast('🧬 Iniciando optimización genética de rutas...', 'info');
            this.navigate('tab-avanzado');
            // Simular click en botón de optimización si existe
            return;
        }

        // 3. FALLBACK: Enviar al Asistente LLM
        showToast('🧠 Consultando cerebro operativo...', 'info');
        if (window.LLMAssistant) {
            // Inyectar el texto en el chat y disparar
            const llmInput = document.getElementById('llm-input');
            if (llmInput) {
                llmInput.value = text;
                window.LLMAssistant.sendMessage();
                this.navigate('tab-smarthub');
            }
        }
    },

    navigate(tabId) {
        const tabBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (tabBtn) {
            tabBtn.click();
            showToast(`🚀 Navegando a ${tabId.split('-')[1].toUpperCase()}`, 'success');
        } else {
            // Fallback directo al content
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';
        }
    }
};

window.NLPCommander = NLPCommander;
document.addEventListener('DOMContentLoaded', () => NLPCommander.init());
