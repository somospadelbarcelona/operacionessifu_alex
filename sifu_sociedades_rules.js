/**
 * ============================================================================
 * SIFU BARCELONA — REGLA MAESTRA UNIVERSAL DE SOCIEDADES: P1 (SIFU) vs P2 (EPID)
 * ============================================================================
 * PRINCIPIO OPERATIVO DE COBERTURA DUAL DE CLIENTE:
 * 1. Cada cliente/centro puede tener dos proyectos en SAP S/4HANA:
 *      - [BASE]-P1 : Sociedad SIFU (SIFU, S.L.)
 *      - [BASE]-P2 : Sociedad EPID (EPID, S.L.)
 * 
 * 2. Un cliente está 100% CUBIERTO si tiene personal imputado en P1 O en P2.
 *    - Si el trabajador es de SIFU, estará en P1 y P2 estará a 0 horas (CORRECTO).
 *    - Si el trabajador es de EPID, estará en P2 y P1 estará a 0 horas (CORRECTO).
 * 
 * 3. SOLO QUEDA DESCUBIERTO cuando NO HAY NADIE NI EN P1 NI EN P2 simultáneamente.
 * ============================================================================
 */

(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== 'undefined' && root) {
    root.SifuSociedadesRules = mod;
    root.evaluarCoberturaClienteDual = mod.evaluarCoberturaClienteDual;
    root.extraerBaseProyecto = mod.extraerBaseProyecto;
    root.esProyectoP1 = mod.esProyectoP1;
    root.esProyectoP2 = mod.esProyectoP2;
    root.getGemelosSociedad = mod.getGemelosSociedad;
  }
  if (typeof window !== 'undefined') {
    window.SifuSociedadesRules = mod;
    window.evaluarCoberturaClienteDual = mod.evaluarCoberturaClienteDual;
    window.extraerBaseProyecto = mod.extraerBaseProyecto;
    window.esProyectoP1 = mod.esProyectoP1;
    window.esProyectoP2 = mod.esProyectoP2;
    window.getGemelosSociedad = mod.getGemelosSociedad;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  /**
   * Extrae el código base sin el sufijo de sociedad (-P1 o -P2 y variantes)
   * Ej: 'PROY012920-P1' -> 'PROY012920'
   *     'PROY012920-P2-C001' -> 'PROY012920'
   *     'SVO07391-P1-C018' -> 'SVO07391'
   */
  function extraerBaseProyecto(proyId) {
    if (!proyId) return '';
    var clean = String(proyId).trim().toUpperCase();
    var idx = clean.indexOf('-P');
    if (idx > 0) {
      return clean.substring(0, idx);
    }
    return clean.split('-')[0].split('_')[0];
  }

  function esProyectoP1(proyId) {
    if (!proyId) return false;
    var clean = String(proyId).toUpperCase();
    return clean.includes('-P1') || clean.includes('/P1');
  }

  function esProyectoP2(proyId) {
    if (!proyId) return false;
    var clean = String(proyId).toUpperCase();
    return clean.includes('-P2') || clean.includes('/P2');
  }

  function getGemelosSociedad(proyId) {
    var base = extraerBaseProyecto(proyId);
    return {
      base: base,
      p1: base + '-P1',
      p2: base + '-P2',
      p2_inactivo: base + '-P2-C001'
    };
  }

  /**
   * Evalúa si un cliente / proyecto está cubierto considerando la regla dual P1 (SIFU) vs P2 (EPID).
   * Retorna un objeto con el estado consolidado, sin falsos descubiertos.
   */
  function evaluarCoberturaClienteDual(identificadorProyectoOCliente) {
    if (!identificadorProyectoOCliente) {
      return {
        estado: 'DESCUBIERTO_REAL',
        es_cubierto: false,
        sociedad_activa: 'NINGUNA',
        empleados_p1: [],
        empleados_p2: [],
        empleados_totales: [],
        motivo: 'Identificador no proporcionado'
      };
    }

    var base = extraerBaseProyecto(identificadorProyectoOCliente);
    var cleanId = String(identificadorProyectoOCliente).trim().toUpperCase();

    var empsP1 = [];
    var empsP2 = [];
    var horasP1 = 0;
    var horasP2 = 0;
    var denominacion = '';
    var cliente = '';
    var gestor = '';
    var idGestor = '';

    // 1. Consultar dataset consolidado de servicios inteligentes
    if (typeof window !== 'undefined' && window.HO_INTEL_SERVICES_DATA && Array.isArray(window.HO_INTEL_SERVICES_DATA.servicios)) {
      var srvList = window.HO_INTEL_SERVICES_DATA.servicios;
      for (var i = 0; i < srvList.length; i++) {
        var s = srvList[i];
        var sBase = s.base || extraerBaseProyecto(s.id_proyecto);
        if (sBase === base || s.id_proyecto === cleanId || s.id_inactivo === cleanId) {
          denominacion = s.denominacion || denominacion;
          cliente = s.cliente || cliente;
          gestor = s.gestor || gestor;
          idGestor = s.id_gestor || idGestor;

          var activos = Array.isArray(s.empleados_cuadrante) ? s.empleados_cuadrante : [];
          if (s.sociedad_activa && s.sociedad_activa.includes('P2')) {
            empsP2 = empsP2.concat(activos);
          } else if (s.sociedad_activa && s.sociedad_activa.includes('P1')) {
            empsP1 = empsP1.concat(activos);
          } else {
            if (esProyectoP2(s.id_proyecto)) {
              empsP2 = empsP2.concat(activos);
            } else {
              empsP1 = empsP1.concat(activos);
            }
          }
        }
      }
    }

    // 2. Consultar dataset de carteras en tiempo real (proyectos y plantilla)
    if (typeof window !== 'undefined' && window.HO_CARTERAS_PAYLOAD && Array.isArray(window.HO_CARTERAS_PAYLOAD.proyectos)) {
      var proys = window.HO_CARTERAS_PAYLOAD.proyectos;
      for (var j = 0; j < proys.length; j++) {
        var p = proys[j];
        var pBase = extraerBaseProyecto(p.id);
        if (pBase === base) {
          denominacion = denominacion || p.denominacion || p.cliente;
          cliente = cliente || p.cliente;
          gestor = gestor || p.gestor_corto || p.gestor_nombre;
          idGestor = idGestor || p.gestor_id;

          var plantillaActiva = (Array.isArray(p.plantilla) ? p.plantilla : []).filter(function (w) {
            return !w.en_baja_hoy && (w.dias_trabajados_mes > 0 || w.estado_hoy !== 'Baja');
          }).map(function (w) { return w.nombre; });

          if (esProyectoP2(p.id)) {
            empsP2 = empsP2.concat(plantillaActiva);
            horasP2 += (p.horas_contratadas || 0);
          } else {
            empsP1 = empsP1.concat(plantillaActiva);
            horasP1 += (p.horas_contratadas || 0);
          }
        }
      }
    }

    // Normalizar listas únicas
    empsP1 = Array.from(new Set(empsP1.filter(Boolean)));
    empsP2 = Array.from(new Set(empsP2.filter(Boolean)));

    var tieneP1 = empsP1.length > 0;
    var tieneP2 = empsP2.length > 0;

    // Regla de Oro:
    // P1 tiene gente -> Cubierto en SIFU. P2 a 0 es normal.
    // P2 tiene gente -> Cubierto en EPID. P1 a 0 es normal.
    // Solo descubierto si P1 == 0 Y P2 == 0.
    if (tieneP1 && !tieneP2) {
      return {
        base: base,
        estado: 'OK',
        es_cubierto: true,
        sociedad_activa: 'SIFU (P1)',
        proyecto_activo: base + '-P1',
        proyecto_vacio: base + '-P2',
        empleados_cuadrante: empsP1,
        empleados_p1: empsP1,
        empleados_p2: [],
        empleados_totales: empsP1,
        cliente: cliente || denominacion || base,
        denominacion: denominacion || cliente || base,
        gestor: gestor,
        id_gestor: idGestor,
        motivo: 'Cuadrante cubierto en SAP HO vía SIFU (P1) (' + empsP1.join(', ') + '). El proyecto gemelo EPID (P2) está sin imputación, lo cual es NORMAL Y CORRECTO (personal SIFU).'
      };
    } else if (tieneP2 && !tieneP1) {
      return {
        base: base,
        estado: 'OK',
        es_cubierto: true,
        sociedad_activa: 'EPID (P2)',
        proyecto_activo: base + '-P2',
        proyecto_vacio: base + '-P1',
        empleados_cuadrante: empsP2,
        empleados_p1: [],
        empleados_p2: empsP2,
        empleados_totales: empsP2,
        cliente: cliente || denominacion || base,
        denominacion: denominacion || cliente || base,
        gestor: gestor,
        id_gestor: idGestor,
        motivo: 'Cuadrante cubierto en SAP HO vía EPID (P2) (' + empsP2.join(', ') + '). El proyecto gemelo SIFU (P1) está sin imputación, lo cual es NORMAL Y CORRECTO (personal EPID).'
      };
    } else if (tieneP1 && tieneP2) {
      return {
        base: base,
        estado: 'OK',
        es_cubierto: true,
        sociedad_activa: 'MIXTA (P1 + P2)',
        proyecto_activo: base + '-P1 / ' + base + '-P2',
        proyecto_vacio: null,
        empleados_cuadrante: empsP1.concat(empsP2),
        empleados_p1: empsP1,
        empleados_p2: empsP2,
        empleados_totales: empsP1.concat(empsP2),
        cliente: cliente || denominacion || base,
        denominacion: denominacion || cliente || base,
        gestor: gestor,
        id_gestor: idGestor,
        motivo: 'Cuadrante cubierto simultáneamente vía SIFU (P1) [' + empsP1.join(', ') + '] y EPID (P2) [' + empsP2.join(', ') + '].'
      };
    } else {
      return {
        base: base,
        estado: 'DESCUBIERTO_REAL',
        es_cubierto: false,
        sociedad_activa: 'NINGUNA',
        proyecto_activo: null,
        proyecto_vacio: base + '-P1 y ' + base + '-P2',
        empleados_cuadrante: [],
        empleados_p1: [],
        empleados_p2: [],
        empleados_totales: [],
        cliente: cliente || denominacion || base,
        denominacion: denominacion || cliente || base,
        gestor: gestor,
        id_gestor: idGestor,
        motivo: 'DESCUBIERTO REAL: No hay trabajadores imputados ni en ' + base + '-P1 (SIFU) ni en ' + base + '-P2 (EPID).'
      };
    }
  }

  return {
    extraerBaseProyecto: extraerBaseProyecto,
    esProyectoP1: esProyectoP1,
    esProyectoP2: esProyectoP2,
    getGemelosSociedad: getGemelosSociedad,
    evaluarCoberturaClienteDual: evaluarCoberturaClienteDual
  };
});
