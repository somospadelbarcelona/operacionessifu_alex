/**
 * FICHAJES CARTERAS UNIFIER · SIFU BARCELONA MULTI-GESTOR (0801)
 * ============================================================================
 * Servicio oficial de unificación de datos de Fichajes y Carteras por Gestor:
 * - Cruza en tiempo real las carteras de SAP S/4HANA (window.HO_CARTERAS_PAYLOAD)
 *   con los fichajes del Portal Empleado / App Móvil (window.FICHAJES_CONTRASTE_PAYLOAD).
 * - Permite filtrar por gestor y ver el 100% de los trabajadores de cada gestor
 *   de la Delegación Barcelona (0801) - 9 Gestores Oficiales.
 * - Para trabajadores sin datos de app móvil, construye automáticamente su
 *   ficha normalizada con estado en SAP HO (Baja IT, Vacaciones, Descanso, No Ficha).
 * ============================================================================
 */

(function () {
  'use strict';

  function normalizeDni(dni) {
    if (!dni) return '';
    return String(dni).replace(/[\s\-_.]/g, '').toUpperCase().trim();
  }

  function normalizeText(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  const GESTORES_CONOCIDOS = [
    {
      id: '00066957',
      id_responsable_proyecto: '52404278',
      id_responsable_empleado: '00066957',
      nombre: 'SONIA CAÑETE CÁRDENAS PERAL',
      nombre_corto: 'Sonia Cañete',
      rol: 'Gestora Operaciones Barcelona (Multicliente)',
      es_principal: true,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00063967',
      id_responsable_proyecto: '21773898',
      id_responsable_empleado: '00063967',
      nombre: 'ADRIÀ SERRANO VIU',
      nombre_corto: 'Adrià Serrano',
      rol: 'Gestor Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00001370',
      id_responsable_proyecto: '34754177',
      id_responsable_empleado: '00001370',
      nombre: 'JULIO ORTIZ SANCHEZ',
      nombre_corto: 'Julio Ortiz',
      rol: 'Gestor Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00015251',
      id_responsable_proyecto: '47906036',
      id_responsable_empleado: '00015251',
      nombre: 'ALBERT SANCHEZ PADROSA',
      nombre_corto: 'Albert Sánchez',
      rol: 'Gestor Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00060598',
      id_responsable_proyecto: '47817940',
      id_responsable_empleado: '00060598',
      nombre: 'JORDI GIMENEZ FERRER',
      nombre_corto: 'Jordi Giménez',
      rol: 'Gestor Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00065945',
      id_responsable_proyecto: '03856780',
      id_responsable_empleado: '00065945',
      nombre: 'LIANA GARAYSHINA',
      nombre_corto: 'Liana Garayshina',
      rol: 'Gestora Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00027631',
      id_responsable_proyecto: '47782275',
      id_responsable_empleado: '00027631',
      nombre: 'ALBA VALVERDE CEREZO',
      nombre_corto: 'Alba Valverde',
      rol: 'Gestora Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00010085',
      id_responsable_proyecto: '33915443',
      id_responsable_empleado: '00010085',
      nombre: 'JOSE GARCIA QUESADA',
      nombre_corto: 'José García',
      rol: 'Gestor Operaciones Barcelona',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    },
    {
      id: '00062620',
      id_responsable_proyecto: '46468278',
      id_responsable_empleado: '00062620',
      nombre: 'ALEJANDRO COSCOLIN PEREGRIN',
      nombre_corto: 'Alejandro Coscolin',
      rol: 'Servicios Barcelona / Indra Roc Boronat',
      es_principal: false,
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    }
  ];

  /**
   * Resuelve el gestor más probable a partir de un ID o nombre del responsable
   */
  function resolveGestorInfo(gestorId, respNombre) {
    const gidStr = String(gestorId || '').trim();
    if (gidStr) {
      const match = GESTORES_CONOCIDOS.find(g => g.id === gidStr || g.id_responsable_proyecto === gidStr || g.id_responsable_empleado === gidStr);
      if (match) return match;
    }
    const nResp = normalizeText(respNombre);
    if (nResp) {
      const match = GESTORES_CONOCIDOS.find(g => {
        const gn = normalizeText(g.nombre);
        const gc = normalizeText(g.nombre_corto);
        return nResp.includes(gn) || gn.includes(nResp) || nResp.includes(gc) || gc.includes(nResp);
      });
      if (match) return match;
    }
    return {
      id: gidStr || (GESTORES_CONOCIDOS[0] ? GESTORES_CONOCIDOS[0].id : '00066957'),
      nombre: respNombre || (GESTORES_CONOCIDOS[0] ? GESTORES_CONOCIDOS[0].nombre : 'SONIA CAÑETE CÁRDENAS PERAL'),
      nombre_corto: respNombre ? respNombre.split(' ')[0] : 'Sonia Cañete',
      empresa_grupo: 'SIFU',
      empresa_badge: '🏢 SIFU'
    };
  }

  /**
   * Unifica y enriquece trabajadores de fichajes y carteras SAP HO
   */
  let _unifiedCache = null;
  let _lastFSync = null;
  let _lastCTime = null;
  let _lastFWLen = 0;
  let _lastCWLen = 0;

  function buildUnifiedFichajesContraste(fichajesPayload, carterasPayload) {
    const fPayload = fichajesPayload || (window && window.FICHAJES_CONTRASTE_PAYLOAD) || { trabajadores: [] };
    const cPayload = carterasPayload || (window && window.HO_CARTERAS_PAYLOAD) || { trabajadores: [], gestores: [] };

    const fWorkers = Array.isArray(fPayload.trabajadores) ? fPayload.trabajadores : [];
    const cWorkers = Array.isArray(cPayload.trabajadores) ? cPayload.trabajadores : [];

    const fSync = fPayload.fecha_sincronizacion || '';
    const cTime = cPayload.timestamp || '';
    if (_unifiedCache && _lastFSync === fSync && _lastCTime === cTime && _lastFWLen === fWorkers.length && _lastCWLen === cWorkers.length) {
      return _unifiedCache;
    }
    const cGestores = Array.isArray(cPayload.gestores) && cPayload.gestores.length > 0 ? cPayload.gestores : GESTORES_CONOCIDOS;

    // Indexar trabajadores de fichajes reales de la app por DNI y por Nombre normalizado
    const fByDni = {};
    const fByName = {};
    fWorkers.forEach(w => {
      const cdni = normalizeDni(w.dni);
      const cnom = normalizeText(w.nombre);
      if (cdni) fByDni[cdni] = w;
      if (cnom) fByName[cnom] = w;
    });

    const unifiedList = [];
    const processedDnis = new Set();
    const processedNames = new Set();

    // 1. Recorrer todos los trabajadores de las carteras de los gestores de SAP HO
    cWorkers.forEach(wHO => {
      const cdni = normalizeDni(wHO.dni);
      const cnom = normalizeText(wHO.nombre);
      const gid = String(wHO.gestor_id || '').trim();
      const gInfo = resolveGestorInfo(gid, wHO.responsable_rrhh || wHO.responsable_corto);

      // Buscar si tiene datos reales de app móvil
      const wApp = (cdni && fByDni[cdni]) || (cnom && fByName[cnom]) || null;

      let item = null;

      if (wApp) {
        // A) TRABAJADOR CON FICHAS REALES DE LA APP MÓVIL
        item = Object.assign({}, wApp);
        item.gestor_id = gInfo.id;
        item.gestor_nombre = wHO.responsable_rrhh || gInfo.nombre;
        item.gestor_corto = wHO.responsable_corto || gInfo.nombre_corto;
        item.empresa_badge = wHO.empresa_badge || gInfo.empresa_badge;
        item.empresa_grupo = wHO.empresa_grupo || gInfo.empresa_grupo;
        item.id_empleado = wHO.id || item.id_empleado || '';
        item.telefono = wHO.telefono || item.telefono || '';
        item.email = wHO.email || item.email || '';
        item.cliente = wHO.cliente_principal || item.cliente || '';
        item.horario_habitual = wHO.horario_habitual || item.horario_habitual || 'Según cuadrante SAP HO';

        // Evaluación rigurosa de Baja Médica IT y Vacaciones sincronizadas de SAP HO + CTI
        const esBajaHO = Boolean(wHO.en_baja || (wHO.estado_hoy && String(wHO.estado_hoy).trim().toUpperCase() === 'BAJA') || (wHO.estado_hoy && String(wHO.estado_hoy).trim().toUpperCase() === 'BAJA_IT') || wApp.isBaja || wApp.en_baja || wApp.estado_semaforo === 'baja');
        const esVacHO = Boolean(wHO.de_vacaciones || (wHO.estado_hoy && wHO.estado_hoy.toUpperCase().includes('VACACION')) || wApp.de_vacaciones || wApp.estado_semaforo === 'vacaciones');

        if (esBajaHO) {
          item.isBaja = true;
          item.en_baja = true;
          item.de_vacaciones = false;
          item.estado_semaforo = 'baja';
          item.estado_hoy = 'BAJA_IT';
          item.situacion_personal = 'BAJA_IT';
          item.diagnostico = '🩺 BAJA MÉDICA IT JUSTIFICADA (Incapacidad Temporal en SAP HO / CTI)';
          item.diagnostico_hoy = '🏥 En situación de Baja Médica (IT) justificada en SAP HO';
        } else if (esVacHO) {
          item.isBaja = false;
          item.en_baja = false;
          item.de_vacaciones = true;
          item.estado_semaforo = 'vacaciones';
          item.estado_hoy = 'VACACIONES';
          item.situacion_personal = 'VACACIONES';
          item.diagnostico = '🏖️ PERIODO VACACIONAL / PERMISO EN SAP HO';
          item.diagnostico_hoy = '🏖️ De vacaciones según cuadrante oficial de SAP HO';
        } else {
          item.situacion_personal = 'ACTIVO';
        }
      } else {
        // B) TRABAJADOR DE CARTERA SIN DATOS DE APP MÓVIL AÚN (CONSTRUCCIÓN SINTÉTICA OFICIAL)
        const proyNom = wHO.proyecto_principal_nombre || '';
        const cliNom = wHO.cliente_principal || '';
        const servStr = proyNom && cliNom ? `${proyNom} (${cliNom})` : (proyNom || wHO.nom_centro || 'SERVICIO BARCELONA');

        let secStr = 'LIMPIEZA';
        if (proyNom.includes('(AUX)') || (wHO.sector && wHO.sector.includes('AUX')) || servStr.includes('CONSERJ') || servStr.includes('AUXILIAR')) {
          secStr = 'AUXILIARES';
        } else if (gInfo.id === '00062620' || servStr.includes('INDRA') || servStr.includes('ROC BORONAT') || cliNom.includes('INDRA')) {
          secStr = 'INDRA ROC BORONAT';
        } else if (gInfo.id === '00066957' || servStr.includes('MULTI') || cliNom.includes('MULTI')) {
          secStr = 'MULTICLIENTE BCN';
        }

        const isBaja = Boolean(wHO.en_baja || (wHO.estado_hoy && String(wHO.estado_hoy).trim().toUpperCase() === 'BAJA') || (wHO.estado_hoy && String(wHO.estado_hoy).trim().toUpperCase() === 'BAJA_IT'));
        const isVac = Boolean(wHO.de_vacaciones || (wHO.estado_hoy && wHO.estado_hoy.toUpperCase().includes('VACACION')));
        const isDescanso = Boolean(wHO.estado_hoy && wHO.estado_hoy.toUpperCase().includes('DESCANSO'));
        const isTrabajandoHO = Boolean(wHO.trabajando_hoy || (wHO.estado_hoy && wHO.estado_hoy.toUpperCase().includes('TRABAJ')));

        let estadoHoy = 'NO_FICHADO';
        let estadoSemaforo = 'noficha';
        let diagnostico = '🔴 Sin fichaje registrado en la app móvil';
        let diagnosticoHoy = '⚠️ Sin marcaje registrado en app para hoy';

        if (isBaja) {
          estadoHoy = 'BAJA_IT';
          estadoSemaforo = 'baja';
          diagnostico = '🩺 BAJA MÉDICA IT JUSTIFICADA (Incapacidad Temporal en SAP)';
          diagnosticoHoy = '🏥 En situación de Baja Médica (IT) justificada en SAP HO';
        } else if (isVac) {
          estadoHoy = 'VACACIONES';
          estadoSemaforo = 'ok';
          diagnostico = '🏖️ Periodo vacacional justificado en SAP HO';
          diagnosticoHoy = '🏖️ De vacaciones según cuadrante oficial';
        } else if (isDescanso) {
          estadoHoy = 'DESCANSO';
          estadoSemaforo = 'noficha';
          diagnostico = '💤 Descanso / Sin turno planificado hoy en SAP HO';
          diagnosticoHoy = '💤 Descanso semanal planificado en cuadrante';
        } else if (isTrabajandoHO) {
          estadoHoy = 'NO_FICHADO';
          estadoSemaforo = 'noficha';
          diagnostico = '🔴 Turno planificado en SAP HO · Sin marcaje registrado en App';
          diagnosticoHoy = '⚠️ Horario previsto en SAP HO: ' + (wHO.horario_habitual || 'Según cuadrante');
        }

        item = {
          nombre: wHO.nombre,
          dni: cdni,
          id_empleado: wHO.id || '',
          telefono: wHO.telefono || '',
          email: wHO.email || '',
          servicio: servStr,
          cliente: cliNom || 'CLIENTE SIFU',
          sector: secStr,
          gestor_id: gInfo.id,
          gestor_nombre: wHO.responsable_rrhh || gInfo.nombre,
          gestor_corto: wHO.responsable_corto || gInfo.nombre_corto,
          empresa_badge: wHO.empresa_badge || gInfo.empresa_badge,
          empresa_grupo: wHO.empresa_grupo || gInfo.empresa_grupo,
          fuente_censo: 'ho_carteras_sync',
          login_ok: false,
          sync_ok: false,
          sync_error: null,
          intentos: 0,
          datos_obsoletos: false,
          estado_hoy: estadoHoy,
          estado_semaforo: estadoSemaforo,
          diagnostico: diagnostico,
          diagnostico_hoy: diagnosticoHoy,
          ultimo_fichaje: null,
          total_fichajes: 0,
          dias_fichados: [],
          dias_fichados_activos: [],
          fichajes_mes_activo: [],
          fichajes: [],
          calendar_days: {},
          meses: {},
          en_baja: isBaja,
          isBaja: isBaja,
          horario_habitual: wHO.horario_habitual || 'Según cuadrante SAP HO'
        };
      }

      unifiedList.push(item);
      if (cdni) processedDnis.add(cdni);
      if (cnom) processedNames.add(cnom);
    });

    // 2. Incorporar cualquier trabajador de la app de fichajes que no estuviera en carteras
    fWorkers.forEach(wApp => {
      const cdni = normalizeDni(wApp.dni);
      const cnom = normalizeText(wApp.nombre);
      if ((cdni && processedDnis.has(cdni)) || (cnom && processedNames.has(cnom))) {
        return;
      }
      const gInfo = resolveGestorInfo(wApp.gestor_id, wApp.gestor_nombre);
      const item = Object.assign({}, wApp);
      item.gestor_id = item.gestor_id || gInfo.id;
      item.gestor_nombre = item.gestor_nombre || gInfo.nombre;
      item.gestor_corto = item.gestor_corto || gInfo.nombre_corto;
      item.empresa_badge = item.empresa_badge || gInfo.empresa_badge;
      item.empresa_grupo = item.empresa_grupo || gInfo.empresa_grupo;
      unifiedList.push(item);
      if (cdni) processedDnis.add(cdni);
      if (cnom) processedNames.add(cnom);
    });

    // Ordenar alfabéticamente por nombre
    unifiedList.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    // 3. Enriquecer KPIs de cada Gestor
    const gestoresList = cGestores.map(g => {
      const misTrab = unifiedList.filter(w => w.gestor_id === g.id || w.gestor_corto === g.nombre_corto || (g.nombre && w.gestor_nombre === g.nombre));
      const countBaja = misTrab.filter(w => w.estado_semaforo === 'baja' || w.isBaja || w.en_baja).length;
      const countVac = misTrab.filter(w => (w.estado_semaforo === 'vacaciones' || w.de_vacaciones) && !w.isBaja && !w.en_baja).length;
      const countOk = misTrab.filter(w => w.estado_semaforo === 'ok' && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;
      const countNook = misTrab.filter(w => w.estado_semaforo === 'nook' && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;
      const countNoficha = misTrab.filter(w => (w.estado_semaforo === 'noficha' || !w.estado_semaforo) && !w.isBaja && !w.en_baja && !w.de_vacaciones).length;
      const activosTotal = misTrab.length - countBaja - countVac;
      const kpiData = {
        total_trabajadores: misTrab.length,
        ok: countOk,
        nook: countNook,
        noficha: countNoficha,
        bajas: countBaja,
        baja: countBaja,
        vacaciones: countVac,
        pct_cumplimiento: activosTotal > 0 ? (((countOk) / activosTotal) * 100).toFixed(1) : '0.0'
      };
      return Object.assign({}, g, {
        kpis_fichajes: kpiData,
        kpis_por_gestor: kpiData
      });
    });

    const result = {
      total: unifiedList.length,
      trabajadores: unifiedList,
      gestores: gestoresList,
      fecha_sincronizacion: fPayload.fecha_sincronizacion || 'En Vivo (Multi-Gestor)',
      schema_version: 3
    };

    _unifiedCache = result;
    _lastFSync = fSync;
    _lastCTime = cTime;
    _lastFWLen = fWorkers.length;
    _lastCWLen = cWorkers.length;

    return result;
  }

  // Exportar al ámbito global
  window.FichajesCarterasUnifier = {
    normalizeDni: normalizeDni,
    normalizeText: normalizeText,
    GESTORES_CONOCIDOS: GESTORES_CONOCIDOS,
    resolveGestorInfo: resolveGestorInfo,
    buildUnifiedFichajesContraste: buildUnifiedFichajesContraste
  };

  console.log('[FichajesCarterasUnifier] Módulo multi-gestor inicializado correctamente.');
})();
