/**
 * ============================================================================
 * SIFU BARCELONA OPERACIONES PRO — 5. ESTUDIO ECONÓMICO Y HOJA DE ESCANDALLO (v2.0)
 * Plantilla Oficial de Escandallo de Servicios con Estilo Excel Clásico,
 * Sincronizado en Tiempo Real con la Cartera de Clientes y Centros de Barcelona (0801)
 * Centros gestionados por ALEJANDRO COSCOLIN PEREGRIN (SAP S/4HANA HO + Master +
 * CMH + Fichajes gcalidad).
 *
 * Incluye:
 * - Sincronización en Tiempo Real de los 21 Clientes Corporativos Reales y los
 *   58 Proyectos/Centros SAP (SVO / PROY) de Alejandro Coscolin.
 * - Modo Pantalla Completa inmersivo tipo Excel + Hoja Escandallo Oficial SIFU.
 * - Wizard de 5 pasos + Panel Lateral Fijo de Resultados en Tiempo Real.
 * - Cruce en vivo de trabajadores titulares, suplentes, Bajas IT activas,
 *   Sociedad (SIFU, S.L. 33,5% SS vs EPID CEE Bonificado 11,5% SS), DNI, ID SAP,
 *   antigüedad real y bolsa de horas CMH.
 * - Simulador Económico "¿Qué ocurriría si...?", Punto de Equilibrio (Break-Even),
 *   EBITDA, Dictamen Técnico-Económico, Comparador y Exportación PDF / Excel (.xlsx).
 * ============================================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY_OVERRIDES = 'sifu_bcn_estudios_overrides_coscolin_v2';
  const STORAGE_KEY_CUSTOM = 'sifu_bcn_estudios_custom_list_v2';
  const RESPONSABLE_OFICIAL = 'COSCOLIN PEREGRIN, ALEJANDRO';

  // ============================================================================
  // CATÁLOGO CORPORATIVO DE CLIENTES REALES DE ALEJANDRO COSCOLIN PEREGRIN
  // ============================================================================
  const CLIENT_PORTFOLIO_RULES = [
    {
      clientKey: 'cli_indra_bcn',
      codigo: 'ESC-BCN-001',
      nombreCorporativo: 'INDRA SISTEMAS, S.A. (ROC BORONAT 22@)',
      servicioGlobal: 'Limpieza Integral y Servicios Técnicos Sede Corporativa 22@ Barcelona',
      comarca: 'Carrer Roc Boronat, 133 · Barcelona (Barcelonès)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 21.50,
      duracionMeses: 36,
      fechaInicio: '2025-01-01',
      match: (r) => {
        const srv = (r['SERVICIO'] || '').toUpperCase();
        return srv.includes('INDRA') || srv.includes('ROC BORONAT') || srv.includes('BORONAT');
      }
    },
    {
      clientKey: 'cli_vueling_bcn',
      codigo: 'ESC-BCN-002',
      nombreCorporativo: 'VUELING AIRLINES, S.A.',
      servicioGlobal: 'Limpieza Corporativa Headquarter Viladecans / El Prat y Sedes Aeroportuarias',
      comarca: 'El Prat de Llobregat (Baix Llobregat)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.80,
      duracionMeses: 24,
      fechaInicio: '2025-06-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('VUELING')
    },
    {
      clientKey: 'cli_nutraresearch_bcn',
      codigo: 'ESC-BCN-003',
      nombreCorporativo: 'NUTRARESEARCH 2011, S.L.',
      servicioGlobal: 'Manipulados Final de Línea y Limpieza Técnica Salas Blancas',
      comarca: 'Sant Joan Despí (Baix Llobregat)',
      tipoContrato: 'Mixto Limpieza + Manipulados',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.85,
      duracionMeses: 24,
      fechaInicio: '2025-03-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('NUTRARESEARCH')
    },
    {
      clientKey: 'cli_cetaqua_bcn',
      codigo: 'ESC-BCN-004',
      nombreCorporativo: 'CETAQUA - CENTRE TECNOLÒGIC DE L\'AIGUA',
      servicioGlobal: 'Limpieza Técnica de Laboratorios e Instalaciones Científicas',
      comarca: 'Cornellà de Llobregat (Baix Llobregat)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.25,
      duracionMeses: 24,
      fechaInicio: '2025-09-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('CETAQUA')
    },
    {
      clientKey: 'cli_parcade_bcn',
      codigo: 'ESC-BCN-005',
      nombreCorporativo: 'PARCADE, S.A.',
      servicioGlobal: 'Mantenimiento, Limpieza y Servicios Auxiliares Red de Aparcamientos',
      comarca: 'Barcelona Centro (Barcelonès)',
      tipoContrato: 'Auxiliares',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.40,
      duracionMeses: 24,
      fechaInicio: '2025-05-15',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('PARCADE')
    },
    {
      clientKey: 'cli_cimalsa_zal',
      codigo: 'ESC-BCN-006',
      nombreCorporativo: 'CENTRALS I INFRAESTRUCTURES PER A LA MOBILITAT (CIMALSA)',
      servicioGlobal: 'Limpieza Integral y Mantenimiento ZAL Port de Barcelona',
      comarca: 'ZAL Port · Barcelona / Prat (Barcelonès)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.10,
      duracionMeses: 36,
      fechaInicio: '2025-06-16',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('CENTRALS I INFRAESTRUCTURES') || (r['SERVICIO'] || '').toUpperCase().includes('CIMALSA')
    },
    {
      clientKey: 'cli_generalitat_sedes',
      codigo: 'ESC-BCN-007',
      nombreCorporativo: 'GENERALITAT DE CATALUNYA (DEPARTAMENTS & JUSTÍCIA)',
      servicioGlobal: 'Servicios Auxiliares, Conserjería y Limpieza Sedes Barcelona',
      comarca: 'Barcelona y Áreas Metropolitanas (0801)',
      tipoContrato: 'Mixto Auxiliares + Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.50,
      duracionMeses: 24,
      fechaInicio: '2026-01-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('GENERALITAT')
    },
    {
      clientKey: 'cli_ayucasa_bcn',
      codigo: 'ESC-BCN-008',
      nombreCorporativo: 'AYUCASA / BRÓCOLI FACILITY SERVICES',
      servicioGlobal: 'Limpieza Corporativa y Servicios Operativos Red Barcelona',
      comarca: 'Barcelona y Vallès (0801)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.60,
      duracionMeses: 12,
      fechaInicio: '2025-08-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('AYUCASA') || (r['SERVICIO'] || '').toUpperCase().includes('BROCOLI')
    },
    {
      clientKey: 'cli_im3_bcn',
      codigo: 'ESC-BCN-009',
      nombreCorporativo: 'INGENIEROS EMETRES, S.L. (IM3 BARCELONA)',
      servicioGlobal: 'Limpieza Oficinas Centrales de Ingeniería IM3 Barcelona',
      comarca: 'Sede Ingeniería (Barcelonès)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.40,
      duracionMeses: 12,
      fechaInicio: '2025-04-08',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('INGENIEROS EMETRES') || (r['SERVICIO'] || '').toUpperCase().includes('IM3')
    },
    {
      clientKey: 'cli_concentrix_bcn',
      codigo: 'ESC-BCN-010',
      nombreCorporativo: 'CONCENTRIX SPAIN BUSINESS PROCESS, S.L.',
      servicioGlobal: 'Servicios Auxiliares de Recepción y Control de Accesos Barcelona',
      comarca: 'Barcelona Centro (Barcelonès)',
      tipoContrato: 'Auxiliares',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.90,
      duracionMeses: 24,
      fechaInicio: '2025-07-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('CONCENTRIX')
    },
    {
      clientKey: 'cli_agbar_bcn',
      codigo: 'ESC-BCN-011',
      nombreCorporativo: 'SOCIEDAD GENERAL DE AGUAS DE BARCELONA (AGBAR)',
      servicioGlobal: 'Limpieza Técnica y Mantenimiento Sedes Operativas Aigües de Barcelona',
      comarca: 'Barcelona Metropolitana (Barcelonès)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.30,
      duracionMeses: 24,
      fechaInicio: '2025-05-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('AGUAS DE BARCELONA') || (r['SERVICIO'] || '').toUpperCase().includes('AGBAR')
    },
    {
      clientKey: 'cli_veolia_bcn',
      codigo: 'ESC-BCN-012',
      nombreCorporativo: 'VEOLIA SERVEIS CATALUNYA, S.A.U.',
      servicioGlobal: 'Limpieza Industrial y Mantenimiento Técnico Sedes Barcelona',
      comarca: 'Barcelona y Vallès (0801)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.50,
      duracionMeses: 24,
      fechaInicio: '2025-05-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('VEOLIA')
    },
    {
      clientKey: 'cli_electro_stocks',
      codigo: 'ESC-BCN-017',
      nombreCorporativo: 'GRUPO ELECTRO STOCKS, S.L. (GES)',
      servicioGlobal: 'Servicio Limpieza Delegación P.I. Clos de les Fires',
      comarca: 'Plaça Europa, 6 · P.I. Clos de les Fires (Catalunya)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 19.60,
      duracionMeses: 12,
      fechaInicio: '2025-03-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('ELECTRO STOCKS')
    },
    {
      clientKey: 'cli_plaskolite_iberica',
      codigo: 'ESC-BCN-018',
      nombreCorporativo: 'PLASKOLITE IBÉRICA, S.A.U.',
      servicioGlobal: 'Brigada Especialista Cristalero en Planta Industrial',
      comarca: 'C/ Arbó, 13-15 (Catalunya)',
      tipoContrato: 'Especialistas / Cristales',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 23.80,
      duracionMeses: 12,
      fechaInicio: '2025-05-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('PLASKOLITE')
    },
    {
      clientKey: 'cli_oca_inspeccion',
      codigo: 'ESC-BCN-019',
      nombreCorporativo: 'OCA INSPECCIÓN, CONTROL Y PREVENCIÓN, S.A.U.',
      servicioGlobal: 'Limpieza Oficinas Técnicas Delegación OCA Barcelona',
      comarca: '0801 Barcelona (Barcelonès)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 20.50,
      duracionMeses: 12,
      fechaInicio: '2025-04-08',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('OCA INSPECCI')
    },
    {
      clientKey: 'cli_solitium_control',
      codigo: 'ESC-BCN-020',
      nombreCorporativo: 'SOLITIUM CONTROL GROUP, S.A.',
      servicioGlobal: 'Limpieza Oficinas Corporativas Control Group Barcelona',
      comarca: 'Sede Corporativa (Barcelonès / Catalunya)',
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      precioHoraContrato: 21.00,
      duracionMeses: 12,
      fechaInicio: '2025-04-08',
      match: (r) => (r['SERVICIO'] || '').toUpperCase().includes('SOLITIUM')
    },
    {
      clientKey: 'cli_sifu_estructura_pgo',
      codigo: 'ESC-BCN-021',
      nombreCorporativo: 'SIFU, S.L. (DELEGACIÓN BARCELONA 0801 · PGO & PIE INTERNO)',
      servicioGlobal: 'Bolsa Operativa PGO Auxiliares / Limpieza y Limpieza Delegación Barcelona',
      comarca: 'Barcelona (Centro Coste Interno 0801)',
      tipoContrato: 'Estructura / Bolsa PGO',
      tipoFacturacion: 'Centro Coste / Imputación Interna',
      precioHoraContrato: 18.20,
      duracionMeses: 12,
      fechaInicio: '2026-01-01',
      match: (r) => (r['SERVICIO'] || '').toUpperCase() === 'SIFU S.L.'
    }
  ];

  // ============================================================================
  // RESOLUCIÓN CRUZADA EN TIEMPO REAL: MASTER DATA + SAP HO + CMH + FICHAJES
  // ============================================================================
  function normalizePersonName(name) {
    if (!name) return '';
    return String(name)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findEmployeeInHOMap(rawName) {
    if (!rawName || !window.HO_EMPLOYEES_MAP) return null;
    const target = normalizePersonName(rawName);
    if (!target) return null;
    const targetTokens = target.split(' ').filter(t => t.length >= 3);

    const allEmps = Object.values(window.HO_EMPLOYEES_MAP);
    for (const emp of allEmps) {
      const n = normalizePersonName(emp.nombre_completo || '');
      if (n === target) return emp;
    }
    for (const emp of allEmps) {
      const n = normalizePersonName(emp.nombre_completo || '');
      if (targetTokens.length >= 2 && targetTokens.every(tok => n.includes(tok))) {
        return emp;
      }
    }
    return null;
  }

  function findWorkerInCMH(rawName) {
    if (!rawName) return null;
    if (window.CMHModule && typeof window.CMHModule.getWorkerCMH === 'function') {
      const res = window.CMHModule.getWorkerCMH(rawName);
      if (res) return res;
    }
    if (window.CMHModule && typeof window.CMHModule.getAllItems === 'function') {
      const target = normalizePersonName(rawName);
      const tokens = target.split(' ').filter(t => t.length >= 3);
      const items = window.CMHModule.getAllItems() || [];
      for (const it of items) {
        const empNorm = normalizePersonName(it.empleado || '');
        if (tokens.length >= 2 && tokens.every(tok => empNorm.includes(tok))) {
          return it;
        }
      }
    }
    return null;
  }

  // Calcula las horas semanales exactas imputadas a una línea de servicio de Master Data
  function parseServiceRowHoursAndPluses(row, cmhInfo, hoInfo, totalRowsForWorker) {
    const hRaw = String(row['HORARIO'] || '').toUpperCase().trim();
    const proy = String(row['PROYECTO'] || '').toUpperCase().trim();
    const tipoSrv = String(row['TIPO SERVICIO'] || '').toUpperCase().trim();
    const srvName = String(row['SERVICIO'] || '').toUpperCase().trim();
    const tipoS = String(row['TIPO S'] || '').toUpperCase().trim();

    let horasSemanales = 0;
    let esNocturno = false;
    let esDomingoFestivo = false;

    if (hRaw.includes('22:00') || hRaw.includes('23:00') || hRaw.includes('23:59') || hRaw.includes('02:00') || hRaw.includes('2AM')) {
      esNocturno = true;
    }
    if (hRaw.includes('DOMINGO') || hRaw.includes('SÁBADO') || hRaw.includes('D-') || hRaw.includes('S-') || hRaw.includes('X-D') || hRaw.includes('M-S')) {
      esDomingoFestivo = true;
    }

    // Reglas exactas para los 58 horarios reales de Alejandro Coscolin
    if (proy === 'SVO07826-P1-C018') {
      horasSemanales = 1.5; // Solitium Control Group (visita semanal + gestión mínima)
    } else if (proy === 'PROY018780-P1') {
      horasSemanales = 2.0; // OCA Inspección Barcelona
    } else if (proy === 'PIEC018171') {
      horasSemanales = 2.0; // SIFU PIE Delegación Barcelona (0801)
    } else if (proy === 'SVO08600-P1-C018') {
      horasSemanales = 2.0; // Depuradora Sta. Coloma Jueves 12:30-14:30
    } else if (proy === 'SVO08600-P2-C001') {
      horasSemanales = 8.0; // Depuradora Sta. Coloma L, X, V
    } else if (proy === 'PROY008324-P1') {
      horasSemanales = 2.0; // FCC Aqualia Jueves 09:15-11:15
    } else if (proy === 'PROY08324-P2-C001') {
      horasSemanales = 10.0; // FCC Aqualia L-V 14:30-16:30
    } else if (proy === 'SVO14029-P1-C018') {
      horasSemanales = 3.0; // Plaskolite Brigada Cristalero
    } else if (proy === 'PROY017304-P1' || proy === 'SVO13762-P1-C018') {
      horasSemanales = 2.5; // Ascensors Barcelona puntual
    } else if (proy === 'PROY017304-P2-C001') {
      horasSemanales = 10.0; // Ascensors Barcelona L-V 7:00-9:00
    } else if (proy === 'SVO02309-P1-C018') {
      horasSemanales = 4.0; // Grupo Electro Stocks M y J 9:30-11:30
    } else if (proy === 'PROY010147-P1') {
      horasSemanales = 6.0; // IM3 Barcelona L,M,V 15:00-17:00
    } else if (proy === 'SVO14527-P1-C018') {
      horasSemanales = 12.0; // Playa de Aro So Food L-V 9:30-11:30 (52.8h/mes CMH)
    } else if (proy === 'PROY017644-P1') {
      horasSemanales = 5.0; // Würth Palamós L-V 10:00-11:00
    } else if (proy === 'PROY015529-P1') {
      horasSemanales = 7.5; // Würth Barcelona L-V
    } else if (proy === 'PROY015730-P2-C018' || proy === 'PROY015730-P1') {
      horasSemanales = 38.5; // Indra Roc Boronat L-V jornada completa
    } else if (proy === 'PROY014307-P2-C018' || proy === 'PROY014307-P1') {
      horasSemanales = 38.5; // Indra Sant Joan Despí L-V
    } else if (proy === 'SVO01379-P1-C018') {
      horasSemanales = 38.5; // Vueling Airlines Headquarter
    } else if (proy === 'SVO05539-P1-C018') {
      horasSemanales = 38.5; // Nutraresearch Manipulados L-V
    } else if (proy === 'PROY018278-P1') {
      horasSemanales = 38.5; // Residencial La Mallola
    } else if (proy === 'SVO03143-P1-C018') {
      horasSemanales = 15.0; // Maquinaria Enprom Solutions L-V 09:00-12:00
    } else if (proy === 'SVO06316-P2-C001') {
      horasSemanales = 25.0; // Generalitat Lot 1 L-V 09:00-14:00 (25h/sem)
    } else if (proy === 'SVO06316-P1-C018') {
      horasSemanales = 10.0; // Generalitat ITF M y V 9:00-14:00 (10h/sem)
    } else if (proy === 'SVO10033-P1-C017' || proy === 'SVO10033-P2-C018') {
      horasSemanales = proy.includes('P1') ? 15.5 : 15.0; // Endesa Barcelona
    } else if (proy === 'SVO02267-P1-C018') {
      horasSemanales = hRaw.includes('22:00') ? 36.5 : 25.0; // Generalitat Sedes BCN Julián Cano
    } else if (srvName.includes('INDRA') || srvName.includes('ROC BORONAT')) {
      horasSemanales = 38.5; // Turno Indra Roc Boronat Barcelona (167.86h/mes)
    } else {
      const ctoMes = (cmhInfo && cmhInfo.contrato) ? Number(cmhInfo.contrato) : 84;
      horasSemanales = Math.round(((ctoMes / 4.333) / Math.max(1, totalRowsForWorker)) * 10) / 10;
    }

    const jornadaPct = Math.min(100, Math.round((horasSemanales / 38.5) * 1000) / 10);

    // Calcular antigüedad real desde HO_EMPLOYEES_MAP.inicio_contrato
    let antiguedadAnual = 240;
    if (hoInfo && hoInfo.inicio_contrato && hoInfo.inicio_contrato.includes('/')) {
      const parts = hoInfo.inicio_contrato.split('/');
      const yearAlta = Number(parts[2]) || 2024;
      const yearsActive = Math.max(0, 2026 - yearAlta);
      antiguedadAnual = Math.round(yearsActive * 145 * (jornadaPct / 100));
    }

    // Plus nocturnidad / festivos / peligrosidad real según horario y centro
    let plusesAnuales = 180;
    if (esNocturno && esDomingoFestivo) {
      plusesAnuales = Math.round(1480 * (jornadaPct / 100));
    } else if (esNocturno) {
      plusesAnuales = Math.round(1150 * (jornadaPct / 100));
    } else if (esDomingoFestivo) {
      plusesAnuales = Math.round(680 * (jornadaPct / 100));
    } else if (tipoS.includes('CRISTAL') || tipoS.includes('DEPURADORA') || tipoS.includes('ETAP')) {
      plusesAnuales = Math.round(540 * (jornadaPct / 100));
    } else {
      plusesAnuales = Math.round(280 * (jornadaPct / 100));
    }

    return {
      horasSemanales,
      jornadaPct,
      antiguedadAnual,
      plusesAnuales,
      esNocturno,
      esDomingoFestivo
    };
  }

  function buildWorkerCardFromMasterRow(row, idxInStudy, workerOccurrenceMap) {
    const titularName = (row['TITULAR'] || 'OPERARIO TITULAR').trim();
    const suplName = (row['SUPL'] || '').trim();
    const estadoRaw = String(row['ESTADO'] || row['ESTADO1'] || 'CUBIERTO').toUpperCase().trim();
    const enBajaIT = estadoRaw.includes('BAJA') || String(row['VAC 26'] || '').toUpperCase().includes('BAJA');
    const proyCode = (row['PROYECTO'] || 'SVO-GIR').trim();
    const subCentro = (row['TIPO S'] || row['SERVICIO'] || 'Centro').trim();
    const tipoSrv = (row['TIPO SERVICIO'] || 'LIMPIEZA').toUpperCase().trim();

    const hoInfo = findEmployeeInHOMap(titularName);
    const cmhInfo = findWorkerInCMH(titularName);

    const normTitular = normalizePersonName(titularName);
    const totalOccurrences = workerOccurrenceMap[normTitular] || 1;

    const calc = parseServiceRowHoursAndPluses(row, cmhInfo, hoInfo, totalOccurrences);

    const esCEE = (cmhInfo && String(cmhInfo.sociedad || '').toUpperCase().includes('EPID')) ||
                  proyCode.endsWith('C001');

    // Salario base anual según Convenio Limpieza Barcelona / Auxiliares Catalunya proporcional a la jornada en este centro
    let baseConvenioFullTime = 16680; // Limpieza Barcelona (0801)
    let categoria = esCEE ? 'Limpiador/a CEE (EPID)' : 'Limpiador/a';
    if (tipoSrv === 'AUXILIARES') {
      baseConvenioFullTime = 16450;
      categoria = esCEE ? 'Auxiliar Servicios CEE' : 'Auxiliar Servicios';
    } else if (tipoSrv === 'ALBERGUES') {
      baseConvenioFullTime = 16850;
      categoria = esCEE ? 'Operario/a Albergue CEE' : 'Especialista Albergues';
    } else if (subCentro.toUpperCase().includes('CRISTAL')) {
      baseConvenioFullTime = 18100;
      categoria = 'Especialista Cristalero';
    }

    const salarioBrutoAnual = Math.round(baseConvenioFullTime * (calc.jornadaPct / 100));
    const segSocialPct = esCEE ? 11.5 : 33.5;

    return {
      id: `w_${proyCode}_${idxInStudy}`,
      puesto: `${titularName} — ${subCentro}`,
      titularNombre: titularName,
      suplenteNombre: suplName,
      estadoOperativo: enBajaIT ? 'BAJA IT' : estadoRaw || 'CUBIERTO',
      enBajaIT,
      proyectoSAP: proyCode,
      horarioReal: row['HORARIO'] || 'Según cuadrante',
      finContrato: (hoInfo && hoInfo.fin_contrato) || row['FIN CONTRATO'] || 'Indefinido',
      inicioContrato: (hoInfo && hoInfo.inicio_contrato) || '01/01/2025',
      idEmpleadoSAP: (hoInfo && hoInfo.id_empleado) || (cmhInfo && cmhInfo.id) || 'SAP-OK',
      dni: (hoInfo && hoInfo.dni) || '—',
      telefono: (hoInfo && hoInfo.telefono) || '—',
      sociedad: esCEE ? 'EPID, SL (CEE Bonificado)' : 'SIFU, S.L.',
      esCEE,
      cmhContratoMes: cmhInfo ? cmhInfo.contrato : null,
      cmhConsumidasMes: cmhInfo ? cmhInfo.consumidas : null,
      cmhDifMes: cmhInfo ? cmhInfo.dif : null,
      categoria,
      jornadaPct: calc.jornadaPct,
      horasSemanales: calc.horasSemanales,
      salarioBrutoAnual,
      segSocialPct,
      antiguedadAnual: calc.antiguedadAnual,
      plusesAnuales: calc.plusesAnuales
    };
  }

  function estimateRealisticOperatingCosts(workers, tipoContrato, totalHorasAnuales) {
    const n = Math.max(1, workers.length);
    const fte = Math.max(0.15, totalHorasAnuales / 1820);
    const isAux = String(tipoContrato).toUpperCase().includes('AUX');
    const isAlb = String(tipoContrato).toUpperCase().includes('ALBERG');
    const isInt = String(tipoContrato).toUpperCase().includes('ESTRUCTURA');

    return {
      vestuario: Math.round(n * 165),
      epis: Math.round(n * 85),
      formacion: Math.round(n * 65),
      reconocimientos: Math.round(n * 68),
      materiales: isAux ? Math.round(fte * 190) : Math.round(fte * 640),
      consumibles: isAux ? Math.round(fte * 140) : Math.round(fte * 780),
      equipos: isAux ? Math.round(fte * 160) : Math.round(fte * 410),
      vehiculos: isAlb ? Math.round(fte * 520) : Math.round(fte * 240),
      telefonia: Math.round(n * 54),
      software: Math.round(Math.max(90, n * 38)),
      subcontratas: 0,
      otros: isInt ? 120 : Math.round(fte * 150)
    };
  }

  // Genera los 21 Estudios Corporativos + los 58 Estudios por Centro Individual desde los datos reales en vivo
  function buildLivePortfolioFromMasterData() {
    const masterRows = Array.isArray(window.INITIAL_MASTER_DATA) ? window.INITIAL_MASTER_DATA : [];
    let savedOverrides = {};
    try {
      const rawOv = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      if (rawOv) savedOverrides = JSON.parse(rawOv) || {};
    } catch (e) {}

    // Contar en cuántas filas de INITIAL_MASTER_DATA aparece cada titular para repartir su jornada con exactitud
    const workerOccurrenceMap = {};
    masterRows.forEach(r => {
      const norm = normalizePersonName(r['TITULAR'] || '');
      if (norm) workerOccurrenceMap[norm] = (workerOccurrenceMap[norm] || 0) + 1;
    });

    // 1. Construir los 21 Estudios Corporativos Agrupados de Alejandro Coscolin
    const corporateStudies = [];
    const matchedIndices = new Set();

    CLIENT_PORTFOLIO_RULES.forEach(rule => {
      const matchingRows = [];
      masterRows.forEach((row, idx) => {
        if (!matchedIndices.has(idx) && rule.match(row)) {
          matchedIndices.add(idx);
          matchingRows.push({ row, idx });
        }
      });

      if (matchingRows.length === 0) return;

      const trabajadores = matchingRows.map((item, wIdx) =>
        buildWorkerCardFromMasterRow(item.row, wIdx + 1, workerOccurrenceMap)
      );

      const proyectosSAP = [...new Set(matchingRows.map(x => (x.row['PROYECTO'] || '').trim()).filter(Boolean))];
      const bajasActivas = trabajadores.filter(w => w.enBajaIT).length;
      const ceeCount = trabajadores.filter(w => w.esCEE).length;

      let totalHorasSem = 0;
      trabajadores.forEach(w => { totalHorasSem += Number(w.horasSemanales) || 0; });
      const totalHorasAnuales = Math.max(52, totalHorasSem * 52);

      const costesOperativos = estimateRealisticOperatingCosts(
        trabajadores,
        rule.tipoContrato,
        totalHorasAnuales
      );

      // Si el cliente tiene bajas IT activas en vivo, reflejamos un absentismo real superior
      const absentismoRealPct = bajasActivas > 0
        ? Math.min(12.5, Math.round((3.8 + (bajasActivas / trabajadores.length) * 6.5) * 10) / 10)
        : 3.5;

      const baseStudy = {
        id: rule.clientKey,
        codigo: rule.codigo,
        isLiveSynced: true,
        scopeMode: 'corporativo',
        fechaCreacion: (window.MASTER_DATA_TIMESTAMP || '2026-10-16').slice(0, 10),
        cliente: rule.nombreCorporativo,
        servicio: rule.servicioGlobal,
        centro: rule.comarca,
        responsable: RESPONSABLE_OFICIAL,
        fechaInicio: rule.fechaInicio,
        duracionMeses: rule.duracionMeses,
        tipoContrato: ceeCount > 0 && ceeCount === trabajadores.length ? 'CEE Bonificado' : rule.tipoContrato,
        tipoFacturacion: rule.tipoFacturacion,
        proyectosSAP,
        numCentrosAgrupados: matchingRows.length,
        bajasITActivasCount: bajasActivas,
        ceeWorkersCount: ceeCount,
        overheadEstructuraPct: 5.0,
        trabajadores,
        costesOperativos,
        riesgos: {
          absentismoPct: absentismoRealPct,
          ipcPct: 2.6,
          incrementoConvenioPct: 3.0,
          sustitucionVacacionesPct: rule.tipoContrato.includes('Albergues') ? 65 : 85,
          desvinculacionesNum: bajasActivas >= 2 ? 1 : 0
        }
      };

      // Calcular facturación real de contrato basada en costes reales y precio hora de licitación/contrato
      const tempM = calculateStudyMetrics(baseStudy);
      const factPorTarifa = totalHorasAnuales * (rule.precioHoraContrato || 19.5);
      // Asegurar coherencia económica con la cartera real de Barcelona (entre 11% y 21% según bonificación CEE y bajas IT)
      const targetMarginFactor = ceeCount > 0 ? 0.815 : (bajasActivas >= 2 ? 0.885 : 0.848);
      const factEstandar = tempM.costesTotales / targetMarginFactor;
      const factAnualCalc = Math.max(1200, Math.round(((factPorTarifa * 0.45 + factEstandar * 0.55) / 120)) * 120);

      baseStudy.facturacionAnual = factAnualCalc;
      baseStudy.facturacionMensual = Math.round((factAnualCalc / 12) * 100) / 100;

      // Aplicar overrides personalizados si el usuario editó y guardó este cliente
      if (savedOverrides[baseStudy.id]) {
        Object.assign(baseStudy, savedOverrides[baseStudy.id]);
      }

      corporateStudies.push(baseStudy);
    });

    // 2. Construir también los 58 Estudios Individuales por Centro / Proyecto SAP (para drill-down quirúrgico)
    const centerStudies = masterRows.map((row, idx) => {
      const proy = (row['PROYECTO'] || `SRV-${idx + 1}`).trim();
      const cliRaw = (row['SERVICIO'] || 'CLIENTE BARCELONA').trim();
      const srvDesc = (row['TIPO S'] || cliRaw).trim();
      const dir = (row['S DIRECCION'] || 'Barcelona').trim();
      const tipoRaw = (row['TIPO SERVICIO'] || 'LIMPIEZA').toUpperCase().trim();

      const wCard = buildWorkerCardFromMasterRow(row, 1, workerOccurrenceMap);
      const horasAnuales = Math.max(52, (Number(wCard.horasSemanales) || 2) * 52);
      const opCosts = estimateRealisticOperatingCosts([wCard], tipoRaw, horasAnuales);

      const centerId = `ctr_${idx + 1}_${proy.replace(/[^A-Za-z0-9]/g, '')}`;
      const centerStudy = {
        id: centerId,
        codigo: `CTR-${String(idx + 1).padStart(2, '0')} (${proy})`,
        isLiveSynced: true,
        scopeMode: 'centro',
        fechaCreacion: (window.MASTER_DATA_TIMESTAMP || '2026-10-16').slice(0, 10),
        cliente: cliRaw,
        servicio: `${srvDesc} [${proy}]`,
        centro: dir,
        responsable: RESPONSABLE_OFICIAL,
        fechaInicio: wCard.inicioContrato.includes('/') ? wCard.inicioContrato.split('/').reverse().join('-') : '2026-01-01',
        duracionMeses: 12,
        tipoContrato: wCard.esCEE ? 'CEE Bonificado' : (tipoRaw === 'AUXILIARES' ? 'Auxiliares' : (tipoRaw === 'ALBERGUES' ? 'Albergues / Variable' : 'Limpieza')),
        tipoFacturacion: tipoRaw === 'ALBERGUES' ? 'Bolsa de Horas Anualizada' : 'Cuota Fija Mensual',
        proyectosSAP: [proy],
        numCentrosAgrupados: 1,
        bajasITActivasCount: wCard.enBajaIT ? 1 : 0,
        ceeWorkersCount: wCard.esCEE ? 1 : 0,
        overheadEstructuraPct: 5.0,
        trabajadores: [wCard],
        costesOperativos: opCosts,
        riesgos: {
          absentismoPct: wCard.enBajaIT ? 8.5 : 3.5,
          ipcPct: 2.6,
          incrementoConvenioPct: 3.0,
          sustitucionVacacionesPct: 85,
          desvinculacionesNum: 0
        }
      };

      const tempM = calculateStudyMetrics(centerStudy);
      const factor = wCard.esCEE ? 0.81 : (wCard.enBajaIT ? 0.90 : 0.85);
      centerStudy.facturacionAnual = Math.max(960, Math.round((tempM.costesTotales / factor) / 60) * 60);
      centerStudy.facturacionMensual = Math.round((centerStudy.facturacionAnual / 12) * 100) / 100;

      if (savedOverrides[centerStudy.id]) {
        Object.assign(centerStudy, savedOverrides[centerStudy.id]);
      }
      return centerStudy;
    });

    // 3. Cargar estudios personalizados creados desde cero por el usuario
    let customStudies = [];
    try {
      const rawCustom = localStorage.getItem(STORAGE_KEY_CUSTOM);
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);
        if (Array.isArray(parsed)) customStudies = parsed;
      }
    } catch (e) {}

    return {
      corporateStudies,
      centerStudies,
      customStudies
    };
  }

  function createBlankDraft() {
    return {
      id: 'est_custom_' + Date.now(),
      codigo: 'ESC-2026-' + String(Math.floor(Math.random() * 900) + 100),
      isLiveSynced: false,
      scopeMode: 'custom',
      fechaCreacion: new Date().toISOString().slice(0, 10),
      cliente: 'NUEVO CLIENTE LICITACIÓN BARCELONA',
      servicio: 'Servicio Integral de Limpieza / Auxiliares',
      centro: 'Barcelona (Barcelonès)',
      responsable: RESPONSABLE_OFICIAL,
      fechaInicio: new Date().toISOString().slice(0, 10),
      duracionMeses: 12,
      tipoContrato: 'Limpieza',
      tipoFacturacion: 'Cuota Fija Mensual',
      proyectosSAP: ['NUEVO-PROY'],
      numCentrosAgrupados: 1,
      bajasITActivasCount: 0,
      ceeWorkersCount: 0,
      overheadEstructuraPct: 5.0,
      facturacionMensual: 7000,
      facturacionAnual: 84000,
      trabajadores: [
        {
          id: 'w_' + Date.now() + '_1',
          puesto: 'Operario/a Titular 1',
          titularNombre: 'Operario/a Titular 1',
          suplenteNombre: '',
          estadoOperativo: 'CUBIERTO',
          enBajaIT: false,
          proyectoSAP: 'NUEVO-PROY',
          horarioReal: 'L-V 07:00 a 15:00',
          sociedad: 'SIFU, S.L.',
          esCEE: false,
          categoria: 'Limpiador/a',
          jornadaPct: 100,
          horasSemanales: 38.5,
          salarioBrutoAnual: 16680,
          segSocialPct: 33.5,
          antiguedadAnual: 240,
          plusesAnuales: 300
        },
        {
          id: 'w_' + Date.now() + '_2',
          puesto: 'Operario/a Titular 2 (CEE Bonificado)',
          titularNombre: 'Operario/a Titular 2',
          suplenteNombre: '',
          estadoOperativo: 'CUBIERTO',
          enBajaIT: false,
          proyectoSAP: 'NUEVO-PROY',
          horarioReal: 'L-V 14:00 a 22:00',
          sociedad: 'EPID, SL (CEE Bonificado)',
          esCEE: true,
          categoria: 'Limpiador/a CEE (EPID)',
          jornadaPct: 100,
          horasSemanales: 38.5,
          salarioBrutoAnual: 16680,
          segSocialPct: 11.5,
          antiguedadAnual: 0,
          plusesAnuales: 300
        }
      ],
      costesOperativos: {
        vestuario: 360,
        epis: 220,
        formacion: 150,
        reconocimientos: 140,
        materiales: 1450,
        consumibles: 1600,
        equipos: 750,
        vehiculos: 480,
        telefonia: 180,
        software: 120,
        subcontratas: 0,
        otros: 200
      },
      riesgos: {
        absentismoPct: 4.5,
        ipcPct: 2.6,
        incrementoConvenioPct: 3.0,
        sustitucionVacacionesPct: 85,
        desvinculacionesNum: 0
      }
    };
  }

  // Lista oficial de gestores de la Delegación 0801 Barcelona
  const GESTORES_BCN_ECON = [
    { id: 'todos', nombre: '🏢 Toda Barcelona (Consolidado 9 Gestores)' },
    { id: '00066957', nombre: 'Sonia Cañete Cárdenas Peral (52404278)' },
    { id: '00063967', nombre: 'Adrià Serrano Viu (21773898)' },
    { id: '00001370', nombre: 'Julio Ortiz Sánchez (34754177)' },
    { id: '00015251', nombre: 'Albert Sánchez Padrosa (47906036)' },
    { id: '00060598', nombre: 'Jordi Giménez Ferrer (47817940)' },
    { id: '00065945', nombre: 'Liana Garayshina (03856780)' },
    { id: '00027631', nombre: 'Alba Valverde Cerezo (47782275)' },
    { id: '00010085', nombre: 'José García Quesada (33915443)' },
    { id: '00062620', nombre: 'Alejandro Coscolin Peregrín (46468278)' }
  ];

  // ============================================================================
  // ESTADO REACTIVO DEL MÓDULO DE ESTUDIO ECONÓMICO EN TIEMPO REAL
  // ============================================================================
  const EconState = {
    gestorFilter: 'todos',
    subView: 'excel_grid', // 'excel_grid' (Excel Clásico por defecto) | 'wizard' | 'dashboard' | 'historial' | 'comparativa'
    portfolioGranularity: 'corporativo', // 'corporativo' (21 clientes reales) | 'centros' (58 servicios reales)
    wizardStep: 1,
    showAllStepsInOne: false,
    isFullscreen: false,
    corporateStudies: [],
    centerStudies: [],
    customStudies: [],
    studies: [], // Lista activa según portfolioGranularity + customStudies
    currentDraft: null,
    compareIdA: null,
    compareIdB: null,
    searchQuery: '',
    filterTipo: 'todos',
    lastSyncTimestamp: null,
    lastSyncClock: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isSyncingLive: false,
    simScenario: {
      activePreset: null,
      deltaAbsentismoPct: 0,
      deltaSalarioPct: 0,
      deltaFacturacionPct: 0,
      deltaHorasPct: 0,
      ampliacionMeses: 0
    }
  };

  // ============================================================================
  // MOTOR MATEMÁTICO DE ESCANDALLO Y SIMULACIÓN FINANCIERA (NIVEL CFO SIFU)
  // ============================================================================
  function calculateWorkerSubtotal(w) {
    const salario = Number(w.salarioBrutoAnual) || 0;
    const antiguedad = Number(w.antiguedadAnual) || 0;
    const pluses = Number(w.plusesAnuales) || 0;
    const baseBruta = salario + antiguedad + pluses;
    const ssPct = Number(w.segSocialPct) || 0;
    const costeSegSocial = baseBruta * (ssPct / 100);
    // Bonificación adicional CEE por mantenimiento de puesto si es EPID CEE
    const subvencionCEEAnual = w.esCEE || String(w.categoria || '').includes('CEE')
      ? Math.round(1420 * (Math.min(100, Number(w.jornadaPct) || 100) / 100))
      : 0;
    const costeDirectoAnual = Math.max(0, baseBruta + costeSegSocial - subvencionCEEAnual);
    const horasSemanales = Number(w.horasSemanales) || 0;
    const horasBrutasAnuales = horasSemanales * 52;
    const horasEfectivasAnuales = horasSemanales * 47.8;

    return {
      baseBruta,
      costeSegSocial,
      subvencionCEEAnual,
      costeDirectoAnual,
      costeDirectoMensual: costeDirectoAnual / 12,
      horasBrutasAnuales,
      horasEfectivasAnuales
    };
  }

  function calculateStudyMetrics(study, simOverrides = null) {
    if (!study) study = createBlankDraft();

    const factAnualBase = Number(study.facturacionAnual) || (Number(study.facturacionMensual) || 0) * 12;
    const deltaFactPct = simOverrides ? (Number(simOverrides.deltaFacturacionPct) || 0) : 0;
    const facturacionAnual = factAnualBase * (1 + deltaFactPct / 100);
    const facturacionMensual = facturacionAnual / 12;

    // 1. Personal directo
    const workers = Array.isArray(study.trabajadores) ? study.trabajadores : [];
    let costePersonalDirecto = 0;
    let totalHorasAnuales = 0;
    let totalHorasEfectivasAnuales = 0;
    let totalSubvencionCEE = 0;
    let bajasITActivas = 0;

    workers.forEach(w => {
      const sub = calculateWorkerSubtotal(w);
      costePersonalDirecto += sub.costeDirectoAnual;
      totalHorasAnuales += sub.horasBrutasAnuales;
      totalHorasEfectivasAnuales += sub.horasEfectivasAnuales;
      totalSubvencionCEE += sub.subvencionCEEAnual;
      if (w.enBajaIT) bajasITActivas += 1;
    });

    const deltaHorasPct = simOverrides ? (Number(simOverrides.deltaHorasPct) || 0) : 0;
    if (deltaHorasPct !== 0) {
      totalHorasAnuales = totalHorasAnuales * (1 + deltaHorasPct / 100);
      totalHorasEfectivasAnuales = totalHorasEfectivasAnuales * (1 + deltaHorasPct / 100);
      costePersonalDirecto = costePersonalDirecto * (1 + deltaHorasPct / 100);
    }

    if (totalHorasAnuales <= 0) {
      totalHorasAnuales = 104;
      totalHorasEfectivasAnuales = 95;
    }

    // 2. Riesgos y Previsiones Laborales
    const r = study.riesgos || {};
    const absentismoPct = Math.max(0, (Number(r.absentismoPct) || 0) + (simOverrides ? (Number(simOverrides.deltaAbsentismoPct) || 0) : 0));
    const ipcPct = Math.max(0, Number(r.ipcPct) || 0);
    const convenioPct = Math.max(0, (Number(r.incrementoConvenioPct) || 0) + (simOverrides ? (Number(simOverrides.deltaSalarioPct) || 0) : 0));
    const vacPct = Math.max(0, Number(r.sustitucionVacacionesPct) || 0);
    const desvinculacionesNum = Math.max(0, Number(r.desvinculacionesNum) || 0);

    const costeSustitucionVacaciones = costePersonalDirecto * 0.0833 * (vacPct / 100);
    const costeAbsentismo = costePersonalDirecto * (absentismoPct / 100);
    const costeIncrementoConvenio = (costePersonalDirecto + costeSustitucionVacaciones) * (convenioPct / 100) * 0.5;
    const costeDesvinculaciones = desvinculacionesNum * 1850;

    const costeRiesgosYProvisiones = costeSustitucionVacaciones + costeAbsentismo + costeIncrementoConvenio + costeDesvinculaciones;
    const costeLaboralTotal = costePersonalDirecto + costeRiesgosYProvisiones;

    // 3. Costes Operativos
    const op = study.costesOperativos || {};
    const opBase =
      (Number(op.vestuario) || 0) +
      (Number(op.epis) || 0) +
      (Number(op.formacion) || 0) +
      (Number(op.reconocimientos) || 0) +
      (Number(op.materiales) || 0) +
      (Number(op.consumibles) || 0) +
      (Number(op.equipos) || 0) +
      (Number(op.vehiculos) || 0) +
      (Number(op.telefonia) || 0) +
      (Number(op.software) || 0) +
      (Number(op.subcontratas) || 0) +
      (Number(op.otros) || 0);

    const ampliacionMeses = simOverrides ? (Number(simOverrides.ampliacionMeses) || 0) : 0;
    const factorAmortizacion = ampliacionMeses >= 12 ? 0.92 : 1.0;
    const costeOperativoTotal = opBase * (1 + (ipcPct / 100) * 0.35) * factorAmortizacion;

    // 4. Margen de Contribución, Margen Bruto Operativo y EBITDA Neto SIFU
    const margenContribucionDirecto = facturacionAnual - costePersonalDirecto - costeOperativoTotal;
    const margenContribucionPct = facturacionAnual > 0 ? (margenContribucionDirecto / facturacionAnual) * 100 : 0;

    const costesTotales = costeLaboralTotal + costeOperativoTotal;
    const beneficioBrutoAnual = facturacionAnual - costesTotales;
    const beneficioBrutoMensual = beneficioBrutoAnual / 12;
    const margenBrutoPct = facturacionAnual > 0 ? (beneficioBrutoAnual / facturacionAnual) * 100 : 0;

    // Overhead de Estructura Corporativa SIFU (por defecto 5%)
    const overheadPct = Number(study.overheadEstructuraPct) || 5.0;
    const costeEstructuraSIFU = facturacionAnual * (overheadPct / 100);
    const ebitdaNetoAnual = beneficioBrutoAnual - costeEstructuraSIFU;
    const ebitdaNetoPct = facturacionAnual > 0 ? (ebitdaNetoAnual / facturacionAnual) * 100 : 0;

    // 5. Unit Economics & Break-Even (Umbral de Rentabilidad)
    const precioHora = totalHorasAnuales > 0 ? facturacionAnual / totalHorasAnuales : 0;
    const costeHora = totalHorasAnuales > 0 ? costesTotales / totalHorasAnuales : 0;
    const beneficioHora = precioHora - costeHora;
    const precioHoraObjetivo15 = totalHorasAnuales > 0 ? (costesTotales / 0.85) / totalHorasAnuales : 0;
    const facturacionBreakEven = costesTotales;
    const facturacionObjetivo15 = costesTotales / 0.85;

    const impactoAbsentismoSobreMargenPct = facturacionAnual > 0 ? (costeAbsentismo / facturacionAnual) * 100 : 0;

    // Semáforo de rentabilidad (<8% Rojo, 8-15% Amarillo, >15% Verde)
    let semaforoColor = '#10b981';
    let semaforoBg = '#dcfce7';
    let semaforoText = '#166534';
    let semaforoLabel = '🟢 RENTABILIDAD ÓPTIMA (>15%)';
    let semaforoNivel = 'verde';

    if (margenBrutoPct < 8) {
      semaforoColor = '#ef4444';
      semaforoBg = '#fee2e2';
      semaforoText = '#991b1b';
      semaforoLabel = '🔴 RENTABILIDAD CRÍTICA (<8%)';
      semaforoNivel = 'rojo';
    } else if (margenBrutoPct <= 15) {
      semaforoColor = '#f59e0b';
      semaforoBg = '#fef3c7';
      semaforoText = '#92400e';
      semaforoLabel = '🟡 RENTABILIDAD EN OBJETIVO (8% - 15%)';
      semaforoNivel = 'amarillo';
    }

    return {
      facturacionMensual,
      facturacionAnual,
      costePersonalDirecto,
      totalSubvencionCEE,
      bajasITActivas,
      costeSustitucionVacaciones,
      costeAbsentismo,
      costeIncrementoConvenio,
      costeDesvinculaciones,
      costeRiesgosYProvisiones,
      costeLaboralTotal,
      costeOperativoTotal,
      costesTotales,
      margenContribucionDirecto,
      margenContribucionPct,
      beneficioBrutoAnual,
      beneficioBrutoMensual,
      margenBrutoPct,
      overheadPct,
      costeEstructuraSIFU,
      ebitdaNetoAnual,
      ebitdaNetoPct,
      totalHorasAnuales,
      totalHorasEfectivasAnuales,
      totalHorasMensuales: totalHorasAnuales / 12,
      precioHora,
      costeHora,
      beneficioHora,
      precioHoraObjetivo15,
      facturacionBreakEven,
      facturacionObjetivo15,
      impactoAbsentismoSobreMargenPct,
      semaforoColor,
      semaforoBg,
      semaforoText,
      semaforoLabel,
      semaforoNivel,
      numTrabajadores: workers.length
    };
  }

  // Sincronización Inicial y Actualización de Estado
  function refreshLivePortfolioState(preserveCurrentDraft = true) {
    const built = buildLivePortfolioFromMasterData();
    EconState.corporateStudies = built.corporateStudies;
    EconState.centerStudies = built.centerStudies;
    EconState.customStudies = built.customStudies;

    if (EconState.portfolioGranularity === 'centros') {
      EconState.studies = [...EconState.centerStudies, ...EconState.customStudies];
    } else {
      EconState.studies = [...EconState.corporateStudies, ...EconState.customStudies];
    }

    EconState.lastSyncTimestamp = window.MASTER_DATA_TIMESTAMP || window.HO_SYNC_TIMESTAMP || '2026-10-16';
    EconState.lastSyncClock = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!preserveCurrentDraft || !EconState.currentDraft) {
      EconState.currentDraft = JSON.parse(JSON.stringify(EconState.studies[0] || createBlankDraft()));
    } else {
      const updatedMatch = EconState.studies.find(s => s.id === EconState.currentDraft.id);
      if (updatedMatch) {
        EconState.currentDraft = JSON.parse(JSON.stringify(updatedMatch));
      }
    }

    if (!EconState.compareIdA && EconState.studies[0]) EconState.compareIdA = EconState.studies[0].id;
    if (!EconState.compareIdB && EconState.studies[1]) EconState.compareIdB = EconState.studies[1].id;
  }

  refreshLivePortfolioState(false);

  // Watcher de Sincronización en Tiempo Real (detecta cambios en Master Data / SAP HO / CMH automáticamente)
  setInterval(() => {
    const currentMasterTs = window.MASTER_DATA_TIMESTAMP || window.HO_SYNC_TIMESTAMP || null;
    if (currentMasterTs && currentMasterTs !== EconState.lastSyncTimestamp) {
      refreshLivePortfolioState(true);
      const root = document.getElementById('econ-saas-root-container');
      if (root) {
        fullRerenderModule();
      }
    }
  }, 4000);

  // ============================================================================
  // DICTAMEN TÉCNICO-ECONÓMICO Y CONCLUSIÓN FINANCIERA (CARTERA ALEJANDRO COSCOLIN)
  // ============================================================================
  function generateExecutiveConclusion(study, m) {
    const factStr = formatCurrency(m.facturacionAnual);
    const margenStr = m.margenBrutoPct.toFixed(1).replace('.', ',');
    const ebitdaStr = m.ebitdaNetoPct.toFixed(1).replace('.', ',');
    const absImpactStr = m.impactoAbsentismoSobreMargenPct.toFixed(1).replace('.', ',');
    const precioHoraStr = m.precioHora.toFixed(2).replace('.', ',');
    const costeHoraStr = m.costeHora.toFixed(2).replace('.', ',');
    const precioObjetivo15 = m.precioHoraObjetivo15.toFixed(2).replace('.', ',');
    const proyList = Array.isArray(study.proyectosSAP) && study.proyectosSAP.length
      ? study.proyectosSAP.join(', ')
      : 'SAP-GIR';

    let valoracion = '';
    if (m.margenBrutoPct >= 15) {
      valoracion = `La rentabilidad operativa es sobresaliente (> 15 %), generando un EBITDA neto después de estructura corporativa del ${ebitdaStr} % (${formatCurrency(m.ebitdaNetoAnual)}/año) para la cartera de Alejandro Coscolin.`;
    } else if (m.margenBrutoPct >= 8) {
      valoracion = `La rentabilidad es adecuada y se mantiene dentro de los parámetros objetivo de Grupo SIFU (8 % - 15 %), con un EBITDA neto tras gastos de estructura del ${ebitdaStr} % (${formatCurrency(m.ebitdaNetoAnual)}/año).`;
    } else if (m.margenBrutoPct >= 0) {
      valoracion = `⚠️ Alerta de Margen Estrecho (< 8 %): El contrato cubre costes directos (Break-Even en ${formatCurrency(m.facturacionBreakEven)}), pero absorbe parcialmente el overhead de estructura SIFU (${study.overheadEstructuraPct || 5}%).`;
    } else {
      valoracion = `🚨 CONTRATO EN DÉFICIT OPERATIVO: El servicio drena ${formatCurrency(Math.abs(m.beneficioBrutoAnual))} anuales en las condiciones actuales.`;
    }

    let factorRiesgo = '';
    if (m.bajasITActivas > 0) {
      const bajasNames = (study.trabajadores || []).filter(w => w.enBajaIT).map(w => `${w.titularNombre} (Supl: ${w.suplenteNombre || 'Sin suplente'})`).join('; ');
      factorRiesgo = `Se detectan en tiempo real <b>${m.bajasITActivas} Baja(s) IT activa(s)</b> en este cliente [${bajasNames}]. El absentismo (${study.riesgos.absentismoPct}%) representa un impacto directo del <b>${absImpactStr} %</b> sobre la facturación anual (${formatCurrency(m.costeAbsentismo)}/año).`;
    } else if (m.costeSustitucionVacaciones > m.costeAbsentismo) {
      const vacImpact = ((m.costeSustitucionVacaciones / (m.facturacionAnual || 1)) * 100).toFixed(1).replace('.', ',');
      factorRiesgo = `El centro se encuentra 100% cubierto sin Bajas IT activas hoy. El principal factor de coste variable es la cobertura de vacaciones (${study.riesgos.sustitucionVacacionesPct}%), con un impacto del ${vacImpact} % (${formatCurrency(m.costeSustitucionVacaciones)}/año).`;
    } else {
      factorRiesgo = `El principal factor de riesgo identificado es la provisión de absentismo (${study.riesgos.absentismoPct}%), que representa un impacto potencial del ${absImpactStr} % sobre el margen anual (${formatCurrency(m.costeAbsentismo)}/año).`;
    }

    let recomendacion = '';
    if (m.margenBrutoPct < 15) {
      recomendacion = `Acción recomendada para Dirección Operativa: 1) Revisar la tarifa actual (${precioHoraStr} €/h frente a un coste de equilibrio de ${costeHoraStr} €/h) hacia ${precioObjetivo15} €/h en la próxima prórroga; 2) Cubrir vacaciones y suplencias con operarios de bolsa negativa del módulo CMH (Coste marginal 0 €) o incorporar perfil CEE Bonificado (EPID, SS 11,5%).`;
    } else {
      recomendacion = `Acción recomendada: Blindar la indexación IPC (${study.riesgos.ipcPct}%) en los proyectos SAP [${proyList}] y mantener la auditoría diaria de presencia en gcalidad para consolidar los ${precioHoraStr} €/h de rendimiento.`;
    }

    return {
      parrafos: [
        `El estudio económico en tiempo real de <b>${study.cliente}</b> (Proyectos SAP: <code>${proyList}</code> · Responsable: <b>${study.responsable}</b>) presenta una facturación anual de <b>${factStr}</b> y un margen bruto operativo del <b>${margenStr} %</b> (${formatCurrency(m.beneficioBrutoAnual)}/año).`,
        valoracion,
        factorRiesgo,
        recomendacion
      ],
      textoPlano: `El cliente ${study.cliente} (${proyList}) presenta una facturación anual de ${factStr} y un margen bruto del ${margenStr} %.\n\n${valoracion}\n\n${factorRiesgo.replace(/<[^>]+>/g, '')}\n\n${recomendacion}`
    };
  }
  const generateAIExecutiveConclusion = generateExecutiveConclusion;

  function renderExecutiveConclusionSection(study, m) {
    if (!study) study = EconState.currentDraft || {};
    if (!m) m = calculateStudyMetrics(study);

    const conclusion = generateExecutiveConclusion(study, m);
    const semColor = m.semaforoNivel === 'verde' ? '#10b981' : (m.semaforoNivel === 'amarillo' ? '#f59e0b' : '#ef4444');
    const semBg = m.semaforoNivel === 'verde' ? '#ecfdf5' : (m.semaforoNivel === 'amarillo' ? '#fffbeb' : '#fef2f2');

    return `
      <div class="econ-card" id="econ-ai-conclusion-section" style="border-left: 5px solid ${semColor};">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:10px; background:${semBg}; color:${semColor}; display:flex; align-items:center; justify-content:center; font-size:20px;">
              📑
            </div>
            <div>
              <span style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.04em;">
                DICTAMEN ECONÓMICO OFICIAL
              </span>
              <h3 style="margin:2px 0 0; font-size:16px; font-weight:900; color:#0f172a;">
                Conclusión y Recomendaciones de Explotación · SIFU Barcelona (0801)
              </h3>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.copiarConclusion()" title="Copiar informe al portapapeles">
              📋 Copiar Dictamen
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.exportarPDFActual()">
              📄 Informe PDF
            </button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; font-size:13.5px; line-height:1.6; color:#334155;">
          ${conclusion.parrafos.map(p => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px;">
              ${p}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  const renderAIConclusionSection = renderExecutiveConclusionSection;

  function formatCurrency(val) {
    const n = Number(val) || 0;
    return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }

  function formatCurrencyDec(val) {
    const n = Number(val) || 0;
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================================
  // ESTILOS CSS EJECUTIVOS TIPO SaaS (STRIPE / HOLDED / FACTORIAL / CFO SUITE)
  // ============================================================================
  function ensureStylesInjected() {
    if (document.getElementById('sifu-econ-saas-styles-v4')) return;
    const style = document.createElement('style');
    style.id = 'sifu-econ-saas-styles-v4';
    style.textContent = `
      .econ-saas-shell {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        padding: 4px 0 40px;
        transition: all 0.25s ease;
      }
      .econ-saas-shell.econ-fullscreen-active {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 99995 !important;
        background: #f1f5f9 !important;
        overflow-y: auto !important;
        padding: 18px 28px 60px !important;
        box-sizing: border-box !important;
      }
      .econ-top-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1e3a8a 100%);
        color: #ffffff;
        border-radius: 16px;
        padding: 18px 22px;
        margin-bottom: 12px;
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.28);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
      }
      .econ-live-portfolio-bar {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-left: 5px solid #10b981;
        border-radius: 14px;
        padding: 12px 16px;
        margin-bottom: 14px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
      }
      .econ-client-strip {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 6px 2px 4px;
        scrollbar-width: thin;
      }
      .econ-client-pill {
        flex-shrink: 0;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 7px 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.16s ease;
        text-align: left;
      }
      .econ-client-pill:hover {
        border-color: #4f46e5;
        background: #eef2ff;
        transform: translateY(-1px);
      }
      .econ-client-pill.active {
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: #ffffff;
        border-color: #4f46e5;
        box-shadow: 0 4px 12px rgba(49, 46, 129, 0.25);
      }
      .econ-top-nav-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        background: rgba(255, 255, 255, 0.09);
        padding: 5px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .econ-nav-pill {
        background: transparent;
        color: #cbd5e1;
        border: none;
        padding: 8px 13px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.18s ease;
      }
      .econ-nav-pill:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
      .econ-nav-pill.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }
      .econ-btn-fullscreen {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff;
        border: none;
        padding: 9px 15px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .econ-btn-fullscreen:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
      }
      .econ-btn-fullscreen.is-full {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
      }
      .econ-workspace-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 420px;
        gap: 18px;
        align-items: start;
      }
      @media (max-width: 1120px) {
        .econ-workspace-grid {
          grid-template-columns: 1fr;
        }
      }
      .econ-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        margin-bottom: 16px;
      }
      .econ-sticky-sidebar {
        position: sticky;
        top: 14px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .econ-stepper {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .econ-step-btn {
        flex: 1;
        min-width: 135px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 11px;
        padding: 10px 12px;
        text-align: left;
        cursor: pointer;
        transition: all 0.18s ease;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .econ-step-btn:hover {
        border-color: #6366f1;
        background: #f8fafc;
      }
      .econ-step-btn.active {
        background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
        border: 2px solid #4f46e5;
        box-shadow: 0 3px 10px rgba(79, 70, 229, 0.12);
      }
      .econ-step-num {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: #f1f5f9;
        color: #475569;
        font-weight: 800;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .econ-step-btn.active .econ-step-num {
        background: #4f46e5;
        color: #ffffff;
      }
      .econ-form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 14px;
      }
      .econ-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .econ-field label {
        font-size: 11px;
        font-weight: 800;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .econ-input, .econ-select {
        padding: 9px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        background: #f8fafc;
        transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      }
      .econ-input:focus, .econ-select:focus {
        outline: none;
        border-color: #4f46e5;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
      }
      .econ-worker-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #4f46e5;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
        transition: box-shadow 0.15s ease;
      }
      .econ-worker-card.is-baja-it {
        border-left-color: #ef4444;
        background: #fffafa;
      }
      .econ-worker-card.is-cee {
        border-left-color: #10b981;
      }
      .econ-worker-card:hover {
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
      }
      .econ-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(195px, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }
      .econ-kpi-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 13px;
        padding: 16px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
      }
      .econ-slider-row {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 11px;
        padding: 12px 14px;
        margin-bottom: 10px;
      }
      .econ-range {
        width: 100%;
        accent-color: #4f46e5;
        cursor: pointer;
        margin-top: 6px;
      }
      .econ-sim-chip {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        padding: 7px 12px;
        border-radius: 99px;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .econ-sim-chip:hover {
        background: #e0e7ff;
        border-color: #818cf8;
        color: #312e81;
      }
      .econ-sim-chip.active {
        background: #4f46e5;
        border-color: #4f46e5;
        color: #ffffff;
      }
      .econ-btn {
        padding: 8px 13px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #1e293b;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .econ-btn:hover {
        background: #f1f5f9;
      }
      .econ-btn-primary {
        background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
        color: #ffffff;
        border: none;
        box-shadow: 0 3px 10px rgba(79, 70, 229, 0.25);
      }
      .econ-btn-primary:hover {
        background: linear-gradient(135deg, #4338ca 0%, #312e81 100%);
      }
      .econ-excel-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
      }
      .econ-excel-table th {
        background: #1e293b;
        color: #ffffff;
        text-align: left;
        padding: 9px 12px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .econ-excel-table td {
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      .econ-excel-table tr:nth-child(even) {
        background: #f8fafc;
      }
      @keyframes econPulseLive {
        0% { transform: scale(0.95); opacity: 0.85; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.95); opacity: 0.85; }
      }
      .econ-live-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #10b981;
        display: inline-block;
        animation: econPulseLive 1.8s infinite;
      }
      /* ESTILOS PREMIUM DEL ESCANDALLO EJECUTIVO TOP */
      .esc-top-wrapper {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .esc-kpi-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
        gap: 14px;
      }
      .esc-kpi-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px 20px;
        box-shadow: 0 4px 15px rgba(15, 23, 42, 0.04);
        position: relative;
        overflow: hidden;
        transition: transform 0.18s ease, box-shadow 0.18s ease;
      }
      .esc-kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }
      .esc-toolbar-pro {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        padding: 12px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
      }
      .esc-main-grid {
        display: grid;
        grid-template-columns: 1.12fr 0.88fr;
        gap: 18px;
        align-items: start;
      }
      @media (max-width: 1150px) {
        .esc-main-grid {
          grid-template-columns: 1fr;
        }
      }
      .esc-panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        margin-bottom: 18px;
      }
      .esc-panel-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
        color: #ffffff;
        padding: 13px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .esc-panel-header.green {
        background: linear-gradient(135deg, #064e3b 0%, #059669 100%);
      }
      .esc-panel-header.indigo {
        background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
      }
      .esc-panel-body {
        padding: 18px;
      }
      .esc-form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .esc-field-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 9px 12px;
        transition: all 0.15s ease;
      }
      .esc-field-box:focus-within {
        background: #ffffff;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
      }
      .esc-field-box.editable-highlight {
        background: #fefce8;
        border-color: #fde047;
      }
      .esc-field-box.editable-highlight:focus-within {
        background: #ffffff;
        border-color: #eab308;
        box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.18);
      }
      .esc-field-label {
        font-size: 10.5px;
        font-weight: 800;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .esc-field-input {
        width: 100%;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 13.5px;
        font-weight: 800;
        color: #0f172a;
        padding: 2px 0;
        outline: none;
      }
      .esc-table {
        width: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      .esc-table th {
        background: #f1f5f9;
        color: #475569;
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 10px 12px;
        text-align: left;
        border-bottom: 2px solid #cbd5e1;
      }
      .esc-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 13px;
        color: #1e293b;
        vertical-align: middle;
      }
      .esc-table tr:hover td {
        background: #f8fafc;
      }
      .esc-inline-input {
        width: 115px;
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fefce8;
        font-family: inherit;
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        text-align: right;
        transition: all 0.15s ease;
      }
      .esc-inline-input:focus {
        outline: none;
        background: #ffffff;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      }
      .esc-total-row td {
        background: #0f172a !important;
        color: #ffffff !important;
        font-weight: 900 !important;
        font-size: 13.5px !important;
        padding: 12px !important;
      }
      .esc-subtotal-row td {
        background: #eef2ff !important;
        color: #1e1b4b !important;
        font-weight: 800 !important;
        border-top: 1px solid #c7d2fe;
        border-bottom: 2px solid #818cf8;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // RENDER PRINCIPAL DEL MÓDULO 5. ESTUDIO ECONÓMICO (CARTERA REAL COSCOLIN)
  // ============================================================================
  window.renderEstudioEconomicoDashboardView = function () {
    ensureStylesInjected();

    const m = calculateStudyMetrics(EconState.currentDraft);

    return `
      <div class="econ-saas-shell ${EconState.isFullscreen ? 'econ-fullscreen-active' : ''}" id="econ-saas-root-container">
        <!-- CABECERA EJECUTIVA SaaS CON NAVEGACIÓN Y MODO PANTALLA COMPLETA -->
        <div class="econ-top-header" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #065f46 100%); border-bottom:2px solid #047857;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:48px; height:48px; border-radius:12px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); display:flex; align-items:center; justify-content:center; font-size:25px;">
              💎
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:10.5px; font-weight:900; background:#10b981; color:#ffffff; padding:3px 9px; border-radius:6px; text-transform:uppercase; letter-spacing:0.04em;">
                  5. ESTUDIO ECONÓMICO · ESCANDALLO PRO
                </span>
                <span style="font-size:11px; color:#d1fae5; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                  <span class="econ-live-dot"></span>
                  GRUPO SIFU BARCELONA (0801) · (${EconState.corporateStudies.length} Clientes / ${EconState.centerStudies.length} Centros SAP)
                </span>
              </div>
              <h2 style="margin:4px 0 0; font-size:19px; font-weight:900; letter-spacing:-0.02em;">
                ESTUDIO ECONÓMICO Y ESCANDALLO OFICIAL DE COSTES
              </h2>
            </div>
          </div>

          <!-- PÍLDORAS DE NAVEGACIÓN DE LA SECCIÓN -->
          <div class="econ-top-nav-pills">
            <button class="econ-nav-pill ${EconState.subView === 'excel_grid' ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setSubView('excel_grid')" title="Vista Principal Ejecutiva del Escandallo Oficial SIFU">
              <span>📗</span> Escandallo Oficial Pro
            </button>
            <button class="econ-nav-pill ${EconState.subView === 'wizard' ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setSubView('wizard')" title="Asistente guiado paso a paso y simulador">
              <span>📋</span> Editor Guiado + Simulador
            </button>
            <button class="econ-nav-pill ${EconState.subView === 'dashboard' ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setSubView('dashboard')" title="Ver cuadro de mando y métricas globales">
              <span>📈</span> Cuadro de Mando
            </button>
            <button class="econ-nav-pill ${EconState.subView === 'historial' ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setSubView('historial')" title="Explorar cartera real de clientes">
              <span>🗂️</span> Cartera Real (${EconState.studies.length})
            </button>
            <button class="econ-nav-pill ${EconState.subView === 'comparativa' ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setSubView('comparativa')" title="Comparar dos ofertas o escenarios">
              <span>⚖️</span> Comparativa
            </button>
          </div>

          <!-- ACCIONES RÁPIDAS + SINCRONIZACIÓN EN VIVO + PANTALLA COMPLETA -->
          <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
            <button class="econ-btn" style="background:rgba(16,185,129,0.22); color:#a7f3d0; border-color:rgba(16,185,129,0.45);" onclick="window.EstudioEconomicoModule.sincronizarCarteraEnVivo()" title="Sincronizar en tiempo real todos los clientes de Alejandro Coscolin desde SAP HO, Master Data y CMH">
              <span>${EconState.isSyncingLive ? '⏳' : '🔄'}</span>
              <span>${EconState.isSyncingLive ? 'Sincronizando...' : 'Sync Tiempo Real'}</span>
            </button>
            <button class="econ-btn" style="background:rgba(255,255,255,0.12); color:#ffffff; border-color:rgba(255,255,255,0.2);" onclick="window.EstudioEconomicoModule.nuevoEstudioEnBlanco()" title="Crear un nuevo estudio de licitación desde cero">
              <span>➕</span> Nuevo
            </button>
            <button class="econ-btn" style="background:rgba(255,255,255,0.12); color:#ffffff; border-color:rgba(255,255,255,0.2);" onclick="window.EstudioEconomicoModule.exportarPDFActual()" title="Exportar informe ejecutivo en PDF listo para Dirección o Cliente">
              <span>📄</span> PDF
            </button>
            <button class="econ-btn" style="background:rgba(255,255,255,0.12); color:#ffffff; border-color:rgba(255,255,255,0.2);" onclick="window.EstudioEconomicoModule.exportarExcelActual()" title="Descargar libro Excel (.xlsx) con el escandallo completo">
              <span>📊</span> Excel (.xlsx)
            </button>
            <button class="econ-btn-fullscreen ${EconState.isFullscreen ? 'is-full' : ''}" onclick="window.EstudioEconomicoModule.toggleFullscreen()" title="Activar/Desactivar Modo Pantalla Completa inmersivo como en Excel">
              <span>${EconState.isFullscreen ? '🗗' : '⛶'}</span>
              <span>${EconState.isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}</span>
            </button>
          </div>
        </div>

        <!-- BARRA DE CARTERA REAL EN VIVO DE ALEJANDRO COSCOLIN (SELECTOR DIRECTO 1 CLIC) -->
        ${renderLivePortfolioStrip()}

        <!-- CONTENIDO DINÁMICO SEGÚN LA SUB-VISTA SELECCIONADA -->
        <div id="econ-subview-body">
          ${renderActiveSubView(m)}
        </div>
      </div>
    `;
  };

  function renderLivePortfolioStrip() {
    const activeId = EconState.currentDraft ? EconState.currentDraft.id : '';
    const totalFactCartera = EconState.corporateStudies.reduce((acc, s) => acc + calculateStudyMetrics(s).facturacionAnual, 0);
    const totalBenCartera = EconState.corporateStudies.reduce((acc, s) => acc + calculateStudyMetrics(s).beneficioBrutoAnual, 0);
    const margenGlobal = totalFactCartera > 0 ? (totalBenCartera / totalFactCartera) * 100 : 0;

    return `
      <div class="econ-live-portfolio-bar">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-size:11px; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.03em;">
              👔 CARTERA REAL SINCRONIZADA · ${RESPONSABLE_OFICIAL}
            </span>
            <span style="font-size:11px; font-weight:800; background:#dcfce7; color:#166534; padding:2px 9px; border-radius:99px;">
              Facturación Cartera: ${formatCurrency(totalFactCartera)}/año · Margen Global: ${margenGlobal.toFixed(1)}%
            </span>
            <span style="font-size:10.5px; color:#64748b; font-weight:600;">
              Último enlace SAP HO / Master: <b>${EconState.lastSyncTimestamp}</b> (${EconState.lastSyncClock})
            </span>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-size:11px; font-weight:800; color:#1e40af;">👔 Gestor Barcelona:</span>
              <select class="econ-select" style="padding:4px 8px; font-size:11px; font-weight:700; border-radius:6px; border:1px solid #93c5fd; background:#f0f9ff; max-width:260px;" onchange="window.EstudioEconomicoModule.setGestorFilter(this.value)">
                ${GESTORES_BCN_ECON.map(g => `<option value="${g.id}" ${EconState.gestorFilter === g.id ? 'selected' : ''}>${g.nombre}</option>`).join('')}
              </select>
            </div>
            <button class="econ-btn ${EconState.portfolioGranularity === 'corporativo' ? 'econ-btn-primary' : ''}" style="padding:5px 10px; font-size:11px;" onclick="window.EstudioEconomicoModule.setPortfolioGranularity('corporativo')">
              🏢 21 Clientes Corporativos
            </button>
            <button class="econ-btn ${EconState.portfolioGranularity === 'centros' ? 'econ-btn-primary' : ''}" style="padding:5px 10px; font-size:11px;" onclick="window.EstudioEconomicoModule.setPortfolioGranularity('centros')">
              📍 58 Centros / Proyectos SAP (SVO/PROY)
            </button>
          </div>
        </div>

        <div class="econ-client-strip">
          ${EconState.studies.map(s => {
            const ms = calculateStudyMetrics(s);
            const isAct = s.id === activeId;
            const dot = ms.semaforoNivel === 'verde' ? '🟢' : (ms.semaforoNivel === 'amarillo' ? '🟡' : '🔴');
            const shortClient = s.cliente.length > 28 ? s.cliente.slice(0, 28) + '…' : s.cliente;
            return `
              <button class="econ-client-pill ${isAct ? 'active' : ''}" onclick="window.EstudioEconomicoModule.cargarEstudio('${s.id}')" title="${escapeHtml(s.cliente)} — ${escapeHtml(s.servicio)}">
                <div>
                  <div style="font-size:11.5px; font-weight:800; white-space:nowrap;">
                    ${dot} ${escapeHtml(shortClient)}
                  </div>
                  <div style="font-size:10px; opacity:0.82; white-space:nowrap;">
                    ${formatCurrency(ms.facturacionAnual)}/a · <b>${ms.margenBrutoPct.toFixed(1)}%</b> · 👥${ms.numTrabajadores}
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // HOJA ESCANDALLO TIPO EXCEL CLÁSICO OFICIAL (GRUPO SIFU)
  // ============================================================================
  function renderExcelEscandalloGridView(draft, m) {
    if (!draft) draft = EconState.currentDraft || {};
    if (!m) m = calculateStudyMetrics(draft);

    const workers = Array.isArray(draft.trabajadores) ? draft.trabajadores : [];
    const trabajadoresCEE = workers.filter(w => w.esCEE).length;
    const op = draft.costesOperativos || {};
    const riesgos = draft.riesgos || {};
    const proyStr = Array.isArray(draft.proyectosSAP) && draft.proyectosSAP.length
      ? draft.proyectosSAP.join(' · ')
      : 'SVO-BARCELONA';

    const pctMOD = m.facturacionAnual > 0 ? ((m.costePersonalDirecto + m.costeRiesgosYProvisiones) / m.facturacionAnual) * 100 : 0;
    const pctOp = m.facturacionAnual > 0 ? (m.costeOperativoTotal / m.facturacionAnual) * 100 : 0;
    const totalMODConProvisiones = m.costePersonalDirecto + m.costeRiesgosYProvisiones;
    const ftes = m.totalHorasAnuales > 0 ? (m.totalHorasAnuales / 1780).toFixed(2) : '0.00';
    const ebitdaPct = Number(m.ebitdaNetoPct) || 0;
    const costeEstSifu = Number(m.costeEstructuraSIFU) || 0;

    const semColor = m.semaforoNivel === 'verde' ? '#10b981' : (m.semaforoNivel === 'amarillo' ? '#f59e0b' : '#ef4444');
    const semBg = m.semaforoNivel === 'verde' ? '#ecfdf5' : (m.semaforoNivel === 'amarillo' ? '#fffbeb' : '#fef2f2');
    const semBorder = m.semaforoNivel === 'verde' ? '#a7f3d0' : (m.semaforoNivel === 'amarillo' ? '#fde68a' : '#fecaca');

    return `
      <div class="esc-top-wrapper">
        <!-- 1. BARRA DE CONTROL Y ACCIONES DIRECTAS EN 1 CLIC -->
        <div class="esc-toolbar-pro">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="background:#0f172a; color:#ffffff; font-size:11px; font-weight:900; padding:5px 10px; border-radius:8px; letter-spacing:0.03em;">
              ${escapeHtml(draft.codigo || 'ESC-2026')}
            </span>
            <select class="econ-select" style="font-size:12.5px; font-weight:800; padding:7px 12px; min-width:290px; background:#f8fafc; border-color:#94a3b8;" onchange="if(this.value!==''){window.EstudioEconomicoModule.cargarEstudio(this.value);}">
              ${EconState.studies.map(s => `
                <option value="${s.id}" ${s.id === draft.id ? 'selected' : ''}>
                  🏢 ${escapeHtml(s.cliente)} — ${escapeHtml(s.servicio.slice(0, 32))}
                </option>
              `).join('')}
            </select>
            <span style="font-size:11.5px; font-weight:800; color:#0369a1; background:#e0f2fe; padding:5px 10px; border-radius:8px;">
              SAP: ${escapeHtml(proyStr)}
            </span>
            <span style="font-size:11.5px; font-weight:800; color:${semColor}; background:${semBg}; border:1px solid ${semBorder}; padding:5px 11px; border-radius:8px;">
              ${escapeHtml(m.semaforoLabel || 'Rentabilidad Calculada')}
            </span>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="econ-btn" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(15)" title="Calcula y aplica automáticamente la facturación necesaria para lograr un 15% de Margen Bruto">
              🎯 Ajustar a Margen 15%
            </button>
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.autoEstimarCostesOperativos()" title="Recalcular materiales, vestuario y maquinaria según baremo estándar SIFU">
              ⚡ Auto-Baremo Costes
            </button>
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.restaurarDatosSAPOriginales()" title="Restaurar los datos originales de SAP">
              ♻️ Restaurar SAP
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.guardarEstudioActual()">
              💾 Guardar Estudio
            </button>
          </div>
        </div>

        <!-- 2. TARJETAS EJECUTIVAS DE RESUMEN EN TIEMPO REAL (4 SUPER-KPIs) -->
        <div class="esc-kpi-strip">
          <!-- KPI 1: FACTURACIÓN -->
          <div class="esc-kpi-card" style="border-top:4px solid #2563eb;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">💶 Presupuesto / Facturación Anual</span>
              <span style="font-size:11px; font-weight:800; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:99px;">100% Venta</span>
            </div>
            <div style="font-size:26px; font-weight:900; color:#0f172a; letter-spacing:-0.02em;">
              ${formatCurrency(m.facturacionAnual)}
            </div>
            <div style="margin-top:6px; font-size:12px; color:#475569; font-weight:700; display:flex; justify-content:space-between;">
              <span>Mensual: <b style="color:#1e40af;">${formatCurrency(m.facturacionMensual)}/mes</b></span>
              <span>Tarifa: <b>${formatCurrencyDec(m.precioHora)}/h</b></span>
            </div>
          </div>

          <!-- KPI 2: M.O.D. PERSONAL -->
          <div class="esc-kpi-card" style="border-top:4px solid #4f46e5;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">👥 Total M.O.D. (Personal + Prov.)</span>
              <span style="font-size:11px; font-weight:800; background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:99px;">${pctMOD.toFixed(1)}% s/venta</span>
            </div>
            <div style="font-size:26px; font-weight:900; color:#1e1b4b; letter-spacing:-0.02em;">
              ${formatCurrency(totalMODConProvisiones)}
            </div>
            <div style="margin-top:6px; font-size:12px; color:#475569; font-weight:700; display:flex; justify-content:space-between;">
              <span>Plantilla: <b>${m.numTrabajadores} operarios (${ftes} FTE)</b></span>
              <span><b>${Math.round(m.totalHorasAnuales).toLocaleString('es-ES')} h/año</b></span>
            </div>
          </div>

          <!-- KPI 3: COSTES OPERATIVOS -->
          <div class="esc-kpi-card" style="border-top:4px solid #f59e0b;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">🧰 Costes Operativos Directos</span>
              <span style="font-size:11px; font-weight:800; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:99px;">${pctOp.toFixed(1)}% s/venta</span>
            </div>
            <div style="font-size:26px; font-weight:900; color:#78350f; letter-spacing:-0.02em;">
              ${formatCurrency(m.costeOperativoTotal)}
            </div>
            <div style="margin-top:6px; font-size:12px; color:#475569; font-weight:700; display:flex; justify-content:space-between;">
              <span>Mensual: <b>${formatCurrency(m.costeOperativoTotal / 12)}/mes</b></span>
              <span>Coste Total/h: <b>${formatCurrencyDec(m.costeHora)}/h</b></span>
            </div>
          </div>

          <!-- KPI 4: MARGEN BRUTO & EBITDA -->
          <div class="esc-kpi-card" style="border-top:4px solid ${semColor}; background:${semBg};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:900; color:#0f172a; text-transform:uppercase;">📈 Margen Bruto de Explotación</span>
              <span style="font-size:12px; font-weight:900; background:${semColor}; color:#ffffff; padding:2px 10px; border-radius:99px;">
                ${m.margenBrutoPct.toFixed(2)} %
              </span>
            </div>
            <div style="font-size:26px; font-weight:900; color:${m.beneficioBrutoAnual >= 0 ? '#065f46' : '#991b1b'}; letter-spacing:-0.02em;">
              ${m.beneficioBrutoAnual >= 0 ? '+' : ''}${formatCurrency(m.beneficioBrutoAnual)}
            </div>
            <div style="margin-top:6px; font-size:12px; color:#334155; font-weight:800; display:flex; justify-content:space-between;">
              <span>Mensual: <b>${formatCurrency(m.beneficioBrutoMensual)}/mes</b></span>
              <span>EBITDA Neto: <b>${formatCurrency(m.ebitdaNetoAnual)} (${ebitdaPct.toFixed(1)}%)</b></span>
            </div>
          </div>
        </div>

        <!-- 3. CUERPO CENTRAL DEL ESCANDALLO EN 2 COLUMNAS EJECUTIVAS -->
        <div class="esc-main-grid">
          <!-- COLUMNA IZQUIERDA: DATOS DE OFERTA + M.O.D. + COSTES OPERATIVOS -->
          <div>
            <!-- BLOQUE A: DATOS DE IDENTIFICACIÓN DE LA OFERTA -->
            <div class="esc-panel">
              <div class="esc-panel-header">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">🏢</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    1. Datos de Identificación del Servicio y Licitación
                  </span>
                </div>
                <span style="font-size:11px; background:rgba(255,255,255,0.15); padding:3px 9px; border-radius:6px;">
                  Delegación 0801 Barcelona · SIFU_C018
                </span>
              </div>
              <div class="esc-panel-body">
                <div class="esc-form-grid">
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Cliente / Razón Social</span><span>✏️</span></div>
                    <input class="esc-field-input" value="${escapeHtml(draft.cliente || '')}" onchange="window.EstudioEconomicoModule.updateField('cliente', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Servicio / Lote Contratado</span><span>✏️</span></div>
                    <input class="esc-field-input" value="${escapeHtml(draft.servicio || '')}" onchange="window.EstudioEconomicoModule.updateField('servicio', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Dirección / Centro</span><span>✏️</span></div>
                    <input class="esc-field-input" value="${escapeHtml(draft.centro || '')}" onchange="window.EstudioEconomicoModule.updateField('centro', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Nº Oferta / Código</span><span>✏️</span></div>
                    <input class="esc-field-input" value="${escapeHtml(draft.codigo || 'ESC-GIR-001')}" onchange="window.EstudioEconomicoModule.updateField('codigo', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Modalidad Facturación</span><span>✏️</span></div>
                    <select class="esc-field-input" style="cursor:pointer;" onchange="window.EstudioEconomicoModule.updateField('tipoFacturacion', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      ${['Cuota Fija Mensual', 'Bolsa de Horas Anualizada', 'Precio por Hora Ejecutada', 'Licitación Pública Anual'].map(tf => `
                        <option value="${tf}" ${draft.tipoFacturacion === tf ? 'selected' : ''}>${tf}</option>
                      `).join('')}
                    </select>
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Tipo de Servicio</span><span>✏️</span></div>
                    <select class="esc-field-input" style="cursor:pointer;" onchange="window.EstudioEconomicoModule.updateField('tipoContrato', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      ${['Limpieza Convencional', 'Limpieza Industrial / Técnica', 'Servicios Auxiliares / Conserjería', 'Jardinería y Exteriores', 'Mantenimiento Integral', 'Suministros / Higiene'].map(tc => `
                        <option value="${tc}" ${draft.tipoContrato === tc ? 'selected' : ''}>${tc}</option>
                      `).join('')}
                    </select>
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Fecha Inicio Contrato</span><span>📅</span></div>
                    <input type="date" class="esc-field-input" value="${escapeHtml(draft.fechaInicio || '2026-01-01')}" onchange="window.EstudioEconomicoModule.updateField('fechaInicio', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight">
                    <div class="esc-field-label"><span>Duración Contrato (Meses)</span><span>⏱️</span></div>
                    <input type="number" min="1" max="120" class="esc-field-input" value="${Number(draft.duracionMeses) || 12}" onchange="window.EstudioEconomicoModule.updateField('duracionMeses', Number(this.value)||12); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                </div>
              </div>
            </div>

            <!-- BLOQUE B: MANO DE OBRA DIRECTA (M.O.D.) Y PROVISIONES DE CONVENIO -->
            <div class="esc-panel">
              <div class="esc-panel-header indigo">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">👥</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    2. Mano de Obra Directa (M.O.D.) · Convenio y Provisiones
                  </span>
                </div>
                <span style="font-size:12px; font-weight:800; background:rgba(255,255,255,0.18); padding:3px 10px; border-radius:6px;">
                  Total M.O.D.: ${formatCurrency(totalMODConProvisiones)}/año
                </span>
              </div>
              <div class="esc-panel-body" style="padding:0;">
                <table class="esc-table">
                  <thead>
                    <tr>
                      <th>Concepto Salarial / Laboral</th>
                      <th style="text-align:center;">Parámetro / Ratio</th>
                      <th style="text-align:right;">Coste Mensual</th>
                      <th style="text-align:right;">Coste Anual (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div style="font-weight:800; color:#0f172a;">Coste Salarial Directo + Seg. Social</div>
                        <div style="font-size:11px; color:#64748b;">Plantilla activa (${m.numTrabajadores} operarios · ${trabajadoresCEE} CEE bonificados / ${m.numTrabajadores - trabajadoresCEE} ordinarios)</div>
                      </td>
                      <td style="text-align:center;">
                        <span style="background:#e0e7ff; color:#3730a3; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">
                          Convenio Vigente
                        </span>
                      </td>
                      <td style="text-align:right; font-weight:700; color:#475569;">${formatCurrencyDec(m.costePersonalDirecto / 12)}</td>
                      <td style="text-align:right; font-weight:900; color:#0f172a; font-size:14px;">${formatCurrencyDec(m.costePersonalDirecto)}</td>
                    </tr>

                    <tr>
                      <td>
                        <div style="font-weight:800; color:#0f172a;">Suplencias y Sustitución de Vacaciones</div>
                        <div style="font-size:11px; color:#64748b;">Cobertura de vacaciones reglamentarias (Convenio CEE / Aplic.)</div>
                      </td>
                      <td style="text-align:center;">
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                          <input type="number" step="1" min="0" max="100" class="esc-inline-input" style="width:75px; text-align:center;" value="${Number(riesgos.sustitucionVacacionesPct) || 0}" onchange="window.EstudioEconomicoModule.updateRiesgo('sustitucionVacacionesPct', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                          <span style="font-weight:800; font-size:12px;">%</span>
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:700; color:#475569;">${formatCurrencyDec(m.costeSustitucionVacaciones / 12)}</td>
                      <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrencyDec(m.costeSustitucionVacaciones)}</td>
                    </tr>

                    <tr>
                      <td>
                        <div style="font-weight:800; color:#0f172a;">Provisión por Absentismo Laboral / Bajas IT</div>
                        <div style="font-size:11px; color:#64748b;">Reserva técnica para cobertura de bajas e incidencias</div>
                      </td>
                      <td style="text-align:center;">
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                          <input type="number" step="0.1" min="0" max="35" class="esc-inline-input" style="width:75px; text-align:center;" value="${Number(riesgos.absentismoPct) || 0}" onchange="window.EstudioEconomicoModule.updateRiesgo('absentismoPct', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                          <span style="font-weight:800; font-size:12px;">%</span>
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:700; color:#475569;">${formatCurrencyDec(m.costeAbsentismo / 12)}</td>
                      <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrencyDec(m.costeAbsentismo)}</td>
                    </tr>

                    <tr>
                      <td>
                        <div style="font-weight:800; color:#0f172a;">Actualización Tablas Convenio / Incremento Salarial</div>
                        <div style="font-size:11px; color:#64748b;">Previsión de subida salarial interanual</div>
                      </td>
                      <td style="text-align:center;">
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                          <input type="number" step="0.5" min="0" max="20" class="esc-inline-input" style="width:75px; text-align:center;" value="${Number(riesgos.incrementoConvenioPct) || 0}" onchange="window.EstudioEconomicoModule.updateRiesgo('incrementoConvenioPct', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                          <span style="font-weight:800; font-size:12px;">%</span>
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:700; color:#475569;">${formatCurrencyDec(m.costeIncrementoConvenio / 12)}</td>
                      <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrencyDec(m.costeIncrementoConvenio)}</td>
                    </tr>

                    <tr>
                      <td>
                        <div style="font-weight:800; color:#0f172a;">Provisión por Desvinculaciones / Finiquitos</div>
                        <div style="font-size:11px; color:#64748b;">Nº estimado de rotaciones o extinciones anuales</div>
                      </td>
                      <td style="text-align:center;">
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                          <input type="number" step="1" min="0" max="30" class="esc-inline-input" style="width:75px; text-align:center;" value="${Number(riesgos.desvinculacionesNum) || 0}" onchange="window.EstudioEconomicoModule.updateRiesgo('desvinculacionesNum', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                          <span style="font-weight:800; font-size:11px;">op.</span>
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:700; color:#475569;">${formatCurrencyDec(m.costeDesvinculaciones / 12)}</td>
                      <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrencyDec(m.costeDesvinculaciones)}</td>
                    </tr>

                    <tr class="esc-subtotal-row">
                      <td>TOTAL MANO DE OBRA DIRECTA (M.O.D. + PROVISIONES)</td>
                      <td style="text-align:center;">${pctMOD.toFixed(1)}% s/venta</td>
                      <td style="text-align:right;">${formatCurrencyDec(totalMODConProvisiones / 12)}</td>
                      <td style="text-align:right; font-size:14.5px;">${formatCurrencyDec(totalMODConProvisiones)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- BLOQUE C: COSTES OPERATIVOS DIRECTOS (EDITABLES EN VIVO) -->
            <div class="esc-panel" style="margin-bottom:0;">
              <div class="esc-panel-header">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">🧰</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    3. Costes Operativos Directos (Materiales, Equipos y Suministros)
                  </span>
                </div>
                <span style="font-size:12px; font-weight:800; background:rgba(255,255,255,0.18); padding:3px 10px; border-radius:6px;">
                  Total Operativo: ${formatCurrency(m.costeOperativoTotal)}/año
                </span>
              </div>
              <div class="esc-panel-body" style="padding:0;">
                <table class="esc-table">
                  <thead>
                    <tr>
                      <th>Partida de Gasto Operativo</th>
                      <th style="text-align:center;">% s/Venta</th>
                      <th style="text-align:right;">Mensual (€/mes)</th>
                      <th style="text-align:right;">Importe Anual Editable (€/año)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[
                      { key: 'materiales', icon: '🧴', label: 'Materiales y Productos Químicos', sub: 'Útiles de limpieza, carros, mopas y químicos' },
                      { key: 'consumibles', icon: '🧻', label: 'Consumibles Higiénicos y Celulosa', sub: 'Papel higiénico, secamanos, jabón y bolsas' },
                      { key: 'equipos', icon: '🚜', label: 'Maquinaria y Equipos (Amortización / Renting)', sub: 'Fregadoras, aspiradores, rotativas y mantenimiento' },
                      { key: 'vestuario', icon: '🦺', label: 'Vestuario Laboral y Uniformidad', sub: 'Dotación anual reglamentaria para la plantilla' },
                      { key: 'epis', icon: '🧤', label: 'EPIs, Seguridad y Prevención PRL', sub: 'Equipos de protección individual y seguridad' },
                      { key: 'reconocimientos', icon: '🩺', label: 'Revisiones Médicas (Vigilancia Salud)', sub: 'Reconocimientos médicos anuales obligatorios' },
                      { key: 'vehiculos', icon: '🚐', label: 'Vehículos, Combustible y Desplazamientos', sub: 'Rutas de supervisión, furgoneta y kilometraje' },
                      { key: 'subcontratas', icon: '🤝', label: 'Subcontrataciones y Servicios Especiales', sub: 'Trabajos verticales, DDD, contenedores higiénicos' },
                      { key: 'otros', icon: '📢', label: 'Publicidad, Formación, Seguros y Otros', sub: 'Gastos generales directos imputables al centro' }
                    ].map(item => {
                      const valAnual = Number(op[item.key]) || 0;
                      const pctItem = m.facturacionAnual > 0 ? (valAnual / m.facturacionAnual) * 100 : 0;
                      return `
                        <tr>
                          <td>
                            <div style="font-weight:800; color:#0f172a;">${item.icon} ${item.label}</div>
                            <div style="font-size:11px; color:#64748b;">${item.sub}</div>
                          </td>
                          <td style="text-align:center; font-weight:700; color:#64748b;">
                            ${pctItem.toFixed(2)} %
                          </td>
                          <td style="text-align:right; font-weight:700; color:#475569;">
                            ${formatCurrencyDec(valAnual / 12)}
                          </td>
                          <td style="text-align:right;">
                            <input type="number" step="50" min="0" class="esc-inline-input" value="${Math.round(valAnual * 100) / 100}" onchange="window.EstudioEconomicoModule.updateCosteOperativo('${item.key}', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="esc-subtotal-row">
                      <td>TOTAL COSTES OPERATIVOS DIRECTOS</td>
                      <td style="text-align:center;">${pctOp.toFixed(2)} %</td>
                      <td style="text-align:right;">${formatCurrencyDec(m.costeOperativoTotal / 12)}</td>
                      <td style="text-align:right; font-size:14.5px;">${formatCurrencyDec(m.costeOperativoTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- COLUMNA DERECHA: PRESUPUESTO DE VENTA + DIMENSIONAMIENTO + CASCADA P&L -->
          <div>
            <!-- BLOQUE D: RESUMEN ECONÓMICO DE FACTURACIÓN Y PRECIOS -->
            <div class="esc-panel">
              <div class="esc-panel-header green">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">💶</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    4. Presupuesto de Venta y Tarifas de Facturación
                  </span>
                </div>
                <span style="font-size:11px; font-weight:800; background:rgba(255,255,255,0.2); padding:3px 9px; border-radius:6px;">
                  Edición en Tiempo Real
                </span>
              </div>
              <div class="esc-panel-body">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                  <div class="esc-field-box editable-highlight" style="border:2px solid #10b981;">
                    <div class="esc-field-label"><span style="color:#065f46;">Presupuesto Anual (€/Año)</span><span>✏️</span></div>
                    <input type="number" step="100" class="esc-field-input" style="font-size:18px; color:#065f46;" value="${Math.round(m.facturacionAnual * 100) / 100}" onchange="window.EstudioEconomicoModule.updateFacturacion('anual', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                  <div class="esc-field-box editable-highlight" style="border:2px solid #3b82f6;">
                    <div class="esc-field-label"><span style="color:#1e40af;">Presupuesto Mensual (€/Mes)</span><span>✏️</span></div>
                    <input type="number" step="50" class="esc-field-input" style="font-size:18px; color:#1e40af;" value="${Math.round(m.facturacionMensual * 100) / 100}" onchange="window.EstudioEconomicoModule.updateFacturacion('mensual', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                </div>

                <!-- CALCULADORA RÁPIDA DE PRECIO OBJETIVO -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; margin-bottom:12px;">
                  <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:8px;">
                    ⚡ Ajuste Rápido de Tarifa según Margen Bruto Objetivo SIFU:
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="econ-btn" style="flex:1; justify-content:center; font-size:11.5px;" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(12)">
                      Margen 12%
                    </button>
                    <button class="econ-btn" style="flex:1; justify-content:center; font-size:11.5px; background:#ecfdf5; color:#065f46; border-color:#6ee7b7;" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(15)">
                      ⭐ Objetivo 15%
                    </button>
                    <button class="econ-btn" style="flex:1; justify-content:center; font-size:11.5px;" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(18)">
                      Margen 18%
                    </button>
                    <button class="econ-btn" style="flex:1; justify-content:center; font-size:11.5px;" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(20)">
                      Margen 20%
                    </button>
                  </div>
                </div>

                <!-- RATIOS UNITARIOS POR HORA Y CONTRATO -->
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                  <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:10px; font-weight:800; color:#1e40af; text-transform:uppercase;">Precio Venta / Hora</div>
                    <div style="font-size:16px; font-weight:900; color:#1e3a8a; margin-top:3px;">${formatCurrencyDec(m.precioHora)}/h</div>
                  </div>
                  <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:10px; font-weight:800; color:#991b1b; text-transform:uppercase;">Coste Real / Hora</div>
                    <div style="font-size:16px; font-weight:900; color:#7f1d1d; margin-top:3px;">${formatCurrencyDec(m.costeHora)}/h</div>
                  </div>
                  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:10px; font-weight:800; color:#166534; text-transform:uppercase;">Beneficio / Hora</div>
                    <div style="font-size:16px; font-weight:900; color:#14532d; margin-top:3px;">${formatCurrencyDec(m.precioHora - m.costeHora)}/h</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- BLOQUE E: HORAS ANUALES REALES Y DIMENSIONAMIENTO DE PLANTILLA -->
            <div class="esc-panel">
              <div class="esc-panel-header">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">⏱️</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    5. Cuadro de Horas Anuales y Dimensionamiento (FTEs)
                  </span>
                </div>
              </div>
              <div class="esc-panel-body" style="padding:0;">
                <table class="esc-table">
                  <tbody>
                    <tr>
                      <td style="font-weight:700;">Horas Año Reales (Convenio de Aplicación)</td>
                      <td style="text-align:right; font-weight:900; font-size:14px; color:#0f172a;">
                        ${Math.round(m.totalHorasAnuales).toLocaleString('es-ES')} h/año
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight:700;">Promedio Horas Mensuales de Servicio</td>
                      <td style="text-align:right; font-weight:800; color:#334155;">
                        ${Math.round(m.totalHorasMensuales).toLocaleString('es-ES')} h/mes
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight:700;">Nº Total de Operarios Asignados</td>
                      <td style="text-align:right; font-weight:900; color:#1e40af;">
                        ${m.numTrabajadores} personas (${trabajadoresCEE} CEE / ${m.numTrabajadores - trabajadoresCEE} Ord.)
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight:700;">FTEs Equivalentes a Jornada Completa (1.780 h)</td>
                      <td style="text-align:right;">
                        <span style="background:#fee2e2; color:#991b1b; font-weight:900; padding:3px 10px; border-radius:6px;">
                          ${ftes} FTEs
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight:700;">SMI Promedio Referencia Convenio</td>
                      <td style="text-align:right; font-weight:800; color:#c2410c;">
                        17.360,00 € / año
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- BLOQUE F: CUENTA DE EXPLOTACIÓN OFICIAL (P&L CASCADA DE CIERRE) -->
            <div class="esc-panel" style="margin-bottom:0;">
              <div class="esc-panel-header" style="background:linear-gradient(135deg, #0f172a 0%, #312e81 100%);">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">📊</span>
                  <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                    6. Cuenta de Explotación y Cierre del Escandallo
                  </span>
                </div>
              </div>
              <div class="esc-panel-body">
                <table class="esc-table" style="margin-bottom:14px;">
                  <tbody>
                    <tr>
                      <td style="font-weight:800; color:#0f172a;">(+) Facturación Neta Anual</td>
                      <td style="text-align:right; font-weight:700; color:#64748b;">100,0 %</td>
                      <td style="text-align:right; font-weight:900; color:#0f172a;">${formatCurrencyDec(m.facturacionAnual)}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:700; color:#334155;">(-) Mano de Obra Directa (M.O.D. Base)</td>
                      <td style="text-align:right; color:#64748b;">${m.facturacionAnual > 0 ? ((m.costePersonalDirecto / m.facturacionAnual) * 100).toFixed(1) : '0.0'} %</td>
                      <td style="text-align:right; font-weight:700; color:#dc2626;">-${formatCurrencyDec(m.costePersonalDirecto)}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:700; color:#334155;">(-) Provisiones (Vacaciones, Absentismo, Convenio)</td>
                      <td style="text-align:right; color:#64748b;">${m.facturacionAnual > 0 ? ((m.costeRiesgosYProvisiones / m.facturacionAnual) * 100).toFixed(1) : '0.0'} %</td>
                      <td style="text-align:right; font-weight:700; color:#dc2626;">-${formatCurrencyDec(m.costeRiesgosYProvisiones)}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:700; color:#334155;">(-) Costes Operativos Directos (Mat., Equipos, EPIs)</td>
                      <td style="text-align:right; color:#64748b;">${pctOp.toFixed(1)} %</td>
                      <td style="text-align:right; font-weight:700; color:#dc2626;">-${formatCurrencyDec(m.costeOperativoTotal)}</td>
                    </tr>
                    <tr class="esc-total-row">
                      <td>(=) TOTAL COSTES DIRECTOS DEL SERVICIO</td>
                      <td style="text-align:right;">${m.facturacionAnual > 0 ? ((m.costesTotales / m.facturacionAnual) * 100).toFixed(1) : '0.0'} %</td>
                      <td style="text-align:right;">${formatCurrencyDec(m.costesTotales)}</td>
                    </tr>
                  </tbody>
                </table>

                <!-- CAJA RESUMEN DE MARGEN BRUTO -->
                <div style="background:${semBg}; border:2px solid ${semColor}; border-radius:14px; padding:16px; margin-bottom:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                      <div style="font-size:11px; font-weight:900; color:#0f172a; text-transform:uppercase;">
                        MARGEN BRUTO DE CONTRIBUCIÓN (DIRECTO)
                      </div>
                      <div style="font-size:24px; font-weight:900; color:${m.beneficioBrutoAnual >= 0 ? '#065f46' : '#991b1b'}; margin-top:2px;">
                        ${m.beneficioBrutoAnual >= 0 ? '+' : ''}${formatCurrencyDec(m.beneficioBrutoAnual)} / año
                      </div>
                      <div style="font-size:12px; font-weight:700; color:#334155;">
                        Resultado Mensual: <b>${formatCurrencyDec(m.beneficioBrutoMensual)} / mes</b>
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:28px; font-weight:900; color:${semColor};">
                        ${m.margenBrutoPct.toFixed(2)} %
                      </div>
                      <div style="font-size:11px; font-weight:800; color:#475569;">
                        Objetivo SIFU: ≥ 15,00 %
                      </div>
                    </div>
                  </div>
                </div>

                <!-- OVERHEAD Y EBITDA NETO -->
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div>
                    <div style="font-size:11.5px; font-weight:800; color:#334155;">
                      (-) Gastos Estructura / Overhead SIFU (${Number(draft.overheadEstructuraPct) || 5}%): <b>-${formatCurrencyDec(costeEstSifu)}</b>
                    </div>
                    <div style="font-size:13.5px; font-weight:900; color:#0f172a; margin-top:3px;">
                      (=) EBITDA / Margen Operativo Neto: <span style="color:#4f46e5;">${formatCurrencyDec(m.ebitdaNetoAnual)} (${ebitdaPct.toFixed(2)}%)</span>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:11px; font-weight:800; color:#64748b;">Estructura %:</span>
                    <input type="number" step="0.5" min="0" max="20" class="esc-inline-input" style="width:70px; text-align:center;" value="${Number(draft.overheadEstructuraPct) || 5}" onchange="window.EstudioEconomicoModule.updateField('overheadEstructuraPct', Number(this.value)||0); window.EstudioEconomicoModule.setSubView('excel_grid');">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. SECCIÓN INFERIOR: PLANTILLA NOMINAL DE TRABAJADORES ASIGNADOS (EDICIÓN RÁPIDA) -->
        <div class="esc-panel" style="margin-bottom:0;">
          <div class="esc-panel-header">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <span style="font-size:16px;">👨‍🔧</span>
              <span style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">
                7. Desglose Nominal de Operarios Asignados al Servicio (${workers.length} trabajadores)
              </span>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="econ-btn" style="background:#10b981; color:#ffffff; border:none; padding:6px 12px; font-size:11.5px;" onclick="window.EstudioEconomicoModule.addWorker('cee')">
                ➕ Añadir Operario CEE (Bonificado)
              </button>
              <button class="econ-btn" style="background:rgba(255,255,255,0.16); color:#ffffff; border-color:rgba(255,255,255,0.3); padding:6px 12px; font-size:11.5px;" onclick="window.EstudioEconomicoModule.addWorker('estandar')">
                ➕ Añadir Operario Ordinario
              </button>
            </div>
          </div>
          <div class="esc-panel-body" style="padding:0; overflow-x:auto;">
            <table class="esc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Operario / Puesto Asignado</th>
                  <th>Régimen / Categoría</th>
                  <th style="text-align:center;">Horas / Sem.</th>
                  <th style="text-align:center;">Jornada %</th>
                  <th style="text-align:right;">Salario Bruto (€/a)</th>
                  <th style="text-align:right;">Pluses / Antig. (€/a)</th>
                  <th style="text-align:center;">% Seg. Social</th>
                  <th style="text-align:right;">Coste Total Empresa</th>
                  <th style="text-align:center;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${workers.map((w, idx) => {
                  const sub = calculateWorkerSubtotal(w);
                  return `
                    <tr>
                      <td style="font-weight:800; color:#64748b;">${idx + 1}</td>
                      <td>
                        <input type="text" class="esc-inline-input" style="width:190px; text-align:left; background:#ffffff;" value="${escapeHtml(w.puesto || w.titularNombre || 'Operario')}" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'puesto', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      </td>
                      <td>
                        <select class="esc-inline-input" style="width:175px; text-align:left; background:${w.esCEE ? '#ecfdf5' : '#f8fafc'}; color:${w.esCEE ? '#065f46' : '#1e293b'};" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'categoria', this.value)">
                          <option value="Limpiador/a CEE (EPID)" ${w.esCEE ? 'selected' : ''}>🟢 CEE Bonificado (EPID)</option>
                          <option value="Limpiador/a" ${!w.esCEE && w.categoria === 'Limpiador/a' ? 'selected' : ''}>🔵 Convenio Ordinario</option>
                          <option value="Especialista" ${w.categoria === 'Especialista' ? 'selected' : ''}>🟣 Especialista</option>
                          <option value="Auxiliar Servicios" ${w.categoria === 'Auxiliar Servicios' ? 'selected' : ''}>🟠 Auxiliar Servicios</option>
                        </select>
                      </td>
                      <td style="text-align:center;">
                        <input type="number" step="0.5" min="1" max="40" class="esc-inline-input" style="width:72px; text-align:center;" value="${Number(w.horasSemanales) || 38.5}" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'horasSemanales', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      </td>
                      <td style="text-align:center; font-weight:800; color:#475569;">
                        ${Number(w.jornadaPct || 100).toFixed(1)}%
                      </td>
                      <td style="text-align:right;">
                        <input type="number" step="100" min="0" class="esc-inline-input" style="width:105px;" value="${Math.round(Number(w.salarioBrutoAnual) || 0)}" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'salarioBrutoAnual', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      </td>
                      <td style="text-align:right;">
                        <input type="number" step="50" min="0" class="esc-inline-input" style="width:90px;" value="${Math.round((Number(w.plusesAnuales) || 0) + (Number(w.antiguedadAnual) || 0))}" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'plusesAnuales', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      </td>
                      <td style="text-align:center;">
                        <input type="number" step="0.5" min="0" max="45" class="esc-inline-input" style="width:68px; text-align:center;" value="${Number(w.segSocialPct) || 0}" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'segSocialPct', this.value); window.EstudioEconomicoModule.setSubView('excel_grid');">
                      </td>
                      <td style="text-align:right; font-weight:900; color:#0f172a; font-size:13.5px;">
                        ${formatCurrencyDec(sub.costeDirectoAnual)}/a
                      </td>
                      <td style="text-align:center;">
                        <button class="econ-btn" style="padding:4px 8px; color:#dc2626; border-color:#fecaca; background:#fef2f2;" onclick="window.EstudioEconomicoModule.removeWorker(${idx})" title="Eliminar operario">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderActiveSubView(m) {
    if (EconState.subView === 'dashboard') {
      return renderExecutiveDashboardView();
    }
    if (EconState.subView === 'historial') {
      return renderHistorialView();
    }
    if (EconState.subView === 'comparativa') {
      return renderComparativaView();
    }
    if (EconState.subView === 'excel_grid') {
      return renderExcelEscandalloGridView(EconState.currentDraft, m);
    }
    return renderWizardAndRealtimeWorkspace(EconState.currentDraft, m);
  }

  // ============================================================================
  // 1. VISTA PRINCIPAL: WIZARD 5 PASOS + PANEL LATERAL FIJO EN TIEMPO REAL
  // ============================================================================
  function renderWizardAndRealtimeWorkspace(draft, m) {
    const step = EconState.wizardStep;
    const allOpen = EconState.showAllStepsInOne;
    const proyBadges = Array.isArray(draft.proyectosSAP) && draft.proyectosSAP.length
      ? draft.proyectosSAP.join(' · ')
      : 'PROY-BARCELONA';

    return `
      <!-- BARRA SUPERIOR DEL ESTUDIO ACTIVO: SELECTOR DE CLIENTES REALES + PROYECTOS SAP -->
      <div class="econ-card" style="padding:12px 18px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:linear-gradient(90deg, #ffffff 0%, #f8fafc 100%);">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-size:12px; font-weight:900; color:#1e293b;">📂 Cliente Activo:</span>
          <span style="font-size:13px; font-weight:900; color:#312e81; background:#eef2ff; padding:5px 11px; border-radius:8px; border:1px solid #c7d2fe;">
            ${escapeHtml(draft.codigo)} · ${escapeHtml(draft.cliente)}
          </span>
          <span style="font-size:11px; font-weight:800; color:#0369a1; background:#e0f2fe; padding:4px 9px; border-radius:6px; font-family:monospace;">
            SAP: ${escapeHtml(proyBadges)}
          </span>
          ${draft.bajasITActivasCount > 0 ? `
            <span style="font-size:11px; font-weight:800; color:#991b1b; background:#fee2e2; padding:4px 9px; border-radius:6px;">
              🚑 ${draft.bajasITActivasCount} Baja(s) IT en vivo
            </span>
          ` : ''}
          <select class="econ-select" style="font-size:11.5px; padding:6px 10px; max-width:320px;" onchange="if(this.value !== '') { window.EstudioEconomicoModule.cargarEstudio(this.value); }">
            <option value="">🔍 Cambiar rápido entre los ${EconState.studies.length} estudios de Alejandro Coscolin...</option>
            ${EconState.studies.map(s => `
              <option value="${s.id}" ${s.id === draft.id ? 'selected' : ''}>${escapeHtml(s.codigo)} — ${escapeHtml(s.cliente)} (${escapeHtml(s.servicio.slice(0, 35))})</option>
            `).join('')}
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button class="econ-btn" onclick="window.EstudioEconomicoModule.toggleShowAllSteps()">
            <span>${allOpen ? '🧭' : '📋'}</span>
            <span>${allOpen ? 'Modo Paso a Paso (Wizard)' : 'Ver los 5 Pasos en 1 Vista'}</span>
          </button>
          <button class="econ-btn" onclick="window.EstudioEconomicoModule.restaurarDatosSAPOriginales()" title="Restaurar este cliente a los valores originales sincronizados en vivo desde SAP HO y Master Data">
            <span>♻️</span> Reset SAP
          </button>
          <button class="econ-btn" onclick="window.EstudioEconomicoModule.duplicarEstudio('${draft.id}')">
            <span>📑</span> Duplicar
          </button>
          <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.guardarEstudioActual()">
            <span>💾</span> Guardar Cambios
          </button>
        </div>
      </div>

      <div class="econ-workspace-grid">
        <!-- COLUMNA IZQUIERDA: WIZARD DE 5 PASOS + GRÁFICOS + SIMULADOR -->
        <div>
          <!-- STEPPER NAVEGABLE DE 5 PASOS -->
          <div class="econ-stepper">
            ${[
              { n: 1, title: 'Datos Generales', sub: (draft.proyectosSAP || []).length + ' proy. SAP', icon: '🏢' },
              { n: 2, title: 'Facturación', sub: formatCurrency(m.facturacionAnual) + '/año', icon: '💶' },
              { n: 3, title: 'Personal Real (' + m.numTrabajadores + ')', sub: formatCurrency(m.costePersonalDirecto) + '/año', icon: '👥' },
              { n: 4, title: 'Costes Operativos', sub: formatCurrency(m.costeOperativoTotal) + '/año', icon: '🧰' },
              { n: 5, title: 'Riesgos y Previsiones', sub: 'Absentismo ' + draft.riesgos.absentismoPct + '%', icon: '🎚️' }
            ].map(s => `
              <button class="econ-step-btn ${!allOpen && step === s.n ? 'active' : ''}" onclick="window.EstudioEconomicoModule.setWizardStep(${s.n})">
                <div class="econ-step-num">${s.n}</div>
                <div style="overflow:hidden;">
                  <div style="font-size:12px; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${s.icon} ${s.title}
                  </div>
                  <div style="font-size:10.5px; color:#64748b; font-weight:600;">${s.sub}</div>
                </div>
              </button>
            `).join('')}
          </div>

          <!-- PASO 1: DATOS GENERALES -->
          ${(allOpen || step === 1) ? renderStep1DatosGenerales(draft) : ''}

          <!-- PASO 2: FACTURACIÓN -->
          ${(allOpen || step === 2) ? renderStep2Facturacion(draft, m) : ''}

          <!-- PASO 3: PERSONAL -->
          ${(allOpen || step === 3) ? renderStep3Personal(draft, m) : ''}

          <!-- PASO 4: COSTES OPERATIVOS -->
          ${(allOpen || step === 4) ? renderStep4CostesOperativos(draft, m) : ''}

          <!-- PASO 5: RIESGOS Y PREVISIONES -->
          ${(allOpen || step === 5) ? renderStep5Riesgos(draft, m) : ''}

          <!-- BOTONES DE NAVEGACIÓN ENTRE PASOS DEL WIZARD -->
          ${!allOpen ? `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
              <button class="econ-btn" ${step <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} onclick="window.EstudioEconomicoModule.setWizardStep(${step - 1})">
                ← Paso Anterior
              </button>
              <span style="font-size:12px; font-weight:700; color:#64748b;">Paso ${step} de 5</span>
              ${step < 5 ? `
                <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.setWizardStep(${step + 1})">
                  Siguiente Paso (${step + 1}/5) →
                </button>
              ` : `
                <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.guardarEstudioActual()">
                  ✅ Finalizar y Guardar Estudio
                </button>
              `}
            </div>
          ` : ''}

          <!-- VISUALIZACIONES DINÁMICAS (DONUT + BARRAS + SEMÁFORO RENTABILIDAD) -->
          ${renderVisualChartsSection(draft, m)}

          <!-- SIMULADOR ECONÓMICO "¿QUÉ OCURRIRÍA SI...?" -->
          ${renderSimulatorSection(draft, m)}

          <!-- ANÁLISIS FINANCIERO Y CONCLUSIÓN EJECUTIVA -->
          ${renderAIConclusionSection(draft, m)}
        </div>

        <!-- COLUMNA DERECHA: PANEL LATERAL FIJO DE RESULTADOS EN TIEMPO REAL -->
        <aside class="econ-sticky-sidebar" id="econ-realtime-sidebar">
          ${renderRealtimeSidebarContent(draft, m)}
        </aside>
      </div>
    `;
  }

  // PASO 1 - DATOS GENERALES (CON CÓDIGOS DE PROYECTO SAP Y OVERHEAD ESTRUCTURA SIFU)
  function renderStep1DatosGenerales(draft) {
    const proyStr = Array.isArray(draft.proyectosSAP) ? draft.proyectosSAP.join(', ') : (draft.proyectosSAP || '');
    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">PASO 1 DE 5 · DATOS REALES DE CONTRATO Y SAP S/4HANA</span>
            <h3 style="margin:2px 0 0; font-size:16px; font-weight:900;">🏢 Datos Generales del Cliente, Servicio y Proyecto SAP</h3>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-size:11px; font-weight:800; background:#dcfce7; color:#166534; padding:3px 9px; border-radius:99px;">
              🟢 Sincronizado con Cartera Real
            </span>
            <span style="font-size:11.5px; font-weight:700; color:#64748b;">Código: <b>${escapeHtml(draft.codigo)}</b></span>
          </div>
        </div>

        <div class="econ-form-grid">
          <div class="econ-field">
            <label>Cliente Corporativo / Razón Social</label>
            <input type="text" class="econ-input" value="${escapeHtml(draft.cliente)}" oninput="window.EstudioEconomicoModule.updateField('cliente', this.value)">
          </div>
          <div class="econ-field">
            <label>Servicio / Lote Contratado</label>
            <input type="text" class="econ-input" value="${escapeHtml(draft.servicio)}" oninput="window.EstudioEconomicoModule.updateField('servicio', this.value)">
          </div>
          <div class="econ-field">
            <label>Centro de Trabajo / Dirección</label>
            <input type="text" class="econ-input" value="${escapeHtml(draft.centro)}" oninput="window.EstudioEconomicoModule.updateField('centro', this.value)">
          </div>
          <div class="econ-field">
            <label>Responsable Operativo SIFU</label>
            <input type="text" class="econ-input" value="${escapeHtml(draft.responsable)}" oninput="window.EstudioEconomicoModule.updateField('responsable', this.value)">
          </div>
          <div class="econ-field">
            <label>Código(s) Proyecto SAP (SVO / PROY)</label>
            <input type="text" class="econ-input" style="font-family:monospace; color:#0369a1;" value="${escapeHtml(proyStr)}" oninput="window.EstudioEconomicoModule.updateField('proyectosSAP', this.value.split(',').map(s=>s.trim()).filter(Boolean))">
          </div>
          <div class="econ-field">
            <label>Fecha Inicio / Vigencia</label>
            <input type="date" class="econ-input" value="${draft.fechaInicio || '2026-01-01'}" onchange="window.EstudioEconomicoModule.updateField('fechaInicio', this.value)">
          </div>
          <div class="econ-field">
            <label>Duración Contrato (Meses)</label>
            <input type="number" min="1" max="120" class="econ-input" value="${draft.duracionMeses || 12}" oninput="window.EstudioEconomicoModule.updateField('duracionMeses', Number(this.value)||12)">
          </div>
          <div class="econ-field">
            <label>Tipo de Contrato / División</label>
            <select class="econ-select" onchange="window.EstudioEconomicoModule.updateField('tipoContrato', this.value)">
              ${['Limpieza', 'Auxiliares', 'Mixto Auxiliares + Limpieza', 'Albergues / Variable', 'CEE Bonificado', 'Especialistas / Cristales', 'Estructura / Bolsa PGO'].map(t => `
                <option value="${t}" ${draft.tipoContrato === t ? 'selected' : ''}>${t}</option>
              `).join('')}
            </select>
          </div>
          <div class="econ-field">
            <label>Modalidad de Facturación</label>
            <select class="econ-select" onchange="window.EstudioEconomicoModule.updateField('tipoFacturacion', this.value)">
              ${['Cuota Fija Mensual', 'Bolsa de Horas Anualizada', 'Facturación por Hora / Evento', 'Mixto Fijo + Variable', 'Centro Coste / Imputación Interna'].map(t => `
                <option value="${t}" ${draft.tipoFacturacion === t ? 'selected' : ''}>${t}</option>
              `).join('')}
            </select>
          </div>
          <div class="econ-field">
            <label>Overhead Estructura SIFU (%)</label>
            <input type="number" step="0.5" min="0" max="20" class="econ-input" value="${draft.overheadEstructuraPct ?? 5.0}" oninput="window.EstudioEconomicoModule.updateField('overheadEstructuraPct', Number(this.value)||0)" title="Porcentaje de gastos generales / estructura corporativa para cálculo de EBITDA neto">
          </div>
        </div>
      </div>
    `;
  }

  // PASO 2 - FACTURACIÓN (BIDIRECCIONAL MENSUAL <-> ANUAL + BREAK-EVEN)
  function renderStep2Facturacion(draft, m) {
    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">PASO 2 DE 5 · INGRESOS Y UMBRAL DE RENTABILIDAD</span>
            <h3 style="margin:2px 0 0; font-size:16px; font-weight:900;">💶 Facturación del Servicio y Punto de Equilibrio (Break-Even)</h3>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(12)" title="Ajustar cuota para 12% de margen">
              🎯 Tarifa Margen 12%
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.sugerirFacturacionObjetivo(15)" title="Calcula la facturación necesaria para lograr exactamente un 15% de margen bruto sobre los costes actuales">
              🎯 Tarifa Objetivo 15% (${formatCurrency(m.facturacionObjetivo15)}/año)
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:14px; align-items:stretch;">
          <div class="econ-field" style="background:#f0fdf4; border:1px solid #bbf7d0; padding:14px; border-radius:12px;">
            <label style="color:#166534;">Facturación Mensual (€ / mes sin IVA)</label>
            <input type="number" step="50" id="econ-input-fact-mensual" class="econ-input" style="font-size:18px; font-weight:900; color:#15803d; background:#ffffff;" value="${Math.round((Number(draft.facturacionMensual) || 0) * 100) / 100}" oninput="window.EstudioEconomicoModule.updateFacturacion('mensual', this.value)">
            <span style="font-size:11px; color:#15803d; margin-top:4px;">Cálculo automático anual (× 12 meses)</span>
          </div>

          <div class="econ-field" style="background:#eff6ff; border:1px solid #bfdbfe; padding:14px; border-radius:12px;">
            <label style="color:#1e40af;">Facturación Anual (€ / año sin IVA)</label>
            <input type="number" step="500" id="econ-input-fact-anual" class="econ-input" style="font-size:18px; font-weight:900; color:#1d4ed8; background:#ffffff;" value="${Math.round((Number(draft.facturacionAnual) || 0) * 100) / 100}" oninput="window.EstudioEconomicoModule.updateFacturacion('anual', this.value)">
            <span style="font-size:11px; color:#1e40af; margin-top:4px;">Cálculo automático mensual (/ 12 meses)</span>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:14px; border-radius:12px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
            <div style="font-size:10.5px; font-weight:900; color:#475569; text-transform:uppercase;">Auditoría de Tarifa y Break-Even</div>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span>Precio Hora Venta Actual:</span>
              <b id="econ-step2-precio-hora" style="color:#0f172a;">${formatCurrencyDec(m.precioHora)}/h</b>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span>Coste Hora Break-Even (0%):</span>
              <b id="econ-step2-coste-hora" style="color:#dc2626;">${formatCurrencyDec(m.costeHora)}/h</b>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span>Precio Hora Objetivo (15%):</span>
              <b style="color:#059669;">${formatCurrencyDec(m.precioHoraObjetivo15)}/h</b>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #cbd5e1; padding-top:4px;">
              <span>Valor Contrato (${draft.duracionMeses}m):</span>
              <b id="econ-step2-total-contrato" style="color:#4f46e5;">${formatCurrency(m.facturacionMensual * (Number(draft.duracionMeses) || 12))}</b>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // PASO 3 - PERSONAL REAL SINCRONIZADO (CON DATOS SAP HO, CMH, SOCIEDAD CEE Y BAJAS IT)
  function renderStep3Personal(draft, m) {
    const workers = Array.isArray(draft.trabajadores) ? draft.trabajadores : [];

    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; flex-wrap:wrap; gap:10px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">PASO 3 DE 5 · PLANTILLA REAL SINCRONIZADA CON SAP HO Y CMH</span>
            <h3 style="margin:2px 0 0; font-size:16px; font-weight:900;">👥 Operarios Asignados al Cliente (${workers.length} línea${workers.length === 1 ? '' : 's'} de servicio)</h3>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.addWorker('cee')" title="Añadir operario con discapacidad (CEE EPID) con Seguridad Social bonificada (11,5%)">
              ➕ Añadir Operario CEE (EPID)
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.addWorker('estandar')">
              ➕ Añadir Trabajador
            </button>
          </div>
        </div>

        ${workers.map((w, idx) => {
          const sub = calculateWorkerSubtotal(w);
          const isBaja = Boolean(w.enBajaIT);
          const isCEE = Boolean(w.esCEE || String(w.categoria || '').includes('CEE'));
          return `
            <div class="econ-worker-card ${isBaja ? 'is-baja-it' : (isCEE ? 'is-cee' : '')}">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                  <span style="background:#0f172a; color:#ffffff; font-size:10.5px; font-weight:800; padding:3px 7px; border-radius:6px; font-family:monospace;">
                    #${idx + 1} · ID ${escapeHtml(w.idEmpleadoSAP || 'SAP')}
                  </span>
                  <span style="font-size:13.5px; font-weight:900; color:#0f172a;">${escapeHtml(w.puesto || 'Operario/a')}</span>
                  ${w.proyectoSAP ? `
                    <span style="font-size:10.5px; font-weight:800; background:#e0f2fe; color:#0369a1; padding:2px 7px; border-radius:6px; font-family:monospace;">
                      ${escapeHtml(w.proyectoSAP)}
                    </span>
                  ` : ''}
                  <span style="font-size:10.5px; font-weight:800; background:${isCEE ? '#dcfce7' : '#f1f5f9'}; color:${isCEE ? '#166534' : '#334155'}; padding:2px 8px; border-radius:99px;">
                    ${isCEE ? '♿ EPID CEE Bonificado (SS 11,5%)' : '🏢 SIFU, S.L. (SS 33,5%)'}
                  </span>
                  ${isBaja ? `
                    <span style="font-size:10.5px; font-weight:900; background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:99px;">
                      🚑 BAJA IT ACTIVA ${w.suplenteNombre ? '· Supl: ' + escapeHtml(w.suplenteNombre) : ''}
                    </span>
                  ` : `
                    <span style="font-size:10.5px; font-weight:800; background:#f0fdf4; color:#15803d; padding:2px 8px; border-radius:99px;">
                      🟢 ${escapeHtml(w.estadoOperativo || 'CUBIERTO')}
                    </span>
                  `}
                </div>

                <div style="display:flex; align-items:center; gap:8px;">
                  <div id="econ-worker-subtotal-${idx}" style="background:#eef2ff; border:1px solid #c7d2fe; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:900; color:#312e81;">
                    Coste Neto: ${formatCurrency(sub.costeDirectoAnual)}/año (${formatCurrency(sub.costeDirectoMensual)}/mes)
                  </div>
                  <button class="econ-btn" style="padding:4px 8px; color:#dc2626; border-color:#fecaca;" onclick="window.EstudioEconomicoModule.removeWorker(${idx})" title="Eliminar trabajador del escandallo">
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Sub-barra informativa de datos reales SAP HO / CMH del trabajador -->
              <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:11px; color:#475569; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; margin-bottom:10px;">
                <span>🕒 <b>Horario Centro:</b> ${escapeHtml(w.horarioReal || 'Según cuadrante')}</span>
                ${w.dni && w.dni !== '—' ? `<span>🪪 <b>DNI:</b> ${escapeHtml(w.dni)}</span>` : ''}
                ${w.inicioContrato ? `<span>📅 <b>Alta SAP:</b> ${escapeHtml(w.inicioContrato)} (Fin: ${escapeHtml(w.finContrato || 'Indefinido')})</span>` : ''}
                ${w.cmhContratoMes ? `<span>📊 <b>CMH Global Operario:</b> Cto ${w.cmhContratoMes}h/mes · Imp. ${w.cmhConsumidasMes ?? '—'}h (Saldo: ${w.cmhDifMes !== null && w.cmhDifMes !== undefined ? (w.cmhDifMes > 0 ? '+' + w.cmhDifMes : w.cmhDifMes) + 'h' : '—'})</span>` : ''}
                ${sub.subvencionCEEAnual > 0 ? `<span style="color:#15803d; font-weight:800;">♿ Bonificación CEE aplicada: -${formatCurrency(sub.subvencionCEEAnual)}/año</span>` : ''}
              </div>

              <div class="econ-form-grid" style="grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap:10px;">
                <div class="econ-field">
                  <label>Operario / Puesto</label>
                  <input type="text" class="econ-input" value="${escapeHtml(w.puesto)}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'puesto', this.value)">
                </div>
                <div class="econ-field">
                  <label>Categoría Convenio</label>
                  <select class="econ-select" onchange="window.EstudioEconomicoModule.updateWorker(${idx}, 'categoria', this.value)">
                    ${['Limpiador/a', 'Limpiador/a CEE (EPID)', 'Especialista Albergues', 'Operario/a Albergue CEE', 'Especialista Cristalero', 'Auxiliar Servicios', 'Auxiliar Servicios CEE', 'Responsable Equipo'].map(cat => `
                      <option value="${cat}" ${w.categoria === cat ? 'selected' : ''}>${cat}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="econ-field">
                  <label>Jornada Imputada %</label>
                  <input type="number" step="0.5" min="1" max="100" id="econ-w-jornada-${idx}" class="econ-input" value="${w.jornadaPct}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'jornadaPct', this.value)">
                </div>
                <div class="econ-field">
                  <label>Horas / Semana Centro</label>
                  <input type="number" step="0.5" min="0.5" max="40" id="econ-w-horas-${idx}" class="econ-input" value="${w.horasSemanales}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'horasSemanales', this.value)">
                </div>
                <div class="econ-field">
                  <label>Salario Bruto Anual (€)</label>
                  <input type="number" step="100" id="econ-w-salario-${idx}" class="econ-input" value="${w.salarioBrutoAnual}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'salarioBrutoAnual', this.value)">
                </div>
                <div class="econ-field">
                  <label>Seguridad Social %</label>
                  <input type="number" step="0.5" class="econ-input" value="${w.segSocialPct}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'segSocialPct', this.value)">
                </div>
                <div class="econ-field">
                  <label>Antigüedad Anual (€)</label>
                  <input type="number" step="25" class="econ-input" value="${w.antiguedadAnual}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'antiguedadAnual', this.value)">
                </div>
                <div class="econ-field">
                  <label>Pluses Noct./Fest. (€)</label>
                  <input type="number" step="25" class="econ-input" value="${w.plusesAnuales}" oninput="window.EstudioEconomicoModule.updateWorker(${idx}, 'plusesAnuales', this.value)">
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:12px 16px; border-radius:10px; margin-top:8px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:8px;">
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.addWorker('estandar')">
              ➕ Añadir Trabajador
            </button>
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.addWorker('cee')">
              ♿ Añadir Operario CEE
            </button>
          </div>
          <div style="font-size:13px; font-weight:800; color:#0f172a;">
            Coste Directo Personal: <span id="econ-step3-total-personal" style="color:#4f46e5; font-size:15px;">${formatCurrency(m.costePersonalDirecto)}/año</span>
            <span style="color:#64748b; font-size:11.5px; margin-left:6px;">(${Math.round(m.totalHorasAnuales)} h contratadas/año · ${Math.round(m.totalHorasMensuales)} h/mes)</span>
          </div>
        </div>
      </div>
    `;
  }

  // PASO 4 - COSTES OPERATIVOS
  function renderStep4CostesOperativos(draft, m) {
    const op = draft.costesOperativos || {};
    const fields = [
      { key: 'vestuario', label: '👕 Vestuario anual (€)' },
      { key: 'epis', label: '🦺 EPIs y Seguridad (€)' },
      { key: 'formacion', label: '🎓 Formación PRL / Técnica (€)' },
      { key: 'reconocimientos', label: '🩺 Reconocimientos médicos (€)' },
      { key: 'materiales', label: '🪣 Materiales y útiles (€)' },
      { key: 'consumibles', label: '🧻 Consumibles / Químicos / Celulosa (€)' },
      { key: 'equipos', label: '🚜 Equipos y Maquinaria (Amortiz. €)' },
      { key: 'vehiculos', label: '🚐 Vehículos / Rutas / Kilometraje (€)' },
      { key: 'telefonia', label: '📱 Telefonía / Control Presencia gcalidad (€)' },
      { key: 'software', label: '💻 Software / Licencias SAP & Gestión (€)' },
      { key: 'subcontratas', label: '🤝 Subcontratas / Especiales (€)' },
      { key: 'otros', label: '📦 Otros costes operativos (€)' }
    ];

    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">PASO 4 DE 5 · MEDIOS MATERIALES, MAQUINARIA Y FLOTA</span>
            <h3 style="margin:2px 0 0; font-size:16px; font-weight:900;">🧰 Costes Operativos Directos y Suministros Anuales</h3>
          </div>
          <button class="econ-btn" onclick="window.EstudioEconomicoModule.autoEstimarCostesOperativos()" title="Recalcula automáticamente según las horas anuales y tipo de servicio de SIFU Barcelona (0801)">
            ⚡ Recalcular por Estándar Técnico SIFU
          </button>
        </div>

        <div class="econ-form-grid" style="grid-template-columns: repeat(auto-fit, minmax(195px, 1fr));">
          ${fields.map(f => `
            <div class="econ-field">
              <label>${f.label}</label>
              <input type="number" step="20" min="0" class="econ-input" value="${Number(op[f.key]) || 0}" oninput="window.EstudioEconomicoModule.updateCosteOperativo('${f.key}', this.value)">
            </div>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:12px 16px; border-radius:10px; margin-top:14px;">
          <span style="font-size:12.5px; font-weight:700; color:#475569;">Total Costes Operativos Anuales (incl. indexación IPC suministros):</span>
          <span id="econ-step4-total-op" style="font-size:16px; font-weight:900; color:#0284c7;">
            ${formatCurrency(m.costeOperativoTotal)}/año (${formatCurrency(m.costeOperativoTotal / 12)}/mes)
          </span>
        </div>
      </div>
    `;
  }

  // PASO 5 - RIESGOS Y PREVISIONES (SLIDERS INTERACTIVOS)
  function renderStep5Riesgos(draft, m) {
    const r = draft.riesgos || {};

    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#4f46e5; text-transform:uppercase;">PASO 5 DE 5 · CONTINGENCIAS Y CONVENIO COLECTIVO BARCELONA</span>
            <h3 style="margin:2px 0 0; font-size:16px; font-weight:900;">🎚️ Riesgos, Absentismo IT y Previsiones Laborales</h3>
          </div>
          <span id="econ-step5-total-riesgos" style="font-size:12.5px; font-weight:800; color:#b45309; background:#fef3c7; padding:4px 10px; border-radius:8px;">
            Provisión Total Riesgos: ${formatCurrency(m.costeRiesgosYProvisiones)}/año
          </span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
          <!-- Absentismo 0-15% -->
          <div class="econ-slider-row">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">🩺 Absentismo IT Previsto (%)</span>
              <span id="econ-lbl-absentismo" style="font-size:13px; font-weight:900; color:#dc2626;">${r.absentismoPct}% (${formatCurrency(m.costeAbsentismo)}/año)</span>
            </div>
            <input type="range" min="0" max="15" step="0.5" value="${r.absentismoPct}" class="econ-range" oninput="window.EstudioEconomicoModule.updateRiesgo('absentismoPct', this.value)">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b;"><span>0%</span><span>Bajas activas hoy: ${m.bajasITActivas}</span><span>15%</span></div>
          </div>

          <!-- IPC previsto 0-10% -->
          <div class="econ-slider-row">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">📈 IPC Previsto (%)</span>
              <span id="econ-lbl-ipc" style="font-size:13px; font-weight:900; color:#0284c7;">${r.ipcPct}%</span>
            </div>
            <input type="range" min="0" max="10" step="0.1" value="${r.ipcPct}" class="econ-range" oninput="window.EstudioEconomicoModule.updateRiesgo('ipcPct', this.value)">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b;"><span>0%</span><span>3%</span><span>10%</span></div>
          </div>

          <!-- Incremento Salarial Convenio 0-10% -->
          <div class="econ-slider-row">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">⚖️ Incremento Salarial Convenio (%)</span>
              <span id="econ-lbl-convenio" style="font-size:13px; font-weight:900; color:#4f46e5;">${r.incrementoConvenioPct}% (${formatCurrency(m.costeIncrementoConvenio)}/año)</span>
            </div>
            <input type="range" min="0" max="10" step="0.25" value="${r.incrementoConvenioPct}" class="econ-range" oninput="window.EstudioEconomicoModule.updateRiesgo('incrementoConvenioPct', this.value)">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b;"><span>0%</span><span>Convenio Barcelona ~3%</span><span>10%</span></div>
          </div>

          <!-- Sustitución Vacaciones 0-100% -->
          <div class="econ-slider-row">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">🏖️ Sustitución Vacaciones (%)</span>
              <span id="econ-lbl-vacaciones" style="font-size:13px; font-weight:900; color:#059669;">${r.sustitucionVacacionesPct}% (${formatCurrency(m.costeSustitucionVacaciones)}/año)</span>
            </div>
            <input type="range" min="0" max="100" step="5" value="${r.sustitucionVacacionesPct}" class="econ-range" oninput="window.EstudioEconomicoModule.updateRiesgo('sustitucionVacacionesPct', this.value)">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b;"><span>0% (Bolsa CMH)</span><span>50%</span><span>100% Suplencia</span></div>
          </div>

          <!-- Desvinculaciones (Número de trabajadores) -->
          <div class="econ-slider-row" style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; font-weight:800; color:#0f172a;">🔄 Desvinculaciones / Rotación Prevista (N.º de trabajadores)</span>
              <span id="econ-lbl-desvinc" style="font-size:13px; font-weight:900; color:#7c3aed;">${r.desvinculacionesNum} operario(s) (${formatCurrency(m.costeDesvinculaciones)}/año)</span>
            </div>
            <input type="range" min="0" max="10" step="1" value="${r.desvinculacionesNum}" class="econ-range" oninput="window.EstudioEconomicoModule.updateRiesgo('desvinculacionesNum', this.value)">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b;"><span>0 desvinculaciones</span><span>5</span><span>10 trabajadores</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // PANEL LATERAL FIJO DE RESULTADOS EN TIEMPO REAL (P&L COMPLETO + EBITDA)
  // ============================================================================
  function renderRealtimeSidebarContent(draft, m) {
    return `
      <div class="econ-card" style="padding:18px; border-top:5px solid ${m.semaforoColor}; margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">
            ⚡ ESCANDALLO P&amp;L EN TIEMPO REAL
          </span>
          <span style="font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:99px; background:${m.semaforoBg}; color:${m.semaforoText};">
            ${m.semaforoLabel}
          </span>
        </div>

        <!-- GRAN KPI DE MARGEN Y BENEFICIO BRUTO -->
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#ffffff; border-radius:12px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <div>
              <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase;">Beneficio Bruto Anual</div>
              <div style="font-size:24px; font-weight:900; color:${m.beneficioBrutoAnual >= 0 ? '#4ade80' : '#f87171'};">
                ${formatCurrency(m.beneficioBrutoAnual)}
              </div>
              <div style="font-size:11px; color:#cbd5e1;">${formatCurrency(m.beneficioBrutoMensual)} / mes</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase;">Margen Bruto</div>
              <div style="font-size:28px; font-weight:900; color:${m.semaforoColor};">
                ${m.margenBrutoPct.toFixed(1)}%
              </div>
              <div style="font-size:10px; color:#94a3b8;">EBITDA Neto: <b>${m.ebitdaNetoPct.toFixed(1)}%</b></div>
            </div>
          </div>

          <!-- Barra de progreso visual del margen -->
          <div style="height:7px; background:rgba(255,255,255,0.14); border-radius:99px; overflow:hidden; margin-top:12px;">
            <div style="height:100%; width:${Math.max(4, Math.min(100, (m.margenBrutoPct / 25) * 100))}%; background:${m.semaforoColor}; border-radius:99px; transition:width 0.25s ease;"></div>
          </div>
        </div>

        <!-- DESGLOSE EJECUTIVO DE CUENTA DE EXPLOTACIÓN (P&L) -->
        <div style="display:flex; flex-direction:column; gap:7px; font-size:12.5px; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#475569; font-weight:700;">💶 Facturación Anual</span>
            <b style="color:#0f172a; font-size:13.5px;">${formatCurrency(m.facturacionAnual)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:#64748b;">
            <span>↳ Facturación Mensual</span>
            <b>${formatCurrency(m.facturacionMensual)}/mes</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#475569; font-weight:700;">📉 Costes Totales Servicio</span>
            <b style="color:#dc2626; font-size:13.5px;">${formatCurrency(m.costesTotales)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-left:10px; font-size:11.5px; color:#64748b;">
            <span>↳ Coste Laboral (${m.numTrabajadores} op. + prov.)</span>
            <b style="color:#334155;">${formatCurrency(m.costeLaboralTotal)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-left:10px; font-size:11.5px; color:#64748b;">
            <span>↳ Coste Operativo y Materiales</span>
            <b style="color:#334155;">${formatCurrency(m.costeOperativoTotal)}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:4px; border-top:1px dashed #e2e8f0; font-size:11.5px;">
            <span style="color:#475569; font-weight:700;">🏢 EBITDA Neto (tras ${m.overheadPct}% estruct.)</span>
            <b style="color:${m.ebitdaNetoAnual >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(m.ebitdaNetoAnual)} (${m.ebitdaNetoPct.toFixed(1)}%)</b>
          </div>
        </div>

        <!-- UNIT ECONOMICS: PRECIO HORA / COSTE HORA / BENEFICIO HORA -->
        <div style="font-size:10.5px; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:8px;">
          ⏱️ Unit Economics por Hora (${Math.round(m.totalHorasAnuales)} h/año · ${Math.round(m.totalHorasMensuales)} h/mes)
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:8px 6px;">
            <div style="font-size:9.5px; color:#64748b; font-weight:800;">PRECIO HORA</div>
            <div style="font-size:14px; font-weight:900; color:#1e40af; margin-top:2px;">${formatCurrencyDec(m.precioHora)}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:8px 6px;">
            <div style="font-size:9.5px; color:#64748b; font-weight:800;">COSTE HORA</div>
            <div style="font-size:14px; font-weight:900; color:#dc2626; margin-top:2px;">${formatCurrencyDec(m.costeHora)}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:8px 6px;">
            <div style="font-size:9.5px; color:#64748b; font-weight:800;">BENEFICIO / H</div>
            <div style="font-size:14px; font-weight:900; color:${m.beneficioHora >= 0 ? '#15803d' : '#dc2626'}; margin-top:2px;">
              ${m.beneficioHora >= 0 ? '+' : ''}${formatCurrencyDec(m.beneficioHora)}
            </div>
          </div>
        </div>

        <!-- ACCIONES RÁPIDAS DEL PANEL LATERAL -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px;">
          <button class="econ-btn econ-btn-primary" style="justify-content:center;" onclick="window.EstudioEconomicoModule.guardarEstudioActual()">
            💾 Guardar Escandallo
          </button>
          <button class="econ-btn" style="justify-content:center;" onclick="window.EstudioEconomicoModule.exportarPDFActual()">
            📄 Informe PDF
          </button>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // VISUALIZACIONES DINÁMICAS (DONUT + BARRAS + SEMÁFORO KPI)
  // ============================================================================
  function renderVisualChartsSection(draft, m) {
    const totalCost = Math.max(1, m.costesTotales);
    const pctPersonal = Math.round((m.costePersonalDirecto / totalCost) * 100);
    const pctOperativo = Math.round((m.costeOperativoTotal / totalCost) * 100);
    const pctOtrosRiesgos = Math.max(0, 100 - pctPersonal - pctOperativo);

    const C = 263.89;
    const lenPersonal = (pctPersonal / 100) * C;
    const lenOperativo = (pctOperativo / 100) * C;
    const lenRiesgos = (pctOtrosRiesgos / 100) * C;

    const maxBarVal = Math.max(m.facturacionAnual, m.costesTotales, 1);
    const hFact = Math.round((m.facturacionAnual / maxBarVal) * 120);
    const hCost = Math.round((m.costesTotales / maxBarVal) * 120);
    const hBen = Math.max(6, Math.round((Math.abs(m.beneficioBrutoAnual) / maxBarVal) * 120));

    return `
      <div class="econ-card" id="econ-visual-charts-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
          <h3 style="margin:0; font-size:15.5px; font-weight:900;">📊 Visualización Ejecutiva de Costes y Semáforo de Rentabilidad</h3>
          <span style="font-size:11px; color:#64748b; font-weight:700;">Actualización instantánea en vivo</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:18px; align-items:center;">
          <!-- 1. DONUT: DISTRIBUCIÓN DE COSTES -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; display:flex; align-items:center; gap:14px;">
            <svg width="110" height="110" viewBox="0 0 110 110" style="flex-shrink:0;">
              <circle cx="55" cy="55" r="42" fill="none" stroke="#e2e8f0" stroke-width="14"></circle>
              <circle cx="55" cy="55" r="42" fill="none" stroke="#4f46e5" stroke-width="14"
                      stroke-dasharray="${lenPersonal} ${C}" stroke-dashoffset="0" transform="rotate(-90 55 55)"></circle>
              <circle cx="55" cy="55" r="42" fill="none" stroke="#0ea5e9" stroke-width="14"
                      stroke-dasharray="${lenOperativo} ${C}" stroke-dashoffset="-${lenPersonal}" transform="rotate(-90 55 55)"></circle>
              <circle cx="55" cy="55" r="42" fill="none" stroke="#f59e0b" stroke-width="14"
                      stroke-dasharray="${lenRiesgos} ${C}" stroke-dashoffset="-${lenPersonal + lenOperativo}" transform="rotate(-90 55 55)"></circle>
              <text x="55" y="52" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${pctPersonal}%</text>
              <text x="55" y="65" text-anchor="middle" font-size="8.5" font-weight="700" fill="#64748b">PERSONAL</text>
            </svg>
            <div style="font-size:11.5px; display:flex; flex-direction:column; gap:5px;">
              <div style="font-weight:800; color:#0f172a; margin-bottom:2px;">1. Distribución Costes</div>
              <div><span style="color:#4f46e5; font-weight:900;">●</span> Personal: <b>${pctPersonal}%</b> (${formatCurrency(m.costePersonalDirecto)})</div>
              <div><span style="color:#0ea5e9; font-weight:900;">●</span> Operativos: <b>${pctOperativo}%</b> (${formatCurrency(m.costeOperativoTotal)})</div>
              <div><span style="color:#f59e0b; font-weight:900;">●</span> Vac./Riesgos: <b>${pctOtrosRiesgos}%</b> (${formatCurrency(m.costeRiesgosYProvisiones)})</div>
            </div>
          </div>

          <!-- 2. BARRAS: FACTURACIÓN VS COSTES -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
            <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-bottom:10px;">2. Facturación vs Costes Anuales</div>
            <div style="display:flex; align-items:flex-end; justify-content:space-around; height:135px; padding-top:15px; border-bottom:1px solid #cbd5e1;">
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:10px; font-weight:800; color:#1d4ed8;">${formatCurrency(m.facturacionAnual)}</span>
                <div style="width:42px; height:${hFact}px; background:linear-gradient(180deg, #3b82f6, #1d4ed8); border-radius:6px 6px 0 0;"></div>
              </div>
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:10px; font-weight:800; color:#dc2626;">${formatCurrency(m.costesTotales)}</span>
                <div style="width:42px; height:${hCost}px; background:linear-gradient(180deg, #f87171, #dc2626); border-radius:6px 6px 0 0;"></div>
              </div>
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:10px; font-weight:800; color:${m.beneficioBrutoAnual >= 0 ? '#15803d' : '#dc2626'};">${formatCurrency(m.beneficioBrutoAnual)}</span>
                <div style="width:42px; height:${hBen}px; background:${m.beneficioBrutoAnual >= 0 ? 'linear-gradient(180deg, #34d399, #059669)' : '#dc2626'}; border-radius:6px 6px 0 0;"></div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-around; font-size:10.5px; font-weight:700; color:#475569; margin-top:6px;">
              <span>Facturación</span>
              <span>Costes</span>
              <span>Beneficio</span>
            </div>
          </div>

          <!-- 3. INDICADOR KPI SEMÁFORO DE RENTABILIDAD -->
          <div style="background:${m.semaforoBg}; border:1px solid ${m.semaforoColor}; border-radius:12px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
            <div style="font-size:11.5px; font-weight:800; color:${m.semaforoText};">3. Indicador KPI Rentabilidad</div>
            <div style="font-size:30px; font-weight:900; color:${m.semaforoText}; line-height:1;">
              ${m.margenBrutoPct.toFixed(1)} %
            </div>
            <div style="font-size:11.5px; font-weight:800; color:${m.semaforoText};">
              ${m.semaforoLabel}
            </div>
            <div style="display:flex; gap:6px; font-size:10px; font-weight:700; margin-top:4px;">
              <span style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px;">🔴 &lt;8%</span>
              <span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px;">🟡 8-15%</span>
              <span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px;">🟢 &gt;15%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // SIMULADOR ECONÓMICO "¿QUÉ OCURRIRÍA SI...?"
  // ============================================================================
  function renderSimulatorSection(draft, mBase) {
    const sim = EconState.simScenario;
    const mSim = calculateStudyMetrics(draft, sim);
    const diffBeneficio = mSim.beneficioBrutoAnual - mBase.beneficioBrutoAnual;
    const diffMargen = mSim.margenBrutoPct - mBase.margenBrutoPct;

    const presets = [
      { id: 'abs5', label: '🩺 +5 % Absentismo', abs: 5, sal: 0, fact: 0, hrs: 0, amp: 0 },
      { id: 'abs10', label: '🚨 +10 % Absentismo', abs: 10, sal: 0, fact: 0, hrs: 0, amp: 0 },
      { id: 'conv35', label: '⚖️ Subida Convenio (+3,5%)', abs: 0, sal: 3.5, fact: 0, hrs: 0, amp: 0 },
      { id: 'redFact5', label: '📉 Reducción Facturación (-5%)', abs: 0, sal: 0, fact: -5, hrs: 0, amp: 0 },
      { id: 'incHrs10', label: '⏱️ Incremento Horas Servicio (+10%)', abs: 0, sal: 0, fact: 0, hrs: 10, amp: 0 },
      { id: 'amp12', label: '🤝 Ampliación Contrato (+12m +3% tarifa)', abs: 0, sal: 0, fact: 3, hrs: 0, amp: 12 }
    ];

    return `
      <div class="econ-card" id="econ-simulator-section" style="border-left:4px solid #6366f1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:10.5px; font-weight:800; color:#4f46e5; text-transform:uppercase;">STRESS TEST &amp; SENSIBILIDAD FINANCIERA</span>
            <h3 style="margin:2px 0 0; font-size:15.5px; font-weight:900;">🔮 Simulador Económico: "¿Qué ocurriría si...?"</h3>
          </div>
          <button class="econ-btn" onclick="window.EstudioEconomicoModule.resetSimulator()">
            🔄 Restablecer Simulación
          </button>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
          ${presets.map(p => `
            <button class="econ-sim-chip ${sim.activePreset === p.id ? 'active' : ''}"
                    onclick="window.EstudioEconomicoModule.applySimPreset('${p.id}', ${p.abs}, ${p.sal}, ${p.fact}, ${p.hrs}, ${p.amp})">
              ${p.label}
            </button>
          `).join('')}
        </div>

        <!-- Controles finos del simulador -->
        <div class="econ-form-grid" style="grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); margin-bottom:14px;">
          <div class="econ-field">
            <label>Δ Absentismo Adicional (%)</label>
            <input type="number" step="1" class="econ-input" value="${sim.deltaAbsentismoPct}" oninput="window.EstudioEconomicoModule.updateSimCustom('deltaAbsentismoPct', this.value)">
          </div>
          <div class="econ-field">
            <label>Δ Subida Salarial Extra (%)</label>
            <input type="number" step="0.5" class="econ-input" value="${sim.deltaSalarioPct}" oninput="window.EstudioEconomicoModule.updateSimCustom('deltaSalarioPct', this.value)">
          </div>
          <div class="econ-field">
            <label>Δ Variación Facturación (%)</label>
            <input type="number" step="1" class="econ-input" value="${sim.deltaFacturacionPct}" oninput="window.EstudioEconomicoModule.updateSimCustom('deltaFacturacionPct', this.value)">
          </div>
          <div class="econ-field">
            <label>Δ Horas Servicio (%)</label>
            <input type="number" step="1" class="econ-input" value="${sim.deltaHorasPct}" oninput="window.EstudioEconomicoModule.updateSimCustom('deltaHorasPct', this.value)">
          </div>
        </div>

        <!-- Resultado instantáneo de la simulación -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
          <div>
            <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Nuevo Margen Simulado</div>
            <div style="font-size:22px; font-weight:900; color:${mSim.semaforoColor}; margin-top:2px;">
              ${mSim.margenBrutoPct.toFixed(1)} %
              <span style="font-size:12px; color:#64748b;">(${diffMargen >= 0 ? '+' : ''}${diffMargen.toFixed(1)} pp)</span>
            </div>
          </div>
          <div>
            <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Nuevo Beneficio Anual</div>
            <div style="font-size:22px; font-weight:900; color:${mSim.beneficioBrutoAnual >= 0 ? '#0f172a' : '#dc2626'}; margin-top:2px;">
              ${formatCurrency(mSim.beneficioBrutoAnual)}
            </div>
          </div>
          <div>
            <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Impacto Económico Neto</div>
            <div style="font-size:22px; font-weight:900; color:${diffBeneficio >= 0 ? '#15803d' : '#dc2626'}; margin-top:2px;">
              ${diffBeneficio >= 0 ? '+' : ''}${formatCurrency(diffBeneficio)}/año
            </div>
          </div>
        </div>
      </div>
    `;
  }



  // ============================================================================
  // 3. DASHBOARD EJECUTIVO DE DIRECCIÓN (CARTERA REAL DE ALEJANDRO COSCOLIN)
  // ============================================================================
  function renderExecutiveDashboardView() {
    const enriched = EconState.studies.map(s => ({
      study: s,
      metrics: calculateStudyMetrics(s)
    }));

    const totalFacturacion = enriched.reduce((acc, x) => acc + x.metrics.facturacionAnual, 0);
    const totalBeneficio = enriched.reduce((acc, x) => acc + x.metrics.beneficioBrutoAnual, 0);
    const totalEbitda = enriched.reduce((acc, x) => acc + x.metrics.ebitdaNetoAnual, 0);
    const totalHoras = enriched.reduce((acc, x) => acc + x.metrics.totalHorasAnuales, 0);
    const margenMedio = totalFacturacion > 0 ? (totalBeneficio / totalFacturacion) * 100 : 0;

    const sortedByMarginDesc = [...enriched].sort((a, b) => b.metrics.margenBrutoPct - a.metrics.margenBrutoPct);
    const sortedByMarginAsc = [...enriched].sort((a, b) => a.metrics.margenBrutoPct - b.metrics.margenBrutoPct);

    const byType = {};
    enriched.forEach(({ study, metrics }) => {
      const t = study.tipoContrato || 'General';
      if (!byType[t]) byType[t] = { fact: 0, ben: 0, count: 0 };
      byType[t].fact += metrics.facturacionAnual;
      byType[t].ben += metrics.beneficioBrutoAnual;
      byType[t].count += 1;
    });

    return `
      <!-- KPIs GLOBALES DE DIRECCIÓN DE LA CARTERA DE ALEJANDRO COSCOLIN -->
      <div class="econ-kpi-grid">
        <div class="econ-kpi-box" style="border-top:4px solid #2563eb;">
          <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">Facturación Anual Cartera Coscolin</div>
          <div style="font-size:25px; font-weight:900; color:#0f172a; margin:6px 0;">${formatCurrency(totalFacturacion)}</div>
          <div style="font-size:11.5px; color:#2563eb; font-weight:700;">${formatCurrency(totalFacturacion / 12)} / mes · ${Math.round(totalHoras).toLocaleString('es-ES')} h/año</div>
        </div>

        <div class="econ-kpi-box" style="border-top:4px solid #10b981;">
          <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">Beneficio Bruto Total</div>
          <div style="font-size:25px; font-weight:900; color:#059669; margin:6px 0;">${formatCurrency(totalBeneficio)}</div>
          <div style="font-size:11.5px; color:#059669; font-weight:700;">+${formatCurrency(totalBeneficio / 12)} / mes · EBITDA: ${formatCurrency(totalEbitda)}</div>
        </div>

        <div class="econ-kpi-box" style="border-top:4px solid #8b5cf6;">
          <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">Margen Medio Ponderado</div>
          <div style="font-size:25px; font-weight:900; color:#6d28d9; margin:6px 0;">${margenMedio.toFixed(1)} %</div>
          <div style="font-size:11.5px; color:#64748b; font-weight:600;">Objetivo Delegación Barcelona (0801): 14,0 % - 15,0 %</div>
        </div>

        <div class="econ-kpi-box" style="border-top:4px solid #f59e0b;">
          <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;">Estudios Reales Sincronizados</div>
          <div style="font-size:25px; font-weight:900; color:#d97706; margin:6px 0;">${enriched.length}</div>
          <div style="font-size:11.5px; color:#64748b; font-weight:600;">${EconState.corporateStudies.length} Clientes Corp. · ${EconState.centerStudies.length} Centros SAP</div>
        </div>
      </div>

      <!-- CLIENTES MÁS RENTABLES VS MENOS RENTABLES + RENTABILIDAD POR TIPO DE SERVICIO -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:16px; margin-bottom:16px;">
        <!-- Clientes Más Rentables -->
        <div class="econ-card" style="margin-bottom:0;">
          <h3 style="margin:0 0 12px; font-size:15px; font-weight:900; color:#166534;">🟢 Top 5 Clientes Más Rentables (Alejandro Coscolin)</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${sortedByMarginDesc.slice(0, 5).map(({ study, metrics }) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:9px 12px; cursor:pointer;" onclick="window.EstudioEconomicoModule.cargarEstudio('${study.id}')">
                <div>
                  <div style="font-size:12.5px; font-weight:800; color:#0f172a;">${escapeHtml(study.cliente)}</div>
                  <div style="font-size:11px; color:#475569;">${escapeHtml(study.servicio.slice(0, 48))} · ${formatCurrency(metrics.facturacionAnual)}/año</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:15px; font-weight:900; color:#15803d;">${metrics.margenBrutoPct.toFixed(1)}%</div>
                  <div style="font-size:10.5px; color:#166534; font-weight:700;">+${formatCurrency(metrics.beneficioBrutoAnual)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Clientes Menos Rentables / Con Bajas IT Activas -->
        <div class="econ-card" style="margin-bottom:0;">
          <h3 style="margin:0 0 12px; font-size:15px; font-weight:900; color:#b45309;">🟡 Top 5 Clientes con Menor Margen / Tensión IT</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${sortedByMarginAsc.slice(0, 5).map(({ study, metrics }) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:9px 12px; cursor:pointer;" onclick="window.EstudioEconomicoModule.cargarEstudio('${study.id}')">
                <div>
                  <div style="font-size:12.5px; font-weight:800; color:#0f172a;">${escapeHtml(study.cliente)}</div>
                  <div style="font-size:11px; color:#475569;">Abs: ${study.riesgos.absentismoPct}% ${metrics.bajasITActivas > 0 ? '· 🚑 ' + metrics.bajasITActivas + ' Baja(s) IT' : ''}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:15px; font-weight:900; color:${metrics.semaforoColor};">${metrics.margenBrutoPct.toFixed(1)}%</div>
                  <div style="font-size:10.5px; color:#78350f; font-weight:700;">${formatCurrency(metrics.beneficioBrutoAnual)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Rentabilidad Media por Tipo de Servicio -->
        <div class="econ-card" style="margin-bottom:0;">
          <h3 style="margin:0 0 12px; font-size:15px; font-weight:900; color:#1e3a8a;">🏢 Rentabilidad Media por Línea de Negocio SIFU</h3>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${Object.entries(byType).map(([tipo, info]) => {
              const mPct = info.fact > 0 ? (info.ben / info.fact) * 100 : 0;
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:800; margin-bottom:4px;">
                    <span>${escapeHtml(tipo)} (${info.count})</span>
                    <span style="color:#4f46e5;">${mPct.toFixed(1)}% · ${formatCurrency(info.ben)}</span>
                  </div>
                  <div style="height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                    <div style="height:100%; width:${Math.max(8, Math.min(100, (mPct / 25) * 100))}%; background:linear-gradient(90deg, #4f46e5, #06b6d4); border-radius:99px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- TABLA EJECUTIVA COMPLETA DE CLIENTES REALES DE ALEJANDRO COSCOLIN -->
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h3 style="margin:0; font-size:15.5px; font-weight:900;">🏆 Ranking Completo de Rentabilidad · Cartera Real de Alejandro Coscolin (${sortedByMarginDesc.length})</h3>
          <div style="display:flex; gap:8px;">
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.exportarCarteraCompletaExcel()">
              📊 Exportar Toda la Cartera (.xlsx)
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.nuevoEstudioEnBlanco()">
              ➕ Crear Estudio Licitación
            </button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="econ-excel-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Código / SAP</th>
                <th>Cliente Real / Servicio</th>
                <th>Línea / Estado</th>
                <th style="text-align:right;">Horas/Año</th>
                <th style="text-align:right;">Facturación Anual</th>
                <th style="text-align:right;">Costes Totales</th>
                <th style="text-align:right;">Beneficio Bruto</th>
                <th style="text-align:center;">Margen %</th>
                <th style="text-align:right;">Venta €/h</th>
                <th style="text-align:right;">Coste €/h</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${sortedByMarginDesc.map(({ study, metrics }, idx) => `
                <tr>
                  <td><b>#${idx + 1}</b></td>
                  <td>
                    <div style="font-family:monospace; font-weight:800; color:#312e81;">${escapeHtml(study.codigo)}</div>
                    <div style="font-family:monospace; font-size:10px; color:#0369a1;">${escapeHtml((study.proyectosSAP || []).slice(0, 2).join(', '))}</div>
                  </td>
                  <td>
                    <div style="font-weight:800; color:#0f172a;">${escapeHtml(study.cliente)}</div>
                    <div style="font-size:11px; color:#64748b;">${escapeHtml(study.servicio.slice(0, 58))}</div>
                  </td>
                  <td>
                    <span style="font-size:10.5px; font-weight:700; background:#f1f5f9; padding:2px 7px; border-radius:99px;">${escapeHtml(study.tipoContrato)}</span>
                    ${metrics.bajasITActivas > 0 ? `<span style="font-size:10px; font-weight:800; background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:99px; margin-left:4px;">🚑 ${metrics.bajasITActivas} IT</span>` : ''}
                  </td>
                  <td style="text-align:right; font-family:monospace;">${Math.round(metrics.totalHorasAnuales)} h</td>
                  <td style="text-align:right; font-weight:700;">${formatCurrency(metrics.facturacionAnual)}</td>
                  <td style="text-align:right; color:#64748b;">${formatCurrency(metrics.costesTotales)}</td>
                  <td style="text-align:right; font-weight:800; color:${metrics.beneficioBrutoAnual >= 0 ? '#15803d' : '#dc2626'};">${formatCurrency(metrics.beneficioBrutoAnual)}</td>
                  <td style="text-align:center;">
                    <span style="font-weight:900; padding:3px 9px; border-radius:99px; background:${metrics.semaforoBg}; color:${metrics.semaforoText};">
                      ${metrics.margenBrutoPct.toFixed(1)}%
                    </span>
                  </td>
                  <td style="text-align:right; font-family:monospace; font-weight:700;">${formatCurrencyDec(metrics.precioHora)}</td>
                  <td style="text-align:right; font-family:monospace; color:#dc2626;">${formatCurrencyDec(metrics.costeHora)}</td>
                  <td style="text-align:right;">
                    <button class="econ-btn" style="padding:4px 10px; font-size:11px;" onclick="window.EstudioEconomicoModule.cargarEstudio('${study.id}')">
                      📂 Escandallo
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // 4. HISTORIAL / CARTERA COMPLETA SINCRONIZADA DE ESTUDIOS ECONÓMICOS
  // ============================================================================
  function renderHistorialView() {
    const q = (EconState.searchQuery || '').toLowerCase().trim();
    const filtered = EconState.studies.filter(s => {
      if (EconState.filterTipo !== 'todos' && s.tipoContrato !== EconState.filterTipo) return false;
      if (q) {
        const proyTxt = (s.proyectosSAP || []).join(' ');
        const workerTxt = (s.trabajadores || []).map(w => w.puesto).join(' ');
        const txt = `${s.codigo} ${s.cliente} ${s.servicio} ${s.centro} ${s.tipoContrato} ${proyTxt} ${workerTxt}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });

    return `
      <div class="econ-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:900;">🗂️ Cartera Real Sincronizada de Alejandro Coscolin (${filtered.length} estudios)</h3>
            <p style="margin:3px 0 0; font-size:12px; color:#64748b;">Busca por cliente, código SAP (SVO/PROY), municipio u operario titular y abre su escandallo en tiempo real</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input type="text" class="econ-input" style="min-width:260px;" placeholder="🔍 Buscar cliente, SVO, operario..." value="${escapeHtml(EconState.searchQuery)}" oninput="window.EstudioEconomicoModule.setSearchQuery(this.value)">
            <button class="econ-btn" onclick="window.EstudioEconomicoModule.exportarCarteraCompletaExcel()">
              📊 Exportar Cartera (.xlsx)
            </button>
            <button class="econ-btn econ-btn-primary" onclick="window.EstudioEconomicoModule.nuevoEstudioEnBlanco()">
              ➕ Nuevo Estudio
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:14px;">
          ${filtered.map(s => {
            const m = calculateStudyMetrics(s);
            const proyStr = Array.isArray(s.proyectosSAP) ? s.proyectosSAP.slice(0, 3).join(', ') : '';
            return `
              <div style="background:#ffffff; border:1px solid #cbd5e1; border-top:4px solid ${m.semaforoColor}; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:6px; flex-wrap:wrap;">
                    <span style="font-size:10.5px; font-weight:800; color:#4f46e5; background:#eef2ff; padding:2px 8px; border-radius:6px; font-family:monospace;">
                      ${escapeHtml(s.codigo)} ${proyStr ? '· ' + escapeHtml(proyStr) : ''}
                    </span>
                    <span style="font-size:11px; font-weight:900; padding:3px 8px; border-radius:99px; background:${m.semaforoBg}; color:${m.semaforoText};">
                      Margen: ${m.margenBrutoPct.toFixed(1)}%
                    </span>
                  </div>
                  <div style="font-size:15px; font-weight:900; color:#0f172a;">${escapeHtml(s.cliente)}</div>
                  <div style="font-size:12px; font-weight:600; color:#475569; margin-top:2px;">${escapeHtml(s.servicio)}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:4px;">
                    📍 ${escapeHtml(s.centro)} · 👥 ${m.numTrabajadores} op. (${Math.round(m.totalHorasMensuales)}h/mes)
                    ${m.bajasITActivas > 0 ? `<span style="color:#dc2626; font-weight:800;"> · 🚑 ${m.bajasITActivas} Baja IT</span>` : ''}
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; background:#f8fafc; padding:8px; border-radius:8px; text-align:center; font-size:11px;">
                  <div>
                    <span style="color:#64748b; display:block; font-size:9.5px;">FACTURACIÓN</span>
                    <b>${formatCurrency(m.facturacionAnual)}</b>
                  </div>
                  <div>
                    <span style="color:#64748b; display:block; font-size:9.5px;">COSTES</span>
                    <b>${formatCurrency(m.costesTotales)}</b>
                  </div>
                  <div>
                    <span style="color:#64748b; display:block; font-size:9.5px;">BENEFICIO</span>
                    <b style="color:${m.beneficioBrutoAnual >= 0 ? '#15803d' : '#dc2626'};">${formatCurrency(m.beneficioBrutoAnual)}</b>
                  </div>
                </div>

                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button class="econ-btn econ-btn-primary" style="flex:1; justify-content:center;" onclick="window.EstudioEconomicoModule.cargarEstudio('${s.id}')">
                    ✏️ Abrir Escandallo
                  </button>
                  <button class="econ-btn" onclick="window.EstudioEconomicoModule.duplicarEstudio('${s.id}')" title="Duplicar estudio">
                    📑
                  </button>
                  <button class="econ-btn" onclick="window.EstudioEconomicoModule.enviarAComparador('${s.id}')" title="Comparar con el estudio actual">
                    ⚖️ Comparar
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // 5. COMPARADOR DE ESTUDIOS LADO A LADO
  // ============================================================================
  function renderComparativaView() {
    const studyA = EconState.studies.find(s => s.id === EconState.compareIdA) || EconState.studies[0] || EconState.currentDraft;
    const studyB = EconState.studies.find(s => s.id === EconState.compareIdB) || EconState.studies[1] || EconState.currentDraft;

    const mA = calculateStudyMetrics(studyA);
    const mB = calculateStudyMetrics(studyB);

    const rows = [
      { label: 'Proyectos SAP Vinculados', valA: (studyA.proyectosSAP || []).join(', ') || '—', valB: (studyB.proyectosSAP || []).join(', ') || '—', diff: '—' },
      { label: 'Facturación Anual (€)', valA: formatCurrency(mA.facturacionAnual), valB: formatCurrency(mB.facturacionAnual), diff: formatCurrency(mB.facturacionAnual - mA.facturacionAnual) },
      { label: 'Facturación Mensual (€)', valA: formatCurrency(mA.facturacionMensual), valB: formatCurrency(mB.facturacionMensual), diff: formatCurrency(mB.facturacionMensual - mA.facturacionMensual) },
      { label: 'N.º de Líneas / Trabajadores', valA: `${mA.numTrabajadores} op.`, valB: `${mB.numTrabajadores} op.`, diff: `${mB.numTrabajadores - mA.numTrabajadores} op.` },
      { label: 'Horas Totales Anuales', valA: `${Math.round(mA.totalHorasAnuales)} h`, valB: `${Math.round(mB.totalHorasAnuales)} h`, diff: `${Math.round(mB.totalHorasAnuales - mA.totalHorasAnuales)} h` },
      { label: 'Coste Laboral Total (€)', valA: formatCurrency(mA.costeLaboralTotal), valB: formatCurrency(mB.costeLaboralTotal), diff: formatCurrency(mB.costeLaboralTotal - mA.costeLaboralTotal) },
      { label: 'Coste Operativo Total (€)', valA: formatCurrency(mA.costeOperativoTotal), valB: formatCurrency(mB.costeOperativoTotal), diff: formatCurrency(mB.costeOperativoTotal - mA.costeOperativoTotal) },
      { label: 'Costes Totales (€)', valA: formatCurrency(mA.costesTotales), valB: formatCurrency(mB.costesTotales), diff: formatCurrency(mB.costesTotales - mA.costesTotales) },
      { label: 'Beneficio Bruto Anual (€)', valA: formatCurrency(mA.beneficioBrutoAnual), valB: formatCurrency(mB.beneficioBrutoAnual), diff: formatCurrency(mB.beneficioBrutoAnual - mA.beneficioBrutoAnual) },
      { label: 'Margen Bruto Operativo (%)', valA: `${mA.margenBrutoPct.toFixed(2)} %`, valB: `${mB.margenBrutoPct.toFixed(2)} %`, diff: `${(mB.margenBrutoPct - mA.margenBrutoPct >= 0 ? '+' : '')}${(mB.margenBrutoPct - mA.margenBrutoPct).toFixed(2)} pp` },
      { label: 'EBITDA Neto tras Estructura (%)', valA: `${mA.ebitdaNetoPct.toFixed(2)} %`, valB: `${mB.ebitdaNetoPct.toFixed(2)} %`, diff: `${(mB.ebitdaNetoPct - mA.ebitdaNetoPct >= 0 ? '+' : '')}${(mB.ebitdaNetoPct - mA.ebitdaNetoPct).toFixed(2)} pp` },
      { label: 'Precio Hora Venta (€/h)', valA: formatCurrencyDec(mA.precioHora), valB: formatCurrencyDec(mB.precioHora), diff: formatCurrencyDec(mB.precioHora - mA.precioHora) },
      { label: 'Coste Hora Total (€/h)', valA: formatCurrencyDec(mA.costeHora), valB: formatCurrencyDec(mB.costeHora), diff: formatCurrencyDec(mB.costeHora - mA.costeHora) },
      { label: 'Beneficio Neto por Hora (€/h)', valA: formatCurrencyDec(mA.beneficioHora), valB: formatCurrencyDec(mB.beneficioHora), diff: formatCurrencyDec(mB.beneficioHora - mA.beneficioHora) }
    ];

    return `
      <div class="econ-card">
        <h3 style="margin:0 0 14px; font-size:16px; font-weight:900;">⚖️ Comparativa Ejecutiva entre Clientes de Alejandro Coscolin</h3>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
          <div class="econ-field">
            <label>Cliente / Estudio Base (Columna A)</label>
            <select class="econ-select" onchange="window.EstudioEconomicoModule.setCompareStudy('A', this.value)">
              ${EconState.studies.map(s => `<option value="${s.id}" ${s.id === studyA.id ? 'selected' : ''}>${escapeHtml(s.codigo)} — ${escapeHtml(s.cliente)}</option>`).join('')}
            </select>
          </div>
          <div class="econ-field">
            <label>Cliente / Estudio a Comparar (Columna B)</label>
            <select class="econ-select" onchange="window.EstudioEconomicoModule.setCompareStudy('B', this.value)">
              ${EconState.studies.map(s => `<option value="${s.id}" ${s.id === studyB.id ? 'selected' : ''}>${escapeHtml(s.codigo)} — ${escapeHtml(s.cliente)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="econ-excel-table">
            <thead>
              <tr>
                <th>Indicador Financiero</th>
                <th style="text-align:right;">🅰️ ${escapeHtml(studyA.cliente)}</th>
                <th style="text-align:right;">🅱️ ${escapeHtml(studyB.cliente)}</th>
                <th style="text-align:right;">Diferencia (B vs A)</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><b>${r.label}</b></td>
                  <td style="text-align:right; font-weight:700;">${r.valA}</td>
                  <td style="text-align:right; font-weight:700;">${r.valB}</td>
                  <td style="text-align:right; font-weight:800; color:#4f46e5;">${r.diff}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Actualización quirúrgica sin perder el foco del input activo
  function refreshCalculationsInPlace() {
    const draft = EconState.currentDraft;
    const m = calculateStudyMetrics(draft);

    const sidebar = document.getElementById('econ-realtime-sidebar');
    if (sidebar) {
      sidebar.innerHTML = renderRealtimeSidebarContent(draft, m);
    }

    const chartsEl = document.getElementById('econ-visual-charts-section');
    if (chartsEl) {
      chartsEl.outerHTML = renderVisualChartsSection(draft, m);
    }
    const simEl = document.getElementById('econ-simulator-section');
    if (simEl) {
      simEl.outerHTML = renderSimulatorSection(draft, m);
    }
    const aiEl = document.getElementById('econ-ai-conclusion-section');
    if (aiEl) {
      aiEl.outerHTML = renderAIConclusionSection(draft, m);
    }

    const pHora = document.getElementById('econ-step2-precio-hora');
    if (pHora) pHora.textContent = formatCurrencyDec(m.precioHora) + '/h';
    const cHora = document.getElementById('econ-step2-coste-hora');
    if (cHora) cHora.textContent = formatCurrencyDec(m.costeHora) + '/h';
    const totCto = document.getElementById('econ-step2-total-contrato');
    if (totCto) totCto.textContent = formatCurrency(m.facturacionMensual * (Number(draft.duracionMeses) || 12));

    const step3Tot = document.getElementById('econ-step3-total-personal');
    if (step3Tot) step3Tot.textContent = `${formatCurrency(m.costePersonalDirecto)}/año`;

    (draft.trabajadores || []).forEach((w, idx) => {
      const subEl = document.getElementById(`econ-worker-subtotal-${idx}`);
      if (subEl) {
        const sub = calculateWorkerSubtotal(w);
        subEl.textContent = `Coste Neto: ${formatCurrency(sub.costeDirectoAnual)}/año (${formatCurrency(sub.costeDirectoMensual)}/mes)`;
      }
    });

    const step4Tot = document.getElementById('econ-step4-total-op');
    if (step4Tot) step4Tot.textContent = `${formatCurrency(m.costeOperativoTotal)}/año (${formatCurrency(m.costeOperativoTotal / 12)}/mes)`;

    const step5Tot = document.getElementById('econ-step5-total-riesgos');
    if (step5Tot) step5Tot.textContent = `Provisión Total Riesgos: ${formatCurrency(m.costeRiesgosYProvisiones)}/año`;

    const lblAbs = document.getElementById('econ-lbl-absentismo');
    if (lblAbs) lblAbs.textContent = `${draft.riesgos.absentismoPct}% (${formatCurrency(m.costeAbsentismo)}/año)`;
    const lblIpc = document.getElementById('econ-lbl-ipc');
    if (lblIpc) lblIpc.textContent = `${draft.riesgos.ipcPct}%`;
    const lblConv = document.getElementById('econ-lbl-convenio');
    if (lblConv) lblConv.textContent = `${draft.riesgos.incrementoConvenioPct}% (${formatCurrency(m.costeIncrementoConvenio)}/año)`;
    const lblVac = document.getElementById('econ-lbl-vacaciones');
    if (lblVac) lblVac.textContent = `${draft.riesgos.sustitucionVacacionesPct}% (${formatCurrency(m.costeSustitucionVacaciones)}/año)`;
    const lblDesv = document.getElementById('econ-lbl-desvinc');
    if (lblDesv) lblDesv.textContent = `${draft.riesgos.desvinculacionesNum} operario(s) (${formatCurrency(m.costeDesvinculaciones)}/año)`;
  }

  function fullRerenderModule() {
    const root = document.getElementById('econ-saas-root-container');
    if (root && root.parentElement) {
      root.outerHTML = window.renderEstudioEconomicoDashboardView();
    } else if (window.renderAppShell) {
      window.renderAppShell();
    }
  }

  function notify(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'bg-blue');
    } else if (typeof window.showSupervisorToast === 'function') {
      window.showSupervisorToast(msg, 'info');
    } else {
      console.log(msg);
    }
  }

  // ============================================================================
  // API PÚBLICA DEL MÓDULO ESTUDIO ECONÓMICO (SINCRONIZADO EN TIEMPO REAL)
  // ============================================================================
  window.EstudioEconomicoModule = {
    setGestorFilter(gId) {
      EconState.gestorFilter = gId || 'todos';
      fullRerenderModule();
      const gestorObj = GESTORES_BCN_ECON.find(g => g.id === gId);
      const nombre = gestorObj ? gestorObj.nombre : gId;
      notify(`👔 Filtrando estudios económicos por Gestor: ${nombre}`);
    },

    importarDesdeCartera(idx) {
      const dataList = (window.INITIAL_MASTER_DATA && window.INITIAL_MASTER_DATA.length)
        ? window.INITIAL_MASTER_DATA
        : (window.AppState && window.AppState.filteredData ? window.AppState.filteredData : []);
      const item = dataList[idx] || dataList[0];
      if (!item) {
        notify('⚠️ No se encontró el servicio solicitado en la cartera.');
        return;
      }
      const cli = item['SERVICIO'] || item.cliente || item.nombreServicio || 'Cliente Barcelona';
      const srv = item['TIPO S'] || item.nombreServicio || item.servicio || cli;
      const proy = item['PROYECTO'] || item.proyecto || 'SAP-HO';
      const dir = item['S DIRECCION'] || item.direccion || 'Barcelona';

      const study = {
        id: 'est_imp_' + Date.now(),
        codigo: 'ESC-' + (proy.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'BCN'),
        isLiveSynced: false,
        scopeMode: 'custom',
        fechaCreacion: new Date().toISOString().slice(0, 10),
        cliente: cli,
        servicio: srv,
        centro: dir,
        responsable: item.gestor || RESPONSABLE_OFICIAL,
        fechaInicio: new Date().toISOString().slice(0, 10),
        duracionMeses: 12,
        tipoContrato: item.categoria || 'Limpieza',
        tipoFacturacion: 'Cuota Fija Mensual',
        proyectosSAP: [proy],
        numCentrosAgrupados: 1,
        facturacionAnual: 24000,
        facturacionMensual: 2000,
        trabajadores: [
          {
            id: 'w_imp_1',
            puesto: item.titular || 'Operario/a Asignado/a',
            titularNombre: item.titular || 'Operario/a Titular',
            suplenteNombre: item.suplente || '',
            estadoOperativo: item.estado || 'CUBIERTO',
            enBajaIT: item.estado === 'BAJA_IT',
            proyectoSAP: proy,
            horarioReal: item.horario || 'L-V 38.5h/sem',
            sociedad: 'SIFU, S.L.',
            esCEE: false,
            categoria: 'Limpiador/a',
            jornadaPct: 100,
            horasSemanales: 38.5,
            salarioBrutoAnual: 16680,
            segSocialPct: 33.5,
            antiguedadAnual: 0,
            plusesAnuales: 0
          }
        ],
        costesOperativos: {
          quimicosLimpieza: 600,
          celulosaConsumibles: 300,
          maquinariaAmortizacion: 400,
          episVestuario: 200,
          combustibleDesplazamientos: 300,
          gestionResiduos: 100,
          segurosResponsabilidad: 150,
          otrosCostesDirectos: 100
        },
        riesgos: {
          absentismoPct: 4.5,
          ipcPct: 2.6,
          incrementoConvenioPct: 3.0,
          sustitucionVacacionesPct: 85,
          desvinculacionesNum: 0
        }
      };

      EconState.currentDraft = study;
      EconState.subView = 'excel_grid';
      fullRerenderModule();
      notify(`💎 Servicio "${cli}" importado exitosamente al Escandallo.`);
    },

    importarDesdeCarteraBarcelona(idx) {
      this.importarDesdeCartera(idx);
    },
    importarDesdeCarteraGirona(idx) {
      this.importarDesdeCartera(idx);
    },

    setSubView(view) {
      EconState.subView = view;
      fullRerenderModule();
    },

    setPortfolioGranularity(mode) {
      EconState.portfolioGranularity = mode === 'centros' ? 'centros' : 'corporativo';
      refreshLivePortfolioState(false);
      fullRerenderModule();
      notify(mode === 'centros'
        ? `📍 Vista detallada activada: ${EconState.centerStudies.length} Centros / Proyectos SAP reales de Alejandro Coscolin.`
        : `🏢 Vista corporativa activada: ${EconState.corporateStudies.length} Clientes Corporativos consolidados de Alejandro Coscolin.`);
    },

    async sincronizarCarteraEnVivo() {
      EconState.isSyncingLive = true;
      fullRerenderModule();
      try {
        // Intentar sincronizar con el puente local SAP HO si está disponible
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        await fetch('http://127.0.0.1:5005/status', { signal: controller.signal }).catch(() => {});
        clearTimeout(timer);
      } catch (e) {}

      refreshLivePortfolioState(true);
      EconState.isSyncingLive = false;
      fullRerenderModule();
      notify(`🟢 Cartera real de ${RESPONSABLE_OFICIAL} sincronizada (${EconState.corporateStudies.length} Clientes / ${EconState.centerStudies.length} Centros SAP).`);
    },

    restaurarDatosSAPOriginales() {
      const id = EconState.currentDraft && EconState.currentDraft.id;
      if (!id) return;
      try {
        const rawOv = localStorage.getItem(STORAGE_KEY_OVERRIDES);
        if (rawOv) {
          const parsed = JSON.parse(rawOv) || {};
          delete parsed[id];
          localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(parsed));
        }
      } catch (e) {}
      refreshLivePortfolioState(true);
      fullRerenderModule();
      notify('♻️ Datos restaurados a los valores originales en tiempo real de SAP HO y Master Data.');
    },

    setWizardStep(step) {
      EconState.wizardStep = Math.max(1, Math.min(5, step));
      EconState.showAllStepsInOne = false;
      fullRerenderModule();
    },

    toggleShowAllSteps() {
      EconState.showAllStepsInOne = !EconState.showAllStepsInOne;
      fullRerenderModule();
    },

    toggleFullscreen() {
      EconState.isFullscreen = !EconState.isFullscreen;
      if (EconState.isFullscreen && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!EconState.isFullscreen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      fullRerenderModule();
    },

    updateField(key, val) {
      EconState.currentDraft[key] = val;
      refreshCalculationsInPlace();
    },

    updateFacturacion(source, rawVal) {
      const val = Math.max(0, Number(rawVal) || 0);
      if (source === 'mensual') {
        EconState.currentDraft.facturacionMensual = val;
        EconState.currentDraft.facturacionAnual = Math.round(val * 12 * 100) / 100;
        const anualInput = document.getElementById('econ-input-fact-anual');
        if (anualInput) anualInput.value = EconState.currentDraft.facturacionAnual;
      } else {
        EconState.currentDraft.facturacionAnual = val;
        EconState.currentDraft.facturacionMensual = Math.round((val / 12) * 100) / 100;
        const mensualInput = document.getElementById('econ-input-fact-mensual');
        if (mensualInput) mensualInput.value = EconState.currentDraft.facturacionMensual;
      }
      refreshCalculationsInPlace();
    },

    sugerirFacturacionObjetivo(targetMargenPct = 15) {
      const m = calculateStudyMetrics(EconState.currentDraft);
      const factor = 1 - (targetMargenPct / 100);
      const factAnualObjetivo = Math.ceil((m.costesTotales / factor) / 10) * 10;
      EconState.currentDraft.facturacionAnual = factAnualObjetivo;
      EconState.currentDraft.facturacionMensual = Math.round((factAnualObjetivo / 12) * 100) / 100;
      fullRerenderModule();
      notify(`🎯 Facturación ajustada a ${formatCurrency(factAnualObjetivo)}/año para lograr un ${targetMargenPct}% de margen bruto.`);
    },

    updateWorker(idx, key, rawVal) {
      const w = EconState.currentDraft.trabajadores[idx];
      if (!w) return;

      if (key === 'puesto' || key === 'categoria') {
        w[key] = rawVal;
        if (key === 'categoria') {
          const isCEE = rawVal.includes('CEE');
          w.esCEE = isCEE;
          w.segSocialPct = isCEE ? 11.5 : 33.5;
          fullRerenderModule();
          return;
        }
      } else {
        const num = Number(rawVal) || 0;
        w[key] = num;
        if (key === 'jornadaPct') {
          w.horasSemanales = Math.round((num / 100) * 38.5 * 10) / 10;
          w.salarioBrutoAnual = Math.round(16680 * (num / 100));
          const hInput = document.getElementById(`econ-w-horas-${idx}`);
          if (hInput) hInput.value = w.horasSemanales;
          const sInput = document.getElementById(`econ-w-salario-${idx}`);
          if (sInput) sInput.value = w.salarioBrutoAnual;
        } else if (key === 'horasSemanales') {
          w.jornadaPct = Math.min(100, Math.round((num / 38.5) * 1000) / 10);
          w.salarioBrutoAnual = Math.round(16680 * (w.jornadaPct / 100));
          const jInput = document.getElementById(`econ-w-jornada-${idx}`);
          if (jInput) jInput.value = w.jornadaPct;
          const sInput = document.getElementById(`econ-w-salario-${idx}`);
          if (sInput) sInput.value = w.salarioBrutoAnual;
        }
      }
      refreshCalculationsInPlace();
    },

    addWorker(tipo = 'estandar') {
      const isCEE = tipo === 'cee';
      EconState.currentDraft.trabajadores.push({
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        puesto: isCEE ? 'Operario/a CEE Bonificado (EPID)' : `Operario/a #${EconState.currentDraft.trabajadores.length + 1}`,
        titularNombre: isCEE ? 'Operario CEE' : 'Operario',
        suplenteNombre: '',
        estadoOperativo: 'CUBIERTO',
        enBajaIT: false,
        proyectoSAP: (EconState.currentDraft.proyectosSAP && EconState.currentDraft.proyectosSAP[0]) || 'SVO-BCN',
        horarioReal: 'L-V Según Cuadrante',
        sociedad: isCEE ? 'EPID, SL (CEE Bonificado)' : 'SIFU, S.L.',
        esCEE: isCEE,
        categoria: isCEE ? 'Limpiador/a CEE (EPID)' : 'Limpiador/a',
        jornadaPct: 100,
        horasSemanales: 38.5,
        salarioBrutoAnual: 16680,
        segSocialPct: isCEE ? 11.5 : 33.5,
        antiguedadAnual: 0,
        plusesAnuales: 300
      });
      fullRerenderModule();
    },

    removeWorker(idx) {
      if (EconState.currentDraft.trabajadores.length <= 1) {
        notify('⚠️ El estudio debe tener al menos 1 trabajador.');
        return;
      }
      EconState.currentDraft.trabajadores.splice(idx, 1);
      fullRerenderModule();
    },

    updateCosteOperativo(key, rawVal) {
      EconState.currentDraft.costesOperativos[key] = Math.max(0, Number(rawVal) || 0);
      refreshCalculationsInPlace();
    },

    autoEstimarCostesOperativos() {
      const m = calculateStudyMetrics(EconState.currentDraft);
      EconState.currentDraft.costesOperativos = estimateRealisticOperatingCosts(
        EconState.currentDraft.trabajadores || [],
        EconState.currentDraft.tipoContrato,
        m.totalHorasAnuales
      );
      fullRerenderModule();
      notify('⚡ Costes operativos recalculados según el estándar técnico de SIFU Barcelona (0801).');
    },

    updateRiesgo(key, rawVal) {
      EconState.currentDraft.riesgos[key] = Number(rawVal) || 0;
      refreshCalculationsInPlace();
    },

    applySimPreset(id, abs, sal, fact, hrs, amp) {
      if (EconState.simScenario.activePreset === id) {
        this.resetSimulator();
        return;
      }
      EconState.simScenario = {
        activePreset: id,
        deltaAbsentismoPct: abs,
        deltaSalarioPct: sal,
        deltaFacturacionPct: fact,
        deltaHorasPct: hrs,
        ampliacionMeses: amp
      };
      fullRerenderModule();
    },

    updateSimCustom(key, rawVal) {
      EconState.simScenario.activePreset = 'custom';
      EconState.simScenario[key] = Number(rawVal) || 0;
      refreshCalculationsInPlace();
    },

    resetSimulator() {
      EconState.simScenario = {
        activePreset: null,
        deltaAbsentismoPct: 0,
        deltaSalarioPct: 0,
        deltaFacturacionPct: 0,
        deltaHorasPct: 0,
        ampliacionMeses: 0
      };
      fullRerenderModule();
    },

    nuevoEstudioEnBlanco() {
      EconState.currentDraft = createBlankDraft();
      EconState.subView = 'wizard';
      EconState.wizardStep = 1;
      fullRerenderModule();
      notify('✨ Nuevo estudio económico de licitación listo para completar.');
    },

    guardarEstudioActual() {
      const draft = JSON.parse(JSON.stringify(EconState.currentDraft));
      if (draft.isLiveSynced) {
        try {
          const rawOv = localStorage.getItem(STORAGE_KEY_OVERRIDES);
          const overrides = rawOv ? JSON.parse(rawOv) : {};
          overrides[draft.id] = draft;
          localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));
        } catch (e) {}
      } else {
        const idx = EconState.customStudies.findIndex(s => s.id === draft.id);
        if (idx >= 0) EconState.customStudies[idx] = draft;
        else EconState.customStudies.unshift(draft);
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(EconState.customStudies));
        } catch (e) {}
      }
      refreshLivePortfolioState(true);
      notify(`💾 Estudio "${draft.cliente}" guardado y sincronizado.`);
      fullRerenderModule();
    },

    cargarEstudio(id) {
      const found = EconState.studies.find(s => s.id === id) ||
                    EconState.corporateStudies.find(s => s.id === id) ||
                    EconState.centerStudies.find(s => s.id === id);
      if (!found) return;
      EconState.currentDraft = JSON.parse(JSON.stringify(found));
      if (EconState.subView === 'dashboard' || EconState.subView === 'historial') {
        EconState.subView = 'wizard';
      }
      EconState.wizardStep = 1;
      fullRerenderModule();
    },

    duplicarEstudio(id) {
      const base = EconState.studies.find(s => s.id === id) || EconState.currentDraft;
      if (!base) return;
      const copy = JSON.parse(JSON.stringify(base));
      copy.id = 'est_custom_' + Date.now();
      copy.isLiveSynced = false;
      copy.codigo = 'ESC-SIM-' + String(Math.floor(Math.random() * 900) + 100);
      copy.cliente = copy.cliente + ' (Simulación)';
      copy.fechaCreacion = new Date().toISOString().slice(0, 10);
      EconState.customStudies.unshift(copy);
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(EconState.customStudies));
      } catch (e) {}
      refreshLivePortfolioState(false);
      EconState.currentDraft = JSON.parse(JSON.stringify(copy));
      EconState.subView = 'wizard';
      fullRerenderModule();
      notify(`📑 Estudio duplicado como "${copy.codigo}".`);
    },

    enviarAComparador(id) {
      EconState.compareIdA = EconState.currentDraft.id;
      EconState.compareIdB = id;
      EconState.subView = 'comparativa';
      fullRerenderModule();
    },

    setCompareStudy(slot, id) {
      if (slot === 'A') EconState.compareIdA = id;
      else EconState.compareIdB = id;
      fullRerenderModule();
    },

    setSearchQuery(val) {
      EconState.searchQuery = val;
      fullRerenderModule();
    },

    copiarConclusion() {
      this.copiarConclusionIA();
    },

    copiarConclusionIA() {
      const m = calculateStudyMetrics(EconState.currentDraft);
      const ai = generateAIExecutiveConclusion(EconState.currentDraft, m);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ai.textoPlano).then(() => {
          notify('📋 Dictamen ejecutivo copiado al portapapeles.');
        }).catch(() => {});
      }
    },

    exportarCarteraCompletaExcel() {
      if (!window.XLSX) {
        notify('⚠️ Librería XLSX no disponible.');
        return;
      }
      const wb = window.XLSX.utils.book_new();
      const rows = EconState.studies.map((s, idx) => {
        const m = calculateStudyMetrics(s);
        return {
          'Ranking': idx + 1,
          'Código': s.codigo,
          'Proyectos SAP': (s.proyectosSAP || []).join(', '),
          'Cliente Real': s.cliente,
          'Servicio': s.servicio,
          'Centro / Comarca': s.centro,
          'Responsable': s.responsable,
          'Línea Contrato': s.tipoContrato,
          'N.º Operarios': m.numTrabajadores,
          'Bajas IT Activas': m.bajasITActivas,
          'Horas Anuales': Math.round(m.totalHorasAnuales),
          'Facturación Mensual (€)': Number(m.facturacionMensual.toFixed(2)),
          'Facturación Anual (€)': Number(m.facturacionAnual.toFixed(2)),
          'Coste Laboral Total (€)': Number(m.costeLaboralTotal.toFixed(2)),
          'Coste Operativo Total (€)': Number(m.costeOperativoTotal.toFixed(2)),
          'Costes Totales (€)': Number(m.costesTotales.toFixed(2)),
          'Beneficio Bruto Anual (€)': Number(m.beneficioBrutoAnual.toFixed(2)),
          'Margen Bruto (%)': Number(m.margenBrutoPct.toFixed(2)),
          'EBITDA Neto (€)': Number(m.ebitdaNetoAnual.toFixed(2)),
          'EBITDA (%)': Number(m.ebitdaNetoPct.toFixed(2)),
          'Precio Hora (€/h)': Number(m.precioHora.toFixed(2)),
          'Coste Hora (€/h)': Number(m.costeHora.toFixed(2))
        };
      });
      const ws = window.XLSX.utils.json_to_sheet(rows);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Cartera Alejandro Coscolin');
      window.XLSX.writeFile(wb, `Cartera_Estudios_Economicos_Alejandro_Coscolin_Barcelona_0801.xlsx`);
      notify('📊 Cartera completa de Alejandro Coscolin exportada a Excel (.xlsx).');
    },

    exportarExcelActual() {
      const s = EconState.currentDraft;
      const m = calculateStudyMetrics(s);
      const ai = generateAIExecutiveConclusion(s, m);

      if (window.XLSX) {
        const wb = window.XLSX.utils.book_new();
        const resumenRows = [
          { Concepto: 'Código Estudio', Valor: s.codigo },
          { Concepto: 'Proyectos SAP S/4HANA', Valor: (s.proyectosSAP || []).join(', ') },
          { Concepto: 'Cliente', Valor: s.cliente },
          { Concepto: 'Servicio', Valor: s.servicio },
          { Concepto: 'Centro de Trabajo', Valor: s.centro },
          { Concepto: 'Responsable Operativo', Valor: s.responsable },
          { Concepto: 'Duración (Meses)', Valor: s.duracionMeses },
          { Concepto: 'Horas Anuales Contratadas', Valor: Math.round(m.totalHorasAnuales) },
          { Concepto: 'Facturación Mensual (€)', Valor: Number(m.facturacionMensual.toFixed(2)) },
          { Concepto: 'Facturación Anual (€)', Valor: Number(m.facturacionAnual.toFixed(2)) },
          { Concepto: 'Coste Laboral Directo (€)', Valor: Number(m.costePersonalDirecto.toFixed(2)) },
          { Concepto: 'Provisión Vacaciones y Riesgos (€)', Valor: Number(m.costeRiesgosYProvisiones.toFixed(2)) },
          { Concepto: 'Coste Laboral Total (€)', Valor: Number(m.costeLaboralTotal.toFixed(2)) },
          { Concepto: 'Coste Operativo Total (€)', Valor: Number(m.costeOperativoTotal.toFixed(2)) },
          { Concepto: 'Costes Totales (€)', Valor: Number(m.costesTotales.toFixed(2)) },
          { Concepto: 'Beneficio Bruto Anual (€)', Valor: Number(m.beneficioBrutoAnual.toFixed(2)) },
          { Concepto: 'Margen Bruto Operativo (%)', Valor: Number(m.margenBrutoPct.toFixed(2)) },
          { Concepto: 'EBITDA Neto Anual (€)', Valor: Number(m.ebitdaNetoAnual.toFixed(2)) },
          { Concepto: 'EBITDA Neto (%)', Valor: Number(m.ebitdaNetoPct.toFixed(2)) },
          { Concepto: 'Precio Hora Venta (€/h)', Valor: Number(m.precioHora.toFixed(2)) },
          { Concepto: 'Coste Hora Break-Even (€/h)', Valor: Number(m.costeHora.toFixed(2)) },
          { Concepto: 'Beneficio Hora (€/h)', Valor: Number(m.beneficioHora.toFixed(2)) },
          { Concepto: 'Dictamen Técnico-Económico', Valor: ai.textoPlano.replace(/\n+/g, ' ') }
        ];
        const wsResumen = window.XLSX.utils.json_to_sheet(resumenRows);
        window.XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Escandallo');

        const personalRows = (s.trabajadores || []).map((w, i) => {
          const sub = calculateWorkerSubtotal(w);
          return {
            '#': i + 1,
            'ID SAP': w.idEmpleadoSAP || '—',
            'Proyecto SAP': w.proyectoSAP || '—',
            'Operario / Puesto': w.puesto,
            'Estado en Vivo': w.estadoOperativo || 'CUBIERTO',
            'Suplente Activo': w.suplenteNombre || '—',
            'Sociedad': w.sociedad || 'SIFU, S.L.',
            'Categoría': w.categoria,
            'Jornada %': w.jornadaPct,
            'Horas/Semana': w.horasSemanales,
            'Salario Bruto Anual (€)': w.salarioBrutoAnual,
            'Seg. Social %': w.segSocialPct,
            'Antigüedad (€)': w.antiguedadAnual,
            'Pluses (€)': w.plusesAnuales,
            'Bonificación CEE (€)': sub.subvencionCEEAnual,
            'Coste Neto Anual (€)': Number(sub.costeDirectoAnual.toFixed(2))
          };
        });
        const wsPersonal = window.XLSX.utils.json_to_sheet(personalRows);
        window.XLSX.utils.book_append_sheet(wb, wsPersonal, 'Plantilla SAP Asignada');

        window.XLSX.writeFile(wb, `Escandallo_${s.codigo}_${s.cliente.replace(/[^A-Za-z0-9]/g, '_').slice(0, 30)}.xlsx`);
        notify('📊 Libro Excel (.xlsx) del Estudio Económico exportado.');
      }
    },

    exportarPDFActual() {
      const s = EconState.currentDraft;
      const m = calculateStudyMetrics(s);
      const ai = generateAIExecutiveConclusion(s, m);
      const proyStr = (s.proyectosSAP || []).join(', ');

      const printWin = window.open('', '_blank', 'width=1020,height=820');
      if (!printWin) {
        window.print();
        return;
      }

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Estudio Económico ${escapeHtml(s.codigo)} - ${escapeHtml(s.cliente)}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 26px; }
            .hdr { background: #0f172a; color: #fff; padding: 18px 22px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11.5px; }
            th { background: #1e293b; color: #fff; text-align: left; padding: 7px 8px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
            .ai-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px; border-radius: 8px; margin-top: 16px; font-size: 12px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="hdr">
            <div>
              <div style="font-size:11px; color:#38bdf8; font-weight:bold;">GRUPO SIFU · DELEGACIÓN 0801 BARCELONA · RESPONSABLE: ${escapeHtml(s.responsable)}</div>
              <h1 style="margin:4px 0 0; font-size:19px;">ESTUDIO ECONÓMICO Y ESCANDALLO P&amp;L (${escapeHtml(s.codigo)})</h1>
              <div style="font-size:12px; color:#cbd5e1; margin-top:3px;">Cliente: <b>${escapeHtml(s.cliente)}</b> · SAP: <b>${escapeHtml(proyStr)}</b> · Centro: ${escapeHtml(s.centro)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:23px; font-weight:900; color:#4ade80;">Margen: ${m.margenBrutoPct.toFixed(1)}%</div>
              <div style="font-size:12px;">Beneficio Bruto: ${formatCurrency(m.beneficioBrutoAnual)}/año · EBITDA: ${m.ebitdaNetoPct.toFixed(1)}%</div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi"><small>FACTURACIÓN ANUAL</small><br><b style="font-size:16px;">${formatCurrency(m.facturacionAnual)}</b><br><small>${formatCurrency(m.facturacionMensual)}/mes</small></div>
            <div class="kpi"><small>COSTE LABORAL TOTAL</small><br><b style="font-size:16px;">${formatCurrency(m.costeLaboralTotal)}</b><br><small>${m.numTrabajadores} líneas (${Math.round(m.totalHorasAnuales)}h/año)</small></div>
            <div class="kpi"><small>COSTE OPERATIVO</small><br><b style="font-size:16px;">${formatCurrency(m.costeOperativoTotal)}</b><br><small>Materiales, EPIs y maquinaria</small></div>
            <div class="kpi"><small>UNIT ECONOMICS</small><br><b style="font-size:15px;">Venta: ${formatCurrencyDec(m.precioHora)}/h</b><br><small>Coste: ${formatCurrencyDec(m.costeHora)}/h · Neto: ${formatCurrencyDec(m.beneficioHora)}/h</small></div>
          </div>

          <h3>Desglose de Plantilla Real Asignada (SAP S/4HANA HO &amp; CMH)</h3>
          <table>
            <thead>
              <tr><th>ID SAP</th><th>Proyecto</th><th>Operario / Puesto</th><th>Estado</th><th>Sociedad</th><th>H/Sem</th><th>Salario Bruto</th><th>SS %</th><th>Coste Neto Anual</th></tr>
            </thead>
            <tbody>
              ${(s.trabajadores || []).map(w => {
                const sub = calculateWorkerSubtotal(w);
                return `<tr><td>${escapeHtml(w.idEmpleadoSAP || '—')}</td><td>${escapeHtml(w.proyectoSAP || '—')}</td><td>${escapeHtml(w.puesto)}</td><td>${escapeHtml(w.estadoOperativo || 'CUBIERTO')}</td><td>${escapeHtml(w.sociedad || 'SIFU')}</td><td>${w.horasSemanales}h (${w.jornadaPct}%)</td><td>${formatCurrency(w.salarioBrutoAnual)}</td><td>${w.segSocialPct}%</td><td><b>${formatCurrency(sub.costeDirectoAnual)}</b></td></tr>`;
              }).join('')}
            </tbody>
          </table>

          <div class="ai-box">
            <b>📊 DICTAMEN TÉCNICO-ECONÓMICO SIFU BARCELONA (0801):</b><br>
            ${ai.parrafos.map(p => `<p style="margin:6px 0;">${p}</p>`).join('')}
          </div>
          <script>setTimeout(() => { window.print(); }, 350);</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };
})();
