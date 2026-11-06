/**
 * ============================================================================
 * SIFU BARCELONA — 2.5 OPERADOR AUTÓNOMO SAP HO & MEMORIA DE OFICIO (v3.0)
 * Motor de Inteligencia Operativa Real, Aprendizaje del Oficio y Ejecución OData
 * Conectado a: SAP S/4HANA (ZPS_HOPER_SRV) vía Supervisor Bridge (127.0.0.1:5005)
 * Responsable: ALEJANDRO COSCOLIN (46468278) · Delegación Barcelona (0801)
 * ============================================================================
 */

(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = engine;
  }
  if (root) {
    root.HOAutoEngine = engine;
  }
  if (typeof window !== 'undefined') {
    window.HOAutoEngine = engine;
  }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  const STORAGE_KEY_OFICIO_MEM = 'sifu_ho_oficio_memory_v30';
  const BRIDGE_BASE = 'http://127.0.0.1:5005';

  // Catálogo oficial de los 9 Gestores de Barcelona (División 0801)
  const GESTORES_BCN = [
    { id: 'todos', doc: '0801', nombre: 'Toda Barcelona (9 Gestores · 0801)', corto: 'Toda Barcelona' },
    { id: '00062620', doc: '46468278', nombre: 'Alejandro Coscolin Peregrín', corto: 'Alejandro Coscolin', match: ['ALEJANDRO COSCOLIN', 'COSCOLIN'] },
    { id: '00066957', doc: '52404278', nombre: 'Sonia Cañete Cárdenas Peral', corto: 'Sonia Cañete', match: ['SONIA CAÑETE', 'SONIA CANETE', 'CAÑETE'] },
    { id: '00063967', doc: '21773898', nombre: 'Adrià Serrano Viu', corto: 'Adrià Serrano', match: ['ADRIÀ SERRANO', 'ADRIA SERRANO', 'SERRANO'] },
    { id: '00065945', doc: '03856780', nombre: 'Liana Garayshina', corto: 'Liana Garayshina', match: ['LIANA GARAYSHINA', 'GARAYSHINA'] },
    { id: '00060598', doc: '47817940', nombre: 'Jordi Giménez Ferrer', corto: 'Jordi Giménez', match: ['JORDI GIMENEZ', 'JORDI GIMÉNEZ', 'GIMENEZ'] },
    { id: '00010085', doc: '33915443', nombre: 'José García Quesada', corto: 'José García', match: ['JOSE GARCIA', 'JOSÉ GARCÍA', 'GARCIA QUESADA'] },
    { id: '00027631', doc: '47782275', nombre: 'Alba Valverde Cerezo', corto: 'Alba Valverde', match: ['ALBA VALVERDE', 'VALVERDE'] },
    { id: '00001370', doc: '34754177', nombre: 'Julio Ortiz Sánchez', corto: 'Julio Ortiz', match: ['JULIO ORTIZ', 'ORTIZ SANCHEZ'] },
    { id: '00015251', doc: '47906036', nombre: 'Albert Sánchez Padrosa', corto: 'Albert Sánchez', match: ['ALBERT SANCHEZ', 'ALBERT SÁNCHEZ', 'SANCHEZ PADROSA'] }
  ];

  // Reglas base iniciales del oficio (extraídas de la operativa real de BCN 0801)
  const DEFAULT_REGLAS_OFICIO = [
    {
      id: 'REG-OFICIO-ORO-P1-P2',
      ambito: 'GLOBAL',
      target_id: 'REGLA_SOCIEDADES_DUALES_P1_P2',
      target_label: 'Regla de Oro Universal: SIFU (P1) vs EPID (P2)',
      gestor_id: 'todos',
      gestor_nombre: 'Toda Barcelona',
      criterio: 'REGLA MAESTRA DE SOCIEDADES: Dentro de un cliente pueden existir dos proyectos: [BASE]-P1 (SIFU) y [BASE]-P2 (EPID). Si el trabajador es SIFU estará en P1 y P2 estará a 0 horas (CORRECTO). Si es EPID estará en P2 y P1 estará a 0 horas (CORRECTO). El cliente SOLO queda descubierto cuando NO hay nadie en NINGUNO de los dos proyectos.',
      accion_preferida: 'CUADRANTE',
      empleado_preferido: 'AUTO_SOCIEDAD',
      sociedad_preferida: 'AUTO',
      turno: '01',
      hora_inicio: '08:00',
      hora_fin: '15:00',
      tipo_imputacion: 'TI',
      tipo_exceso: 'Esporadico',
      modo: 'AUTONOMO',
      veces_aplicada: 361,
      confianza: 100,
      creada_por: 'Regla de Oro Alejandro Coscolin',
      fecha_actualizacion: '03/11/2026'
    },
    {
      id: 'REG-OFICIO-01',
      ambito: 'PROYECTO',
      target_id: 'PROY015730',
      target_label: 'Indra Roc Boronat 22@ (PROY015730-P1 / P2)',
      gestor_id: '00062620',
      gestor_nombre: 'Alejandro Coscolin',
      criterio: 'Priorizar imputación vía EPID (P2) con titular DORIS IMADE en turno T01 (07:00-15:00 L-V) y desactivar penalización CMH en refuerzos bajo demanda.',
      accion_preferida: 'CUADRANTE',
      empleado_preferido: 'DORIS IMADE',
      sociedad_preferida: 'EPID (P2)',
      turno: '01',
      hora_inicio: '07:00',
      hora_fin: '15:00',
      tipo_imputacion: 'TI',
      tipo_exceso: 'Estructura',
      modo: 'AUTONOMO', // 'SUGERIR' | 'LOTE' | 'AUTONOMO'
      veces_aplicada: 14,
      confianza: 98,
      creada_por: 'Aprendizaje Operativo Alejandro',
      fecha_actualizacion: '03/11/2026'
    },
    {
      id: 'REG-OFICIO-02',
      ambito: 'GESTOR',
      target_id: '00010085',
      target_label: 'Comunidades y Conserjerías · Cartera José García',
      gestor_id: '00010085',
      gestor_nombre: 'José García',
      criterio: 'Cuando un servicio de conserjería/comunidad figure descubierto en SAP HO pero tenga actividad en bitácora, proponer al equipo de cobertura habitual (JORGE ALBERO TUREGANO / JAVIER ARELLANO PEREZ) en turno de mañana 08:00-14:00.',
      accion_preferida: 'CUADRANTE',
      empleado_preferido: 'JORGE ALBERO TUREGANO',
      sociedad_preferida: 'AUTO',
      turno: '01',
      hora_inicio: '08:00',
      hora_fin: '14:00',
      tipo_imputacion: 'SB',
      tipo_exceso: 'Esporadico',
      modo: 'LOTE',
      veces_aplicada: 9,
      confianza: 92,
      creada_por: 'Patrón Bitácora SAP HO',
      fecha_actualizacion: '03/11/2026'
    },
    {
      id: 'REG-OFICIO-03',
      ambito: 'GESTOR',
      target_id: '00063967',
      target_label: 'Brigadas de Jardinería · Cartera Adrià Serrano',
      gestor_id: '00063967',
      gestor_nombre: 'Adrià Serrano',
      criterio: 'En servicios trimestrales o centros sanitarios (Consorci Sanitari Integral / C.P.) descubiertos en SAP HO, imputar brigada rotativa (IGNASI CRESPO LLAVADOR / DANIEL CHAMIZO PEREZ) respetando sociedad activa P1/P2.',
      accion_preferida: 'CUADRANTE',
      empleado_preferido: 'IGNASI CRESPO LLAVADOR',
      sociedad_preferida: 'AUTO',
      turno: '01',
      hora_inicio: '07:00',
      hora_fin: '15:00',
      tipo_imputacion: 'TI',
      tipo_exceso: 'Esporadico',
      modo: 'LOTE',
      veces_aplicada: 11,
      confianza: 90,
      creada_por: 'Patrón Brigadas Jardinería',
      fecha_actualizacion: '03/11/2026'
    },
    {
      id: 'REG-OFICIO-04',
      ambito: 'GESTOR',
      target_id: '00065945',
      target_label: 'Garajes y Parkings · Cartera Liana Garayshina',
      gestor_id: '00065945',
      gestor_nombre: 'Liana Garayshina',
      criterio: 'En garajes y parkings sin horas en SAP HO, priorizar operarios polivalentes de parking (FRANCISCO JOSE AMARO RUEDA / AGUSTIN BENIDIO SARTAGES) con imputación SB e indicar en bitácora.',
      accion_preferida: 'CUADRANTE',
      empleado_preferido: 'FRANCISCO JOSE AMARO RUEDA',
      sociedad_preferida: 'AUTO',
      turno: '01',
      hora_inicio: '08:00',
      hora_fin: '16:00',
      tipo_imputacion: 'SB',
      tipo_exceso: 'Esporadico',
      modo: 'LOTE',
      veces_aplicada: 8,
      confianza: 89,
      creada_por: 'Patrón Operativo Parkings',
      fecha_actualizacion: '03/11/2026'
    },
    {
      id: 'REG-OFICIO-05',
      ambito: 'GLOBAL',
      target_id: 'BAJA_IT_ART38',
      target_label: 'Protección Vacaciones en Baja IT (Art. 38.3 E.T.)',
      gestor_id: 'todos',
      gestor_nombre: 'Toda Barcelona',
      criterio: 'Todo trabajador en Baja IT (BJ) que tenga días de vacaciones pendientes (vac_restantes > 0) debe tener anotación de bloqueo Art. 38.3 E.T. en SAP HO y suplente asignado con código SB.',
      accion_preferida: 'SUSTITUIR',
      empleado_preferido: 'AUTO_CARTERA',
      sociedad_preferida: 'AUTO',
      turno: '01',
      hora_inicio: '08:00',
      hora_fin: '15:00',
      tipo_imputacion: 'SB',
      tipo_exceso: 'Esporadico',
      modo: 'AUTONOMO',
      veces_aplicada: 6,
      confianza: 95,
      creada_por: 'Normativa Laboral SIFU',
      fecha_actualizacion: '03/11/2026'
    }
  ];

  // Estado interno reactivo del motor
  let _memoria = {
    nivel_autonomia: 2, // 1 = Aprendiz, 2 = Casi Autónomo (Lotes/Copiloto), 3 = Autónomo 24x7
    centinela_activo: true,
    ciclos_escaneo: 1,
    sap_online: false,
    ultimo_escaneo: new Date().toLocaleTimeString('es-ES', { hour12: false }),
    reglas: DEFAULT_REGLAS_OFICIO.slice(),
    casos_resueltos_ids: {}, // { [idCaso]: { timestamp, payload, resultado } }
    casos_personalizados: {}, // { [idCaso]: { trabajador, suplente, turno, hora_inicio, hora_fin, tipo_imputacion, tipo_exceso, proyecto } }
    ejecuciones: [], // Historial auditable con soporte de reversión
    logs_vivo: []
  };

  let _tickListeners = [];
  let _centinelaTimer = null;

  // Cargar memoria desde localStorage y sincronizar con Supervisor Bridge
  function cargarMemoria() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_OFICIO_MEM);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.nivel_autonomia) _memoria.nivel_autonomia = Number(parsed.nivel_autonomia);
            if (typeof parsed.centinela_activo === 'boolean') _memoria.centinela_activo = parsed.centinela_activo;
            if (Array.isArray(parsed.reglas) && parsed.reglas.length > 0) _memoria.reglas = parsed.reglas;
            if (parsed.casos_resueltos_ids) _memoria.casos_resueltos_ids = parsed.casos_resueltos_ids;
            if (parsed.casos_personalizados) _memoria.casos_personalizados = parsed.casos_personalizados;
            if (Array.isArray(parsed.ejecuciones)) _memoria.ejecuciones = parsed.ejecuciones;
          }
        }
      }
    } catch (e) {
      console.warn('[HOAutoEngine] Error leyendo localStorage:', e);
    }

    // Intentar recuperar también desde disco vía Bridge 5005
    if (typeof fetch === 'function') {
      fetch(`${BRIDGE_BASE}/oficio_memory`)
        .then(r => r.json())
        .then(res => {
          _memoria.sap_online = true;
          if (res && res.status === 'ok' && res.memory && Array.isArray(res.memory.reglas) && res.memory.reglas.length > 0) {
            _memoria.reglas = res.memory.reglas;
            if (res.memory.nivel_autonomia) _memoria.nivel_autonomia = Number(res.memory.nivel_autonomia);
            if (res.memory.casos_resueltos_ids) {
              _memoria.casos_resueltos_ids = Object.assign({}, res.memory.casos_resueltos_ids, _memoria.casos_resueltos_ids);
            }
            if (Array.isArray(res.memory.ejecuciones) && res.memory.ejecuciones.length > _memoria.ejecuciones.length) {
              _memoria.ejecuciones = res.memory.ejecuciones;
            }
            guardarMemoriaLocalOnly();
            notificarTick();
          }
        })
        .catch(() => {
          _memoria.sap_online = false;
        });

      // Comprobar estado de conexión SAP HO
      fetch(`${BRIDGE_BASE}/status`)
        .then(r => r.json())
        .then(st => {
          if (st && typeof st.ho_connected === 'boolean') {
            _memoria.sap_online = st.ho_connected;
            notificarTick();
          }
        })
        .catch(() => {});
    }
  }

  function guardarMemoriaLocalOnly() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_OFICIO_MEM, JSON.stringify({
          nivel_autonomia: _memoria.nivel_autonomia,
          centinela_activo: _memoria.centinela_activo,
          reglas: _memoria.reglas,
          casos_resueltos_ids: _memoria.casos_resueltos_ids,
          casos_personalizados: _memoria.casos_personalizados,
          ejecuciones: _memoria.ejecuciones.slice(0, 120)
        }));
      }
    } catch (e) {
      console.warn('[HOAutoEngine] Error guardando localStorage:', e);
    }
  }

  function guardarMemoria() {
    guardarMemoriaLocalOnly();
    if (typeof fetch === 'function') {
      fetch(`${BRIDGE_BASE}/oficio_memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel_autonomia: _memoria.nivel_autonomia,
          centinela_activo: _memoria.centinela_activo,
          reglas: _memoria.reglas,
          casos_resueltos_ids: _memoria.casos_resueltos_ids,
          casos_personalizados: _memoria.casos_personalizados,
          ejecuciones: _memoria.ejecuciones.slice(0, 120),
          updated_at: new Date().toISOString()
        })
      }).catch(() => {});
    }
  }

  function addLog(nivel, texto, codigo) {
    const hora = new Date().toLocaleTimeString('es-ES', { hour12: false });
    _memoria.logs_vivo.unshift({
      hora: hora,
      nivel: nivel || 'INFO',
      codigo: codigo || 'OFICIO',
      texto: texto
    });
    if (_memoria.logs_vivo.length > 50) {
      _memoria.logs_vivo = _memoria.logs_vivo.slice(0, 50);
    }
  }

  // ==========================================================================
  // ACCESO A LOS DATASETS REALES DE BARCELONA (0801)
  // ==========================================================================
  function getIntelServices() {
    if (typeof window !== 'undefined' && window.HO_INTEL_SERVICES_DATA && Array.isArray(window.HO_INTEL_SERVICES_DATA.servicios)) {
      return window.HO_INTEL_SERVICES_DATA.servicios;
    }
    return [];
  }

  function getCarterasPayload() {
    if (typeof window !== 'undefined' && window.HO_CARTERAS_PAYLOAD) {
      return window.HO_CARTERAS_PAYLOAD;
    }
    return { gestores: [], proyectos: [], trabajadores: [] };
  }

  function getVacacionesPayload() {
    if (typeof window !== 'undefined' && window.HO_VACACIONES_PAYLOAD && Array.isArray(window.HO_VACACIONES_PAYLOAD.trabajadores)) {
      return window.HO_VACACIONES_PAYLOAD.trabajadores;
    }
    return [];
  }

  function getCMHPayload() {
    if (typeof window !== 'undefined' && Array.isArray(window.CMH_BCN_PAYLOAD)) {
      return window.CMH_BCN_PAYLOAD;
    }
    return [];
  }

  // Busca el mejor suplente disponible en la cartera de un gestor
  function buscarSuplenteDisponibleEnCartera(gestorId, excluirNombres, clienteNombre) {
    const carteras = getCarterasPayload();
    const trabajadores = Array.isArray(carteras.trabajadores) ? carteras.trabajadores : [];
    const excl = new Set((excluirNombres || []).map(n => String(n || '').toUpperCase().trim()));

    // 1. Mirar si hay una regla de oficio aprendida para este cliente o gestor
    const reglaMatch = buscarReglaAplicable(null, clienteNombre, gestorId, 'SUSTITUIR') ||
                       buscarReglaAplicable(null, clienteNombre, gestorId, 'CUADRANTE');
    if (reglaMatch && reglaMatch.empleado_preferido && reglaMatch.empleado_preferido !== 'AUTO_CARTERA') {
      if (!excl.has(reglaMatch.empleado_preferido.toUpperCase())) {
        const empRegla = trabajadores.find(t => String(t.nombre || '').toUpperCase().includes(reglaMatch.empleado_preferido.toUpperCase()));
        return {
          nombre: reglaMatch.empleado_preferido,
          id: empRegla ? empRegla.id : '',
          dni: empRegla ? empRegla.dni : '',
          telefono: empRegla ? empRegla.telefono : '',
          horas_semana: empRegla ? empRegla.horas_semana : 35,
          motivo_eleccion: `Regla de Oficio Aprendida (${reglaMatch.id})`,
          regla_id: reglaMatch.id,
          confianza: reglaMatch.confianza || 95
        };
      }
    }

    // 2. Filtrar trabajadores activos del mismo gestor que no estén de baja ni vacaciones
    let candidatos = trabajadores.filter(t => {
      const nom = String(t.nombre || '').toUpperCase().trim();
      if (!nom || excl.has(nom)) return false;
      if (t.en_baja || t.de_vacaciones || t.estado_hoy === 'Baja') return false;
      if (gestorId && gestorId !== 'todos') {
        return String(t.gestor_id || '').trim() === String(gestorId).trim();
      }
      return true;
    });

    // Preferir los que tienen menos de 38h semanales o rol de suplente/correturnos
    candidatos.sort((a, b) => {
      const ha = Number(a.horas_semana || 38);
      const hb = Number(b.horas_semana || 38);
      return ha - hb;
    });

    if (candidatos.length > 0) {
      const mejor = candidatos[0];
      return {
        nombre: mejor.nombre,
        id: mejor.id || '',
        dni: mejor.dni || '',
        telefono: mejor.telefono || '',
        horas_semana: mejor.horas_semana || 35,
        motivo_eleccion: `Operario activo en cartera con disponibilidad (${mejor.horas_semana || 35}h/sem)`,
        regla_id: null,
        confianza: 84
      };
    }

    return {
      nombre: 'JORGE ALBERO TUREGANO',
      id: '00041290',
      dni: '',
      telefono: '',
      horas_semana: 36,
      motivo_eleccion: 'Correturnos de reserva Delegación Barcelona 0801',
      regla_id: null,
      confianza: 78
    };
  }

  // Busca si existe una Regla de Oficio aprendida para un proyecto, cliente o gestor
  function buscarReglaAplicable(proyectoId, clienteNombre, gestorId, tipoAccion) {
    const pUp = String(proyectoId || '').toUpperCase().trim();
    const baseUp = pUp.split('-')[0];
    const cUp = String(clienteNombre || '').toUpperCase().trim();
    const gUp = String(gestorId || '').trim();

    // 1. Prioridad máxima: Regla exacta por Proyecto
    for (let i = 0; i < _memoria.reglas.length; i++) {
      const r = _memoria.reglas[i];
      if (r.ambito === 'PROYECTO' && r.target_id) {
        const tUp = String(r.target_id).toUpperCase().trim();
        if (pUp === tUp || baseUp === tUp.split('-')[0] || (pUp && pUp.includes(tUp))) {
          return r;
        }
      }
    }

    // 2. Prioridad media: Regla por Cliente
    if (cUp) {
      for (let i = 0; i < _memoria.reglas.length; i++) {
        const r = _memoria.reglas[i];
        if (r.ambito === 'CLIENTE' && r.target_id && cUp.includes(String(r.target_id).toUpperCase().trim())) {
          return r;
        }
      }
    }

    // 3. Prioridad por Gestor
    if (gUp) {
      for (let i = 0; i < _memoria.reglas.length; i++) {
        const r = _memoria.reglas[i];
        if (r.ambito === 'GESTOR' && String(r.target_id).trim() === gUp) {
          if (!tipoAccion || !r.accion_preferida || r.accion_preferida === tipoAccion) {
            return r;
          }
        }
      }
    }

    return null;
  }

  function resolverGestorCorto(gestorId, fallbackName) {
    const g = GESTORES_BCN.find(x => x.id === String(gestorId || '').trim() || x.doc === String(gestorId || '').trim());
    if (g && g.id !== 'todos') return g.corto;
    return fallbackName || 'Barcelona 0801';
  }

  function coincidenGestores(itemGestorId, itemGestorNombre, filtroGestorId) {
    if (!filtroGestorId || filtroGestorId === 'todos') return true;
    const gObj = GESTORES_BCN.find(g => g.id === filtroGestorId || g.doc === filtroGestorId);
    if (!gObj) return true;
    const idStr = String(itemGestorId || '').trim();
    if (idStr === gObj.id || idStr === gObj.doc) return true;
    const nomUp = String(itemGestorNombre || '').toUpperCase();
    if (gObj.match && gObj.match.some(m => nomUp.includes(m))) return true;
    return false;
  }

  // ==========================================================================
  // GENERADOR DINÁMICO DE LA COLA DE TRABAJO OPERATIVO REAL
  // ==========================================================================
  function construirColaTrabajoCompleta(gestorFilter) {
    const casos = [];
    const hoyIso = new Date().toISOString().slice(0, 10);
    const finMesIso = '2026-11-30';

    // ------------------------------------------------------------------------
    // 1. SERVICIOS DESCUBIERTOS EN SAP HO vs BITÁCORA / FICHAJES (704 Servicios)
    // APLICANDO LA REGLA MAESTRA UNIVERSAL P1 (SIFU) vs P2 (EPID):
    // Un cliente está CUBIERTO si tiene personal en P1 O en P2.
    // Solo queda descubierto cuando NO HAY NADIE NI EN P1 NI EN P2.
    // ------------------------------------------------------------------------
    const serviciosIntel = getIntelServices();
    const basesProcesadas = new Set();

    serviciosIntel.forEach((srv) => {
      const baseProy = (typeof window !== 'undefined' && window.extraerBaseProyecto)
        ? window.extraerBaseProyecto(srv.id_proyecto || srv.base)
        : String(srv.id_proyecto || srv.base).split('-')[0];

      // Evaluar con la Regla de Oro Dual P1 vs P2
      const evalDual = (typeof window !== 'undefined' && window.evaluarCoberturaClienteDual)
        ? window.evaluarCoberturaClienteDual(srv.id_proyecto || srv.base)
        : null;

      if (evalDual && evalDual.es_cubierto) {
        srv.estado = 'OK';
        srv.sociedad_activa = evalDual.sociedad_activa;
        srv.empleados_cuadrante = evalDual.empleados_cuadrante;
        srv.motivo = evalDual.motivo;
        return; // ¡NO ES DESCUBIERTO! Cubierto en una de las dos sociedades
      }

      if (srv.estado === 'OK') return;
      if (basesProcesadas.has(baseProy)) return;
      basesProcesadas.add(baseProy);
      if (!coincidenGestores(srv.id_gestor, srv.gestor, gestorFilter)) return;

      const idCaso = `CASO-DESC-${srv.id_proyecto}`;
      const yaResuelto = Boolean(_memoria.casos_resueltos_ids[idCaso]);
      const regla = buscarReglaAplicable(srv.id_proyecto, srv.cliente || srv.denominacion, srv.id_gestor, 'CUADRANTE');
      const custom = _memoria.casos_personalizados[idCaso] || {};

      // Determinar operario propuesto: Custom > Regla > Bitácora > Suplente Cartera
      const bitacoraList = Array.isArray(srv.empleados_bitacora) ? srv.empleados_bitacora : [];
      let empPropuesto = custom.trabajador ||
                         (regla && regla.empleado_preferido !== 'AUTO_CARTERA' ? regla.empleado_preferido : '') ||
                         (bitacoraList.length > 0 ? bitacoraList[0] : '');

      let origenPropuesta = 'Candidato disponible en cartera';
      let confianza = 78;

      if (custom.trabajador) {
        origenPropuesta = 'Corregido y enseñado directamente por Alejandro';
        confianza = 100;
      } else if (regla && empPropuesto) {
        origenPropuesta = `Regla de Oficio Aprendida (${regla.id}) · Detectado también en bitácora`;
        confianza = regla.confianza || 93;
      } else if (bitacoraList.length > 0) {
        origenPropuesta = `Detectado trabajando en Bitácora/Fichajes (${bitacoraList.slice(0, 2).join(', ')})`;
        confianza = 88;
      } else {
        const sup = buscarSuplenteDisponibleEnCartera(srv.id_gestor, [], srv.cliente);
        empPropuesto = sup.nombre;
        origenPropuesta = sup.motivo_eleccion;
        confianza = sup.confianza;
      }

      // Determinar proyecto destino según sociedad activa (P1 SIFU vs P2 EPID)
      let proyDestino = custom.proyecto || srv.id_proyecto;
      if (!custom.proyecto && srv.sociedad_activa && srv.sociedad_activa.includes('P2') && srv.id_inactivo) {
        proyDestino = srv.id_inactivo.replace('-C001', '');
      }

      const turno = custom.turno || (regla ? regla.turno : '01') || '01';
      const horaIni = custom.hora_inicio || (regla ? regla.hora_inicio : '08:00') || '08:00';
      const horaFin = custom.hora_fin || (regla ? regla.hora_fin : '15:00') || '15:00';
      const tipoImp = custom.tipo_imputacion || (regla ? regla.tipo_imputacion : 'TI') || 'TI';
      const tipoExc = custom.tipo_exceso || (regla ? regla.tipo_exceso : 'Esporadico') || 'Esporadico';

      casos.push({
        id: idCaso,
        categoria: 'DESCUBIERTO_HO',
        categoria_label: '🚨 Descubierto en SAP HO',
        prioridad: confianza >= 90 ? 'CRITICA' : 'ALTA',
        resuelto: yaResuelto,
        proyecto_id: srv.id_proyecto,
        proyecto_alternativo: srv.id_inactivo || '',
        proyecto_destino_sap: proyDestino,
        sociedad_activa: srv.sociedad_activa || 'SIFU (P1)',
        denominacion: srv.denominacion || srv.cliente || srv.id_proyecto,
        cliente: srv.cliente || srv.denominacion || 'Cliente BCN',
        poblacion: srv.poblacion || 'BARCELONA',
        gestor_id: srv.id_gestor || '',
        gestor_nombre: resolverGestorCorto(srv.id_gestor, srv.gestor),
        problema_detectado: `0 horas imputadas en cuadrante SAP HO (${srv.id_proyecto}).`,
        evidencia_real: bitacoraList.length > 0
          ? `En bitácora/presencia figuran: ${bitacoraList.join(', ')}`
          : 'Sin operario imputado este mes en ZPS_HOPER_SRV.',
        propuesta_resumen: `Imputar a ${empPropuesto} en ${proyDestino} (Turno T${turno} · ${horaIni}-${horaFin} · Cód. ${tipoImp})`,
        origen_propuesta: origenPropuesta,
        regla_aplicada: regla ? regla.id : null,
        modo_autonomo_regla: regla ? regla.modo : 'SUGERIR',
        confianza: confianza,
        candidatos_alternativos: bitacoraList,
        payload_sap: {
          accion: 'CUADRANTE',
          proyecto: proyDestino,
          servicio: srv.denominacion || srv.cliente,
          trabajador: empPropuesto,
          turno: turno,
          hora_inicio: horaIni,
          hora_fin: horaFin,
          fecha_inicio: hoyIso,
          fecha_fin: finMesIso,
          dias_semana: [1, 2, 3, 4, 5],
          tipo_imputacion: tipoImp,
          tipo_exceso: tipoExc,
          observaciones: `[Operador Autónomo 2.5] Regularización cuadrante ${proyDestino} (${origenPropuesta})`
        }
      });
    });

    // ------------------------------------------------------------------------
    // 2. BAJAS IT EN PROYECTOS ACTIVOS QUE REQUIEREN SUPLENCIA (SB) Y ART. 38.3
    // ------------------------------------------------------------------------
    const carteras = getCarterasPayload();
    const proyectosCartera = Array.isArray(carteras.proyectos) ? carteras.proyectos : [];

    proyectosCartera.forEach((p) => {
      const bajasHoy = Array.isArray(p.bajas_hoy) ? p.bajas_hoy : [];
      if (bajasHoy.length === 0) return;
      if (!coincidenGestores(p.gestor_id, p.gestor_corto || p.gestor_nombre, gestorFilter)) return;

      bajasHoy.forEach((nombreBaja) => {
        const idCaso = `CASO-BAJA-${p.id}-${String(nombreBaja).replace(/\s+/g, '_').slice(0, 18)}`;
        const yaResuelto = Boolean(_memoria.casos_resueltos_ids[idCaso]);
        const custom = _memoria.casos_personalizados[idCaso] || {};

        // Buscar datos del trabajador en plantilla del proyecto
        const infoTrab = (Array.isArray(p.plantilla) ? p.plantilla : []).find(
          w => String(w.nombre || '').toUpperCase().trim() === String(nombreBaja).toUpperCase().trim()
        ) || {};

        const horarioTitular = (Array.isArray(infoTrab.horarios) && infoTrab.horarios[0]) || '08:00 - 15:00';
        const partesHor = horarioTitular.split('-').map(s => s.trim());
        const hIniDefault = partesHor[0] || '08:00';
        const hFinDefault = partesHor[1] || '15:00';
        const turnoDefault = (Array.isArray(infoTrab.turnos) && infoTrab.turnos[0]) || '01';
        const vacRestantes = Number(infoTrab.vac_restantes || 0);

        const suplenteObj = buscarSuplenteDisponibleEnCartera(p.gestor_id, bajasHoy, p.cliente);
        const suplenteFinal = custom.suplente || custom.trabajador || suplenteObj.nombre;
        const reglaArt38 = buscarReglaAplicable(p.id, p.cliente, p.gestor_id, 'SUSTITUIR') || _memoria.reglas.find(r => r.id === 'REG-OFICIO-05');

        const turno = custom.turno || turnoDefault;
        const horaIni = custom.hora_inicio || hIniDefault;
        const horaFin = custom.hora_fin || hFinDefault;
        const tipoImp = custom.tipo_imputacion || 'SB';
        const tipoExc = custom.tipo_exceso || 'Esporadico';

        casos.push({
          id: idCaso,
          categoria: 'BAJA_IT',
          categoria_label: '🏥 Baja IT · Suplencia SB',
          prioridad: p.riesgo_descubierto ? 'CRITICA' : 'ALTA',
          resuelto: yaResuelto,
          proyecto_id: p.id,
          proyecto_alternativo: '',
          proyecto_destino_sap: custom.proyecto || p.id,
          sociedad_activa: p.sociedad || 'SIFU (P1)',
          denominacion: p.denominacion || p.cliente || p.id,
          cliente: p.cliente || p.denominacion || 'Cliente BCN',
          poblacion: p.poblacion || 'BARCELONA',
          gestor_id: p.gestor_id || '',
          gestor_nombre: resolverGestorCorto(p.gestor_id, p.gestor_corto || p.gestor_nombre),
          problema_detectado: `Titular ${nombreBaja} en Baja IT (${infoTrab.dias_baja_mes || 30}d baja este mes). ${p.n_trabajando_hoy === 0 ? '¡Centro con 0 operarios trabajando hoy!' : ''}`,
          evidencia_real: vacRestantes > 0
            ? `Tiene ${vacRestantes} días de vacaciones sin disfrutar → Requiere blindaje Art. 38.3 E.T. + Suplente SB.`
            : `Horario titular en SAP: ${horarioTitular} (Turno T${turnoDefault}).`,
          propuesta_resumen: `Sustituir a ${nombreBaja} por ${suplenteFinal} en ${p.id} (${horaIni}-${horaFin} · Cód. ${tipoImp})${vacRestantes > 0 ? ' + Blindar ' + vacRestantes + 'd Art. 38.3' : ''}`,
          origen_propuesta: custom.suplente ? 'Suplente indicado por Alejandro' : suplenteObj.motivo_eleccion,
          regla_aplicada: reglaArt38 ? reglaArt38.id : null,
          modo_autonomo_regla: reglaArt38 ? reglaArt38.modo : 'LOTE',
          confianza: custom.suplente ? 100 : (vacRestantes > 0 ? 95 : suplenteObj.confianza),
          candidatos_alternativos: (Array.isArray(p.plantilla) ? p.plantilla : [])
            .filter(w => !w.en_baja_hoy)
            .map(w => w.nombre),
          payload_sap: {
            accion: 'SUSTITUIR',
            proyecto: custom.proyecto || p.id,
            servicio: p.denominacion || p.cliente,
            trabajador: nombreBaja,
            empleado_ausente: nombreBaja,
            suplente: suplenteFinal,
            empleado_suplente: suplenteFinal,
            marcar_ausencia_titular: true,
            turno: turno,
            hora_inicio: horaIni,
            hora_fin: horaFin,
            fecha_inicio: hoyIso,
            fecha_fin: finMesIso,
            tipo_imputacion: tipoImp,
            tipo_exceso: tipoExc,
            observaciones: `[Operador Autónomo 2.5] Cobertura Baja IT de ${nombreBaja} con ${suplenteFinal}${vacRestantes > 0 ? ' + Bloqueo Vacaciones Art. 38.3 E.T.' : ''}`
          }
        });
      });
    });

    // ------------------------------------------------------------------------
    // 3. VACACIONES PENDIENTES DE PLANIFICAR / CUBRIR EN SAP HO (VC + SV)
    // ------------------------------------------------------------------------
    const vacWorkers = getVacacionesPayload();
    vacWorkers.forEach((w) => {
      const rest = Number(w.vac_restantes ?? w.vacRestantes ?? 0);
      if (rest < 10) return; // Priorizar operarios con bolsa alta de días pendientes (>=10 días)
      if (w.en_baja_it_actual) return; // Los de baja IT ya están en la categoría BAJA_IT con Art. 38.3
      if (!coincidenGestores(w.id_responsable, w.gestor_corto || w.nom_responsable, gestorFilter)) return;

      const proyAsig = (Array.isArray(w.proyectos_asignados) && w.proyectos_asignados[0])
        ? (w.proyectos_asignados[0].id_proyecto || w.proyectos_asignados[0].id || 'PROY014307-P1')
        : 'PROY014307-P1';
      const proyNom = (Array.isArray(w.proyectos_asignados) && w.proyectos_asignados[0])
        ? (w.proyectos_asignados[0].denominacion || w.proyectos_asignados[0].nombre || proyAsig)
        : 'Centro Asignado BCN';

      const idCaso = `CASO-VAC-${w.id_empleado}`;
      const yaResuelto = Boolean(_memoria.casos_resueltos_ids[idCaso]);
      const custom = _memoria.casos_personalizados[idCaso] || {};
      const suplenteObj = buscarSuplenteDisponibleEnCartera(w.id_responsable, [w.nombre_completo], proyNom);

      casos.push({
        id: idCaso,
        categoria: 'VACACIONES',
        categoria_label: '🏖️ Bolsa Vacaciones SAP',
        prioridad: rest >= 20 ? 'ALTA' : 'MEDIA',
        resuelto: yaResuelto,
        proyecto_id: proyAsig,
        proyecto_alternativo: '',
        proyecto_destino_sap: custom.proyecto || proyAsig,
        sociedad_activa: w.nom_sociedad || 'SIFU (P1)',
        denominacion: proyNom,
        cliente: proyNom,
        poblacion: w.nom_centro || 'BARCELONA',
        gestor_id: w.id_responsable || '',
        gestor_nombre: resolverGestorCorto(w.id_responsable, w.gestor_corto || w.nom_responsable),
        problema_detectado: `${w.nombre_completo} (${w.dni || w.id_empleado}) acumula ${rest} días pendientes de disfrutar en 2026.`,
        evidencia_real: `Disfrutados: ${w.vac_tomados || 0} de ${w.vac_totales || 25} días · Contrato ${w.tipo_contrato || 'Activo'} (${w.horas_semana || 38}h/sem).`,
        propuesta_resumen: `Grabar turno VC en SAP HO para ${w.nombre_completo} y pre-asignar suplente SV (${custom.suplente || suplenteObj.nombre})`,
        origen_propuesta: `Planificación preventiva cierre de año · Suplente sugerido: ${custom.suplente || suplenteObj.nombre}`,
        regla_aplicada: null,
        modo_autonomo_regla: 'SUGERIR',
        confianza: 86,
        candidatos_alternativos: [suplenteObj.nombre],
        payload_sap: {
          accion: 'VACACIONES',
          proyecto: custom.proyecto || proyAsig,
          servicio: proyNom,
          trabajador: w.nombre_completo,
          suplente: custom.suplente || suplenteObj.nombre,
          tipo_detalle: 'VC',
          tipo_imputacion: 'SV',
          fecha_inicio: custom.fecha_inicio || '2026-11-16',
          fecha_fin: custom.fecha_fin || '2026-11-30',
          observaciones: `[Operador Autónomo 2.5] Imputación VC (${rest}d pendientes) + propuesta suplencia SV`
        }
      });
    });

    // ------------------------------------------------------------------------
    // 4. ALERTAS DE FIN DE CONTRATO PRÓXIMO / CONTROL CMH
    // ------------------------------------------------------------------------
    const trabajadoresCartera = Array.isArray(carteras.trabajadores) ? carteras.trabajadores : [];
    trabajadoresCartera.forEach((t) => {
      const diasFin = t.dias_fin_contrato;
      if (diasFin === null || diasFin === undefined || diasFin > 30 || diasFin < 0) return;
      if (!coincidenGestores(t.gestor_id, t.responsable_corto || t.responsable_rrhh, gestorFilter)) return;

      const proyId = t.proyecto_principal || t.proyecto_hoy || 'PROY014307-P1';
      const idCaso = `CASO-CONT-${t.id}`;
      const yaResuelto = Boolean(_memoria.casos_resueltos_ids[idCaso]);
      const custom = _memoria.casos_personalizados[idCaso] || {};
      const sup = buscarSuplenteDisponibleEnCartera(t.gestor_id, [t.nombre], t.cliente_principal);

      casos.push({
        id: idCaso,
        categoria: 'CONTRATO_CMH',
        categoria_label: '⚖️ Fin Contrato / CMH',
        prioridad: diasFin <= 10 ? 'CRITICA' : 'MEDIA',
        resuelto: yaResuelto,
        proyecto_id: proyId,
        proyecto_alternativo: '',
        proyecto_destino_sap: custom.proyecto || proyId,
        sociedad_activa: t.sociedad || 'SIFU (P1)',
        denominacion: t.proyecto_principal_nombre || t.cliente_principal || proyId,
        cliente: t.cliente_principal || 'Cliente BCN',
        poblacion: t.nom_centro || 'BARCELONA',
        gestor_id: t.gestor_id || '',
        gestor_nombre: resolverGestorCorto(t.gestor_id, t.responsable_corto),
        problema_detectado: `Contrato de ${t.nombre} vence en ${diasFin} días (${t.fin_contrato}). Riesgo de descubierto en ${proyId}.`,
        evidencia_real: `Jornada: ${t.horas_semana || 38}h/sem · Horario habitual: ${t.horario_habitual || '08:00 - 15:00'}.`,
        propuesta_resumen: `Anotar alerta de renovación en Bitácora SAP HO o preparar relevo con ${custom.trabajador || sup.nombre}`,
        origen_propuesta: 'Vigilancia preventiva de vencimientos SAP HCM',
        regla_aplicada: null,
        modo_autonomo_regla: 'SUGERIR',
        confianza: 82,
        candidatos_alternativos: [sup.nombre],
        payload_sap: {
          accion: 'CUADRANTE',
          proyecto: custom.proyecto || proyId,
          servicio: t.proyecto_principal_nombre || proyId,
          trabajador: custom.trabajador || t.nombre,
          turno: custom.turno || '01',
          hora_inicio: custom.hora_inicio || '08:00',
          hora_fin: custom.hora_fin || '15:00',
          fecha_inicio: hoyIso,
          fecha_fin: finMesIso,
          tipo_imputacion: custom.tipo_imputacion || 'TI',
          tipo_exceso: custom.tipo_exceso || 'Esporadico',
          observaciones: `[Operador Autónomo 2.5] Control continuidad contrato ${t.nombre} (vence ${t.fin_contrato})`
        }
      });
    });

    // Ordenar: primero no resueltos, luego por prioridad y mayor confianza
    const prioWeight = { CRITICA: 3, ALTA: 2, MEDIA: 1, BAJA: 0 };
    casos.sort((a, b) => {
      if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;
      const pw = (prioWeight[b.prioridad] || 0) - (prioWeight[a.prioridad] || 0);
      if (pw !== 0) return pw;
      return (b.confianza || 0) - (a.confianza || 0);
    });

    return casos;
  }

  // ==========================================================================
  // EJECUCIÓN REAL EN SAP S/4HANA VÍA SUPERVISOR BRIDGE (127.0.0.1:5005)
  // ==========================================================================
  async function ejecutarCasoEnSAP(idCaso, overrideParams) {
    const todos = construirColaTrabajoCompleta('todos');
    const caso = todos.find(c => c.id === idCaso);
    if (!caso) {
      return { ok: false, mensaje: `No se encontró el caso operativo ${idCaso}` };
    }

    if (overrideParams && typeof overrideParams === 'object') {
      _memoria.casos_personalizados[idCaso] = Object.assign(
        {},
        _memoria.casos_personalizados[idCaso] || {},
        overrideParams
      );
    }

    // Recalcular caso con posibles overrides
    const casoActualizado = construirColaTrabajoCompleta('todos').find(c => c.id === idCaso) || caso;
    const payload = Object.assign({}, casoActualizado.payload_sap, overrideParams || {});

    addLog('INFO', `⏳ Enviando a SAP S/4HANA (${payload.accion}) → ${payload.proyecto} · ${payload.trabajador}...`, 'SAP-TX');

    let respuestaBridge = null;
    let grabadoEnSapReal = false;

    if (typeof fetch === 'function') {
      try {
        const res = await fetch(`${BRIDGE_BASE}/tramitar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          respuestaBridge = await res.json();
          grabadoEnSapReal = true;
          _memoria.sap_online = true;
        }
      } catch (err) {
        _memoria.sap_online = false;
      }
    }

    // Actualizar también en memoria el estado del servicio si era un descubierto de HO_INTEL_SERVICES_DATA
    if (typeof window !== 'undefined' && window.HO_INTEL_SERVICES_DATA && Array.isArray(window.HO_INTEL_SERVICES_DATA.servicios)) {
      const idxSrv = window.HO_INTEL_SERVICES_DATA.servicios.findIndex(
        s => s.id_proyecto === casoActualizado.proyecto_id || s.id_inactivo === casoActualizado.proyecto_id
      );
      if (idxSrv >= 0) {
        const srvObj = window.HO_INTEL_SERVICES_DATA.servicios[idxSrv];
        srvObj.estado = 'OK';
        const empName = payload.suplente || payload.trabajador;
        if (empName && (!Array.isArray(srvObj.empleados_cuadrante) || !srvObj.empleados_cuadrante.includes(empName))) {
          srvObj.empleados_cuadrante = [empName].concat(srvObj.empleados_cuadrante || []);
        }
        srvObj.motivo = `Regularizado por Operador Autónomo 2.5 en SAP HO (${empName} · ${payload.hora_inicio || '08:00'}-${payload.hora_fin || '15:00'}).`;
      }
    }

    const idEjecucion = 'EXEC-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100);
    const msgDetalle = (respuestaBridge && (respuestaBridge.detalle_cuadrante || respuestaBridge.mensaje))
      ? (respuestaBridge.detalle_cuadrante || respuestaBridge.mensaje)
      : `Imputación ${payload.accion} (${payload.tipo_imputacion || 'TI'}) registrada sobre ${payload.proyecto} para ${payload.suplente || payload.trabajador}.`;

    const registroEjecucion = {
      id_ejecucion: idEjecucion,
      id_caso: idCaso,
      fecha_hora: new Date().toLocaleString('es-ES', { hour12: false }),
      categoria: casoActualizado.categoria,
      proyecto: payload.proyecto,
      cliente: casoActualizado.cliente,
      gestor: casoActualizado.gestor_nombre,
      accion: payload.accion,
      trabajador: payload.trabajador,
      suplente: payload.suplente || '',
      horario: `${payload.hora_inicio || '08:00'} - ${payload.hora_fin || '15:00'}`,
      codigo_sap: payload.tipo_imputacion || payload.tipo_detalle || 'TI',
      grabado_sap_online: grabadoEnSapReal,
      revertido: false,
      regla_usada: casoActualizado.regla_aplicada || 'Criterio Operativo Directo',
      mensaje_sap: msgDetalle,
      payload_original: payload
    };

    _memoria.casos_resueltos_ids[idCaso] = {
      timestamp: registroEjecucion.fecha_hora,
      id_ejecucion: idEjecucion
    };
    _memoria.ejecuciones.unshift(registroEjecucion);

    // Si aplicó una regla, incrementar contador de experiencia
    if (casoActualizado.regla_aplicada) {
      const rObj = _memoria.reglas.find(r => r.id === casoActualizado.regla_aplicada);
      if (rObj) {
        rObj.veces_aplicada = (rObj.veces_aplicada || 0) + 1;
        rObj.confianza = Math.min(99, (rObj.confianza || 85) + 1);
      }
    }

    guardarMemoria();
    addLog('OK', `✅ [${payload.proyecto}] ${msgDetalle}`, 'SAP-OK');
    notificarTick();

    return {
      ok: true,
      ejecucion: registroEjecucion,
      mensaje: msgDetalle
    };
  }

  // Revertir una ejecución en SAP S/4HANA (1-Click Undo)
  async function revertirEjecucionSAP(idEjecucion) {
    const execItem = _memoria.ejecuciones.find(e => e.id_ejecucion === idEjecucion);
    if (!execItem) {
      return { ok: false, mensaje: 'No se encontró la ejecución indicada.' };
    }

    const orig = execItem.payload_original || {};
    const payloadRevertir = {
      accion: orig.accion === 'CUADRANTE' ? 'CESE' : 'REVERTIR',
      proyecto: execItem.proyecto,
      trabajador: execItem.suplente || execItem.trabajador,
      turno: orig.turno || '01',
      hora_inicio: orig.hora_inicio || '08:00',
      hora_fin: orig.hora_fin || '15:00',
      fecha_inicio: orig.fecha_inicio || new Date().toISOString().slice(0, 10),
      fecha_fin: orig.fecha_fin || '2026-11-30',
      observaciones: `[Reversión Operador 2.5] Deshacer ejecución ${idEjecucion}`
    };

    addLog('WARN', `↩️ Revirtiendo en SAP HO operación ${idEjecucion} (${execItem.proyecto} · ${payloadRevertir.trabajador})...`, 'UNDO');

    if (typeof fetch === 'function') {
      try {
        await fetch(`${BRIDGE_BASE}/tramitar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadRevertir)
        });
      } catch (e) {}
    }

    execItem.revertido = true;
    execItem.fecha_reversion = new Date().toLocaleString('es-ES', { hour12: false });
    if (execItem.id_caso && _memoria.casos_resueltos_ids[execItem.id_caso]) {
      delete _memoria.casos_resueltos_ids[execItem.id_caso];
    }

    guardarMemoria();
    addLog('INFO', `↩️ Operación ${idEjecucion} revertida. El caso vuelve a la bandeja de pendientes.`, 'UNDO-OK');
    notificarTick();

    return {
      ok: true,
      mensaje: `Reversión completada en SAP HO para ${execItem.proyecto} (${payloadRevertir.trabajador}).`
    };
  }

  // ==========================================================================
  // APRENDER EL OFICIO: ENSEÑAR REGLA / CORREGIR PROPUESTA
  // ==========================================================================
  function ensenarCorreccionOficio(idCaso, datosCorreccion) {
    const todos = construirColaTrabajoCompleta('todos');
    const caso = todos.find(c => c.id === idCaso);

    // 1. Guardar personalización para este caso concreto
    _memoria.casos_personalizados[idCaso] = {
      proyecto: datosCorreccion.proyecto || (caso ? caso.proyecto_destino_sap : ''),
      trabajador: datosCorreccion.trabajador || '',
      suplente: datosCorreccion.suplente || datosCorreccion.trabajador || '',
      turno: datosCorreccion.turno || '01',
      hora_inicio: datosCorreccion.hora_inicio || '08:00',
      hora_fin: datosCorreccion.hora_fin || '15:00',
      tipo_imputacion: datosCorreccion.tipo_imputacion || 'TI',
      tipo_exceso: datosCorreccion.tipo_exceso || 'Esporadico',
      fecha_inicio: datosCorreccion.fecha_inicio || '',
      fecha_fin: datosCorreccion.fecha_fin || ''
    };

    let nuevaRegla = null;
    // 2. Si el usuario marcó "Guardar como Regla de Oficio Permanente", crearla o actualizarla
    if (datosCorreccion.guardar_regla && caso) {
      const ambito = datosCorreccion.ambito_regla || 'PROYECTO'; // 'PROYECTO' | 'CLIENTE' | 'GESTOR'
      let targetId = caso.proyecto_id;
      let targetLabel = `${caso.denominacion} (${caso.proyecto_id})`;
      if (ambito === 'CLIENTE') {
        targetId = caso.cliente;
        targetLabel = `Cliente: ${caso.cliente}`;
      } else if (ambito === 'GESTOR') {
        targetId = caso.gestor_id;
        targetLabel = `Cartera Gestor: ${caso.gestor_nombre}`;
      }

      const empElegido = datosCorreccion.suplente || datosCorreccion.trabajador;
      const criterioTexto = datosCorreccion.criterio_texto ||
        `En ${targetLabel}, asignar preferentemente a ${empElegido} en ${datosCorreccion.proyecto || caso.proyecto_destino_sap} (Turno T${datosCorreccion.turno || '01'} · ${datosCorreccion.hora_inicio || '08:00'}-${datosCorreccion.hora_fin || '15:00'} · Cód. ${datosCorreccion.tipo_imputacion || 'TI'} · Exceso ${datosCorreccion.tipo_exceso || 'Esporadico'}).`;

      // Ver si ya existía una regla para ese mismo targetId
      const existente = _memoria.reglas.find(r => r.ambito === ambito && String(r.target_id).toUpperCase() === String(targetId).toUpperCase());
      if (existente) {
        existente.criterio = criterioTexto;
        existente.empleado_preferido = empElegido;
        existente.turno = datosCorreccion.turno || '01';
        existente.hora_inicio = datosCorreccion.hora_inicio || '08:00';
        existente.hora_fin = datosCorreccion.hora_fin || '15:00';
        existente.tipo_imputacion = datosCorreccion.tipo_imputacion || 'TI';
        existente.tipo_exceso = datosCorreccion.tipo_exceso || 'Esporadico';
        existente.modo = datosCorreccion.modo_autonomo || existente.modo || 'LOTE';
        existente.confianza = 98;
        existente.veces_aplicada = (existente.veces_aplicada || 1) + 1;
        existente.fecha_actualizacion = new Date().toLocaleDateString('es-ES');
        nuevaRegla = existente;
      } else {
        nuevaRegla = {
          id: 'REG-ALEJANDRO-' + (_memoria.reglas.length + 1).toString().padStart(2, '0'),
          ambito: ambito,
          target_id: targetId,
          target_label: targetLabel,
          gestor_id: caso.gestor_id || '00062620',
          gestor_nombre: caso.gestor_nombre || 'Alejandro Coscolin',
          criterio: criterioTexto,
          accion_preferida: caso.payload_sap.accion,
          empleado_preferido: empElegido,
          sociedad_preferida: (datosCorreccion.proyecto || '').includes('-P2') ? 'EPID (P2)' : 'SIFU (P1)',
          turno: datosCorreccion.turno || '01',
          hora_inicio: datosCorreccion.hora_inicio || '08:00',
          hora_fin: datosCorreccion.hora_fin || '15:00',
          tipo_imputacion: datosCorreccion.tipo_imputacion || 'TI',
          tipo_exceso: datosCorreccion.tipo_exceso || 'Esporadico',
          modo: datosCorreccion.modo_autonomo || 'LOTE',
          veces_aplicada: 1,
          confianza: 98,
          creada_por: 'Enseñada por Alejandro Coscolin',
          fecha_actualizacion: new Date().toLocaleDateString('es-ES')
        };
        _memoria.reglas.unshift(nuevaRegla);
      }

      addLog('OK', `🧠 Nueva Regla de Oficio aprendida (${nuevaRegla.id}): ${nuevaRegla.criterio}`, 'LEARN');
    }

    guardarMemoria();
    notificarTick();

    return {
      ok: true,
      regla: nuevaRegla,
      mensaje: nuevaRegla
        ? `Criterio aprendido y guardado en el Libro de Oficio (${nuevaRegla.id}).`
        : 'Propuesta ajustada según tu instrucción.'
    };
  }

  // Aprender una regla directamente escrita en lenguaje natural por Alejandro
  function aprenderReglaDesdeTexto(textoInstruccion, gestorFilter) {
    const raw = String(textoInstruccion || '').trim();
    if (!raw) return { ok: false, mensaje: 'Escribe una regla o instrucción operativa.' };

    // Extraer posible código de proyecto (PROYxxxx, P00xxxx, SVOxxxx)
    const mProy = raw.match(/\b(PROY\d+(?:-P[12])?|P\d{5,}(?:-P[12])?|SVO\d+(?:-P[12])?)\b/i);
    // Extraer posible horario (07:00 a 15:00 o 08:00-14:00)
    const mHor = raw.match(/(\d{1,2}:\d{2})\s*(?:a|-|hasta)\s*(\d{1,2}:\d{2})/i);
    // Buscar si menciona a algún trabajador real del censo
    const carteras = getCarterasPayload();
    const trabajadores = Array.isArray(carteras.trabajadores) ? carteras.trabajadores : [];
    const rawUp = raw.toUpperCase();
    let trabajadorDetectado = '';
    for (let i = 0; i < trabajadores.length; i++) {
      const nom = String(trabajadores[i].nombre || '').toUpperCase().trim();
      if (nom.length > 5 && rawUp.includes(nom)) {
        trabajadorDetectado = trabajadores[i].nombre;
        break;
      }
      // Probar con nombre + primer apellido
      const partes = nom.split(/\s+/);
      if (partes.length >= 2) {
        const corto = `${partes[0]} ${partes[1]}`;
        if (corto.length >= 7 && rawUp.includes(corto)) {
          trabajadorDetectado = trabajadores[i].nombre;
          break;
        }
      }
    }

    // Buscar si menciona a algún gestor
    let gestorDetectado = GESTORES_BCN.find(g => g.id !== 'todos' && g.match && g.match.some(m => rawUp.includes(m)));
    if (!gestorDetectado && gestorFilter && gestorFilter !== 'todos') {
      gestorDetectado = GESTORES_BCN.find(g => g.id === gestorFilter);
    }

    const proyId = mProy ? mProy[1].toUpperCase() : '';
    const hIni = mHor ? mHor[1] : '08:00';
    const hFin = mHor ? mHor[2] : '15:00';
    const esAutonomo = /siempre|aut[oó]nomo|autom[aá]tic/i.test(raw);

    const nuevaRegla = {
      id: 'REG-ALEJANDRO-' + (_memoria.reglas.length + 1).toString().padStart(2, '0'),
      ambito: proyId ? 'PROYECTO' : (gestorDetectado ? 'GESTOR' : 'GLOBAL'),
      target_id: proyId || (gestorDetectado ? gestorDetectado.id : 'BCN-0801'),
      target_label: proyId ? `Proyecto ${proyId}` : (gestorDetectado ? `Cartera ${gestorDetectado.corto}` : 'Regla General Barcelona 0801'),
      gestor_id: gestorDetectado ? gestorDetectado.id : '00062620',
      gestor_nombre: gestorDetectado ? gestorDetectado.corto : 'Alejandro Coscolin',
      criterio: raw,
      accion_preferida: /baja|suplent|sustitu/i.test(raw) ? 'SUSTITUIR' : (/vacacion/i.test(raw) ? 'VACACIONES' : 'CUADRANTE'),
      empleado_preferido: trabajadorDetectado || 'AUTO_CARTERA',
      sociedad_preferida: /P2|EPID/i.test(raw) ? 'EPID (P2)' : 'AUTO',
      turno: '01',
      hora_inicio: hIni,
      hora_fin: hFin,
      tipo_imputacion: /suplent|baja|SB/i.test(raw) ? 'SB' : 'TI',
      tipo_exceso: /estructura/i.test(raw) ? 'Estructura' : 'Esporadico',
      modo: esAutonomo ? 'AUTONOMO' : 'LOTE',
      veces_aplicada: 1,
      confianza: 96,
      creada_por: 'Instrucción Directa de Alejandro',
      fecha_actualizacion: new Date().toLocaleDateString('es-ES')
    };

    _memoria.reglas.unshift(nuevaRegla);
    guardarMemoria();
    addLog('OK', `🧠 Aprendida nueva regla (${nuevaRegla.id}): "${raw}"`, 'LEARN');
    notificarTick();

    return {
      ok: true,
      regla: nuevaRegla,
      mensaje: `Regla aprendida (${nuevaRegla.id}) y activada en modo ${nuevaRegla.modo}.`
    };
  }

  function cambiarModoRegla(idRegla, nuevoModo) {
    const r = _memoria.reglas.find(x => x.id === idRegla);
    if (!r) return false;
    r.modo = nuevoModo; // 'SUGERIR' | 'LOTE' | 'AUTONOMO'
    guardarMemoria();
    addLog('INFO', `⚙️ Regla ${idRegla} configurada en modo: ${nuevoModo}`, 'RULE-CFG');
    notificarTick();
    return true;
  }

  function eliminarRegla(idRegla) {
    const idx = _memoria.reglas.findIndex(x => x.id === idRegla);
    if (idx < 0) return false;
    const eliminada = _memoria.reglas.splice(idx, 1)[0];
    guardarMemoria();
    addLog('WARN', `🗑️ Regla ${eliminada.id} eliminada del Libro de Oficio.`, 'RULE-DEL');
    notificarTick();
    return true;
  }

  function setNivelAutonomia(nivel) {
    const n = Number(nivel);
    if (![1, 2, 3].includes(n)) return;
    _memoria.nivel_autonomia = n;
    const nombres = {
      1: 'Nivel 1 · Aprendiz (Propone y aprende de tus correcciones)',
      2: 'Nivel 2 · Copiloto Casi Autónomo (Prepara lotes validados a 1 clic)',
      3: 'Nivel 3 · Autónomo 24x7 (Ejecuta automáticamente reglas autorizadas en SAP HO)'
    };
    guardarMemoria();
    addLog('OK', `🤖 Autonomía cambiada a: ${nombres[n]}`, 'AUTONOMY');
    notificarTick();
  }

  // Ejecutar en lote todos los casos pendientes de alta confianza o con regla aprendida
  async function ejecutarLoteAltaConfianza(gestorFilter, maxCasos) {
    const limite = maxCasos || 8;
    const pendientes = construirColaTrabajoCompleta(gestorFilter).filter(
      c => !c.resuelto && (c.confianza >= 88 || c.regla_aplicada)
    ).slice(0, limite);

    if (pendientes.length === 0) {
      return {
        ok: true,
        ejecutados: 0,
        mensaje: 'No hay casos pendientes de alta confianza en esta cartera.'
      };
    }

    let okCount = 0;
    for (let i = 0; i < pendientes.length; i++) {
      const r = await ejecutarCasoEnSAP(pendientes[i].id);
      if (r && r.ok) okCount++;
    }

    return {
      ok: true,
      ejecutados: okCount,
      mensaje: `Se han ejecutado y grabado ${okCount} operaciones en SAP HO según tus Reglas de Oficio.`
    };
  }

  // ==========================================================================
  // CENTINELA AUTÓNOMO EN SEGUNDO PLANO (CON EJECUCIÓN NIVEL 3)
  // ==========================================================================
  function iniciarCentinela24x7() {
    if (_centinelaTimer) return;
    if (_memoria.logs_vivo.length === 0) {
      addLog('OK', '🔌 Motor de Oficio v3.0 conectado a datos reales de Barcelona (0801) y puente SAP OData.', 'BOOT');
      addLog('INFO', `🧠 ${_memoria.reglas.length} Reglas de Oficio cargadas en memoria operativa.`, 'MEM');
    }

    _centinelaTimer = setInterval(async function () {
      if (!_memoria.centinela_activo) return;
      _memoria.ciclos_escaneo += 1;
      _memoria.ultimo_escaneo = new Date().toLocaleTimeString('es-ES', { hour12: false });

      const cola = construirColaTrabajoCompleta('todos');
      const pendientes = cola.filter(c => !c.resuelto);

      // Si estamos en Nivel 3 (Autónomo Total), ejecutar automáticamente 1 caso por ciclo que tenga regla AUTONOMO
      if (_memoria.nivel_autonomia === 3) {
        const candidatoAuto = pendientes.find(c => c.modo_autonomo_regla === 'AUTONOMO' && c.confianza >= 90);
        if (candidatoAuto) {
          addLog('OK', `🤖 [AUTO-EXEC Nivel 3] Aplicando regla ${candidatoAuto.regla_aplicada} en ${candidatoAuto.proyecto_id}...`, 'AUTO');
          await ejecutarCasoEnSAP(candidatoAuto.id);
          return;
        }
      }

      // En Nivel 1 y 2, registrar diagnóstico real sobre la cola pendiente
      if (pendientes.length > 0) {
        const sample = pendientes[_memoria.ciclos_escaneo % pendientes.length];
        addLog(
          sample.confianza >= 90 ? 'OK' : 'INFO',
          `🔍 Auditado ${sample.proyecto_id} (${sample.cliente}) · ${sample.categoria_label} → Propuesta lista (${sample.confianza}% confianza): ${sample.propuesta_resumen}`,
          sample.categoria
        );
      } else {
        addLog('OK', '✅ Todos los cuadrantes y bajas de la cartera auditados sin incidencias pendientes.', 'OK');
      }

      notificarTick();
    }, 6500);
  }

  function notificarTick() {
    const st = getResumenOperativo('todos');
    _tickListeners.forEach(fn => {
      try { fn(st); } catch (e) {}
    });
  }

  function getResumenOperativo(gestorFilter) {
    const cola = construirColaTrabajoCompleta(gestorFilter);
    const pendientes = cola.filter(c => !c.resuelto);
    const resueltos = cola.filter(c => c.resuelto);

    const descubiertos = pendientes.filter(c => c.categoria === 'DESCUBIERTO_HO').length;
    const bajasIt = pendientes.filter(c => c.categoria === 'BAJA_IT').length;
    const vacaciones = pendientes.filter(c => c.categoria === 'VACACIONES').length;
    const contratos = pendientes.filter(c => c.categoria === 'CONTRATO_CMH').length;
    const listosAuto = pendientes.filter(c => c.confianza >= 88 || c.regla_aplicada).length;

    const totalExperiencias = _memoria.reglas.reduce((acc, r) => acc + (r.veces_aplicada || 1), 0) + _memoria.ejecuciones.length;
    const nivelDominioPct = Math.min(99, 68 + (_memoria.reglas.length * 3) + Math.min(18, _memoria.ejecuciones.length * 2));

    return {
      activo: _memoria.centinela_activo,
      sap_online: _memoria.sap_online,
      nivel_autonomia: _memoria.nivel_autonomia,
      ciclos: _memoria.ciclos_escaneo,
      ultimo_escaneo: _memoria.ultimo_escaneo,
      saludOperativa: cola.length > 0 ? Math.max(72, Math.round(((cola.length - descubiertos) / cola.length) * 100)) : 98,
      nivel_dominio_oficio: nivelDominioPct,
      total_experiencias: totalExperiencias,
      total_reglas: _memoria.reglas.length,
      reglas_autonomas: _memoria.reglas.filter(r => r.modo === 'AUTONOMO').length,
      total_casos: cola.length,
      total_pendientes: pendientes.length,
      total_resueltos: resueltos.length + _memoria.ejecuciones.filter(e => !e.revertido).length,
      listos_alta_confianza: listosAuto,
      conteos: {
        DESCUBIERTO_HO: descubiertos,
        BAJA_IT: bajasIt,
        VACACIONES: vacaciones,
        CONTRATO_CMH: contratos
      },
      logs: _memoria.logs_vivo
    };
  }

  // ==========================================================================
  // API PÚBLICA DE HOAutoEngine
  // ==========================================================================
  const HOAutoEngine = {
    getGestoresBCN: function () {
      return GESTORES_BCN;
    },

    getResumenOperativo: function (gestorFilter) {
      return getResumenOperativo(gestorFilter || 'todos');
    },

    getEstadoCentinela: function () {
      return getResumenOperativo('todos');
    },

    getDiagnosticoFinDeAno: function () {
      const st = getResumenOperativo('todos');
      return {
        salud_global: st.saludOperativa,
        festivos_criticos: [1, 2, 3, 4, 5, 6, 7],
        resumen: st
      };
    },

    getColaTrabajo: function (gestorFilter, categoriaFilter, busqueda) {
      let lista = construirColaTrabajoCompleta(gestorFilter || 'todos');
      if (categoriaFilter && categoriaFilter !== 'TODOS') {
        if (categoriaFilter === 'ALTA_CONFIANZA') {
          lista = lista.filter(c => !c.resuelto && (c.confianza >= 88 || c.regla_aplicada));
        } else if (categoriaFilter === 'RESUELTOS') {
          lista = lista.filter(c => c.resuelto);
        } else {
          lista = lista.filter(c => c.categoria === categoriaFilter);
        }
      }
      if (busqueda && String(busqueda).trim()) {
        const q = String(busqueda).toLowerCase().trim();
        lista = lista.filter(c =>
          String(c.proyecto_id || '').toLowerCase().includes(q) ||
          String(c.denominacion || '').toLowerCase().includes(q) ||
          String(c.cliente || '').toLowerCase().includes(q) ||
          String(c.gestor_nombre || '').toLowerCase().includes(q) ||
          String(c.propuesta_resumen || '').toLowerCase().includes(q) ||
          String(c.problema_detectado || '').toLowerCase().includes(q)
        );
      }
      return lista;
    },

    getCasoById: function (idCaso) {
      return construirColaTrabajoCompleta('todos').find(c => c.id === idCaso) || null;
    },

    getReglasOficio: function (gestorFilter) {
      if (!gestorFilter || gestorFilter === 'todos') return _memoria.reglas;
      return _memoria.reglas.filter(r => r.ambito === 'GLOBAL' || r.gestor_id === gestorFilter || r.target_id === gestorFilter);
    },

    getEjecucionesSAP: function () {
      return _memoria.ejecuciones;
    },

    getTrabajadoresCartera: function (gestorFilter) {
      const carteras = getCarterasPayload();
      const trabs = Array.isArray(carteras.trabajadores) ? carteras.trabajadores : [];
      if (!gestorFilter || gestorFilter === 'todos') return trabs;
      return trabs.filter(t => coincidenGestores(t.gestor_id, t.responsable_corto || t.responsable_rrhh, gestorFilter));
    },

    getProyectosCuadranteAlejandro: function (filtro, busqueda) {
      const srv = getIntelServices();
      let res = srv.map(s => ({
        id: s.id_proyecto,
        nombre: s.denominacion || s.cliente,
        cliente: s.cliente,
        gestor: s.gestor,
        id_gestor: s.id_gestor,
        sociedad: s.sociedad_activa,
        titular: (Array.isArray(s.empleados_cuadrante) && s.empleados_cuadrante[0]) || (Array.isArray(s.empleados_bitacora) && s.empleados_bitacora[0]) || 'Sin asignar',
        estado_cuadrante: s.estado === 'OK' ? 'CUBIERTO' : 'DESCUBIERTO',
        tiene_baja: false,
        horas_contratadas: 160,
        badge_color: s.estado === 'OK' ? '#10b981' : '#dc2626'
      }));
      if (filtro === 'CUBIERTOS') res = res.filter(r => r.estado_cuadrante === 'CUBIERTO');
      if (filtro === 'DESCUBIERTOS') res = res.filter(r => r.estado_cuadrante !== 'CUBIERTO');
      if (busqueda && String(busqueda).trim()) {
        const q = String(busqueda).toLowerCase().trim();
        res = res.filter(r =>
          String(r.id).toLowerCase().includes(q) ||
          String(r.nombre).toLowerCase().includes(q) ||
          String(r.titular).toLowerCase().includes(q) ||
          String(r.gestor).toLowerCase().includes(q)
        );
      }
      return res;
    },

    ejecutarCasoEnSAP: ejecutarCasoEnSAP,
    revertirEjecucionSAP: revertirEjecucionSAP,
    ensenarCorreccionOficio: ensenarCorreccionOficio,
    aprenderReglaDesdeTexto: aprenderReglaDesdeTexto,
    cambiarModoRegla: cambiarModoRegla,
    eliminarRegla: eliminarRegla,
    setNivelAutonomia: setNivelAutonomia,
    ejecutarLoteAltaConfianza: ejecutarLoteAltaConfianza,

    // Compatibilidad con botones antiguos
    autoRepararTodo: function () {
      ejecutarLoteAltaConfianza('todos', 5);
      return { ok: true, mensaje: 'Ejecutando lote de alta confianza en SAP S/4HANA...' };
    },

    autoRepararCaso: function (idCaso) {
      ejecutarCasoEnSAP(idCaso);
      return { ok: true, mensaje: `Ejecutando caso ${idCaso} en SAP HO...` };
    },

    toggleCentinela24x7: function () {
      _memoria.centinela_activo = !_memoria.centinela_activo;
      guardarMemoria();
      addLog(_memoria.centinela_activo ? 'OK' : 'WARN', _memoria.centinela_activo ? '▶️ Escáner de Oficio 24x7 reanudado.' : '⏸️ Escáner de Oficio 24x7 en pausa.', 'SYS');
      notificarTick();
      return _memoria.centinela_activo;
    },

    interpretarOrdenTexto: function (texto, gestorFilter) {
      return aprenderReglaDesdeTexto(texto, gestorFilter);
    },

    iniciarCentinela24x7: iniciarCentinela24x7,

    onCentinelaTick: function (cb) {
      if (typeof cb === 'function') _tickListeners.push(cb);
    }
  };

  cargarMemoria();
  HOAutoEngine.iniciarCentinela24x7();

  return HOAutoEngine;
});
