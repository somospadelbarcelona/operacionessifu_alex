/* ==========================================================================
   SUPER MOTOR LIVE & VISTA EN TIEMPO REAL DE FICHAJES - SIFU GIRONA v2.0
   ========================================================================== */

(function () {
  'use strict';

  window.FichajesLiveEngine = {
    eventSource: null,
    connected: false,
    mode: 'init', // 'sse' | 'polling' | 'local'
    lastUpdate: null,
    nextSyncCountdown: 900, // 15 min en segundos
    countdownTimer: null,
    pollTimer: null,
    serverUrl: (location.port === '5006') ? '' : 'http://localhost:5006',

    init() {
      console.log('⚡ Iniciando FichajesLiveEngine v2.0...');
      this.startConnection();
      this.startCountdown();
    },

    startConnection() {
      const sseEndpoint = `${this.serverUrl}/api/fichajes/stream`;
      
      try {
        if (window.EventSource) {
          if (this.eventSource) {
            this.eventSource.close();
          }

          this.eventSource = new EventSource(sseEndpoint);

          this.eventSource.addEventListener('connected', (e) => {
            this.connected = true;
            this.mode = 'sse';
            this.updateBadgeStatus('live', '🟢 EN VIVO (STREAM SSE)');
            console.log('⚡ Conectado al bus SSE de fichajes');
          });

          this.eventSource.addEventListener('update', (e) => {
            try {
              const data = JSON.parse(e.data);
              this.onDataReceived(data);
            } catch (err) {
              console.warn('Error parseando datos SSE:', err);
            }
          });

          this.eventSource.onerror = (err) => {
            // Si falla el servidor SSE local, cambiamos a modo archivo/polling sin bloquear
            this.connected = false;
            this.mode = 'polling';
            this.updateBadgeStatus('polling', '🔵 MODO LOCAL / POLLING');
            this.setupPollingFallback();
          };
        } else {
          this.setupPollingFallback();
        }
      } catch (e) {
        this.setupPollingFallback();
      }
    },

    setupPollingFallback() {
      if (this.pollTimer) return;
      this.pollTimer = setInterval(() => {
        this.fetchLatestPayload();
      }, 45000); // Polling cada 45 segundos
    },

    async fetchLatestPayload() {
      try {
        const res = await fetch(`${this.serverUrl}/api/fichajes?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          this.onDataReceived(data);
          this.updateBadgeStatus('live', '🟢 CONECTADO (HTTP LOCAL)');
        }
      } catch (err) {
        // Fallback a script tag dinámico
        this.reloadScriptTag();
      }
    },

    reloadScriptTag() {
      const oldScript = document.getElementById('dynamic-fichajes-live-script');
      if (oldScript) oldScript.remove();
      const s = document.createElement('script');
      s.id = 'dynamic-fichajes-live-script';
      s.src = `fichajes_contraste_data.js?t=${Date.now()}`;
      s.onload = () => {
        if (window.FICHAJES_CONTRASTE_PAYLOAD) {
          this.onDataReceived(window.FICHAJES_CONTRASTE_PAYLOAD, false);
          this.updateBadgeStatus('local', '⚪ ARCHIVO LOCAL');
        }
      };
      document.head.appendChild(s);
    },

    onDataReceived(payload, showToast = true) {
      if (!payload || !payload.trabajadores) return;

      const prevSync = window.FICHAJES_CONTRASTE_PAYLOAD ? window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion : null;
      window.FICHAJES_CONTRASTE_PAYLOAD = payload;
      this.lastUpdate = new Date();
      this.nextSyncCountdown = (payload.sync_salud && payload.sync_salud.intervalo_min ? payload.sync_salud.intervalo_min * 60 : 900);

      if (window.FichajesModule && typeof window.FichajesModule.refreshUI === 'function') {
        window.FichajesModule.refreshUI();
      }

      if (showToast && prevSync && prevSync !== payload.fecha_sincronizacion) {
        this.showToast(`⚡ Fichajes actualizados: ${payload.fecha_sincronizacion} (${payload.total_trabajadores} auditados)`);
      }
    },

    startCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = setInterval(() => {
        if (this.nextSyncCountdown > 0) {
          this.nextSyncCountdown--;
        } else {
          this.nextSyncCountdown = 900;
          this.fetchLatestPayload();
        }
        this.renderCountdownText();
      }, 1000);
    },

    renderCountdownText() {
      const el = document.getElementById('fich-live-countdown');
      if (!el) return;
      const min = Math.floor(this.nextSyncCountdown / 60);
      const sec = this.nextSyncCountdown % 60;
      el.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    },

    updateBadgeStatus(type, text) {
      const badge = document.getElementById('fich-live-status-pill');
      if (!badge) return;
      badge.className = `fich-live-pill ${type}`;
      badge.innerHTML = `<span class="fich-live-indicator"></span> ${text}`;
    },

    showToast(message) {
      let toast = document.getElementById('fich-live-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'fich-live-toast';
        toast.className = 'fich-live-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 4000);
    },

    async triggerManualSync() {
      const btn = document.getElementById('fich-btn-sync');
      const txt = document.getElementById('fich-btn-sync-text');
      if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
      }
      if (txt) txt.textContent = 'Sincronizando en directo...';

      this.showToast('🚀 Lanzando auditoría en vivo en gruposifuapp.gcalidad.com...');

      try {
        // Intento 1: Servidor live 5006
        let res = null;
        try {
          res = await fetch(`${this.serverUrl}/api/fichajes/sync`, { method: 'POST' });
        } catch (e) {
          // Intento 2: Bridge existente en 5005
          res = await fetch('http://127.0.0.1:5005/sync_contraste', { cache: 'no-store' });
        }

        if (res && res.ok) {
          this.showToast('✅ Sincronización finalizada con éxito. Actualizando vista...');
          setTimeout(() => {
            this.fetchLatestPayload();
          }, 2000);
        } else {
          this.showToast('⚠️ La sincronización está ejecutándose en segundo plano.');
        }
      } catch (err) {
        this.showToast('⚠️ Conectando con el proceso en segundo plano...');
        this.reloadScriptTag();
      } finally {
        setTimeout(() => {
          if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
          }
          if (txt) txt.textContent = 'Sincronizar en Vivo';
        }, 5000);
      }
    }
  };

  // Inicializar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FichajesLiveEngine.init());
  } else {
    setTimeout(() => window.FichajesLiveEngine.init(), 200);
  }

})();
