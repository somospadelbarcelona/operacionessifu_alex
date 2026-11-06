/* ==========================================================================
   SUPER MOTOR LIVE & VISTA EN TIEMPO REAL DE FICHAJES - SIFU BARCELONA v2.1
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
    syncElapsedTimer: null,
    syncWatcherTimer: null,
    isSyncing: false,
    serverUrl: (location.port === '5006') ? '' : 'http://localhost:5006',

    init() {
      console.log('⚡ Iniciando FichajesLiveEngine v2.1...');
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

          this.eventSource.addEventListener('sync_status', (e) => {
            try {
              const info = JSON.parse(e.data);
              console.log('⚡ Sync status SSE:', info);
              if (info.status === 'running') {
                this.setBtnSyncing(true, 'Auditoría en curso...');
              } else if (info.status === 'completed') {
                this.showToast(`✅ Sincronización en vivo completada (${info.fecha || 'actualizada'}).`);
                this.setBtnSyncing(false);
                this.fetchLatestPayload();
              } else if (info.status === 'error') {
                this.showToast(`⚠️ Error en auditoría: ${info.error || 'revisar logs'}`);
                this.setBtnSyncing(false);
              }
            } catch (err) {
              console.warn('Error en SSE sync_status:', err);
            }
          });

          this.eventSource.addEventListener('update', (e) => {
            try {
              const data = JSON.parse(e.data);
              this.onDataReceived(data);
              this.setBtnSyncing(false);
            } catch (err) {
              console.warn('Error parseando datos SSE:', err);
            }
          });

          this.eventSource.onerror = (err) => {
            // Si falla el servidor SSE local, cambiamos a modo HTTP polling sin bloquear
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
        const res = await fetch(`${this.serverUrl}/api/fichajes`, { cache: 'no-cache' }) // ETag → 304 si no hay cambios;
        if (res.ok) {
          const data = await res.json();
          this.onDataReceived(data);
          this.updateBadgeStatus('live', '🟢 CONECTADO (HTTP LOCAL)');
          return;
        }
      } catch (err) {
        // Fallback a script tag dinámico
      }
      this.reloadScriptTag();
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
          if (this.mode !== 'sse') {
            this.updateBadgeStatus('local', '⚪ ARCHIVO LOCAL');
          }
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

      // Guardar en localStorage para persistencia
      if (payload.fecha_sincronizacion) {
        localStorage.setItem('sifu_fichajes_last_sync_contraste', payload.fecha_sincronizacion);
        const lbl = document.getElementById('fich-last-sync-label');
        if (lbl) lbl.textContent = payload.fecha_sincronizacion;
      }

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
      }, 4500);
    },

    setBtnSyncing(active, customText) {
      const btn = document.getElementById('fich-btn-sync');
      const txt = document.getElementById('fich-btn-sync-text');

      if (active) {
        this.isSyncing = true;
        if (btn) {
          btn.classList.add('syncing');
          btn.disabled = true;
        }

        if (this.syncElapsedTimer) clearInterval(this.syncElapsedTimer);
        let sec = 0;
        if (txt) txt.textContent = customText || 'Sincronizando 48 trabajadores... (0s)';

        this.syncElapsedTimer = setInterval(() => {
          sec++;
          if (txt && this.isSyncing) {
            txt.textContent = customText ? `${customText} (${sec}s)` : `Sincronizando 48 trabajadores... (${sec}s)`;
          }
        }, 1000);
      } else {
        this.isSyncing = false;
        if (this.syncElapsedTimer) {
          clearInterval(this.syncElapsedTimer);
          this.syncElapsedTimer = null;
        }
        if (this.syncWatcherTimer) {
          clearInterval(this.syncWatcherTimer);
          this.syncWatcherTimer = null;
        }
        if (btn) {
          btn.classList.remove('syncing');
          btn.disabled = false;
        }
        if (txt) {
          txt.textContent = 'Sincronizar en Vivo (gruposifuapp)';
        }
      }
    },

    async triggerManualSync() {
      if (this.isSyncing) return;
      this.setBtnSyncing(true, 'Iniciando auditoría en vivo...');
      this.showToast('🚀 Lanzando auditoría en vivo en gruposifuapp.gcalidad.com...');

      let liveServerUsed = false;

      try {
        // Intento 1: Servidor live en puerto 5006
        try {
          const res = await fetch(`${this.serverUrl}/api/fichajes/sync`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (res && (res.ok || res.status === 200 || res.status === 409)) {
            const data = await res.json();
            liveServerUsed = true;
            this.showToast('⚡ Auditoría ejecutándose en segundo plano con 5 navegadores concurrentes...');
            this.setBtnSyncing(true, 'Extrayendo marcajes Playwright...');

            // Iniciar observador de salud para detectar cuándo termina
            if (this.syncWatcherTimer) clearInterval(this.syncWatcherTimer);
            let checks = 0;
            this.syncWatcherTimer = setInterval(async () => {
              checks++;
              try {
                const hRes = await fetch(`${this.serverUrl}/api/fichajes/health?t=${Date.now()}`);
                if (hRes.ok) {
                  const health = await hRes.json();
                  if (!health.sync_en_curso) {
                    clearInterval(this.syncWatcherTimer);
                    this.syncWatcherTimer = null;
                    await this.fetchLatestPayload();
                    this.setBtnSyncing(false);
                    this.showToast('✅ Auditoría completada con éxito. Datos actualizados en pantalla.');
                  }
                }
              } catch (e) {
                // Si falla el check puntual, esperar al siguiente
              }
              // Límite de seguridad: 3 minutos
              if (checks > 60) {
                clearInterval(this.syncWatcherTimer);
                this.syncWatcherTimer = null;
                await this.fetchLatestPayload();
                this.setBtnSyncing(false);
              }
            }, 3000);
            return;
          }
        } catch (eLive) {
          console.warn('Servidor live 5006 no respondió al POST de sync, recurriendo a Bridge 5005:', eLive.message);
        }

        // Intento 2: Bridge existente en puerto 5005
        this.setBtnSyncing(true, 'Conectando con Bridge 5005...');
        const bridgeRes = await fetch('http://127.0.0.1:5005/sync_contraste', { cache: 'no-store' });
        if (bridgeRes && bridgeRes.ok) {
          const bData = await bridgeRes.json();
          this.showToast(`✅ Sincronizados ${bData.total_trabajadores || 48} trabajadores desde gruposifuapp.`);
          await this.fetchLatestPayload();
          this.setBtnSyncing(false);
        } else {
          throw new Error('Respuesta no satisfactoria del servidor de sincronización.');
        }
      } catch (err) {
        console.error('Error lanzando sincronización:', err);
        this.showToast(`⚠️ No se pudo completar la sincronización directa: ${err.message}. Comprueba que Iniciar_Supervisor_Puente.bat o Lanzar_Fichajes_Live.bat estén activos.`);
        this.reloadScriptTag();
        this.setBtnSyncing(false);
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
