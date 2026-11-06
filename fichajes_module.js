/**
 * ============================================================================
 * FICHAJES MODULE v2.5 - CONTROL DE PRESENCIA Y FICHAJES EN TIEMPO REAL
 * SIFU BARCELONA · DELEGACIÓN 0801 (GRUPO SIFU OPERATIVA)
 * Control Intuitivo Diario, Filtro por Cliente/Trabajador y Semáforo de Cumplimiento:
 *  🟢 OK - 100% | 🟡 NO OK - Problemas | 🔴 NO FICHA | 🩺 BAJA IT (Excluida)
 * Marcadores con Números y Porcentajes (%) en Tiempo Real
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY_FICHAJES = 'sifu_fichajes_bcn_cache_v1';

  // Lista estricta de operarios en situación de Incapacidad Temporal (Baja Médica IT justificada)
  const BAJAS_IT_OFICIALES = [
    { dni: '36530075A', nombre: 'ALEXIA DOMINGUEZ MARSINACH' },
    { dni: '36530075A', nombre: 'ALEXIA DOMINGUEZ MARSIÑACH' },
    { dni: '40429576S', nombre: 'CARLOS MARTINEZ VILANOVA' },
    { dni: '46601633E', nombre: 'ERNESTO MALO HERRERO' },
    { dni: '37381865B', nombre: 'FIDEL CASTILLO CANAL' },
    { dni: '45173415N', nombre: 'JORGE LUIS RAMIREZ SALAS' },
    { dni: '40434075Y', nombre: 'JOSE MANUEL GUTIERREZ PACHECO' },
    { dni: '41652517T', nombre: 'JUAN JOSE GARCIA MANZANEQUE' },
    { dni: '77731473Y', nombre: 'JULIAN CANO GALLEGO' },
    { dni: '40352745G', nombre: 'LAURA PARDILLO LOPEZ' },
    { dni: '33893922H', nombre: 'MANUEL QUESADA AGUDO' }
  ];

  const _normTextCache = new Map();
  function normalizeText(str) {
    if (!str) return '';
    const s = String(str);
    let cached = _normTextCache.get(s);
    if (cached !== undefined) return cached;
    cached = s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    if (_normTextCache.size > 5000) _normTextCache.clear();
    _normTextCache.set(s, cached);
    return cached;
  }

  const GESTORES_BCN_OFICIALES = [
    { id: '00066957', nombre_corto: 'Sonia Cañete', empresa_badge: '🏢 SIFU' },
    { id: '00063967', nombre_corto: 'Adrià Serrano', empresa_badge: '🏢 SIFU' },
    { id: '00001370', nombre_corto: 'Julio Ortiz', empresa_badge: '🏢 SIFU' },
    { id: '00015251', nombre_corto: 'Albert Sánchez', empresa_badge: '🏢 SIFU' },
    { id: '00060598', nombre_corto: 'Jordi Giménez', empresa_badge: '🏢 SIFU' },
    { id: '00065945', nombre_corto: 'Liana Garayshina', empresa_badge: '🏢 SIFU' },
    { id: '00027631', nombre_corto: 'Alba Valverde', empresa_badge: '🏢 SIFU' },
    { id: '00010085', nombre_corto: 'José García', empresa_badge: '🏢 SIFU' },
    { id: '00062620', nombre_corto: 'Alejandro Coscolin', empresa_badge: '🏢 SIFU' }
  ];

  function getGestoresDisponiblesList() {
    if (window.FichajesCarterasUnifier && Array.isArray(window.FichajesCarterasUnifier.GESTORES_CONOCIDOS) && window.FichajesCarterasUnifier.GESTORES_CONOCIDOS.length > 0) {
      return window.FichajesCarterasUnifier.GESTORES_CONOCIDOS;
    }
    return GESTORES_BCN_OFICIALES;
  }

  let _bajaLookupCache = null;
  let _bajaLookupRefHO = null;
  let _bajaLookupRefMaster = null;

  function getBajaLookupIndex() {
    const refHO = window.HO_CARTERAS_PAYLOAD;
    const refMaster = window.INITIAL_MASTER_DATA;
    if (_bajaLookupCache && _bajaLookupRefHO === refHO && _bajaLookupRefMaster === refMaster) {
      return _bajaLookupCache;
    }
    const dnis = new Set();
    const names = new Set();

    // 1. Lista estricta verificada de Barcelona (0801)
    BAJAS_IT_OFICIALES.forEach(b => {
      if (b.dni) dnis.add(String(b.dni).toUpperCase().replace(/[\s\-_.]/g, ''));
      if (b.nombre) names.add(normalizeText(b.nombre));
    });

    // 2. Carteras oficiales de SAP HO
    if (refHO && Array.isArray(refHO.trabajadores)) {
      refHO.trabajadores.forEach(w => {
        const est = String(w.estado_hoy || '').trim().toUpperCase();
        if (w.en_baja || est === 'BAJA' || est === 'BAJA_IT') {
          const wDni = String(w.dni || '').toUpperCase().replace(/[\s\-_.]/g, '');
          const wNom = normalizeText(w.nombre);
          if (wDni) dnis.add(wDni);
          if (wNom) names.add(wNom);
        }
      });
    }

    // 3. Servicios operativos de SAP HO
    if (refHO && Array.isArray(refHO.servicios_operativos)) {
      refHO.servicios_operativos.forEach(s => {
        const est = String(s.estado || s.estado_hoy || '').toUpperCase();
        if (est.includes('BAJA') && !est.includes('CUBIERTO')) {
          const tDni = String(s.dni || '').toUpperCase().replace(/[\s\-_.]/g, '');
          const tNom = normalizeText(s.titular || s.nombre);
          if (tDni) dnis.add(tDni);
          if (tNom) names.add(tNom);
        }
      });
    }

    // 4. INITIAL_MASTER_DATA
    if (refMaster && Array.isArray(refMaster)) {
      refMaster.forEach(r => {
        const est = (String(r.ESTADO || '') + ' ' + String(r.ESTADO1 || '')).toUpperCase();
        if ((est.includes('BAJA') || est.includes(' IT')) && !est.includes('CUBIERTO') && !est.includes('SUPL')) {
          const rDni = String(r.DNI || '').toUpperCase().replace(/[\s\-_.]/g, '');
          const rTit = normalizeText(r.TITULAR);
          if (rDni) dnis.add(rDni);
          if (rTit) names.add(rTit);
        }
      });
    }

    // 5. Cuadrantes de SAP HO
    if (window.HO_CUADRANTES && typeof window.HO_CUADRANTES === 'object') {
      for (const proy of Object.values(window.HO_CUADRANTES)) {
        const filas = proy.filas_cuadrante || [];
        for (let i = 0; i < filas.length; i++) {
          const f = filas[i];
          if (f.es_suplente || (f.rol && f.rol.includes('SUPLENTE'))) continue;
          if (f.en_baja || f.rol === 'BAJA IT' || (f.tipos_asignacion && f.tipos_asignacion.includes('BJ'))) {
            const fNom = normalizeText(f.nombre);
            if (fNom) names.add(fNom);
          }
        }
      }
    }

    // 6. Bajas IT oficiales IT2001 (ho_vacaciones_data.js)
    const refVac = window.HO_VACACIONES_PAYLOAD;
    if (refVac && Array.isArray(refVac.trabajadores)) {
      refVac.trabajadores.forEach(w => {
        if (w.en_baja_it_actual || (w.otras_ausencias_2026 && w.otras_ausencias_2026.Baja > 0)) {
          const wDni = String(w.dni || '').toUpperCase().replace(/[\s\-_.]/g, '');
          const wNom = normalizeText(w.nombre_completo || w.nombre);
          if (wDni) dnis.add(wDni);
          if (wNom) names.add(wNom);
        }
      });
    }

    _bajaLookupRefHO = refHO;
    _bajaLookupRefMaster = refMaster;
    _bajaLookupCache = { dnis, names, namesArr: Array.from(names) };
    return _bajaLookupCache;
  }

  function esOperarioDeBaja(nombre, dni, workerObj) {
    if (workerObj && (workerObj.en_baja || workerObj.isBaja || workerObj.en_baja_sap || workerObj.estado_hoy === 'BAJA_IT' || workerObj.estado_hoy === 'Baja' || workerObj.estado_semaforo === 'baja')) {
      return true;
    }
    const idx = getBajaLookupIndex();
    const cleanDni = dni ? String(dni).toUpperCase().replace(/[\s\-_.]/g, '') : '';
    if (cleanDni && idx.dnis.has(cleanDni)) return true;

    const norm = normalizeText(nombre);
    if (!norm) return false;
    if (idx.names.has(norm)) return true;

    for (let i = 0; i < idx.namesArr.length; i++) {
      const bNorm = idx.namesArr[i];
      if (bNorm.length > 5 && (norm.includes(bNorm) || bNorm.includes(norm))) {
        return true;
      }
    }
    return false;
  }

  let _vacLookupCache = null;
  let _vacLookupRefVac = null;
  let _vacLookupRefHO = null;

  function getVacacionesLookupIndex() {
    const refVac = window.HO_VACACIONES_PAYLOAD;
    const refHO = window.HO_CARTERAS_PAYLOAD;
    if (_vacLookupCache && _vacLookupRefVac === refVac && _vacLookupRefHO === refHO) {
      return _vacLookupCache;
    }
    const dnis = new Set();
    const names = new Set();
    const vacDaysByDni = {};

    if (refVac && Array.isArray(refVac.trabajadores)) {
      refVac.trabajadores.forEach(w => {
        const wDni = String(w.dni || '').toUpperCase().replace(/[\s\-_.]/g, '');
        const wNom = normalizeText(w.nombre_completo || w.nombre);
        const periods = w.periodos_vacaciones || [];
        const octDays = new Set();
        periods.forEach(p => {
          (p.dias || []).forEach(d => {
            const fIso = String(d.fecha || '');
            if (fIso.startsWith('2026-10')) {
              octDays.add(fIso.slice(-2));
            }
          });
        });
        if (octDays.size > 0 || (w.fechas_detalle && Object.keys(w.fechas_detalle).some(k => k.startsWith('2026-10')))) {
          if (wDni) {
            dnis.add(wDni);
            vacDaysByDni[wDni] = octDays;
          }
          if (wNom) names.add(wNom);
        }
      });
    }

    if (refHO && Array.isArray(refHO.trabajadores)) {
      refHO.trabajadores.forEach(w => {
        const est = String(w.estado_hoy || '').toUpperCase();
        if (w.de_vacaciones || est.includes('VACACION') || est.includes('PERMISO')) {
          const wDni = String(w.dni || '').toUpperCase().replace(/[\s\-_.]/g, '');
          const wNom = normalizeText(w.nombre);
          if (wDni) dnis.add(wDni);
          if (wNom) names.add(wNom);
        }
      });
    }

    _vacLookupRefVac = refVac;
    _vacLookupRefHO = refHO;
    _vacLookupCache = { dnis, names, namesArr: Array.from(names), vacDaysByDni };
    return _vacLookupCache;
  }

  function esOperarioDeVacaciones(nombre, dni, workerObj, diaPad) {
    if (workerObj) {
      if (workerObj.de_vacaciones || workerObj.de_vacaciones_sap || workerObj.isVacaciones || workerObj.estado_semaforo === 'vacaciones' || (workerObj.estado_hoy && String(workerObj.estado_hoy).toUpperCase().includes('VACACION'))) {
        return true;
      }
      if (diaPad && Array.isArray(workerObj.dias_vacaciones_activos) && workerObj.dias_vacaciones_activos.includes(diaPad)) {
        return true;
      }
    }
    const idx = getVacacionesLookupIndex();
    const cleanDni = dni ? String(dni).toUpperCase().replace(/[\s\-_.]/g, '') : '';
    if (cleanDni && idx.dnis.has(cleanDni)) {
      if (diaPad && idx.vacDaysByDni[cleanDni]) {
        return idx.vacDaysByDni[cleanDni].has(diaPad);
      }
      return true;
    }
    const norm = normalizeText(nombre);
    if (norm && idx.names.has(norm)) return true;
    return false;
  }

  function getDiasPrevistosTrabajador(workerObj) {
    if (!workerObj) return new Set([1, 2, 3, 4, 5]); // L-V (1: Lun ... 5: Vie)
    const h = String(workerObj.horario_habitual || '').toUpperCase();
    if (h.includes('DOMINGO') && !h.includes('LUNES') && !h.includes('MARTES') && !h.includes('MIERCOLES') && !h.includes('MIÉRCOLES') && !h.includes('JUEVES') && !h.includes('VIERNES') && !h.includes('SABADO') && !h.includes('SÁBADO')) {
      return new Set([0]); // Solo domingo
    }
    if (h.includes('FIN DE SEMANA') || h.includes('SABADO Y DOMINGO') || h.includes('SÁBADO Y DOMINGO')) {
      return new Set([6, 0]); // Sábado y domingo
    }
    const s = new Set();
    if (h.includes('L-') || h.includes('LUNES') || h.includes(' L ') || h.includes('L,')) s.add(1);
    if (h.includes('M-') || h.includes('MARTES') || h.includes(' M ') || h.includes('M,')) s.add(2);
    if (h.includes('X-') || h.includes('MIERCOLES') || h.includes('MIÉRCOLES') || h.includes(' X ') || h.includes('X,')) s.add(3);
    if (h.includes('J-') || h.includes('JUEVES') || h.includes(' J ') || h.includes('J,')) s.add(4);
    if (h.includes('V-') || h.includes('VIERNES') || h.includes(' V ') || h.includes('V,')) s.add(5);
    if (h.includes('S-') || h.includes('SABADO') || h.includes('SÁBADO') || h.includes(' S ') || h.includes('S,')) s.add(6);
    if (h.includes('D-') || h.includes('DOMINGO') || h.includes(' D ') || h.includes('D,')) s.add(0);
    return s.size > 0 ? s : new Set([1, 2, 3, 4, 5]);
  }

  function esDiaDescanso(workerObj, diaNum, mesNum, anioNum) {
    if (!workerObj) return false;
    const diaPad = String(diaNum).padStart(2, '0');
    if (Array.isArray(workerObj.dias_descanso_activos) && workerObj.dias_descanso_activos.includes(diaPad)) {
      return true;
    }
    const dObj = new Date(anioNum, mesNum - 1, diaNum);
    const dow = dObj.getDay();
    const previstos = getDiasPrevistosTrabajador(workerObj);
    return !previstos.has(dow);
  }

  const _spanishDateCache = new Map();
  // Funciones para parseo y validación de vigencia contractual (Alta / Finiquito)
  function parseSpanishDate(dStr) {
    if (!dStr || typeof dStr !== 'string') return null;
    let cached = _spanishDateCache.get(dStr);
    if (cached !== undefined) return cached;
    const parts = dStr.trim().split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const dt = new Date(y, m - 1, d);
        _spanishDateCache.set(dStr, dt);
        return dt;
      }
    }
    _spanishDateCache.set(dStr, null);
    return null;
  }

  function getEstadoContractualDia(workerObj, diaNum, mesNum, anioNum) {
    if (!workerObj) return { contratado: true };
    if (!workerObj.inicio_contrato && (!workerObj.fin_contrato || workerObj.fin_contrato === 'Indefinido' || workerObj.fin_contrato === 'indefinido')) {
      return { contratado: true };
    }
    const targetTs = new Date(anioNum, mesNum - 1, diaNum, 12, 0, 0, 0).getTime();

    if (workerObj._fIniTs === undefined) {
      const fIni = parseSpanishDate(workerObj.inicio_contrato);
      workerObj._fIniTs = fIni ? new Date(fIni.getFullYear(), fIni.getMonth(), fIni.getDate(), 0, 0, 0, 0).getTime() : null;
    }
    if (workerObj._fIniTs !== null && targetTs < workerObj._fIniTs) {
      return {
        contratado: false,
        motivo: 'PREVIO_ALTA',
        label: `No contratado (Alta: ${workerObj.inicio_contrato})`,
        fechaAlta: workerObj.inicio_contrato
      };
    }

    if (workerObj._fFinTs === undefined) {
      const finStr = workerObj.fin_contrato;
      if (finStr && finStr.toLowerCase() !== 'indefinido' && finStr.toLowerCase() !== 'null') {
        const fFin = parseSpanishDate(finStr);
        workerObj._fFinTs = fFin ? new Date(fFin.getFullYear(), fFin.getMonth(), fFin.getDate(), 23, 59, 59, 999).getTime() : null;
      } else {
        workerObj._fFinTs = null;
      }
    }
    if (workerObj._fFinTs !== null && targetTs > workerObj._fFinTs) {
      return {
        contratado: false,
        motivo: 'POST_FIN',
        label: `Contrato finalizado (${workerObj.fin_contrato})`,
        fechaFin: workerObj.fin_contrato
      };
    }

    return { contratado: true };
  }

  // Nombres oficiales en español y funciones de fecha dinámica
  const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const NOMBRES_DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function getHoyFechaStr() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Generador dinámico de días del mes con detección automática del día de HOY
  function getDiasDelMes(mes, anio) {
    const now = new Date();
    const isCurrentMonthYear = (now.getFullYear() === anio && (now.getMonth() + 1) === mes);
    const todayDay = now.getDate();
    const totalDias = new Date(anio, mes, 0).getDate();
    const dias = [];
    for (let i = 1; i <= totalDias; i++) {
      const dObj = new Date(anio, mes - 1, i);
      const nombreDia = NOMBRES_DIAS_SEMANA[dObj.getDay()];
      dias.push({
        num: i,
        pad: String(i).padStart(2, '0'),
        nombre: nombreDia,
        isHoy: isCurrentMonthYear && (i === todayDay)
      });
    }
    return dias;
  }

  // Array retrocompatible por defecto para Octubre 2026
  const DIAS_OCTUBRE_2026 = getDiasDelMes(10, 2026);

  // Estado reactivo del módulo
  const FichState = {
    viewMode: 'contraste', // 'servicios' | 'trabajadores' | 'listado' | 'contraste'
    search: '',
    filterFecha: 'todas', // 'todas' | '13/10/2026' | '12/10/2026' ...
    filterCliente: 'todos',
    filterTrabajador: 'todos',
    filterServicio: 'todos',
    filterTipo: 'todos', // 'todos' | 'entrada' | 'salida'
    filterMetodo: 'todos', // 'todos' | 'APP' | 'GPS'
    contrasteGestor: 'todos', // 'todos' | '00062620' | '00063187' | ...
    contrasteSector: 'todos',
    contrasteSemaforo: 'todos',
    contrasteMes: (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.mes_actual) ? parseInt(window.FICHAJES_CONTRASTE_PAYLOAD.mes_actual.split('-')[1], 10) : (new Date().getMonth() + 1),
    contrasteAnio: (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.mes_actual) ? parseInt(window.FICHAJES_CONTRASTE_PAYLOAD.mes_actual.split('-')[0], 10) : new Date().getFullYear(),
    contrasteDia: 'todos', // 'todos' | '01' .. '31'
    contrasteDiaModo: 'todos', // 'todos' | 'ficho' | 'noficho'
    contrasteSubView: 'tarjetas',
    contrasteSort: 'nombre',
    showAllCards: false,
    cardsLimit: 24,
    activeModalWorkerDNI: null,
    compactColFilters: {
      estado: '',
      gestor: '',
      trabajador: '',
      dni: '',
      servicio: '',
      sector: '',
      dia: '',
      fichajes: '',
      ultimo: '',
      diagnostico: ''
    },
    colFilters: {
      fechaEfectiva: '',
      horaRegistro: '',
      empleadoNombre: '',
      empleadoDNI: '',
      empleadoCod: '',
      clienteNombre: '',
      centroNombre: '',
      tipoAcceso: '',
      metodo: '',
      distanciaStr: '',
      puntoAcceso: ''
    },
    currentPage: 1,
    pageSize: 50,
    collapsedServices: {},
    isSyncing: false,
    lastSync: null,
    items: [],
    plantillaOperativa: []
  };

  // Censo de trabajadores de la delegación de Barcelona (0801) (limpio y sin duplicidades)
  function loadPlantillaOperativa() {
    const map = {};

    function addWorker(nombre, dni, codigo, cliente, centro, isBaja) {
      if (!nombre) return;
      let cleanNombre = nombre.toUpperCase().trim();
      
      // Filtrar cadenas compuestas como 'CARLA MASSANELLAS SAURA / BLAS P'
      if (cleanNombre.includes('/')) {
        cleanNombre = cleanNombre.split('/')[0].trim();
      }
      // Filtrar notas que no son nombres reales
      if (cleanNombre.includes('VUELVE') || cleanNombre.includes('EMERGENCIAS') || cleanNombre.includes('FALTA') || cleanNombre.length < 5) {
        return;
      }

      if (!map[cleanNombre]) {
        map[cleanNombre] = {
          nombre: cleanNombre,
          dni: dni || '',
          codigo: codigo || '',
          cliente: cliente || 'ASIGNACIÓN BARCELONA',
          centro: centro || 'SERVICIO BARCELONA',
          isBaja: isBaja || esOperarioDeBaja(cleanNombre)
        };
      } else {
        if (isBaja) map[cleanNombre].isBaja = true;
        if (dni && !map[cleanNombre].dni) map[cleanNombre].dni = dni;
        if (codigo && !map[cleanNombre].codigo) map[cleanNombre].codigo = codigo;
        if (cliente && map[cleanNombre].cliente === 'ASIGNACIÓN BARCELONA') map[cleanNombre].cliente = cliente;
        if (centro && map[cleanNombre].centro === 'SERVICIO BARCELONA') map[cleanNombre].centro = centro;
      }
    }

    // 1. De los propios fichajes
    FichState.items.forEach(f => {
      addWorker(f.empleadoNombre, f.empleadoDNI, f.empleadoCod, f.clienteNombre, f.centroNombre, false);
    });

    // 2. De INITIAL_MASTER_DATA
    if (window.INITIAL_MASTER_DATA && Array.isArray(window.INITIAL_MASTER_DATA)) {
      window.INITIAL_MASTER_DATA.forEach(row => {
        const estado = String(row.ESTADO || row.ESTADO1 || '').toUpperCase();
        const obs = String(row.OBSERVACIONES || '').toUpperCase();
        const isBaja = estado.includes('BAJA') || estado.includes('IT') || obs.includes('BAJA IT');

        const titular = row.TITULAR || '';
        if (titular && titular !== 'FALTA TITULAR') {
          addWorker(titular, row.DNI || '', row.ID || '', row.SERVICIO || '', row['TIPO S'] || '', isBaja);
        }

        const supl = row.SUPL || '';
        if (supl && supl.length > 3) {
          addWorker(supl, '', '', row.SERVICIO || '', row['TIPO S'] || '', false);
        }
      });
    }

    // 3. De CMH_RAW_DATA
    if (window.CMH_RAW_DATA && Array.isArray(window.CMH_RAW_DATA)) {
      window.CMH_RAW_DATA.forEach(row => {
        addWorker(row.empleado, '', row.id, row.tipoServicio, row.centroServicio, esOperarioDeBaja(row.empleado));
      });
    }

    FichState.plantillaOperativa = Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // Carga inicial de datos
  function initData() {
    if (window.FICHAJES_RAW_PAYLOAD && Array.isArray(window.FICHAJES_RAW_PAYLOAD.fichajes)) {
      FichState.items = normalizeFichajes(window.FICHAJES_RAW_PAYLOAD.fichajes);
      FichState.lastSync = window.FICHAJES_RAW_PAYLOAD.fecha_sincronizacion || new Date().toLocaleString();
      loadPlantillaOperativa();
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_FICHAJES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.fichajes)) {
          FichState.items = normalizeFichajes(parsed.fichajes);
          FichState.lastSync = parsed.lastSync || new Date().toLocaleString();
          loadPlantillaOperativa();
          return;
        }
      }
    } catch (e) {
      console.warn('Error leyendo cache de fichajes:', e);
    }

    FichState.items = [];
    loadPlantillaOperativa();
  }

  // Normalizador de registros
  function normalizeFichajes(rawList) {
    return rawList.map((item, idx) => {
      const isEntrada = item.ENTRA === true || String(item.ENTRA).toLowerCase() === 'true';
      const fechaEfectiva = item.FEFEC || (item.FREGI ? item.FREGI.split(' ')[0] : '');
      const horaRegistro = item.FREGI && item.FREGI.includes(' ') ? item.FREGI.split(' ')[1] : '';
      const distanciaNum = parseFloat((item.ORDETA || '0').replace('m', '').trim()) || 0;

      return {
        id: item.CPCID || idx + 1,
        fechaEfectiva: fechaEfectiva,
        fechaRegistro: item.FREGI || '',
        horaRegistro: horaRegistro,
        empleadoCod: item.USERCOD || '',
        empleadoDNI: item.USERDNI || '',
        empleadoNombre: (item.USERNOM || 'SIN NOMBRE').toUpperCase().trim(),
        clienteCod: item.CLCO || '',
        clienteNombre: item.CLNO || item.CLCO || 'CLIENTE NO DEFINIDO',
        centroCod: item.CTCI || '',
        centroNombre: item.CTNO || item.CPPNOM || 'CENTRO NO DEFINIDO',
        puntoAcceso: item.CPPNOM || '',
        tipoAcceso: isEntrada ? 'Entrada' : 'Salida',
        isEntrada: isEntrada,
        metodo: item.ORNO || 'GPS',
        distanciaStr: item.ORDETA || '0 m',
        distanciaNum: distanciaNum,
        lat: item.LATI || null,
        lng: item.LONG || null,
        delegacion: item.DENO || 'SIFU BARCELONA',
        sociedad: item.EMNO || 'GRUPO SIFU OPERATIVA'
      };
    });
  }

  function saveToCache() {
    try {
      localStorage.setItem(STORAGE_KEY_FICHAJES, JSON.stringify({
        lastSync: FichState.lastSync,
        fichajes: FichState.items
      }));
    } catch (e) {
      console.warn('No se pudo guardar caché:', e);
    }
  }

  // Obtener fechas únicas disponibles
  function getAvailableDates() {
    const dates = new Set();
    FichState.items.forEach(i => {
      if (i.fechaEfectiva) dates.add(i.fechaEfectiva);
    });
    return Array.from(dates).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });
  }

  // ==========================================================================
  // EVALUADOR DEL SEMÁFORO / CHECK DE CUMPLIMIENTO CON DETECCIÓN DE BAJA IT
  // ==========================================================================
  function evaluateWorkerCheck(workerName, workerFichajes, targetFecha, isBajaRegistrada) {
    // 1. SI ESTÁ DE BAJA MÉDICA IT: NO CONTABILIZA NI EN NO FICHA NI EN NO OK (solo si no tiene fichajes)
    const tieneMarcajes = workerFichajes && workerFichajes.length > 0;
    if (!tieneMarcajes && (isBajaRegistrada || esOperarioDeBaja(workerName))) {
      return {
        check: 'baja',
        badgeClass: 'badge-baja',
        label: '🩺 BAJA IT',
        motivo: 'Incapacidad Temporal (IT) justificada en SAP S/4HANA · No computable en fichajes',
        entradas: 0,
        salidas: 0,
        total: 0,
        isBaja: true
      };
    }

    // 2. SI NO TIENE FICHAJES: 🔴 NO FICHA (TRABAJADOR ACTIVO CONVOCADO)
    if (!workerFichajes || workerFichajes.length === 0) {
      return {
        check: 'noficha',
        badgeClass: 'badge-noficha',
        label: '🔴 NO FICHA',
        motivo: targetFecha !== 'todas' 
          ? `Sin fichaje registrado el ${targetFecha}` 
          : 'Sin ningún fichaje registrado en la app de la empresa',
        entradas: 0,
        salidas: 0,
        total: 0,
        isBaja: false
      };
    }

    // 3. TIENE FICHAJES: ANALIZAR SI ES 🟢 OK 100% O 🟡 NO OK (A MEDIAS / PROBLEMAS)
    const entradas = workerFichajes.filter(f => f.isEntrada).length;
    const salidas = workerFichajes.filter(f => !f.isEntrada).length;
    const total = workerFichajes.length;
    const problemas = [];

    if (targetFecha !== 'todas') {
      const isHoy = targetFecha === getHoyFechaStr() || targetFecha === '13/10/2026';
      if (entradas > 0 && salidas === 0) {
        if (!isHoy) {
          problemas.push('Falta fichaje de salida');
        }
      } else if (salidas > 0 && entradas === 0) {
        problemas.push('Salida sin entrada previa');
      } else if (entradas !== salidas) {
        problemas.push(`Descuadre: ${entradas} entradas vs ${salidas} salidas`);
      }
    } else {
      if (Math.abs(entradas - salidas) > 2) {
        problemas.push(`Descuadre global: ${entradas}E / ${salidas}S`);
      }
    }

    // Desviación GPS excesiva (> 500m)
    const fichajeLejano = workerFichajes.find(f => f.distanciaNum > 500);
    if (fichajeLejano) {
      problemas.push(`Desviación GPS: ${fichajeLejano.distanciaStr}`);
    }

    // Fichaje sin App Web GPS
    const sinApp = workerFichajes.find(f => !f.metodo.includes('APP'));
    if (sinApp && !sinApp.metodo.includes('GPS')) {
      problemas.push('Fichaje manual sin app');
    }

    if (problemas.length > 0) {
      return {
        check: 'nook',
        badgeClass: 'badge-nook',
        label: '🟡 NO OK',
        motivo: problemas.join(' · '),
        entradas,
        salidas,
        total,
        isBaja: false
      };
    }

    return {
      check: 'ok',
      badgeClass: 'badge-ok',
      label: '🟢 OK · 100%',
      motivo: (targetFecha === getHoyFechaStr() || targetFecha === '13/10/2026') && salidas === 0 
        ? 'Turno en curso · Entrada verificada por APP' 
        : 'Fichajes cuadrados · Verificado por APP Web GPS',
      entradas,
      salidas,
      total,
      isBaja: false
    };
  }

  // Filtrado de elementos
  function getFilteredItems() {
    const q = FichState.search.toLowerCase().trim();

    return FichState.items.filter(item => {
      if (FichState.filterFecha !== 'todas' && item.fechaEfectiva !== FichState.filterFecha) {
        return false;
      }
      if (FichState.filterCliente !== 'todos') {
        const clName = (item.clienteNombre || '').toLowerCase();
        if (!clName.includes(FichState.filterCliente.toLowerCase())) return false;
      }
      if (FichState.filterTrabajador !== 'todos') {
        if (item.empleadoNombre !== FichState.filterTrabajador) return false;
      }
      if (FichState.filterServicio !== 'todos') {
        const sKey = (item.centroCod || item.centroNombre).trim();
        if (sKey !== FichState.filterServicio) return false;
      }
      if (FichState.filterTipo === 'entrada' && !item.isEntrada) return false;
      if (FichState.filterTipo === 'salida' && item.isEntrada) return false;

      if (FichState.filterMetodo !== 'todos') {
        if (FichState.filterMetodo === 'APP' && !item.metodo.includes('APP')) return false;
        if (FichState.filterMetodo === 'GPS' && item.metodo !== 'GPS') return false;
      }

      if (q) {
        const match = item.empleadoNombre.toLowerCase().includes(q) ||
                      item.empleadoDNI.toLowerCase().includes(q) ||
                      item.empleadoCod.toLowerCase().includes(q) ||
                      item.centroNombre.toLowerCase().includes(q) ||
                      item.clienteNombre.toLowerCase().includes(q) ||
                      item.fechaEfectiva.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (FichState.colFilters) {
        const cf = FichState.colFilters;
        if (cf.fechaEfectiva && !(item.fechaEfectiva || '').toLowerCase().includes(cf.fechaEfectiva.toLowerCase().trim())) return false;
        if (cf.horaRegistro && !(item.horaRegistro || '').toLowerCase().includes(cf.horaRegistro.toLowerCase().trim())) return false;
        if (cf.empleadoNombre && !(item.empleadoNombre || '').toLowerCase().includes(cf.empleadoNombre.toLowerCase().trim())) return false;
        if (cf.empleadoDNI && !(item.empleadoDNI || '').toLowerCase().includes(cf.empleadoDNI.toLowerCase().trim())) return false;
        if (cf.empleadoCod && !(item.empleadoCod || '').toLowerCase().includes(cf.empleadoCod.toLowerCase().trim())) return false;
        if (cf.clienteNombre && !(item.clienteNombre || '').toLowerCase().includes(cf.clienteNombre.toLowerCase().trim())) return false;
        if (cf.centroNombre && !(item.centroNombre || '').toLowerCase().includes(cf.centroNombre.toLowerCase().trim())) return false;
        if (cf.tipoAcceso) {
          const tSearch = cf.tipoAcceso.toLowerCase().trim();
          if (tSearch === 'entrada' && !item.isEntrada) return false;
          if (tSearch === 'salida' && item.isEntrada) return false;
        }
        if (cf.metodo && !(item.metodo || '').toLowerCase().includes(cf.metodo.toLowerCase().trim())) return false;
        if (cf.distanciaStr && !(item.distanciaStr || '').toLowerCase().includes(cf.distanciaStr.toLowerCase().trim())) return false;
        if (cf.puntoAcceso && !(item.puntoAcceso || '').toLowerCase().includes(cf.puntoAcceso.toLowerCase().trim())) return false;
      }

      return true;
    });
  }

  // Obtener estado consolidado con Porcentajes (%) y Exclusión de Bajas IT
  function getComplianceMatrix(fechaOverride) {
    const fechaEval = fechaOverride || FichState.filterFecha;
    const itemsPorFecha = FichState.items.filter(i => {
      if (fechaEval !== 'todas' && i.fechaEfectiva !== fechaEval) return false;
      return true;
    });

    const fichajesByWorker = {};
    itemsPorFecha.forEach(item => {
      if (!fichajesByWorker[item.empleadoNombre]) {
        fichajesByWorker[item.empleadoNombre] = [];
      }
      fichajesByWorker[item.empleadoNombre].push(item);
    });

    const evaluatedWorkers = FichState.plantillaOperativa.map(w => {
      const wFichajes = fichajesByWorker[w.nombre] || [];
      const evalResult = evaluateWorkerCheck(w.nombre, wFichajes, fechaEval, w.isBaja);
      
      const centrosList = Array.from(new Set(wFichajes.map(f => f.centroNombre).filter(Boolean)));
      const clientesList = Array.from(new Set(wFichajes.map(f => f.clienteNombre).filter(Boolean)));

      return {
        nombre: w.nombre,
        dni: w.dni || (wFichajes[0] ? wFichajes[0].empleadoDNI : ''),
        codigo: w.codigo || (wFichajes[0] ? wFichajes[0].empleadoCod : ''),
        cliente: clientesList.join(', ') || w.cliente || 'ASIGNACIÓN BARCELONA',
        centro: centrosList.join(', ') || w.centro || 'SERVICIO BARCELONA',
        fichajes: wFichajes,
        ...evalResult
      };
    });

    // Conteos
    const countOk = evaluatedWorkers.filter(w => w.check === 'ok').length;
    const countNoOk = evaluatedWorkers.filter(w => w.check === 'nook').length;
    const countNoFicha = evaluatedWorkers.filter(w => w.check === 'noficha').length;
    const countBaja = evaluatedWorkers.filter(w => w.check === 'baja').length;

    // Plantilla Activa Real Obligada a Fichar (Excluyendo Bajas Médicas IT)
    const plantillaActiva = countOk + countNoOk + countNoFicha;
    const totalPlantilla = evaluatedWorkers.length;

    // Porcentajes precisos sobre la plantilla activa
    const pctOk = plantillaActiva > 0 ? ((countOk / plantillaActiva) * 100).toFixed(1) : '0.0';
    const pctNoOk = plantillaActiva > 0 ? ((countNoOk / plantillaActiva) * 100).toFixed(1) : '0.0';
    const pctNoFicha = plantillaActiva > 0 ? ((countNoFicha / plantillaActiva) * 100).toFixed(1) : '0.0';

    return {
      evaluatedWorkers,
      countOk,
      pctOk,
      countNoOk,
      pctNoOk,
      countNoFicha,
      pctNoFicha,
      countBaja,
      plantillaActiva,
      totalPlantilla
    };
  }

  // Inicialización diferida (lazy) para no bloquear el arranque con los 16.695 registros históricos
  let _legacyDataInitialized = false;
  function ensureLegacyDataLoaded() {
    if (_legacyDataInitialized) return;
    _legacyDataInitialized = true;
    initData();
  }

  // ==========================================================================
  // RENDER PRINCIPAL DE LA VISTA DEL DASHBOARD
  // ==========================================================================
  window.renderFichajesDashboardView = function () {
    const isContraste = !FichState.viewMode || FichState.viewMode === 'contraste';
    const isServicios = FichState.viewMode === 'servicios';
    const isTrabajadores = FichState.viewMode === 'trabajadores';
    const isListado = FichState.viewMode === 'listado' || FichState.viewMode === 'table';

    let contentHtml = '';
    if (isServicios) {
      ensureLegacyDataLoaded();
      const items = getFilteredItems();
      const compliance = getComplianceMatrix();
      contentHtml = renderServicesViewWithCheck(items, compliance.evaluatedWorkers);
    } else if (isTrabajadores) {
      ensureLegacyDataLoaded();
      const compliance = getComplianceMatrix();
      contentHtml = renderWorkersCheckView(compliance.evaluatedWorkers);
    } else if (isListado) {
      ensureLegacyDataLoaded();
      const items = getFilteredItems();
      contentHtml = renderTableView(items);
    } else {
      contentHtml = renderContrasteView();
    }

    return `
      <div class="fichajes-dashboard-container">
        <!-- BARRA DE MODOS DE VISTA PRINCIPALES -->
        <div style="background:#ffffff; border-bottom:1px solid #e2e8f0; padding:8px 16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <span style="font-size:12px; font-weight:800; color:#475569; margin-right:4px;">👁️ VISTAS DISPONIBLES:</span>
          <button type="button" class="fich-view-mode-btn ${isContraste ? 'active' : ''}" onclick="window.FichajesModule.setViewMode('contraste')">
            <span>⚡ 1. Contraste Multi-Gestor (En Vivo)</span>
          </button>
          <button type="button" class="fich-view-mode-btn ${isServicios ? 'active' : ''}" onclick="window.FichajesModule.setViewMode('servicios')">
            <span>🏢 2. Por Centros / Servicios</span>
          </button>
          <button type="button" class="fich-view-mode-btn ${isTrabajadores ? 'active' : ''}" onclick="window.FichajesModule.setViewMode('trabajadores')">
            <span>👥 3. Por Trabajadores</span>
          </button>
          <button type="button" class="fich-view-mode-btn ${isListado ? 'active' : ''}" onclick="window.FichajesModule.setViewMode('listado')">
            <span>📋 4. Historial Marcajes Brutos</span>
          </button>
        </div>
        ${contentHtml}
      </div>
    `;
  };

  // Renderizador según modo de vista
  function renderActiveView(items, displayWorkers, compliance) {
    if (FichState.viewMode === 'servicios') {
      return renderServicesViewWithCheck(items, displayWorkers);
    } else if (FichState.viewMode === 'trabajadores') {
      return renderWorkersCheckView(displayWorkers);
    } else if (FichState.viewMode === 'contraste') {
      return renderContrasteView();
    } else {
      return renderTableView(items);
    }
  }

  // VISTA 1: AGRUPADA POR SERVICIOS (Con identificación de Bajas IT)
  function renderServicesViewWithCheck(items, displayWorkers) {
    const servicesMap = {};

    displayWorkers.forEach(w => {
      const sKey = w.centro || 'SERVICIOS GENERALES BARCELONA';
      if (!servicesMap[sKey]) {
        servicesMap[sKey] = {
          nombre: sKey,
          cliente: w.cliente,
          trabajadores: [],
          totalFichajes: 0,
          entradas: 0,
          salidas: 0,
          countOk: 0,
          countNoOk: 0,
          countNoFicha: 0,
          countBaja: 0
        };
      }
      servicesMap[sKey].trabajadores.push(w);
      servicesMap[sKey].totalFichajes += w.total;
      servicesMap[sKey].entradas += w.entradas;
      servicesMap[sKey].salidas += w.salidas;
      if (w.check === 'ok') servicesMap[sKey].countOk++;
      else if (w.check === 'nook') servicesMap[sKey].countNoOk++;
      else if (w.check === 'baja') servicesMap[sKey].countBaja++;
      else servicesMap[sKey].countNoFicha++;
    });

    const servicesList = Object.values(servicesMap).sort((a, b) => b.totalFichajes - a.totalFichajes);

    if (servicesList.length === 0) {
      return `
        <div style="background:#ffffff; border:1px solid var(--fich-border); border-radius:12px; padding:60px 20px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">🔍</div>
          <h3 style="font-size:16px; font-weight:800; color:var(--fich-text-main); margin-bottom:6px;">No se encontraron servicios</h3>
          <p style="font-size:13px; color:var(--fich-text-muted); max-width:450px; margin:0 auto 16px;">Ningún servicio coincide con los filtros actuales.</p>
          <button class="fich-btn-action" onclick="window.FichajesModule.resetFilters()">Restablecer Filtros</button>
        </div>
      `;
    }

    return `
      <div class="fich-services-container">
        <div style="font-size:12.5px; font-weight:700; color:var(--fich-text-muted); margin-bottom:-4px;">
          Mostrando ${servicesList.length} servicios para <strong>${FichState.filterFecha === 'todas' ? 'todo Octubre' : FichState.filterFecha}</strong>:
        </div>

        ${servicesList.map(svc => {
          const isCollapsed = !!FichState.collapsedServices[svc.nombre];

          return `
            <div class="fich-service-card">
              <div class="fich-service-header" onclick="window.FichajesModule.toggleService('${svc.nombre.replace(/'/g, "\\'")}')">
                <div class="fich-service-title">
                  <span style="font-size:16px;">${isCollapsed ? '▶' : '▼'}</span>
                  <div>
                    <div class="fich-service-name">${svc.nombre}</div>
                    <div class="fich-service-client">Cliente: ${svc.cliente}</div>
                  </div>
                </div>

                <div class="fich-service-badges">
                  ${svc.countOk > 0 ? `<span class="fich-check-badge badge-ok">🟢 ${svc.countOk} OK 100%</span>` : ''}
                  ${svc.countNoOk > 0 ? `<span class="fich-check-badge badge-nook">🟡 ${svc.countNoOk} Problemas</span>` : ''}
                  ${svc.countNoFicha > 0 ? `<span class="fich-check-badge badge-noficha">🔴 ${svc.countNoFicha} No Ficha</span>` : ''}
                  ${svc.countBaja > 0 ? `<span class="fich-check-badge badge-baja">🩺 ${svc.countBaja} BAJA IT</span>` : ''}
                  <span class="fich-badge-count" style="font-weight:900; background:#e0f2fe; color:#0369a1;">Total: ${svc.totalFichajes} marcajes</span>
                </div>
              </div>

              <div class="fich-service-body ${isCollapsed ? 'collapsed' : ''}">
                <div style="padding:14px 18px; display:flex; flex-direction:column; gap:10px;">
                  ${svc.trabajadores.map(w => {
                    return `
                      <div style="background:${w.check === 'baja' ? '#faf5ff' : '#f8fafc'}; border:1px solid ${w.check === 'baja' ? '#ddd6fe' : 'var(--fich-border)'}; border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                          <span class="fich-check-badge ${w.badgeClass}" style="min-width:115px; justify-content:center;">
                            ${w.label}
                          </span>
                          <div>
                            <div style="font-size:13.5px; font-weight:800; color:var(--fich-text-main);">
                              ${w.nombre}
                              ${w.check === 'baja' ? `<span style="font-size:11px; background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700;">🩺 EN BAJA MÉDICA</span>` : ''}
                            </div>
                            <div class="fich-check-detail ${w.check === 'nook' ? 'alerta' : (w.check === 'noficha' ? 'peligro' : '')}">
                              ${w.motivo}
                            </div>
                          </div>
                        </div>

                        <div style="display:flex; align-items:center; gap:14px; font-size:12px;">
                          ${w.check === 'baja' ? `
                            <span style="color:#6d28d9; font-weight:800; background:#ede9fe; padding:4px 10px; border-radius:6px; border:1px solid #c4b5fd;">
                              🩺 NO CONTABILIZADO (Justificado IT)
                            </span>
                          ` : (w.fichajes.length > 0 ? `
                            <span style="color:#16a34a; font-weight:800;">🟢 ${w.entradas} Entradas</span>
                            <span style="color:#dc2626; font-weight:800;">🔴 ${w.salidas} Salidas</span>
                            <span class="fich-metodo-badge app-gps">📱 APP</span>
                            <button class="fich-btn-action" style="padding:4px 8px; font-size:11px;" onclick="window.FichajesModule.setFilterTrabajador('${w.nombre}'); window.FichajesModule.setViewMode('listado');">
                              Ver Marcajes
                            </button>
                          ` : `
                            <span style="color:#991b1b; font-weight:800; background:#fee2e2; padding:3px 8px; border-radius:6px;">
                              ⚠️ Sin actividad registrada
                            </span>
                          `)}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // VISTA 2: RESUMEN Y CHECK TRABAJADORES (Con Cartel y Exclusión de Bajas)
  function renderWorkersCheckView(workers) {
    if (workers.length === 0) {
      return `
        <div style="background:#ffffff; border:1px solid var(--fich-border); border-radius:12px; padding:60px 20px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">👤</div>
          <h3 style="font-size:16px; font-weight:800; color:var(--fich-text-main); margin-bottom:6px;">No hay trabajadores con este filtro</h3>
          <p style="font-size:13px; color:var(--fich-text-muted); max-width:450px; margin:0 auto 16px;">Prueba cambiando el semáforo o el cliente seleccionado.</p>
          <button class="fich-btn-action" onclick="window.FichajesModule.resetFilters()">Restablecer Filtros</button>
        </div>
      `;
    }

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px;">
        ${workers.map(w => {
          const borderColor = w.check === 'ok' ? '#10b981' : (w.check === 'nook' ? '#f59e0b' : (w.check === 'baja' ? '#7c3aed' : '#ef4444'));

          return `
            <div class="fich-worker-card ${w.check === 'baja' ? 'is-baja' : ''}" style="border-top: 4px solid ${borderColor};">
              <div class="fich-worker-card-header">
                <div>
                  <div class="fich-worker-name">
                    ${w.nombre}
                  </div>
                  <div class="fich-worker-dni">DNI: ${w.dni || 'N/A'} · Cód: ${w.codigo || 'N/A'}</div>
                </div>
                <span class="fich-check-badge ${w.badgeClass}">
                  ${w.label}
                </span>
              </div>

              <!-- Cartel / Diagnóstico -->
              <div style="background:${w.check === 'baja' ? '#ede9fe' : '#f8fafc'}; border:1px solid ${w.check === 'baja' ? '#c4b5fd' : 'var(--fich-border)'}; border-radius:8px; padding:8px 12px; font-size:11.5px;">
                <div style="font-weight:800; color:${w.check === 'baja' ? '#5b21b6' : '#334155'}; margin-bottom:2px;">
                  ${w.check === 'baja' ? '🩺 CARTEL DE BAJA MÉDICA IT:' : 'Diagnóstico de fichaje:'}
                </div>
                <div class="fich-check-detail ${w.check === 'nook' ? 'alerta' : (w.check === 'noficha' ? 'peligro' : '')}" style="margin:0; ${w.check === 'baja' ? 'color:#5b21b6; font-weight:700;' : ''}">
                  ${w.motivo}
                </div>
              </div>

              <!-- KPIs de Marcajes -->
              <div class="fich-worker-kpis">
                <div class="fich-worker-kpi-item">
                  <span class="fich-worker-kpi-val" style="color:#0284c7;">${w.total}</span>
                  <span class="fich-worker-kpi-lbl">Total Fichajes</span>
                </div>
                <div class="fich-worker-kpi-item">
                  <span class="fich-worker-kpi-val" style="color:#10b981;">${w.entradas}</span>
                  <span class="fich-worker-kpi-lbl">Entradas</span>
                </div>
                <div class="fich-worker-kpi-item">
                  <span class="fich-worker-kpi-val" style="color:#ef4444;">${w.salidas}</span>
                  <span class="fich-worker-kpi-lbl">Salidas</span>
                </div>
              </div>

              <div style="font-size:11.5px; color:#475569;">
                <div><strong>Cliente:</strong> ${w.cliente}</div>
                <div style="margin-top:2px;"><strong>Centro:</strong> ${w.centro}</div>
              </div>

              ${w.check === 'baja' ? `
                <div style="border-top:1px solid #ddd6fe; padding-top:8px; font-size:11px; color:#6d28d9; font-weight:800; text-align:center;">
                  🩺 Excluido del cómputo de fichajes por prescripción médica
                </div>
              ` : (w.fichajes.length > 0 ? `
                <div style="border-top:1px solid #f1f5f9; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                  <button class="fich-btn-action" style="padding:4px 10px; font-size:11px; width:100%; justify-content:center;" onclick="window.FichajesModule.setFilterTrabajador('${w.nombre}'); window.FichajesModule.setViewMode('listado');">
                    Ver Historial de Marcajes (${w.fichajes.length})
                  </button>
                </div>
              ` : `
                <div style="border-top:1px solid #f1f5f9; padding-top:8px; font-size:11px; color:#dc2626; font-weight:700; text-align:center;">
                  ⚠️ Operario activo sin marcaje: Notificar activación en app
                </div>
              `)}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Helper oficial de clasificación sectorial para Barcelona (Delegación 0801)
  function getSectorTrabajador(w) {
    if (!w) return 'LIMPIEZA';
    const gid = String(w.gestor_id || '').trim();
    const s = String(w.servicio || '').toUpperCase();
    const c = String(w.cliente || '').toUpperCase();
    const sec = String(w.sector || '').toUpperCase();
    if (gid === '00062620' || s.includes('INDRA') || c.includes('INDRA') || s.includes('ROC BORONAT')) {
      return 'INDRA';
    }
    if (s.includes('ALDI') || c.includes('ALDI') || sec.includes('ALDI')) {
      return 'ALDI';
    }
    if (sec.includes('JARDIN') || sec.includes('MEDIO') || s.includes('JARDIN')) {
      return 'MEDIO_AMBIENTE';
    }
    if (sec.includes('AUX') || s.includes('(AUX)') || s.includes('AUXILIAR') || s.includes('CONSERJ') || s.includes('CONTROL ACCESO')) {
      return 'AUXILIARES';
    }
    if (gid === '00066957' || s.includes('MULTI') || c.includes('MULTI') || sec.includes('MULTI')) {
      return 'MULTICLIENTE';
    }
    return 'LIMPIEZA';
  }

  // Helper para filtrar y ordenar trabajadores del portal de la app (Ultra-optimizado con caché O(1))
  function getContrasteFilteredWorkers() {
    let list = [];
    if (window.FichajesCarterasUnifier && typeof window.FichajesCarterasUnifier.buildUnifiedFichajesContraste === 'function') {
      const unified = window.FichajesCarterasUnifier.buildUnifiedFichajesContraste(window.FICHAJES_CONTRASTE_PAYLOAD, window.HO_CARTERAS_PAYLOAD);
      list = unified.trabajadores || [];
    } else {
      const payload = window.FICHAJES_CONTRASTE_PAYLOAD || { trabajadores: [], fecha_sincronizacion: 'En Vivo' };
      list = payload.trabajadores || [];
    }
    const mesActivo = FichState.contrasteMes || 10;
    const anioActivo = FichState.contrasteAnio || 2026;
    const mesActual = mesActivo;
    const anioActual = anioActivo;
    const mesPad = String(mesActivo).padStart(2, '0');
    const anioStr = String(anioActivo);
    const mesKey = `${anioStr}-${mesPad}`;
    const nowRef = new Date();
    const totalDiasMesActivo = new Date(anioActivo, mesActivo, 0).getDate();
    const maxDiaTranscurrido = (nowRef.getFullYear() === anioActivo && (nowRef.getMonth() + 1) === mesActivo)
      ? nowRef.getDate()
      : ((anioActivo < nowRef.getFullYear() || (anioActivo === nowRef.getFullYear() && mesActivo < (nowRef.getMonth() + 1))) ? totalDiasMesActivo : 0);

    const syncStamp = (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion) || 'v1';
    const cacheKeyMes = `${mesKey}|${maxDiaTranscurrido}|${syncStamp}`;
    const isCurrentMonthToday = (nowRef.getFullYear() === anioActivo && (nowRef.getMonth() + 1) === mesActivo);
    const todayDateNum = nowRef.getDate();

    // Precalcular días de fin de semana del mes activo una sola vez
    const weekendDaySet = new Set();
    for (let d = 1; d <= totalDiasMesActivo; d++) {
      const dow = new Date(anioActivo, mesActivo - 1, d).getDay();
      if (dow === 0 || dow === 6) weekendDaySet.add(d);
    }

    const dSelActive = (FichState.contrasteDia && FichState.contrasteDia !== 'todos')
      ? String(FichState.contrasteDia).padStart(2, '0')
      : null;
    const dSelNum = dSelActive ? parseInt(dSelActive, 10) : 0;

    // Normalizar estado canónico y calcular trazabilidad exacta de días fichados, incompletos y fallados (Cacheado por mes/sync)
    for (let i = 0; i < list.length; i++) {
      const w = list[i];

      if (w._calcCacheKey !== cacheKeyMes) {
        const fichajesPorDiaMap = Object.create(null);
        const fMes = [];
        const rawFichs = w.fichajes || [];
        for (let j = 0; j < rawFichs.length; j++) {
          const f = rawFichs[j];
          if (!f.fecha) continue;
          const p = f.fecha.split('/');
          if (p[1] === mesPad && (!p[2] || p[2] === anioStr)) {
            fMes.push(f);
            const dKey = String(p[0]).padStart(2, '0');
            if (!fichajesPorDiaMap[dKey]) fichajesPorDiaMap[dKey] = [];
            fichajesPorDiaMap[dKey].push(f);
          }
        }
        w.fichajes_mes_activo = fMes;
        w._fichajesPorDiaMap = fichajesPorDiaMap;

        if (fMes.length > 0) {
          w.dias_fichados_activos = Object.keys(fichajesPorDiaMap).sort();
        } else if (mesActivo === 10 && anioActivo === 2026 && (w.dias_fichados || []).length > 0) {
          w.dias_fichados_activos = w.dias_fichados.map(d => String(d).padStart(2, '0')).sort();
        } else {
          w.dias_fichados_activos = [];
        }

        const esBaja = esOperarioDeBaja(w.nombre, w.dni, w);
        const esVac = esOperarioDeVacaciones(w.nombre, w.dni, w);

        if (esBaja) {
          w.isBaja = true;
          w.en_baja = true;
          w.de_vacaciones = false;
          w.estado_semaforo = 'baja';
          w.estado_hoy = 'BAJA_IT';
          w.situacion_personal = 'BAJA_IT';
          w.diagnostico = '🩺 BAJA MÉDICA IT JUSTIFICADA (Incapacidad Temporal en SAP HO / CTI)';
          w.diagnostico_hoy = '🏥 En situación de Baja Médica (IT) justificada en SAP HO';
        } else if (esVac) {
          w.isBaja = false;
          w.en_baja = false;
          w.de_vacaciones = true;
          w.estado_semaforo = 'vacaciones';
          w.estado_hoy = 'VACACIONES';
          w.situacion_personal = 'VACACIONES';
          w.diagnostico = '🏖️ PERIODO VACACIONAL / PERMISO JUSTIFICADO (Aprobado en SAP HO / CTI)';
          w.diagnostico_hoy = '🏖️ De vacaciones según planificación oficial de SAP HO';
        } else {
          w.isBaja = false;
          w.en_baja = false;
          w.de_vacaciones = false;
          w.situacion_personal = 'ACTIVO';
          if (w.estado_semaforo === 'baja' || w.estado_semaforo === 'vacaciones') {
            w.estado_semaforo = (w.total_fichajes > 0 || w.dias_fichados_activos.length > 0) ? 'ok' : 'noficha';
          }
          if (w.estado_hoy === 'BAJA_IT' || w.estado_hoy === 'VACACIONES') {
            w.estado_hoy = (w.dias_fichados_activos.includes(String(todayDateNum).padStart(2, '0'))) ? 'FINALIZADO' : 'NO_FICHADO';
          }
        }

        const diasFichadosSet = new Set(w.dias_fichados_activos);
        w._diasFichadosSet = diasFichadosSet;
        w.usa_app_mes = (diasFichadosSet.size > 0 || (w.total_fichajes || 0) > 0);

        const diasFallados = [];
        const diasIncompletos = [];
        const v2Month = (w.meses && w.meses[mesKey]) ? w.meses[mesKey] : null;
        const esVacacionesGlobal = (w.estado_hoy === 'VACACIONES' || w.de_vacaciones);
        const esBajaGlobal = Boolean(w.isBaja || w.en_baja || w.estado_semaforo === 'baja');

        if (!esBajaGlobal && !esVacacionesGlobal && maxDiaTranscurrido > 0) {
          // Si el backend ya calculó los días fallados reales con CTI, usarlos directamente
          if (Array.isArray(w.dias_fallados_activos) && w._calcCacheKey === cacheKeyMes) {
            diasFallados.push(...w.dias_fallados_activos);
          } else {
            for (let d = 1; d <= maxDiaTranscurrido; d++) {
              const dPad = String(d).padStart(2, '0');
              const estContrato = getEstadoContractualDia(w, d, mesActivo, anioActivo);
              if (!estContrato.contratado) continue;

              const dayCal = (w.calendar_days && (w.calendar_days[String(d)] || w.calendar_days[dPad])) || {};
              if (dayCal.isBaja || dayCal.isVacaciones || dayCal.isDescanso || dayCal.isNoContrato) continue;

              if (diasFichadosSet.has(dPad)) {
                const v2Day = (v2Month && v2Month.dias) ? v2Month.dias[dPad] : null;
                if (v2Day && (v2Day.estado === 'INCOMPLETO_SIN_SALIDA' || v2Day.estado === 'SOLO_SALIDA')) {
                  diasIncompletos.push(dPad);
                } else if (!v2Day) {
                  const dFichs = fichajesPorDiaMap[dPad] || [];
                  let tieneEnt = false;
                  let tieneSal = false;
                  for (let k = 0; k < dFichs.length; k++) {
                    const fk = dFichs[k];
                    const tLow = (fk.tipo || '').toLowerCase();
                    if (fk.isEntrada || tLow.includes('entrada')) tieneEnt = true;
                    if (!fk.isEntrada || tLow.includes('salida')) tieneSal = true;
                  }
                  const isHoy = (isCurrentMonthToday && d === todayDateNum);
                  if (!isHoy && dFichs.length > 0 && (!tieneEnt || !tieneSal)) {
                    diasIncompletos.push(dPad);
                  }
                }
              } else if (dayCal.isFallo || (w.usa_app_mes && !weekendDaySet.has(d) && !w.es_trabajador_finde)) {
                diasFallados.push(dPad);
              }
            }
          }
        }
        w.dias_fallados_activos = esBajaGlobal ? [] : (w.dias_fallados_activos || diasFallados);
        w.dias_incompletos_activos = diasIncompletos;
        w._diasIncompletosSet = new Set(diasIncompletos);
        w._diasFalladosSet = new Set(w.dias_fallados_activos);
        w._searchBlob = `${w.nombre || ''} ${w.dni || ''} ${w.servicio || ''} ${w.cliente || ''} ${w.sector || ''} ${w.gestor_nombre || ''} ${w.gestor_corto || ''} ${(w.dias_fichados_activos || w.dias_fichados || []).join(' ')}`.toLowerCase();
        w._calcCacheKey = cacheKeyMes;
      }

      // Si hay un día específico seleccionado, calcular el estado exacto de ESE día cruzado con CTI / SAP HO
      if (dSelActive) {
        const estC = getEstadoContractualDia(w, dSelNum, mesActivo, anioActivo);
        const dayCal = (w.calendar_days && (w.calendar_days[String(dSelNum)] || w.calendar_days[dSelActive])) || {};
        const fichoEseDia = w._diasFichadosSet && w._diasFichadosSet.has(dSelActive);
        const incompletoEseDia = w._diasIncompletosSet && w._diasIncompletosSet.has(dSelActive);

        if (!estC.contratado || dayCal.isNoContrato) {
          w.estado_dia_sel = 'nocontrato';
        } else if (fichoEseDia) {
          w.estado_dia_sel = incompletoEseDia ? 'nook' : 'ok';
        } else if (dayCal.isBaja || w.isBaja || w.en_baja || w.estado_semaforo === 'baja' || (w.dias_baja_activos && w.dias_baja_activos.includes(dSelActive))) {
          w.estado_dia_sel = 'baja';
        } else if (dayCal.isVacaciones || w.estado_hoy === 'VACACIONES' || w.de_vacaciones || (w.dias_vacaciones_activos && w.dias_vacaciones_activos.includes(dSelActive))) {
          w.estado_dia_sel = 'vacaciones';
        } else if (dayCal.isDescanso || (w.dias_descanso_activos && w.dias_descanso_activos.includes(dSelActive))) {
          w.estado_dia_sel = 'descanso';
        } else if (dayCal.isFallo || (w.usa_app_mes && !dayCal.isDescanso)) {
          w.estado_dia_sel = 'fallo_app';
        } else {
          w.estado_dia_sel = 'nunca_app';
        }
      } else {
        w.estado_dia_sel = null;
      }
    }

    const q = (FichState.search || '').toLowerCase().trim();
    const gestorFilter = FichState.contrasteGestor || 'todos';
    const sectorFilter = FichState.contrasteSector || 'todos';
    const semaforoFilter = FichState.contrasteSemaforo || 'todos';
    const sortMode = FichState.contrasteSort || 'nombre';
    const cFilters = FichState.compactColFilters || {};

    let filtered = list.filter(w => {
      // Filtro por Gestor de Operaciones de Barcelona (con soporte multi-formato, tildes y IDs)
      if (gestorFilter !== 'todos') {
        const gid = String(w.gestor_id || '').trim();
        const normFilter = normalizeText(gestorFilter);
        const normCorto = normalizeText(w.gestor_corto || '');
        const normNom = normalizeText(w.gestor_nombre || '');
        const gList = getGestoresDisponiblesList();
        const gObj = gList.find(g => g.id === gestorFilter || normalizeText(g.nombre_corto) === normFilter || normalizeText(g.nombre) === normFilter);

        const match = (gid === gestorFilter) ||
                      (normFilter && (normCorto.includes(normFilter) || normFilter.includes(normCorto) || normNom.includes(normFilter) || normFilter.includes(normNom))) ||
                      (gObj && (gid === gObj.id || normCorto.includes(normalizeText(gObj.nombre_corto)) || normalizeText(gObj.nombre_corto).includes(normCorto) || normNom.includes(normalizeText(gObj.nombre_corto))));
        if (!match) return false;
      }

      if (q) {
        if (!(w._searchBlob || '').includes(q)) return false;
      }
      if (sectorFilter !== 'todos') {
        const sec = getSectorTrabajador(w);
        const wSec = String(w.sector || '').toUpperCase();
        if (sectorFilter === 'LIMPIEZA' && sec !== 'LIMPIEZA') return false;
        if (sectorFilter === 'AUXILIARES' && sec !== 'AUXILIARES') return false;
        if (sectorFilter === 'INDRA' && sec !== 'INDRA') return false;
        if (sectorFilter === 'MULTICLIENTE' && sec !== 'MULTICLIENTE') return false;
        if (sectorFilter === 'ALDI' && sec !== 'ALDI' && !wSec.includes('ALDI')) return false;
        if (sectorFilter === 'MEDIO_AMBIENTE' && sec !== 'MEDIO_AMBIENTE' && !wSec.includes('MEDIO') && !wSec.includes('JARDIN')) return false;
      }
      // Si estamos en vista de mes completo, aplicar semaforoFilter mensual; si hay día seleccionado, aplicarlo al estado de ese día
      if (semaforoFilter !== 'todos') {
        if (FichState.contrasteDia && FichState.contrasteDia !== 'todos') {
          if (semaforoFilter === 'ok' && w.estado_dia_sel !== 'ok') return false;
          if (semaforoFilter === 'nook' && w.estado_dia_sel !== 'nook' && w.estado_dia_sel !== 'fallo_app') return false;
          if (semaforoFilter === 'noficha' && w.estado_dia_sel !== 'fallo_app' && w.estado_dia_sel !== 'nunca_app') return false;
          if (semaforoFilter === 'baja' && w.estado_dia_sel !== 'baja') return false;
          if (semaforoFilter === 'vacaciones' && w.estado_dia_sel !== 'vacaciones') return false;
        } else {
          if (w.estado_semaforo !== semaforoFilter) return false;
        }
      }

      // Filtro reactivo por Día de Fichaje y Modo (fallo_app / ficho / incompleto / baja / vacaciones / descanso / nunca_app / todos)
      if (FichState.contrasteDia && FichState.contrasteDia !== 'todos') {
        const diaPad = String(FichState.contrasteDia).padStart(2, '0');
        const diaNum = parseInt(diaPad, 10);
        const estContrato = getEstadoContractualDia(w, diaNum, mesActual, anioActual);

        // Si el trabajador NO estaba de alta o ya había finalizado su contrato en este día específico
        if (!estContrato.contratado) {
          if (FichState.contrasteDiaModo !== 'todos') return false;
        } else {
          if (FichState.contrasteDiaModo === 'ficho' && w.estado_dia_sel !== 'ok' && w.estado_dia_sel !== 'nook') return false;
          if (FichState.contrasteDiaModo === 'incompleto' && w.estado_dia_sel !== 'nook') return false;
          if (FichState.contrasteDiaModo === 'fallo_app' && w.estado_dia_sel !== 'fallo_app') return false;
          if (FichState.contrasteDiaModo === 'baja' && w.estado_dia_sel !== 'baja') return false;
          if (FichState.contrasteDiaModo === 'vacaciones' && w.estado_dia_sel !== 'vacaciones') return false;
          if (FichState.contrasteDiaModo === 'descanso' && w.estado_dia_sel !== 'descanso') return false;
          if (FichState.contrasteDiaModo === 'nunca_app' && w.estado_dia_sel !== 'nunca_app') return false;
        }
      }

      // Buscadores individuales por cada columna de la tabla compacta (sensible al día seleccionado)
      if (cFilters.estado) {
        const est = cFilters.estado.toLowerCase().trim();
        if (est) {
          if (FichState.contrasteDia && FichState.contrasteDia !== 'todos') {
            if (est === 'ok' && w.estado_dia_sel !== 'ok') return false;
            if (est === 'nook' && w.estado_dia_sel !== 'nook' && w.estado_dia_sel !== 'fallo_app') return false;
            if (est === 'noficha' && w.estado_dia_sel !== 'fallo_app' && w.estado_dia_sel !== 'nunca_app') return false;
            if (est === 'baja' && w.estado_dia_sel !== 'baja') return false;
          } else {
            if (w.estado_semaforo !== est) return false;
          }
        }
      }
      if (cFilters.gestor) {
        const gVal = cFilters.gestor.toLowerCase().trim();
        const gStr = `${w.gestor_corto || ''} ${w.gestor_nombre || ''} ${w.empresa_badge || ''}`.toLowerCase();
        if (!gStr.includes(gVal)) return false;
      }
      if (cFilters.trabajador) {
        const tr = cFilters.trabajador.toLowerCase().trim();
        if (!(w.nombre || '').toLowerCase().includes(tr)) return false;
      }
      if (cFilters.dni) {
        const d = cFilters.dni.toLowerCase().trim();
        if (!(w.dni || '').toLowerCase().includes(d)) return false;
      }
      if (cFilters.servicio) {
        const s = cFilters.servicio.toLowerCase().trim();
        if (!(w.servicio || '').toLowerCase().includes(s)) return false;
      }
      if (cFilters.sector) {
        const sec = cFilters.sector.toLowerCase().trim();
        if (!(w.sector || '').toLowerCase().includes(sec)) return false;
      }
      if (cFilters.dia) {
        const dayVal = cFilters.dia.trim();
        const dayStr = dayVal.padStart(2, '0');
        const diasList = w.dias_fichados_activos || w.dias_fichados || [];
        const falladosList = w.dias_fallados_activos || [];
        const matchDay = diasList.some(d => d.includes(dayVal) || d === dayStr) || falladosList.some(d => d.includes(dayVal) || d === dayStr);
        if (!matchDay) return false;
      }
      if (cFilters.fichajes) {
        const minF = parseInt(cFilters.fichajes, 10);
        if (!isNaN(minF) && (w.total_fichajes || 0) < minF) return false;
      }
      if (cFilters.ultimo) {
        const ult = cFilters.ultimo.toLowerCase().trim();
        const uStr = w.ultimo_fichaje ? `${w.ultimo_fichaje.fecha} ${w.ultimo_fichaje.hora}` : '-';
        if (!uStr.toLowerCase().includes(ult)) return false;
      }
      if (cFilters.diagnostico) {
        const diag = cFilters.diagnostico.toLowerCase().trim();
        if (!(w.diagnostico || '').toLowerCase().includes(diag)) return false;
      }

      return true;
    });

    if (FichState.contrasteDia && FichState.contrasteDia !== 'todos') {
      // Ordenar priorizando a quienes tienen actividad/fallo puntual ese día por encima de los que tienen 0 en todo el mes
      const dayWeight = { fallo_app: 1, nook: 2, ok: 3, nunca_app: 4, baja: 5, nocontrato: 6 };
      filtered.sort((a, b) => {
        const wa = dayWeight[a.estado_dia_sel] || 99;
        const wb = dayWeight[b.estado_dia_sel] || 99;
        if (wa !== wb) return wa - wb;
        return (a.nombre || '').localeCompare(b.nombre || '');
      });
    } else if (sortMode === 'fichajes') {
      filtered.sort((a, b) => b.total_fichajes - a.total_fichajes);
    } else if (sortMode === 'semaforo') {
      const weight = { noficha: 1, nook: 2, ok: 3, baja: 4 };
      filtered.sort((a, b) => (weight[a.estado_semaforo] || 99) - (weight[b.estado_semaforo] || 99));
    } else {
      filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }

    return { list, filtered };
  }

  // Renderizar fila individual de la tabla compacta con letra en color negro
  function renderCompactTableRowHTML(w) {
    const diaActivo = (FichState.contrasteDia && FichState.contrasteDia !== 'todos') ? String(FichState.contrasteDia).padStart(2, '0') : null;
    const mesPadRow = String(FichState.contrasteMes || 10).padStart(2, '0');
    let badgeClass = 'badge-noficha';
    let badgeLabel = '🔴 NO FICHA';
    if (w.isBaja || w.en_baja || w.estado_semaforo === 'baja' || w.situacion_personal === 'BAJA_IT') {
      badgeClass = 'badge-baja';
      badgeLabel = '🩺 BAJA IT';
    } else if (w.isVacaciones || w.de_vacaciones || w.estado_semaforo === 'vacaciones' || w.situacion_personal === 'VACACIONES') {
      badgeClass = 'badge-vacaciones';
      badgeLabel = '🏖️ VACACIONES';
    } else if (w.estado_semaforo === 'ok') {
      badgeClass = 'badge-ok';
      badgeLabel = '🟢 OK 100%';
    } else if (w.estado_semaforo === 'nook') {
      badgeClass = 'badge-nook';
      badgeLabel = '🟡 PARCIAL';
    }

    if (diaActivo && w.estado_dia_sel) {
      if (w.estado_dia_sel === 'ok') {
        badgeClass = 'badge-ok';
        badgeLabel = `🟢 FICHÓ DÍA ${diaActivo}`;
      } else if (w.estado_dia_sel === 'nook') {
        badgeClass = 'badge-nook';
        badgeLabel = `🟡 SIN SALIDA DÍA ${diaActivo}`;
      } else if (w.estado_dia_sel === 'fallo_app') {
        badgeClass = 'badge-noficha';
        badgeLabel = `🔴 FALLÓ DÍA ${diaActivo}`;
      } else if (w.estado_dia_sel === 'nunca_app') {
        badgeClass = 'badge-noficha';
        badgeLabel = `⚫ 0 EN TODO EL MES`;
      } else if (w.estado_dia_sel === 'baja') {
        badgeClass = 'badge-baja';
        badgeLabel = `🩺 BAJA IT`;
      } else if (w.estado_dia_sel === 'vacaciones') {
        badgeClass = 'badge-vacaciones';
        badgeLabel = `🏖️ VACACIONES`;
      } else if (w.estado_dia_sel === 'descanso') {
        badgeClass = 'badge-descanso';
        badgeLabel = `☕ DESCANSO`;
      }
    }
    const ultFich = w.ultimo_fichaje ? `${w.ultimo_fichaje.fecha} ${w.ultimo_fichaje.hora}` : '-';
    const hasFichs = (w.fichajes && w.fichajes.length > 0);

    return `
      <tr>
        <td>
          <span class="fich-check-badge ${badgeClass}" style="font-size:10px; padding:2px 6px;">
            ${badgeLabel}
          </span>
        </td>
        <td>
          <span style="font-size:11px; font-weight:800; background:#f1f5f9; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; color:#000000 !important; white-space:nowrap;" title="${w.gestor_nombre || ''}">
            ${w.empresa_badge || '🏢 SIFU'} ${w.gestor_corto || 'A. Coscolin'}
          </span>
        </td>
        <td>
          <div style="font-weight:800; color:#000000 !important; font-size:12px;">${w.nombre}</div>
          ${w.inicio_contrato ? `<div style="font-size:10px; color:#0284c7; font-weight:700;">Alta: ${w.inicio_contrato}</div>` : ''}
          ${(w.fin_contrato && w.fin_contrato.toLowerCase() !== 'indefinido') ? `<div style="font-size:10px; color:#e11d48; font-weight:700;">Fin: ${w.fin_contrato}</div>` : ''}
        </td>
        <td>
          <span style="font-family:monospace; font-size:11px; color:#000000 !important; font-weight:700;">${w.dni}</span>
        </td>
        <td>
          <span style="font-size:11px; color:#000000 !important; font-weight:700;">${w.servicio}</span>
        </td>
        <td>
          <span style="font-size:10px; background:#e2e8f0; padding:2px 5px; border-radius:4px; color:#000000 !important; font-weight:800;">
            ${w.sector || 'OPERATIVA'}
          </span>
        </td>
        <td>
          ${(() => {
            const mesActual = FichState.contrasteMes || 10;
            const anioActual = FichState.contrasteAnio || 2026;
            const mesPad = String(mesActual).padStart(2, '0');
            const diasList = w.dias_fichados_activos || w.dias_fichados || [];
            if (FichState.contrasteDia && FichState.contrasteDia !== 'todos') {
              const diaPad = String(FichState.contrasteDia).padStart(2, '0');
              const diaNum = parseInt(diaPad, 10);
              const estContrato = getEstadoContractualDia(w, diaNum, mesActual, anioActual);

              if (!estContrato.contratado) {
                return `
                  <div style="font-size:11px; font-weight:800; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>⚪</span>
                    <span>${estContrato.label}</span>
                  </div>
                `;
              }

              const fichoEseDia = w._diasFichadosSet ? w._diasFichadosSet.has(diaPad) : diasList.includes(diaPad);
              const dFichs = (w._fichajesPorDiaMap && w._fichajesPorDiaMap[diaPad]) ? w._fichajesPorDiaMap[diaPad] : [];
              if (fichoEseDia && dFichs.length > 0) {
                const fEntrada = dFichs.find(f => f.isEntrada || (f.tipo || '').toLowerCase().includes('entrada'));
                const fSalida = [...dFichs].reverse().find(f => !f.isEntrada || (f.tipo || '').toLowerCase().includes('salida'));
                const entHora = fEntrada ? fEntrada.hora : (dFichs[0] ? dFichs[0].hora : '--:--');
                const salHora = (fSalida && fSalida !== fEntrada) ? fSalida.hora : (dFichs.length > 1 ? dFichs[dFichs.length - 1].hora : entHora);
                return `
                  <div style="font-size:11px; font-weight:800; color:#047857; background:#dcfce7; border:1px solid #86efac; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>🟢</span>
                    <span>Ent: ${entHora} ➔ Sal: ${salHora}</span>
                    <span style="font-size:10px; color:#15803d; font-weight:700;">(${dFichs.length} reg)</span>
                  </div>
                `;
              } else if (fichoEseDia) {
                return `
                  <div style="font-size:11px; font-weight:800; color:#047857; background:#dcfce7; border:1px solid #86efac; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>🟢</span>
                    <span>Marcaje registrado día ${diaPad}/${mesPad}</span>
                  </div>
                `;
              } else if (w.estado_dia_sel === 'baja' || (w.calendar_days && w.calendar_days[diaPad] && w.calendar_days[diaPad].isBaja)) {
                return `
                  <div style="font-size:11px; font-weight:800; color:#6d28d9; background:#f5f3ff; border:1px solid #ddd6fe; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>🩺</span>
                    <span>Baja Médica IT justificada (SAP HO / CTI)</span>
                  </div>
                `;
              } else if (w.estado_dia_sel === 'vacaciones' || (w.calendar_days && w.calendar_days[diaPad] && w.calendar_days[diaPad].isVacaciones)) {
                return `
                  <div style="font-size:11px; font-weight:800; color:#0284c7; background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>🏖️</span>
                    <span>Vacaciones / Permiso justificado (SAP HO / CTI)</span>
                  </div>
                `;
              } else if (w.estado_dia_sel === 'descanso' || (w.calendar_days && w.calendar_days[diaPad] && w.calendar_days[diaPad].isDescanso)) {
                return `
                  <div style="font-size:11px; font-weight:800; color:#475569; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>☕</span>
                    <span>Día de descanso según cuadrante CTI</span>
                  </div>
                `;
              } else if (w.usa_app_mes) {
                const falladosList = w.dias_fallados_activos || [];
                return `
                  <div style="display:flex; flex-direction:column; gap:3px;">
                    <div style="font-size:11px; font-weight:900; color:#dc2626; background:#fee2e2; border:1px solid #f87171; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                      <span>🔴</span>
                      <span>FALLÓ EL DÍA ${diaPad}/${mesPad} (Sí ficha otros ${diasList.length} días)</span>
                    </div>
                    <div style="font-size:10px; color:#334155; font-weight:700;">
                      🟢 Días que sí fichó: ${diasList.map(d => `<span class="fich-day-chip" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;">${d}</span>`).join('')}
                    </div>
                    ${falladosList.length > 1 ? `
                      <div style="font-size:10px; color:#be123c; font-weight:700;">
                        🔴 Todos sus días con fallo: ${falladosList.map(d => `<span class="fich-day-chip fallo" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;">${d}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              } else {
                return `
                  <div style="font-size:11px; font-weight:800; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:3px 7px; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
                    <span>⚫</span>
                    <span>Sin uso de App en todo el mes (0 marcajes en Octubre)</span>
                  </div>
                `;
              }
            } else {
              const falladosList = w.dias_fallados_activos || [];
              const incompletosList = w.dias_incompletos_activos || [];
              return `
                <div style="display:flex; flex-direction:column; gap:4px; max-width:300px;">
                  <div style="display:flex; align-items:center; gap:2px; flex-wrap:wrap;">
                    <span style="font-size:9.5px; font-weight:800; color:#15803d; margin-right:2px;">🟢 OK (${diasList.length}):</span>
                    ${diasList.map(d => `<span class="fich-day-chip ${incompletosList.includes(d) ? 'incompleto' : ''}" title="Día ${d}/${mesPad} ${incompletosList.includes(d) ? 'INCOMPLETO (Sin salida)' : 'fichado OK'} - Clic para auditar este día" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;">${d}</span>`).join('')}
                    ${diasList.length === 0 ? '<span style="color:#64748b; font-size:10px; font-weight:700;">Ninguno</span>' : ''}
                  </div>
                  ${(!w.isBaja && !w.en_baja && falladosList.length > 0) ? `
                    <div style="display:flex; align-items:center; gap:2px; flex-wrap:wrap;">
                      <span style="font-size:9.5px; font-weight:800; color:#dc2626; margin-right:2px;">🔴 Falló (${falladosList.length}):</span>
                      ${falladosList.map(d => `<span class="fich-day-chip fallo" title="🔴 FALLO Día ${d}/${mesPad}: Sin fichar - Clic para ver quién falló este día" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;">${d}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }
          })()}
        </td>
        <td style="font-weight:900; text-align:center; font-size:13px; color:${w.total_fichajes > 0 ? '#0284c7' : '#ef4444'};">
          ${w.total_fichajes}
        </td>
        <td style="font-family:monospace; font-size:11px; color:#000000 !important; white-space:nowrap; font-weight:600;">
          ${ultFich}
        </td>
        <td style="font-size:11px; color:#000000 !important; max-width:240px; font-weight:600;">
          ${w.diagnostico}
        </td>
        <td style="text-align:center;">
          <div style="display:flex; align-items:center; justify-content:center; gap:5px; flex-wrap:nowrap;">
            ${hasFichs ? `
              <button class="fich-btn-action" style="padding:2px 8px; font-size:10.5px; background:#0284c7; color:#ffffff !important; border:none; cursor:pointer;" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" title="Ver detalle de marcajes">
                👁️ Ver (${w.fichajes.length})
              </button>
            ` : ''}
            <button class="fich-btn-action" style="padding:2px 6px; font-size:10px; background:#fee2e2; color:#b91c1c !important; border:1px solid #fca5a5; border-radius:4px; font-weight:700; cursor:pointer; white-space:nowrap;" onclick="window.FichajesModule.marcarBajaEmpresa('${w.dni}', '${(w.nombre || '').replace(/'/g, "\\'")}')" title="Marcar como baja definitiva de SIFU (Ya no está en la empresa)">
              ❌ Baja SIFU
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // Obtener la fecha y hora de la última sincronización en vivo
  function getLastSyncContrasteTime() {
    const payload = window.FICHAJES_CONTRASTE_PAYLOAD;
    const payloadTime = payload && payload.fecha_sincronizacion;
    const localTime = localStorage.getItem('sifu_fichajes_last_sync_contraste');
    if (payloadTime) {
      localStorage.setItem('sifu_fichajes_last_sync_contraste', payloadTime);
      return payloadTime;
    }
    return localTime || '18/10/2026 14:36:55';
  }

  // VISTA PRINCIPAL: CONTRASTE EN TIEMPO REAL VÍA PORTAL EMPLEADO (gruposifuapp.gcalidad.com)
  function renderContrasteView() {
    const { list, filtered } = getContrasteFilteredWorkers();

    // Filtros locales
    const q = (FichState.search || '').toLowerCase().trim();
    const gestorFilter = FichState.contrasteGestor || 'todos';
    const sectorFilter = FichState.contrasteSector || 'todos';
    const semaforoFilter = FichState.contrasteSemaforo || 'todos';
    const subView = FichState.contrasteSubView || 'tarjetas';
    const sortMode = FichState.contrasteSort || 'nombre';
    const cFilters = FichState.compactColFilters || {};
    const diaSel = FichState.contrasteDia || 'todos';
    const diaModo = FichState.contrasteDiaModo || 'todos';

    const gestoresDisponibles = getGestoresDisponiblesList();
    const normGF = normalizeText(gestorFilter);
    const gObjActive = gestorFilter !== 'todos' ? gestoresDisponibles.find(g => g.id === gestorFilter || normalizeText(g.nombre_corto) === normGF || normalizeText(g.nombre) === normGF) : null;

    // Base de trabajadores acotada al gestor seleccionado (para que los KPIs reflejen fielmente el gestor)
    const listScope = gestorFilter === 'todos'
      ? list
      : list.filter(w => {
          const gid = String(w.gestor_id || '').trim();
          const normCorto = normalizeText(w.gestor_corto || '');
          const normNom = normalizeText(w.gestor_nombre || '');
          if (gid === gestorFilter || (gObjActive && gid === gObjActive.id)) return true;
          if (normGF && (normCorto.includes(normGF) || normGF.includes(normCorto) || normNom.includes(normGF))) return true;
          if (gObjActive) {
            const gObjNorm = normalizeText(gObjActive.nombre_corto);
            if (normCorto.includes(gObjNorm) || gObjNorm.includes(normCorto) || normNom.includes(gObjNorm)) return true;
          }
          return false;
        });

    // Contadores de estado canónicos (Las personas de baja IT y vacaciones no suman a ok, nook ni noficha)
    const countTotal = listScope.length;
    const countBaja = listScope.filter(w => w.estado_semaforo === 'baja' || w.isBaja || w.en_baja).length;
    const countVacaciones = listScope.filter(w => (w.estado_semaforo === 'vacaciones' || w.de_vacaciones) && !w.isBaja && !w.en_baja).length;
    const countOk = listScope.filter(w => w.estado_semaforo === 'ok' && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;
    const countNook = listScope.filter(w => w.estado_semaforo === 'nook' && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;
    const countNoFicha = listScope.filter(w => (w.estado_semaforo === 'noficha' || !w.estado_semaforo) && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;

    // Contadores por sector Barcelona
    const countIndra = listScope.filter(w => getSectorTrabajador(w) === 'INDRA').length;
    const countAuxiliares = listScope.filter(w => getSectorTrabajador(w) === 'AUXILIARES').length;
    const countMulticliente = listScope.filter(w => getSectorTrabajador(w) === 'MULTICLIENTE').length;
    const countLimpieza = listScope.filter(w => getSectorTrabajador(w) === 'LIMPIEZA').length;

    // Mes y Año seleccionados dinámicamente
    const mesActual = FichState.contrasteMes || 10;
    const anioActual = FichState.contrasteAnio || 2026;
    const nombreMes = NOMBRES_MESES[mesActual - 1] || 'Octubre';
    const diasMes = getDiasDelMes(mesActual, anioActual);
    const totalDiasEnMes = diasMes.length;

    const now = new Date();
    const isCurrentMonthYear = (now.getFullYear() === anioActual && (now.getMonth() + 1) === mesActual);
    const todayDay = now.getDate();

    const diaPad = diaSel !== 'todos' ? String(diaSel).padStart(2, '0') : '';
    const diaNum = diaSel !== 'todos' ? parseInt(diaPad, 10) : 0;
    
    // Solo se audita a quienes estaban de alta y con contrato vigente en la fecha seleccionada
    const trabajadoresConContratoEnDia = diaSel !== 'todos' 
      ? listScope.filter(w => getEstadoContractualDia(w, diaNum, mesActual, anioActual).contratado)
      : listScope;
    
    const countFichoDia = diaSel !== 'todos' 
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'ok' || w.estado_dia_sel === 'nook').length 
      : 0;
    const countIncompletoDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'nook').length
      : 0;
    const countBajaDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'baja').length
      : 0;
    const countVacacionesDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'vacaciones').length
      : 0;
    const countDescansoDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'descanso').length
      : 0;
    const countFalloAppDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'fallo_app').length
      : 0;
    const countNuncaAppDia = diaSel !== 'todos'
      ? trabajadoresConContratoEnDia.filter(w => w.estado_dia_sel === 'nunca_app').length
      : 0;
    const countNoFichoDia = countFalloAppDia;

    // Mapa de fallos reales por cada día del mes (solo trabajadores convocados que fallaron ese día específico)
    const fallosPorDiaMap = {};
    const ficharonPorDiaMap = {};
    diasMes.forEach(dObj => {
      let fallosCnt = 0;
      let fichoCnt = 0;
      const pad = dObj.pad;
      const numD = dObj.num;
      for (let i = 0; i < listScope.length; i++) {
        const w = listScope[i];
        const dayCal = (w.calendar_days && (w.calendar_days[String(numD)] || w.calendar_days[pad])) || {};
        if (dayCal.isOrange || (w._diasFichadosSet && w._diasFichadosSet.has(pad))) {
          fichoCnt++;
        }
        if (dayCal.isFallo || (w.usa_app_mes && w._diasFalladosSet && w._diasFalladosSet.has(pad))) {
          fallosCnt++;
        }
      }
      fallosPorDiaMap[pad] = fallosCnt;
      ficharonPorDiaMap[pad] = fichoCnt;
    });

    const countPorGestor = {};
    list.forEach(w => {
      const gid = String(w.gestor_id || '').trim();
      const gCortoNorm = String(w.gestor_corto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (gid) countPorGestor[gid] = (countPorGestor[gid] || 0) + 1;
      if (gCortoNorm) countPorGestor[gCortoNorm] = (countPorGestor[gCortoNorm] || 0) + 1;
    });

    function getGestorCount(g) {
      const gCortoNorm = String(g.nombre_corto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (countPorGestor[g.id]) return countPorGestor[g.id];
      if (countPorGestor[gCortoNorm]) return countPorGestor[gCortoNorm];
      const payloadGestores = (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.gestores) || [];
      const pg = payloadGestores.find(x => x.id === g.id);
      return pg ? (pg.total_trabajadores || 0) : 0;
    }

    // Segmentación de días para el select según la fecha actual del sistema
    let diasTranscurridosDesc = [];
    let diasProximosAsc = [];

    if (isCurrentMonthYear) {
      diasTranscurridosDesc = diasMes.filter(d => d.num <= todayDay).slice().reverse();
      diasProximosAsc = diasMes.filter(d => d.num > todayDay);
    } else if (anioActual < now.getFullYear() || (anioActual === now.getFullYear() && mesActual < (now.getMonth() + 1))) {
      diasTranscurridosDesc = diasMes.slice().reverse();
      diasProximosAsc = [];
    } else {
      diasTranscurridosDesc = [];
      diasProximosAsc = diasMes.slice();
    }

    // Render del mini-calendario mensual dinámico con cálculo matemático de turnos y horas reales
    function renderMiniCalendarHTML(calendarDays, fichajes, workerObj) {
      const dayNames = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DO'];
      let html = '<div class="fich-mini-cal"><div class="fich-mini-cal-header">';
      dayNames.forEach(d => {
        html += `<span class="fich-cal-head-day">${d}</span>`;
      });
      html += '</div><div class="fich-mini-cal-grid">';

      // Offset dinámico del primer día del mes: Lunes = 0, Domingo = 6
      const firstDayOffset = (new Date(anioActual, mesActual - 1, 1).getDay() + 6) % 7;
      for (let i = 0; i < firstDayOffset; i++) {
        html += '<div class="fich-cal-cell empty"></div>';
      }

      const mesPad = String(mesActual).padStart(2, '0');
      const mesKey = `${anioActual}-${mesPad}`;

      // Comprobar si el trabajador tiene datos v2 precalculados
      const v2Month = (workerObj && workerObj.meses && workerObj.meses[mesKey]) ? workerObj.meses[mesKey] : null;

      for (let day = 1; day <= totalDiasEnMes; day++) {
        const dStr = String(day).padStart(2, '0');
        const dayCal = (calendarDays && (calendarDays[String(day)] || calendarDays[dStr])) || {};
        const dayInfo = dayCal;
        const v2Day = (v2Month && v2Month.dias) ? v2Month.dias[dStr] : null;

        // Fichajes de este día (O(1) pre-indexado)
        const dFichs = (workerObj && workerObj._fichajesPorDiaMap && workerObj._fichajesPorDiaMap[dStr])
          ? workerObj._fichajesPorDiaMap[dStr]
          : [];

        const isHoy = isCurrentMonthYear && (day === todayDay);
        const dayDate = new Date(anioActual, mesActual - 1, day);
        const isFuturo = dayDate > now;

        let cellClass = 'fich-cal-cell fich-status-sinfichar';
        let tooltip = `Día ${dStr}/${mesPad}/${anioActual}: Sin fichaje registrado`;
        let horasBadge = '';

        const estContratoDia = getEstadoContractualDia(workerObj, day, mesActual, anioActual);

        if (!estContratoDia.contratado) {
          cellClass = 'fich-cal-cell fich-status-nocontrato';
          tooltip = `Día ${dStr}/${mesPad}/${anioActual}: ${estContratoDia.label}`;
        } else if (v2Day && v2Day.marcajes && v2Day.marcajes.length > 0) {
          const st = v2Day.estado;
          const hrs = v2Day.horas_trabajadas || 0;
          if (st === 'COMPLETO') {
            cellClass = 'fich-cal-cell fich-status-completo';
            tooltip = `Día ${dStr}/${mesPad} (${hrs}h trabajadas): ` + v2Day.marcajes.map(m => `${m.tipo} ${m.hora}`).join(' · ');
          } else if (st === 'EN_CURSO') {
            cellClass = 'fich-cal-cell fich-status-encurso';
            tooltip = `Día ${dStr}/${mesPad} (EN TURNO AHORA): Entrada ` + v2Day.marcajes.map(m => m.hora).join(' · ');
          } else {
            cellClass = 'fich-cal-cell fich-status-incompleto';
            tooltip = `Día ${dStr}/${mesPad} (Marcaje Parcial / Sin Salida): ` + v2Day.marcajes.map(m => `${m.tipo} ${m.hora}`).join(' · ');
          }
        } else if (dFichs.length > 0) {
          // Fallback inteligente para Schema v1
          const ent = dFichs.find(f => f.isEntrada || (f.tipo || '').toLowerCase().includes('entrada'));
          const sal = dFichs.find(f => !f.isEntrada || (f.tipo || '').toLowerCase().includes('salida'));
          if (ent && sal) {
            cellClass = 'fich-cal-cell fich-status-completo';
            tooltip = `Día ${dStr}/${mesPad} (Jornada Completa): ${ent.hora} ➔ ${sal.hora}`;
          } else if (isHoy) {
            cellClass = 'fich-cal-cell fich-status-encurso';
            tooltip = `Día ${dStr}/${mesPad} (Turno de hoy en curso): ` + dFichs.map(f => `${f.tipo} ${f.hora}`).join(' · ');
          } else {
            cellClass = 'fich-cal-cell fich-status-incompleto';
            tooltip = `Día ${dStr}/${mesPad} (Marcaje registrado): ` + dFichs.map(f => `${f.tipo} ${f.hora}`).join(' · ');
          }
        } else if (dayCal.isBaja || (workerObj && (workerObj.estado_semaforo === 'baja' || workerObj.isBaja || workerObj.en_baja || (workerObj.dias_baja_activos && workerObj.dias_baja_activos.includes(dStr))))) {
          cellClass = 'fich-cal-cell fich-status-baja';
          tooltip = `Día ${dStr}/${mesPad}/${anioActual}: 🩺 Baja Médica IT Justificada en SAP HO / CTI`;
        } else if (dayCal.isVacaciones || (workerObj && (workerObj.estado_semaforo === 'vacaciones' || workerObj.de_vacaciones || (workerObj.dias_vacaciones_activos && workerObj.dias_vacaciones_activos.includes(dStr))))) {
          cellClass = 'fich-cal-cell fich-status-vacaciones';
          tooltip = `Día ${dStr}/${mesPad}/${anioActual}: 🏖️ Vacaciones / Permiso en SAP HO / CTI`;
        } else if (dayCal.isDescanso || (workerObj && workerObj.dias_descanso_activos && workerObj.dias_descanso_activos.includes(dStr))) {
          cellClass = 'fich-cal-cell fich-status-descanso';
          tooltip = `Día ${dStr}/${mesPad}/${anioActual}: ☕ Descanso / Sin Turno según Cuadrante CTI`;
        } else if (isHoy) {
          cellClass = 'fich-cal-cell fich-status-hoy-vacio';
          tooltip = `🔴 Día ${dStr}/${mesPad}/${anioActual}: HOY (Sin marcaje registrado)`;
        } else if (isFuturo) {
          cellClass = 'fich-cal-cell empty';
          tooltip = `Día ${dStr}/${mesPad}/${anioActual}: Día futuro`;
        } else if (dayCal.isFallo || (workerObj && Array.isArray(workerObj.dias_fallados_activos) && workerObj.dias_fallados_activos.includes(dStr))) {
          cellClass = 'fich-cal-cell fich-status-fallo';
          tooltip = `🔴 FALLO Día ${dStr}/${mesPad}/${anioActual}: Trabajador activo SIN FICHAR (Clic para auditar este día)`;
        }

        if (FichState.contrasteDia && FichState.contrasteDia === dStr) {
          cellClass += ' selected-day';
        }

        html += `<div class="${cellClass}" title="${tooltip} - Clic para filtrar este día" onclick="window.FichajesModule.setContrasteDia('${dStr}')" style="cursor:pointer;"><span>${dStr}</span></div>`;
      }

      html += '</div></div>';
      return html;
    }

    // Modal Flotante de Marcajes si un trabajador está seleccionado
    function renderModalDetalleHTML() {
      if (!FichState.activeModalWorkerDNI) return '';
      const w = list.find(x => x.dni === FichState.activeModalWorkerDNI);
      if (!w) return '';

      return `
        <div class="fich-modal-backdrop" onclick="window.FichajesModule.closeModal(event)">
          <div class="fich-modal-content" onclick="event.stopPropagation()">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
              <div>
                <div style="font-size:16px; font-weight:800; color:#0f172a;">${w.nombre}</div>
                <div style="font-size:12px; color:#64748b; font-family:monospace; margin-top:2px;">
                  DNI: <strong>${w.dni}</strong> · ${w.servicio}
                </div>
              </div>
              <button class="fich-col-clear-btn" style="width:auto; padding:4px 12px; font-size:11px;" onclick="window.FichajesModule.closeModal()">✕ Cerrar</button>
            </div>

            <!-- Resumen de Trazabilidad Exacta de Días Fallados vs Fichados en el Modal -->
            <div style="margin-top:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <span style="font-size:11.5px; font-weight:800; color:#0f172a;">📊 Trazabilidad Mensual (${nombreMes} ${anioActual}):</span>
                <span style="font-size:11px; font-weight:800; color:#15803d;">🟢 ${(w.dias_fichados_activos || []).length} días fichados · 🔴 ${(w.dias_fallados_activos || []).length} días sin fichar · 🟡 ${(w.dias_incompletos_activos || []).length} incompletos</span>
              </div>
              ${(w.dias_fallados_activos && w.dias_fallados_activos.length > 0) ? `
                <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span style="font-size:11px; font-weight:800; color:#dc2626;">🔴 Días exactos que NO fichó:</span>
                  ${w.dias_fallados_activos.map(d => `<span class="fich-day-chip fallo" style="cursor:pointer;" onclick="window.FichajesModule.closeModal(); window.FichajesModule.setContrasteDia('${d}')" title="Ir al día ${d}/${String(mesActual).padStart(2, '0')}">${d}/${String(mesActual).padStart(2, '0')}</span>`).join('')}
                </div>
              ` : ''}
              ${(w.dias_incompletos_activos && w.dias_incompletos_activos.length > 0) ? `
                <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span style="font-size:11px; font-weight:800; color:#b45309;">🟡 Días incompletos (Sin salida):</span>
                  ${w.dias_incompletos_activos.map(d => `<span class="fich-day-chip incompleto" style="cursor:pointer;" onclick="window.FichajesModule.closeModal(); window.FichajesModule.setContrasteDia('${d}')" title="Ir al día ${d}/${String(mesActual).padStart(2, '0')}">${d}/${String(mesActual).padStart(2, '0')}</span>`).join('')}
                </div>
              ` : ''}
            </div>

            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#334155;">Historial de Fichajes Registrados (${(w.fichajes || []).length}):</span>
              <span style="font-size:11px; color:#15803d; font-weight:800;">🟢 ${(w.dias_fichados_activos || []).length} días con marcaje</span>
            </div>

            <div style="margin-top:8px; max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding-right:4px;">
              ${(w.fichajes || []).length > 0 ? (w.fichajes || []).map(f => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; border-bottom:1px dashed #f1f5f9; padding:6px 4px; background:#f8fafc; border-radius:6px;">
                  <span style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; color:#0f172a;">${f.fecha}</span>
                    <span style="font-family:monospace; font-weight:800; color:#475569;">${f.hora}</span>
                  </span>
                  <span style="font-weight:800; padding:2px 7px; border-radius:4px; font-size:10.5px; background:${f.isEntrada ? '#dcfce7' : '#fee2e2'}; color:${f.isEntrada ? '#15803d' : '#b91c1c'};">
                    ${f.tipo}
                  </span>
                  <span style="font-size:10.5px; color:#64748b; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.punto}">
                    ${f.punto || '-'}
                  </span>
                </div>
              `).join('') : `
                <div style="padding:14px; text-align:center; color:#991b1b; background:#fef2f2; border-radius:8px; font-size:12px; font-weight:700;">
                  ⚠️ No existen registros de fichaje para este trabajador en el portal.
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    // VISTA 3: TABLERO HOY EN VIVO (KANBAN OPERATIVO)
    function renderHoyBoardHTML() {
      const trabajando = filtered.filter(w => w.estado_hoy === 'TRABAJANDO');
      const finalizados = filtered.filter(w => w.estado_hoy === 'FINALIZADO');
      const deBaja = filtered.filter(w => (w.isBaja || w.estado_hoy === 'BAJA_IT' || w.estado_semaforo === 'baja') && w.estado_hoy !== 'TRABAJANDO' && w.estado_hoy !== 'FINALIZADO');
      const sinFichar = filtered.filter(w => !w.isBaja && w.estado_semaforo !== 'baja' && w.estado_hoy !== 'BAJA_IT' && (w.estado_hoy === 'NO_FICHADO' || w.estado_hoy === 'SIN_MARCAJE'));

      return `
        <div id="fich-today-board-container" class="fich-today-board">
          <!-- Columna 1: En Turno Ahora -->
          <div class="fich-board-col">
            <div class="fich-board-col-header" style="color:#16a34a;">
              <span>🟢 EN TURNO AHORA (${trabajando.length})</span>
              <span style="font-size:11px; background:#dcfce7; padding:2px 8px; border-radius:12px;">Activos</span>
            </div>
            ${trabajando.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Ningún trabajador en turno actualmente.</div>' : ''}
            ${trabajando.map(w => `
              <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #16a34a;">
                <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                <div style="margin-top:6px; font-size:11.5px; font-weight:700; color:#16a34a; display:flex; justify-content:space-between;">
                  <span>Entrada: ${w.ultimo_fichaje ? w.ultimo_fichaje.hora : '--:--'}</span>
                  <span>📍 ${w.ultimo_fichaje ? (w.ultimo_fichaje.punto || '').substring(0, 18) : ''}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Columna 2: Jornada Finalizada Hoy -->
          <div class="fich-board-col">
            <div class="fich-board-col-header" style="color:#0284c7;">
              <span>🏁 TURNO COMPLETADO (${finalizados.length})</span>
              <span style="font-size:11px; background:#e0f2fe; padding:2px 8px; border-radius:12px;">Salida OK</span>
            </div>
            ${finalizados.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Aún no hay turnos finalizados hoy.</div>' : ''}
            ${finalizados.map(w => `
              <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #0284c7;">
                <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                <div style="margin-top:6px; font-size:11.5px; font-weight:700; color:#0284c7; display:flex; justify-content:space-between;">
                  <span>Última Salida: ${w.ultimo_fichaje ? w.ultimo_fichaje.hora : '--:--'}</span>
                  <span>✅ Fin</span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Columna 3: Pendiente / Sin Marcaje Hoy (Solo activos convocados) -->
          <div class="fich-board-col">
            <div class="fich-board-col-header" style="color:#dc2626;">
              <span>🔴 PENDIENTE / SIN MARCAJE (${sinFichar.length})</span>
              <span style="font-size:11px; background:#fee2e2; padding:2px 8px; border-radius:12px;">Alerta</span>
            </div>
            ${sinFichar.slice(0, 60).map(w => `
              <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #ef4444;">
                <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                <div style="margin-top:6px; font-size:11px; color:#dc2626; font-weight:700;">
                  Sin fichajes registrados en el día de hoy
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Columna 4: De Baja Médica IT (Ausencia Justificada en SAP HO) -->
          <div class="fich-board-col">
            <div class="fich-board-col-header" style="color:#7c3aed;">
              <span>🩺 DE BAJA MÉDICA IT (${deBaja.length})</span>
              <span style="font-size:11px; background:#ede9fe; color:#6d28d9; padding:2px 8px; border-radius:12px; font-weight:700;">Justificado</span>
            </div>
            ${deBaja.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Ningún trabajador de baja registrado hoy.</div>' : ''}
            ${deBaja.map(w => `
              <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #8b5cf6; background:#faf5ff;">
                <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                <div style="margin-top:6px; font-size:11px; color:#6d28d9; font-weight:700; display:flex; align-items:center; gap:4px;">
                  <span>🏥</span>
                  <span>Incapacidad Temporal (IT) justificada en SAP HO</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // VISTA 4: MATRIZ MENSUAL HEATMAP (EXPORTABLE)
    function renderHeatmapHTML() {
      return `
        <div id="fich-heatmap-container" class="fich-heatmap-wrapper">
          <div style="padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; font-size:13px; color:#0f172a;">📊 Matriz de Control de Presencia (${nombreMes} ${anioActual})</span>
            <button class="fich-btn-action" onclick="window.FichajesModule.exportarExcel()" style="padding:5px 12px; font-size:11px; font-weight:700;">
              📥 Descargar Matriz Excel / CSV
            </button>
          </div>
          <table class="fich-heatmap-table">
            <thead>
              <tr>
                <th style="min-width:200px; text-align:left;">Trabajador</th>
                <th style="min-width:130px;">Servicio</th>
                ${diasMes.map(d => `<th style="min-width:32px;">${d.pad}</th>`).join('')}
                <th style="min-width:60px;">Total Días</th>
              </tr>
            </thead>
            <tbody id="fich-heatmap-tbody">
              ${filtered.map(w => {
                const diasFichados = w.dias_fichados || [];
                return `
                  <tr>
                    <td class="worker-name" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="cursor:pointer;" title="Ver detalle de ${w.nombre}">
                      ${w.nombre}
                    </td>
                    <td style="font-size:11px; color:#64748b;">${w.servicio}</td>
                    ${diasMes.map(d => {
                      const has = diasFichados.includes(d.pad);
                      const isHoy = d.isHoy;
                      let cls = has ? 'fich-heatmap-cell-ok' : (isHoy ? 'fich-heatmap-cell-partial' : 'fich-heatmap-cell-none');
                      return `<td class="${cls}" title="${w.nombre} - Día ${d.pad}">${has ? '✓' : (isHoy ? '•' : '-')}</td>`;
                    }).join('')}
                    <td style="font-weight:900; color:#0f172a;">${diasFichados.length}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Renderizado modular de tarjeta individual para actualización ultrarrápida (<2ms)
    function renderWorkerCardHTML(w) {
      const hasFichs = (w.total_fichajes || 0) > 0;
      const isBaja = Boolean(w.isBaja || w.en_baja || w.estado_semaforo === 'baja' || w.estado_hoy === 'BAJA_IT');
      const isVac = Boolean(w.de_vacaciones || w.isVacaciones || w.estado_semaforo === 'vacaciones' || w.estado_hoy === 'VACACIONES');

      let badgeClass = 'badge-noficha';
      let badgeLabel = '🔴 ACTIVO · SIN MARCAJES';
      if (isBaja) {
        badgeClass = 'badge-baja';
        badgeLabel = '🩺 BAJA MÉDICA IT';
      } else if (isVac) {
        badgeClass = 'badge-vacaciones';
        badgeLabel = '🏖️ VACACIONES';
      } else if (w.estado_semaforo === 'ok') {
        badgeClass = 'badge-ok';
        badgeLabel = '🟢 ACTIVO · 100%';
      } else if (w.estado_semaforo === 'nook') {
        badgeClass = 'badge-nook';
        badgeLabel = '🟡 ACTIVO · PARCIAL';
      }

      const borderTopColor = isBaja ? '#8b5cf6' : (isVac ? '#0284c7' : (w.estado_semaforo === 'ok' ? '#10b981' : (w.estado_semaforo === 'nook' ? '#f59e0b' : '#ef4444')));

      return `
        <div class="fich-worker-card ${isBaja ? 'is-baja' : (isVac ? 'is-vacaciones' : '')}" style="border-top: 4px solid ${borderTopColor}; display:flex; flex-direction:column; gap:10px; color:#000000 !important;">
          <!-- Cabecera de la tarjeta -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-size:14px; font-weight:800; color:#000000 !important;">${w.nombre}</span>
                <span style="font-size:10.5px; font-weight:800; background:#f1f5f9; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; color:#0f172a !important; white-space:nowrap;">
                  ${w.empresa_badge || '🏢 SIFU'} ${w.gestor_corto || 'A. Coscolin'}
                </span>
              </div>
              <div style="font-size:11.5px; color:#334155; font-family:monospace; font-weight:700;">
                DNI: <strong style="color:#000000;">${w.dni}</strong> · ${w.servicio}
                ${w.inicio_contrato ? ` · <span style="color:#0284c7; font-weight:800;">Alta: ${w.inicio_contrato}</span>` : ''}
                ${(w.fin_contrato && w.fin_contrato.toLowerCase() !== 'indefinido') ? ` · <span style="color:#e11d48; font-weight:800;">Fin: ${w.fin_contrato}</span>` : ''}
              </div>
            </div>
            <span class="fich-check-badge ${badgeClass}" style="font-size:10.5px; white-space:nowrap;">
              ${badgeLabel}
            </span>
          </div>

          <!-- Diagnóstico Operativo -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:7px 10px; font-size:11.5px; font-weight:700; color:#000000 !important;">
            ${w.diagnostico}
          </div>

          <!-- Bloque de Enfoque del Día Seleccionado -->
          ${(() => {
            if (!diaSel || diaSel === 'todos') return '';
            const mesPad = String(mesActual).padStart(2, '0');
            const diaNum = parseInt(diaPad, 10);
            const estContrato = getEstadoContractualDia(w, diaNum, mesActual, anioActual);

            if (!estContrato.contratado) {
              return `
                <div class="fich-card-day-focus" style="background:#f1f5f9; border-color:#cbd5e1;">
                  <div style="font-size:11.5px; font-weight:800; color:#475569;">
                    ⚪ ${estContrato.label} · No computa ausencia
                  </div>
                </div>
              `;
            }

            const dayCal = (w.calendar_days && (w.calendar_days[String(diaNum)] || w.calendar_days[diaPad])) || {};

            if (w.estado_dia_sel === 'baja' || dayCal.isBaja) {
              return `
                <div class="fich-card-day-focus" style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:7px; padding:7px 10px;">
                  <div style="font-size:11.5px; font-weight:800; color:#6d28d9; display:flex; align-items:center; gap:6px;">
                    <span>🩺</span>
                    <span>EN SITUACIÓN DE BAJA MÉDICA IT EL DÍA ${diaPad}/${mesPad} · Justificado en SAP HO / CTI (No computa falta)</span>
                  </div>
                </div>
              `;
            }

            if (w.estado_dia_sel === 'vacaciones' || dayCal.isVacaciones) {
              return `
                <div class="fich-card-day-focus" style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:7px; padding:7px 10px;">
                  <div style="font-size:11.5px; font-weight:800; color:#0284c7; display:flex; align-items:center; gap:6px;">
                    <span>🏖️</span>
                    <span>DE VACACIONES / PERMISO EL DÍA ${diaPad}/${mesPad} · Justificado en SAP HO / CTI</span>
                  </div>
                </div>
              `;
            }

            if (w.estado_dia_sel === 'descanso' || dayCal.isDescanso) {
              return `
                <div class="fich-card-day-focus" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:7px 10px;">
                  <div style="font-size:11.5px; font-weight:800; color:#475569; display:flex; align-items:center; gap:6px;">
                    <span>☕</span>
                    <span>DÍA DE DESCANSO / SIN TURNO PROGRAMADO EL DÍA ${diaPad}/${mesPad} · Según Cuadrante CTI</span>
                  </div>
                </div>
              `;
            }

            const fichoEseDia = w._diasFichadosSet ? w._diasFichadosSet.has(diaPad) : (w.dias_fichados_activos || w.dias_fichados || []).includes(diaPad);
            const dFichs = (w._fichajesPorDiaMap && w._fichajesPorDiaMap[diaPad]) ? w._fichajesPorDiaMap[diaPad] : [];
            if (fichoEseDia && dFichs.length > 0) {
              const fEntrada = dFichs.find(f => f.isEntrada || (f.tipo || '').toLowerCase().includes('entrada'));
              const fSalida = [...dFichs].reverse().find(f => !f.isEntrada || (f.tipo || '').toLowerCase().includes('salida'));
              const entHora = fEntrada ? fEntrada.hora : (dFichs[0] ? dFichs[0].hora : '--:--');
              const salHora = (fSalida && fSalida !== fEntrada) ? fSalida.hora : (dFichs.length > 1 ? dFichs[dFichs.length - 1].hora : entHora);
              return `
                <div class="fich-card-day-focus">
                  <div style="font-size:11.5px; font-weight:800; color:#047857; display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                    <span>🟢 Marcajes Día ${diaPad}/${mesPad}: Entrada ${entHora} | Salida ${salHora} (${dFichs.length} fichajes)</span>
                  </div>
                  <div style="margin-top:4px; font-size:10.5px; color:#334155; font-weight:700;">
                    ${dFichs.map(f => `<strong>${f.tipo}:</strong> ${f.hora} <span style="color:#64748b;">(${f.punto || '-'})</span>`).join(' · ')}
                  </div>
                </div>
              `;
            } else if (fichoEseDia) {
              return `
                <div class="fich-card-day-focus">
                  <div style="font-size:11.5px; font-weight:800; color:#047857;">
                    🟢 Marcaje registrado el Día ${diaPad}/${mesPad} en la app
                  </div>
                </div>
              `;
            } else if (w.estado_dia_sel === 'fallo_app' || (w.usa_app_mes && dayCal.isFallo)) {
              return `
                <div class="fich-card-day-focus" style="background:#fff1f2; border-color:#fecdd3;">
                  <div style="font-size:11.5px; font-weight:900; color:#dc2626;">
                    🔴 NO REGISTRÓ FICHAJE EL DÍA ${diaPad}/${mesPad} (Sí usa la app en otras fechas)
                  </div>
                </div>
              `;
            } else {
              return `
                <div class="fich-card-day-focus" style="background:#f8fafc; border-color:#e2e8f0;">
                  <div style="font-size:11.5px; font-weight:800; color:#475569;">
                    ⚫ Sin actividad registrada en la aplicación durante el mes
                  </div>
                </div>
              `;
            }
          })()}

          <!-- Mini-calendario interactivo -->
          ${renderMiniCalendarHTML(w.calendar_days, w.fichajes, w)}

          <!-- Días fallados / incompletos con interacción directa -->
          ${(() => {
            const fallados = w.dias_fallados_activos || [];
            const incompletos = w.dias_incompletos_activos || [];
            const mesPad = String(mesActual).padStart(2, '0');
            if (fallados.length === 0 && incompletos.length === 0) {
              return `<div style="background:#f0fdf4; border:1px solid #86efac; border-radius:7px; padding:6px 9px; font-size:11px; font-weight:800; color:#15803d;">✅ 0 días laborables fallados en lo que va de ${nombreMes}</div>`;
            }
            return `
              <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:7px; padding:7px 9px; display:flex; flex-direction:column; gap:5px;">
                ${fallados.length > 0 ? `
                  <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                    <span style="font-size:10.5px; font-weight:900; color:#be123c; margin-right:2px;">🔴 Días sin fichar (${fallados.length}):</span>
                    ${fallados.map(d => `<span class="fich-day-chip fallo" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;" title="Falló el día ${d}/${mesPad} (Sin marcaje) - Clic para filtrar este día">${d}</span>`).join('')}
                  </div>
                ` : ''}
                ${incompletos.length > 0 ? `
                  <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                    <span style="font-size:10.5px; font-weight:900; color:#b45309; margin-right:2px;">🟡 Sin salida (${incompletos.length}):</span>
                    ${incompletos.map(d => `<span class="fich-day-chip incompleto" onclick="window.FichajesModule.setContrasteDia('${d}')" style="cursor:pointer;" title="Marcaje incompleto el día ${d}/${mesPad} - Clic para filtrar este día">${d}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          })()}

          <!-- Leyenda interactiva de alta visibilidad -->
          <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:10px; color:#334155; font-weight:700;">
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#86efac; border:1px solid #16a34a;"></span> Verde: Completo</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#fde68a; border:1px solid #d97706;"></span> Ámbar: Sin salida / En curso</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#fee2e2; border:1px solid #ef4444;"></span> Rojo: Falta injustificada</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#ede9fe; border:1px solid #8b5cf6;"></span> Morado: Baja Médica IT</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#e0f2fe; border:1px solid #0284c7;"></span> Azul: Vacaciones</span>
            <span style="display:inline-flex; align-items:center; gap:3px;"><span style="display:inline-block; width:9px; height:9px; border-radius:2px; background:#f8fafc; border:1px solid #cbd5e1;"></span> Gris: Descanso / Sin Turno</span>
          </div>

          <!-- Detalle de los fichajes -->
          ${hasFichs ? `
            <button type="button" class="fich-btn-action" style="width:100%; justify-content:center; padding:6px 10px; font-size:11.5px; font-weight:800; color:#0284c7 !important; background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; cursor:pointer;" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')">
              👁️ Ver todos los marcajes registrados (${w.fichajes.length})
            </button>
          ` : `
            <div style="padding:6px 10px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; font-size:11px; color:#991b1b; font-weight:700; text-align:center; display:flex; flex-direction:column; gap:6px; align-items:center;">
              <div>⚠️ No tiene registros de fichaje en la aplicación este mes.</div>
              <button style="padding:3px 8px; font-size:10.5px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; border-radius:5px; font-weight:800; cursor:pointer;" onclick="window.FichajesModule.marcarBajaEmpresa('${w.dni}', '${(w.nombre || '').replace(/'/g, "\\'")}')">
                ❌ Ya no está en SIFU (Baja Definitiva)
              </button>
            </div>
          `}
        </div>
      `;
    }
    window.FichajesModule._renderWorkerCardHTML = renderWorkerCardHTML;

    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- CABECERA DE CONTRASTE -->
        <div class="fich-contraste-banner">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:16px; font-weight:900; color:#0f172a; display:flex; align-items:center; gap:8px; letter-spacing:-0.02em;">
                <span>📱</span>
                <span>CONTRASTE APP MÓVIL · PORTAL EMPLEADO (gruposifuapp.gcalidad.com)</span>
                <span class="fich-badge-live"><span class="fich-pulse-dot"></span> EN VIVO</span>
              </div>
              <div style="font-size:12.5px; color:#475569; margin-top:4px;">
                Fichaje auditado en tiempo real con el DNI de cada trabajador frente a los cuadrantes operativos y carteras de <strong>Barcelona Operaciones (Delegación 0801)</strong>.
              </div>
            </div>
            <div class="fich-sync-banner-actions">
              <!-- Botón Evolucionado de Sincronización en Vivo conectado a FichajesLiveEngine -->
              <button class="fich-btn-sync-pro" id="fich-btn-sync" onclick="window.FichajesLiveEngine ? window.FichajesLiveEngine.triggerManualSync() : window.FichajesModule.sincronizarContrasteEnVivo()">
                <span class="sync-spin-icon">🔄</span>
                <span id="fich-btn-sync-text">Sincronizar en Vivo (gruposifuapp)</span>
              </button>

              <!-- Indicador de conexión SSE / Polling en tiempo real -->
              <span id="fich-live-status-pill" class="fich-live-pill live" title="Conexión en tiempo real activa">
                <span class="fich-live-indicator"></span> EN VIVO
              </span>

              <!-- Contador de próxima sincronización automática -->
              <div class="fich-last-sync-badge" title="Auto-sincronización cada 15 min en jornada laboral">
                <span>⏱️ Próxima comprobación:</span>
                <strong id="fich-live-countdown" style="font-family:monospace; color:#0284c7;">14:45</strong>
              </div>

              <!-- Hora de la última actualización -->
              <div class="fich-last-sync-badge" id="fich-last-sync-badge" title="Fichajes contrastados en tiempo real desde gruposifuapp.gcalidad.com">
                <span class="fich-sync-pulse-dot"></span>
                <span>Última:</span>
                <strong id="fich-last-sync-label">${getLastSyncContrasteTime()}</strong>
              </div>

              <button class="fich-btn-action" style="color:#000000 !important; background:#ffffff; border:1px solid #cbd5e1;" onclick="window.FichajesModule.exportarExcel()">
                <span>📊</span>
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KPIS DEL CONTRASTE MÓVIL (FILTRABLES CON CLIC) -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
          <div class="fich-check-kpi-card check-ok ${semaforoFilter === 'ok' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSemaforo('ok')">
            <div>
              <div class="fich-check-title"><span>🟢</span> FICHAN 100%</div>
              <div class="fich-check-sub">Días naranja y turnos cuadrados</div>
            </div>
            <div class="fich-check-val">${countOk} <span style="font-size:13px; opacity:0.8;">op</span></div>
          </div>

          <div class="fich-check-kpi-card check-nook ${semaforoFilter === 'nook' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSemaforo('nook')">
            <div>
              <div class="fich-check-title"><span>🟡</span> PARCIAL / DESFASE</div>
              <div class="fich-check-sub">Faltan marcajes o permutas</div>
            </div>
            <div class="fich-check-val">${countNook} <span style="font-size:13px; opacity:0.8;">op</span></div>
          </div>

          <div class="fich-check-kpi-card check-noficha ${semaforoFilter === 'noficha' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSemaforo('noficha')">
            <div>
              <div class="fich-check-title"><span>🔴</span> NO FICHAN EN APP</div>
              <div class="fich-check-sub">0 marcajes en todo Octubre</div>
            </div>
            <div class="fich-check-val">${countNoFicha} <span style="font-size:13px; opacity:0.8;">op</span></div>
          </div>

          <div class="fich-check-kpi-card check-baja ${semaforoFilter === 'baja' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSemaforo('baja')">
            <div>
              <div class="fich-check-title"><span>🩺</span> DE BAJA IT</div>
              <div class="fich-check-sub">Incapacidad médica (SAP)</div>
            </div>
            <div class="fich-check-val">${countBaja} <span style="font-size:13px; opacity:0.8;">it</span></div>
          </div>

          <div class="fich-check-kpi-card ${semaforoFilter === 'vacaciones' ? 'active' : ''}" style="border-left:4px solid #0284c7;" onclick="window.FichajesModule.setContrasteSemaforo('vacaciones')">
            <div>
              <div class="fich-check-title"><span>🏖️</span> DE VACACIONES</div>
              <div class="fich-check-sub">Permiso / Vacaciones (SAP)</div>
            </div>
            <div class="fich-check-val" style="color:#0284c7;">${countVacaciones} <span style="font-size:13px; opacity:0.8;">vac</span></div>
          </div>

          <div class="fich-check-kpi-card ${semaforoFilter === 'todos' ? 'active' : ''}" style="border-left:4px solid #0284c7;" onclick="window.FichajesModule.setContrasteSemaforo('todos')">
            <div>
              <div class="fich-check-title"><span>👥</span> TOTAL AUDITADOS</div>
              <div class="fich-check-sub">Plantilla Barcelona contrastada</div>
            </div>
            <div class="fich-check-val" style="color:#0284c7;">${countTotal} <span style="font-size:13px; opacity:0.8;">op</span></div>
          </div>
        </div>

        <!-- BARRA DE HERRAMIENTAS: SELECTOR DE 4 VISTAS, SELECTOR DE DÍA, FILTROS DE SECTOR Y BUSCADOR -->
        <div style="background:#ffffff; border:1px solid var(--fich-border); border-radius:12px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          
          <!-- Selector de las 4 Vistas -->
          <div class="fich-view-mode-toggle">
            <button class="fich-view-mode-btn ${subView === 'tarjetas' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSubView('tarjetas')">
              <span>🗂️ 1. Tarjetas & Calendario</span>
            </button>
            <button class="fich-view-mode-btn ${subView === 'listado' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSubView('listado')">
              <span>📋 2. Listado Compacto</span>
            </button>
            <button class="fich-view-mode-btn ${subView === 'hoy' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSubView('hoy')">
              <span>⚡ 3. En Vivo Hoy</span>
            </button>
            <button class="fich-view-mode-btn ${subView === 'heatmap' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSubView('heatmap')">
              <span>📊 4. Matriz Heatmap</span>
            </button>
          </div>

          <!-- SELECTOR DE MES Y AÑO DINÁMICO -->
          <div class="fich-month-picker-container">
            <span style="font-size:12px; font-weight:800; color:#000000; display:flex; align-items:center; gap:4px; white-space:nowrap;">📆 Mes:</span>
            <div class="fich-month-selector-group">
              <button type="button" class="fich-month-btn" onclick="window.FichajesModule.cambiarMes(-1)" title="Mes anterior">
                ◀
              </button>
              <select id="fich-select-mes" class="fich-col-filter fich-month-select" style="width:auto; height:34px; color:#000000 !important; font-weight:700;" onchange="window.FichajesModule.setContrasteMes(this.value)">
                ${[
                  { mes: 9, anio: 2026, label: 'Septiembre 2026' },
                  { mes: 10, anio: 2026, label: 'Octubre 2026' },
                  { mes: 11, anio: 2026, label: 'Noviembre 2026' },
                  { mes: 12, anio: 2026, label: 'Diciembre 2026' },
                  { mes: 1, anio: 2027, label: 'Enero 2027' },
                  { mes: 2, anio: 2027, label: 'Febrero 2027' },
                  { mes: 3, anio: 2027, label: 'Marzo 2027' },
                  { mes: 4, anio: 2027, label: 'Abril 2027' }
                ].map(m => {
                  const val = `${m.mes}-${m.anio}`;
                  const isSel = (mesActual === m.mes && anioActual === m.anio);
                  return `<option value="${val}" ${isSel ? 'selected' : ''}>${m.label}${m.mes === 10 && m.anio === 2026 ? ' (Base)' : ''}</option>`;
                }).join('')}
              </select>
              <button type="button" class="fich-month-btn" onclick="window.FichajesModule.cambiarMes(1)" title="Mes siguiente">
                ▶
              </button>
            </div>
          </div>

          <!-- MENÚ SELECTOR DE DÍA DE FICHAJE (${nombreMes} ${anioActual}) -->
          <div class="fich-day-picker-container">
            <span style="font-size:12px; font-weight:800; color:#000000; display:flex; align-items:center; gap:4px; white-space:nowrap;">🗓️ Día de Fichaje:</span>
            <select id="fich-select-dia" class="fich-col-filter" style="width:auto; height:34px; color:#000000 !important; font-weight:700;" onchange="window.FichajesModule.setContrasteDia(this.value)">
              <option value="todos" ${diaSel === 'todos' ? 'selected' : ''}>📅 Todo el Mes (${nombreMes} Completo)</option>
              ${diasTranscurridosDesc.length > 0 ? `
                <optgroup label="Días Transcurridos (${isCurrentMonthYear ? `Hoy ${todayDay} ➔ 01` : `${totalDiasEnMes} ➔ 01`})">
                  ${diasTranscurridosDesc.map(d => `<option value="${d.pad}" ${diaSel === d.pad ? 'selected' : ''}>${d.isHoy ? `🔥 Día ${d.pad} (HOY - ${d.nombre})` : `📅 Día ${d.pad} (${d.nombre})`}</option>`).join('')}
                </optgroup>
              ` : ''}
              ${diasProximosAsc.length > 0 ? `
                <optgroup label="Próximos Días del Mes">
                  ${diasProximosAsc.map(d => `<option value="${d.pad}" ${diaSel === d.pad ? 'selected' : ''}>📅 Día ${d.pad} (${d.nombre})</option>`).join('')}
                </optgroup>
              ` : ''}
            </select>

            ${diaSel !== 'todos' ? `
              <div class="fich-day-mode-group">
                <button type="button" class="fich-day-mode-btn ${diaModo === 'fallo_app' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('fallo_app')" title="Ver quienes debían fichar pero fallaron el día ${diaPad}">
                  🔴 Fallaron Día ${diaPad} (${countFalloAppDia})
                </button>
                <button type="button" class="fich-day-mode-btn ${diaModo === 'ficho' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('ficho')" title="Ver solo los que ficharon el día ${diaPad}">
                  🟢 Ficharon (${countFichoDia})
                </button>
                <button type="button" class="fich-day-mode-btn ${diaModo === 'baja' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('baja')" title="Ver trabajadores de Baja Médica IT en SAP HO / CTI">
                  🩺 Baja IT (${countBajaDia})
                </button>
                ${countVacacionesDia > 0 ? `
                  <button type="button" class="fich-day-mode-btn ${diaModo === 'vacaciones' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('vacaciones')" title="Ver trabajadores de Vacaciones / Permiso en SAP HO">
                    🏖️ Vacaciones (${countVacacionesDia})
                  </button>
                ` : ''}
                <button type="button" class="fich-day-mode-btn ${diaModo === 'descanso' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('descanso')" title="Ver trabajadores en descanso o sin turno de cuadrante CTI">
                  ☕ Descanso (${countDescansoDia})
                </button>
                <button type="button" class="fich-day-mode-btn ${diaModo === 'todos' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('todos')" title="Ver todos los convocados el día ${diaPad}">
                  👥 Todos (${trabajadoresConContratoEnDia.length})
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Buscador en tiempo real -->
          <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:260px;">
            <input type="text" id="fich-search-input" class="fich-col-filter" placeholder="🔍 Buscar trabajador, DNI, centro..." value="${FichState.search}" oninput="window.FichajesModule.setSearch(this.value)" style="height:34px; font-size:12px; color:#000000 !important;">
          </div>

          <!-- SELECTOR DE GESTOR MULTI-CARTERA (BARCELONA OPERACIONES) -->
          <div class="fich-gestor-picker-container" style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; font-weight:800; color:#000000; display:flex; align-items:center; gap:4px; white-space:nowrap;">👔 Gestor:</span>
            <select id="fich-select-gestor" class="fich-col-filter" style="width:auto; height:34px; color:#000000 !important; font-weight:800; border-color:#0284c7; background:#f0f9ff;" onchange="window.FichajesModule.setContrasteGestor(this.value)">
              <option value="todos" ${gestorFilter === 'todos' ? 'selected' : ''}>👥 Todos los Gestores (${countTotal})</option>
              ${gestoresDisponibles.map(g => {
                const cnt = getGestorCount(g);
                const extra = g.id === '00062620' ? ' - Indra Roc Boronat' : '';
                const isSel = (gestorFilter === g.id) || (normalizeText(gestorFilter) === normalizeText(g.nombre_corto));
                return `<option value="${g.id}" ${isSel ? 'selected' : ''}>${g.empresa_badge || '🏢'} ${g.nombre_corto}${extra} (${cnt})</option>`;
              }).join('')}
            </select>
          </div>

          <!-- Filtro por Sector Operativo Barcelona -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button type="button" class="fich-sector-btn ${sectorFilter === 'todos' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSector('todos')">
              🏢 Todos (${countTotal})
            </button>
            <button type="button" class="fich-sector-btn ${sectorFilter === 'LIMPIEZA' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSector('LIMPIEZA')">
              🧹 Limpieza (${countLimpieza})
            </button>
            <button type="button" class="fich-sector-btn ${sectorFilter === 'AUXILIARES' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSector('AUXILIARES')">
              🛡️ Auxiliares (${countAuxiliares})
            </button>
            <button type="button" class="fich-sector-btn ${sectorFilter === 'INDRA' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSector('INDRA')">
              💻 Indra Roc Boronat (${countIndra})
            </button>
            <button type="button" class="fich-sector-btn ${sectorFilter === 'MULTICLIENTE' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteSector('MULTICLIENTE')">
              🏢 Multicliente BCN (${countMulticliente})
            </button>
          </div>

          <!-- Ordenación -->
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:11px; font-weight:700; color:#000000;">Ordenar:</span>
            <select class="fich-col-filter" style="width:auto; height:32px; color:#000000 !important; font-weight:700;" onchange="window.FichajesModule.setContrasteSort(this.value)">
              <option value="nombre" ${sortMode === 'nombre' ? 'selected' : ''}>Nombre (A-Z)</option>
              <option value="fichajes" ${sortMode === 'fichajes' ? 'selected' : ''}>Mayor N° Fichajes</option>
              <option value="semaforo" ${sortMode === 'semaforo' ? 'selected' : ''}>Estado / Alertas</option>
            </select>
          </div>
        </div>

        <!-- TIRA RÁPIDA DE GESTORES DE BARCELONA (CON UN CLIC) -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:2px 4px;">
          <span style="font-size:11.5px; font-weight:800; color:#0f172a; white-space:nowrap; margin-right:4px;">👔 Cartera Gestor:</span>
          <button type="button" class="fich-sector-btn ${gestorFilter === 'todos' ? 'active' : ''}" style="font-size:11px;" onclick="window.FichajesModule.setContrasteGestor('todos')">
            👥 Todos (${countTotal})
          </button>
          ${gestoresDisponibles.map(g => {
            const cnt = getGestorCount(g);
            const extra = g.id === '00062620' ? ' (Indra)' : '';
            const isSel = (gestorFilter === g.id) || (normalizeText(gestorFilter) === normalizeText(g.nombre_corto));
            return `
              <button type="button" class="fich-sector-btn ${isSel ? 'active' : ''}" style="font-size:11px;" onclick="window.FichajesModule.setContrasteGestor('${g.id}')">
                ${g.empresa_badge || '🏢'} ${g.nombre_corto}${extra} (${cnt})
              </button>
            `;
          }).join('')}
        </div>

        <!-- TIRA RÁPIDA DE CHIPS DE DÍAS INTERACTIVOS (01 a ${totalDiasEnMes} DE ${nombreMes.toUpperCase()}) -->
        <div class="fich-quick-days-strip">
          <span style="font-size:11px; font-weight:800; color:#334155; white-space:nowrap; margin-right:4px;">🗓️ Días ${nombreMes} (Clic para ver fallos del día):</span>
          <button type="button" class="fich-quick-day-chip ${diaSel === 'todos' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDia('todos')" title="Ver todo el mes de ${nombreMes} completo">
            📅 Todo el Mes
          </button>
          ${diasMes.map(d => {
            const fallosCnt = fallosPorDiaMap[d.pad] || 0;
            const fichoCnt = ficharonPorDiaMap[d.pad] || 0;
            return `
              <button type="button" class="fich-quick-day-chip ${diaSel === d.pad ? 'active' : ''} ${d.isHoy ? 'today' : ''}" onclick="window.FichajesModule.setContrasteDia('${d.pad}')" title="Día ${d.pad}/${String(mesActual).padStart(2, '0')} (${d.nombre}) · 🟢 ${fichoCnt} ficharon · 🔴 ${fallosCnt} con fallo">
                <span>${d.isHoy ? `🔥 ${d.pad} (HOY)` : d.pad}</span>
                ${fallosCnt > 0 ? `<span class="day-fail-dot" title="${fallosCnt} trabajadores fallaron el día ${d.pad}">${fallosCnt}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>

        ${diaSel !== 'todos' ? `
          <!-- PANEL DE AUDITORÍA Y TRAZABILIDAD DEL DÍA SELECCIONADO -->
          <div style="background:#fff1f2; border:1.5px solid #fda4af; border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:13px; font-weight:900; color:#9f1239;">
                🎯 AUDITORÍA DÍA ${diaPad}/${String(mesActual).padStart(2, '0')}/${anioActual}:
              </span>
              <span style="font-size:12px; font-weight:700; color:#1e293b;">
                Filtra con un clic quién ha fallado o cumplido en este día exacto:
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <button type="button" class="fich-sector-btn ${diaModo === 'fallo_app' ? 'active' : ''}" style="border-color:#f87171; background:${diaModo === 'fallo_app' ? '#dc2626 !important' : '#fef2f2'}; color:${diaModo === 'fallo_app' ? '#ffffff !important' : '#991b1b !important'};" onclick="window.FichajesModule.setContrasteDiaModo('fallo_app')" title="Trabajadores activos convocados que fallaron este día ${diaPad}">
                🔴 Fallaron el Día ${diaPad} (${countFalloAppDia})
              </button>
              <button type="button" class="fich-sector-btn ${diaModo === 'ficho' ? 'active' : ''}" style="border-color:#4ade80; background:${diaModo === 'ficho' ? '#16a34a !important' : '#f0fdf4'}; color:${diaModo === 'ficho' ? '#ffffff !important' : '#166534 !important'};" onclick="window.FichajesModule.setContrasteDiaModo('ficho')" title="Trabajadores que sí ficharon el día ${diaPad}">
                🟢 Ficharon el Día ${diaPad} (${countFichoDia})
              </button>
              ${countIncompletoDia > 0 ? `
                <button type="button" class="fich-sector-btn ${diaModo === 'incompleto' ? 'active' : ''}" style="border-color:#fbbf24; background:${diaModo === 'incompleto' ? '#d97706 !important' : '#fffbeb'}; color:${diaModo === 'incompleto' ? '#ffffff !important' : '#92400e !important'};" onclick="window.FichajesModule.setContrasteDiaModo('incompleto')" title="Marcajes incompletos sin salida registrada">
                  🟡 Incompletos sin Salida (${countIncompletoDia})
                </button>
              ` : ''}
              <button type="button" class="fich-sector-btn ${diaModo === 'baja' ? 'active' : ''}" style="border-color:#c4b5fd; background:${diaModo === 'baja' ? '#7c3aed !important' : '#f5f3ff'}; color:${diaModo === 'baja' ? '#ffffff !important' : '#6d28d9 !important'};" onclick="window.FichajesModule.setContrasteDiaModo('baja')" title="Trabajadores en situación de Baja Médica IT en SAP HO / CTI">
                🩺 De Baja IT (${countBajaDia})
              </button>
              ${countVacacionesDia > 0 ? `
                <button type="button" class="fich-sector-btn ${diaModo === 'vacaciones' ? 'active' : ''}" style="border-color:#7dd3fc; background:${diaModo === 'vacaciones' ? '#0284c7 !important' : '#f0f9ff'}; color:${diaModo === 'vacaciones' ? '#ffffff !important' : '#0369a1 !important'};" onclick="window.FichajesModule.setContrasteDiaModo('vacaciones')" title="Trabajadores en periodo de vacaciones o permisos en SAP HO">
                  🏖️ Vacaciones (${countVacacionesDia})
                </button>
              ` : ''}
              <button type="button" class="fich-sector-btn ${diaModo === 'descanso' ? 'active' : ''}" style="border-color:#cbd5e1; background:${diaModo === 'descanso' ? '#475569 !important' : '#f8fafc'}; color:${diaModo === 'descanso' ? '#ffffff !important' : '#334155 !important'};" onclick="window.FichajesModule.setContrasteDiaModo('descanso')" title="Trabajadores con descanso asignado o sin turno programado en Cuadrante CTI">
                ☕ Descanso / Sin Turno (${countDescansoDia})
              </button>
              <button type="button" class="fich-sector-btn ${diaModo === 'nunca_app' ? 'active' : ''}" style="border-color:#94a3b8; background:${diaModo === 'nunca_app' ? '#334155 !important' : '#f8fafc'}; color:${diaModo === 'nunca_app' ? '#ffffff !important' : '#334155 !important'};" onclick="window.FichajesModule.setContrasteDiaModo('nunca_app')" title="Trabajadores que tienen 0 fichajes en todo el mes de Octubre">
                ⚫ Sin App todo el mes (${countNuncaAppDia})
              </button>
              <button type="button" class="fich-sector-btn ${diaModo === 'todos' ? 'active' : ''}" onclick="window.FichajesModule.setContrasteDiaModo('todos')">
                👥 Todos (${trabajadoresConContratoEnDia.length})
              </button>
              <button type="button" class="fich-col-clear-btn" style="width:auto; padding:5px 10px;" onclick="window.FichajesModule.setContrasteDia('todos')">
                ✕ Volver a Todo el Mes
              </button>
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#000000; font-weight:700; padding:0 4px;">
          <span id="fich-compact-count">Mostrando <strong>${filtered.length}</strong> de ${countTotal} trabajadores auditados</span>
          ${(q || sectorFilter !== 'todos' || semaforoFilter !== 'todos' || diaSel !== 'todos' || diaModo !== 'todos' || Object.values(cFilters).some(Boolean)) ? `
            <button class="fich-col-clear-btn" style="width:auto; padding:3px 10px; font-size:11px;" onclick="window.FichajesModule.resetFilters()">
              🧹 Limpiar Todos los Filtros
            </button>
          ` : ''}
        </div>

        <!-- CONTENIDO SEGÚN LA VISTA SELECCIONADA -->
        ${subView === 'listado' ? `
          <!-- VISTA 2: LISTADO COMPACTO CON BUSCADOR POR CADA COLUMNA -->
          <div class="fich-compact-table-card">
            <div class="fich-compact-table-wrapper">
              <table class="fich-compact-table">
                <thead>
                  <tr>
                    <th style="min-width:110px;">Estado</th>
                    <th style="min-width:140px;">Gestor</th>
                    <th style="min-width:210px;">Trabajador</th>
                    <th style="min-width:110px;">DNI</th>
                    <th style="min-width:180px;">Servicio / Proyecto</th>
                    <th style="min-width:120px;">Sector</th>
                    <th style="min-width:200px;">${diaSel !== 'todos' ? `Día ${diaPad} (Marcajes)` : 'Días Naranja (Marcajes)'}</th>
                    <th style="text-align:center; min-width:80px;">Fichajes</th>
                    <th style="min-width:140px;">Último Registro</th>
                    <th style="min-width:240px;">Diagnóstico Operativo</th>
                    <th style="text-align:center; min-width:90px;">Acción</th>
                  </tr>
                  <!-- FILA DE BUSCADORES INDIVIDUALES POR COLUMNA -->
                  <tr class="fich-compact-filters-row">
                    <th>
                      <select class="fich-compact-filter-input" data-col="estado" onchange="window.FichajesModule.setCompactColFilter('estado', this.value)">
                        <option value="">Todos</option>
                        <option value="ok" ${cFilters.estado === 'ok' ? 'selected' : ''}>🟢 OK</option>
                        <option value="nook" ${cFilters.estado === 'nook' ? 'selected' : ''}>🟡 Parcial</option>
                        <option value="noficha" ${cFilters.estado === 'noficha' ? 'selected' : ''}>🔴 No Ficha</option>
                        <option value="baja" ${cFilters.estado === 'baja' ? 'selected' : ''}>🩺 Baja IT</option>
                      </select>
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="gestor" placeholder="🔍 Gestor..." value="${cFilters.gestor || ''}" oninput="window.FichajesModule.setCompactColFilter('gestor', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="trabajador" placeholder="🔍 Trabajador..." value="${cFilters.trabajador || ''}" oninput="window.FichajesModule.setCompactColFilter('trabajador', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="dni" placeholder="🔍 DNI..." value="${cFilters.dni || ''}" oninput="window.FichajesModule.setCompactColFilter('dni', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="servicio" placeholder="🔍 Servicio..." value="${cFilters.servicio || ''}" oninput="window.FichajesModule.setCompactColFilter('servicio', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="sector" placeholder="🔍 Sector..." value="${cFilters.sector || ''}" oninput="window.FichajesModule.setCompactColFilter('sector', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="dia" placeholder="🔍 Día (ej: 07)..." value="${cFilters.dia || ''}" oninput="window.FichajesModule.setCompactColFilter('dia', this.value)">
                    </th>
                    <th style="text-align:center;">
                      <input type="number" class="fich-compact-filter-input" data-col="fichajes" placeholder="Min" value="${cFilters.fichajes || ''}" oninput="window.FichajesModule.setCompactColFilter('fichajes', this.value)" style="text-align:center;">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="ultimo" placeholder="🔍 Último..." value="${cFilters.ultimo || ''}" oninput="window.FichajesModule.setCompactColFilter('ultimo', this.value)">
                    </th>
                    <th>
                      <input type="text" class="fich-compact-filter-input" data-col="diagnostico" placeholder="🔍 Diagnóstico..." value="${cFilters.diagnostico || ''}" oninput="window.FichajesModule.setCompactColFilter('diagnostico', this.value)">
                    </th>
                    <th style="text-align:center;">
                      <button class="fich-col-clear-btn" style="padding:4px 6px; font-size:10px; width:100%; white-space:nowrap;" onclick="window.FichajesModule.resetCompactColFilters()" title="Limpiar buscadores de columna">
                        🧹 Limpiar
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody id="fich-compact-tbody">
                  ${filtered.map(w => renderCompactTableRowHTML(w)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : (subView === 'hoy' ? renderHoyBoardHTML() : (subView === 'heatmap' ? renderHeatmapHTML() : `
          <!-- VISTA 1: TARJETAS CON MINI-CALENDARIO INTERACTIVO (PAGINADA PARA MÁXIMA VELOCIDAD) -->
          <div id="fich-cards-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(350px, 1fr)); gap:14px;">
            ${(FichState.showAllCards ? filtered : filtered.slice(0, FichState.cardsLimit || 36)).map(w => renderWorkerCardHTML(w)).join('')}
          </div>
          ${(!FichState.showAllCards && filtered.length > (FichState.cardsLimit || 36)) ? `
            <div style="display:flex; justify-content:center; margin-top:8px;">
              <button type="button" class="fich-btn-sync-pro" style="padding:10px 24px; font-size:13px;" onclick="window.FichajesModule.mostrarTodasLasTarjetas()">
                ⚡ Mostrar las ${filtered.length} tarjetas completas (Mostrando ${FichState.cardsLimit || 36} para respuesta instantánea)
              </button>
            </div>
          ` : ''}
        `))}

        <!-- Modal flotante si hay trabajador seleccionado -->
        ${renderModalDetalleHTML()}
      </div>
    `;
  }

  // VISTA 3: LISTADO DETALLADO DE MARCAJES
  function renderTableView(items) {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / FichState.pageSize) || 1;
    if (FichState.currentPage > totalPages) FichState.currentPage = totalPages;
    if (FichState.currentPage < 1) FichState.currentPage = 1;

    const startIdx = (FichState.currentPage - 1) * FichState.pageSize;
    const endIdx = Math.min(startIdx + FichState.pageSize, totalItems);
    const pageItems = items.slice(startIdx, endIdx);

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="background:#ffffff; border:1px solid var(--fich-border); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px -2px rgba(15,23,42,0.05);">
          <div class="fich-table-wrapper">
            <table class="fich-table">
              <thead>
                <tr>
                  <th>Fecha Efectiva</th>
                  <th>Hora</th>
                  <th>Trabajador</th>
                  <th>DNI</th>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Centro de Trabajo</th>
                  <th>Tipo Acceso</th>
                  <th>Método</th>
                  <th>Distancia GPS</th>
                  <th>Punto Acceso</th>
                  <th>Mapa</th>
                </tr>
                <tr class="fich-table-filters-row">
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar fecha..." value="${FichState.colFilters.fechaEfectiva || ''}" oninput="window.FichajesModule.setColumnFilter('fechaEfectiva', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar hora..." value="${FichState.colFilters.horaRegistro || ''}" oninput="window.FichajesModule.setColumnFilter('horaRegistro', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar trabajador..." value="${FichState.colFilters.empleadoNombre || ''}" oninput="window.FichajesModule.setColumnFilter('empleadoNombre', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar DNI..." value="${FichState.colFilters.empleadoDNI || ''}" oninput="window.FichajesModule.setColumnFilter('empleadoDNI', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar código..." value="${FichState.colFilters.empleadoCod || ''}" oninput="window.FichajesModule.setColumnFilter('empleadoCod', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar cliente..." value="${FichState.colFilters.clienteNombre || ''}" oninput="window.FichajesModule.setColumnFilter('clienteNombre', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar centro..." value="${FichState.colFilters.centroNombre || ''}" oninput="window.FichajesModule.setColumnFilter('centroNombre', this.value)"></th>
                  <th>
                    <select class="fich-col-filter" onchange="window.FichajesModule.setColumnFilter('tipoAcceso', this.value)">
                      <option value="">Todos</option>
                      <option value="entrada" ${FichState.colFilters.tipoAcceso === 'entrada' ? 'selected' : ''}>🟢 Entrada</option>
                      <option value="salida" ${FichState.colFilters.tipoAcceso === 'salida' ? 'selected' : ''}>🔴 Salida</option>
                    </select>
                  </th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar método..." value="${FichState.colFilters.metodo || ''}" oninput="window.FichajesModule.setColumnFilter('metodo', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar dist..." value="${FichState.colFilters.distanciaStr || ''}" oninput="window.FichajesModule.setColumnFilter('distanciaStr', this.value)"></th>
                  <th><input type="text" class="fich-col-filter" placeholder="Buscar punto..." value="${FichState.colFilters.puntoAcceso || ''}" oninput="window.FichajesModule.setColumnFilter('puntoAcceso', this.value)"></th>
                  <th><button class="fich-col-clear-btn" onclick="window.FichajesModule.resetColumnFilters()" title="Limpiar todos los filtros de columna">🧹 Limpiar</button></th>
                </tr>
              </thead>
              <tbody id="fich-table-tbody">
                ${pageItems.map(f => renderTableRowFullHTML(f)).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- BARRA DE PAGINACIÓN -->
        <div class="fich-pagination-bar">
          <div>
            Mostrando <strong>${startIdx + 1}</strong> a <strong>${endIdx}</strong> de <strong>${totalItems}</strong> registros
          </div>
          <div class="fich-pagination-buttons">
            <button class="fich-page-btn" ${FichState.currentPage === 1 ? 'disabled' : ''} onclick="window.FichajesModule.setPage(1)">« Primero</button>
            <button class="fich-page-btn" ${FichState.currentPage === 1 ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${FichState.currentPage - 1})">‹ Anterior</button>
            <span style="padding:0 8px; font-weight:700;">Página ${FichState.currentPage} de ${totalPages}</span>
            <button class="fich-page-btn" ${FichState.currentPage === totalPages ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${FichState.currentPage + 1})">Siguiente ›</button>
            <button class="fich-page-btn" ${FichState.currentPage === totalPages ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${totalPages})">Último »</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTableRowFullHTML(f) {
    const distClass = f.distanciaNum <= 50 ? 'cerca' : (f.distanciaNum <= 500 ? 'lejos' : 'muy-lejos');

    return `
      <tr>
        <td style="font-weight:700;">${f.fechaEfectiva}</td>
        <td style="font-family:monospace; color:#475569;">${f.horaRegistro}</td>
        <td style="font-weight:800; color:#0f172a;">${f.empleadoNombre}</td>
        <td style="font-family:monospace; font-size:11.5px; color:#475569;">${f.empleadoDNI}</td>
        <td style="font-family:monospace; font-size:11.5px; color:#64748b;">${f.empleadoCod}</td>
        <td style="font-size:11.5px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.clienteNombre}">
          ${f.clienteNombre}
        </td>
        <td style="font-size:11.5px; font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.centroNombre}">
          ${f.centroNombre}
        </td>
        <td>
          <span class="fich-tipo-badge ${f.isEntrada ? 'entrada' : 'salida'}">
            ${f.isEntrada ? '🟢 Entrada' : '🔴 Salida'}
          </span>
        </td>
        <td>
          <span class="fich-metodo-badge ${f.metodo.includes('APP') ? 'app-gps' : 'gps'}">
            ${f.metodo}
          </span>
        </td>
        <td>
          <span class="fich-distancia-tag ${distClass}">${f.distanciaStr}</span>
        </td>
        <td style="font-size:11px; color:#64748b; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.puntoAcceso}">
          ${f.puntoAcceso}
        </td>
        <td>
          ${f.lat && f.lng ? `
            <a href="https://www.google.com/maps?q=${f.lat},${f.lng}" target="_blank" class="fich-btn-action" style="padding:2px 7px; font-size:11px; background:#eff6ff; color:#1e40af; border-color:#bfdbfe;">
              📍 Ver
            </a>
          ` : '<span style="color:#94a3b8; font-size:11px;">-</span>'}
        </td>
      </tr>
    `;
  }

  // ==========================================================================
  // API PÚBLICA DEL MÓDULO FICHAJES
  // ==========================================================================
  window.FichajesModule = {
    _incidenciasCache: null,
    _incidenciasCacheKey: null,
    // Incidencias del día (NO OK + NO FICHA, sin bajas IT) para el badge de la pestaña (O(1) en memoria)
    getIncidenciasHoy() {
      const payload = window.FICHAJES_CONTRASTE_PAYLOAD;
      const syncKey = (payload && payload.fecha_sincronizacion) || 'v1';
      if (this._incidenciasCache && this._incidenciasCacheKey === syncKey) {
        return this._incidenciasCache;
      }
      if (payload && payload.resumen_estado) {
        const noOk = payload.resumen_estado.nook || 0;
        const noFicha = payload.resumen_estado.noficha || 0;
        const res = {
          total: noOk + noFicha,
          noOk,
          noFicha,
          fecha: payload.fecha_sincronizacion || getHoyFechaStr()
        };
        this._incidenciasCacheKey = syncKey;
        this._incidenciasCache = res;
        return res;
      }
      return { total: 0, noOk: 0, noFicha: 0, fecha: null };
    },

    mostrarTodasLasTarjetas() {
      FichState.showAllCards = true;
      this.refreshUI();
    },

    setViewMode(mode) {
      FichState.viewMode = mode;
      if (mode !== 'contraste') ensureLegacyDataLoaded();
      this.refreshUI();
    },

    _searchTimer: null,
    setSearch(q) {
      FichState.search = q;
      FichState.currentPage = 1;
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        if (FichState.viewMode === 'table' && document.getElementById('fich-table-tbody')) {
          this.updateTableViewOnly();
        } else if (FichState.viewMode === 'contraste') {
          this.updateContrasteSubViewOnly();
        } else {
          this.refreshUI();
        }
      }, 15);
    },

    // Actualización quirúrgica en memoria O(1) para búsqueda Big Data instantánea (<2ms)
    updateContrasteSubViewOnly() {
      const { list, filtered } = getContrasteFilteredWorkers();
      const countSpan = document.getElementById('fich-compact-count');
      if (countSpan) {
        countSpan.innerHTML = `Mostrando <strong>${filtered.length}</strong> de ${list.length} trabajadores auditados`;
      }

      const subView = FichState.contrasteSubView || 'tarjetas';

      // 1. Subvista Tarjetas
      if (subView === 'tarjetas') {
        const grid = document.getElementById('fich-cards-grid');
        if (grid && typeof window.FichajesModule._renderWorkerCardHTML === 'function') {
          const limit = FichState.showAllCards ? filtered.length : (FichState.cardsLimit || 36);
          const visible = filtered.slice(0, limit);
          grid.innerHTML = visible.map(w => window.FichajesModule._renderWorkerCardHTML(w)).join('');
          return;
        }
      }

      // 2. Subvista Listado Compacto
      if (subView === 'listado' || subView === 'compact') {
        const tbody = document.getElementById('fich-compact-tbody');
        if (tbody) {
          tbody.innerHTML = filtered.map(w => renderCompactTableRowHTML(w)).join('');
          return;
        }
      }

      // 3. Subvista Hoy en Vivo (Tablero Kanban)
      if (subView === 'hoy') {
        const board = document.getElementById('fich-today-board-container');
        if (board) {
          const trabajando = filtered.filter(w => w.estado_hoy === 'TRABAJANDO');
          const finalizados = filtered.filter(w => w.estado_hoy === 'FINALIZADO');
          const deBaja = filtered.filter(w => (w.isBaja || w.estado_hoy === 'BAJA_IT' || w.estado_semaforo === 'baja') && w.estado_hoy !== 'TRABAJANDO' && w.estado_hoy !== 'FINALIZADO');
          const sinFichar = filtered.filter(w => !w.isBaja && w.estado_semaforo !== 'baja' && w.estado_hoy !== 'BAJA_IT' && (w.estado_hoy === 'NO_FICHADO' || w.estado_hoy === 'SIN_MARCAJE'));
          board.innerHTML = `
            <div class="fich-board-col">
              <div class="fich-board-col-header" style="color:#16a34a;">
                <span>🟢 EN TURNO AHORA (${trabajando.length})</span>
                <span style="font-size:11px; background:#dcfce7; padding:2px 8px; border-radius:12px;">Activos</span>
              </div>
              ${trabajando.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Ningún trabajador en turno actualmente.</div>' : ''}
              ${trabajando.map(w => `
                <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #16a34a;">
                  <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                  <div style="margin-top:6px; font-size:11.5px; font-weight:700; color:#16a34a; display:flex; justify-content:space-between;">
                    <span>Entrada: ${w.ultimo_fichaje ? w.ultimo_fichaje.hora : '--:--'}</span>
                    <span>📍 ${w.ultimo_fichaje ? (w.ultimo_fichaje.punto || '').substring(0, 18) : ''}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="fich-board-col">
              <div class="fich-board-col-header" style="color:#0284c7;">
                <span>🏁 TURNO COMPLETADO (${finalizados.length})</span>
                <span style="font-size:11px; background:#e0f2fe; padding:2px 8px; border-radius:12px;">Salida OK</span>
              </div>
              ${finalizados.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Aún no hay turnos finalizados hoy.</div>' : ''}
              ${finalizados.map(w => `
                <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #0284c7;">
                  <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                  <div style="margin-top:6px; font-size:11.5px; font-weight:700; color:#0284c7; display:flex; justify-content:space-between;">
                    <span>Última Salida: ${w.ultimo_fichaje ? w.ultimo_fichaje.hora : '--:--'}</span>
                    <span>✅ Fin</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="fich-board-col">
              <div class="fich-board-col-header" style="color:#dc2626;">
                <span>🔴 PENDIENTE / SIN MARCAJE (${sinFichar.length})</span>
                <span style="font-size:11px; background:#fee2e2; padding:2px 8px; border-radius:12px;">Alerta</span>
              </div>
              ${sinFichar.slice(0, 60).map(w => `
                <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #ef4444;">
                  <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                  <div style="margin-top:6px; font-size:11px; color:#dc2626; font-weight:700;">
                    Sin fichajes registrados en el día de hoy
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="fich-board-col">
              <div class="fich-board-col-header" style="color:#7c3aed;">
                <span>🩺 DE BAJA MÉDICA IT (${deBaja.length})</span>
                <span style="font-size:11px; background:#ede9fe; color:#6d28d9; padding:2px 8px; border-radius:12px; font-weight:700;">Justificado</span>
              </div>
              ${deBaja.length === 0 ? '<div style="font-size:12px; color:#64748b; padding:12px; text-align:center;">Ningún trabajador de baja registrado hoy.</div>' : ''}
              ${deBaja.map(w => `
                <div class="fich-board-card" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="border-left:4px solid #8b5cf6; background:#faf5ff;">
                  <div style="font-weight:800; font-size:13px; color:#0f172a;">${w.nombre}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">${w.servicio}</div>
                  <div style="margin-top:6px; font-size:11px; color:#6d28d9; font-weight:700; display:flex; align-items:center; gap:4px;">
                    <span>🏥</span>
                    <span>Incapacidad Temporal (IT) justificada en SAP HO</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
          return;
        }
      }

      // 4. Subvista Heatmap
      if (subView === 'heatmap') {
        const tbodyH = document.getElementById('fich-heatmap-tbody');
        if (tbodyH) {
          const mesActual = FichState.contrasteMes || 10;
          const anioActual = FichState.contrasteAnio || 2026;
          const diasMes = getDiasDelMes(mesActual, anioActual);
          tbodyH.innerHTML = filtered.map(w => {
            const diasFichados = w.dias_fichados || [];
            return `
              <tr>
                <td class="worker-name" onclick="window.FichajesModule.toggleFichajesModal('${w.dni}')" style="cursor:pointer;" title="Ver detalle de ${w.nombre}">
                  ${w.nombre}
                </td>
                <td style="font-size:11px; color:#64748b;">${w.servicio}</td>
                ${diasMes.map(d => {
                  const has = diasFichados.includes(d.pad);
                  const isHoy = d.isHoy;
                  let cls = has ? 'fich-heatmap-cell-ok' : (isHoy ? 'fich-heatmap-cell-partial' : 'fich-heatmap-cell-none');
                  return `<td class="${cls}" title="${w.nombre} - Día ${d.pad}">${has ? '✓' : (isHoy ? '•' : '-')}</td>`;
                }).join('')}
                <td style="font-weight:900; color:#0f172a;">${diasFichados.length}</td>
              </tr>
            `;
          }).join('');
          return;
        }
      }

      // Fallback seguro conservando foco y cursor de búsqueda
      const activeEl = document.activeElement;
      const wasSearch = activeEl && activeEl.id === 'fich-search-input';
      const selStart = wasSearch ? activeEl.selectionStart : 0;
      const selEnd = wasSearch ? activeEl.selectionEnd : 0;
      this.refreshUI();
      if (wasSearch) {
        const newInp = document.getElementById('fich-search-input');
        if (newInp) {
          newInp.focus();
          newInp.setSelectionRange(selStart, selEnd);
        }
      }
    },

    setFilterFecha(fecha) {
      FichState.filterFecha = fecha;
      FichState.currentPage = 1;
      this.refreshUI();
      const txt = fecha === 'todas' ? 'todo el mes de Octubre' : `el día ${fecha}`;
      this.mostrarNotificacion(`📅 Filtrando fichajes para ${txt}`);
    },

    setFilterCliente(cl) {
      FichState.filterCliente = cl;
      FichState.currentPage = 1;
      this.refreshUI();
    },

    setFilterTrabajador(tr) {
      FichState.filterTrabajador = tr;
      FichState.currentPage = 1;
      this.refreshUI();
    },

    setFilterCheck(check) {
      FichState.filterCheck = check;
      FichState.currentPage = 1;
      this.refreshUI();
    },

    setFilterTipo(tipo) {
      FichState.filterTipo = tipo;
      FichState.currentPage = 1;
      this.refreshUI();
    },

    setFilterMetodo(metodo) {
      FichState.filterMetodo = metodo;
      FichState.currentPage = 1;
      this.refreshUI();
    },

    setPage(p) {
      FichState.currentPage = p;
      this.refreshUI();
    },

    _colFilterTimer: null,
    setColumnFilter(col, val) {
      if (!FichState.colFilters) FichState.colFilters = {};
      FichState.colFilters[col] = val;
      FichState.currentPage = 1;
      if (this._colFilterTimer) clearTimeout(this._colFilterTimer);
      this._colFilterTimer = setTimeout(() => {
        this.updateTableViewOnly();
      }, 100);
    },

    resetColumnFilters() {
      FichState.colFilters = {
        fechaEfectiva: '',
        horaRegistro: '',
        empleadoNombre: '',
        empleadoDNI: '',
        empleadoCod: '',
        clienteNombre: '',
        centroNombre: '',
        tipoAcceso: '',
        metodo: '',
        distanciaStr: '',
        puntoAcceso: ''
      };
      FichState.currentPage = 1;
      this.refreshUI();
      this.mostrarNotificacion('🧹 Buscadores por columna limpiados.');
    },

    updateTableViewOnly() {
      const tbody = document.getElementById('fich-table-tbody');
      if (!tbody) {
        this.refreshUI();
        return;
      }
      const filtered = getFilteredItems();
      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / FichState.pageSize) || 1;
      if (FichState.currentPage > totalPages) FichState.currentPage = totalPages;
      if (FichState.currentPage < 1) FichState.currentPage = 1;

      const startIdx = (FichState.currentPage - 1) * FichState.pageSize;
      const endIdx = Math.min(startIdx + FichState.pageSize, totalItems);
      const pageItems = filtered.slice(startIdx, endIdx);

      tbody.innerHTML = pageItems.map(f => renderTableRowFullHTML(f)).join('');

      // Actualizar información y botones de paginación
      const pagBar = document.querySelector('.fich-pagination-bar');
      if (pagBar) {
        pagBar.innerHTML = `
          <div>
            Mostrando <strong>${startIdx + 1}</strong> a <strong>${endIdx}</strong> de <strong>${totalItems}</strong> registros
          </div>
          <div class="fich-pagination-buttons">
            <button class="fich-page-btn" ${FichState.currentPage === 1 ? 'disabled' : ''} onclick="window.FichajesModule.setPage(1)">« Primero</button>
            <button class="fich-page-btn" ${FichState.currentPage === 1 ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${FichState.currentPage - 1})">‹ Anterior</button>
            <span style="padding:0 8px; font-weight:700;">Página ${FichState.currentPage} de ${totalPages}</span>
            <button class="fich-page-btn" ${FichState.currentPage === totalPages ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${FichState.currentPage + 1})">Siguiente ›</button>
            <button class="fich-page-btn" ${FichState.currentPage === totalPages ? 'disabled' : ''} onclick="window.FichajesModule.setPage(${totalPages})">Último »</button>
          </div>
        `;
      }
    },

    setContrasteSubView(view) {
      FichState.contrasteSubView = view;
      this.refreshUI();
    },

    setContrasteSort(sort) {
      FichState.contrasteSort = sort;
      this.refreshUI();
    },

    toggleFichajesModal(dni) {
      FichState.activeModalWorkerDNI = dni;
      this.refreshUI();
    },

    closeModal() {
      FichState.activeModalWorkerDNI = null;
      this.refreshUI();
    },

    setContrasteGestor(gestorId) {
      FichState.contrasteGestor = gestorId || 'todos';
      this.refreshUI();
      const gestores = getGestoresDisponiblesList();
      const normInput = normalizeText(gestorId);
      const gObj = gestores.find(g => g.id === gestorId || normalizeText(g.nombre_corto) === normInput || normalizeText(g.nombre) === normInput);
      const gNom = gObj ? `${gObj.empresa_badge || '🏢'} ${gObj.nombre_corto}` : (gestorId === 'todos' ? 'Todos los gestores' : gestorId);
      this.mostrarNotificacion(`👔 Filtrando por Gestor: ${gNom}`);
      if (window.SifuEnterprisePlatform && typeof window.SifuEnterprisePlatform.syncFromFichajes === 'function') {
        window.SifuEnterprisePlatform.syncFromFichajes({
          gestor: gObj ? gObj.nombre_corto : (gestorId || 'todos')
        });
      }
    },

    setContrasteSector(sec) {
      FichState.contrasteSector = sec;
      this.refreshUI();
      if (window.SifuEnterprisePlatform && typeof window.SifuEnterprisePlatform.syncFromFichajes === 'function') {
        window.SifuEnterprisePlatform.syncFromFichajes({ sector: sec });
      }
    },

    setContrasteSemaforo(sem) {
      FichState.contrasteSemaforo = sem;
      this.refreshUI();
      if (window.SifuEnterprisePlatform && typeof window.SifuEnterprisePlatform.syncFromFichajes === 'function') {
        const valMap = { ok: 'ok', nook: 'issue', noficha: 'issue', baja: 'exempt', vacaciones: 'exempt', todos: 'todos' };
        window.SifuEnterprisePlatform.syncFromFichajes({ validationStatus: valMap[sem] || sem });
      }
    },

    setContrasteMes(mesAnoStr) {
      if (!mesAnoStr) return;
      let mes, anio;
      if (typeof mesAnoStr === 'string' && mesAnoStr.includes('-')) {
        const parts = mesAnoStr.split('-');
        mes = parseInt(parts[0], 10);
        anio = parseInt(parts[1], 10);
      } else {
        mes = parseInt(mesAnoStr, 10);
        anio = FichState.contrasteAnio || 2026;
      }
      if (!isNaN(mes) && mes >= 1 && mes <= 12) {
        FichState.contrasteMes = mes;
      }
      if (!isNaN(anio) && anio >= 2020) {
        FichState.contrasteAnio = anio;
      }

      // Si el día seleccionado excede los días del nuevo mes, resetear a 'todos'
      const totalDias = new Date(FichState.contrasteAnio, FichState.contrasteMes, 0).getDate();
      if (FichState.contrasteDia !== 'todos') {
        const diaNum = parseInt(FichState.contrasteDia, 10);
        if (isNaN(diaNum) || diaNum > totalDias) {
          FichState.contrasteDia = 'todos';
        }
      }

      this.refreshUI();
      const nombreMes = NOMBRES_MESES[FichState.contrasteMes - 1] || 'Mes';
      this.mostrarNotificacion(`🗓️ Visualizando ${nombreMes} ${FichState.contrasteAnio}`);
      if (window.SifuEnterprisePlatform && typeof window.SifuEnterprisePlatform.syncFromFichajes === 'function') {
        window.SifuEnterprisePlatform.syncFromFichajes({
          mes: `${FichState.contrasteAnio}-${String(FichState.contrasteMes).padStart(2, '0')}`
        });
      }
    },

    cambiarMes(delta) {
      let mes = (FichState.contrasteMes || 10) + delta;
      let anio = (FichState.contrasteAnio || 2026);
      if (mes > 12) {
        mes = 1;
        anio += 1;
      } else if (mes < 1) {
        mes = 12;
        anio -= 1;
      }
      this.setContrasteMes(`${mes}-${anio}`);
    },

    setContrasteDia(dia) {
      const targetDia = (!dia || dia === 'todos') ? 'todos' : String(dia).padStart(2, '0');
      if (targetDia === 'todos') {
        FichState.contrasteDia = 'todos';
        FichState.contrasteDiaModo = 'todos';
      } else {
        FichState.contrasteDia = targetDia;
        // Limpiar filtro mensual de estado ("No Ficha todo el mes") para que no bloquee los resultados del día concreto
        if (FichState.compactColFilters && FichState.compactColFilters.estado) {
          FichState.compactColFilters.estado = '';
        }
        if (FichState.contrasteSemaforo === 'noficha') {
          FichState.contrasteSemaforo = 'todos';
        }
        // Por defecto, al pulsar un día concreto, mostrar directamente los trabajadores que fallaron ese día específico
        const dObj = new Date(FichState.contrasteAnio || 2026, (FichState.contrasteMes || 10) - 1, parseInt(targetDia, 10));
        const isWeekend = (dObj.getDay() === 0 || dObj.getDay() === 6);
        FichState.contrasteDiaModo = isWeekend ? 'ficho' : 'fallo_app';
      }
      this.refreshUI();
      const mesPad = String(FichState.contrasteMes || 10).padStart(2, '0');
      const nombreMes = NOMBRES_MESES[(FichState.contrasteMes || 10) - 1] || 'Mes';
      const txt = (FichState.contrasteDia === 'todos') ? `todo el mes de ${nombreMes}` : `los fallos exactos del Día ${FichState.contrasteDia}/${mesPad}`;
      this.mostrarNotificacion(`🗓️ Mostrando ${txt}`);
      if (window.SifuEnterprisePlatform && typeof window.SifuEnterprisePlatform.syncFromFichajes === 'function') {
        window.SifuEnterprisePlatform.syncFromFichajes({
          dia: FichState.contrasteDia === 'todos' ? 'all' : FichState.contrasteDia
        });
      }
    },

    setContrasteDiaModo(modo) {
      FichState.contrasteDiaModo = modo || 'todos';
      this.refreshUI();
    },

    async sincronizarContrasteEnVivo() {
      const btn = document.getElementById('fich-btn-sync');
      const btnText = document.getElementById('fich-btn-sync-text');

      if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
      }

      let elapsedSec = 0;
      if (btnText) {
        btnText.textContent = 'Iniciando conexión con gruposifuapp... (0s)';
      }
      const timer = setInterval(() => {
        elapsedSec++;
        if (btnText) {
          const tot = (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.total_trabajadores) || 689;
          btnText.textContent = `Sincronizando ${tot} trabajadores... (${elapsedSec}s)`;
        }
      }, 1000);

      this.mostrarNotificacion('⏱️ Conectando con https://gruposifuapp.gcalidad.com/ mediante 5 workers concurrentes...');

      let bridgeOk = false;
      try {
        // Intentar contactar con el puente local/corporativo Playwright (puerto 5005)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos máx
          const res = await fetch('http://127.0.0.1:5005/sync_contraste', { 
            cache: 'no-store',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            console.log('Sync Contraste Bridge OK:', data);
            bridgeOk = true;
          }
        } catch (bridgeErr) {
          console.warn('Bridge local no disponible en 127.0.0.1:5005:', bridgeErr.message);
        }

        // Si el bridge local no está disponible (ej. en GitHub Pages), recargar los datos actualizados de GitHub Actions
        const isRemoteHost = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');

        // Recargar datos actualizados en caliente
        await new Promise(resolve => {
          const oldScript = document.getElementById('dynamic-contraste-script');
          if (oldScript) oldScript.remove();
          const script = document.createElement('script');
          script.id = 'dynamic-contraste-script';
          script.src = `fichajes_contraste_data.js?t=${Date.now()}`;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
          setTimeout(() => resolve(false), 3000);
        });

        const nowFormatted = new Date().toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(',', '');

        const fileSyncDate = window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion 
          ? window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion 
          : nowFormatted;

        if (bridgeOk) {
          localStorage.setItem('sifu_fichajes_last_sync_contraste', nowFormatted);
          if (window.FICHAJES_CONTRASTE_PAYLOAD) {
            window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion = nowFormatted;
          }
          this.refreshUI();
          const updatedLabel = document.getElementById('fich-last-sync-label');
          if (updatedLabel) updatedLabel.textContent = nowFormatted;
          this.mostrarNotificacion(`⚡ Fichajes sincronizados en tiempo real (${elapsedSec}s) desde gruposifuapp.gcalidad.com.`);
        } else if (isRemoteHost) {
          this.refreshUI();
          this.mostrarModalInfoGitHubPages();
        } else {
          this.refreshUI();
          const updatedLabel = document.getElementById('fich-last-sync-label');
          if (updatedLabel && fileSyncDate) updatedLabel.textContent = fileSyncDate;
          this.mostrarNotificacion(`ℹ️ Mostrando datos locales (${fileSyncDate}). Para sincronizar en directo desde el botón: abre "Iniciar_Supervisor_Puente.bat", o ejecuta "Sincronizar_Fichajes_Ahora.bat".`);
        }
      } catch (err) {
        console.error('Error en sync:', err);
        this.mostrarNotificacion(`❌ Error al actualizar contraste: ${err.message}`);
      } finally {
        clearInterval(timer);
        const finishBtn = document.getElementById('fich-btn-sync');
        const finishBtnText = document.getElementById('fich-btn-sync-text');
        if (finishBtn) {
          finishBtn.classList.remove('syncing');
          finishBtn.disabled = false;
        }
        if (finishBtnText) {
          finishBtnText.textContent = 'Sincronizar en Vivo (gruposifuapp)';
        }
      }
    },

    async marcarBajaEmpresa(dni, nombre) {
      if (!confirm(`¿Confirmas que "${nombre}" (DNI: ${dni}) ya no trabaja en SIFU?\n\nAl confirmar, se registrará como baja definitiva y se eliminará permanentemente de todos los listados de control, fichajes y cuadrantes.`)) {
        return;
      }
      try {
        const res = await fetch('http://127.0.0.1:5005/marcar_baja_empresa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, nombre, motivo: 'Baja definitiva de empresa confirmada desde la interfaz' })
        });
        const data = await res.json();
        if (data.status === 'ok') {
          if (window.FICHAJES_CONTRASTE_PAYLOAD && Array.isArray(window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores)) {
            window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores = window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores.filter(w => w.dni !== dni);
            window.FICHAJES_CONTRASTE_PAYLOAD.total_trabajadores = window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores.length;
          }
          this.refreshUI();
          this.mostrarNotificacion(`✅ ${nombre} ha sido registrado como baja definitiva y eliminado de los listados.`);
        } else {
          this.mostrarNotificacion(`⚠️ Aviso: ${data.mensaje || 'No se pudo registrar la baja'}`);
        }
      } catch (err) {
        if (window.FICHAJES_CONTRASTE_PAYLOAD && Array.isArray(window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores)) {
          window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores = window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores.filter(w => w.dni !== dni);
          window.FICHAJES_CONTRASTE_PAYLOAD.total_trabajadores = window.FICHAJES_CONTRASTE_PAYLOAD.trabajadores.length;
        }
        this.refreshUI();
        this.mostrarNotificacion(`🗑️ Trabajador retirado de la vista actual.`);
      }
    },

    // Modal informativo para cuando se accede desde GitHub Pages
    mostrarModalInfoGitHubPages() {
      const modalId = 'fich-gh-pages-modal';
      let modal = document.getElementById(modalId);
      if (modal) modal.remove();

      const lastSync = (window.FICHAJES_CONTRASTE_PAYLOAD && window.FICHAJES_CONTRASTE_PAYLOAD.fecha_sincronizacion) || 'Automática GitHub';

      const div = document.createElement('div');
      div.id = modalId;
      div.className = 'fich-modal-overlay';
      div.style.display = 'flex';
      div.innerHTML = `
        <div class="fich-modal-card" style="max-width:540px; text-align:left; border-top: 4px solid #0284c7;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
            <div style="font-weight:900; font-size:15px; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <span>🌐</span>
              <span>Sincronización en GitHub Pages</span>
            </div>
            <button class="fich-modal-close-btn" onclick="document.getElementById('${modalId}').remove()">&times;</button>
          </div>
          <div style="margin-top:14px; font-size:13px; color:#334155; line-height:1.6;">
            <p style="margin:0 0 10px 0;">
              Al estar en el servidor en la nube de <strong>GitHub Pages</strong>, el dashboard no puede ejecutar Playwright directamente dentro del navegador por políticas de seguridad web.
            </p>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:12px;">
              <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">🤖 Automatización en la Nube Activada:</div>
              <div style="font-size:12px; color:#475569;">
                • El flujo de <strong>GitHub Actions</strong> se ejecuta automáticamente durante la jornada laboral en los servidores de GitHub y actualiza los fichajes de Barcelona.<br>
                • Última sincronización disponible en la nube: <strong style="color:#0284c7;">${lastSync}</strong>.
              </div>
            </div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px;">
              <div style="font-weight:800; color:#1e40af; margin-bottom:4px;">⚡ Sincronización instantánea:</div>
              <div style="font-size:12px; color:#1e3a8a;">
                • <strong>Desde tu ordenador:</strong> Si tienes abierto el puente local (<code>python supervisor_bridge.py</code>), este botón actualizará en 25 segundos en tiempo real.<br>
                • <strong>Desde el móvil:</strong> Se leen los datos consolidados automáticamente por GitHub Actions.
              </div>
            </div>
          </div>
          <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
            <button class="fich-btn-action" style="background:#0284c7; color:#fff !important; font-weight:800; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;" onclick="document.getElementById('${modalId}').remove()">
              Entendido
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(div);
    },

    _compactColTimer: null,
    setCompactColFilter(col, val) {
      if (!FichState.compactColFilters) FichState.compactColFilters = {};
      FichState.compactColFilters[col] = val;
      if (this._compactColTimer) clearTimeout(this._compactColTimer);
      this._compactColTimer = setTimeout(() => {
        this.updateCompactTableOnly();
      }, 100);
    },

    resetCompactColFilters() {
      FichState.contrasteDia = 'todos';
      FichState.contrasteDiaModo = 'todos';
      FichState.compactColFilters = {
        estado: '',
        gestor: '',
        trabajador: '',
        dni: '',
        servicio: '',
        sector: '',
        dia: '',
        fichajes: '',
        ultimo: '',
        diagnostico: ''
      };
      this.refreshUI();
      this.mostrarNotificacion('🧹 Buscadores por columna limpiados.');
    },

    updateCompactTableOnly() {
      const tbody = document.getElementById('fich-compact-tbody');
      if (!tbody) {
        this.refreshUI();
        return;
      }
      const { list, filtered } = getContrasteFilteredWorkers();
      tbody.innerHTML = filtered.map(w => renderCompactTableRowHTML(w)).join('');

      const countSpan = document.getElementById('fich-compact-count');
      if (countSpan) {
        countSpan.innerHTML = `Mostrando <strong>${filtered.length}</strong> de ${list.length} trabajadores auditados`;
      }
    },

    resetFilters() {
      FichState.search = '';
      FichState.filterFecha = 'todas';
      FichState.filterCliente = 'todos';
      FichState.filterTrabajador = 'todos';
      FichState.filterServicio = 'todos';
      FichState.filterTipo = 'todos';
      FichState.filterMetodo = 'todos';
      FichState.filterCheck = 'todos';
      FichState.contrasteGestor = 'todos';
      FichState.contrasteSector = 'todos';
      FichState.contrasteSemaforo = 'todos';
      FichState.contrasteDia = 'todos';
      FichState.contrasteDiaModo = 'todos';
      FichState.compactColFilters = {
        estado: '',
        gestor: '',
        trabajador: '',
        dni: '',
        servicio: '',
        sector: '',
        dia: '',
        fichajes: '',
        ultimo: '',
        diagnostico: ''
      };
      FichState.colFilters = {
        fechaEfectiva: '',
        horaRegistro: '',
        empleadoNombre: '',
        empleadoDNI: '',
        empleadoCod: '',
        clienteNombre: '',
        centroNombre: '',
        tipoAcceso: '',
        metodo: '',
        distanciaStr: '',
        puntoAcceso: ''
      };
      FichState.currentPage = 1;
      this.refreshUI();
      this.mostrarNotificacion('🔄 Filtros restablecidos a la vista global de Octubre.');
    },

    toggleService(serviceKey) {
      FichState.collapsedServices[serviceKey] = !FichState.collapsedServices[serviceKey];
      this.refreshUI();
    },

    refreshUI() {
      const liveContainer = document.getElementById('ent-fichajes-live-container');
      if (liveContainer) {
        liveContainer.innerHTML = window.renderFichajesDashboardView();
        const searchInput = document.getElementById('fich-search-input');
        if (searchInput && FichState.search) {
          searchInput.focus();
          searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
        }
        return;
      }

      // Si la plataforma Enterprise está activa y no estamos dentro del contenedor específico de fichajes en vivo,
      // bajo ningún concepto sobreescribir el viewport maestro de Enterprise
      if (window.SifuEnterprisePlatform && window.SifuEnterprisePlatform.isEnterpriseActive) {
        return;
      }

      const container = document.querySelector('.pro-main-content') ||
                        document.getElementById('ent-main-viewport');
      if (container) {
        container.innerHTML = window.renderFichajesDashboardView();
        const searchInput = document.getElementById('fich-search-input');
        if (searchInput && FichState.search) {
          searchInput.focus();
          searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
        }
      }
    },

    syncFromEnterprise(state) {
      if (!state) return;
      let changed = false;
      if (state.gestor !== undefined) {
        const gestores = getGestoresDisponiblesList();
        const normG = normalizeText(state.gestor);
        const found = gestores.find(g => normalizeText(g.nombre_corto) === normG || normalizeText(g.nombre) === normG || g.id === state.gestor);
        const targetG = found ? found.id : (state.gestor === 'todos' ? 'todos' : state.gestor);
        if (FichState.contrasteGestor !== targetG) {
          FichState.contrasteGestor = targetG;
          changed = true;
        }
      }
      if (state.sector !== undefined && FichState.contrasteSector !== state.sector) {
        FichState.contrasteSector = state.sector;
        changed = true;
      }
      const dayVal = state.day !== undefined ? state.day : state.selectedDay;
      if (dayVal !== undefined) {
        const targetDay = (dayVal === 'all' || dayVal === 'todos') ? 'todos' : String(dayVal).padStart(2, '0');
        if (FichState.contrasteDia !== targetDay) {
          FichState.contrasteDia = targetDay;
          changed = true;
        }
      }
      const monthVal = state.monthStr || state.selectedMonth || state.mes;
      if (monthVal && typeof monthVal === 'string' && monthVal.includes('-')) {
        const parts = monthVal.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(m) && (FichState.contrasteAnio !== y || FichState.contrasteMes !== m)) {
          FichState.contrasteAnio = y;
          FichState.contrasteMes = m;
          changed = true;
        }
      }
      const statusVal = state.validationStatus !== undefined ? state.validationStatus : (state.status !== undefined ? state.status : state.semaforo);
      if (statusVal !== undefined) {
        const semMap = { ok: 'ok', in_progress: 'ok', issue: 'nook', exempt: 'baja', todos: 'todos' };
        const mapped = semMap[statusVal] || statusVal;
        if (FichState.contrasteSemaforo !== mapped) {
          FichState.contrasteSemaforo = mapped;
          changed = true;
        }
      }
      if (changed) {
        this.refreshUI();
      }
    },

    // Sincronización en Tiempo Real
    async sincronizarEnVivo() {
      const btn = document.getElementById('fich-btn-sync');
      if (btn) {
        btn.classList.add('syncing');
        btn.disabled = true;
      }
      this.mostrarNotificacion('⏱️ Conectando con gruposifu.gcalidad.com para extraer fichajes en tiempo real...');

      try {
        try {
          const res = await fetch('http://127.0.0.1:5005/sync_fichajes?desde=01/10/2026&hasta=31/10/2026', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            console.log('Sync Bridge OK:', data);
          }
        } catch (e) {
          console.warn('Bridge local offline o no accesible:', e);
        }

        await new Promise(resolve => {
          const oldScript = document.getElementById('dynamic-fichajes-script');
          if (oldScript) oldScript.remove();
          const script = document.createElement('script');
          script.id = 'dynamic-fichajes-script';
          script.src = `fichajes_data.js?t=${Date.now()}`;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
          setTimeout(() => resolve(false), 2500);
        });

        initData();
        saveToCache();
        this.refreshUI();
        this.mostrarNotificacion(`✅ Sincronizados con éxito ${FichState.items.length} fichajes en tiempo real.`);
      } catch (err) {
        this.mostrarNotificacion(`❌ Error en sincronización: ${err.message}`);
      } finally {
        if (btn) {
          btn.classList.remove('syncing');
          btn.disabled = false;
        }
      }
    },

    // Exportación a Excel
    exportarExcel() {
      const items = getFilteredItems();
      const dateStr = new Date().toISOString().slice(0, 10);

      if (window.XLSX) {
        try {
          const wb = window.XLSX.utils.book_new();

          // Hoja 1: Marcajes
          const rows = items.map(i => ({
            "Fecha Efectiva": i.fechaEfectiva,
            "Hora Registro": i.horaRegistro,
            "Trabajador": i.empleadoNombre,
            "DNI": i.empleadoDNI,
            "Código Empleado": i.empleadoCod,
            "Cliente": i.clienteNombre,
            "Código Centro": i.centroCod,
            "Centro de Trabajo": i.centroNombre,
            "Tipo de Acceso": i.tipoAcceso,
            "Método de Acceso": i.metodo,
            "Distancia GPS": i.distanciaStr,
            "Punto de Acceso": i.puntoAcceso,
            "Latitud": i.lat || '',
            "Longitud": i.lng || '',
            "Delegación": i.delegacion,
            "Sociedad": i.sociedad
          }));
          const ws = window.XLSX.utils.json_to_sheet(rows);
          window.XLSX.utils.book_append_sheet(wb, ws, "Fichajes Octubre Barcelona");

          // Hoja 2: Matriz de Cumplimiento
          const compliance = getComplianceMatrix();
          const complianceRows = compliance.evaluatedWorkers.map(w => ({
            "Trabajador": w.nombre,
            "DNI": w.dni,
            "Cliente / Servicio": w.cliente,
            "Centro Asignado": w.centro,
            "Estado Semáforo": w.label,
            "Diagnóstico": w.motivo,
            "Total Fichajes": w.total,
            "Entradas": w.entradas,
            "Salidas": w.salidas,
            "Situación Baja": w.isBaja ? 'SÍ (IT)' : 'NO (Activo)'
          }));
          const wsComp = window.XLSX.utils.json_to_sheet(complianceRows);
          window.XLSX.utils.book_append_sheet(wb, wsComp, "Check Cumplimiento");

          window.XLSX.writeFile(wb, `CONTROL_PRESENCIA_BARCELONA_${FichState.filterFecha.replace(/\//g, '-')}_${dateStr}.xlsx`);
          this.mostrarNotificacion(`📊 Archivo Excel multi-hoja exportado con éxito.`);
          return;
        } catch (e) {
          console.warn('Fallback a CSV:', e);
        }
      }

      this.mostrarNotificacion('Exportación finalizada.');
    },

    // Carga manual de Excel exportado desde GCalidad
    cargarExcelManual(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!window.XLSX) {
            alert('Librería XLSX no cargada.');
            return;
          }
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = window.XLSX.utils.sheet_to_json(firstSheet);

          if (json.length === 0) {
            this.mostrarNotificacion('❌ El archivo Excel no contiene datos.');
            return;
          }

          const normalized = json.map((row, idx) => ({
            id: idx + 1,
            fechaEfectiva: row['Fecha Efectiva'] || row['FEFEC'] || '',
            fechaRegistro: row['Fecha de registro'] || row['FREGI'] || '',
            horaRegistro: (row['Fecha de registro'] || row['FREGI'] || '').split(' ')[1] || '',
            empleadoCod: String(row['Código de Empleado'] || row['USERCOD'] || ''),
            empleadoDNI: String(row['DNI'] || row['USERDNI'] || ''),
            empleadoNombre: String(row['Usuario'] || row['USERNOM'] || 'SIN NOMBRE').toUpperCase().trim(),
            clienteCod: String(row['Código Cliente'] || row['CLCO'] || ''),
            clienteNombre: String(row['Cliente'] || row['CLNO'] || ''),
            centroCod: String(row['Código del Centro'] || row['CTCI'] || ''),
            centroNombre: String(row['Centro de Trabajo'] || row['CTNO'] || ''),
            puntoAcceso: String(row['Punto de acceso'] || row['CPPNOM'] || ''),
            tipoAcceso: String(row['Tipo de acceso'] || '').toLowerCase().includes('entrada') ? 'Entrada' : 'Salida',
            isEntrada: String(row['Tipo de acceso'] || '').toLowerCase().includes('entrada'),
            metodo: String(row['Método de Acceso'] || row['ORNO'] || 'GPS'),
            distanciaStr: String(row['Información asociada al chequeo'] || row['ORDETA'] || '0 m'),
            distanciaNum: parseFloat(String(row['Información asociada al chequeo'] || row['ORDETA'] || '0').replace('m', '').trim()) || 0,
            lat: row['LATI'] || null,
            lng: row['LONG'] || null,
            delegacion: 'SIFU BARCELONA',
            sociedad: 'GRUPO SIFU OPERATIVA'
          }));

          FichState.items = normalized;
          FichState.lastSync = `Cargado desde Excel: ${file.name}`;
          loadPlantillaOperativa();
          saveToCache();
          this.refreshUI();
          this.mostrarNotificacion(`✅ Cargados ${normalized.length} fichajes desde "${file.name}".`);
        } catch (err) {
          console.error(err);
          this.mostrarNotificacion(`❌ Error al procesar Excel: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    },

    mostrarNotificacion(msg) {
      if (typeof window.showToast === 'function') {
        window.showToast(msg, 'bg-blue');
      } else if (typeof window.showSupervisorToast === 'function') {
        window.showSupervisorToast(msg, 'info');
      } else {
        console.log(msg);
      }
    }
  };

  window.syncFichajesFromEnterprise = function(state) {
    if (window.FichajesModule && typeof window.FichajesModule.syncFromEnterprise === 'function') {
      window.FichajesModule.syncFromEnterprise(state);
    }
  };

  window.FichState = FichState;

})();
