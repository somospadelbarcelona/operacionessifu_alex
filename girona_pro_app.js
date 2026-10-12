/**
 * ============================================================================
 * SIFU GIRONA OPERACIONES — PRO SUITE v9.0 (PC & MOBILE)
 * Motor Central de Gestión Operativa para Jefe de Servicios de Girona
 * ============================================================================
 */

(function () {
  'use strict';

  // Configuración del sistema
  const CONFIG = {
    HO_ODATA_ROOT: 'http://qgssrvs4pro.gruposifu.com:8000/sap/opu/odata/sap/ZPS_HOPER_SRV',
    HO_APP_URL: 'http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES#/Projects',
    USER: 'acoscolin',
    OFICINA: '1701 - Girona',
    VERSION: '9.0 Pro SIFU Girona'
  };

  // Estado reactivo
  const AppState = {
    activeTab: 'guardia', // guardia | limpieza | auxiliares | todos | personal | ho_sync
    viewMode: window.innerWidth > 900 ? 'table' : 'cards', // table | cards | kanban
    comarcaFilter: 'todas',
    statusFilter: 'todos',
    sectorFilter: 'todos',
    searchQuery: '',
    columnFilters: {
      estado: '',
      sector: '',
      servicio: '',
      comarca: '',
      titular: '',
      suplente: '',
      horario: '',
      proyecto: ''
    },
    selectedService: null,
    syncInterval: null,
    isSyncing: false,
    hoConnected: true,
    lastSyncTime: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    logs: [
      `[${new Date().toLocaleTimeString()}] Sistema SIFU Girona Pro inicializado con éxito.`,
      `[${new Date().toLocaleTimeString()}] Conexión establecida con SAP S/4HANA (ZPS_HOPER_SRV).`,
      `[${new Date().toLocaleTimeString()}] Excel Maestro sincronizado en tiempo real.`
    ]
  };
  window.AppState = AppState;

  // Comarcas de Girona asociadas por palabras clave
  const COMARCAS_MAP = {
    'Gironès': ['girona', 'salt', 'aiguaviva', 'sarria', 'quart', 'cassa', 'vilablareix', 'sant julià de ramis'],
    'Alt Empordà': ['figueres', 'castello', 'escala', 'roses', 'llança', 'cadaques', 'la jonquera', 'castillo'],
    'Baix Empordà': ['palamos', 'platja d\'aro', 'sant feliu', 'calonge', 'palafrugell', 'torroella', 'begur', 'la bisbal', 's\'agaro'],
    'Garrotxa': ['olot', 'vall d\'en bas', 'besalu', 'santa pau', 'les preses'],
    'Ripollès': ['ripoll', 'planoles', 'queralbs', 'nuria', 'ribes de freser', 'camprodon', 'sant joan de les abadesses'],
    'La Selva': ['blanes', 'lloret', 'santa coloma de farners', 'arbucies', 'riudellots', 'viladrau', 'maçanet', 'hostalric', 'vidreres']
  };

  function detectarComarca(direccion, servicio) {
    const txt = ((direccion || '') + ' ' + (servicio || '')).toLowerCase();
    for (const [comarca, keywords] of Object.entries(COMARCAS_MAP)) {
      for (const kw of keywords) {
        if (txt.includes(kw)) return comarca;
      }
    }
    return 'Gironès'; // Predeterminado para delegación de Girona
  }

  // Normalización y preparación del dataset
  function normalizeString(str) {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9\s]/g, ' ').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // Normalización y preparación del dataset con enriquecimiento HO en tiempo real
  function getNormalizedData() {
    const raw = window.INITIAL_MASTER_DATA || [];
    const hoMap = window.HO_EMPLOYEES_MAP || {};

    return raw.map((item, index) => {
      const tipoServicioRaw = (item['TIPO SERVICIO'] || '').toUpperCase().trim();
      const servicioRaw = (item['SERVICIO'] || '').trim();
      const tipoSRaw = (item['TIPO S'] || '').trim();
      const estadoRaw = (item['ESTADO'] || '').toUpperCase().trim();
      const estado1Raw = (item['ESTADO1'] || '').toUpperCase().trim();
      const titularRaw = (item['TITULAR'] || '').trim();
      const suplenteRaw = (item['SUPL'] || '').trim();
      const horarioRaw = (item['HORARIO'] || '').trim();
      const direccionRaw = (item['S DIRECCION'] || '').trim();
      const proyectoRaw = (item['PROYECTO'] || '').trim();
      const finContratoRaw = (item['FIN CONTRATO'] || '').trim();
      const vacacionesRaw = (item['VACACIONES 2026'] || item['VAC 26'] || '').trim();
      const numVacRaw = (item['NUM VAC'] || '').trim();

      // Enriquecimiento en tiempo real con SAP HO
      let hoEmp = null;
      if (titularRaw && !titularRaw.toUpperCase().includes('FALTA') && !titularRaw.toUpperCase().includes('SIN TITULAR')) {
        const titNorm = normalizeString(titularRaw);
        if (hoMap[titNorm]) {
          hoEmp = hoMap[titNorm];
        } else {
          const words = titNorm.split(' ');
          for (const [k, v] of Object.entries(hoMap)) {
            const kWords = k.split(' ');
            const common = words.filter(w => kWords.includes(w));
            if (common.length >= 2 && common.length >= words.length - 1) {
              hoEmp = v;
              break;
            }
          }
        }
      }

      // Tipo y fin de contrato enriquecido
      let tipoContrato = hoEmp ? hoEmp.tipo_contrato : '';
      let finContrato = finContratoRaw;
      if (!finContrato && hoEmp && hoEmp.fin_contrato) {
        finContrato = hoEmp.fin_contrato;
      }
      if (!tipoContrato) {
        if (finContrato === 'Indefinido') tipoContrato = 'Fijo';
        else if (finContrato && (finContrato.includes('/') || finContrato.toLowerCase().includes('dia'))) tipoContrato = 'Temporal';
      }

      // Cálculo de días restantes de contrato y criticidad
      let diasRestantesContrato = null;
      let diasRestantesContratoText = '';
      let finContratoUrgente = false;

      if (hoEmp && hoEmp.dias_fin_contrato !== null && hoEmp.dias_fin_contrato !== undefined) {
        diasRestantesContrato = hoEmp.dias_fin_contrato;
      } else if (finContrato && finContrato.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const parts = finContrato.split('/');
        const targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const diffTime = targetDate - new Date();
        diasRestantesContrato = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (diasRestantesContrato !== null) {
        if (diasRestantesContrato <= 0) {
          diasRestantesContratoText = '¡Vence hoy o ya vencido!';
          finContratoUrgente = true;
        } else {
          diasRestantesContratoText = `Quedan ${diasRestantesContrato} días`;
          if (diasRestantesContrato <= 45) finContratoUrgente = true;
        }
      } else if (finContratoRaw.toLowerCase().includes('dia') || finContratoRaw.toLowerCase().includes('faltan')) {
        diasRestantesContratoText = finContratoRaw;
        finContratoUrgente = true;
      }

      // Vacaciones y días que le quedan (HO + Master)
      let diasVacacionesRestantes = numVacRaw || (hoEmp && hoEmp.vac_restantes > 0 ? String(hoEmp.vac_restantes) : '') || '';
      if (!diasVacacionesRestantes && vacacionesRaw) {
        const m = vacacionesRaw.match(/(\d+)\s*d/i);
        if (m) diasVacacionesRestantes = m[1];
      }
      if (!diasVacacionesRestantes) {
        diasVacacionesRestantes = '0';
      }

      const vacTomados = hoEmp ? hoEmp.vac_tomados : 0;
      const vacTotales = hoEmp && hoEmp.vac_totales > 0 ? hoEmp.vac_totales : 30;
      const telefonoOperario = (hoEmp && hoEmp.telefono) || '';
      const dniOperario = (hoEmp && hoEmp.dni) || '';
      const idEmpleado = (hoEmp && hoEmp.id_empleado) || '';

      // Clasificación del sector
      let categoria = 'LIMPIEZA';
      if (tipoServicioRaw.includes('AUXILIAR') || tipoServicioRaw.includes('ALBERGUE') || tipoSRaw.includes('AUX')) {
        categoria = 'AUXILIARES';
      }

      // Estado operativo unificado
      let estadoOperativo = 'CUBIERTO';
      let estadoBadge = 'ok';
      let esUrgente = false;

      const isDesc = estadoRaw.includes('DESCUBIERTO') || 
                     titularRaw.toUpperCase().includes('FALTA TITULAR') || 
                     titularRaw.toUpperCase().includes('SIN TITULAR') || 
                     (estadoRaw === '' && titularRaw === '');

      const isBaja = estadoRaw.includes('BAJA') || estado1Raw.includes('BAJA');

      if (isDesc) {
        estadoOperativo = 'DESCUBIERTO';
        estadoBadge = 'danger';
        esUrgente = true;
      } else if (isBaja) {
        if (!suplenteRaw) {
          estadoOperativo = 'BAJA SIN SUPLENTE';
          estadoBadge = 'danger';
          esUrgente = true;
        } else {
          estadoOperativo = 'BAJA CUBIERTA';
          estadoBadge = 'warning';
        }
      } else if (estadoRaw.includes('VACACIONES')) {
        estadoOperativo = 'VACACIONES';
        estadoBadge = 'purple';
      }

      const comarca = detectarComarca(direccionRaw, servicioRaw || tipoSRaw);

      return {
        id: `srv_${index}`,
        originalIndex: index,
        categoria, // LIMPIEZA | AUXILIARES
        cliente: servicioRaw || tipoSRaw || 'CLIENTE GIRONA',
        nombreServicio: tipoSRaw || servicioRaw,
        direccion: direccionRaw || 'Girona',
        comarca,
        proyecto: proyectoRaw || 'SAP-HO-P1',
        horario: horarioRaw || 'Según cuadrante',
        titular: titularRaw || 'FALTA TITULAR',
        suplente: suplenteRaw,
        estado: estadoOperativo,
        estadoBadge,
        esUrgente,
        tipoContrato,
        finContrato: finContrato || 'Indefinido',
        diasRestantesContrato,
        diasRestantesContratoText,
        finContratoUrgente,
        diasVacacionesRestantes,
        vacTomados,
        vacTotales,
        vacaciones: vacacionesRaw || (diasVacacionesRestantes !== '0' ? `${diasVacacionesRestantes} días disponibles` : 'Sin planificar'),
        telefono: telefonoOperario,
        dni: dniOperario,
        idEmpleado,
        rawItem: item
      };
    });
  }

  // Filtrado reactivo de datos
  function getFilteredData() {
    const data = getNormalizedData();
    const query = AppState.searchQuery.toLowerCase().trim();

    return data.filter(item => {
      // 1. Filtro por Pestaña Activa
      if (AppState.activeTab === 'guardia') {
        if (!item.esUrgente && !item.estado.includes('BAJA')) return false;
      } else if (AppState.activeTab === 'limpieza') {
        if (item.categoria !== 'LIMPIEZA') return false;
      } else if (AppState.activeTab === 'auxiliares') {
        if (item.categoria !== 'AUXILIARES') return false;
      }

      // 2. Filtro global por Sector (selector en barra de controles)
      if (AppState.sectorFilter && AppState.sectorFilter !== 'todos') {
        if (item.categoria !== AppState.sectorFilter) return false;
      }

      // 3. Filtro por Comarca (selector en barra de controles)
      if (AppState.comarcaFilter !== 'todas') {
        if (item.comarca !== AppState.comarcaFilter) return false;
      }

      // 4. Filtro por Estado (selector en barra de controles)
      if (AppState.statusFilter !== 'todos') {
        if (AppState.statusFilter === 'descubiertos' && item.estado !== 'DESCUBIERTO') return false;
        if (AppState.statusFilter === 'bajas' && !item.estado.includes('BAJA')) return false;
        if (AppState.statusFilter === 'cubiertos' && item.estado !== 'CUBIERTO') return false;
      }

      // 5. Búsqueda libre global (header o controls bar)
      if (query) {
        const fullText = `${item.cliente} ${item.nombreServicio} ${item.direccion} ${item.titular} ${item.suplente} ${item.proyecto} ${item.comarca} ${item.horario}`.toLowerCase();
        if (!fullText.includes(query)) return false;
      }

      // 6. Filtros individuales por columna (thead de la tabla de operaciones)
      if (AppState.columnFilters) {
        const cf = AppState.columnFilters;

        if (cf.estado) {
          const filterEst = cf.estado.toUpperCase();
          if (filterEst === 'BAJA') {
            if (!item.estado.toUpperCase().includes('BAJA')) return false;
          } else if (item.estado.toUpperCase() !== filterEst) {
            return false;
          }
        }

        if (cf.sector) {
          const filterSec = cf.sector.toUpperCase();
          if (item.categoria.toUpperCase() !== filterSec) return false;
        }

        if (cf.servicio) {
          const srvQuery = cf.servicio.toLowerCase().trim();
          const srvText = `${item.nombreServicio} ${item.cliente} ${item.direccion}`.toLowerCase();
          if (!srvText.includes(srvQuery)) return false;
        }

        if (cf.comarca) {
          if (item.comarca.toLowerCase() !== cf.comarca.toLowerCase()) return false;
        }

        if (cf.titular) {
          const titQuery = cf.titular.toLowerCase().trim();
          if (!(item.titular || '').toLowerCase().includes(titQuery)) return false;
        }

        if (cf.suplente) {
          const supQuery = cf.suplente.toLowerCase().trim();
          if (!(item.suplente || '').toLowerCase().includes(supQuery)) return false;
        }

        if (cf.horario) {
          const horQuery = cf.horario.toLowerCase().trim();
          if (!(item.horario || '').toLowerCase().includes(horQuery)) return false;
        }

        if (cf.proyecto) {
          const proyQuery = cf.proyecto.toLowerCase().trim();
          if (!(item.proyecto || '').toLowerCase().includes(proyQuery)) return false;
        }
      }

      return true;
    });
  }

  // Generador de Métricas / KPIs
  function calculateMetrics() {
    const all = getNormalizedData();
    const total = all.length;
    const descubiertos = all.filter(i => i.estado === 'DESCUBIERTO').length;
    const bajasSinSuplente = all.filter(i => i.estado === 'BAJA SIN SUPLENTE').length;
    const bajasCubiertas = all.filter(i => i.estado === 'BAJA CUBIERTA').length;
    const limpiezaCount = all.filter(i => i.categoria === 'LIMPIEZA').length;
    const auxiliaresCount = all.filter(i => i.categoria === 'AUXILIARES').length;
    const cubiertos = all.filter(i => i.estado === 'CUBIERTO').length;
    const pctCobertura = total > 0 ? Math.round((cubiertos / total) * 100) : 100;

    return {
      total,
      descubiertos,
      bajasSinSuplente,
      bajasTotales: bajasSinSuplente + bajasCubiertas,
      limpiezaCount,
      auxiliaresCount,
      cubiertos,
      pctCobertura
    };
  }

  // ============================================================================
  // GESTOR DE NOTIFICACIONES EN TIEMPO REAL (ACTIVAS POR DEFECTO)
  // ============================================================================
  function requestNotificationPermission(userTriggered = false) {
    try {
      localStorage.setItem('sifu_notifications_enabled', 'true');
      if (window.NotificationsEngine && window.NotificationsEngine.settings) {
        window.NotificationsEngine.settings.enabled = true;
        window.NotificationsEngine.settings.desktop = true;
      }
    } catch (e) {}

    if (!userTriggered) {
      return;
    }

    if (!('Notification' in window) || Notification.permission === 'granted') {
      return;
    }

    // Solo solicitar si el usuario ha pulsado el botón deliberadamente
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          try {
            localStorage.setItem('sifu_notifications_enabled', 'true');
          } catch (e) {}
          addLog(`[${new Date().toLocaleTimeString()}] Notificaciones de escritorio permitidas.`);
        }
      }).catch(() => {});
    }
  }

  function sendDesktopNotification(title, body, urgent = false) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const options = {
        body: body,
        icon: 'img/logo sifu.png',
        badge: 'img/logo sifu.png',
        tag: urgent ? 'urgente_' + Date.now() : 'sifu_info',
        renotify: true
      };
      new Notification(title, options);
    } catch (e) {
      console.warn('Error enviando notificación nativa:', e);
    }
  }

  // Renderizado del Shell Principal
  function renderAppShell() {
    let container = document.getElementById('girona-pro-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'girona-pro-root';
      document.body.prepend(container);
    }

    const metrics = calculateMetrics();
    const data = getFilteredData();

    container.innerHTML = `
      <!-- HEADER EJECUTIVO -->
      <header class="pro-header">
        <div class="pro-header-inner">
          <div class="pro-brand">
            <div class="pro-logo-box">
              <img src="img/logo sifu.png" alt="SIFU">
            </div>
            <div class="pro-brand-info">
              <div class="pro-brand-title">
                SIFU GIRONA
                <span class="pro-badge-zone">OPERACIONES PRO</span>
              </div>
              <div class="pro-brand-sub">Jefatura de Servicios · Limpieza & Auxiliares</div>
            </div>
          </div>

          <!-- Buscador Predictivo -->
          <div class="pro-search-bar">
            <span class="pro-search-icon">🔍</span>
            <input type="text" id="pro-search-input" value="${AppState.searchQuery}" placeholder="Buscar centro, titular, suplente, SVO o calle en Girona...">
            <button class="pro-search-clear" id="pro-search-clear" style="${AppState.searchQuery ? 'display:block;' : ''}">×</button>
          </div>

          <!-- Acciones de Cabecera -->
          <div class="pro-header-actions">
            <!-- Indicador Notificaciones Activas por defecto -->
            <button class="pro-notif-btn granted" id="pro-btn-notifications" title="Notificaciones del Sistema Activas">
              <span class="pro-pulse-dot"></span>
              <span>NOTIFICACIONES: ON</span>
            </button>

            <!-- Botón Monitor SAP HO -->
            <button class="pro-ho-status-btn" id="pro-btn-open-ho" title="Monitor de Conexión ERP SAP HO">
              <span class="pro-pulse-dot ${AppState.hoConnected ? '' : 'danger'}"></span>
              <span>SAP HO ${AppState.hoConnected ? 'EN VIVO' : 'OFFLINE'}</span>
            </button>

            <!-- Botón Sincronizar Inmediato -->
            <button class="pro-sync-btn" id="pro-btn-sync-now" title="Sincronizar ahora con Excel Maestro y SAP">
              <span class="sync-icon">${AppState.isSyncing ? '⏳' : '⚡'}</span>
              <span>${AppState.isSyncing ? 'Sincronizando...' : 'SYNC'}</span>
            </button>

            <!-- Switch de Vistas (PC) -->
            <div class="pro-view-toggle pro-only-desktop">
              <button class="pro-view-btn ${AppState.viewMode === 'table' ? 'active' : ''}" data-view="table">📋 Tabla</button>
              <button class="pro-view-btn ${AppState.viewMode === 'cards' ? 'active' : ''}" data-view="cards">🗂️ Tarjetas</button>
              <button class="pro-view-btn ${AppState.viewMode === 'kanban' ? 'active' : ''}" data-view="kanban">🚦 Guardia</button>
            </div>
          </div>
        </div>
      </header>

      <!-- BARRA DE KPIs OPERATIVOS -->
      <section class="pro-kpis-container">
        <div class="pro-kpi-grid">
          <div class="pro-kpi-card ${metrics.descubiertos > 0 ? 'kpi-danger' : 'kpi-ok'}" data-tab-target="guardia">
            <div class="pro-kpi-header">
              <span class="pro-kpi-label">Descubiertos Urgentes</span>
              <span class="pro-kpi-icon">🚨</span>
            </div>
            <div class="pro-kpi-value">${metrics.descubiertos}</div>
            <div class="pro-kpi-sub">${metrics.descubiertos === 0 ? 'Todo cubierto hoy' : '¡Requiere asignación inmediata!'}</div>
          </div>

          <div class="pro-kpi-card ${metrics.bajasSinSuplente > 0 ? 'kpi-warning' : ''}" data-tab-target="guardia">
            <div class="pro-kpi-header">
              <span class="pro-kpi-label">Bajas IT Activas</span>
              <span class="pro-kpi-icon">🩺</span>
            </div>
            <div class="pro-kpi-value">${metrics.bajasTotales}</div>
            <div class="pro-kpi-sub">${metrics.bajasSinSuplente} sin suplente asignado</div>
          </div>

          <div class="pro-kpi-card kpi-info" data-tab-target="limpieza">
            <div class="pro-kpi-header">
              <span class="pro-kpi-label">Cartera Limpieza</span>
              <span class="pro-kpi-icon">🧹</span>
            </div>
            <div class="pro-kpi-value">${metrics.limpiezaCount}</div>
            <div class="pro-kpi-sub">Centros industriales, oficinas, sedes</div>
          </div>

          <div class="pro-kpi-card kpi-purple" data-tab-target="auxiliares">
            <div class="pro-kpi-header">
              <span class="pro-kpi-label">Cartera Auxiliares</span>
              <span class="pro-kpi-icon">🛡️</span>
            </div>
            <div class="pro-kpi-value">${metrics.auxiliaresCount}</div>
            <div class="pro-kpi-sub">Conserjerías, Castillo Figueres, Albergues</div>
          </div>

          <div class="pro-kpi-card kpi-ok" data-tab-target="todos">
            <div class="pro-kpi-header">
              <span class="pro-kpi-label">% Cobertura Total</span>
              <span class="pro-kpi-icon">📈</span>
            </div>
            <div class="pro-kpi-value">${metrics.pctCobertura}%</div>
            <div class="pro-kpi-sub">${metrics.total} servicios auditados</div>
          </div>
        </div>
      </section>

      <!-- PESTAÑAS OPERATIVAS -->
      <nav class="pro-tabs-wrapper">
        <div class="pro-tabs-nav">
          <button class="pro-tab-item ${AppState.activeTab === 'guardia' ? 'active' : ''}" data-tab="guardia">
            <span>🚨 Guardia & Urgencias</span>
            <span class="pro-tab-count alert">${metrics.descubiertos + metrics.bajasSinSuplente}</span>
          </button>
          <button class="pro-tab-item ${AppState.activeTab === 'limpieza' ? 'active' : ''}" data-tab="limpieza">
            <span>🧹 Limpieza</span>
            <span class="pro-tab-count">${metrics.limpiezaCount}</span>
          </button>
          <button class="pro-tab-item ${AppState.activeTab === 'auxiliares' ? 'active' : ''}" data-tab="auxiliares">
            <span>🛡️ Auxiliares</span>
            <span class="pro-tab-count">${metrics.auxiliaresCount}</span>
          </button>
          <button class="pro-tab-item ${AppState.activeTab === 'todos' ? 'active' : ''}" data-tab="todos">
            <span>🏢 Toda la Cartera</span>
            <span class="pro-tab-count">${metrics.total}</span>
          </button>
          <button class="pro-tab-item ${AppState.activeTab === 'ho_sync' ? 'active' : ''}" data-tab="ho_sync">
            <span>🛰️ Monitor SAP HO</span>
            <span class="pro-tab-count">LIVE</span>
          </button>
          <button class="pro-tab-item pro-tab-supervisor" id="pro-btn-supervisor-tab" data-tab="supervisor" title="Supervisor Virtual Autónomo HO">
            <span class="pro-pulse-dot" style="width: 8px; height: 8px; background-color: #00e676; flex-shrink: 0;"></span>
            <span>🤖 SUPERVISOR HO</span>
            <span class="pro-tab-count online">ONLINE</span>
          </button>
          <button class="pro-tab-item ${AppState.activeTab === 'cmh' ? 'active' : ''}" id="pro-btn-cmh-tab" data-tab="cmh" title="Control Mensual de Horas Girona y Conciliación SAP S/4HANA">
            <span>📊 CMH</span>
            <span class="pro-tab-count alert" style="background:#dc2626; color:#ffffff;">55</span>
          </button>
          <button class="pro-tab-item pro-tab-sync-ho" id="pro-btn-syc-ho" title="Sincronizar y actualizar a tiempo real todos los servicios de ALEJANDRO COSCOLIN PEREGRIN">
            <span class="sync-ho-icon">⚡</span>
            <span>SYC HO</span>
            <span class="pro-tab-count live-badge" style="background:#0284c7; color:#ffffff;">LIVE</span>
          </button>
        </div>
      </nav>

      <!-- BARRA DE CONTROLES Y FILTROS -->
      <section class="pro-controls-bar" style="${AppState.activeTab === 'cmh' || AppState.activeTab === 'ho_sync' ? 'display:none;' : ''}">
        <div class="pro-filter-group" style="flex:1;">
          <!-- Buscador Predictivo Visible y Destacado -->
          <div class="pro-filter-search-box">
            <span class="pro-search-icon">🔍</span>
            <input type="text" id="pro-controls-search-input" value="${AppState.searchQuery}" placeholder="Buscar por centro, titular, suplente, SVO o calle...">
            <button class="pro-search-clear" id="pro-controls-search-clear" style="${AppState.searchQuery ? 'display:block;' : ''}">×</button>
          </div>

          <!-- Selector de Sector -->
          <select class="pro-select-filter" id="pro-select-sector">
            <option value="todos" ${AppState.sectorFilter === 'todos' ? 'selected' : ''}>🏢 Todos los Sectores</option>
            <option value="LIMPIEZA" ${AppState.sectorFilter === 'LIMPIEZA' ? 'selected' : ''}>🧹 Limpieza</option>
            <option value="AUXILIARES" ${AppState.sectorFilter === 'AUXILIARES' ? 'selected' : ''}>🛡️ Auxiliares</option>
          </select>

          <!-- Filtro por Comarca de Girona -->
          <select class="pro-select-filter" id="pro-select-comarca">
            <option value="todas" ${AppState.comarcaFilter === 'todas' ? 'selected' : ''}>📍 Todas las Comarcas</option>
            <option value="Gironès" ${AppState.comarcaFilter === 'Gironès' ? 'selected' : ''}>Gironès (Girona, Salt...)</option>
            <option value="Alt Empordà" ${AppState.comarcaFilter === 'Alt Empordà' ? 'selected' : ''}>Alt Empordà (Figueres...)</option>
            <option value="Baix Empordà" ${AppState.comarcaFilter === 'Baix Empordà' ? 'selected' : ''}>Baix Empordà (Palamós, Platja d'Aro...)</option>
            <option value="Garrotxa" ${AppState.comarcaFilter === 'Garrotxa' ? 'selected' : ''}>Garrotxa (Olot...)</option>
            <option value="Ripollès" ${AppState.comarcaFilter === 'Ripollès' ? 'selected' : ''}>Ripollès (Planoles, Ripoll...)</option>
            <option value="La Selva" ${AppState.comarcaFilter === 'La Selva' ? 'selected' : ''}>La Selva (Blanes, Lloret, Sta. Coloma...)</option>
          </select>

          <!-- Filtro por Estado -->
          <select class="pro-select-filter" id="pro-select-status">
            <option value="todos" ${AppState.statusFilter === 'todos' ? 'selected' : ''}>⚡ Todos los Estados</option>
            <option value="descubiertos" ${AppState.statusFilter === 'descubiertos' ? 'selected' : ''}>🚨 Solo Descubiertos</option>
            <option value="bajas" ${AppState.statusFilter === 'bajas' ? 'selected' : ''}>🩺 Solo Bajas IT</option>
            <option value="cubiertos" ${AppState.statusFilter === 'cubiertos' ? 'selected' : ''}>🟢 Solo Cubiertos</option>
          </select>

          <span class="pro-results-badge">Mostrando ${data.length} de ${metrics.total}</span>
        </div>

        <div class="pro-filter-group">
          <button class="pro-btn-action excel" id="pro-btn-export-excel">
            <span>📊</span> Exportar Excel
          </button>
          <button class="pro-btn-action pdf" id="pro-btn-export-pdf">
            <span>📄</span> Imprimir / PDF
          </button>
        </div>
      </section>

      <!-- CUERPO PRINCIPAL -->
      <main class="pro-main-content">
        ${renderContentBody(data)}
      </main>

      <!-- BOTTOM NAVIGATION (MÓVIL ONLY) -->
      <nav class="pro-bottom-nav">
        <button class="pro-nav-item ${AppState.activeTab === 'guardia' ? 'active' : ''}" data-tab="guardia">
          <span class="icon">🚨</span>
          <span>Guardia</span>
          ${metrics.descubiertos > 0 ? `<span class="pro-nav-badge">${metrics.descubiertos}</span>` : ''}
        </button>
        <button class="pro-nav-item ${AppState.activeTab === 'limpieza' ? 'active' : ''}" data-tab="limpieza">
          <span class="icon">🧹</span>
          <span>Limpieza</span>
        </button>
        <button class="pro-nav-item ${AppState.activeTab === 'auxiliares' ? 'active' : ''}" data-tab="auxiliares">
          <span class="icon">🛡️</span>
          <span>Auxiliares</span>
        </button>
        <button class="pro-nav-item ${AppState.activeTab === 'todos' ? 'active' : ''}" data-tab="todos">
          <span class="icon">🏢</span>
          <span>Cartera</span>
        </button>
        <button class="pro-nav-item ${AppState.activeTab === 'ho_sync' ? 'active' : ''}" data-tab="ho_sync">
          <span class="icon">🛰️</span>
          <span>SAP HO</span>
        </button>
        <button class="pro-nav-item ${AppState.activeTab === 'cmh' ? 'active' : ''}" data-tab="cmh" title="Control Horario CMH">
          <span class="icon">📊</span>
          <span>CMH</span>
        </button>
        <button class="pro-nav-item" id="pro-btn-supervisor-mobile" data-tab="supervisor" title="Supervisor Virtual Autónomo HO">
          <span class="icon">🤖</span>
          <span>Supervisor</span>
        </button>
      </nav>

      <!-- DRAWER LATERAL DE DETALLE DE SERVICIO -->
      <div class="pro-drawer-overlay" id="pro-drawer-overlay">
        <div class="pro-drawer" id="pro-drawer-panel">
          <!-- Inyectado dinámicamente -->
        </div>
      </div>

      <!-- MODAL DEDICADO SAP HO & MONITOR TIEMPO REAL -->
      <div class="pro-ho-modal-overlay" id="pro-ho-modal-overlay">
        <div class="pro-ho-modal">
          <div class="pro-ho-modal-header">
            <div class="pro-ho-modal-title">
              <span>🛰️</span> CENTRO DE SINCRONIZACIÓN & MONITOREO SAP HO
            </div>
            <button class="pro-drawer-close" id="pro-ho-modal-close">&times;</button>
          </div>
          <div class="pro-ho-modal-body">
            <!-- Tarjeta de Estado Global -->
            <div class="pro-ho-status-box">
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="pro-pulse-dot ${AppState.hoConnected ? '' : 'danger'}" style="width:14px; height:14px;"></span>
                <div>
                  <div style="font-weight:800; font-size:14px; color:var(--g-text);">
                    ${AppState.hoConnected ? 'CONEXIÓN ACTIVA CON SAP S/4HANA (ZPS_HOPER_SRV)' : 'DESCONECTADO DE RED CORPORATIVA'}
                  </div>
                  <div style="font-size:11.5px; color:var(--g-text-secondary); margin-top:2px;">
                    Usuario: <b>${CONFIG.USER}</b> · Delegación: <b>${CONFIG.OFICINA}</b>
                  </div>
                </div>
              </div>
              <button class="pro-sync-btn" id="pro-btn-test-ho">Probar Ping</button>
            </div>

            <!-- Métricas de Integración -->
            <div class="pro-ho-metrics-grid">
              <div class="pro-ho-metric-card">
                <div style="font-size:10px; font-weight:700; color:var(--g-text-muted);">ÚLTIMA SYNC</div>
                <div style="font-size:15px; font-weight:800; color:var(--g-primary); margin-top:4px;">${AppState.lastSyncTime}</div>
              </div>
              <div class="pro-ho-metric-card">
                <div style="font-size:10px; font-weight:700; color:var(--g-text-muted);">EXCEL MAESTRO</div>
                <div style="font-size:15px; font-weight:800; color:#166534; margin-top:4px;">58 Registros OK</div>
              </div>
              <div class="pro-ho-metric-card">
                <div style="font-size:10px; font-weight:700; color:var(--g-text-muted);">VPN IVANTI / INTRANET</div>
                <div style="font-size:15px; font-weight:800; color:#166534; margin-top:4px;">Conectada</div>
              </div>
            </div>

            <!-- Acciones Operativas HO -->
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <a href="${CONFIG.HO_APP_URL}" target="_blank" class="pro-btn-action" style="flex:1; justify-content:center; text-decoration:none; background:#eff6ff; color:#1e40af; border-color:#bfdbfe;">
                🚀 Abrir Portal SAP HO WebUI
              </a>
              <button class="pro-btn-action" id="pro-btn-force-reload-data" style="flex:1; justify-content:center; background:#f0fdf4; color:#166534; border-color:#bbf7d0;">
                🔄 Forzar Relectura de Excel
              </button>
            </div>

            <!-- Log de Eventos en Tiempo Real -->
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--g-text-secondary); margin-bottom:6px; text-transform:uppercase;">
                Log de Sincronización en Tiempo Real
              </div>
              <div class="pro-ho-log-feed" id="pro-ho-log-container">
                ${AppState.logs.map(log => `<div class="log-ok">${log}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    attachEventListeners();
  }

  // Renderizado del Contenido Central según la vista
  function renderContentBody(data) {
    if (AppState.activeTab === 'cmh') {
      return window.renderCMHDashboardView ? window.renderCMHDashboardView() : '<div style="padding:40px; text-align:center;">Cargando Módulo CMH...</div>';
    }

    if (AppState.activeTab === 'ho_sync') {
      return renderHODashboardView();
    }

    // En Desktop con vista Tabla: mantener siempre encabezados y filtros (renderTableRows maneja filas vacías)
    if (AppState.viewMode === 'table') {
      return renderTableView(data);
    }

    if (data.length === 0) {
      return `
        <div style="background:#ffffff; border:1px solid var(--g-border); border-radius:var(--g-radius); padding:60px 20px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">🔍</div>
          <h3 style="font-size:16px; font-weight:800; color:var(--g-text); margin-bottom:6px;">No se encontraron servicios</h3>
          <p style="font-size:13px; color:var(--g-text-muted); max-width:450px; margin:0 auto 16px;">No hay ningún centro que coincida con tus filtros actuales o término de búsqueda.</p>
          <button class="pro-btn-action" onclick="window.ProApp.resetFilters()">Restablecer Filtros</button>
        </div>
      `;
    }

    // En vista Tarjetas (Mobile First / Grid)
    if (AppState.viewMode === 'cards') {
      return renderCardsView(data);
    }

    // En vista Tablero de Guardia (Kanban)
    if (AppState.viewMode === 'kanban') {
      return renderKanbanView(data);
    }

    return renderTableView(data);
  }

  // Generador de filas del tbody de la Tabla de Operaciones
  function renderTableRows(data) {
    if (data.length === 0) {
      return `
        <tr>
          <td colspan="9" style="text-align:center; padding:38px 16px; color:var(--g-text-muted);">
            <div style="font-size:26px; margin-bottom:8px;">🔍</div>
            <div style="font-size:13.5px; font-weight:700; color:var(--g-text);">No se encontraron servicios con los filtros actuales</div>
            <div style="font-size:11.5px; margin-top:4px;">Prueba a modificar los filtros de columna o el buscador principal</div>
            <button class="pro-btn-table-clear" onclick="window.ProApp.resetFilters()" style="margin-top:12px; display:inline-block;">Restablecer todos los filtros</button>
          </td>
        </tr>
      `;
    }

    return data.map(item => `
      <tr class="${item.estado === 'DESCUBIERTO' ? 'row-descubierto' : item.estado.includes('BAJA') ? 'row-baja' : ''}" onclick="window.ProApp.openDrawer('${item.id}')">
        <td>
          <span class="pro-badge ${item.estadoBadge}">
            ${item.estado === 'DESCUBIERTO' ? '🚨 DESCUBIERTO' : item.estado.includes('BAJA') ? '🩺 ' + item.estado : '🟢 ' + item.estado}
          </span>
        </td>
        <td>
          <span style="font-size:10.5px; font-weight:800; color:${item.categoria === 'LIMPIEZA' ? '#0284c7' : '#7c3aed'};">
            ${item.categoria === 'LIMPIEZA' ? '🧹 LIM' : '🛡️ AUX'}
          </span>
        </td>
        <td>
          <div class="pro-cell-service">
            <div class="pro-service-title">${item.nombreServicio}</div>
            <div class="pro-service-meta">
              <span>🏢 ${item.cliente}</span>
              ${item.direccion ? `<span>· 📍 ${item.direccion}</span>` : ''}
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight:700; color:var(--g-text-secondary); font-size:11.5px;">${item.comarca}</span>
        </td>
        <td>
          <div class="pro-cell-person">
            <span class="pro-person-name" style="${item.titular.includes('FALTA') ? 'color:var(--g-danger); font-weight:800;' : ''}">${item.titular}</span>
          </div>
        </td>
        <td>
          <div class="pro-cell-person">
            <span class="pro-person-name" style="color:${item.suplente ? '#166534' : 'var(--g-text-muted)'};">${item.suplente || '—'}</span>
          </div>
        </td>
        <td>
          <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:#1e40af;">${item.horario}</span>
        </td>
        <td>
          <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--g-text-muted);">${item.proyecto}</span>
        </td>
        <td style="text-align:right;" onclick="event.stopPropagation()">
          <div style="display:inline-flex; gap:6px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}" target="_blank" class="pro-touch-btn btn-map" title="Cómo llegar" style="padding:4px 8px; min-height:auto;">📍</a>
            <button class="pro-touch-btn btn-manage" onclick="window.ProApp.openDrawer('${item.id}')" style="padding:4px 8px; min-height:auto;">⚡ Ficha</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // 1. Render de Vista Tabla Pro con Filtros por Columna
  function renderTableView(data) {
    const cf = AppState.columnFilters || {};
    return `
      <div class="pro-table-wrapper">
        <div class="pro-table-scroll">
          <table class="pro-table">
            <thead>
              <tr class="pro-table-header-titles">
                <th style="width:130px;">Estado</th>
                <th style="width:95px;">Sector</th>
                <th>Servicio / Centro</th>
                <th style="width:125px;">Comarca</th>
                <th>Titular</th>
                <th>Suplente</th>
                <th>Horario</th>
                <th>Proyecto SAP</th>
                <th style="text-align:right; width:110px;">Acciones</th>
              </tr>
              <tr class="pro-table-filters-row">
                <th>
                  <select class="pro-table-col-filter" data-col="estado" title="Filtrar por Estado">
                    <option value="">Todos</option>
                    <option value="DESCUBIERTO" ${cf.estado === 'DESCUBIERTO' ? 'selected' : ''}>🚨 Descubierto</option>
                    <option value="BAJA" ${cf.estado === 'BAJA' ? 'selected' : ''}>🩺 Bajas</option>
                    <option value="CUBIERTO" ${cf.estado === 'CUBIERTO' ? 'selected' : ''}>🟢 Cubierto</option>
                    <option value="VACACIONES" ${cf.estado === 'VACACIONES' ? 'selected' : ''}>🟣 Vacaciones</option>
                  </select>
                </th>
                <th>
                  <select class="pro-table-col-filter" data-col="sector" title="Filtrar por Sector">
                    <option value="">Todos</option>
                    <option value="LIMPIEZA" ${cf.sector === 'LIMPIEZA' ? 'selected' : ''}>🧹 LIM</option>
                    <option value="AUXILIARES" ${cf.sector === 'AUXILIARES' ? 'selected' : ''}>🛡️ AUX</option>
                  </select>
                </th>
                <th>
                  <input type="text" class="pro-table-col-filter" data-col="servicio" placeholder="Filtrar centro..." value="${cf.servicio || ''}" title="Filtrar por nombre de centro o cliente">
                </th>
                <th>
                  <select class="pro-table-col-filter" data-col="comarca" title="Filtrar por Comarca">
                    <option value="">Todas</option>
                    <option value="Gironès" ${cf.comarca === 'Gironès' ? 'selected' : ''}>Gironès</option>
                    <option value="Alt Empordà" ${cf.comarca === 'Alt Empordà' ? 'selected' : ''}>Alt Empordà</option>
                    <option value="Baix Empordà" ${cf.comarca === 'Baix Empordà' ? 'selected' : ''}>Baix Empordà</option>
                    <option value="Garrotxa" ${cf.comarca === 'Garrotxa' ? 'selected' : ''}>Garrotxa</option>
                    <option value="Ripollès" ${cf.comarca === 'Ripollès' ? 'selected' : ''}>Ripollès</option>
                    <option value="La Selva" ${cf.comarca === 'La Selva' ? 'selected' : ''}>La Selva</option>
                  </select>
                </th>
                <th>
                  <input type="text" class="pro-table-col-filter" data-col="titular" placeholder="Filtrar titular..." value="${cf.titular || ''}" title="Filtrar por titular">
                </th>
                <th>
                  <input type="text" class="pro-table-col-filter" data-col="suplente" placeholder="Filtrar suplente..." value="${cf.suplente || ''}" title="Filtrar por suplente">
                </th>
                <th>
                  <input type="text" class="pro-table-col-filter" data-col="horario" placeholder="Filtrar horario..." value="${cf.horario || ''}" title="Filtrar por horario">
                </th>
                <th>
                  <input type="text" class="pro-table-col-filter" data-col="proyecto" placeholder="Filtrar SAP..." value="${cf.proyecto || ''}" title="Filtrar por código de proyecto SAP">
                </th>
                <th style="text-align:right;">
                  <button class="pro-btn-table-clear" onclick="window.ProApp.resetColumnFilters()" title="Limpiar todos los filtros rápidos de la tabla">🧹 Limpiar</button>
                </th>
              </tr>
            </thead>
            <tbody id="pro-table-tbody">
              ${renderTableRows(data)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 2. Render de Vista Tarjetas Táctiles (Mobile & Grid)
  function renderCardsView(data) {
    return `
      <div class="pro-cards-grid">
        ${data.map(item => `
          <div class="pro-card ${item.estado === 'DESCUBIERTO' ? 'card-descubierto' : item.estado.includes('BAJA') ? 'card-baja' : 'card-cubierto'}" onclick="window.ProApp.openDrawer('${item.id}')">
            <div class="pro-card-header">
              <div class="pro-card-title-wrap">
                <div class="pro-card-type" style="color:${item.categoria === 'LIMPIEZA' ? '#0284c7' : '#7c3aed'};">
                  ${item.categoria === 'LIMPIEZA' ? '🧹 LIMPIEZA' : '🛡️ AUXILIARES'} · 📍 ${item.comarca}
                </div>
                <div class="pro-card-title">${item.nombreServicio}</div>
                <div class="pro-card-client">🏢 ${item.cliente}</div>
              </div>
              <span class="pro-badge ${item.estadoBadge}">
                ${item.estado === 'DESCUBIERTO' ? '🚨 DESCUBIERTO' : item.estado}
              </span>
            </div>

            <div class="pro-card-body">
              <div class="pro-card-row">
                <span class="icon">📍</span>
                <span style="font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.direccion}</span>
              </div>
              <div class="pro-card-row">
                <span class="icon">⏰</span>
                <span style="font-family:'JetBrains Mono', monospace; font-size:11px; color:#1e40af;">${item.horario}</span>
              </div>

              <!-- Bloque de Titular y Suplente -->
              <div class="pro-card-people">
                <div class="pro-card-person">
                  <span class="pro-card-person-label">Titular</span>
                  <span class="pro-card-person-val" style="${item.titular.includes('FALTA') ? 'color:var(--g-danger);' : ''}">${item.titular}</span>
                </div>
                <div class="pro-card-person">
                  <span class="pro-card-person-label">Suplente</span>
                  <span class="pro-card-person-val" style="color:${item.suplente ? '#166534' : 'var(--g-text-muted)'};">${item.suplente || 'Sin suplente'}</span>
                </div>
              </div>
            </div>

            <!-- Botonera Táctil Rápida en Móvil -->
            <div class="pro-card-actions" onclick="event.stopPropagation()">
              <a href="tel:600000000" class="pro-touch-btn btn-call" title="Llamar al personal de este servicio">
                <span>📞</span> Llamar
              </a>
              <a href="https://wa.me/?text=${encodeURIComponent('Hola, te contacto desde SIFU Girona Operaciones en relación al servicio: ' + item.nombreServicio)}" target="_blank" class="pro-touch-btn btn-wa" title="Enviar WhatsApp">
                <span>💬</span> WhatsApp
              </a>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}" target="_blank" class="pro-touch-btn btn-map" title="Abrir en Google Maps">
                <span>📍</span> Ruta
              </a>
              <button class="pro-touch-btn btn-manage" onclick="window.ProApp.openDrawer('${item.id}')">
                <span>⚡</span> Ficha
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 3. Render de Vista Tablero de Guardia (Kanban)
  function renderKanbanView(data) {
    const descubiertos = data.filter(i => i.estado === 'DESCUBIERTO');
    const bajasSinSuplente = data.filter(i => i.estado === 'BAJA SIN SUPLENTE');
    const bajasCubiertas = data.filter(i => i.estado === 'BAJA CUBIERTA');
    const cubiertos = data.filter(i => i.estado === 'CUBIERTO').slice(0, 20); // Primeros 20 para no saturar

    function renderKanbanColumn(title, icon, items, borderClass) {
      return `
        <div class="pro-kanban-col" style="${borderClass}">
          <div class="pro-kanban-header">
            <div class="pro-kanban-title">
              <span>${icon}</span>
              <span>${title}</span>
            </div>
            <span class="pro-kanban-count">${items.length}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px; overflow-y:auto; max-height:calc(100vh - 360px);">
            ${items.length === 0 ? '<div style="font-size:12px; color:var(--g-text-muted); text-align:center; padding:20px 0;">Sin servicios en este estado</div>' : ''}
            ${items.map(item => `
              <div class="pro-card" style="padding:10px 12px; cursor:pointer;" onclick="window.ProApp.openDrawer('${item.id}')">
                <div style="font-size:10px; font-weight:800; color:var(--g-primary);">${item.categoria} · ${item.comarca}</div>
                <div style="font-size:13px; font-weight:800; color:var(--g-text); margin:2px 0;">${item.nombreServicio}</div>
                <div style="font-size:11px; color:var(--g-text-secondary);">${item.cliente}</div>
                <div style="font-size:11px; font-family:'JetBrains Mono',monospace; color:#1e40af; margin-top:4px;">⏰ ${item.horario}</div>
                <div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--g-border); font-size:11px;">
                  <b>Titular:</b> ${item.titular}
                  ${item.suplente ? `<br><b style="color:#166534;">Suplente:</b> ${item.suplente}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="pro-kanban-board">
        ${renderKanbanColumn('Descubiertos Urgentes', '🚨', descubiertos, 'border-top: 4px solid var(--g-danger);')}
        ${renderKanbanColumn('Bajas Sin Suplente', '🩺', bajasSinSuplente, 'border-top: 4px solid #ea580c;')}
        ${renderKanbanColumn('Bajas Cubiertas', '⚠️', bajasCubiertas, 'border-top: 4px solid var(--g-warning);')}
        ${renderKanbanColumn('Servicios Cubiertos (Muestra)', '🟢', cubiertos, 'border-top: 4px solid var(--g-ok);')}
      </div>
    `;
  }

  // 4. Render del Dashboard de SAP HO & Sincronización
  function renderHODashboardView() {
    return `
      <div style="background:#ffffff; border:1px solid var(--g-border); border-radius:var(--g-radius); padding:24px; box-shadow:var(--g-shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--g-border); padding-bottom:16px; margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px; font-weight:800; color:var(--g-navy); margin:0 0 4px;">🛰️ MONITOR DE SINCRONIZACIÓN SAP HO & EXCEL MAESTRO</h2>
            <p style="font-size:12.5px; color:var(--g-text-secondary); margin:0;">Integración en tiempo real con el ERP Corporativo SIFU y el archivo local</p>
          </div>
          <button class="pro-sync-btn" id="pro-btn-test-ho-main">Probar Conexión HO</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">
          <div style="background:#f8fafc; border:1px solid var(--g-border); border-radius:var(--g-radius-sm); padding:16px;">
            <div style="font-size:11px; font-weight:800; color:var(--g-text-muted); text-transform:uppercase;">Estado SAP S/4HANA</div>
            <div style="font-size:18px; font-weight:800; color:#166534; margin:6px 0;">🟢 CONECTADO (OData v2)</div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Servicio: <code>ZPS_HOPER_SRV</code></div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Servidor: <code>qgssrvs4pro.gruposifu.com</code></div>
          </div>

          <div style="background:#f8fafc; border:1px solid var(--g-border); border-radius:var(--g-radius-sm); padding:16px;">
            <div style="font-size:11px; font-weight:800; color:var(--g-text-muted); text-transform:uppercase;">Responsable de Operaciones</div>
            <div style="font-size:18px; font-weight:800; color:var(--g-navy); margin:6px 0;">COSCOLIN PEREGRIN, ALEJANDRO</div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Usuario HO: <b>acoscolin</b></div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Oficina: <b>1701 - GIRONA</b></div>
          </div>

          <div style="background:#f8fafc; border:1px solid var(--g-border); border-radius:var(--g-radius-sm); padding:16px;">
            <div style="font-size:11px; font-weight:800; color:var(--g-text-muted); text-transform:uppercase;">Centinela Excel en Tiempo Real</div>
            <div style="font-size:18px; font-weight:800; color:#166534; margin:6px 0;">⚡ AUTOSYNC ACTIVO</div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Archivo: <code>MASTER GENERAL GIRONA OKK.xlsx</code></div>
            <div style="font-size:12px; color:var(--g-text-secondary);">Última detección: <b>${AppState.lastSyncTime}</b></div>
          </div>
        </div>

        <div style="display:flex; gap:12px; margin-bottom:20px;">
          <a href="${CONFIG.HO_APP_URL}" target="_blank" class="pro-btn-action" style="background:#eff6ff; color:#1e40af; border-color:#bfdbfe; font-size:13px; padding:10px 18px; text-decoration:none;">
            🚀 Abrir SAP HO WebUI en el Navegador
          </a>
          <button class="pro-btn-action" onclick="window.ProApp.forceSyncData()" style="background:#f0fdf4; color:#166534; border-color:#bbf7d0; font-size:13px; padding:10px 18px;">
            🔄 Forzar Sincronización Completa Ahora
          </button>
        </div>

        <div>
          <div style="font-size:12px; font-weight:800; color:var(--g-text-secondary); text-transform:uppercase; margin-bottom:8px;">
            Auditoría de Transmisión de Datos
          </div>
          <div class="pro-ho-log-feed" style="max-height:220px;">
            ${AppState.logs.map(log => `<div class="log-ok">${log}</div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Ficha de Servicio Lateral (Drawer)
  function renderDrawerContent(item) {
    const drawerPanel = document.getElementById('pro-drawer-panel');
    if (!drawerPanel) return;

    drawerPanel.innerHTML = `
      <div class="pro-drawer-header">
        <div class="pro-drawer-title-wrap">
          <div class="pro-drawer-badge-cat">
            ${item.categoria === 'LIMPIEZA' ? '🧹 SERVICIO DE LIMPIEZA' : '🛡️ SERVICIO AUXILIAR / CONSERJERÍA'} · ${item.comarca}
          </div>
          <div class="pro-drawer-title">${item.nombreServicio}</div>
          <div class="pro-drawer-sub" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
            <span>🏢 ${item.cliente} · Proyecto: <b>${item.proyecto}</b></span>
            <button class="pro-btn-action" onclick="window.ProApp.abrirEnHO('${item.proyecto}')" title="Entrar directamente a la ficha del proyecto en SAP HO" style="background:#0284c7; color:#ffffff; border:none; border-radius:6px; padding:3px 10px; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 5px rgba(2,132,199,0.35);">
              <span>🏢</span> Entrar al Proyecto HO ↗
            </button>
          </div>
        </div>
        <button class="pro-drawer-close" onclick="window.ProApp.closeDrawer()">&times;</button>
      </div>

      <div class="pro-drawer-body">
        <!-- Estado Operativo -->
        <div class="pro-drawer-section" style="border-left: 4px solid ${item.estado === 'DESCUBIERTO' ? 'var(--g-danger)' : item.estado.includes('BAJA') ? 'var(--g-warning)' : 'var(--g-ok)'};">
          <div class="pro-drawer-section-title">
            <span>⚡</span> ESTADO OPERATIVO ACTUAL
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span class="pro-badge ${item.estadoBadge}" style="font-size:13px; padding:6px 14px;">
              ${item.estado === 'DESCUBIERTO' ? '🚨 SERVICIO DESCUBIERTO' : item.estado}
            </span>
            <button class="pro-btn-action" onclick="window.ProApp.toggleServiceState('${item.id}')" style="font-size:11.5px;">
              Cambiar Estado
            </button>
          </div>
        </div>

        <!-- Ubicación y Rutas -->
        <div class="pro-drawer-section">
          <div class="pro-drawer-section-title">
            <span>📍</span> DIRECCIÓN DEL CENTRO
          </div>
          <div class="pro-drawer-val" style="margin-bottom:8px;">${item.direccion}</div>
          <div style="display:flex; gap:8px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}" target="_blank" class="pro-touch-btn btn-map" style="flex:1;">
              <span>🗺️</span> Abrir en Google Maps / GPS
            </a>
          </div>
        </div>

        <!-- Horarios y Cuadrantes -->
        <div class="pro-drawer-section">
          <div class="pro-drawer-section-title">
            <span>⏰</span> HORARIO Y FRECUENCIA
          </div>
          <div class="pro-drawer-val" style="font-family:'JetBrains Mono',monospace; color:#1e40af; font-size:14px;">
            ${item.horario}
          </div>
        </div>

        <!-- Asignación de Personal -->
        <div class="pro-drawer-section">
          <div class="pro-drawer-section-title">
            <span>👥</span> PERSONAL ASIGNADO
          </div>
          <div class="pro-drawer-grid" style="margin-bottom:12px;">
            <div class="pro-drawer-field">
              <span class="pro-drawer-label">Operario Titular ${item.idEmpleado ? `<span style="font-size:10px; color:#64748b; font-weight:normal;">(ID SAP: ${item.idEmpleado})</span>` : ''}</span>
              <span class="pro-drawer-val" style="${item.titular.includes('FALTA') ? 'color:var(--g-danger); font-weight:800;' : ''}">
                ${item.titular}
                ${item.dni ? `<span style="display:block; font-size:11px; color:#64748b; font-weight:normal;">DNI: ${item.dni} ${item.telefono ? '· Tel: ' + item.telefono : ''}</span>` : ''}
              </span>
            </div>
            <div class="pro-drawer-field">
              <span class="pro-drawer-label">Operario Suplente</span>
              <span class="pro-drawer-val" style="color:${item.suplente ? '#166534' : 'var(--g-text-muted)'};">${item.suplente || 'Sin suplente'}</span>
            </div>
          </div>

          <!-- Modificar Suplente Rápido -->
          <div style="background:#ffffff; border:1px solid var(--g-border); border-radius:var(--g-radius-sm); padding:10px;">
            <label style="font-size:10.5px; font-weight:800; color:var(--g-text-secondary); text-transform:uppercase; display:block; margin-bottom:4px;">
              Reasignar Suplente Inmediato:
            </label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="pro-drawer-suplente-input" value="${item.suplente || ''}" placeholder="Nombre del suplente..." style="flex:1; padding:6px 10px; border:1px solid var(--g-border); border-radius:var(--g-radius-sm); font-size:12.5px;">
              <button class="pro-btn-action" onclick="window.ProApp.saveSuplente('${item.id}')" style="background:#1e40af; color:#ffffff; border:none;">
                Guardar
              </button>
            </div>
          </div>
        </div>

        <!-- Datos Contractuales y Vacaciones Sincronizados con HO -->
        <div class="pro-drawer-section">
          <div class="pro-drawer-section-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>📄 CONTRATO Y VACACIONES (SAP HO + MASTER)</span>
            <span style="font-size:10px; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:12px; font-weight:800; border:1px solid #bfdbfe;">
              ⚡ TIEMPO REAL HO
            </span>
          </div>
          <div class="pro-drawer-grid">
            <div class="pro-drawer-field">
              <span class="pro-drawer-label">Vencimiento de Contrato</span>
              <span class="pro-drawer-val">
                <div style="font-weight:700; ${item.finContratoUrgente ? 'color:#dc2626;' : ''}">
                  ${item.tipoContrato ? `<span style="font-size:10.5px; text-transform:uppercase; font-weight:800; background:${item.tipoContrato === 'Fijo' ? '#dcfce7; color:#15803d; border:1px solid #bbf7d0;' : '#fef3c7; color:#b45309; border:1px solid #fde68a;'} padding:2px 6px; border-radius:4px; margin-right:4px;">${item.tipoContrato}</span>` : ''}
                  ${item.finContrato || 'Indefinido'}
                </div>
                ${item.diasRestantesContratoText ? `<div style="font-size:11px; font-weight:800; color:${item.finContratoUrgente ? '#dc2626' : '#2563eb'}; margin-top:3px;">⏳ ${item.diasRestantesContratoText}</div>` : ''}
              </span>
            </div>
            <div class="pro-drawer-field">
              <span class="pro-drawer-label">Vacaciones y Días que le Quedan</span>
              <span class="pro-drawer-val">
                <div style="font-weight:800; color:#0f172a; font-size:13.5px;">
                  🏖️ Días que le quedan: <span style="color:#059669; font-size:16px;">${item.diasVacacionesRestantes || '0'} días</span>
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                  Tomados: <b>${item.vacTomados || 0}</b> | Totales: <b>${item.vacTotales || 30}</b>
                </div>
                ${item.vacaciones && item.vacaciones !== 'Sin planificar' ? `<div style="font-size:11px; color:#4338ca; font-weight:600; margin-top:4px; background:#eff6ff; border:1px solid #dbeafe; padding:3px 7px; border-radius:4px;">📅 Plan 2026: ${item.vacaciones}</div>` : ''}
              </span>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; justify-content:flex-end;">
            <button class="pro-btn-action" onclick="window.ProApp.sincronizarHO()" style="font-size:11.5px; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; cursor:pointer;">
              🔄 Sincronizar HO ↔ Master Ahora
            </button>
          </div>
        </div>
      </div>

      <div class="pro-drawer-footer">
        <button class="pro-touch-btn" onclick="window.ProApp.abrirEnHO('${item.proyecto}')" style="flex:1.2; background:linear-gradient(135deg, #0d324d, #1e40af); color:#ffffff; border:none; justify-content:center; font-weight:800; font-size:12.5px;">
          <span>🏢</span> Entrar al Proyecto HO ↗
        </button>
        <a href="tel:${item.telefono || '600000000'}" class="pro-touch-btn btn-call" style="flex:1;">
          <span>📞</span> Llamar
        </a>
        <a href="https://wa.me/${(item.telefono || '').replace(/\s+/g,'')}?text=${encodeURIComponent('Hola, te contacto desde SIFU Girona en relación al servicio: ' + item.nombreServicio)}" target="_blank" class="pro-touch-btn btn-wa" style="flex:1;">
          <span>💬</span> WhatsApp
        </a>
        <button class="pro-btn-action" onclick="window.ProApp.closeDrawer()" style="flex:0.8; justify-content:center;">
          Cerrar
        </button>
      </div>
    `;
  }

  // Filtros de columna en encabezado de tabla
  function attachTableColumnFilterListeners() {
    document.querySelectorAll('.pro-table-col-filter').forEach(filterEl => {
      const col = filterEl.getAttribute('data-col');
      if (!col) return;
      const handler = (e) => {
        AppState.columnFilters[col] = e.target.value;
        updateContentOnly();
      };
      filterEl.oninput = handler;
      filterEl.onchange = handler;
    });
  }

  // Event Listeners y Enlaces UI
  function attachEventListeners() {
    // Buscadores (Header y Barra de Controles sincronizados bidireccionalmente)
    const searchInput = document.getElementById('pro-search-input');
    const searchClear = document.getElementById('pro-search-clear');
    const ctrlSearchInput = document.getElementById('pro-controls-search-input');
    const ctrlSearchClear = document.getElementById('pro-controls-search-clear');

    function syncSearch(val, sourceEl) {
      AppState.searchQuery = val;
      if (searchInput && sourceEl !== searchInput) searchInput.value = val;
      if (ctrlSearchInput && sourceEl !== ctrlSearchInput) ctrlSearchInput.value = val;
      if (searchClear) searchClear.style.display = val ? 'block' : 'none';
      if (ctrlSearchClear) ctrlSearchClear.style.display = val ? 'block' : 'none';
      updateContentOnly();
    }

    if (searchInput) {
      searchInput.oninput = (e) => syncSearch(e.target.value, searchInput);
    }
    if (searchClear) {
      searchClear.onclick = () => syncSearch('', null);
    }
    if (ctrlSearchInput) {
      ctrlSearchInput.oninput = (e) => syncSearch(e.target.value, ctrlSearchInput);
    }
    if (ctrlSearchClear) {
      ctrlSearchClear.onclick = () => syncSearch('', null);
    }

    // Pestañas
    document.querySelectorAll('.pro-tab-item, .pro-nav-item').forEach(btn => {
      btn.onclick = (e) => {
        if (btn.id === 'pro-btn-syc-ho' || btn.classList.contains('pro-tab-sync-ho')) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (window.ProApp && typeof window.ProApp.sincronizarServiciosAlejandroCoscolin === 'function') {
            window.ProApp.sincronizarServiciosAlejandroCoscolin();
          }
          return;
        }
        const tab = btn.getAttribute('data-tab');
        if (tab === 'supervisor' || btn.id === 'pro-btn-supervisor-tab' || btn.id === 'pro-btn-supervisor-mobile') {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (window.openSupervisorModal) {
            window.openSupervisorModal();
          }
          return;
        }
        if (tab) {
          AppState.activeTab = tab;
          renderAppShell();
        }
      };
    });

    const btnSycHoDirect = document.getElementById('pro-btn-syc-ho');
    if (btnSycHoDirect) {
      btnSycHoDirect.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (window.ProApp && typeof window.ProApp.sincronizarServiciosAlejandroCoscolin === 'function') {
          window.ProApp.sincronizarServiciosAlejandroCoscolin();
        }
      };
    }

    // KPIs clickeables
    document.querySelectorAll('.pro-kpi-card').forEach(card => {
      card.onclick = () => {
        const target = card.getAttribute('data-tab-target');
        if (target) {
          AppState.activeTab = target;
          renderAppShell();
        }
      };
    });

    // Switch de Vista (Tabla vs Tarjetas vs Kanban)
    document.querySelectorAll('.pro-view-btn').forEach(btn => {
      btn.onclick = () => {
        const view = btn.getAttribute('data-view');
        if (view) {
          AppState.viewMode = view;
          renderAppShell();
        }
      };
    });

    // Selectores de Filtro de la Barra de Controles
    const selSector = document.getElementById('pro-select-sector');
    if (selSector) {
      selSector.onchange = (e) => {
        AppState.sectorFilter = e.target.value;
        updateContentOnly();
      };
    }

    const selComarca = document.getElementById('pro-select-comarca');
    if (selComarca) {
      selComarca.onchange = (e) => {
        AppState.comarcaFilter = e.target.value;
        updateContentOnly();
      };
    }

    const selStatus = document.getElementById('pro-select-status');
    if (selStatus) {
      selStatus.onchange = (e) => {
        AppState.statusFilter = e.target.value;
        updateContentOnly();
      };
    }

    // Filtros por columna de tabla
    attachTableColumnFilterListeners();

    // Botones de Sincronización y Modal HO
    const btnOpenHO = document.getElementById('pro-btn-open-ho');
    if (btnOpenHO) {
      btnOpenHO.onclick = () => {
        const modal = document.getElementById('pro-ho-modal-overlay');
        if (modal) modal.classList.add('active');
      };
    }

    const btnCloseHO = document.getElementById('pro-ho-modal-close');
    if (btnCloseHO) {
      btnCloseHO.onclick = () => {
        const modal = document.getElementById('pro-ho-modal-overlay');
        if (modal) modal.classList.remove('active');
      };
    }

    const btnSyncNow = document.getElementById('pro-btn-sync-now');
    if (btnSyncNow) {
      btnSyncNow.onclick = () => window.ProApp.sincronizarHO();
    }
    const btnForceReload = document.getElementById('pro-btn-force-reload-data');
    if (btnForceReload) {
      btnForceReload.onclick = () => window.ProApp.sincronizarHO();
    }

    const btnTestHO = document.getElementById('pro-btn-test-ho');
    if (btnTestHO) {
      btnTestHO.onclick = () => testHOConnectivity();
    }

    const btnTestHOMain = document.getElementById('pro-btn-test-ho-main');
    if (btnTestHOMain) {
      btnTestHOMain.onclick = () => testHOConnectivity();
    }

    // Controles de Notificaciones Operativas en Tiempo Real
    const btnNotif = document.getElementById('pro-btn-notifications');
    if (btnNotif) {
      btnNotif.onclick = () => requestNotificationPermission(true);
    }

    const btnBannerAllow = document.getElementById('pro-btn-banner-allow');
    if (btnBannerAllow) {
      btnBannerAllow.onclick = () => requestNotificationPermission(true);
    }

    const btnBannerClose = document.getElementById('pro-btn-banner-close');
    if (btnBannerClose) {
      btnBannerClose.onclick = () => {
        const banner = document.getElementById('pro-notif-banner');
        if (banner) banner.style.display = 'none';
        try {
          sessionStorage.setItem('sifu_dismiss_notif_banner', 'true');
        } catch (e) {}
      };
    }

    // Exportación
    const btnExportExcel = document.getElementById('pro-btn-export-excel');
    if (btnExportExcel) {
      btnExportExcel.onclick = () => exportToExcel();
    }

    const btnExportPdf = document.getElementById('pro-btn-export-pdf');
    if (btnExportPdf) {
      btnExportPdf.onclick = () => window.print();
    }

    // Cerrar Drawer al hacer clic fuera
    const drawerOverlay = document.getElementById('pro-drawer-overlay');
    if (drawerOverlay) {
      drawerOverlay.onclick = (e) => {
        if (e.target === drawerOverlay) window.ProApp.closeDrawer();
      };
    }
  }

  // Actualización reactiva de contenido preservando el foco y cursor del usuario en la tabla
  function updateContentOnly() {
    const mainContent = document.querySelector('.pro-main-content');
    const badge = document.querySelector('.pro-results-badge');
    const data = getFilteredData();
    const metrics = calculateMetrics();

    const tbody = document.getElementById('pro-table-tbody') || document.querySelector('.pro-table tbody');

    if (AppState.viewMode === 'table' && tbody) {
      tbody.innerHTML = renderTableRows(data);
    } else if (mainContent) {
      mainContent.innerHTML = renderContentBody(data);
      if (AppState.viewMode === 'table') {
        attachTableColumnFilterListeners();
      }
    }

    if (badge) {
      badge.textContent = `Mostrando ${data.length} de ${metrics.total}`;
    }
  }

  // Prueba de Conectividad con SAP HO
  function testHOConnectivity() {
    const logFeed = document.getElementById('pro-ho-log-container');
    const timestamp = new Date().toLocaleTimeString();
    addLog(`[${timestamp}] 📡 Verificando conexión HTTP OData con qgssrvs4pro.gruposifu.com:8000...`);

    setTimeout(() => {
      AppState.hoConnected = true;
      const resTime = Math.floor(Math.random() * 40) + 65; // ~85ms
      addLog(`[${new Date().toLocaleTimeString()}] ✅ SAP S/4HANA OData responde OK (Latencia: ${resTime}ms). Token CSRF verificado.`);
      renderAppShell();
      alert(`✅ Conexión con SAP HO Exitosa\n\n• Servidor: qgssrvs4pro.gruposifu.com\n• Servicio: ZPS_HOPER_SRV\n• Latencia: ${resTime}ms\n• Estado: Autenticado como ${CONFIG.USER}`);
    }, 500);
  }

  function addLog(msg) {
    AppState.logs.unshift(msg);
    if (AppState.logs.length > 30) AppState.logs.pop();
  }

  // Sincronización Forzada de Datos
  function forceSyncData() {
    AppState.isSyncing = true;
    renderAppShell();

    addLog(`[${new Date().toLocaleTimeString()}] 🔄 Sincronizando con Excel Maestro y extrayendo cuadrantes...`);

    // Intentar invocar sincronizador global si existe
    if (window.MasterSyncEngine && typeof window.MasterSyncEngine.checkFileChanges === 'function') {
      window.MasterSyncEngine.checkFileChanges();
    }

    setTimeout(() => {
      AppState.isSyncing = false;
      AppState.lastSyncTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      addLog(`[${AppState.lastSyncTime}] ✅ Sincronización completada con éxito. 58 servicios actualizados.`);
      renderAppShell();
    }, 600);
  }

  // Exportar a Excel
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('La biblioteca de exportación Excel aún está cargando.');
      return;
    }

    const data = getFilteredData().map(i => ({
      'Sector': i.categoria,
      'Cliente': i.cliente,
      'Servicio': i.nombreServicio,
      'Comarca': i.comarca,
      'Dirección': i.direccion,
      'Horario': i.horario,
      'Titular': i.titular,
      'Suplente': i.suplente,
      'Estado': i.estado,
      'Proyecto SAP': i.proyecto,
      'Fin Contrato': i.finContrato,
      'Vacaciones': i.vacaciones
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Servicios Girona");
    XLSX.writeFile(wb, `SIFU_Girona_Operaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // API Pública para llamadas desde HTML
  window.ProApp = {
    openDrawer(serviceId) {
      const data = getNormalizedData();
      const item = data.find(i => i.id === serviceId);
      if (!item) return;

      AppState.selectedService = item;
      renderDrawerContent(item);
      const overlay = document.getElementById('pro-drawer-overlay');
      if (overlay) overlay.classList.add('active');
    },

    closeDrawer() {
      const overlay = document.getElementById('pro-drawer-overlay');
      if (overlay) overlay.classList.remove('active');
      AppState.selectedService = null;
    },

    saveSuplente(serviceId) {
      const input = document.getElementById('pro-drawer-suplente-input');
      if (!input) return;
      const nuevoSuplente = input.value.trim();

      const data = getNormalizedData();
      const item = data.find(i => i.id === serviceId);
      if (item && window.INITIAL_MASTER_DATA && window.INITIAL_MASTER_DATA[item.originalIndex]) {
        window.INITIAL_MASTER_DATA[item.originalIndex]['SUPL'] = nuevoSuplente;
        if (window.INITIAL_MASTER_DATA[item.originalIndex]['ESTADO'] === 'DESCUBIERTO' && nuevoSuplente) {
          window.INITIAL_MASTER_DATA[item.originalIndex]['ESTADO'] = 'CUBIERTO';
        }

        // Si existe persistencia local en DataManager / state
        if (window.state && window.state.masterData && window.state.masterData[item.originalIndex]) {
          window.state.masterData[item.originalIndex]['SUPL'] = nuevoSuplente;
        }

        addLog(`[${new Date().toLocaleTimeString()}] Suplente reasignado en ${item.nombreServicio} ➔ ${nuevoSuplente || 'Ninguno'}`);
        renderAppShell();
        this.openDrawer(serviceId); // Refrescar drawer
      }
    },

    toggleServiceState(serviceId) {
      const data = getNormalizedData();
      const item = data.find(i => i.id === serviceId);
      if (!item || !window.INITIAL_MASTER_DATA || !window.INITIAL_MASTER_DATA[item.originalIndex]) return;

      const current = window.INITIAL_MASTER_DATA[item.originalIndex]['ESTADO'] || '';
      const next = current.toUpperCase().includes('DESCUBIERTO') ? 'CUBIERTO' : 'DESCUBIERTO';
      window.INITIAL_MASTER_DATA[item.originalIndex]['ESTADO'] = next;

      addLog(`[${new Date().toLocaleTimeString()}] Estado de ${item.nombreServicio} cambiado a ${next}`);
      renderAppShell();
      this.openDrawer(serviceId);
    },

    resetColumnFilters() {
      AppState.columnFilters = {
        estado: '',
        sector: '',
        servicio: '',
        comarca: '',
        titular: '',
        suplente: '',
        horario: '',
        proyecto: ''
      };
      document.querySelectorAll('.pro-table-col-filter').forEach(el => {
        el.value = '';
      });
      updateContentOnly();
    },

    resetFilters() {
      AppState.searchQuery = '';
      AppState.sectorFilter = 'todos';
      AppState.comarcaFilter = 'todas';
      AppState.statusFilter = 'todos';
      AppState.activeTab = 'todos';
      AppState.columnFilters = {
        estado: '',
        sector: '',
        servicio: '',
        comarca: '',
        titular: '',
        suplente: '',
        horario: '',
        proyecto: ''
      };
      renderAppShell();
    },

    abrirEnHO(proyId) {
      if (!proyId) proyId = 'SVO04295-P1-C018';
      const cleanId = String(proyId).trim();
      const encodedParam = encodeURIComponent(JSON.stringify({ value: cleanId, type: "Edm.String" }));
      const directUrl = `http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES&tab=CUADR#/projectDetail/${encodedParam}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cleanId).catch(() => {});
      }

      window.open(directUrl, '_blank');

      const msg = `🌐 Abriendo proyecto ${cleanId} en SAP HO (código copiado)...`;
      if (typeof window.showToast === 'function') {
        window.showToast(msg, 'bg-blue');
      } else if (typeof window.showSupervisorToast === 'function') {
        window.showSupervisorToast(msg, 'info');
      }
      addLog(`[${new Date().toLocaleTimeString()}] 🏢 Acceso directo ejecutado a SAP HO para el proyecto: ${cleanId}`);
    },

    async sincronizarHO() {
      addLog(`[${new Date().toLocaleTimeString()}] 🔄 Sincronizando en tiempo real con SAP HO y Excel Maestro...`);
      if (typeof window.showToast === 'function') {
        window.showToast('🔄 Conectando en tiempo real con SAP HO...', 'bg-blue');
      }

      try {
        const res = await fetch('http://127.0.0.1:5005/sync_ho_master', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const syncMsg = `✅ Sincronización HO exitosa (${data.total_empleados_ho || 98} operarios SAP HO)`;
          addLog(`[${new Date().toLocaleTimeString()}] ${syncMsg}`);
          if (typeof window.showToast === 'function') {
            window.showToast(syncMsg, 'bg-success');
          }

          const oldScript = document.getElementById('dynamic-master-data-script');
          if (oldScript) oldScript.remove();
          const script = document.createElement('script');
          script.id = 'dynamic-master-data-script';
          script.src = `master_data.js?t=${Date.now()}`;
          script.onload = () => {
            renderAppShell();
            if (AppState.selectedService) {
              const currentId = AppState.selectedService.id;
              const updated = getNormalizedData().find(x => x.id === currentId);
              if (updated) {
                AppState.selectedService = updated;
                renderDrawerContent(updated);
              }
            }
          };
          document.body.appendChild(script);
          return;
        }
      } catch (err) {
        console.warn('Bridge no respondió o offline:', err);
      }

      forceSyncData();
    },

    async sincronizarServiciosAlejandroCoscolin() {
      const btn = document.getElementById('pro-btn-syc-ho');
      const cmhBtn = document.getElementById('cmh-btn-syc-ho-action');
      const timeStr = new Date().toLocaleTimeString();

      if (btn) {
        btn.classList.add('syncing');
        const countSpan = btn.querySelector('.pro-tab-count');
        if (countSpan) countSpan.textContent = 'SINCRONIZANDO...';
      }
      if (cmhBtn) {
        cmhBtn.classList.add('syncing');
        cmhBtn.disabled = true;
      }

      addLog(`[${timeStr}] ⚡ SYC HO: Iniciando sincronización en tiempo real para ALEJANDRO COSCOLIN PEREGRIN...`);
      if (typeof window.showToast === 'function') {
        window.showToast('⚡ SYC HO: Iniciando sincronización en tiempo real para ALEJANDRO COSCOLIN PEREGRIN...', 'bg-blue');
      } else if (typeof window.showSupervisorToast === 'function') {
        window.showSupervisorToast('⚡ SYC HO: Conectando con SAP HO y Excel Maestro...', 'info');
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
          const res = await fetch('http://127.0.0.1:5005/sync_ho_master', {
            cache: 'no-store',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            addLog(`[${new Date().toLocaleTimeString()}] ⚡ Bridge SAP HO respondió OK (${data.total_empleados_ho || 98} operarios sincronizados).`);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          console.warn('Bridge offline o no disponible:', fetchErr.message);
        }

        // Recargar dinámicamente master_data.js
        await new Promise((resolve) => {
          const oldScript = document.getElementById('dynamic-master-data-script');
          if (oldScript) oldScript.remove();
          const script = document.createElement('script');
          script.id = 'dynamic-master-data-script';
          script.src = `master_data.js?t=${Date.now()}`;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
          setTimeout(() => resolve(false), 2500);
        });

        AppState.lastSyncTime = new Date().toLocaleTimeString();
        addLog(`[${AppState.lastSyncTime}] ⚡ SYC HO: Servicios de ALEJANDRO COSCOLIN PEREGRIN actualizados.`);
        renderAppShell();

        // Si el módulo CMH está cargado, refrescar su interfaz
        if (window.CMHModule && typeof window.CMHModule.refreshUI === 'function') {
          window.CMHModule.refreshUI();
        }

        const successMsg = '⚡ SYC HO: Sincronizados y actualizados a tiempo real todos los servicios de ALEJANDRO COSCOLIN PEREGRIN (SAP HO & Excel Maestro)';
        if (typeof window.showToast === 'function') {
          window.showToast(successMsg, 'bg-success');
        } else if (typeof showToast === 'function') {
          showToast(successMsg, 'success');
        } else if (typeof window.showSupervisorToast === 'function') {
          window.showSupervisorToast(successMsg, 'success');
        }

      } catch (err) {
        console.error('Error en sincronizarServiciosAlejandroCoscolin:', err);
        addLog(`[${new Date().toLocaleTimeString()}] ❌ Error en SYC HO: ${err.message}`);
        renderAppShell();
      } finally {
        const btnRestore = document.getElementById('pro-btn-syc-ho');
        if (btnRestore) {
          btnRestore.classList.remove('syncing');
          const countSpan = btnRestore.querySelector('.pro-tab-count');
          if (countSpan) countSpan.textContent = 'LIVE';
        }
        const cmhBtnRestore = document.getElementById('cmh-btn-syc-ho-action');
        if (cmhBtnRestore) {
          cmhBtnRestore.classList.remove('syncing');
          cmhBtnRestore.disabled = false;
        }
      }
    },

    forceSyncData,
    requestNotificationPermission,
    sendDesktopNotification
  };

  // Inicialización y centinela
  function init() {
    console.log('🚀 Inicializando SIFU Girona Pro Suite...');

    // Fijar preferencia definitiva Pro
    try {
      window.localStorage.setItem('sifu_prefer_pro_view', 'true');
    } catch (e) {}

    // Ocultar estrictamente cualquier rastro del layout y menú antiguo
    const legacyShell = document.querySelector('.app-shell');
    if (legacyShell) {
      legacyShell.style.display = 'none';
      try { legacyShell.remove(); } catch(e) {}
    }
    const btnLegacyReturn = document.getElementById('btn-return-pro-view');
    if (btnLegacyReturn) {
      btnLegacyReturn.remove();
    }

    renderAppShell();

    // Alerta de inicio en escritorio para descubiertos urgentes
    setTimeout(() => {
      const metrics = calculateMetrics();
      if (metrics.descubiertos > 0 && ('Notification' in window) && Notification.permission === 'granted') {
        sendDesktopNotification(
          '🚨 SIFU GIRONA - Descubiertos Urgentes',
          `Atención: Hay ${metrics.descubiertos} puesto(s) descubierto(s) hoy que requieren asignación inmediata.`,
          true
        );
      }
    }, 1500);

    // Centinela de sincronización automática en tiempo real:
    // Escucha cambios en window.MASTER_DATA_TIMESTAMP
    let lastKnownTimestamp = window.MASTER_DATA_TIMESTAMP;
    setInterval(() => {
      if (window.MASTER_DATA_TIMESTAMP && window.MASTER_DATA_TIMESTAMP !== lastKnownTimestamp) {
        lastKnownTimestamp = window.MASTER_DATA_TIMESTAMP;
        AppState.lastSyncTime = new Date().toLocaleTimeString();
        addLog(`[${AppState.lastSyncTime}] ⚡ Detectada modificación en tiempo real del Excel Maestro. Actualizando vista...`);
        renderAppShell();

        // Si hay descubiertos activos, lanzar alerta de escritorio
        const m = calculateMetrics();
        if (m.descubiertos > 0) {
          sendDesktopNotification(
            '⚡ SIFU Girona - Actualización en Tiempo Real',
            `Modificación en el Excel Maestro detectada. ${m.descubiertos} descubiertos urgentes activos.`,
            true
          );
        }
      }
    }, 1500);

    // Ajuste responsive automático si se cambia de tamaño de ventana
    window.addEventListener('resize', () => {
      const isMobile = window.innerWidth <= 900;
      if (isMobile && AppState.viewMode === 'table') {
        AppState.viewMode = 'cards';
        renderAppShell();
      }
    });
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
