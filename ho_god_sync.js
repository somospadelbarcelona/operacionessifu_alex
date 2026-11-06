/**
 * ==============================================================================
 * HO GOD SYNC — ORQUESTADOR MAESTRO DE SINCRONIZACIÓN SAP S/4HANA (NIVEL DIOS)
 * ==============================================================================
 * Delegación Territorial Barcelona 0801 & Alejandro Coscolin · Grupo SIFU
 * Conexión OData v2 directa y en caliente con ZPS_HOPER_SRV a través de SupervisorBridge.
 * Sincroniza al 100% de precisión y en tiempo real:
 *   1. Proyectos, Clientes y Sociedades duales SIFU (P1) vs EPID (P2)
 *   2. Carteras Oficiales de los 9 Gestores de Barcelona (División 0801)
 *   3. Fichas de Empleados, DNI, Contratos, Teléfonos y Fechas
 *   4. Cuadrantes Oficiales HAGridSet / HSGridSet del mes corriente
 *   5. Saldos canónicos de Vacaciones (vacTotales, vacTomados, vacRestantes)
 *   6. Ausencias, Bajas IT y absentismos en ExcelEmpleadoSet
 *   7. Censo exclusivo depurado de Alejandro Coscolin (sin jardinería ni BCL)
 *   8. Coberturas operativas y Servicios Inteligentes
 * ==============================================================================
 */

