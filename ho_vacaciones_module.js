/**
 * ============================================================================
 * SIFU BARCELONA — SECCIÓN 2.4: VACACIONES TRABAJADORES (EXPLORADOR WINDOWS SAP HO)
 * Información 100% en Tiempo Real de SAP S/4HANA HO (ZPS_HOPER_SRV)
 * Trabajadores asignados a: ALEJANDRO COSCOLIN PEREGRIN (IdResponsable 00062620 / 46468278)
 * ============================================================================
 */

(function () {
  'use strict';

  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MESES_LARGOS = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // 9 Gestores Oficiales de Barcelona (División 0801) en SAP HO
  const GESTORES_BCN_VAC = [
    { id: 'todos', sapId: '', doc: '', nombre: '🏢 Toda Barcelona (Consolidado 9 Gestores)', nombre_corto: 'Toda Barcelona' },
    { id: '00066957', sapId: '00066957', doc: '52404278', nombre: 'Sonia Cañete Cárdenas Peral (52404278)', nombre_corto: 'Sonia Cañete' },
    { id: '00063967', sapId: '00063967', doc: '21773898', nombre: 'Adrià Serrano Viu (21773898)', nombre_corto: 'Adrià Serrano' },
    { id: '00001370', sapId: '00001370', doc: '34754177', nombre: 'Julio Ortiz Sánchez (34754177)', nombre_corto: 'Julio Ortiz' },
    { id: '00015251', sapId: '00015251', doc: '47906036', nombre: 'Albert Sánchez Padrosa (47906036)', nombre_corto: 'Albert Sánchez' },
    { id: '00060598', sapId: '00060598', doc: '47817940', nombre: 'Jordi Giménez Ferrer (47817940)', nombre_corto: 'Jordi Giménez' },
    { id: '00065945', sapId: '00065945', doc: '03856780', nombre: 'Liana Garayshina (03856780)', nombre_corto: 'Liana Garayshina' },
    { id: '00027631', sapId: '00027631', doc: '47782275', nombre: 'Alba Valverde Cerezo (47782275)', nombre_corto: 'Alba Valverde' },
    { id: '00010085', sapId: '00010085', doc: '33915443', nombre: 'José García Quesada (33915443)', nombre_corto: 'José García' },
    { id: '00062620', sapId: '00062620', doc: '46468278', nombre: 'Alejandro Coscolin Peregrín (46468278 - BCN Indra)', nombre_corto: 'Alejandro Coscolin' }
  ];

  // Estado interactivo del Explorador de Windows 2.4
  const ExplorerState = {
    gestorFilter: 'todos',          // 'todos' | ID de gestor oficial de Barcelona (0801)
    currentFolder: 'all',          // 'all' | 'pendientes' | 'sin_imputar' | 'parciales' | 'completadas' | 'con_fechas' | 'en_curso_hoy' | 'futuras' | 'anio_anterior' | 'sociedad_s172' | 'sociedad_s171' | 'apoyos_externos' | 'mes_1'..'mes_12' | 'proy_...'
    bajaFilter: 'sin_baja',        // 'sin_baja' (Operativos planificables) | 'con_baja' (En Baja IT activa) | 'todos' (Con y Sin Baja)
    openedWorkerId: null,          // Si está dentro de la carpeta de un trabajador concreto
    openedPeriodId: null,          // Si está dentro de una subcarpeta de periodo (P01, P02...) del trabajador
    selectedWorkerId: null,        // Trabajador seleccionado en la lista para el panel derecho (Vista Previa)
    expandedRows: {},              // Filas desplegadas in-situ en la Vista Detalles
    viewMode: 'details',           // 'details' | 'folders' | 'calendar'
    isMaximized: false,            // Modo ventana maximizada a pantalla completa (100vw x 100vh)
    showTreePane: true,            // Mostrar árbol izquierdo de carpetas
    showPreviewPane: false,        // Oculto por defecto para dar 100% de ancho a todas las columnas de la tabla
    includeExternalSupport: false, // Incluir los 2 apoyos de otros responsables en proyectos de Alejandro
    searchQuery: '',
    columnFilters: {
      nombre: '',
      baja_it: 'todos',
      id_empleado: '',
      proyecto: '',
      vac_totales: 'todos',
      vac_tomados: 'todos',
      vac_restantes: 'todos',
      fechas: ''
    },
    sortBy: 'vac_restantes',       // 'vac_restantes' | 'vac_tomados' | 'vac_totales' | 'nombre' | 'id_empleado' | 'fechas' | 'baja_it'
    sortDir: 'desc',
    isSyncing: false,
    syncingWorkerId: null,
    autoSyncEnabled: true,         // Sincronización automática en tiempo real con SAP HO (cada 60s y al volver de la ventana de HO)
    lastLiveSyncMs: 0,             // Timestamp de la última lectura en directo contra SAP S/4HANA
    recentChanges: [],             // Historial de cambios detectados en vivo (imputaciones, bajas, etc.)
    recentlyUpdatedWorkers: {},    // IDs de trabajadores recién modificados en SAP HO para resaltado visual
    lastSyncInfoMsg: '',           // Mensaje informativo de la última comprobación en vivo
    planModalWorkerId: null,       // ID del trabajador en proceso de concesión de vacaciones
    planModalData: {
      tipo: 'VC',                  // 'VC' (Anuales), 'VD' (Exceso cuadrante), 'VN' (Año anterior)
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-15',
      cobertura: 'sin_suplente',   // 'sin_suplente' (Auto-cobertura), 'suplente_retén', 'cierre_cliente', 'refuerzo'
      suplenteNombre: '',
      notas: ''
    },
    showCoverageAuditModal: false, // Modal de auditoría de cobertura por centros de limpieza
    coverageSearchQuery: '',       // Búsqueda en auditoría de cobertura
    history: [{ folder: 'all', bajaFilter: 'sin_baja', workerId: null, periodId: null }],
    historyIndex: 0
  };

  function getPayload() {
    return window.HO_VACACIONES_PAYLOAD || {
      status: 'ok',
      ho_connected: true,
      timestamp: new Date().toLocaleString('es-ES'),
      year: 2026,
      responsable: {
        nombre: 'ALEJANDRO COSCOLIN PEREGRIN',
        id_responsable_empleado: '00062620',
        id_responsable_proyecto: '46468278',
        usuario_sap: 'acoscolin',
        delegacion: '0801 - Barcelona'
      },
      kpis: {},
      trabajadores: []
    };
  }

  function getAllWorkersRaw() {
    // Excluir estrictamente a cualquier persona que haya causado baja en la empresa (no activo)
    let list = (getPayload().trabajadores || []).filter(w => w && w.es_activo !== false);
    if (ExplorerState.gestorFilter && ExplorerState.gestorFilter !== 'todos') {
      const gTarget = GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter);
      if (gTarget) {
        list = list.filter(w => {
          const respId = String(w.id_responsable || '').trim();
          const respNom = String(w.nom_responsable || '').toUpperCase();
          return respId === gTarget.id || respId === gTarget.doc || respId === gTarget.sapId ||
                 respNom.includes(gTarget.nombre_corto.toUpperCase());
        });
      }
    }
    return list;
  }

  function applyBajaFilter(workers, bajaFilterMode = ExplorerState.bajaFilter) {
    if (bajaFilterMode === 'sin_baja') {
      return workers.filter(w => w.es_activo && !w.en_baja_it_actual);
    }
    if (bajaFilterMode === 'con_baja') {
      return workers.filter(w => w.es_activo && !!w.en_baja_it_actual);
    }
    return workers;
  }

  function getBaseScopedWorkers(ignoreBajaFilter = false) {
    const all = getAllWorkersRaw();
    const base = all.filter(w => {
      if (!ExplorerState.includeExternalSupport && !w.es_asignado_directo) return false;
      if (!w.es_activo) return false;
      return true;
    });
    if (ignoreBajaFilter || ExplorerState.currentFolder === 'apoyos_externos') {
      return base;
    }
    return applyBajaFilter(base, ExplorerState.bajaFilter);
  }

  function filterWorkersByFolder(workers, folderKey) {
    return workers.filter(w => {
      if (folderKey === 'all') return true;
      if (folderKey === 'pendientes') return w.es_activo && w.vac_restantes > 0;
      if (folderKey === 'sin_imputar') return w.es_activo && w.vac_tomados === 0 && w.vac_restantes > 0 && (w.dias_vc_naturales_2026 || 0) === 0;
      if (folderKey === 'parciales') return w.es_activo && w.vac_restantes > 0 && (w.vac_tomados > 0 || (w.dias_vc_naturales_2026 || 0) > 0);
      if (folderKey === 'completadas') return w.es_activo && w.vac_restantes <= 0 && w.vac_totales > 0;
      if (folderKey === 'con_fechas') return (w.total_periodos || 0) > 0;
      if (folderKey === 'en_curso_hoy') {
        return (w.periodos_vacaciones || []).some(p => p.estado === 'EN_CURSO' || p.mes_num === 10 || p.mes_num === 11);
      }
      if (folderKey === 'futuras') {
        return (w.periodos_vacaciones || []).some(p => p.estado === 'PROGRAMADO' || p.estado === 'EN_CURSO');
      }
      if (folderKey === 'anio_anterior') {
        return (w.dias_vn_naturales_2026 || 0) > 0;
      }
      if (folderKey === 'sociedad_s172') return w.id_centro === 'S172';
      if (folderKey === 'sociedad_s171') return w.id_centro === 'S171';
      if (folderKey === 'apoyos_externos') return !w.es_asignado_directo;
      if (folderKey.startsWith('mes_')) {
        const mNum = parseInt(folderKey.replace('mes_', ''), 10);
        return (w.fechas_detalle || []).some(fd => fd.mes_num === mNum);
      }
      if (folderKey.startsWith('proy_')) {
        const pId = folderKey.replace('proy_', '');
        return (w.proyectos_asignados || []).some(p => p.id_proyecto === pId);
      }
      return true;
    });
  }

  function getFilteredAndSortedWorkers() {
    let list = getAllWorkersRaw();
    if (ExplorerState.currentFolder === 'apoyos_externos') {
      list = list.filter(w => !w.es_asignado_directo);
    } else {
      list = getBaseScopedWorkers(false);
      list = filterWorkersByFolder(list, ExplorerState.currentFolder);
    }

    const q = (ExplorerState.searchQuery || '').toLowerCase().trim();
    if (q) {
      list = list.filter(w => {
        const proysTxt = (w.proyectos_asignados || []).map(p => `${p.id_proyecto} ${p.denominacion}`).join(' ');
        const fechasTxt = w.resumen_fechas || '';
        const bajaTxt = w.en_baja_it_actual ? 'baja it incapacidad temporal no planificable' : 'operativo activo sin baja planificable';
        const full = `${w.id_empleado} ${w.nombre_completo} ${w.dni} ${w.telefono} ${w.id_centro} ${w.nom_sociedad} ${w.tipo_contrato} ${w.fin_contrato} ${proysTxt} ${fechasTxt} ${bajaTxt}`.toLowerCase();
        return full.includes(q);
      });
    }

    // --- FILTROS POR CADA COLUMNA INDIVIDUAL DE LA TABLA ---
    const cf = ExplorerState.columnFilters || {};
    if (cf.nombre && cf.nombre.trim()) {
      const qN = cf.nombre.toLowerCase().trim();
      list = list.filter(w => (w.nombre_completo || '').toLowerCase().includes(qN));
    }
    if (cf.baja_it && cf.baja_it !== 'todos') {
      if (cf.baja_it === 'sin_baja') {
        list = list.filter(w => !w.en_baja_it_actual);
      } else if (cf.baja_it === 'con_baja') {
        list = list.filter(w => !!w.en_baja_it_actual);
      }
    }
    if (cf.id_empleado && cf.id_empleado.trim()) {
      const qId = cf.id_empleado.toLowerCase().trim();
      list = list.filter(w => (w.id_empleado || '').toLowerCase().includes(qId));
    }
    if (cf.proyecto && cf.proyecto.trim()) {
      const qP = cf.proyecto.toLowerCase().trim();
      list = list.filter(w => {
        const proys = (w.proyectos_asignados || []).map(p => `${p.id_proyecto} ${p.denominacion} ${p.cliente || ''}`).join(' ').toLowerCase();
        return proys.includes(qP) || (w.nom_centro || '').toLowerCase().includes(qP) || (w.id_centro || '').toLowerCase().includes(qP);
      });
    }
    if (cf.vac_totales && cf.vac_totales !== 'todos') {
      const val = parseInt(cf.vac_totales, 10);
      if (!isNaN(val)) {
        list = list.filter(w => (w.vac_totales || w.vacTotales || 25) === val);
      }
    }
    if (cf.vac_tomados && cf.vac_tomados !== 'todos') {
      if (cf.vac_tomados === '0') {
        list = list.filter(w => (w.vac_tomados || 0) === 0);
      } else if (cf.vac_tomados === '>0') {
        list = list.filter(w => (w.vac_tomados || 0) > 0);
      } else {
        const val = parseInt(cf.vac_tomados, 10);
        if (!isNaN(val)) list = list.filter(w => (w.vac_tomados || 0) === val);
      }
    }
    if (cf.vac_restantes && cf.vac_restantes !== 'todos') {
      if (cf.vac_restantes === '0') {
        list = list.filter(w => (w.vac_restantes || 0) === 0);
      } else if (cf.vac_restantes === '>0') {
        list = list.filter(w => (w.vac_restantes || 0) > 0);
      } else {
        const val = parseInt(cf.vac_restantes, 10);
        if (!isNaN(val)) list = list.filter(w => (w.vac_restantes || 0) === val);
      }
    }
    if (cf.fechas && cf.fechas.trim()) {
      const qF = cf.fechas.toLowerCase().trim();
      list = list.filter(w => {
        const periodos = w.periodos_vacaciones || [];
        const perTxt = periodos.map(p => `${p.rango_texto || ''} ${p.fecha_inicio || ''} ${p.fecha_fin || ''} ${p.mes_inicio || ''} ${p.concepto || ''} ${p.codigo_tipo || ''}`).join(' ').toLowerCase();
        return perTxt.includes(qF);
      });
    }

    const dir = ExplorerState.sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (ExplorerState.sortBy === 'baja_it') {
        const bA = a.en_baja_it_actual ? 1 : 0;
        const bB = b.en_baja_it_actual ? 1 : 0;
        if (bA !== bB) return (bA - bB) * dir;
        return (b.vac_restantes - a.vac_restantes);
      }
      // Si se ven TODOS juntos y se ordena por vacaciones pendientes, priorizar primero a los Operativos SIN Baja IT
      if (ExplorerState.bajaFilter === 'todos' && ExplorerState.sortBy === 'vac_restantes') {
        const bA = a.en_baja_it_actual ? 1 : 0;
        const bB = b.en_baja_it_actual ? 1 : 0;
        if (bA !== bB) return bA - bB; // Primero Sin Baja IT (0), luego Con Baja IT (1)
      }
      if (ExplorerState.sortBy === 'vac_restantes') {
        if (a.vac_restantes !== b.vac_restantes) return (a.vac_restantes - b.vac_restantes) * dir;
        return a.nombre_completo.localeCompare(b.nombre_completo);
      }
      if (ExplorerState.sortBy === 'vac_tomados') {
        if (a.vac_tomados !== b.vac_tomados) return (a.vac_tomados - b.vac_tomados) * dir;
        return a.nombre_completo.localeCompare(b.nombre_completo);
      }
      if (ExplorerState.sortBy === 'vac_totales') {
        if (a.vac_totales !== b.vac_totales) return (a.vac_totales - b.vac_totales) * dir;
        return a.nombre_completo.localeCompare(b.nombre_completo);
      }
      if (ExplorerState.sortBy === 'id_empleado') {
        return a.id_empleado.localeCompare(b.id_empleado) * dir;
      }
      if (ExplorerState.sortBy === 'fechas') {
        return ((a.total_dias_calendario_imputados || 0) - (b.total_dias_calendario_imputados || 0)) * dir;
      }
      return a.nombre_completo.localeCompare(b.nombre_completo) * dir;
    });

    return list;
  }

  function getBajaFilterLabel(mode = ExplorerState.bajaFilter) {
    if (mode === 'sin_baja') return '🟢 Solo Operativos SIN Baja IT (Planificables)';
    if (mode === 'con_baja') return '🩺 Solo Trabajadores EN Baja IT (No Planificables)';
    return '👥 Todos (Con y Sin Baja IT)';
  }

  function getFolderTitle(folderKey) {
    const map = {
      'all': '📁 Todos mis trabajadores en SAP HO',
      'pendientes': '🔴 Faltan Vacaciones por Disfrutar (Saldo > 0 días)',
      'sin_imputar': '🔥 Sin Ningún Día Imputado (100% Pendiente en HO)',
      'parciales': '⏳ Parcialmente Disfrutadas (Faltan días por disfrutar)',
      'completadas': '🟢 Vacaciones Completadas (0 días pendientes)',
      'con_fechas': '📅 Con Fechas Imputadas en Cuadrante HO 2026',
      'en_curso_hoy': '🏖️ Vacaciones en Octubre / Noviembre 2026',
      'futuras': '📆 Vacaciones en Curso o Programadas',
      'anio_anterior': '⏪ Vacaciones Año Anterior (VN en 2026)',
      'sociedad_s172': '🏢 S172 · SIFU, S.L. Barcelona',
      'sociedad_s171': '🏢 S171 · Integración Laboral Barcelona',
      'apoyos_externos': '🤝 Apoyos de Otros Responsables en Mis Proyectos'
    };
    if (map[folderKey]) return map[folderKey];
    if (folderKey.startsWith('mes_')) {
      const m = parseInt(folderKey.replace('mes_', ''), 10);
      return `📅 Mes ${String(m).padStart(2, '0')} · ${MESES_LARGOS[m]} 2026`;
    }
    if (folderKey.startsWith('proy_')) {
      const pid = folderKey.replace('proy_', '');
      return `🏢 Proyecto SAP ${pid}`;
    }
    return '📁 Explorador SAP HO';
  }

  function pushHistory(folder, workerId = null, periodId = null) {
    const curr = ExplorerState.history[ExplorerState.historyIndex];
    if (curr && curr.folder === folder && curr.bajaFilter === ExplorerState.bajaFilter && curr.workerId === workerId && curr.periodId === periodId) {
      return;
    }
    ExplorerState.history = ExplorerState.history.slice(0, ExplorerState.historyIndex + 1);
    ExplorerState.history.push({ folder, bajaFilter: ExplorerState.bajaFilter, workerId, periodId });
    ExplorerState.historyIndex = ExplorerState.history.length - 1;
  }

  function refreshUI() {
    if (window.renderAppShell && window.AppState && window.AppState.activeTab === 'ho_vacaciones') {
      window.renderAppShell();
    }
  }

  // Compara la fotografía anterior con la nueva lectura en directo de SAP HO y registra qué trabajadores han cambiado
  function detectAndRecordChanges(oldWorkers, newWorkers) {
    if (!Array.isArray(oldWorkers) || oldWorkers.length === 0 || !Array.isArray(newWorkers)) {
      return [];
    }
    const oldMap = {};
    oldWorkers.forEach(w => {
      if (w && w.id_empleado) oldMap[w.id_empleado] = w;
    });

    const detected = [];
    const nowTime = new Date().toLocaleTimeString('es-ES');

    newWorkers.forEach(nw => {
      if (!nw || !nw.id_empleado) return;
      const ow = oldMap[nw.id_empleado];
      if (!ow) return;

      const changedTomados = (ow.vac_tomados || 0) !== (nw.vac_tomados || 0);
      const changedRestantes = (ow.vac_restantes || 0) !== (nw.vac_restantes || 0);
      const changedFechas = (ow.resumen_fechas || '') !== (nw.resumen_fechas || '');
      const changedBaja = Boolean(ow.en_baja_it_actual) !== Boolean(nw.en_baja_it_actual);

      if (changedTomados || changedRestantes || changedFechas || changedBaja) {
        ExplorerState.recentlyUpdatedWorkers[nw.id_empleado] = Date.now();

        let transicionCarpeta = '';
        if ((ow.vac_restantes || 0) > 0 && (nw.vac_restantes || 0) <= 0) {
          transicionCarpeta = '✅ ¡100% COMPLETADAS! Deja de salir en Pendientes y pasa a Vacaciones Completadas';
        } else if ((ow.vac_tomados || 0) === 0 && (nw.vac_tomados || 0) > 0 && (nw.vac_restantes || 0) > 0) {
          transicionCarpeta = '⏳ Deja de salir en "0 Días Imputados" y pasa a "Parcialmente Disfrutadas"';
        } else if (changedBaja) {
          transicionCarpeta = nw.en_baja_it_actual
            ? '🩺 Pasa a filtro "En Baja IT (No planificable)"'
            : '🟢 Alta médica: pasa a "Operativos Sin Baja (Planificables)"';
        }

        detected.push({
          hora: nowTime,
          id_empleado: nw.id_empleado,
          nombre: nw.nombre_completo,
          prev_tomados: ow.vac_tomados || 0,
          new_tomados: nw.vac_tomados || 0,
          prev_restantes: ow.vac_restantes || 0,
          new_restantes: nw.vac_restantes || 0,
          fechas: nw.resumen_fechas || 'Sin fechas en cuadrante',
          transicion: transicionCarpeta
        });
      }
    });

    if (detected.length > 0) {
      ExplorerState.recentChanges = [...detected, ...ExplorerState.recentChanges].slice(0, 8);
    }
    return detected;
  }

  // Cargar datos iniciales desde el Bridge solo si no están ya cargados en memoria
  function initFromBridge() {
    if (window.HO_VACACIONES_PAYLOAD && Array.isArray(window.HO_VACACIONES_PAYLOAD.trabajadores) && window.HO_VACACIONES_PAYLOAD.trabajadores.length > 0) {
      if (!ExplorerState.selectedWorkerId && window.HO_VACACIONES_PAYLOAD.trabajadores[0]) {
        ExplorerState.selectedWorkerId = window.HO_VACACIONES_PAYLOAD.trabajadores[0].id_empleado;
      }
      return;
    }
    fetch('http://127.0.0.1:5005/ho_vacaciones_data')
      .then(r => r.json())
      .then(data => {
        if (data && data.trabajadores && data.trabajadores.length > 0) {
          window.HO_VACACIONES_PAYLOAD = data;
          if (!ExplorerState.selectedWorkerId && data.trabajadores[0]) {
            ExplorerState.selectedWorkerId = data.trabajadores[0].id_empleado;
          }
          refreshUI();
        }
      })
      .catch(() => {});
  }

  // Render de los chips de periodos de fechas imputadas de un trabajador
  function renderWorkerDateChips(w, compact = false) {
    const periodos = w.periodos_vacaciones || [];
    if (periodos.length === 0) {
      if (w.vac_tomados > 0) {
        return `
          <span class="hovac-date-chip vn" title="Registrados ${w.vac_tomados} días en contador SAP HR/HO (Infotipo 2006/2001)">
            <span>📌</span>
            <span>${w.vac_tomados} días computados en ficha SAP HR/HO</span>
          </span>
        `;
      }
      if (w.en_baja_it_actual) {
        return `<span style="color:#b91c1c; font-size:11px; font-weight:700;">🩺 En Baja IT (${w.otras_ausencias_2026 && w.otras_ausencias_2026.Baja ? w.otras_ausencias_2026.Baja + 'd en 2026 · ' : ''}No se pueden planificar vacaciones hasta el alta)</span>`;
      }
      return `<span style="color:#94a3b8; font-size:11px; font-style:italic;">Sin fechas imputadas en cuadrante 2026</span>`;
    }

    const shown = compact ? periodos.slice(0, 3) : periodos;
    let html = shown.map(p => {
      const codTipo = p.codigo_tipo || p.tipo || 'VC';
      const estado = p.estado || 'DISFRUTADO';
      let cls = 'disfrutado';
      let icon = '✅';
      if (codTipo === 'VN') {
        cls = 'vn';
        icon = '⏪';
      } else if (estado === 'EN_CURSO') {
        cls = 'en-curso';
        icon = '🏖️';
      } else if (estado === 'PROGRAMADO') {
        cls = 'programado';
        icon = '📅';
      }
      const rango = p.rango_texto || (p.fecha_inicio && p.fecha_fin ? `${p.fecha_inicio} - ${p.fecha_fin}` : `${p.dias_naturales || p.dias_habiles || w.vac_tomados || 0} días`);
      const dNat = p.dias_naturales !== undefined ? p.dias_naturales : (p.dias_habiles !== undefined ? p.dias_habiles : (w.vac_tomados || 0));
      const dLab = p.dias_laborables_cuadrante !== undefined ? p.dias_laborables_cuadrante : (p.dias_habiles !== undefined ? p.dias_habiles : (w.vac_tomados || 0));
      const proyTag = p.proyectos && p.proyectos.length > 0 ? ` · ${p.proyectos[0]}` : '';
      const etiqueta = p.etiqueta_tipo || p.concepto || 'Vacaciones Anuales';
      const pid = p.id_periodo || p.id || 'PER-1';

      return `
        <span class="hovac-date-chip ${cls}" onclick="event.stopPropagation(); window.HOVacacionesExplorer.openWorkerPeriod('${w.id_empleado}', '${pid}')" title="Clic para abrir el detalle día a día de este periodo (${etiqueta}${proyTag})" style="cursor:pointer;">
          <span>${icon}</span>
          <span><b>${rango}</b> <small>(${dNat}d nat · ${dLab}d lab${codTipo !== 'VC' ? ' · ' + codTipo : ''})</small></span>
        </span>
      `;
    }).join('');

    if (compact && periodos.length > 3) {
      html += `<span class="hovac-date-chip disfrutado" onclick="event.stopPropagation(); window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')" style="cursor:pointer;">+${periodos.length - 3} periodos más...</span>`;
    }
    return html;
  }

  // Render del Panel Izquierdo (Árbol de Carpetas de Windows Explorer)
  function renderLeftFolderTree() {
    const allRaw = getAllWorkersRaw();
    const directAllActivos = allRaw.filter(w => w.es_asignado_directo && w.es_activo);
    const directSinBaja = directAllActivos.filter(w => !w.en_baja_it_actual);
    const directConBaja = directAllActivos.filter(w => !!w.en_baja_it_actual);
    const apoyosList = allRaw.filter(w => !w.es_asignado_directo);

    // Base activa según el filtro de Baja IT seleccionado para que los contadores de carpetas cuadren al 100%
    const scopedActivos = applyBajaFilter(directAllActivos, ExplorerState.bajaFilter);

    const countPendientes = scopedActivos.filter(w => w.vac_restantes > 0).length;
    const countSinImputar = scopedActivos.filter(w => w.vac_tomados === 0 && w.vac_restantes > 0 && (w.dias_vc_naturales_2026 || 0) === 0).length;
    const countParciales = scopedActivos.filter(w => w.vac_restantes > 0 && (w.vac_tomados > 0 || (w.dias_vc_naturales_2026 || 0) > 0)).length;
    const countCompletadas = scopedActivos.filter(w => w.vac_restantes <= 0 && w.vac_totales > 0).length;
    const countConFechas = scopedActivos.filter(w => (w.total_periodos || 0) > 0).length;
    const countOctNov = scopedActivos.filter(w => (w.periodos_vacaciones || []).some(p => p.estado === 'EN_CURSO' || p.mes_num === 10 || p.mes_num === 11)).length;
    const countVN = scopedActivos.filter(w => (w.dias_vn_naturales_2026 || 0) > 0).length;
    const countS172 = scopedActivos.filter(w => w.id_centro === 'S172').length;
    const countS171 = scopedActivos.filter(w => w.id_centro === 'S171').length;

    // Conteo por mes
    const monthCounts = {};
    for (let m = 1; m <= 12; m++) {
      monthCounts[m] = scopedActivos.filter(w => (w.fechas_detalle || []).some(fd => fd.mes_num === m)).length;
    }

    // Proyectos con trabajadores asignados
    const proyMap = {};
    scopedActivos.forEach(w => {
      (w.proyectos_asignados || []).forEach(p => {
        if (!proyMap[p.id_proyecto]) {
          proyMap[p.id_proyecto] = { id: p.id_proyecto, denom: p.denominacion, count: 0 };
        }
        proyMap[p.id_proyecto].count++;
      });
    });
    const proyList = Object.values(proyMap).sort((a, b) => b.count - a.count);

    const cf = ExplorerState.currentFolder;
    const bf = ExplorerState.bajaFilter;

    return `
      <aside class="hovac-tree-pane">
        <div class="hovac-tree-section-title" style="color:#0f172a; background:#e2e8f0; border-radius:5px; padding:5px 8px; margin-bottom:4px;">
          <span>🩺 FILTRO DISPONIBILIDAD / BAJA IT</span>
        </div>
        <button class="hovac-tree-item ${bf === 'sin_baja' ? 'active' : ''}"
                onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja')"
                style="${bf === 'sin_baja' ? 'background:#dcfce7; color:#166534; border:1px solid #86efac;' : ''}"
                title="Mostrar solo trabajadores que NO están de baja IT y a los que SÍ puedes planificar vacaciones">
          <span class="hovac-tree-item-left"><span>🟢</span> <span>Sin Baja IT (Planificables)</span></span>
          <span class="hovac-tree-badge ok">${directSinBaja.length}</span>
        </button>
        <button class="hovac-tree-item ${bf === 'con_baja' ? 'active' : ''}"
                onclick="window.HOVacacionesExplorer.setBajaFilter('con_baja')"
                style="${bf === 'con_baja' ? 'background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;' : ''}"
                title="Mostrar solo trabajadores que están actualmente de Baja IT en SAP HO (no se pueden planificar hasta el alta)">
          <span class="hovac-tree-item-left"><span>🩺</span> <span>En Baja IT (No planific.)</span></span>
          <span class="hovac-tree-badge danger">${directConBaja.length}</span>
        </button>
        <button class="hovac-tree-item ${bf === 'todos' ? 'active' : ''}"
                onclick="window.HOVacacionesExplorer.setBajaFilter('todos')"
                title="Mostrar toda la plantilla junta (tanto los que están trabajando como los que están de Baja IT)">
          <span class="hovac-tree-item-left"><span>👥</span> <span>Todos (Con y Sin Baja)</span></span>
          <span class="hovac-tree-badge">${directAllActivos.length}</span>
        </button>

        <div class="hovac-tree-section-title" style="margin-top:10px;">
          <span>📂 ESTADO DE VACACIONES (${bf === 'sin_baja' ? 'SIN BAJA' : bf === 'con_baja' ? 'BAJA IT' : 'TODOS'})</span>
        </div>
        <button class="hovac-tree-item ${cf === 'all' && !ExplorerState.openedWorkerId ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('all')">
          <span class="hovac-tree-item-left"><span>💻</span> <span>Todos en este filtro</span></span>
          <span class="hovac-tree-badge">${scopedActivos.length}</span>
        </button>
        <button class="hovac-tree-item ${cf === 'pendientes' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('pendientes')">
          <span class="hovac-tree-item-left"><span>🔴</span> <span>Faltan por Disfrutar</span></span>
          <span class="hovac-tree-badge danger">${countPendientes}</span>
        </button>
        <button class="hovac-tree-item sub ${cf === 'sin_imputar' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('sin_imputar')">
          <span class="hovac-tree-item-left"><span>🔥</span> <span>Sin imputar (100% pend.)</span></span>
          <span class="hovac-tree-badge danger">${countSinImputar}</span>
        </button>
        <button class="hovac-tree-item sub ${cf === 'parciales' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('parciales')">
          <span class="hovac-tree-item-left"><span>⏳</span> <span>Parciales (Faltan días)</span></span>
          <span class="hovac-tree-badge warn">${countParciales}</span>
        </button>
        <button class="hovac-tree-item ${cf === 'completadas' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('completadas')">
          <span class="hovac-tree-item-left"><span>🟢</span> <span>Completadas (Faltan 0d)</span></span>
          <span class="hovac-tree-badge ok">${countCompletadas}</span>
        </button>

        <div class="hovac-tree-section-title" style="margin-top:8px;">
          <span>📅 FECHAS IMPUTADAS EN HO</span>
        </div>
        <button class="hovac-tree-item ${cf === 'con_fechas' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('con_fechas')">
          <span class="hovac-tree-item-left"><span>📂</span> <span>Con Fechas en Cuadrante</span></span>
          <span class="hovac-tree-badge">${countConFechas}</span>
        </button>
        <button class="hovac-tree-item sub ${cf === 'en_curso_hoy' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('en_curso_hoy')">
          <span class="hovac-tree-item-left"><span>🏖️</span> <span>Octubre / Noviembre 26</span></span>
          <span class="hovac-tree-badge ok">${countOctNov}</span>
        </button>
        <button class="hovac-tree-item sub ${cf === 'anio_anterior' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('anio_anterior')">
          <span class="hovac-tree-item-left"><span>⏪</span> <span>Vac. Año Anterior (VN)</span></span>
          <span class="hovac-tree-badge warn">${countVN}</span>
        </button>

        <div class="hovac-tree-section-title" style="margin-top:8px;">
          <span>🗓️ CARPETAS POR MES (2026)</span>
        </div>
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => monthCounts[m] > 0 || m >= 10).map(m => `
          <button class="hovac-tree-item sub ${cf === 'mes_' + m ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('mes_${m}')">
            <span class="hovac-tree-item-left"><span>📁</span> <span>${String(m).padStart(2, '0')}. ${MESES_LARGOS[m]} 2026</span></span>
            <span class="hovac-tree-badge ${monthCounts[m] > 0 ? 'ok' : ''}">${monthCounts[m]}</span>
          </button>
        `).join('')}

        <div class="hovac-tree-section-title" style="margin-top:8px;">
          <span>🏢 SOCIEDAD / CENTRO SAP</span>
        </div>
        <button class="hovac-tree-item ${cf === 'sociedad_s172' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('sociedad_s172')">
          <span class="hovac-tree-item-left"><span>🏢</span> <span>S172 · SIFU, S.L.</span></span>
          <span class="hovac-tree-badge">${countS172}</span>
        </button>
        <button class="hovac-tree-item ${cf === 'sociedad_s171' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('sociedad_s171')">
          <span class="hovac-tree-item-left"><span>🛡️</span> <span>S171 · Int. Laboral (CEE)</span></span>
          <span class="hovac-tree-badge">${countS171}</span>
        </button>
        <button class="hovac-tree-item ${cf === 'apoyos_externos' ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('apoyos_externos')" title="Trabajadores activos en tus proyectos de Barcelona cuyo responsable en ficha es otro gestor">
          <span class="hovac-tree-item-left"><span>🤝</span> <span>Apoyos en mis Proyectos</span></span>
          <span class="hovac-tree-badge">${apoyosList.length}</span>
        </button>

        <div class="hovac-tree-section-title" style="margin-top:8px;">
          <span>🏗️ POR PROYECTO SAP HO (${proyList.length})</span>
        </div>
        ${proyList.slice(0, 18).map(p => `
          <button class="hovac-tree-item sub ${cf === 'proy_' + p.id ? 'active' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('proy_${p.id}')" title="${p.id} · ${p.denom}">
            <span class="hovac-tree-item-left"><span>📁</span> <span>${p.denom || p.id}</span></span>
            <span class="hovac-tree-badge">${p.count}</span>
          </button>
        `).join('')}
      </aside>
    `;
  }

  // Render cuando el usuario entra dentro de la carpeta de un trabajador concreto (Vista Explorador de Trabajador)
  function renderWorkerInternalExplorer(worker) {
    if (!worker) return '';
    const periodos = worker.periodos_vacaciones || [];
    const activePeriod = ExplorerState.openedPeriodId
      ? periodos.find(p => p.id_periodo === ExplorerState.openedPeriodId)
      : null;

    const diasMostrar = activePeriod ? (activePeriod.dias || []) : (worker.fechas_detalle || []);
    const pct = worker.vac_totales > 0 ? Math.min(100, Math.round((worker.vac_tomados / worker.vac_totales) * 100)) : 0;
    const isSyncingThis = ExplorerState.syncingWorkerId === worker.id_empleado;

    return `
      <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
        <!-- Cabecera de Carpeta del Trabajador -->
        <div style="background:linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border:1px solid #bfdbfe; border-radius:12px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:52px; height:52px; border-radius:12px; background:#dbeafe; border:2px solid #93c5fd; display:flex; align-items:center; justify-content:center; font-size:26px;">
              📂
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:16px; font-weight:900; color:#0f172a;">${worker.nombre_completo}</span>
                <span style="font-family:'JetBrains Mono', monospace; font-size:11.5px; font-weight:800; background:#1e3a8a; color:#ffffff; padding:2px 8px; border-radius:6px;">ID SAP: ${worker.id_empleado}</span>
                <span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#166534;">
                  🟢 Activo en SAP HO
                </span>
              </div>
              <div style="font-size:12px; color:#475569; margin-top:4px;">
                DNI: <b>${worker.dni || '—'}</b> · Tel: <b>${worker.telefono || '—'}</b> · Sociedad: <b>${worker.id_centro} (${worker.nom_sociedad})</b> · Contrato: <b>${worker.tipo_contrato} (${worker.fin_contrato})</b> · Jornada: <b>${worker.horas_semana}h/sem</b>
              </div>
              <div style="font-size:11.5px; color:#1e40af; margin-top:3px; font-weight:700;">
                👤 Responsable SAP HO: ${worker.nom_responsable || 'ALEJANDRO COSCOLIN PEREGRIN'} (${worker.id_responsable || '00062620'})
              </div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${!worker.en_baja_it_actual ? `
              <button class="hovac-btn-give-vac" style="padding:6px 12px; font-size:12px;" onclick="window.HOVacacionesExplorer.openPlanVacationModal('${worker.id_empleado}')">
                <span>🏖️</span> Conceder Vacaciones
              </button>
            ` : `
              <span style="font-size:11px; font-weight:800; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:5px 10px; border-radius:6px;">
                🩺 Bloqueado por Baja IT
              </span>
            `}
            <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.printVacationReceipt('${worker.id_empleado}')" title="Imprimir Solicitud / Justificante Firmado">
              <span>📄</span> Justificante Firmado
            </button>
            <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.closeWorkerFolder()">
              <span>⬅️</span> Volver a la Lista
            </button>
            <button class="hovac-cmd-btn primary" onclick="window.HOVacacionesExplorer.syncSingleWorkerLive('${worker.id_empleado}')" ${isSyncingThis ? 'disabled' : ''}>
              <span>${isSyncingThis ? '⏳' : '🔄'}</span> ${isSyncingThis ? 'Consultando SAP HO...' : 'Refrescar en Vivo HO'}
            </button>
          </div>
        </div>

        <!-- Tarjetas de Contadores Oficiales SAP HO del Trabajador -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:5px solid #2563eb; border-radius:10px; padding:12px 14px;">
            <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">1. Vacaciones Anuales SAP HO</div>
            <div style="font-size:26px; font-weight:900; color:#1e3a8a; margin-top:4px;">${worker.vac_totales} <small style="font-size:13px;">días</small></div>
            <div style="font-size:11px; color:#64748b;">Derecho anual registrado en EmpleadoSet</div>
          </div>

          <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:5px solid #0284c7; border-radius:10px; padding:12px 14px;">
            <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">2. Ya Imputadas / Disfrutadas en HO</div>
            <div style="font-size:26px; font-weight:900; color:#0369a1; margin-top:4px;">${worker.vac_tomados} <small style="font-size:13px;">días (${pct}%)</small></div>
            <div style="font-size:11px; color:#64748b;">${worker.dias_vc_naturales_2026} días nat. (${worker.dias_vc_laborables_2026} lab.) en cuadrante 2026</div>
          </div>

          <div style="background:${worker.vac_restantes > 0 ? '#fff1f2' : '#f0fdf4'}; border:1px solid ${worker.vac_restantes > 0 ? '#fecdd3' : '#bbf7d0'}; border-left:5px solid ${worker.vac_restantes > 0 ? '#e11d48' : '#16a34a'}; border-radius:10px; padding:12px 14px;">
            <div style="font-size:10.5px; font-weight:900; color:${worker.vac_restantes > 0 ? '#9f1239' : '#166534'}; text-transform:uppercase;">3. FALTAN POR DISFRUTAR EN HO</div>
            <div style="font-size:28px; font-weight:900; color:${worker.vac_restantes > 0 ? '#be123c' : '#15803d'}; margin-top:4px;">${worker.vac_restantes} <small style="font-size:13px;">días pendientes</small></div>
            <div style="font-size:11px; font-weight:700; color:${worker.vac_restantes > 0 ? '#9f1239' : '#166534'};">
              ${worker.vac_restantes > 0 ? `⚠️ Pendiente de disfrutar ${worker.vac_restantes} días en SAP HO` : '✅ Todas las vacaciones de 2026 disfrutadas'}
            </div>
          </div>

          ${worker.dias_vn_naturales_2026 > 0 ? `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-left:5px solid #d97706; border-radius:10px; padding:12px 14px;">
              <div style="font-size:10.5px; font-weight:800; color:#92400e; text-transform:uppercase;">4. Vacaciones Año Anterior (VN)</div>
              <div style="font-size:24px; font-weight:900; color:#b45309; margin-top:4px;">${worker.dias_vn_naturales_2026}d nat <small style="font-size:13px;">(${worker.dias_vn_laborables_2026}d lab)</small></div>
              <div style="font-size:11px; color:#78350f;">Imputadas en cuadrante 2026 como VN</div>
            </div>
          ` : ''}
        </div>

        <!-- Subcarpetas de Periodos de Vacaciones Imputados (Estilo Carpetas de Windows) -->
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="font-size:13px; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <span>📁</span> SUBCARPETAS DE PERIODOS IMPUTADOS EN SAP HO (${periodos.length})
            </div>
            ${activePeriod ? `
              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.openWorkerPeriod('${worker.id_empleado}', null)">
                🔎 Ver Todos los Periodos (${worker.fechas_detalle.length} días)
              </button>
            ` : ''}
          </div>

          ${periodos.length === 0 ? `
            <div style="background:#fffbeb; border:1px dashed #f59e0b; border-radius:10px; padding:20px; text-align:center;">
              <div style="font-size:28px; margin-bottom:6px;">📂</div>
              <div style="font-size:13.5px; font-weight:800; color:#92400e;">
                Carpeta vacía en el cuadrante 2026: ${worker.nombre_completo} no tiene fechas de vacaciones grabadas en el cuadrante 2026 de SAP HO
              </div>
              <div style="font-size:12px; color:#78350f; margin-top:4px;">
                Saldo en SAP HO: <b>${worker.vac_totales} días totales</b> · <b>${worker.vac_tomados} días tomados</b> · <b style="color:#dc2626;">Le faltan ${worker.vac_restantes} días por disfrutar</b>.
              </div>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
              ${periodos.map(p => {
                const isSel = ExplorerState.openedPeriodId === p.id_periodo;
                return `
                  <div class="hovac-folder-card ${isSel ? 'selected' : ''}" onclick="window.HOVacacionesExplorer.openWorkerPeriod('${worker.id_empleado}', '${isSel ? '' : p.id_periodo}')">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:24px;">${isSel ? '📂' : '📁'}</span>
                        <div>
                          <div style="font-size:12.5px; font-weight:900; color:#0f172a;">${p.rango_texto}</div>
                          <div style="font-size:11px; color:#475569; font-weight:600;">${p.etiqueta_tipo} · Mes de ${p.mes_inicio}</div>
                        </div>
                      </div>
                      <span style="font-size:10px; font-weight:800; padding:2px 7px; border-radius:999px; background:${p.estado === 'EN_CURSO' ? '#dcfce7; color:#166534;' : p.estado === 'PROGRAMADO' ? '#f3e8ff; color:#6b21a8;' : '#dbeafe; color:#1e40af;'}">
                        ${p.estado_label}
                      </span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:7px 10px; font-size:11.5px; display:flex; justify-content:space-between;">
                      <span>📅 <b>${p.dias_naturales}</b> días naturales</span>
                      <span>⏱️ <b>${p.dias_laborables_cuadrante}</b> días laborables con turno</span>
                    </div>
                    <div style="font-size:11px; color:#64748b;">
                      🏢 Proyecto(s) HO: <b>${(p.proyectos || []).join(', ') || 'General'}</b>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Tabla Detallada Día a Día de Fechas Imputadas en el Cuadrante de SAP HO -->
        ${diasMostrar.length > 0 ? `
          <div>
            <div style="font-size:13px; font-weight:900; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
              <span>🗓️</span> DESGLOSE DÍA A DÍA EN EL CUADRANTE DE SAP HO (${diasMostrar.length} fechas ${activePeriod ? 'en ' + activePeriod.rango_texto : 'en 2026'})
            </div>
            <div style="border:1px solid #cbd5e1; border-radius:10px; overflow:hidden;">
              <table class="hovac-details-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Día Semana</th>
                    <th>Mes</th>
                    <th>Código SAP</th>
                    <th>Tipo de Vacaciones en HO</th>
                    <th>Cómputo Turno</th>
                    <th>Proyecto(s) y Horarios Imputados en SAP HO</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${diasMostrar.map(d => `
                    <tr class="hovac-row-worker">
                      <td style="font-family:'JetBrains Mono', monospace; font-weight:900; color:#1e3a8a;">📄 ${d.fecha_es}</td>
                      <td style="font-weight:700;">${d.dia_semana}</td>
                      <td>${d.mes_nombre}</td>
                      <td>
                        <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:800; padding:2px 6px; border-radius:4px; background:${d.codigo_tipo === 'VC' ? '#dbeafe; color:#1e40af;' : '#fef3c7; color:#92400e;'}">
                          ${d.codigo_tipo}
                        </span>
                      </td>
                      <td style="font-weight:700;">${d.etiqueta_tipo}</td>
                      <td>
                        ${d.es_laborable
                          ? `<span style="color:#15803d; font-weight:800;">🟢 Día Laborable (Con horario)</span>`
                          : `<span style="color:#64748b; font-weight:600;">⚪ Descanso / Fin de semana (00:00)</span>`}
                      </td>
                      <td>
                        ${(d.turnos || []).map(t => `
                          <div style="font-size:11px; margin-bottom:2px;">
                            <b style="color:#0f172a;">${t.id_proyecto}</b> (${t.denominacion || 'Centro'}) · <code>${t.turno}</code> · <span style="color:#1e40af; font-family:'JetBrains Mono', monospace;">${t.horario}</span> · <span style="color:#64748b;">${t.tipo_imputacion}</span>
                          </div>
                        `).join('')}
                      </td>
                      <td>
                        <span style="font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:999px; background:${d.estado === 'EN_CURSO' ? '#dcfce7; color:#166534;' : d.estado === 'PROGRAMADO' ? '#f3e8ff; color:#6b21a8;' : '#eff6ff; color:#1d4ed8;'}">
                          ${d.estado === 'EN_CURSO' ? '🏖️ En Curso Hoy' : d.estado === 'PROGRAMADO' ? '📅 Programado' : '✅ Disfrutado'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Render de la Vista Detalles (Tabla tipo Explorador de Windows con filtros por cada columna y desplegable de fechas)
  function renderDetailsTableView(workers) {
    const cf = ExplorerState.columnFilters || {};
    const hasActiveColFilters = Object.entries(cf).some(([k, v]) => v && v !== 'todos');
    const sortArrow = (col) => ExplorerState.sortBy === col ? (ExplorerState.sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    const allDataWorkers = (typeof HO_VACACIONES_PAYLOAD !== 'undefined' && HO_VACACIONES_PAYLOAD?.trabajadores) ? HO_VACACIONES_PAYLOAD.trabajadores : workers;
    const distinctTotales = Array.from(new Set(allDataWorkers.map(w => w.vac_totales || w.vacTotales).filter(Boolean))).sort((a, b) => b - a);
    const distinctRestantes = Array.from(new Set(allDataWorkers.map(w => w.vac_restantes !== undefined ? w.vac_restantes : w.vacRestantes).filter(v => v !== undefined && v !== null && v > 0))).sort((a, b) => b - a);

    return `
      <table class="hovac-details-table">
        <thead>
          <!-- Fila 1: Cabeceras con ordenación -->
          <tr>
            <th style="width:34px; text-align:center;" title="Desplegar subcarpetas de fechas">▸</th>
            <th onclick="window.HOVacacionesExplorer.setSort('nombre')">Nombre del Trabajador (Carpeta HO)${sortArrow('nombre')}</th>
            <th onclick="window.HOVacacionesExplorer.setSort('baja_it')" style="width:130px; text-align:center;">Estado / Baja IT${sortArrow('baja_it')}</th>
            <th onclick="window.HOVacacionesExplorer.setSort('id_empleado')" style="width:88px;">ID SAP${sortArrow('id_empleado')}</th>
            <th style="width:180px;">Proyectos Asignados en HO</th>
            <th onclick="window.HOVacacionesExplorer.setSort('vac_totales')" style="width:85px; text-align:center;">Totales HO${sortArrow('vac_totales')}</th>
            <th onclick="window.HOVacacionesExplorer.setSort('vac_tomados')" style="width:115px; text-align:center;">Imputados HO${sortArrow('vac_tomados')}</th>
            <th onclick="window.HOVacacionesExplorer.setSort('vac_restantes')" style="width:135px; text-align:center; background:#fff1f2; color:#9f1239;">FALTAN DISFRUTAR${sortArrow('vac_restantes')}</th>
            <th onclick="window.HOVacacionesExplorer.setSort('fechas')">Fechas Exactas Imputadas en SAP HO (2026)${sortArrow('fechas')}</th>
            <th style="width:145px; text-align:center;">Acciones Gestor</th>
          </tr>

          <!-- Fila 2: FILTROS INTERACTIVOS POR CADA COLUMNA -->
          <tr class="hovac-filter-row">
            <th style="text-align:center; padding:4px 2px;">
              <span style="font-size:11px; color:#64748b;" title="Filtros por columna activos">🔍</span>
            </th>
            <th style="padding:3px 4px;">
              <input type="text" id="hovac-colfilter-nombre" class="hovac-col-input ${cf.nombre ? 'active' : ''}" placeholder="🔍 Filtrar nombre..." value="${cf.nombre || ''}" oninput="window.HOVacacionesExplorer.setColumnFilter('nombre', this.value)">
            </th>
            <th style="padding:3px 4px;">
              <select id="hovac-colfilter-baja_it" class="hovac-col-select ${cf.baja_it && cf.baja_it !== 'todos' ? 'active' : ''}" onchange="window.HOVacacionesExplorer.setColumnFilter('baja_it', this.value)">
                <option value="todos" ${cf.baja_it === 'todos' ? 'selected' : ''}>Todos</option>
                <option value="sin_baja" ${cf.baja_it === 'sin_baja' ? 'selected' : ''}>🟢 Sin Baja</option>
                <option value="con_baja" ${cf.baja_it === 'con_baja' ? 'selected' : ''}>🩺 En Baja IT</option>
              </select>
            </th>
            <th style="padding:3px 4px;">
              <input type="text" id="hovac-colfilter-id_empleado" class="hovac-col-input ${cf.id_empleado ? 'active' : ''}" placeholder="🔍 ID..." value="${cf.id_empleado || ''}" oninput="window.HOVacacionesExplorer.setColumnFilter('id_empleado', this.value)">
            </th>
            <th style="padding:3px 4px;">
              <input type="text" id="hovac-colfilter-proyecto" class="hovac-col-input ${cf.proyecto ? 'active' : ''}" placeholder="🔍 Proyecto..." value="${cf.proyecto || ''}" oninput="window.HOVacacionesExplorer.setColumnFilter('proyecto', this.value)">
            </th>
            <th style="padding:3px 4px;">
              <select id="hovac-colfilter-vac_totales" class="hovac-col-select ${cf.vac_totales && cf.vac_totales !== 'todos' ? 'active' : ''}" onchange="window.HOVacacionesExplorer.setColumnFilter('vac_totales', this.value)">
                <option value="todos" ${cf.vac_totales === 'todos' ? 'selected' : ''}>Todos (${distinctTotales.length} tipos)</option>
                ${distinctTotales.map(t => `<option value="${t}" ${cf.vac_totales === String(t) ? 'selected' : ''}>${t}d</option>`).join('')}
              </select>
            </th>
            <th style="padding:3px 4px;">
              <select id="hovac-colfilter-vac_tomados" class="hovac-col-select ${cf.vac_tomados && cf.vac_tomados !== 'todos' ? 'active' : ''}" onchange="window.HOVacacionesExplorer.setColumnFilter('vac_tomados', this.value)">
                <option value="todos" ${cf.vac_tomados === 'todos' ? 'selected' : ''}>Todos</option>
                <option value="0" ${cf.vac_tomados === '0' ? 'selected' : ''}>0d (Sin Imputar)</option>
                <option value=">0" ${cf.vac_tomados === '>0' ? 'selected' : ''}>&gt;0d (Parciales)</option>
                <option value="15" ${cf.vac_tomados === '15' ? 'selected' : ''}>15d (3 sem)</option>
                <option value="18" ${cf.vac_tomados === '18' ? 'selected' : ''}>18d</option>
                <option value="20" ${cf.vac_tomados === '20' ? 'selected' : ''}>20d (4 sem)</option>
                <option value="25" ${cf.vac_tomados === '25' ? 'selected' : ''}>25d (100%)</option>
              </select>
            </th>
            <th style="padding:3px 4px;">
              <select id="hovac-colfilter-vac_restantes" class="hovac-col-select ${cf.vac_restantes && cf.vac_restantes !== 'todos' ? 'active' : ''}" onchange="window.HOVacacionesExplorer.setColumnFilter('vac_restantes', this.value)" style="${cf.vac_restantes && cf.vac_restantes !== 'todos' ? 'background:#ffe4e6; color:#9f1239; font-weight:800;' : ''}">
                <option value="todos" ${cf.vac_restantes === 'todos' ? 'selected' : ''}>Todos</option>
                <option value=">0" ${cf.vac_restantes === '>0' ? 'selected' : ''}>⚠️ Pendientes (&gt;0)</option>
                <option value="0" ${cf.vac_restantes === '0' ? 'selected' : ''}>✅ Completadas (0d)</option>
                ${distinctRestantes.map(r => `<option value="${r}" ${cf.vac_restantes === String(r) ? 'selected' : ''}>${r === 25 ? '🔴 ' : ''}Faltan ${r}d</option>`).join('')}
              </select>
            </th>
            <th style="padding:3px 4px;">
              <input type="text" id="hovac-colfilter-fechas" class="hovac-col-input ${cf.fechas ? 'active' : ''}" placeholder="🔍 Fechas (Agosto, 03/08)..." value="${cf.fechas || ''}" oninput="window.HOVacacionesExplorer.setColumnFilter('fechas', this.value)">
            </th>
            <th style="padding:3px 4px; text-align:center;">
              <button type="button" class="hovac-clear-col-filters-btn" onclick="window.HOVacacionesExplorer.clearColumnFilters()" title="Limpiar todos los filtros de columna" style="${hasActiveColFilters ? 'background:#fee2e2; border-color:#ef4444; color:#b91c1c;' : 'opacity:0.6;'}">
                <span>🧹</span> Limpiar
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          ${workers.length === 0 ? `
            <tr>
              <td colspan="10" style="padding:45px 20px; text-align:center; color:#64748b;">
                <div style="font-size:32px; margin-bottom:8px;">📂</div>
                <div style="font-size:14px; font-weight:800; color:#0f172a;">No hay trabajadores que coincidan con los filtros aplicados</div>
                <div style="font-size:12px; margin-top:4px; margin-bottom:12px; color:#64748b;">Prueba a modificar los filtros por columna o haz clic en restablecer.</div>
                <button type="button" onclick="window.HOVacacionesExplorer.clearColumnFilters()" style="background:#0284c7; color:#ffffff; border:none; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800; cursor:pointer;">
                  🧹 Restablecer Filtros de Columna
                </button>
              </td>
            </tr>
          ` : ''}
          ${workers.map(w => {
            const isSelected = ExplorerState.selectedWorkerId === w.id_empleado;
            const isExpanded = !!ExplorerState.expandedRows[w.id_empleado];
            const pct = w.vac_totales > 0 ? Math.min(100, Math.round((w.vac_tomados / w.vac_totales) * 100)) : 0;
            const barColor = w.vac_restantes === 0 ? '#16a34a' : w.vac_tomados > 0 ? '#0284c7' : '#e11d48';
            const folderIcon = w.en_baja_it_actual ? '🩺' : w.en_vacaciones_hoy ? '🏖️' : w.vac_restantes === 0 ? '🟢' : w.vac_tomados > 0 ? '📂' : '📁';
            const proys = w.proyectos_asignados || [];
            const diasBaja = (w.otras_ausencias_2026 && w.otras_ausencias_2026.Baja) ? w.otras_ausencias_2026.Baja : 0;

            return `
              <tr class="hovac-row-worker ${isSelected ? 'selected' : ''}"
                  style="${w.en_baja_it_actual ? 'background:#fffafa;' : ''}"
                  onclick="window.HOVacacionesExplorer.selectWorker('${w.id_empleado}')"
                  ondblclick="window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')">
                <td style="text-align:center;" onclick="event.stopPropagation(); window.HOVacacionesExplorer.toggleExpandRow('${w.id_empleado}')">
                  <button style="background:none; border:none; cursor:pointer; font-size:13px; color:#475569; font-weight:900;" title="Desplegar / contraer fechas imputadas">
                    ${isExpanded ? '▾' : '▸'}
                  </button>
                </td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:17px;">${folderIcon}</span>
                    <div>
                      <div style="font-weight:800; color:#0f172a; font-size:12.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span>${w.nombre_completo}</span>
                        ${!w.es_asignado_directo ? `<span style="font-size:9.5px; background:#e0e7ff; color:#3730a3; padding:1px 6px; border-radius:4px; font-weight:800;">🤝 APOYO</span>` : ''}
                        ${(ExplorerState.recentlyUpdatedWorkers[w.id_empleado] && (Date.now() - ExplorerState.recentlyUpdatedWorkers[w.id_empleado] < 300000)) ? `<span style="font-size:9.5px; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:1px 6px; border-radius:4px; font-weight:900;">⚡ ACTUALIZADO EN VIVO SAP HO</span>` : ''}
                      </div>
                      <div style="font-size:10.5px; color:#64748b;">
                        DNI: ${w.dni || '—'} · ${w.id_centro} · ${w.tipo_contrato} (${w.fin_contrato})
                      </div>
                    </div>
                  </div>
                </td>
                <td style="text-align:center;">
                  ${w.en_baja_it_actual ? `
                    <span style="display:inline-flex; flex-direction:column; align-items:center; font-size:10.5px; font-weight:900; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:2px 8px; border-radius:8px; line-height:1.15;" title="Trabajador en Baja IT en SAP HO (${diasBaja} días en 2026). No se pueden planificar vacaciones mientras esté de baja.">
                      <span>🩺 EN BAJA IT</span>
                      <small style="font-size:9px; font-weight:700; color:#b91c1c;">No planificable</small>
                    </span>
                  ` : `
                    <span style="display:inline-flex; flex-direction:column; align-items:center; font-size:10.5px; font-weight:900; background:#dcfce7; color:#166534; border:1px solid #86efac; padding:2px 8px; border-radius:8px; line-height:1.15;" title="Trabajador activo y operativo en SAP HO. Puedes planificar sus vacaciones.">
                      <span>🟢 SIN BAJA</span>
                      <small style="font-size:9px; font-weight:700; color:#15803d;">Planificable</small>
                    </span>
                  `}
                </td>
                <td style="font-family:'JetBrains Mono', monospace; font-size:11.5px; font-weight:700; color:#334155;">
                  ${w.id_empleado}
                </td>
                <td>
                  ${proys.length > 0 ? `
                    <div style="font-size:11px; font-weight:700; color:#1e40af; max-width:190px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${proys.map(p => p.id_proyecto + ' · ' + p.denominacion).join('\n')}">
                      🏢 ${proys[0].denominacion || proys[0].id_proyecto}
                    </div>
                    <div style="font-size:10px; color:#64748b;">
                      ${proys[0].id_proyecto}${proys.length > 1 ? ` (+${proys.length - 1} más)` : ''}
                    </div>
                  ` : `<span style="font-size:11px; color:#94a3b8;">Sin proyecto 2026</span>`}
                </td>
                <td style="text-align:center;">
                  <span style="font-size:13.5px; font-weight:800; color:#1e293b;">${w.vac_totales}d</span>
                </td>
                <td style="text-align:center;">
                  <div style="font-size:13.5px; font-weight:800; color:#0369a1;">
                    ${w.vac_tomados}d <small style="font-size:10px; color:#64748b;">(${pct}%)</small>
                  </div>
                  <div class="hovac-mini-progress">
                    <div class="hovac-mini-progress-bar" style="width:${pct}%; background:${barColor};"></div>
                  </div>
                </td>
                <td style="text-align:center; background:${w.vac_restantes > 0 ? 'rgba(254, 226, 226, 0.35)' : 'rgba(220, 252, 231, 0.35)'};">
                  ${w.vac_restantes > 0 ? `
                    <span style="display:inline-block; background:${w.en_baja_it_actual ? '#94a3b8' : '#e11d48'}; color:#ffffff; font-size:12.5px; font-weight:900; padding:3px 10px; border-radius:999px; box-shadow:0 2px 5px rgba(15,23,42,0.15);" title="${w.en_baja_it_actual ? 'Pendientes en HO, pero bloqueadas por Baja IT' : 'Vacaciones pendientes planificables'}">
                      Faltan ${w.vac_restantes} d
                    </span>
                  ` : `
                    <span style="display:inline-block; background:#16a34a; color:#ffffff; font-size:11.5px; font-weight:900; padding:3px 9px; border-radius:999px;">
                      ✅ 0 días (OK)
                    </span>
                  `}
                </td>
                <td>
                  ${renderWorkerDateChips(w, true)}
                </td>
                <td style="text-align:right; white-space:nowrap;" onclick="event.stopPropagation()">
                  <div style="display:inline-flex; align-items:center; gap:4px;">
                    ${!w.en_baja_it_actual ? `
                      <button class="hovac-btn-give-vac" onclick="window.HOVacacionesExplorer.openPlanVacationModal('${w.id_empleado}')" title="Conceder o planificar vacaciones en cuadrante a ${w.nombre_completo}">
                        <span>🏖️</span> Conceder
                      </button>
                    ` : `
                      <button class="hovac-btn-icon-mini" disabled style="opacity:0.45; cursor:not-allowed; background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" title="Bloqueado: Trabajador en Baja Médica IT. No se pueden conceder vacaciones hasta que tenga el alta médica.">
                        <span>🩺</span> Baja IT
                      </button>
                    `}
                    <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')" style="padding:4px 7px; font-size:11px;" title="Ver desglose y carpetas día a día">
                      📂
                    </button>
                    <button class="hovac-btn-icon-mini" onclick="window.HOVacacionesExplorer.printVacationReceipt('${w.id_empleado}')" title="Generar Solicitud / Justificante Firmado de Vacaciones">
                      📄
                    </button>
                  </div>
                </td>
              </tr>
              ${isExpanded ? `
                <tr class="hovac-row-expanded-detail">
                  <td></td>
                  <td colspan="9" style="padding:12px 16px;">
                    <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:9px; padding:12px;">
                      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                        <div style="font-size:12px; font-weight:900; color:#0f172a;">
                          📂 Desglose en SAP HO de <b>${w.nombre_completo}</b> (${w.id_empleado}) — Totales HO: <b>${w.vac_totales}d</b> · Imputados HO: <b>${w.vac_tomados}d</b> · <span style="color:#e11d48;">Faltan por disfrutar: <b>${w.vac_restantes}d</b></span>
                        </div>
                        <button class="hovac-cmd-btn primary" style="padding:3px 9px; font-size:11px;" onclick="window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')">
                          🔍 Abrir Explorador Completo Día a Día
                        </button>
                      </div>
                      ${(w.periodos_vacaciones || []).length === 0 ? `
                        <div style="font-size:11.5px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; padding:8px 12px; border-radius:6px;">
                          ⚠️ Sin fechas de vacaciones grabadas en el cuadrante 2026 de SAP HO. Le faltan por disfrutar <b>${w.vac_restantes} días</b>${w.en_baja_it_actual ? ' (actualmente en <b>Baja IT</b>, no planificable hasta el alta)' : ''}.
                        </div>
                      ` : `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                          ${w.periodos_vacaciones.map(p => `
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:8px 10px;">
                              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                                <div style="font-size:12px; font-weight:800; color:#1e3a8a;">
                                  📁 ${p.id_periodo} · ${p.rango_texto} — <span style="color:#0369a1;">${p.dias_naturales} días naturales (${p.dias_laborables_cuadrante} días laborables con horario)</span> · <span style="color:#475569;">${p.etiqueta_tipo}</span>
                                </div>
                                <span style="font-size:10.5px; font-weight:800; color:#166534;">Proyectos HO: ${(p.proyectos || []).join(', ')}</span>
                              </div>
                              <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">
                                ${(p.dias || []).map(d => `
                                  <span style="font-family:'JetBrains Mono', monospace; font-size:10.5px; padding:2px 6px; border-radius:4px; border:1px solid ${d.es_laborable ? '#93c5fd' : '#e2e8f0'}; background:${d.es_laborable ? '#eff6ff' : '#f1f5f9'}; color:${d.es_laborable ? '#1e40af' : '#64748b'}; font-weight:${d.es_laborable ? '800' : '500'};" title="${d.dia_semana} ${d.fecha_es} · ${d.es_laborable ? 'Laborable con horario' : 'Descanso/Fin de semana'}">
                                    ${d.fecha_es.slice(0, 5)} (${d.dia_semana.slice(0, 2)})
                                  </span>
                                `).join('')}
                              </div>
                            </div>
                          `).join('')}
                        </div>
                      `}
                    </div>
                  </td>
                </tr>
              ` : ''}
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Render de la Vista de Iconos / Carpetas estilo Explorador de Windows
  function renderFoldersGridView(workers) {
    if (workers.length === 0) {
      return renderDetailsTableView(workers);
    }
    return `
      <div class="hovac-folders-grid">
        ${workers.map(w => {
          const isSelected = ExplorerState.selectedWorkerId === w.id_empleado;
          const vTot = w.vac_totales || w.vacTotales || 25;
          const vTom = w.vac_tomados !== undefined ? w.vac_tomados : (w.vacTomados !== undefined ? w.vacTomados : 0);
          const vFal = w.vac_restantes !== undefined ? w.vac_restantes : (w.vacRestantes !== undefined ? w.vacRestantes : Math.max(0, vTot - vTom));
          const pct = vTot > 0 ? Math.min(100, Math.round((vTom / vTot) * 100)) : 0;
          const icon = w.en_baja_it_actual ? '🩺' : w.en_vacaciones_hoy ? '🏖️' : vFal === 0 ? '🟢' : vTom > 0 ? '📂' : '📁';
          return `
            <div class="hovac-folder-card ${isSelected ? 'selected' : ''}"
                 onclick="window.HOVacacionesExplorer.selectWorker('${w.id_empleado}')"
                 ondblclick="window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                <div style="display:flex; align-items:center; gap:9px;">
                  <span style="font-size:28px;">${icon}</span>
                  <div>
                    <div style="font-size:12.5px; font-weight:900; color:#0f172a; line-height:1.25;">${w.nombre_completo}</div>
                    <div style="font-size:10.5px; color:#64748b; font-family:'JetBrains Mono', monospace; margin-top:2px;">
                      ID: ${w.id_empleado} · ${w.id_centro} · ${w.en_baja_it_actual ? '<b style="color:#dc2626;">BAJA IT</b>' : '<b style="color:#16a34a;">SIN BAJA</b>'}
                    </div>
                  </div>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px; text-align:center;">
                <div>
                  <div style="font-size:9.5px; color:#64748b; font-weight:700;">TOTAL HO</div>
                  <div style="font-size:13px; font-weight:900; color:#1e293b;">${vTot}d</div>
                </div>
                <div>
                  <div style="font-size:9.5px; color:#64748b; font-weight:700;">IMPUTADO</div>
                  <div style="font-size:13px; font-weight:900; color:#0284c7;">${vTom}d</div>
                </div>
                <div style="background:${vFal > 0 ? '#ffe4e6' : '#dcfce7'}; border-radius:6px; padding:2px 0;">
                  <div style="font-size:9.5px; color:${vFal > 0 ? '#9f1239' : '#166534'}; font-weight:900;">FALTAN</div>
                  <div style="font-size:14px; font-weight:900; color:${vFal > 0 ? '#e11d48' : '#15803d'};">${vFal}d</div>
                </div>
              </div>

              <div class="hovac-mini-progress">
                <div class="hovac-mini-progress-bar" style="width:${pct}%; background:${w.vac_restantes === 0 ? '#16a34a' : '#0284c7'};"></div>
              </div>

              <div style="min-height:36px;">
                ${renderWorkerDateChips(w, true)}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px dashed #e2e8f0; gap:5px;">
                ${!w.en_baja_it_actual ? `
                  <button class="hovac-btn-give-vac" style="padding:3px 8px; font-size:10.5px;" onclick="event.stopPropagation(); window.HOVacacionesExplorer.openPlanVacationModal('${w.id_empleado}')" title="Conceder vacaciones">
                    🏖️ Conceder
                  </button>
                ` : `
                  <span style="font-size:10px; color:#dc2626; font-weight:700;">🩺 Baja IT</span>
                `}
                <div style="display:flex; gap:4px;">
                  <button class="hovac-cmd-btn" style="padding:3px 7px; font-size:10.5px;" onclick="event.stopPropagation(); window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')" title="Ver desglose">
                    📂
                  </button>
                  <button class="hovac-btn-icon-mini" onclick="event.stopPropagation(); window.HOVacacionesExplorer.printVacationReceipt('${w.id_empleado}')" title="Justificante">
                    📄
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Render de la Vista Mapa Anual / Calendario 2026 (Ene - Dic)
  function renderCalendarMatrixView(workers) {
    return `
      <div style="padding:12px; overflow-x:auto;">
        <table class="hovac-calendar-matrix">
          <thead>
            <tr>
              <th style="text-align:left; min-width:210px;">Trabajador (ID SAP)</th>
              <th style="width:90px;">Estado IT</th>
              <th style="width:70px;">Tot/Imp</th>
              <th style="width:75px; background:#fff1f2; color:#9f1239;">FALTAN</th>
              ${MESES_CORTOS.map((m, i) => `<th style="min-width:85px;">${m} 26</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${workers.map(w => {
              return `
                <tr onclick="window.HOVacacionesExplorer.selectWorker('${w.id_empleado}')" style="cursor:pointer; background:${ExplorerState.selectedWorkerId === w.id_empleado ? '#eff6ff' : '#ffffff'};">
                  <td style="font-weight:800; color:#0f172a;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                      <span>${w.nombre_completo}</span>
                      <button class="hovac-cmd-btn" style="padding:1px 6px; font-size:10px;" onclick="event.stopPropagation(); window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')">📂</button>
                    </div>
                    <div style="font-size:10px; color:#64748b; font-family:'JetBrains Mono', monospace;">${w.id_empleado} · ${w.id_centro}</div>
                  </td>
                  <td style="text-align:center; font-size:10px; font-weight:800;">
                    ${w.en_baja_it_actual ? '<span style="color:#dc2626;">🩺 Baja IT</span>' : '<span style="color:#16a34a;">🟢 Sin Baja</span>'}
                  </td>
                  <td style="text-align:center; font-weight:700; color:#334155;">
                    ${w.vac_totales} / <b style="color:#0284c7;">${w.vac_tomados}</b>
                  </td>
                  <td style="text-align:center; font-weight:900; background:${w.vac_restantes > 0 ? '#fff1f2' : '#f0fdf4'}; color:${w.vac_restantes > 0 ? '#e11d48' : '#15803d'};">
                    ${w.vac_restantes}d
                  </td>
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mNum => {
                    const daysInM = (w.fechas_detalle || []).filter(fd => fd.mes_num === mNum);
                    if (daysInM.length === 0) {
                      return `<td style="text-align:center; color:#cbd5e1;">—</td>`;
                    }
                    const firstD = daysInM[0].fecha_es.slice(0, 2);
                    const lastD = daysInM[daysInM.length - 1].fecha_es.slice(0, 2);
                    const labCount = daysInM.filter(x => x.es_laborable).length;
                    const isVN = daysInM.some(x => x.codigo_tipo === 'VN');
                    return `
                      <td style="background:${isVN ? '#fef3c7' : '#dbeafe'}; text-align:center; cursor:pointer;"
                          onclick="event.stopPropagation(); window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')"
                          title="${w.nombre_completo} en ${MESES_LARGOS[mNum]}: del día ${firstD} al ${lastD} (${daysInM.length}d nat / ${labCount}d lab)">
                        <div style="font-size:10.5px; font-weight:900; color:${isVN ? '#92400e' : '#1e40af'};">
                          ${firstD === lastD ? `Día ${firstD}` : `${firstD} al ${lastD}`}
                        </div>
                        <div style="font-size:9.5px; color:#334155; font-weight:700;">
                          ${daysInM.length}d (${labCount}L)
                        </div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render del Panel Derecho (Inspector / Vista Previa de Windows Explorer)
  function renderRightPreviewPane(workers) {
    const allRaw = getAllWorkersRaw();
    const selId = ExplorerState.openedWorkerId || ExplorerState.selectedWorkerId || (workers[0] && workers[0].id_empleado);
    const w = allRaw.find(x => x.id_empleado === selId) || workers[0];

    if (!w) {
      return `
        <aside class="hovac-preview-pane">
          <div style="text-align:center; padding:40px 10px; color:#64748b;">
            <div style="font-size:32px; margin-bottom:8px;">ℹ️</div>
            <div style="font-size:12.5px; font-weight:700;">Selecciona un trabajador para ver su ficha detallada de SAP HO</div>
          </div>
        </aside>
      `;
    }

    const pct = w.vac_totales > 0 ? Math.min(100, Math.round((w.vac_tomados / w.vac_totales) * 100)) : 0;
    const isSyncingThis = ExplorerState.syncingWorkerId === w.id_empleado;

    return `
      <aside class="hovac-preview-pane">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:9px;">
              <span style="font-size:26px;">${w.en_baja_it_actual ? '🩺' : w.vac_restantes === 0 ? '🟢' : w.vac_tomados > 0 ? '📂' : '📁'}</span>
              <div>
                <div style="font-size:13px; font-weight:900; color:#0f172a; line-height:1.2;">${w.nombre_completo}</div>
                <div style="font-size:11px; color:#475569; font-family:'JetBrains Mono', monospace; margin-top:2px;">
                  ID SAP: <b>${w.id_empleado}</b> · DNI: <b>${w.dni || '—'}</b>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen Visual de Saldo de Vacaciones en SAP HO -->
          <div style="background:${w.vac_restantes > 0 ? '#fff1f2' : '#f0fdf4'}; border:1px solid ${w.vac_restantes > 0 ? '#fecdd3' : '#bbf7d0'}; border-radius:9px; padding:10px; text-align:center; margin-bottom:10px;">
            <div style="font-size:10px; font-weight:900; text-transform:uppercase; color:${w.vac_restantes > 0 ? '#9f1239' : '#166534'};">
               VACACIONES QUE LE FALTAN POR DISFRUTAR (SAP HO)
            </div>
            <div style="font-size:28px; font-weight:900; color:${w.vac_restantes > 0 ? '#e11d48' : '#15803d'}; line-height:1.15; margin:4px 0;">
              ${w.vac_restantes} días
            </div>
            <div style="font-size:11px; font-weight:700; color:#334155;">
              Disfrutadas/Imputadas: <b>${w.vac_tomados}d</b> de <b>${w.vac_totales}d</b> anuales (${pct}%)
            </div>
            <div class="hovac-mini-progress" style="height:8px; margin-top:6px; background:#ffffff;">
              <div class="hovac-mini-progress-bar" style="width:${pct}%; background:${w.vac_restantes === 0 ? '#16a34a' : '#0284c7'};"></div>
            </div>
          </div>

          <!-- Acciones Rápidas sobre este Trabajador -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
            ${!w.en_baja_it_actual ? `
              <button class="hovac-btn-give-vac" style="justify-content:center; padding:7px 12px; font-size:12px;" onclick="window.HOVacacionesExplorer.openPlanVacationModal('${w.id_empleado}')">
                <span>🏖️</span> Conceder / Planificar Vacaciones
              </button>
            ` : `
              <div style="font-size:11px; font-weight:700; color:#b91c1c; background:#fee2e2; border:1px solid #fca5a5; padding:6px 10px; border-radius:6px; text-align:center;">
                🩺 En Baja IT: Concesión bloqueada hasta alta médica
              </div>
            `}
            <div style="display:flex; gap:6px;">
              <button class="hovac-cmd-btn" style="flex:1; justify-content:center;" onclick="window.HOVacacionesExplorer.openWorkerFolder('${w.id_empleado}')">
                📂 Ver Día a Día
              </button>
              <button class="hovac-cmd-btn" style="flex:1; justify-content:center;" onclick="window.HOVacacionesExplorer.printVacationReceipt('${w.id_empleado}')" title="Generar Solicitud / Justificante Firmado">
                📄 Justificante
              </button>
              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.syncSingleWorkerLive('${w.id_empleado}')" title="Consultar ahora mismo este trabajador en SAP HO" ${isSyncingThis ? 'disabled' : ''}>
                ${isSyncingThis ? '⏳' : '🔄'}
              </button>
            </div>
          </div>

          <!-- Fechas Imputadas en Cuadrante 2026 -->
          <div style="margin-bottom:12px;">
            <div style="font-size:10.5px; font-weight:900; text-transform:uppercase; color:#64748b; margin-bottom:6px;">
              📅 FECHAS IMPUTADAS EN CUADRANTE HO (${(w.periodos_vacaciones || []).length} periodos)
            </div>
            ${(w.periodos_vacaciones || []).length === 0 ? `
              <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:7px; padding:8px; font-size:11px; color:#64748b; text-align:center;">
                Sin fechas imputadas en el cuadrante 2026 de SAP HO
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${w.periodos_vacaciones.map(p => `
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid ${p.codigo_tipo === 'VN' ? '#d97706' : '#2563eb'}; border-radius:6px; padding:6px 8px; cursor:pointer;"
                       onclick="window.HOVacacionesExplorer.openWorkerPeriod('${w.id_empleado}', '${p.id_periodo}')">
                    <div style="font-size:11.5px; font-weight:800; color:#0f172a;">${p.rango_texto}</div>
                    <div style="font-size:10.5px; color:#475569;">
                      <b>${p.dias_naturales}d naturales</b> (${p.dias_laborables_cuadrante}d laborables) · ${p.etiqueta_tipo}
                    </div>
                    <div style="font-size:10px; color:#1e40af; font-weight:700;">
                      🏢 ${(p.proyectos || []).join(', ') || 'General'}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Propiedades del Contrato en SAP HO -->
          <div style="border-top:1px solid #e2e8f0; padding-top:10px;">
            <div style="font-size:10.5px; font-weight:900; text-transform:uppercase; color:#64748b; margin-bottom:6px;">
              📋 PROPIEDADES EN SAP S/4HANA HO
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
              <div style="background:#f8fafc; padding:5px 7px; border-radius:5px;">
                <span style="color:#64748b; display:block; font-size:9.5px;">Sociedad / Centro</span>
                <b>${w.id_centro} · ${w.id_sociedad}</b>
              </div>
              <div style="background:#f8fafc; padding:5px 7px; border-radius:5px;">
                <span style="color:#64748b; display:block; font-size:9.5px;">Tipo Contrato</span>
                <b>${w.tipo_contrato} (${w.horas_semana}h)</b>
              </div>
              <div style="background:#f8fafc; padding:5px 7px; border-radius:5px;">
                <span style="color:#64748b; display:block; font-size:9.5px;">Inicio Contrato</span>
                <b>${w.inicio_contrato}</b>
              </div>
              <div style="background:#f8fafc; padding:5px 7px; border-radius:5px;">
                <span style="color:#64748b; display:block; font-size:9.5px;">Fin Contrato HO</span>
                <b style="${w.dias_fin_contrato !== null && w.dias_fin_contrato <= 45 ? 'color:#dc2626;' : ''}">${w.fin_contrato}</b>
              </div>
              <div style="background:#f8fafc; padding:5px 7px; border-radius:5px; grid-column:1 / -1;">
                <span style="color:#64748b; display:block; font-size:9.5px;">Contacto Directo</span>
                <b>📞 ${w.telefono || 'Sin teléfono'}</b> ${w.email ? `· ✉️ ${w.email}` : ''}
              </div>
            </div>
          </div>

          <!-- Proyectos Asignados en HO -->
          <div style="border-top:1px solid #e2e8f0; padding-top:10px; margin-top:10px;">
            <div style="font-size:10.5px; font-weight:900; text-transform:uppercase; color:#64748b; margin-bottom:6px;">
              🏢 PROYECTOS ASIGNADOS EN HO (${(w.proyectos_asignados || []).length})
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${(w.proyectos_asignados || []).slice(0, 6).map(p => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:5px 7px; font-size:10.5px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <b style="color:#1e40af;">${p.id_proyecto}</b> · ${p.denominacion}
                  </div>
                  ${window.ProApp && window.ProApp.abrirEnHO ? `
                    <button onclick="window.ProApp.abrirEnHO('${p.id_proyecto}')" style="background:#dbeafe; color:#1e40af; border:none; border-radius:4px; padding:2px 5px; font-size:9.5px; font-weight:800; cursor:pointer;" title="Abrir proyecto en SAP HO">HO ↗</button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  // Cálculo de días naturales, laborables (L-V) y desglose de fechas
  function getDaysBetween(startStr, endStr) {
    if (!startStr || !endStr) return { nat: 0, lab: 0, days: [] };
    const d1 = new Date(startStr);
    const d2 = new Date(endStr);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d1 > d2) return { nat: 0, lab: 0, days: [] };

    let cur = new Date(d1);
    let nat = 0;
    let lab = 0;
    const days = [];

    while (cur <= d2) {
      nat++;
      const dayOfWeek = cur.getDay(); // 0 Dom, 6 Sab
      const isLab = (dayOfWeek !== 0 && dayOfWeek !== 6);
      if (isLab) lab++;

      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      const es = `${d}/${m}/${y}`;
      const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek];
      const mesNombre = MESES_LARGOS[cur.getMonth() + 1];

      days.push({
        fecha: iso,
        fecha_es: es,
        dia_semana: dayName,
        mes_nombre: mesNombre,
        mes_num: cur.getMonth() + 1,
        es_laborable: isLab
      });
      cur.setDate(cur.getDate() + 1);
    }
    return { nat, lab, days };
  }

  // Comprobar solapes de vacaciones con compañeros del mismo centro/proyecto de limpieza
  function getProjectOverlaps(worker, startStr, endStr) {
    if (!worker || !startStr || !endStr) return [];
    const d1 = new Date(startStr);
    const d2 = new Date(endStr);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d1 > d2) return [];

    const myProys = (worker.proyectos_asignados || []).map(p => p.id_proyecto);
    const allRaw = getAllWorkersRaw();
    const overlaps = [];

    allRaw.forEach(co => {
      if (!co || co.id_empleado === worker.id_empleado || !co.es_activo) return;
      const sharesProy = (co.proyectos_asignados || []).some(p => myProys.includes(p.id_proyecto));
      if (!sharesProy) return;

      (co.periodos_vacaciones || []).forEach(per => {
        const pIniParts = (per.fecha_inicio || '').split('/');
        const pFinParts = (per.fecha_fin || '').split('/');
        if (pIniParts.length === 3 && pFinParts.length === 3) {
          const pIni = new Date(`${pIniParts[2]}-${pIniParts[1]}-${pIniParts[0]}`);
          const pFin = new Date(`${pFinParts[2]}-${pFinParts[1]}-${pFinParts[0]}`);
          if (d1 <= pFin && d2 >= pIni) {
            overlaps.push({
              id_empleado: co.id_empleado,
              nombre: co.nombre_completo,
              rango: per.rango_texto,
              dias_nat: per.dias_naturales,
              dias_lab: per.dias_habiles || per.dias_laborables_cuadrante || per.dias_naturales,
              proyecto: (co.proyectos_asignados && co.proyectos_asignados[0] && co.proyectos_asignados[0].denominacion) || 'Centro habitual'
            });
          }
        }
      });
    });

    return overlaps;
  }

  // Render del Modal de Planificación y Concesión de Vacaciones
  function renderPlanVacationModal() {
    const allRaw = getAllWorkersRaw();
    const w = allRaw.find(x => x.id_empleado === ExplorerState.planModalWorkerId);
    if (!w) return '';

    const md = ExplorerState.planModalData;
    const calc = getDaysBetween(md.fechaInicio, md.fechaFin);
    const overlaps = getProjectOverlaps(w, md.fechaInicio, md.fechaFin);
    const remainingAfter = (w.vac_restantes || 0) - calc.lab;
    const exceeds = calc.lab > (w.vac_restantes || 0);
    const proyNombre = (w.proyectos_asignados && w.proyectos_asignados[0]) ? w.proyectos_asignados[0].denominacion : 'Centro habitual';

    return `
      <div class="hovac-modal-backdrop" onclick="if(event.target === this) window.HOVacacionesExplorer.closePlanVacationModal();">
        <div class="hovac-modal-window">
          <!-- CABECERA DEL MODAL -->
          <div class="hovac-modal-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:24px;">🏖️</span>
              <div>
                <div style="font-size:15px; font-weight:900; letter-spacing:0.01em;">CONCESIÓN Y PLANIFICACIÓN DE VACACIONES — CUADRANTE SAP HO</div>
                <div style="font-size:11.5px; color:#bae6fd; font-weight:600;">
                  Gestor de Operaciones Limpieza: <b>Alejandro Coscolin Peregrín</b> · Delegación Barcelona (0801)
                </div>
              </div>
            </div>
            <button onclick="window.HOVacacionesExplorer.closePlanVacationModal()" style="background:rgba(255,255,255,0.15); border:none; color:#ffffff; font-size:16px; font-weight:900; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
          </div>

          <!-- CUERPO DEL MODAL -->
          <div class="hovac-modal-body">
            <!-- TARJETA DEL TRABAJADOR Y SALDOS -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px; font-weight:900; color:#0f172a;">${w.nombre_completo}</span>
                  <span style="font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:800; background:#1e3a8a; color:#ffffff; padding:2px 7px; border-radius:5px;">ID: ${w.id_empleado}</span>
                  <span style="font-size:11px; font-weight:800; background:#dcfce7; color:#166534; padding:2px 7px; border-radius:999px;">🟢 Planificable (Sin Baja)</span>
                </div>
                <div style="font-size:11.5px; color:#475569; margin-top:4px;">
                  DNI: <b>${w.dni || '—'}</b> · Tel: <b>${w.telefono || '—'}</b> · Centro: <b>${proyNombre} (${w.id_centro})</b> · Contrato: <b>${w.tipo_contrato} (${w.horas_semana}h/sem)</b>
                </div>
              </div>
              <div style="display:flex; gap:10px; text-align:center;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 12px;">
                  <span style="font-size:10px; color:#64748b; font-weight:800; display:block;">DERECHO ANUAL</span>
                  <b style="font-size:16px; color:#1e3a8a;">${w.vac_totales}d</b>
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 12px;">
                  <span style="font-size:10px; color:#64748b; font-weight:800; display:block;">YA DISFRUTADOS</span>
                  <b style="font-size:16px; color:#0284c7;">${w.vac_tomados}d</b>
                </div>
                <div style="background:${w.vac_restantes > 0 ? '#fff1f2' : '#f0fdf4'}; border:1px solid ${w.vac_restantes > 0 ? '#fecdd3' : '#bbf7d0'}; border-radius:8px; padding:6px 12px;">
                  <span style="font-size:10px; color:${w.vac_restantes > 0 ? '#9f1239' : '#166534'}; font-weight:900; display:block;">FALTAN DISFRUTAR</span>
                  <b style="font-size:16px; color:${w.vac_restantes > 0 ? '#e11d48' : '#15803d'};">${w.vac_restantes}d</b>
                </div>
              </div>
            </div>

            <!-- PLANTILLAS RÁPIDAS DE QUINCENAS (CONVENIO LIMPIEZA) -->
            <div>
              <div style="font-size:11.5px; font-weight:800; color:#334155; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <span>⚡</span> QUINCENAS ESTÁNDAR CONVENIO LIMPIEZA (1 CLIC PARA RELLENAR):
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-07-01', '2026-07-15', '1ª Quincena Julio')">
                  <span>📅</span> 1ª Quincena Julio (01/07 al 15/07)
                </button>
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-07-16', '2026-07-31', '2ª Quincena Julio')">
                  <span>📅</span> 2ª Quincena Julio (16/07 al 31/07)
                </button>
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-08-01', '2026-08-15', '1ª Quincena Agosto')">
                  <span>🏖️</span> 1ª Quincena Agosto (01/08 al 15/08)
                </button>
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-08-16', '2026-08-31', '2ª Quincena Agosto')">
                  <span>🏖️</span> 2ª Quincena Agosto (16/08 al 31/08)
                </button>
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-08-01', '2026-08-31', 'Mes Agosto Completo')">
                  <span>🌴</span> Mes Agosto Completo (01/08 al 31/08)
                </button>
                <button type="button" class="hovac-quick-preset-btn" onclick="window.HOVacacionesExplorer.setPlanPreset('2026-09-01', '2026-09-15', '1ª Quincena Septiembre')">
                  <span>🍂</span> 1ª Quincena Septiembre (01/09 al 15/09)
                </button>
              </div>
            </div>

            <!-- FORMULARIO DE CONCESIÓN -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
              <div>
                <label style="display:block; font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">Tipo de Vacaciones en SAP HO</label>
                <select style="width:100%; height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:700; color:#0f172a;" onchange="window.HOVacacionesExplorer.updatePlanModalField('tipo', this.value)">
                  <option value="VC" ${md.tipo === 'VC' ? 'selected' : ''}>VC · Vacaciones Anuales Reglamentarias</option>
                  <option value="VD" ${md.tipo === 'VD' ? 'selected' : ''}>VD · Vacaciones Exceso Cuadrante / Compensación</option>
                  <option value="VN" ${md.tipo === 'VN' ? 'selected' : ''}>VN · Vacaciones Año Anterior (Pendientes 2025)</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">Fecha Inicio (Primer día de ausencia)</label>
                <input type="date" value="${md.fechaInicio}" style="width:100%; height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:700; color:#0f172a;" onchange="window.HOVacacionesExplorer.updatePlanModalField('fechaInicio', this.value)">
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">Fecha Fin (Último día de vacaciones)</label>
                <input type="date" value="${md.fechaFin}" style="width:100%; height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:700; color:#0f172a;" onchange="window.HOVacacionesExplorer.updatePlanModalField('fechaFin', this.value)">
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">Plan de Cobertura de Limpieza</label>
                <select style="width:100%; height:32px; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; font-size:12px; font-weight:700; color:#0f172a;" onchange="window.HOVacacionesExplorer.updatePlanModalField('cobertura', this.value)">
                  <option value="sin_suplente" ${md.cobertura === 'sin_suplente' ? 'selected' : ''}>Auto-cobertura (Equipo del centro redistribuye tareas)</option>
                  <option value="suplente_retén" ${md.cobertura === 'suplente_retén' ? 'selected' : ''}>Suplente asignado (Contrato de Interinidad / Retén)</option>
                  <option value="cierre_cliente" ${md.cobertura === 'cierre_cliente' ? 'selected' : ''}>Cierre / Reducción pactada por cliente en Agosto</option>
                  <option value="refuerzo" ${md.cobertura === 'refuerzo' ? 'selected' : ''}>Refuerzo Móvil de Brigada SIFU</option>
                </select>
              </div>

              ${md.cobertura === 'suplente_retén' ? `
                <div style="grid-column:1 / -1;">
                  <label style="display:block; font-size:11px; font-weight:800; color:#1e40af; margin-bottom:4px;">Nombre y DNI del Suplente / Interino Asignado</label>
                  <input type="text" placeholder="Ej: JUAN PEREZ LOPEZ (DNI 47123456Z - Bolsa Verano 2026)" value="${md.suplenteNombre || ''}" style="width:100%; height:32px; border:1px solid #93c5fd; background:#eff6ff; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:700; color:#1e3a8a;" oninput="window.HOVacacionesExplorer.updatePlanModalField('suplenteNombre', this.value)">
                </div>
              ` : ''}

              <div style="grid-column:1 / -1;">
                <label style="display:block; font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">Observaciones Operativas para Cuadrante y Nómina</label>
                <input type="text" placeholder="Ej: Solicitud acordada con el operario y cliente. Turno de mañana cubierto." value="${md.notas || ''}" style="width:100%; height:30px; border:1px solid #cbd5e1; border-radius:6px; padding:3px 10px; font-size:11.5px; color:#334155;" oninput="window.HOVacacionesExplorer.updatePlanModalField('notas', this.value)">
              </div>
            </div>

            <!-- COMPUTO MATRICIAL EN DIRECTO Y ADVERTENCIA DE SALDO -->
            <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="font-size:12px; font-weight:800; color:#0369a1;">
                  📊 Cómputo del Periodo Solicitado: <b>${calc.nat} días naturales</b> (${calc.lab} días laborables computables de lunes a viernes)
                </div>
                <div style="font-size:11.5px; color:#0c4a6e; margin-top:2px;">
                  Saldo actual: <b>${w.vac_restantes}d</b>  Consumo: <b style="color:#e11d48;">-${calc.lab}d</b>  Saldo posterior resultante: <b style="color:${remainingAfter < 0 ? '#b91c1c' : '#15803d'};">${remainingAfter} días pendientes</b>
                </div>
              </div>
              <div>
                ${exceeds ? `
                  <span style="background:#fef2f2; color:#991b1b; border:1px solid #fca5a5; padding:4px 10px; border-radius:7px; font-size:11px; font-weight:800; display:inline-block;">
                    ⚠️ Supera el saldo anual disponible (+${Math.abs(remainingAfter)}d exceso)
                  </span>
                ` : `
                  <span style="background:#dcfce7; color:#166534; border:1px solid #86efac; padding:4px 10px; border-radius:7px; font-size:11px; font-weight:800; display:inline-block;">
                    ✅ Saldo suficiente para autorizar
                  </span>
                `}
              </div>
            </div>

            <!-- ADVERTENCIA DE SOLAPES EN EL MISMO CENTRO (COBERTURA SERVICIO LIMPIEZA) -->
            ${overlaps.length > 0 ? `
              <div style="background:#fffbeb; border:1px solid #fde68a; border-left:4px solid #d97706; border-radius:8px; padding:10px 14px;">
                <div style="font-size:12px; font-weight:900; color:#92400e; display:flex; align-items:center; gap:6px;">
                  <span>⚠️</span> ALERTA DE COBERTURA: OTROS LIMPIADORES DE VACACIONES EN EL MISMO CENTRO (${overlaps.length}):
                </div>
                <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                  ${overlaps.map(o => `
                    <div style="font-size:11.5px; color:#78350f; background:#ffffff; border:1px solid #fef3c7; border-radius:6px; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                      <span>👤 <b>${o.nombre}</b> (${o.id_empleado})</span>
                      <span>📅 Coincide: <b>${o.rango}</b> (${o.dias_nat}d nat)</span>
                    </div>
                  `).join('')}
                </div>
                <div style="font-size:11px; color:#b45309; margin-top:6px; font-weight:700;">
                  Como gestor veterano: asegúrate de que el centro no se quede desatendido si ambos están ausentes.
                </div>
              </div>
            ` : `
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 12px; font-size:11.5px; color:#166534; font-weight:700; display:flex; align-items:center; gap:6px;">
                <span>🛡️</span> Cobertura de Centro Segura: Ningún otro compañero del centro coincide de vacaciones en estas mismas fechas.
              </div>
            `}
          </div>

          <!-- PIE DE MODAL / ACCIONES -->
          <div class="hovac-modal-footer">
            <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.closePlanVacationModal()">
              ✕ Cancelar
            </button>
            <div style="display:flex; gap:8px;">
              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.printVacationReceipt('${w.id_empleado}')" title="Generar Solicitud / Justificante para firma de empresa y trabajador">
                <span>📄</span> Imprimir Solicitud Firmada
              </button>
              <button class="hovac-btn-give-vac" style="padding:8px 16px; font-size:12.5px;" onclick="window.HOVacacionesExplorer.saveVacationPlanFromModal()">
                <span>💾</span> Conceder y Grabar en Cuadrante HO
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render del Modal de Auditoría de Cobertura de Centros
  function renderCoverageAuditModal() {
    const allRaw = getAllWorkersRaw();
    const directActivos = allRaw.filter(w => w.es_asignado_directo && w.es_activo && !w.en_baja_it_actual);

    // Agrupar por Proyecto / Centro
    const proyMap = {};
    directActivos.forEach(w => {
      const pList = (w.proyectos_asignados && w.proyectos_asignados.length > 0) ? w.proyectos_asignados : [{ id_proyecto: 'GEN-01', denominacion: 'Servicios Generales' }];
      pList.forEach(p => {
        if (!proyMap[p.id_proyecto]) {
          proyMap[p.id_proyecto] = {
            id: p.id_proyecto,
            nombre: p.denominacion || p.id_proyecto,
            totalPlantilla: 0,
            trabajadores: [],
            vacJulio: [],
            vacAgosto: []
          };
        }
        proyMap[p.id_proyecto].totalPlantilla++;
        proyMap[p.id_proyecto].trabajadores.push(w);

        const hasJulio = (w.fechas_detalle || []).some(fd => fd.mes_num === 7);
        const hasAgosto = (w.fechas_detalle || []).some(fd => fd.mes_num === 8);
        if (hasJulio && !proyMap[p.id_proyecto].vacJulio.some(x => x.id_empleado === w.id_empleado)) {
          proyMap[p.id_proyecto].vacJulio.push(w);
        }
        if (hasAgosto && !proyMap[p.id_proyecto].vacAgosto.some(x => x.id_empleado === w.id_empleado)) {
          proyMap[p.id_proyecto].vacAgosto.push(w);
        }
      });
    });

    let centrosList = Object.values(proyMap).sort((a, b) => b.totalPlantilla - a.totalPlantilla);

    const q = (ExplorerState.coverageSearchQuery || '').toLowerCase().trim();
    if (q) {
      centrosList = centrosList.filter(c => c.nombre.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }

    return `
      <div class="hovac-modal-backdrop" onclick="if(event.target === this) window.HOVacacionesExplorer.toggleCoverageAuditModal();">
        <div class="hovac-modal-window" style="max-width:1100px;">
          <div class="hovac-modal-header" style="background:linear-gradient(90deg, #1e3a8a 0%, #0369a1 100%);">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:24px;">🛡️</span>
              <div>
                <div style="font-size:15px; font-weight:900;">AUDITORÍA DE COBERTURA DE SERVICIOS Y SOLAPES — CENTROS DE LIMPIEZA</div>
                <div style="font-size:11.5px; color:#bae6fd;">
                  Control de descubiertos en verano (Julio y Agosto 2026) · ${centrosList.length} centros analizados
                </div>
              </div>
            </div>
            <button onclick="window.HOVacacionesExplorer.toggleCoverageAuditModal()" style="background:rgba(255,255,255,0.15); border:none; color:#ffffff; font-size:16px; font-weight:900; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
          </div>

          <div style="background:#f8fafc; border-bottom:1px solid #cbd5e1; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#334155;">🔍 Buscar centro:</span>
              <input type="text" placeholder="Filtrar por centro, cliente o ID..." value="${ExplorerState.coverageSearchQuery || ''}" style="height:30px; border:1px solid #cbd5e1; border-radius:6px; padding:3px 10px; font-size:12px; width:260px;" oninput="window.HOVacacionesExplorer.setCoverageSearch(this.value)">
            </div>
            <div style="display:flex; align-items:center; gap:12px; font-size:11.5px; font-weight:700;">
              <span>🟢 Cobertura Óptima (&gt;65%)</span>
              <span>🟡 Atención (50%-65%)</span>
              <span>🔴 Riesgo Descubierto (&lt;50%)</span>
            </div>
          </div>

          <div class="hovac-modal-body" style="max-height:68vh;">
            <div class="hovac-centers-grid">
              ${centrosList.map(c => {
                const awayMax = Math.max(c.vacJulio.length, c.vacAgosto.length);
                const covPct = c.totalPlantilla > 0 ? Math.round(((c.totalPlantilla - awayMax) / c.totalPlantilla) * 100) : 100;
                const statusColor = covPct >= 65 ? '#16a34a' : (covPct >= 50 ? '#d97706' : '#dc2626');
                const statusBg = covPct >= 65 ? '#f0fdf4' : (covPct >= 50 ? '#fffbeb' : '#fef2f2');
                const statusBorder = covPct >= 65 ? '#86efac' : (covPct >= 50 ? '#fde68a' : '#fca5a5');

                return `
                  <div class="hovac-center-card" style="border-top:4px solid ${statusColor};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                      <div>
                        <div style="font-size:13px; font-weight:900; color:#0f172a;">${c.nombre}</div>
                        <div style="font-size:10.5px; font-family:'JetBrains Mono', monospace; color:#64748b;">${c.id}</div>
                      </div>
                      <span style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusBorder}; padding:3px 8px; border-radius:999px; font-size:11px; font-weight:900;">
                        ${covPct}% Cobertura
                      </span>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:6px; text-align:center; font-size:11px;">
                      <div>
                        <span style="color:#64748b; font-size:9.5px; font-weight:700; display:block;">PLANTILLA</span>
                        <b>${c.totalPlantilla} operarios</b>
                      </div>
                      <div>
                        <span style="color:#64748b; font-size:9.5px; font-weight:700; display:block;">VAC. JULIO</span>
                        <b style="color:${c.vacJulio.length > 0 ? '#0284c7' : '#64748b'};">${c.vacJulio.length} ausentes</b>
                      </div>
                      <div>
                        <span style="color:#64748b; font-size:9.5px; font-weight:700; display:block;">VAC. AGOSTO</span>
                        <b style="color:${c.vacAgosto.length > 0 ? '#e11d48' : '#64748b'};">${c.vacAgosto.length} ausentes</b>
                      </div>
                    </div>

                    ${(c.vacJulio.length > 0 || c.vacAgosto.length > 0) ? `
                      <div style="font-size:11px; color:#475569; display:flex; flex-direction:column; gap:3px;">
                        ${c.vacJulio.length > 0 ? `
                          <div style="background:#eff6ff; padding:4px 8px; border-radius:5px;">
                            🏖️ <b>Julio:</b> ${c.vacJulio.map(x => x.nombre_completo.split(' ')[0]).join(', ')}
                          </div>
                        ` : ''}
                        ${c.vacAgosto.length > 0 ? `
                          <div style="background:#fff1f2; padding:4px 8px; border-radius:5px;">
                            🏖️ <b>Agosto:</b> ${c.vacAgosto.map(x => x.nombre_completo.split(' ')[0]).join(', ')}
                          </div>
                        ` : ''}
                      </div>
                    ` : `
                      <div style="font-size:10.5px; color:#94a3b8; font-style:italic;">
                        Aún no hay vacaciones de verano grabadas en este centro.
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="hovac-modal-footer">
            <span style="font-size:11px; color:#64748b;">
              Consejo Gestor: Para cualquier centro en 🔴 o 🟡, asigna suplentes con contrato de interinidad antes del 15 de Junio.
            </span>
            <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.toggleCoverageAuditModal()">
              Cerrar Auditoría
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Generar e Imprimir Justificante / Solicitud Oficial de Vacaciones Grupo SIFU
  function printVacationReceipt(empId, periodId) {
    const allRaw = getAllWorkersRaw();
    const w = allRaw.find(x => x.id_empleado === empId);
    if (!w) return;

    let period = null;
    if (periodId) {
      period = (w.periodos_vacaciones || []).find(p => p.id_periodo === periodId);
    }
    if (!period && w.periodos_vacaciones && w.periodos_vacaciones.length > 0) {
      period = w.periodos_vacaciones[0];
    }

    const proyNombre = (w.proyectos_asignados && w.proyectos_asignados[0]) ? w.proyectos_asignados[0].denominacion : 'Centro Habitual';
    const fechaDoc = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const diasNat = period ? period.dias_naturales : w.vac_tomados;
    const diasLab = period ? (period.dias_habiles || period.dias_laborables_cuadrante || period.dias_naturales) : w.vac_tomados;
    const codTipo = period ? (period.codigo_tipo || 'VC') : 'VC';
    const tipoLabel = period ? (period.etiqueta_tipo || 'Vacaciones Anuales') : 'Vacaciones Anuales';

    const win = window.open('', '_blank', 'width=900,height=950');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Concesión Oficial de Vacaciones — ${w.nombre_completo} (${w.id_empleado})</title>
        <style>
          @page { size: A4 portrait; margin: 18mm; }
          body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px; }
          .logo-box { font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
          .logo-sub { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
          .doc-title { text-align: center; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 18px 0; letter-spacing: 0.5px; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; background: #ffffff; }
          .card-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .table th, .table td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px; }
          .table th { background: #f1f5f9; font-weight: 800; color: #334155; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 45px; page-break-inside: avoid; }
          .sig-box { border: 1px dashed #94a3b8; border-radius: 8px; height: 110px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; font-size: 10.5px; color: #64748b; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px; display:flex; gap:10px;">
          <button onclick="window.print()" style="background:#1d4ed8; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:800; cursor:pointer; font-size:12px;">🖨️ Imprimir / Guardar como PDF</button>
          <button onclick="window.close()" style="background:#e2e8f0; color:#0f172a; border:none; padding:8px 14px; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px;">Cerrar</button>
        </div>

        <div class="header">
          <div>
            <div class="logo-box">GRUPO SIFU</div>
            <div class="logo-sub">Centro Especial de Empleo · Delegación 0801 Barcelona</div>
          </div>
          <div style="text-align:right; font-size:11px; color:#475569;">
            <div><b>Fecha emisión:</b> ${fechaDoc}</div>
            <div><b>Ref:</b> VAC-2026-${w.id_empleado}</div>
          </div>
        </div>

        <div class="doc-title">
          DOCUMENTO OFICIAL DE COMUNICACIÓN Y CONCESIÓN DE VACACIONES
        </div>

        <div class="card">
          <div class="card-title">1. DATOS DEL TRABAJADOR / TRABAJADORA</div>
          <div class="grid-2">
            <div><b>Apellidos y Nombre:</b> ${w.nombre_completo}</div>
            <div><b>DNI / NIE:</b> ${w.dni || '—'}</div>
            <div><b>ID Empleado SAP S/4HANA:</b> ${w.id_empleado}</div>
            <div><b>Centro / Servicio Habitual:</b> ${proyNombre} (${w.id_centro})</div>
            <div><b>Tipo de Contrato:</b> ${w.tipo_contrato} (${w.horas_semana} horas/semana)</div>
            <div><b>Gestor Responsable de Operaciones:</b> Alejandro Coscolin Peregrín</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">2. PERÍODO AUTORIZADO DE VACACIONES (CONVENIO COLECTIVO)</div>
          <table class="table">
            <thead>
              <tr>
                <th>Tipo de Permiso</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Días Naturales</th>
                <th>Días Laborables Computables</th>
                <th>Estado SAP HO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${tipoLabel} (${codTipo})</b></td>
                <td><b>${period ? period.fecha_inicio : '01/08/2026'}</b></td>
                <td><b>${period ? period.fecha_fin : '15/08/2026'}</b></td>
                <td style="text-align:center;"><b>${diasNat} días</b></td>
                <td style="text-align:center; color:#1e40af;"><b>${diasLab} días</b></td>
                <td style="text-align:center;"><span style="color:#16a34a; font-weight:bold;">🟢 AUTORIZADO</span></td>
              </tr>
            </tbody>
          </table>
          <div style="font-size:10.5px; color:#64748b; margin-top:8px;">
            El presente período se concede conforme al Convenio Colectivo de Limpieza de Edificios y Locales de Cataluña y el acuerdo del cuadrante anual 2026.
          </div>
        </div>

        <div class="card">
          <div class="card-title">3. SALDO ANUAL Y CONTROL DE VACACIONES 2026</div>
          <div class="grid-2">
            <div>Días Anuales según Convenio: <b>${w.vac_totales} días laborables</b></div>
            <div>Días Disfrutados Anteriores: <b>${Math.max(0, (w.vac_tomados || 0) - (period ? (period.dias_habiles || period.dias_laborables_cuadrante || 0) : 0))} días</b></div>
            <div>Días computados en esta solicitud: <b>${diasLab} días laborables</b></div>
            <div>Saldo pendiente restante para 2026: <b style="color:#e11d48;">${w.vac_restantes} días pendientes</b></div>
          </div>
        </div>

        <div style="font-size:10px; color:#64748b; margin-top:10px;">
          * Ambas partes manifiestan su conformidad con las fechas indicadas para su registro e imputación en el sistema oficial de cuadrantes de SAP S/4HANA HO (ZPS_HOPER_SRV).
        </div>

        <div class="signatures">
          <div class="sig-box">
            <b>POR LA EMPRESA (GRUPO SIFU)</b>
            <span>Firma del Gestor de Operaciones y Sello</span>
            <div style="border-top:1px solid #cbd5e1; padding-top:4px;"><b>Alejandro Coscolin Peregrín</b></div>
          </div>
          <div class="sig-box">
            <b>EL / LA TRABAJADOR/A</b>
            <span>Firma de Recibí y Conforme</span>
            <div style="border-top:1px solid #cbd5e1; padding-top:4px;"><b>${w.nombre_completo}</b></div>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  // Función Principal expuesta para girona_pro_app.js
  window.renderHOVacacionesDashboardView = function () {
    const payload = getPayload();
    const workers = getFilteredAndSortedWorkers();
    const allRaw = getAllWorkersRaw();
    const directActivos = allRaw.filter(w => w.es_asignado_directo && w.es_activo);
    const directSinBaja = directActivos.filter(w => !w.en_baja_it_actual);
    const directConBaja = directActivos.filter(w => !!w.en_baja_it_actual);

    if (!ExplorerState.selectedWorkerId && workers.length > 0) {
      ExplorerState.selectedWorkerId = workers[0].id_empleado;
    }

    const totalDiasAnuales = directActivos.reduce((acc, w) => acc + (w.vac_totales || 0), 0);
    const totalDiasImputados = directActivos.reduce((acc, w) => acc + (w.vac_tomados || 0), 0);
    const totalDiasFaltan = directActivos.reduce((acc, w) => acc + (w.vac_restantes || 0), 0);

    // Métricas específicas de personal SIN BAJA IT (Planificables) vs EN BAJA IT (No planificables)
    const diasAnualesSinBaja = directSinBaja.reduce((acc, w) => acc + (w.vac_totales || 0), 0);
    const diasFaltanSinBaja = directSinBaja.reduce((acc, w) => acc + (w.vac_restantes || 0), 0);
    const countPendientesSinBaja = directSinBaja.filter(w => w.vac_restantes > 0).length;
    const countSinImputarSinBaja = directSinBaja.filter(w => w.vac_tomados === 0 && w.vac_restantes > 0 && (w.dias_vc_naturales_2026 || 0) === 0).length;
    const pctSinBaja = diasAnualesSinBaja > 0 ? ((totalDiasImputados / diasAnualesSinBaja) * 100).toFixed(1) : '0.0';

    const diasFaltanConBaja = directConBaja.reduce((acc, w) => acc + (w.vac_restantes || 0), 0);

    const countCompletadas = directActivos.filter(w => w.vac_restantes <= 0 && w.vac_totales > 0).length;
    const countConFechas = directActivos.filter(w => (w.total_periodos || 0) > 0).length;

    const openedWorker = ExplorerState.openedWorkerId
      ? allRaw.find(w => w.id_empleado === ExplorerState.openedWorkerId)
      : null;

    const openedPeriod = (openedWorker && ExplorerState.openedPeriodId)
      ? (openedWorker.periodos_vacaciones || []).find(p => p.id_periodo === ExplorerState.openedPeriodId)
      : null;

    const diasFaltanEnVista = workers.reduce((acc, w) => acc + (w.vac_restantes || 0), 0);
    const bf = ExplorerState.bajaFilter;

    return `
      <div class="hovac-explorer-wrap ${ExplorerState.isMaximized ? 'is-maximized' : ''}">
        <div class="hovac-win-frame">

          <!-- 1. BARRA DE TÍTULO DE VENTANA WINDOWS 11 -->
          <div class="hovac-win-titlebar">
            <div class="hovac-win-title-left">
              <div class="hovac-win-icon">🏖️</div>
              <div>
                <div class="hovac-win-title-text">
                  <span>2.4 EXPLORADOR DE VACACIONES TRABAJADORES — SAP S/4HANA HO</span>
                  <span class="hovac-win-badge-live">
                    <span>●</span> 100% DATOS OFICIALES SAP HO EN TIEMPO REAL
                  </span>
                </div>
                <div class="hovac-win-subtitle">
                  Responsable en SAP HO: <b>${(GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter) || GESTORES_BCN_VAC[0]).nombre}</b> · Delegación 0801 Barcelona
                </div>
              </div>
            </div>

            <div class="hovac-win-title-right">
              <span style="font-size:11px; color:#e0f2fe; background:rgba(255,255,255,0.12); padding:4px 10px; border-radius:6px;">
                🕒 Última lectura SAP HO: <b>${payload.timestamp || 'En vivo'}</b>
              </span>
              <button onclick="window.HOVacacionesExplorer.toggleMaximize()"
                      style="background:${ExplorerState.isMaximized ? '#f59e0b' : 'rgba(255,255,255,0.18)'}; color:#ffffff; border:1px solid rgba(255,255,255,0.35); border-radius:6px; padding:5px 11px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px;"
                      title="${ExplorerState.isMaximized ? 'Salir de Pantalla Completa' : 'Maximizar Explorador a Pantalla Completa (100%)'}">
                <span>${ExplorerState.isMaximized ? '🗗' : '🗖'}</span>
                <span>${ExplorerState.isMaximized ? 'Restaurar Ventana' : 'Maximizar Ventana (100%)'}</span>
              </button>
            </div>
          </div>

          <!-- BARRA EJECUTIVA MULTI-GESTOR BARCELONA (0801) -->
          <div style="background:#ffffff; border-bottom:1px solid #cbd5e1; padding:8px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">👔 Gestor Barcelona (0801):</span>
              <select id="hovac-select-gestor" style="height:32px; border:2px solid #0284c7; background:#ffffff; color:#0f172a; font-weight:800; border-radius:8px; padding:2px 12px; font-size:12px; cursor:pointer;" onchange="window.HOVacacionesExplorer.setGestorFilter(this.value)">
                ${GESTORES_BCN_VAC.map(g => `<option value="${g.id}" ${ExplorerState.gestorFilter === g.id ? 'selected' : ''}>${g.nombre}</option>`).join('')}
              </select>
            </div>
            <div style="font-size:11.5px; color:#475569; font-weight:700; display:flex; align-items:center; gap:8px;">
              <span>📍 Delegación 0801 · Barcelona</span>
              <span>·</span>
              <span style="color:#0284c7;">Gestor: <b>${(GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter) || GESTORES_BCN_VAC[0]).nombre}</b></span>
            </div>
          </div>

          <!-- 2. RIBBON / BARRA DE COMANDOS DEL EXPLORADOR DE WINDOWS -->
          <div class="hovac-command-bar">
            <div class="hovac-cmd-group">
              <button class="hovac-cmd-btn primary" onclick="window.HOVacacionesExplorer.syncAllLive(false)" ${ExplorerState.isSyncing ? 'disabled' : ''} title="Conectar ahora mismo en directo a SAP S/4HANA (EmpleadoSet + ExcelEmpleadoSet) y refrescar todas las vacaciones y fechas">
                <span>${ExplorerState.isSyncing ? '⏳' : '🔄'}</span>
                <span>${ExplorerState.isSyncing ? 'Sincronizando con SAP HO...' : 'Sincronizar 100% con SAP HO'}</span>
              </button>

              <button onclick="window.HOVacacionesExplorer.toggleAutoSync()"
                      style="border:1px solid ${ExplorerState.autoSyncEnabled ? '#86efac' : '#cbd5e1'}; background:${ExplorerState.autoSyncEnabled ? '#dcfce7' : '#f1f5f9'}; color:${ExplorerState.autoSyncEnabled ? '#166534' : '#475569'}; padding:5px 10px; border-radius:7px; font-size:11px; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:5px;"
                      title="Sincronización automática en tiempo real: cuando imputas vacaciones en SAP HO y vuelves a esta ventana (o cada 60s), se actualiza solo, descuenta los días y mueve al trabajador de carpeta automáticamente.">
                <span>${ExplorerState.autoSyncEnabled ? '⚡' : '⏸️'}</span>
                <span>Auto-Sync Tiempo Real: ${ExplorerState.autoSyncEnabled ? 'ON (Al volver de HO / 60s)' : 'PAUSADO'}</span>
              </button>

              <div class="hovac-cmd-divider"></div>

              <!-- FILTRO RÁPIDO DE DISPONIBILIDAD / BAJA IT (PLANIFICACIÓN DE VACACIONES) -->
              <div style="display:inline-flex; align-items:center; background:#e2e8f0; padding:3px; border-radius:9px; gap:3px; border:1px solid #cbd5e1;">
                <span style="font-size:10.5px; font-weight:900; color:#334155; padding:0 7px;">FILTRO BAJA IT:</span>
                <button onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja')"
                        style="border:none; cursor:pointer; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:900; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; ${bf === 'sin_baja' ? 'background:#16a34a; color:#ffffff; box-shadow:0 2px 5px rgba(22,163,74,0.3);' : 'background:transparent; color:#334155;'}"
                        title="Ver solo los trabajadores que NO están de baja IT y a los que SÍ puedes planificar vacaciones (${directSinBaja.length} trabajadores · ${diasFaltanSinBaja} días pendientes)">
                  <span>🟢</span>
                  <span>Sin Baja · Planificables (${directSinBaja.length})</span>
                </button>
                <button onclick="window.HOVacacionesExplorer.setBajaFilter('con_baja')"
                        style="border:none; cursor:pointer; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:900; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; ${bf === 'con_baja' ? 'background:#dc2626; color:#ffffff; box-shadow:0 2px 5px rgba(220,38,38,0.3);' : 'background:transparent; color:#334155;'}"
                        title="Ver solo los trabajadores que están de Baja IT en SAP HO y no se pueden planificar hasta el alta (${directConBaja.length} trabajadores · ${diasFaltanConBaja} días retenidos)">
                  <span>🩺</span>
                  <span>En Baja IT (${directConBaja.length})</span>
                </button>
                <button onclick="window.HOVacacionesExplorer.setBajaFilter('todos')"
                        style="border:none; cursor:pointer; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:900; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; ${bf === 'todos' ? 'background:#1e40af; color:#ffffff; box-shadow:0 2px 5px rgba(30,64,175,0.3);' : 'background:transparent; color:#334155;'}"
                        title="Ver todos los trabajadores juntos (con y sin baja IT)">
                  <span>👥</span>
                  <span>Todos (${directActivos.length})</span>
                </button>
              </div>

              <div class="hovac-cmd-divider"></div>

              <button class="hovac-cmd-btn ${ExplorerState.viewMode === 'details' && !openedWorker ? 'active' : ''}" onclick="window.HOVacacionesExplorer.setViewMode('details')" title="Vista Detalles con columnas estilo Explorador de Windows">
                <span>📋</span> Vista Detalles
              </button>
              <button class="hovac-cmd-btn ${ExplorerState.viewMode === 'folders' && !openedWorker ? 'active' : ''}" onclick="window.HOVacacionesExplorer.setViewMode('folders')" title="Vista de Carpetas e Iconos Grandes estilo Explorador de Windows">
                <span>🗂️</span> Vista Carpetas
              </button>
              <button class="hovac-cmd-btn ${ExplorerState.viewMode === 'calendar' && !openedWorker ? 'active' : ''}" onclick="window.HOVacacionesExplorer.setViewMode('calendar')" title="Mapa Anual Ene-Dic 2026 de Vacaciones Imputadas en SAP HO">
                <span>📅</span> Mapa Anual 2026
              </button>

              <div class="hovac-cmd-divider"></div>

              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.expandAllRows()" title="Desplegar todas las carpetas de fechas en la tabla">
                <span>➕</span> Desplegar
              </button>
              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.collapseAllRows()" title="Contraer todas las filas desplegadas">
                <span>➖</span> Contraer
              </button>

              <button class="hovac-cmd-btn ${ExplorerState.showTreePane ? 'active' : ''}" onclick="window.HOVacacionesExplorer.toggleTreePane()" title="Mostrar u ocultar el árbol de carpetas izquierdo">
                <span>📁</span> Árbol: ${ExplorerState.showTreePane ? 'ON' : 'OFF'}
              </button>
              <button class="hovac-cmd-btn ${ExplorerState.showPreviewPane ? 'active' : ''}" onclick="window.HOVacacionesExplorer.togglePreviewPane()" title="Mostrar u ocultar el panel lateral derecho de vista previa">
                <span>🪟</span> Panel Derecha: ${ExplorerState.showPreviewPane ? 'ON' : 'OFF'}
              </button>
              <button class="hovac-cmd-btn ${ExplorerState.showCoverageAuditModal ? 'active' : ''}" onclick="window.HOVacacionesExplorer.toggleCoverageAuditModal()" title="Auditoría de Cobertura y Detección de Conflictos en Centros de Limpieza (Julio y Agosto)" style="background:#eff6ff; color:#1e40af; border-color:#93c5fd; font-weight:800;">
                <span>🛡️</span> Cobertura Centros
              </button>
            </div>

            <div class="hovac-cmd-group">
              <button class="hovac-cmd-btn excel" onclick="window.HOVacacionesExplorer.exportExcelReport()" title="Descargar Informe Oficial en Excel (.xls) con el filtro actual">
                <span>📊</span> Descargar Informe Excel (.xls)
              </button>
              <button class="hovac-cmd-btn pdf" onclick="window.HOVacacionesExplorer.exportPrintablePDFReport()" title="Generar e Imprimir Informe Ejecutivo PDF de Vacaciones SAP HO">
                <span>📄</span> Informe PDF / Imprimir
              </button>
              <button class="hovac-cmd-btn" onclick="window.HOVacacionesExplorer.exportCSVReport()" title="Descargar CSV compatible con SAP">
                <span>📥</span> CSV
              </button>
            </div>
          </div>

          <!-- 3. BARRA DE DIRECCIONES (BREADCRUMB) Y BUSCADOR DE WINDOWS EXPLORER -->
          <div class="hovac-address-row">
            <div class="hovac-nav-arrows">
              <button class="hovac-nav-btn" onclick="window.HOVacacionesExplorer.goBack()" ${ExplorerState.historyIndex <= 0 ? 'disabled' : ''} title="Atrás">←</button>
              <button class="hovac-nav-btn" onclick="window.HOVacacionesExplorer.goForward()" ${ExplorerState.historyIndex >= ExplorerState.history.length - 1 ? 'disabled' : ''} title="Adelante">→</button>
              <button class="hovac-nav-btn" onclick="window.HOVacacionesExplorer.goUp()" ${!openedWorker && ExplorerState.currentFolder === 'all' ? 'disabled' : ''} title="Subir un nivel">↑</button>
            </div>

            <div class="hovac-breadcrumb-box">
              <span class="hovac-crumb" onclick="window.HOVacacionesExplorer.navigateFolder('all')">
                <span>💻</span> SAP S/4HANA HO
              </span>
              <span class="hovac-crumb-sep">▸</span>
              <span class="hovac-crumb" onclick="window.HOVacacionesExplorer.navigateFolder('all')">
                <span>👤</span> ${(GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter) || GESTORES_BCN_VAC[0]).nombre_corto}
              </span>
              <span class="hovac-crumb-sep">▸</span>
              <span class="hovac-crumb ${!openedWorker && ExplorerState.currentFolder === 'all' ? 'current' : ''}" onclick="window.HOVacacionesExplorer.navigateFolder('all')" style="${bf === 'sin_baja' ? 'background:#dcfce7; color:#166534;' : bf === 'con_baja' ? 'background:#fee2e2; color:#991b1b;' : ''}">
                ${getBajaFilterLabel(bf)}
              </span>
              ${ExplorerState.currentFolder !== 'all' ? `
                <span class="hovac-crumb-sep">▸</span>
                <span class="hovac-crumb ${!openedWorker ? 'current' : ''}" onclick="window.HOVacacionesExplorer.closeWorkerFolder()">
                  ${getFolderTitle(ExplorerState.currentFolder)}
                </span>
              ` : ''}
              ${openedWorker ? `
                <span class="hovac-crumb-sep">▸</span>
                <span class="hovac-crumb ${!openedPeriod ? 'current' : ''}" onclick="window.HOVacacionesExplorer.openWorkerPeriod('${openedWorker.id_empleado}', null)">
                  <span>📂</span> ${openedWorker.nombre_completo} (${openedWorker.id_empleado})
                </span>
              ` : ''}
              ${openedPeriod ? `
                <span class="hovac-crumb-sep">▸</span>
                <span class="hovac-crumb current">
                  <span>🗓️</span> ${openedPeriod.rango_texto}
                </span>
              ` : ''}
            </div>

            <div class="hovac-search-box">
              <span class="hovac-search-icon">🔍</span>
              <input type="text" id="hovac-search-input" value="${ExplorerState.searchQuery}" placeholder="Buscar en explorador (nombre, ID, fecha, SVO)...">
              ${ExplorerState.searchQuery ? `<button class="hovac-search-clear" onclick="window.HOVacacionesExplorer.setSearch('')">×</button>` : ''}
            </div>
          </div>

          ${(ExplorerState.recentChanges && ExplorerState.recentChanges.length > 0) ? `
            <!-- BANNER DE CAMBIOS DETECTADOS EN TIEMPO REAL DESDE SAP HO -->
            <div style="background:#ecfdf5; border-bottom:2px solid #10b981; padding:8px 16px; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
              <div style="display:flex; flex-direction:column; gap:4px; font-size:11.5px; color:#065f46;">
                <div style="font-weight:900; display:flex; align-items:center; gap:6px; color:#047857;">
                  <span>⚡ CAMBIOS DE VACACIONES DETECTADOS EN VIVO DESDE SAP S/4HANA HO (${ExplorerState.recentChanges.length}):</span>
                </div>
                ${ExplorerState.recentChanges.slice(0, 3).map(ch => `
                  <div style="background:#ffffff; border:1px solid #a7f3d0; border-radius:6px; padding:4px 9px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-size:10.5px; color:#64748b; font-weight:700;">[${ch.hora}]</span>
                    <b style="color:#0f172a;">${ch.nombre} (${ch.id_empleado})</b>
                    <span>· Imputados HO: <b>${ch.prev_tomados}d → ${ch.new_tomados}d</b></span>
                    <span>· Faltan por disfrutar: <b style="color:${ch.new_restantes <= 0 ? '#16a34a' : '#e11d48'};">${ch.prev_restantes}d → ${ch.new_restantes}d</b></span>
                    <span style="color:#0369a1; font-weight:700;">· Fechas: ${ch.fechas}</span>
                    ${ch.transicion ? `<span style="background:#dcfce7; color:#166534; font-weight:800; padding:1px 7px; border-radius:999px; font-size:10.5px;">${ch.transicion}</span>` : ''}
                  </div>
                `).join('')}
              </div>
              <button onclick="window.HOVacacionesExplorer.clearRecentChanges()" style="background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                ✕ Ocultar aviso
              </button>
            </div>
          ` : ExplorerState.lastSyncInfoMsg ? `
            <div style="background:#f0f9ff; border-bottom:1px solid #bae6fd; padding:5px 16px; display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#0369a1; font-weight:700;">
              <span>${ExplorerState.lastSyncInfoMsg}</span>
              <button onclick="window.HOVacacionesExplorer.clearRecentChanges()" style="background:transparent; border:none; color:#0369a1; font-weight:800; cursor:pointer;">✕</button>
            </div>
          ` : ''}

          <!-- 4. STRIP DE KPIs EN TIEMPO REAL SAP HO (DESGLOSADO SIN BAJA vs CON BAJA IT) -->
          <div class="hovac-kpi-strip" style="grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));">
            <div class="hovac-kpi-card ${bf === 'sin_baja' && ExplorerState.currentFolder === 'all' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja'); window.HOVacacionesExplorer.navigateFolder('all');"
                 style="border-left:4px solid #16a34a; background:#f0fdf4;">
              <div class="hovac-kpi-top" style="color:#166534;">
                <span>🟢 OPERATIVOS SIN BAJA IT</span>
                <span>PLANIFICABLES</span>
              </div>
              <div class="hovac-kpi-val" style="color:#15803d;">${directSinBaja.length} <small style="font-size:12px; color:#166534;">trabajadores</small></div>
              <div class="hovac-kpi-sub" style="color:#166534;">En activo hoy · Cupo: <b>${diasAnualesSinBaja} días</b></div>
            </div>

            <div class="hovac-kpi-card ${bf === 'sin_baja' && ExplorerState.currentFolder === 'pendientes' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja'); window.HOVacacionesExplorer.navigateFolder('pendientes');"
                 style="border-left:4px solid #e11d48; background:#fff1f2;">
              <div class="hovac-kpi-top" style="color:#9f1239;">
                <span>🚨 FALTAN (SIN BAJA IT)</span>
                <span>🔴 PLANIFICAR</span>
              </div>
              <div class="hovac-kpi-val" style="color:#be123c;">${diasFaltanSinBaja} <small style="font-size:13px;">días</small></div>
              <div class="hovac-kpi-sub" style="color:#9f1239;">En <b>${countPendientesSinBaja} operarios sin baja</b> (${countSinImputarSinBaja} con 0d)</div>
            </div>

            <div class="hovac-kpi-card ${bf === 'con_baja' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('con_baja'); window.HOVacacionesExplorer.navigateFolder('all');"
                 style="border-left:4px solid #dc2626; background:#fef2f2;">
              <div class="hovac-kpi-top" style="color:#991b1b;">
                <span>🩺 EN BAJA IT ACTIVA</span>
                <span>BLOQUEADOS</span>
              </div>
              <div class="hovac-kpi-val" style="color:#b91c1c;">${directConBaja.length} <small style="font-size:12px;">bajas (${diasFaltanConBaja}d)</small></div>
              <div class="hovac-kpi-sub" style="color:#991b1b;">No se pueden planificar hasta el alta</div>
            </div>

            <div class="hovac-kpi-card ${ExplorerState.currentFolder === 'con_fechas' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja'); window.HOVacacionesExplorer.navigateFolder('con_fechas');"
                 style="border-left:4px solid #0284c7;">
              <div class="hovac-kpi-top">
                <span>📅 Ya Imputadas en HO</span>
                <span>⏱️</span>
              </div>
              <div class="hovac-kpi-val" style="color:#0369a1;">${totalDiasImputados} <small style="font-size:12.5px;">días (${pctSinBaja}% s/op.)</small></div>
              <div class="hovac-kpi-sub"><b>${countConFechas} trabajadores</b> con fechas en cuadrante</div>
            </div>

            <div class="hovac-kpi-card ${ExplorerState.currentFolder === 'completadas' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('sin_baja'); window.HOVacacionesExplorer.navigateFolder('completadas');"
                 style="border-left:4px solid #10b981;">
              <div class="hovac-kpi-top">
                <span>✅ 100% Disfrutadas</span>
                <span>OK</span>
              </div>
              <div class="hovac-kpi-val" style="color:#15803d;">${countCompletadas} <small style="font-size:13px;">trabajadores</small></div>
              <div class="hovac-kpi-sub">Les faltan <b>0 días</b> por disfrutar en SAP HO</div>
            </div>

            <div class="hovac-kpi-card ${bf === 'todos' && ExplorerState.currentFolder === 'all' ? 'active-kpi' : ''}"
                 onclick="window.HOVacacionesExplorer.setBajaFilter('todos'); window.HOVacacionesExplorer.navigateFolder('all');"
                 style="border-left:4px solid #1e40af;">
              <div class="hovac-kpi-top">
                <span>👥 Total Global SAP HO</span>
                <span>TODOS</span>
              </div>
              <div class="hovac-kpi-val" style="color:#1e3a8a;">${directActivos.length} <small style="font-size:12px; color:#64748b;">(${totalDiasFaltan}d pend.)</small></div>
              <div class="hovac-kpi-sub">${diasFaltanSinBaja}d sin baja + ${diasFaltanConBaja}d en Baja IT</div>
            </div>
          </div>

          <!-- 5. CUERPO CENTRAL DEL EXPLORADOR DE WINDOWS (100% ANCHO Y SIN RECORTES) -->
          <div class="hovac-explorer-body ${ExplorerState.showPreviewPane ? 'with-preview' : ''} ${!ExplorerState.showTreePane ? 'no-tree' : ''}">
            <!-- Panel Izquierdo: Árbol de Carpetas -->
            ${ExplorerState.showTreePane ? renderLeftFolderTree() : ''}

            <!-- Panel Central: Lista de Archivos/Carpetas o Interior de Carpeta del Trabajador -->
            <div class="hovac-main-pane">
              ${openedWorker
                ? renderWorkerInternalExplorer(openedWorker)
                : ExplorerState.viewMode === 'folders'
                  ? renderFoldersGridView(workers)
                  : ExplorerState.viewMode === 'calendar'
                    ? renderCalendarMatrixView(workers)
                    : renderDetailsTableView(workers)
              }
            </div>

            <!-- Panel Derecho: Inspector de Vista Previa (Opcional / Plegable) -->
            ${ExplorerState.showPreviewPane ? renderRightPreviewPane(workers) : ''}
          </div>

          <!-- 6. BARRA DE ESTADO INFERIOR DE WINDOWS EXPLORER -->
          <div class="hovac-statusbar">
            <div class="hovac-statusbar-left">
              <span>📁 <b>${workers.length}</b> trabajadores mostrados (${getBajaFilterLabel(bf)})</span>
              <span>|</span>
              <span>🔴 Días que faltan por disfrutar en esta vista: <b style="color:#e11d48;">${diasFaltanEnVista} días</b></span>
              <span>|</span>
              <span>✅ Días imputados en esta vista: <b style="color:#0284c7;">${workers.reduce((a, w) => a + (w.vac_tomados || 0), 0)} días</b></span>
            </div>
            <div class="hovac-statusbar-right">
              <span>🟢 Fuente: <b>100% SAP S/4HANA OData (ZPS_HOPER_SRV · EmpleadoSet + ExcelEmpleadoSet)</b></span>
            </div>
          </div>

        </div>

        ${ExplorerState.planModalWorkerId ? renderPlanVacationModal() : ''}
        ${ExplorerState.showCoverageAuditModal ? renderCoverageAuditModal() : ''}
      </div>
    `;
  };

  // ============================================================================
  // CONTROLADOR PÚBLICO DEL EXPLORADOR DE WINDOWS 2.4
  // ============================================================================
  window.HOVacacionesExplorer = {
    setBajaFilter(mode) {
      ExplorerState.bajaFilter = mode;
      ExplorerState.openedWorkerId = null;
      ExplorerState.openedPeriodId = null;
      pushHistory(ExplorerState.currentFolder, null, null);
      const list = getFilteredAndSortedWorkers();
      if (list.length > 0) {
        ExplorerState.selectedWorkerId = list[0].id_empleado;
      }
      refreshUI();
      this._attachSearchListener();
    },

    toggleMaximize() {
      ExplorerState.isMaximized = !ExplorerState.isMaximized;
      refreshUI();
      this._attachSearchListener();
    },

    toggleTreePane() {
      ExplorerState.showTreePane = !ExplorerState.showTreePane;
      refreshUI();
      this._attachSearchListener();
    },

    togglePreviewPane() {
      ExplorerState.showPreviewPane = !ExplorerState.showPreviewPane;
      refreshUI();
      this._attachSearchListener();
    },

    navigateFolder(folderKey) {
      ExplorerState.currentFolder = folderKey;
      ExplorerState.openedWorkerId = null;
      ExplorerState.openedPeriodId = null;
      pushHistory(folderKey, null, null);
      const list = getFilteredAndSortedWorkers();
      if (list.length > 0) {
        ExplorerState.selectedWorkerId = list[0].id_empleado;
      }
      refreshUI();
      this._attachSearchListener();
    },

    selectWorker(empId) {
      ExplorerState.selectedWorkerId = empId;
      if (!ExplorerState.showPreviewPane) {
        ExplorerState.expandedRows[empId] = !ExplorerState.expandedRows[empId];
      }
      refreshUI();
      this._attachSearchListener();
    },

    openWorkerFolder(empId) {
      ExplorerState.selectedWorkerId = empId;
      ExplorerState.openedWorkerId = empId;
      ExplorerState.openedPeriodId = null;
      pushHistory(ExplorerState.currentFolder, empId, null);
      refreshUI();
      this._attachSearchListener();
    },

    openWorkerPeriod(empId, periodId) {
      ExplorerState.selectedWorkerId = empId;
      ExplorerState.openedWorkerId = empId;
      ExplorerState.openedPeriodId = periodId || null;
      pushHistory(ExplorerState.currentFolder, empId, ExplorerState.openedPeriodId);
      refreshUI();
      this._attachSearchListener();
    },

    closeWorkerFolder() {
      ExplorerState.openedWorkerId = null;
      ExplorerState.openedPeriodId = null;
      pushHistory(ExplorerState.currentFolder, null, null);
      refreshUI();
      this._attachSearchListener();
    },

    toggleExpandRow(empId) {
      ExplorerState.expandedRows[empId] = !ExplorerState.expandedRows[empId];
      ExplorerState.selectedWorkerId = empId;
      refreshUI();
      this._attachSearchListener();
    },

    expandAllRows() {
      const workers = getFilteredAndSortedWorkers();
      workers.forEach(w => {
        ExplorerState.expandedRows[w.id_empleado] = true;
      });
      refreshUI();
      this._attachSearchListener();
    },

    collapseAllRows() {
      ExplorerState.expandedRows = {};
      refreshUI();
      this._attachSearchListener();
    },

    setViewMode(mode) {
      ExplorerState.viewMode = mode;
      ExplorerState.openedWorkerId = null;
      ExplorerState.openedPeriodId = null;
      refreshUI();
      this._attachSearchListener();
    },

    setSort(col) {
      if (ExplorerState.sortBy === col) {
        ExplorerState.sortDir = ExplorerState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        ExplorerState.sortBy = col;
        ExplorerState.sortDir = col === 'nombre' || col === 'id_empleado' || col === 'baja_it' ? 'asc' : 'desc';
      }
      refreshUI();
      this._attachSearchListener();
    },

    setSearch(val) {
      ExplorerState.searchQuery = val;
      refreshUI();
      this._attachSearchListener();
      const input = document.getElementById('hovac-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    },

    setColumnFilter(col, val) {
      if (!ExplorerState.columnFilters) ExplorerState.columnFilters = {};
      ExplorerState.columnFilters[col] = val;
      refreshUI();
      this._attachSearchListener();
      setTimeout(() => {
        const el = document.getElementById('hovac-colfilter-' + col);
        if (el) {
          el.focus();
          if (el.setSelectionRange && typeof el.value === 'string') {
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }
      }, 10);
    },

    clearColumnFilters() {
      ExplorerState.columnFilters = {
        nombre: '',
        baja_it: 'todos',
        id_empleado: '',
        proyecto: '',
        vac_totales: 'todos',
        vac_tomados: 'todos',
        vac_restantes: 'todos',
        fechas: ''
      };
      refreshUI();
      this._attachSearchListener();
    },

    goBack() {
      if (ExplorerState.historyIndex > 0) {
        ExplorerState.historyIndex--;
        const st = ExplorerState.history[ExplorerState.historyIndex];
        ExplorerState.currentFolder = st.folder;
        if (st.bajaFilter) ExplorerState.bajaFilter = st.bajaFilter;
        ExplorerState.openedWorkerId = st.workerId;
        ExplorerState.openedPeriodId = st.periodId;
        refreshUI();
        this._attachSearchListener();
      }
    },

    goForward() {
      if (ExplorerState.historyIndex < ExplorerState.history.length - 1) {
        ExplorerState.historyIndex++;
        const st = ExplorerState.history[ExplorerState.historyIndex];
        ExplorerState.currentFolder = st.folder;
        if (st.bajaFilter) ExplorerState.bajaFilter = st.bajaFilter;
        ExplorerState.openedWorkerId = st.workerId;
        ExplorerState.openedPeriodId = st.periodId;
        refreshUI();
        this._attachSearchListener();
      }
    },

    goUp() {
      if (ExplorerState.openedPeriodId) {
        this.openWorkerPeriod(ExplorerState.openedWorkerId, null);
      } else if (ExplorerState.openedWorkerId) {
        this.closeWorkerFolder();
      } else if (ExplorerState.currentFolder !== 'all') {
        this.navigateFolder('all');
      }
    },

    toggleAutoSync() {
      ExplorerState.autoSyncEnabled = !ExplorerState.autoSyncEnabled;
      refreshUI();
      this._attachSearchListener();
    },

    setGestorFilter(gId) {
      ExplorerState.gestorFilter = gId || 'todos';
      ExplorerState.openedWorkerId = null;
      ExplorerState.openedPeriodId = null;
      refreshUI();
      this._attachSearchListener();
    },

    clearRecentChanges() {
      ExplorerState.recentChanges = [];
      ExplorerState.lastSyncInfoMsg = '';
      refreshUI();
      this._attachSearchListener();
    },

    async syncAllLive(silent = false) {
      if (ExplorerState.isSyncing) return;
      ExplorerState.isSyncing = true;
      if (!silent) {
        refreshUI();
      }

      const prevWorkers = JSON.parse(JSON.stringify(getAllWorkersRaw() || []));

      try {
        const res = await fetch('http://127.0.0.1:5005/ho_vacaciones_live?year=2026&gestor=' + encodeURIComponent(ExplorerState.gestorFilter || 'todos') + '&_t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.trabajadores) {
            const changes = detectAndRecordChanges(prevWorkers, data.trabajadores);
            window.HO_VACACIONES_PAYLOAD = data;
            ExplorerState.lastLiveSyncMs = Date.now();
            if (!silent && changes.length === 0) {
              ExplorerState.lastSyncInfoMsg = `✅ Sincronizado 100% en directo con SAP S/4HANA HO (${data.timestamp || new Date().toLocaleTimeString('es-ES')}) — Todos los saldos y fechas están al día.`;
            }
          }
        }
      } catch (e) {
        console.warn('Error sincronizando con SAP HO en vivo:', e);
      } finally {
        ExplorerState.isSyncing = false;
        refreshUI();
        this._attachSearchListener();
      }
    },

    async syncSingleWorkerLive(empId) {
      if (!empId || ExplorerState.syncingWorkerId) return;
      ExplorerState.syncingWorkerId = empId;
      refreshUI();

      const prevWorkers = JSON.parse(JSON.stringify(getAllWorkersRaw() || []));

      try {
        const res = await fetch('http://127.0.0.1:5005/ho_vacaciones_worker?id=' + encodeURIComponent(empId));
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'ok' && data.trabajador) {
            const payload = getPayload();
            const idx = (payload.trabajadores || []).findIndex(w => w.id_empleado === empId);
            if (idx >= 0) {
              data.trabajador.es_asignado_directo = payload.trabajadores[idx].es_asignado_directo;
              payload.trabajadores[idx] = data.trabajador;
              if (data.kpis) payload.kpis = data.kpis;
              payload.timestamp = data.timestamp || new Date().toLocaleString('es-ES');
              const changes = detectAndRecordChanges(prevWorkers, payload.trabajadores);
              ExplorerState.lastLiveSyncMs = Date.now();
              if (changes.length === 0) {
                ExplorerState.lastSyncInfoMsg = `✅ Ficha y cuadrante de ${data.trabajador.nombre_completo} (${empId}) verificados en directo contra SAP S/4HANA HO (${new Date().toLocaleTimeString('es-ES')}).`;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error sincronizando trabajador individual con SAP HO:', e);
      } finally {
        ExplorerState.syncingWorkerId = null;
        refreshUI();
        this._attachSearchListener();
      }
    },

    // Exportar Informe Excel (.xls enriquecido con Resumen + Desglose Día a Día)
    exportExcelReport() {
      const workers = getFilteredAndSortedWorkers();
      const payload = getPayload();
      const fechaHoy = new Date().toLocaleString('es-ES');

      let resumenRowsHtml = workers.map((w, idx) => {
        const proys = (w.proyectos_asignados || []).map(p => `${p.id_proyecto} (${p.denominacion})`).join(' | ');
        const periodosTxt = (w.periodos_vacaciones || []).map(p => `${p.rango_texto} [${p.dias_naturales}d nat / ${p.dias_laborables_cuadrante}d lab - ${p.codigo_tipo}]`).join(' ; ');
        const bgFaltan = w.vac_restantes > 0 ? '#ffe4e6' : '#dcfce7';
        const colorFaltan = w.vac_restantes > 0 ? '#be123c' : '#166534';
        const sitBaja = w.en_baja_it_actual ? 'EN BAJA IT (NO PLANIFICABLE)' : 'OPERATIVO SIN BAJA (PLANIFICABLE)';
        const bgBaja = w.en_baja_it_actual ? '#fee2e2' : '#dcfce7';
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="mso-number-format:'\\@'; font-weight:bold;">${w.id_empleado}</td>
            <td style="font-weight:bold;">${w.nombre_completo}</td>
            <td style="background:${bgBaja}; font-weight:bold;">${sitBaja}</td>
            <td>${w.dni || ''}</td>
            <td>${w.telefono || ''}</td>
            <td>${w.id_centro} - ${w.nom_sociedad}</td>
            <td>${w.tipo_contrato}</td>
            <td>${w.fin_contrato}</td>
            <td>${w.horas_semana}</td>
            <td style="text-align:center; font-weight:bold;">${w.vac_totales}</td>
            <td style="text-align:center; font-weight:bold; color:#0369a1;">${w.vac_tomados}</td>
            <td style="text-align:center; font-weight:bold; background:${bgFaltan}; color:${colorFaltan};">${w.vac_restantes}</td>
            <td style="text-align:center;">${w.pct_disfrutado}%</td>
            <td style="text-align:center;">${w.dias_vc_naturales_2026 || 0}</td>
            <td style="text-align:center;">${w.dias_vc_laborables_2026 || 0}</td>
            <td style="text-align:center;">${w.dias_vn_naturales_2026 || 0}</td>
            <td>${w.estado_vacaciones_label}</td>
            <td>${periodosTxt || 'SIN FECHAS IMPUTADAS EN CUADRANTE 2026'}</td>
            <td>${proys}</td>
          </tr>
        `;
      }).join('');

      let detalleDiasHtml = '';
      workers.forEach(w => {
        (w.fechas_detalle || []).forEach(d => {
          const turnosTxt = (d.turnos || []).map(t => `${t.id_proyecto} (${t.denominacion}) ${t.turno}: ${t.horario} [${t.tipo_imputacion}]`).join(' | ');
          detalleDiasHtml += `
            <tr>
              <td style="mso-number-format:'\\@'; font-weight:bold;">${w.id_empleado}</td>
              <td style="font-weight:bold;">${w.nombre_completo}</td>
              <td>${w.en_baja_it_actual ? 'EN BAJA IT' : 'SIN BAJA'}</td>
              <td>${w.dni || ''}</td>
              <td>${d.fecha_es}</td>
              <td>${d.dia_semana}</td>
              <td>${d.mes_nombre}</td>
              <td style="text-align:center; font-weight:bold;">${d.codigo_tipo}</td>
              <td>${d.etiqueta_tipo}</td>
              <td>${d.es_laborable ? 'SÍ (Laborable con horario)' : 'NO (Descanso / 00:00)'}</td>
              <td>${d.estado}</td>
              <td>${turnosTxt}</td>
            </tr>
          `;
        });
      });

      const htmlDoc = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; }
            .section-title { font-size: 14pt; font-weight: bold; color: #0f172a; margin: 16px 0 8px; }
          </style>
        </head>
        <body>
          <div class="section-title">INFORME OFICIAL EN TIEMPO REAL SAP S/4HANA HO — SECCIÓN 2.4 VACACIONES TRABAJADORES</div>
          <div><b>Responsable SAP HO:</b> ${(GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter) || GESTORES_BCN_VAC[0]).nombre} · <b>Filtro Aplicado:</b> ${getBajaFilterLabel()} · <b>Fecha Extracción HO:</b> ${payload.timestamp || fechaHoy}</div>
          <br/>
          <div class="section-title">1. RESUMEN DE SALDOS Y VACACIONES QUE FALTAN POR DISFRUTAR (${workers.length} TRABAJADORES)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID SAP</th>
                <th>Trabajador</th>
                <th>Disponibilidad / Baja IT</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Centro / Sociedad</th>
                <th>Tipo Contrato</th>
                <th>Fin Contrato</th>
                <th>Horas/Sem</th>
                <th>Días Totales HO</th>
                <th>Días Imputados HO</th>
                <th>FALTAN POR DISFRUTAR HO</th>
                <th>% Disfrutado</th>
                <th>Días Nat. VC Cuadrante</th>
                <th>Días Lab. VC Cuadrante</th>
                <th>Días Año Ant. (VN)</th>
                <th>Situación Vacaciones</th>
                <th>Periodos y Fechas Imputadas en Cuadrante SAP HO (2026)</th>
                <th>Proyectos Asignados en SAP HO</th>
              </tr>
            </thead>
            <tbody>
              ${resumenRowsHtml}
            </tbody>
          </table>

          <div class="section-title">2. DESGLOSE DÍA A DÍA DE TODAS LAS FECHAS DE VACACIONES IMPUTADAS EN SAP HO (2026)</div>
          <table>
            <thead>
              <tr>
                <th>ID SAP</th>
                <th>Trabajador</th>
                <th>Estado IT</th>
                <th>DNI</th>
                <th>Fecha</th>
                <th>Día Semana</th>
                <th>Mes</th>
                <th>Código</th>
                <th>Tipo Asignación HO</th>
                <th>Computable / Laborable</th>
                <th>Estado Fecha</th>
                <th>Proyecto SAP, Turno y Horario en Cuadrante</th>
              </tr>
            </thead>
            <tbody>
              ${detalleDiasHtml}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + htmlDoc], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_SAP_HO_Vacaciones_${ExplorerState.bajaFilter}_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // Exportar CSV Oficial
    exportCSVReport() {
      const workers = getFilteredAndSortedWorkers();
      const headers = [
        'ID_SAP', 'TRABAJADOR', 'DISPONIBILIDAD_BAJA_IT', 'DNI', 'TELEFONO', 'CENTRO', 'SOCIEDAD',
        'TIPO_CONTRATO', 'FIN_CONTRATO', 'VAC_TOTALES_HO', 'VAC_IMPUTADAS_HO',
        'VAC_FALTAN_POR_DISFRUTAR_HO', 'PCT_DISFRUTADO', 'SITUACION',
        'FECHAS_IMPUTADAS_2026', 'PROYECTOS_HO'
      ];
      const lines = [headers.join(';')];
      workers.forEach(w => {
        const proys = (w.proyectos_asignados || []).map(p => `${p.id_proyecto} (${p.denominacion})`).join(' | ');
        const sitBaja = w.en_baja_it_actual ? 'EN_BAJA_IT_NO_PLANIFICABLE' : 'SIN_BAJA_PLANIFICABLE';
        const row = [
          w.id_empleado,
          `"${(w.nombre_completo || '').replace(/"/g, '""')}"`,
          sitBaja,
          w.dni || '',
          w.telefono || '',
          w.id_centro || '',
          `"${(w.nom_sociedad || '').replace(/"/g, '""')}"`,
          w.tipo_contrato || '',
          w.fin_contrato || '',
          w.vac_totales,
          w.vac_tomados,
          w.vac_restantes,
          `${w.pct_disfrutado}%`,
          `"${(w.estado_vacaciones_label || '').replace(/"/g, '""')}"`,
          `"${(w.resumen_fechas || '').replace(/"/g, '""')}"`,
          `"${proys.replace(/"/g, '""')}"`
        ];
        lines.push(row.join(';'));
      });

      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vacaciones_SAP_HO_${ExplorerState.bajaFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // Generar Informe Ejecutivo Imprimible / PDF
    exportPrintablePDFReport() {
      const workers = getFilteredAndSortedWorkers();
      const payload = getPayload();
      const totalAnual = workers.reduce((a, w) => a + (w.vac_totales || 0), 0);
      const totalTom = workers.reduce((a, w) => a + (w.vac_tomados || 0), 0);
      const totalFaltan = workers.reduce((a, w) => a + (w.vac_restantes || 0), 0);

      const win = window.open('', '_blank', 'width=1200,height=850');
      if (!win) return;

      win.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Informe Oficial SAP HO — 2.4 Vacaciones Trabajadores (Alejandro Coscolin)</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11px; }
            .header { background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
            .header h1 { margin: 0; font-size: 16px; }
            .header p { margin: 3px 0 0; font-size: 11px; color: #bae6fd; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
            .kpi b { font-size: 18px; display: block; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; font-size: 10.5px; }
            th { background: #1e3a8a; color: #fff; font-weight: 800; }
            tr:nth-child(even) { background: #f8fafc; }
            .badge-faltan { background: #ffe4e6; color: #be123c; font-weight: 900; text-align: center; }
            .badge-ok { background: #dcfce7; color: #15803d; font-weight: 900; text-align: center; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom:12px; display:flex; gap:10px;">
            <button onclick="window.print()" style="background:#1d4ed8; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:800; cursor:pointer;">🖨️ Imprimir / Guardar como PDF</button>
            <button onclick="window.close()" style="background:#e2e8f0; color:#0f172a; border:none; padding:8px 14px; border-radius:6px; font-weight:700; cursor:pointer;">Cerrar</button>
          </div>
          <div class="header">
            <div>
              <h1>🏖️ INFORME OFICIAL SAP S/4HANA HO — 2.4 VACACIONES TRABAJADORES</h1>
              <p>Responsable: ${(GESTORES_BCN_VAC.find(g => g.id === ExplorerState.gestorFilter) || GESTORES_BCN_VAC[0]).nombre} · Filtro: <b>${getBajaFilterLabel()}</b> · Carpeta: ${getFolderTitle(ExplorerState.currentFolder)}</p>
            </div>
            <div style="text-align:right; font-size:11px;">
              <div><b>Extracción SAP HO:</b> ${payload.timestamp || new Date().toLocaleString('es-ES')}</div>
              <div><b>Fuente:</b> 100% ZPS_HOPER_SRV (EmpleadoSet + ExcelEmpleadoSet)</div>
            </div>
          </div>
          <div class="kpis">
            <div class="kpi"><span>Trabajadores en Informe</span><b style="color:#1e3a8a;">${workers.length} trabajadores</b></div>
            <div class="kpi"><span>Total Días Anuales SAP HO</span><b>${totalAnual} días</b></div>
            <div class="kpi"><span>Total Días Imputados SAP HO</span><b style="color:#0284c7;">${totalTom} días</b></div>
            <div class="kpi" style="background:#fff1f2; border-color:#fecdd3;"><span style="color:#9f1239; font-weight:800;">TOTAL FALTAN POR DISFRUTAR</span><b style="color:#e11d48;">${totalFaltan} días pendientes</b></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID SAP</th>
                <th>Trabajador</th>
                <th>Estado / Baja IT</th>
                <th>DNI / Teléfono</th>
                <th>Centro / Contrato</th>
                <th style="text-align:center;">Totales HO</th>
                <th style="text-align:center;">Imputados HO</th>
                <th style="text-align:center;">FALTAN DISFRUTAR</th>
                <th>Fechas Exactas Imputadas en Cuadrante SAP HO (2026)</th>
                <th>Proyectos Asignados en HO</th>
              </tr>
            </thead>
            <tbody>
              ${workers.map((w, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="font-family:monospace; font-weight:bold;">${w.id_empleado}</td>
                  <td style="font-weight:bold;">${w.nombre_completo}</td>
                  <td style="font-weight:bold; color:${w.en_baja_it_actual ? '#dc2626' : '#16a34a'};">${w.en_baja_it_actual ? '🩺 EN BAJA IT (No planif.)' : '🟢 SIN BAJA (Planificable)'}</td>
                  <td>${w.dni || '—'} · ${w.telefono || '—'}</td>
                  <td>${w.id_centro} · ${w.tipo_contrato} (${w.fin_contrato})</td>
                  <td style="text-align:center; font-weight:bold;">${w.vac_totales}d</td>
                  <td style="text-align:center; font-weight:bold; color:#0284c7;">${w.vac_tomados}d</td>
                  <td class="${w.vac_restantes > 0 ? 'badge-faltan' : 'badge-ok'}">${w.vac_restantes > 0 ? 'Faltan ' + w.vac_restantes + 'd' : '0d (Completado)'}</td>
                  <td>${(w.periodos_vacaciones || []).map(p => `<b>${p.rango_texto}</b> (${p.dias_naturales}d nat/${p.dias_laborables_cuadrante}d lab · ${p.codigo_tipo})`).join(' · ') || '<span style="color:#94a3b8;">Sin fechas imputadas en cuadrante 2026</span>'}</td>
                  <td>${(w.proyectos_asignados || []).map(p => `${p.id_proyecto} (${p.denominacion})`).join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `);
      win.document.close();
    },

    openPlanVacationModal(empId) {
      ExplorerState.planModalWorkerId = empId;
      ExplorerState.planModalData = {
        tipo: 'VC',
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-15',
        cobertura: 'sin_suplente',
        suplenteNombre: '',
        notas: '1ª Quincena Agosto 2026'
      };
      refreshUI();
    },

    closePlanVacationModal() {
      ExplorerState.planModalWorkerId = null;
      refreshUI();
    },

    setPlanPreset(startStr, endStr, label) {
      ExplorerState.planModalData.fechaInicio = startStr;
      ExplorerState.planModalData.fechaFin = endStr;
      if (label) ExplorerState.planModalData.notas = label;
      refreshUI();
    },

    updatePlanModalField(field, value) {
      if (!ExplorerState.planModalData) ExplorerState.planModalData = {};
      ExplorerState.planModalData[field] = value;
      refreshUI();
    },

    toggleCoverageAuditModal() {
      ExplorerState.showCoverageAuditModal = !ExplorerState.showCoverageAuditModal;
      refreshUI();
    },

    setCoverageSearch(val) {
      ExplorerState.coverageSearchQuery = val || '';
      refreshUI();
      setTimeout(() => {
        const input = document.querySelector('input[placeholder*="Filtrar por centro"]');
        if (input) {
          input.focus();
          if (input.setSelectionRange) input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 10);
    },

    printVacationReceipt(empId, periodId) {
      printVacationReceipt(empId, periodId);
    },

    saveVacationPlanFromModal() {
      const empId = ExplorerState.planModalWorkerId;
      if (!empId) return;

      const allRaw = getAllWorkersRaw();
      const w = allRaw.find(x => x.id_empleado === empId);
      if (!w) return;

      if (w.en_baja_it_actual) {
        alert('Acción denegada: No se pueden conceder vacaciones a un operario en situación de Baja Médica IT.');
        return;
      }

      const md = ExplorerState.planModalData;
      const calc = getDaysBetween(md.fechaInicio, md.fechaFin);
      if (calc.nat <= 0) {
        alert('Por favor, selecciona un rango de fechas válido.');
        return;
      }

      const prevTomados = w.vac_tomados || 0;
      const prevRestantes = w.vac_restantes || 0;

      // Generar nuevo periodo de vacaciones
      const nextIdx = ((w.periodos_vacaciones || []).length) + 1;
      const perId = `PER-${empId}-P${String(nextIdx).padStart(2, '0')}`;
      const d1 = new Date(md.fechaInicio);
      const d2 = new Date(md.fechaFin);
      const rTxt = `${String(d1.getDate()).padStart(2, '0')}/${String(d1.getMonth() + 1).padStart(2, '0')}/${d1.getFullYear()} - ${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}/${d2.getFullYear()}`;
      const mesIni = MESES_LARGOS[d1.getMonth() + 1];

      const nuevoPeriodo = {
        id: `PER-${empId}-${nextIdx}`,
        id_periodo: perId,
        tipo: md.tipo || 'VC',
        codigo_tipo: md.tipo || 'VC',
        concepto: md.tipo === 'VN' ? 'Vacaciones Año Anterior' : (md.tipo === 'VD' ? 'Vacaciones Exceso Cuadrante' : 'Vacaciones Anuales Concedidas'),
        etiqueta_tipo: md.tipo === 'VN' ? 'Vacaciones Año Anterior' : (md.tipo === 'VD' ? 'Vacaciones Exceso Cuadrante' : 'Vacaciones Anuales'),
        fecha_inicio: `${String(d1.getDate()).padStart(2, '0')}/${String(d1.getMonth() + 1).padStart(2, '0')}/${d1.getFullYear()}`,
        fecha_fin: `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}/${d2.getFullYear()}`,
        rango_texto: rTxt,
        dias_habiles: calc.lab,
        dias_naturales: calc.nat,
        dias_laborables_cuadrante: calc.lab,
        mes_inicio: mesIni,
        mes_num: d1.getMonth() + 1,
        estado: 'PROGRAMADO',
        estado_label: 'PROGRAMADO',
        proyectos: (w.proyectos_asignados || []).map(p => p.id_proyecto),
        cobertura: md.cobertura,
        suplente: md.suplenteNombre || '',
        notas: md.notas || '',
        dias: calc.days.map(d => ({
          fecha: d.fecha,
          fecha_es: d.fecha_es,
          dia_semana: d.dia_semana,
          mes_nombre: d.mes_nombre,
          mes_num: d.mes_num,
          codigo_tipo: md.tipo || 'VC',
          etiqueta_tipo: md.tipo === 'VN' ? 'Vacaciones Año Anterior' : (md.tipo === 'VD' ? 'Vacaciones Exceso Cuadrante' : 'Vacaciones Anuales'),
          es_laborable: d.es_laborable,
          estado: 'PROGRAMADO',
          turnos: [{
            id_proyecto: (w.proyectos_asignados && w.proyectos_asignados[0] && w.proyectos_asignados[0].id_proyecto) || 'BCN-LIMPIEZA',
            denominacion: (w.proyectos_asignados && w.proyectos_asignados[0] && w.proyectos_asignados[0].denominacion) || 'Centro Habitual',
            turno: 'M',
            horario: '08:00-15:00',
            tipo_imputacion: 'VACACIONES SAP HO'
          }]
        }))
      };

      if (!w.periodos_vacaciones) w.periodos_vacaciones = [];
      w.periodos_vacaciones.push(nuevoPeriodo);

      if (!w.fechas_detalle) w.fechas_detalle = [];
      nuevoPeriodo.dias.forEach(d => w.fechas_detalle.push(d));

      w.vac_tomados = (w.vac_tomados || 0) + calc.lab;
      w.vac_restantes = Math.max(0, (w.vac_totales || 25) - w.vac_tomados);
      w.total_periodos = w.periodos_vacaciones.length;
      w.dias_vc_naturales_2026 = (w.dias_vc_naturales_2026 || 0) + calc.nat;
      w.dias_vc_laborables_2026 = (w.dias_vc_laborables_2026 || 0) + calc.lab;

      ExplorerState.recentlyUpdatedWorkers[empId] = Date.now();
      ExplorerState.recentChanges.unshift({
        hora: new Date().toLocaleTimeString('es-ES'),
        id_empleado: w.id_empleado,
        nombre: w.nombre_completo,
        prev_tomados: prevTomados,
        new_tomados: w.vac_tomados,
        prev_restantes: prevRestantes,
        new_restantes: w.vac_restantes,
        fechas: rTxt,
        transicion: `🏖️ Concedidas: ${rTxt} (${calc.lab}d laborables computados)`
      });

      // Recalcular KPIs globales en caliente
      const directActivos = allRaw.filter(x => x.es_asignado_directo && x.es_activo);
      const sinBaja = directActivos.filter(x => !x.en_baja_it_actual);
      const payload = getPayload();
      if (payload && payload.kpis) {
        payload.kpis.total_dias_imputados_ho = directActivos.reduce((a, x) => a + (x.vac_tomados || 0), 0);
        payload.kpis.total_dias_pendientes_ho = directActivos.reduce((a, x) => a + (x.vac_restantes || 0), 0);
        payload.kpis.dias_imputados_sin_baja_ho = sinBaja.reduce((a, x) => a + (x.vac_tomados || 0), 0);
        payload.kpis.dias_pendientes_sin_baja_ho = sinBaja.reduce((a, x) => a + (x.vac_restantes || 0), 0);
        payload.kpis.trabajadores_con_pendientes = directActivos.filter(x => (x.vac_restantes || 0) > 0).length;
        payload.kpis.trabajadores_completados = directActivos.filter(x => (x.vac_restantes || 0) <= 0).length;
      }

      // Persistir hacia el servidor / bridge local
      fetch('http://127.0.0.1:5005/ho_vacaciones_planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_empleado: empId,
          action: 'add',
          periodo: nuevoPeriodo,
          trabajador: w
        })
      }).catch(() => {});

      ExplorerState.planModalWorkerId = null;
      ExplorerState.lastSyncInfoMsg = `✅ Vacaciones concedidas a ${w.nombre_completo}: ${rTxt} (${calc.lab} días laborables computados). Cuadrante y saldos actualizados.`;
      refreshUI();
    },

    deleteVacationPeriod(empId, periodId) {
      const allRaw = getAllWorkersRaw();
      const w = allRaw.find(x => x.id_empleado === empId);
      if (!w || !periodId) return;

      const pIdx = (w.periodos_vacaciones || []).findIndex(p => p.id_periodo === periodId);
      if (pIdx === -1) return;

      const pRemoved = w.periodos_vacaciones[pIdx];
      const labDays = pRemoved.dias_habiles || pRemoved.dias_laborables_cuadrante || 0;
      const natDays = pRemoved.dias_naturales || 0;

      w.periodos_vacaciones.splice(pIdx, 1);
      w.vac_tomados = Math.max(0, (w.vac_tomados || 0) - labDays);
      w.vac_restantes = Math.max(0, (w.vac_totales || 25) - w.vac_tomados);
      w.total_periodos = w.periodos_vacaciones.length;
      w.dias_vc_naturales_2026 = Math.max(0, (w.dias_vc_naturales_2026 || 0) - natDays);
      w.dias_vc_laborables_2026 = Math.max(0, (w.dias_vc_laborables_2026 || 0) - labDays);

      // Eliminar de fechas_detalle
      const pIniParts = (pRemoved.fecha_inicio || '').split('/');
      const pFinParts = (pRemoved.fecha_fin || '').split('/');
      if (pIniParts.length === 3 && pFinParts.length === 3) {
        const dIniStr = `${pIniParts[2]}-${pIniParts[1]}-${pIniParts[0]}`;
        const dFinStr = `${pFinParts[2]}-${pFinParts[1]}-${pFinParts[0]}`;
        w.fechas_detalle = (w.fechas_detalle || []).filter(fd => fd.fecha < dIniStr || fd.fecha > dFinStr);
      }

      ExplorerState.openedPeriodId = null;
      ExplorerState.lastSyncInfoMsg = `🗑️ Periodo ${pRemoved.rango_texto} eliminado del cuadrante de ${w.nombre_completo}. Restablecidos ${labDays} días al saldo.`;
      refreshUI();
    },

    _attachSearchListener() {
      setTimeout(() => {
        const searchInput = document.getElementById('hovac-search-input');
        if (searchInput) {
          searchInput.oninput = (e) => {
            this.setSearch(e.target.value);
          };
        }
      }, 20);
    }
  };

  // Motor de Auto-Sincronización en Tiempo Real con SAP HO (Al volver de la pestaña de SAP HO y cada 60 segundos)
  function startAutoSyncEngine() {
    const triggerSilentLiveSyncIfDue = (minElapsedMs = 15000) => {
      if (!ExplorerState.autoSyncEnabled || ExplorerState.isSyncing) return;
      const isTabActive = window.AppState && window.AppState.activeTab === 'ho_vacaciones';
      if (!isTabActive) return;
      if (Date.now() - ExplorerState.lastLiveSyncMs >= minElapsedMs) {
        window.HOVacacionesExplorer.syncAllLive(true);
      }
    };

    // 1. Cuando el usuario imputa vacaciones en SAP HO en otra ventana/pestaña y vuelve a esta ventana
    window.addEventListener('focus', () => {
      triggerSilentLiveSyncIfDue(10000);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerSilentLiveSyncIfDue(10000);
      }
    });

    // 2. Ciclo periódico en segundo plano cada 60 segundos mientras la pestaña 2.4 esté abierta
    setInterval(() => {
      triggerSilentLiveSyncIfDue(55000);
    }, 60000);
  }

  // Inicializar conexión con el Bridge y motor de sincronización en vivo al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initFromBridge();
      startAutoSyncEngine();
    });
  } else {
    initFromBridge();
    startAutoSyncEngine();
  }
})();