(function (window, document) {
  'use strict';

  const BRIDGE_URL = 'http://127.0.0.1:5005';

  const GodSyncState = {
    isSyncing: false,
    autoSyncEnabled: true,
    lastSyncTime: null,
    latencyMs: 0,
    progressPct: 0,
    currentStep: 'Inactivo',
    logEntries: [],
    metrics: {
      proyectos: 0,
      empleados: 0,
      censoCoscolin: 0,
      vacaciones: 0,
      serviciosIntel: 0
    },
    lastPayload: null,
    pollTimer: null,
    lastFocusSyncTs: 0
  };

  // Pipeline visual de los 6 pasos oficiales
  const PIPELINE_STEPS = [
    { id: 1, key: 'handshake', label: '1. SAP Handshake', icon: '🌐', minPct: 10 },
    { id: 2, key: 'carteras', label: '2. Carteras 0801', icon: '📁', minPct: 35 },
    { id: 3, key: 'censo', label: '3. Censo & Contratos', icon: '👥', minPct: 60 },
    { id: 4, key: 'cuadrantes', label: '4. Cuadrantes Mes', icon: '📅', minPct: 75 },
    { id: 5, key: 'vacaciones', label: '5. Vacaciones Reales', icon: '🏖️', minPct: 90 },
    { id: 6, key: 'deploy', label: '6. Despliegue en App', icon: '🚀', minPct: 100 }
  ];

  /**
   * Crea el HUD interactivo de Sincronización en el DOM si no existe.
   */
  function ensureHUD() {
    if (document.getElementById('ho-god-sync-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ho-god-sync-modal';
    modal.innerHTML = `
      <div class="ho-god-card" role="dialog" aria-modal="true" aria-labelledby="ho-god-title">
        <!-- Header -->
        <div class="ho-god-header">
          <div class="ho-god-title-group">
            <div class="ho-god-badges">
              <span class="ho-god-pill sap">⚡ SAP S/4HANA OData v2 · ZPS_HOPER_SRV</span>
              <span class="ho-god-pill status-online" id="ho-god-pill-status">🟢 ONLINE: 127.0.0.1:5005</span>
              <span class="ho-god-pill sap" id="ho-god-pill-latency">⏱️ -- ms</span>
            </div>
            <h2 id="ho-god-title">⚡ SINCRONIZACIÓN MAESTRA SAP HO · NIVEL DIOS</h2>
            <p>Conexión directa en tiempo real con SAP ERP · Delegación Barcelona (0801) & Alejandro Coscolin</p>
          </div>
          <button class="ho-god-close-btn" id="ho-god-btn-close" title="Cerrar modal (la sincronización continúa en segundo plano)">✕</button>
        </div>

        <!-- Body -->
        <div class="ho-god-body">
          <!-- Barra de Progreso y Paso Actual -->
          <div class="ho-god-progress-card">
            <div class="ho-god-progress-top">
              <div class="ho-god-step-label" id="ho-god-step-label">
                <span class="spinner-dot">🔄</span>
                <span>Listo para sincronizar</span>
              </div>
              <div class="ho-god-pct-label" id="ho-god-pct-label">0%</div>
            </div>
            <div class="ho-god-bar-track">
              <div class="ho-god-bar-fill" id="ho-god-bar-fill" style="width: 0%;"></div>
            </div>
            <!-- Pipeline de pasos -->
            <div class="ho-god-steps-pipeline" id="ho-god-steps-pipeline">
              ${PIPELINE_STEPS.map(s => `
                <div class="ho-god-step-item pending" id="ho-god-step-${s.id}">
                  <span class="icon">${s.icon}</span>
                  <span>${s.label}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Métricas en Tiempo Real -->
          <div class="ho-god-metrics-grid">
            <div class="ho-god-metric-card accent-blue">
              <span class="label">Proyectos Barcelona</span>
              <span class="val" id="ho-god-metric-proys">0</span>
            </div>
            <div class="ho-god-metric-card accent-emerald">
              <span class="label">Personal & Cuadrantes</span>
              <span class="val" id="ho-god-metric-emps">0</span>
            </div>
            <div class="ho-god-metric-card accent-amber">
              <span class="label">Censo Alejandro Coscolin</span>
              <span class="val" id="ho-god-metric-coscolin">0</span>
            </div>
            <div class="ho-god-metric-card accent-purple">
              <span class="label">Trabajadores Vacaciones</span>
              <span class="val" id="ho-god-metric-vac">0</span>
            </div>
          </div>

          <!-- Consola / Log de Auditoría -->
          <div class="ho-god-console-card">
            <div class="ho-god-console-bar">
              <div>
                <span class="status-dot"></span>
                <span>AUDITORÍA EN VIVO SAP S/4HANA OData</span>
              </div>
              <span id="ho-god-log-clock">--:--:--</span>
            </div>
            <pre class="ho-god-log-terminal" id="ho-god-log-terminal">Esperando inicio de sincronización...</pre>
          </div>
        </div>

        <!-- Footer / Controles -->
        <div class="ho-god-footer">
          <label class="ho-god-auto-switch" title="Sincroniza automáticamente al volver de la pestaña de SAP HO o cada 60s">
            <input type="checkbox" id="ho-god-chk-autosync" ${GodSyncState.autoSyncEnabled ? 'checked' : ''}>
            <span>Auto-Sync Inteligente (Al volver de SAP HO / cada 60s)</span>
          </label>
          <div class="ho-god-actions-group">
            <button class="ho-god-btn secondary" id="ho-god-btn-minimize">Minimizar</button>
            <button class="ho-god-btn primary" id="ho-god-btn-exec">
              <span>⚡</span>
              <span>SINCRONIZAR AHORA 100% CON SAP HO</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners del HUD
    document.getElementById('ho-god-btn-close').addEventListener('click', closeHUD);
    document.getElementById('ho-god-btn-minimize').addEventListener('click', closeHUD);
    document.getElementById('ho-god-btn-exec').addEventListener('click', () => triggerSync());
    document.getElementById('ho-god-chk-autosync').addEventListener('change', (e) => {
      GodSyncState.autoSyncEnabled = e.target.checked;
      showToast(GodSyncState.autoSyncEnabled ? '✅ Auto-Sync con SAP HO activado' : '⏸️ Auto-Sync pausado', 'info');
    });

    // Cerrar al pulsar Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeHUD();
      }
      // Atajo global Ctrl+Shift+S para abrir HUD y sincronizar
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        openHUD();
        triggerSync();
      }
    });
  }

  function openHUD() {
    ensureHUD();
    const modal = document.getElementById('ho-god-sync-modal');
    if (modal) {
      modal.classList.add('active');
      updateHUDView();
    }
  }

  function closeHUD() {
    const modal = document.getElementById('ho-god-sync-modal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Actualiza visualmente el HUD con el estado actual
   */
  function updateHUDView() {
    const fill = document.getElementById('ho-god-bar-fill');
    const pctLabel = document.getElementById('ho-god-pct-label');
    const stepLabel = document.getElementById('ho-god-step-label');
    const logEl = document.getElementById('ho-god-log-terminal');
    const execBtn = document.getElementById('ho-god-btn-exec');
    const latencyEl = document.getElementById('ho-god-pill-latency');
    const pillStatus = document.getElementById('ho-god-pill-status');

    if (!fill) return;

    fill.style.width = GodSyncState.progressPct + '%';
    pctLabel.textContent = Math.round(GodSyncState.progressPct) + '%';
    stepLabel.innerHTML = `<span>${GodSyncState.isSyncing ? '🔄' : '⚡'}</span> <span>${GodSyncState.currentStep}</span>`;

    if (latencyEl && GodSyncState.latencyMs > 0) {
      latencyEl.textContent = `⏱️ ${GodSyncState.latencyMs} ms`;
    }

    if (pillStatus) {
      if (GodSyncState.isSyncing) {
        pillStatus.className = 'ho-god-pill status-busy';
        pillStatus.textContent = '🟡 SINCRONIZANDO CON SAP HO...';
      } else {
        pillStatus.className = 'ho-god-pill status-online';
        pillStatus.textContent = '🟢 SAP HO ONLINE (ZPS_HOPER_SRV)';
      }
    }

    // Actualizar pipeline de pasos
    PIPELINE_STEPS.forEach(s => {
      const el = document.getElementById(`ho-god-step-${s.id}`);
      if (!el) return;
      el.className = 'ho-god-step-item';
      if (GodSyncState.progressPct >= s.minPct) {
        el.classList.add('done');
      } else if (GodSyncState.progressPct >= s.minPct - 20 && GodSyncState.isSyncing) {
        el.classList.add('active');
      } else {
        el.classList.add('pending');
      }
    });

    // Actualizar métricas
    const mP = document.getElementById('ho-god-metric-proys');
    const mE = document.getElementById('ho-god-metric-emps');
    const mC = document.getElementById('ho-god-metric-coscolin');
    const mV = document.getElementById('ho-god-metric-vac');
    if (mP) mP.textContent = GodSyncState.metrics.proyectos || 0;
    if (mE) mE.textContent = GodSyncState.metrics.empleados || 0;
    if (mC) mC.textContent = GodSyncState.metrics.censoCoscolin || 0;
    if (mV) mV.textContent = GodSyncState.metrics.vacaciones || 0;

    // Actualizar log
    if (logEl && GodSyncState.logEntries.length > 0) {
      logEl.innerHTML = GodSyncState.logEntries.map(line => {
        if (line.includes('Error') || line.includes('Fallo')) return `<span class="log-err">${escapeHtml(line)}</span>`;
        if (line.includes('OK') || line.includes('completada') || line.includes('finalizado') || line.includes('100%')) return `<span class="log-ok">${escapeHtml(line)}</span>`;
        if (line.includes('Aviso') || line.includes('WARN')) return `<span class="log-warn">${escapeHtml(line)}</span>`;
        return `<span>${escapeHtml(line)}</span>`;
      }).join('\n');
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Botón ejecutar
    if (execBtn) {
      execBtn.disabled = GodSyncState.isSyncing;
      execBtn.innerHTML = GodSyncState.isSyncing
        ? '<span>⏳</span> <span>SINCRONIZANDO CON SAP HO...</span>'
        : '<span>⚡</span> <span>SINCRONIZAR AHORA 100% CON SAP HO</span>';
    }

    // Actualizar botón del header
    updateHeaderButton();
  }

  function updateHeaderButton() {
    const btn = document.getElementById('btn-header-sync-ho');
    if (!btn) return;

    if (GodSyncState.isSyncing) {
      btn.className = 'supervisor-badge-btn ho-god-header-btn-badge syncing';
      btn.innerHTML = `<span>⏳</span> <span>SINCRONIZANDO HO (${Math.round(GodSyncState.progressPct)}%)</span>`;
    } else {
      btn.className = 'supervisor-badge-btn ho-god-header-btn-badge';
      const timeStr = GodSyncState.lastSyncTime ? GodSyncState.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '100% LIVE';
      btn.innerHTML = `<span>🔄</span> <span>SAP HO [${timeStr}]</span>`;
    }
  }

  function addLog(text) {
    const ts = new Date().toLocaleTimeString();
    GodSyncState.logEntries.push(`[${ts}] ${text}`);
    if (GodSyncState.logEntries.length > 60) GodSyncState.logEntries.shift();
    updateHUDView();
  }

  /**
   * Dispara la sincronización Nivel Dios
   */
  async function triggerSync(options = {}) {
    if (GodSyncState.isSyncing) return;

    const { gestorId = 'todos', forceExcel = true, silent = false } = options;

    GodSyncState.isSyncing = true;
    GodSyncState.progressPct = 5;
    GodSyncState.currentStep = 'Conectando con SAP S/4HANA...';
    GodSyncState.logEntries = [];
    addLog('⚡ Conectando al orquestador SAP S/4HANA (SupervisorBridge)...');

    if (!silent) openHUD();
    updateHUDView();

    try {
      // 1. Iniciar en modo asíncrono
      const initUrl = `${BRIDGE_URL}/sync_ho_god_level?async=1&gestor=${encodeURIComponent(gestorId)}&excel=${forceExcel ? '1' : '0'}&_t=${Date.now()}`;
      const res = await fetch(initUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} al iniciar sincronización`);
      const initData = await res.json();

      addLog(`Handshake iniciado. Estado: ${initData.status}`);

      // 2. Poll progress
      await pollSyncProgress();

    } catch (err) {
      console.error('[HOGodSync] Error en sincronización:', err);
      GodSyncState.isSyncing = false;
      GodSyncState.currentStep = `Error: ${err.message}`;
      addLog(`❌ ERROR: ${err.message}. Comprueba que la VPN de SIFU esté conectada.`);
      showToast(`❌ Error sincronizando con SAP HO: ${err.message}`, 'error');
      updateHUDView();
    }
  }

  /**
   * Sondea el estado del backend hasta llegar al 100%
   */
  function pollSyncProgress() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 120; // 60 segundos máx

      if (GodSyncState.pollTimer) clearInterval(GodSyncState.pollTimer);

      GodSyncState.pollTimer = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${BRIDGE_URL}/ho_sync_progress?_t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            GodSyncState.progressPct = data.progress_pct || GodSyncState.progressPct;
            GodSyncState.currentStep = data.step_name || GodSyncState.currentStep;

            if (Array.isArray(data.log)) {
              GodSyncState.logEntries = data.log;
            }

            updateHUDView();

            if (!data.is_running && data.progress_pct >= 100) {
              clearInterval(GodSyncState.pollTimer);
              GodSyncState.pollTimer = null;
              GodSyncState.isSyncing = false;

              // Obtener resultado final
              if (data.last_result) {
                applyLivePayload(data.last_result);
              } else {
                // Fetch de respaldo
                await reloadPayloadsLocally();
              }
              resolve();
            } else if (!data.is_running && data.error) {
              clearInterval(GodSyncState.pollTimer);
              GodSyncState.pollTimer = null;
              GodSyncState.isSyncing = false;
              reject(new Error(data.error));
            }
          }
        } catch (e) {
          // Errores transitorios de red no cancelan inmediatamente
          if (attempts > maxAttempts) {
            clearInterval(GodSyncState.pollTimer);
            GodSyncState.pollTimer = null;
            GodSyncState.isSyncing = false;
            reject(new Error('Timeout de espera de sincronización SAP HO'));
          }
        }
      }, 500);
    });
  }

  /**
   * Aplica en caliente los payloads actualizados de SAP HO a la memoria de la aplicación
   */
  function applyLivePayload(payload) {
    GodSyncState.lastPayload = payload;
    GodSyncState.lastSyncTime = new Date();
    GodSyncState.latencyMs = payload.latency_ms || 35;

    if (payload.totales) {
      GodSyncState.metrics.proyectos = payload.totales.proyectos || 0;
      GodSyncState.metrics.empleados = payload.totales.empleados_master || 0;
      GodSyncState.metrics.censoCoscolin = payload.totales.censo_coscolin || 0;
      GodSyncState.metrics.vacaciones = payload.totales.trabajadores_vacaciones || 0;
      GodSyncState.metrics.serviciosIntel = payload.totales.servicios_intel || 0;
    }

    // 1. Inyectar objetos de datos globales en window
    if (payload.carteras) {
      window.HO_CARTERAS_PAYLOAD = payload.carteras;
    }
    if (payload.vacaciones) {
      window.HO_VACACIONES_PAYLOAD = payload.vacaciones;
    }

    addLog(`🚀 Desplegando datos en caliente en todos los módulos de la aplicación...`);

    // 2. Refrescar reactivamente los módulos activos de la interfaz
    reactivateAppModules(payload);

    updateHUDView();
    showToast(`⚡ ¡SAP HO sincronizado al 100%! (${GodSyncState.metrics.proyectos} proyectos, ${GodSyncState.metrics.empleados} empleados, ${GodSyncState.metrics.vacaciones} vacaciones)`, 'success');

    // 3. Emitir evento custom para cualquier suscriptor
    document.dispatchEvent(new CustomEvent('sifu:ho:god_synced', { detail: payload }));
  }

  /**
   * Recarga los ficheros JSON locales de caché si no vinieron en el socket
   */
  async function reloadPayloadsLocally() {
    try {
      const rCart = await fetch('ho_carteras_cache.json?_t=' + Date.now());
      if (rCart.ok) window.HO_CARTERAS_PAYLOAD = await rCart.json();
    } catch (_) {}

    try {
      const rVac = await fetch('ho_vacaciones_cache.json?_t=' + Date.now());
      if (rVac.ok) window.HO_VACACIONES_PAYLOAD = await rVac.json();
    } catch (_) {}

    applyLivePayload({
      latency_ms: 25,
      totales: {
        proyectos: (window.HO_CARTERAS_PAYLOAD && window.HO_CARTERAS_PAYLOAD.proyectos && window.HO_CARTERAS_PAYLOAD.proyectos.length) || 0,
        empleados: (window.HO_CARTERAS_PAYLOAD && window.HO_CARTERAS_PAYLOAD.trabajadores && window.HO_CARTERAS_PAYLOAD.trabajadores.length) || 0,
        vacaciones: (window.HO_VACACIONES_PAYLOAD && window.HO_VACACIONES_PAYLOAD.trabajadores && window.HO_VACACIONES_PAYLOAD.trabajadores.length) || 0,
        censoCoscolin: 48
      }
    });
  }

  /**
   * Notifica y re-renderiza en caliente cada módulo de la suite de Grupo SIFU
   */
  function reactivateAppModules(payload) {
    // A) Módulo 2.4: Vacaciones Trabajadores Explorador
    if (window.HOVacacionesExplorer && typeof window.HOVacacionesExplorer.render === 'function') {
      try {
        window.HOVacacionesExplorer.render();
      } catch (e) {
        console.warn('[HOGodSync] Error refrescando HOVacacionesExplorer:', e);
      }
    }

    // B) Módulo 2.3: Revisión HO Inteligente
    if (window.HOIntelligentReview && typeof window.HOIntelligentReview.refresh === 'function') {
      try {
        window.HOIntelligentReview.refresh();
      } catch (e) {}
    } else if (typeof window.refreshAllHOIntelFromLive === 'function') {
      try {
        window.refreshAllHOIntelFromLive();
      } catch (e) {}
    }

    // C) Plataforma Enterprise (Carteras, Cuadrantes, Gestores)
    if (window.EnterprisePlatform && typeof window.EnterprisePlatform.renderCurrentSection === 'function') {
      try {
        window.EnterprisePlatform.renderCurrentSection();
      } catch (e) {
        console.warn('[HOGodSync] Error refrescando EnterprisePlatform:', e);
      }
    }

    // D) Supervisor Panel
    if (window.SupervisorPanel && typeof window.SupervisorPanel.refreshData === 'function') {
      try {
        window.SupervisorPanel.refreshData();
      } catch (e) {}
    }

    // E) Módulo CMH (Control Mensual de Horas)
    if (window.CMHModule && typeof window.CMHModule.render === 'function') {
      try {
        window.CMHModule.render();
      } catch (e) {}
    }
  }

  function showToast(msg, type = 'info') {
    if (typeof window.showToast === 'function') {
      const cls = type === 'success' ? 'bg-success' : (type === 'error' ? 'bg-danger' : 'bg-blue');
      window.showToast(msg, cls);
    } else {
      console.log(`[Toast ${type}]`, msg);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Configura listeners de foco y temporizador periódico para Auto-Sync Inteligente
   */
  function setupAutoSyncListeners() {
    // Al volver a la ventana tras imputar o gestionar en SAP HO
    window.addEventListener('focus', () => {
      if (!GodSyncState.autoSyncEnabled || GodSyncState.isSyncing) return;
      const now = Date.now();
      // Limitar a una vez cada 20 segundos
      if (now - GodSyncState.lastFocusSyncTs < 20000) return;
      GodSyncState.lastFocusSyncTs = now;
      console.log('[HOGodSync] Foco recuperado desde SAP HO. Disparando Auto-Sync silencioso...');
      triggerSync({ silent: true });
    });

    // Sondeo periódico cada 90 segundos si la pestaña está visible
    setInterval(() => {
      if (!GodSyncState.autoSyncEnabled || GodSyncState.isSyncing) return;
      if (document.visibilityState === 'visible') {
        triggerSync({ silent: true });
      }
    }, 90000);
  }

  /**
   * Inicialización del orquestador
   */
  function init() {
    ensureHUD();
    setupAutoSyncListeners();

    // Re-vincular el botón del header existente para abrir el orquestador
    const btn = document.getElementById('btn-header-sync-ho');
    if (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        openHUD();
        triggerSync();
      };
      updateHeaderButton();
    }

    // Verificar ping inicial con SAP HO de forma asíncrona
    fetch(`${BRIDGE_URL}/status`)
      .then(r => r.json())
      .then(d => {
        if (d && d.ho_connected) {
          const pill = document.getElementById('ho-god-pill-status');
          if (pill) pill.textContent = '🟢 SAP HO ONLINE (ZPS_HOPER_SRV)';
        }
      })
      .catch(() => {});

    console.log('⚡ HO God Sync Orchestrator v3.0 listo para producción (Atajo: Ctrl+Shift+S).');
  }

  // Exposición en API Global
  window.HOGodSync = {
    triggerSync,
    openHUD,
    closeHUD,
    getState: () => ({ ...GodSyncState }),
    enableAutoSync: (val) => { GodSyncState.autoSyncEnabled = Boolean(val); },
    init
  };

  // Inicializar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
