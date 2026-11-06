/**
 * ============================================================================
 * SIFU BARCELONA OPERACIONES — SECCIÓN 6. CLIENTES (6.1 INDRA ROC BORONAT)
 * Módulo de Gestión de Pliego Técnico, Edificio Interactivo de Plantas,
 * Frecuencias Operativas, Asignación de Operarios, Checklists y Pesajes.
 * Sede: INDRA ROC BORONAT (22@) · C/ Roc Boronat 133, Barcelona · SAP: PROY015730-P2-C018
 * ============================================================================
 */

(function () {
  'use strict';

  // Inyección de estilos de seguridad garantizados para evitar render sin CSS
  function ensureStylesInjected() {
    if (!document.getElementById('indra-safety-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'indra-safety-styles';
      styleEl.textContent = `
        #girona-pro-root .clientes-container, #bcn-pro-root .clientes-container, .clientes-container {
          background: #f8fafc !important;
          color: #1e293b !important;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        .indra-hero-card {
          background: linear-gradient(135deg, #0a2540 0%, #0033a0 50%, #001f66 100%) !important;
          border-radius: 16px !important;
          padding: 24px 28px !important;
          color: #ffffff !important;
          box-shadow: 0 10px 25px -5px rgba(0, 31, 102, 0.35) !important;
          margin-bottom: 20px !important;
        }
        .indra-btn {
          border-radius: 10px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          padding: 9px 16px !important;
          border: none !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  // 1. ESPECIFICACIONES TÉCNICAS DEL PLIEGO INDRA ROC BORONAT
  const INDRA_SPEC = {
    cliente: 'INDRA SOLUCIONES TECNOLOGIAS DE LA INFORMACION SL',
    clienteCorto: 'INDRA',
    centro: 'SEDE CORPORATIVA ROC BORONAT (BARCELONA 22@)',
    direccion: 'Carrer de Roc Boronat, 133, 08018 Barcelona',
    proyecto: 'PROY015730-P2-C018',
    superficieTotal: 8250, // 8.250 m²
    puestosTrabajo: 797,  // 797 puestos
    slaObjetivo: 98.5,    // SLA 98.5%
    plantasTotales: 8,    // Sótano (-1), PB y Plantas 1 a 6
    papeleraUnicaUds: 8,  // 8 islas por planta (cero papeleras individuales en mesas)
    responsableSifu: 'ALEJANDRO COSCOLIN PEREGRIN',
    jefeServicioEmail: 'operaciones.barcelona@gruposifu.com',
    emailIndraHorizontales: 'servhorizontales@indra.es',
    emailIndraMedioambiente: 'medioambiente@indra.es',
    telefonoEmergencias: '648 061 151'
  };

  // 2. EQUIPO OPERATIVO DISPONIBLE PARA ASIGNACIÓN
  const OPERARIOS_EQUIPO = [
    { id: 'op_marta', nombre: 'Marta Gómez', turno: 'Turno Mañana (06:00 - 14:00)', rol: 'Especialista Zonas Nobles & Aseos PB', telefono: '638 12 34 50' },
    { id: 'op_carlos', nombre: 'Carlos Benítez', turno: 'Turno Tarde (14:00 - 22:00)', rol: 'Operario Limpieza Técnica P1', telefono: '649 22 11 88' },
    { id: 'op_fatima', nombre: 'Fátima Zahra', turno: 'Turno Tarde (14:00 - 22:00)', rol: 'Operaria Limpieza Técnica P2', telefono: '671 90 44 21' },
    { id: 'op_ali', nombre: 'Ali S.', turno: 'Turno Tarde (14:00 - 22:00)', rol: 'Responsable Pesajes & Reciclaje P3', telefono: '618 33 55 92' },
    { id: 'op_laura', nombre: 'Laura Puig', turno: 'Turno Tarde (14:00 - 22:00)', rol: 'Especialista Puestos Open Space P4', telefono: '622 88 41 19' },
    { id: 'op_mohamed', nombre: 'Mohamed El Amrani', turno: 'Turno Tarde (14:00 - 22:00)', rol: 'Operario Zonas Comunes & Offices P5', telefono: '634 77 12 04' },
    { id: 'op_rosa', nombre: 'Rosa Soler', turno: 'Turno Mixto (10:00 - 18:00)', rol: 'Supervisora Protocolo Presidencia P6', telefono: '650 44 99 32' },
    { id: 'op_jordi', nombre: 'Jordi Roca', turno: 'Turno Mañana (06:00 - 14:00)', rol: 'Conductor Fregadora Industrial & Parking', telefono: '669 11 80 45' },
    { id: 'op_brigada', nombre: 'Equipo Especialista Brigada', turno: 'Fin de Semana / Festivos', rol: 'Tratamiento Rotativa & Alturas Fachada', telefono: '900 123 456' }
  ];

  // 3. ESTRUCTURA DE TODAS LAS PLANTAS DEL EDIFICIO
  const PLANTAS_DATA = [
    {
      id: 'p6',
      codigo: 'P6',
      nivel: 6,
      nombre: 'Planta 6ª (Ático / Presidencia)',
      uso: 'Dirección General, Consejo de Administración, Sala VIP y Salas de Juntas',
      superficie: 1150,
      puestos: 92,
      islas: 8,
      suelo: 'Madera noble tratada, moqueta de lana virgen y cristaleras panorámicas',
      operarioDefecto: 'Rosa Soler',
      caracteristica: 'Lucernario central acristalado, requiere protocolo de discreción ejecutiva'
    },
    {
      id: 'p5',
      codigo: 'P5',
      nivel: 5,
      nombre: 'Planta 5ª (Open Space & Comedor)',
      uso: 'Área de Desarrollo Software, Coworking de Planta y Gran Office/Comedor',
      superficie: 1150,
      puestos: 120,
      islas: 8,
      suelo: 'Vinilo continuo antibacteriano de alto tránsito y gres porcelánico en office',
      operarioDefecto: 'Mohamed El Amrani',
      caracteristica: 'Tráfico denso a la hora del almuerzo, requiere repaso intensivo de mesas y fregado'
    },
    {
      id: 'p4',
      codigo: 'P4',
      nivel: 4,
      nombre: 'Planta 4ª (Dirección Adjunta & Operaciones)',
      uso: 'Despachos de Gestión de Proyectos, Salas de Brainstorming y Open Space',
      superficie: 1150,
      puestos: 130,
      islas: 8,
      suelo: 'Moqueta acústica en losetas modulares y divisiones vidrieras de suelo a techo',
      operarioDefecto: 'Laura Puig',
      caracteristica: 'Aspirado con filtro HEPA indispensable para confort acústico y ambiental'
    },
    {
      id: 'p3',
      codigo: 'P3',
      nivel: 3,
      nombre: 'Planta 3ª (Labs & Servidores & Técnico)',
      uso: 'Laboratorios de Pruebas de Software, Racks Técnicos y Aulas de Formación',
      superficie: 1150,
      puestos: 140,
      islas: 8,
      suelo: 'Suelo técnico elevado antiestático ESD y pavimento vinílico conductivo',
      operarioDefecto: 'Ali S.',
      caracteristica: 'Prohibido uso de agua encharcada en salas técnicas; solo mopa de microfibra humedecida neutra'
    },
    {
      id: 'p2',
      codigo: 'P2',
      nivel: 2,
      nombre: 'Planta 2ª (Open Space Software & Cabinas)',
      uso: 'Equipos de Desarrollo Ágil, 8 Cabinas Telefónicas (Phone Booths) y Salas Sprint',
      superficie: 1150,
      puestos: 145,
      islas: 8,
      suelo: 'Moqueta técnica modular de fibra sintética y gres porcelánico en núcleos húmedos',
      operarioDefecto: 'Fátima Zahra',
      caracteristica: 'Desinfección de teclados de reserva común y tiradores de phone booths'
    },
    {
      id: 'p1',
      codigo: 'P1',
      nivel: 1,
      nombre: 'Planta 1ª (Open Space IT & Salas Reunión)',
      uso: 'Equipos de Soporte a Clientes e Infraestructuras Cloud, 6 Salas de Reunión',
      superficie: 1150,
      puestos: 135,
      islas: 8,
      suelo: 'Moqueta técnica en losetas desmontables y vinilo de alto impacto en pasillos',
      operarioDefecto: 'Carlos Benítez',
      caracteristica: 'Planta de alta rotación de visitas externas en salas frontales'
    },
    {
      id: 'pb',
      codigo: 'PB',
      nivel: 0,
      nombre: 'Planta Baja (Recepción, Auditorio & Tornos)',
      uso: 'Hall Principal, Mostrador de Recepción, Tornos de Acceso, Auditorio Central y Comedor',
      superficie: 1200,
      puestos: 35,
      islas: 8,
      suelo: 'Mármol travertino abrillantado, gres porcelánico de gran formato y tarima técnica',
      operarioDefecto: 'Marta Gómez',
      caracteristica: 'Zona noble y tarjeta de presentación de Indra; mantenimiento continuo de brillo y huellas'
    },
    {
      id: 'p-1',
      codigo: 'P-1',
      nivel: -1,
      nombre: 'Planta -1 (Sótano, Parking & Residuos)',
      uso: 'Aparcamiento corporativo, cuarto de compactador de residuos, almacenes y salas de calderas',
      superficie: 1150,
      puestos: 0,
      islas: 2,
      suelo: 'Pavimento continuo de hormigón pulido con tratamiento antipolvo de resina epoxi',
      operarioDefecto: 'Jordi Roca',
      caracteristica: 'Barrido mecanizado con fregadora automática aspirante y control de pesajes finales'
    }
  ];

  // 4. PLANTILLA MAESTRA DE TAREAS POR FRECUENCIA SEGÚN PLIEGO INDRA
  function generarTareasPlanta(planta) {
    const isP6 = planta.codigo === 'P6';
    const isPB = planta.codigo === 'PB';
    const isSotano = planta.codigo === 'P-1';

    return [
      // ☀️ DIARIAS
      {
        id: `${planta.id}_dia_1`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: 'Vaciado, higienización y reposición de las Islas de Papelera Única',
        detalle: `Retirada y segregación estricta en las ${planta.islas} islas de reciclaje (Papel/Cartón, Envases Ligeros, Orgánica y Resto). Puestos libres de papeleras individuales.`,
        norma: 'ISO 14001 / Pliego Cláusula 4.2'
      },
      {
        id: `${planta.id}_dia_2`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: 'Limpieza y desinfección completa de núcleos de aseos (2 intervenciones obligatorias)',
        detalle: 'Intervención de mañana (10:30h) y de tarde (16:30h): inodoros, urinarios, encimeras, grifería, espejos y fregado de suelo con bactericida ecológico.',
        norma: 'SLA Crítico Indra'
      },
      {
        id: `${planta.id}_dia_3`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: 'Reposición continua de consumibles con etiqueta europea Ecolabel',
        detalle: 'Abastecimiento garantizado de papel higiénico institucional bicapa, toallitas secamanos plegadas y jabón dermatológico en espuma neutro.',
        norma: 'Cero Roturas de Stock'
      },
      {
        id: `${planta.id}_dia_4`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: isSotano
          ? 'Barrido y fregado con máquina automática del parking y viales de maniobra'
          : `Limpieza del Office de la planta: encimeras, pilas, mesas y exterior de electrodomésticos`,
        detalle: isSotano
          ? 'Aspirado y barrido industrial de rampas de acceso y zona de contenedores de residuos.'
          : 'Desinfección de mesas, microondas, fuentes de agua osmótica y zona de máquinas de café.',
        norma: 'Higiene Alimentaria'
      },
      {
        id: `${planta.id}_dia_5`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: isSotano
          ? 'Vaciado y desinfección del cuarto de compactación de residuos'
          : `Repaso superficial de los ${planta.puestos} puestos de trabajo (Clean Desk Policy)`,
        detalle: isSotano
          ? 'Control de olores, desinfección química de tolvas y preparación para pesaje municipal.'
          : 'Limpieza de mesas despejadas con bayeta de microfibra humedecida en solución desinfectante neutra sin desplazar documentos.',
        norma: 'Confidencialidad Indra'
      },
      {
        id: `${planta.id}_dia_6`,
        freq: 'diaria',
        freqLabel: '☀️ Diaria',
        titulo: 'Barrido húmedo / mopa atrapapolvo de pasillos, tornos y núcleos de ascensores',
        detalle: 'Mopa de microfibra electrostática impregnada en seco para capturar polvo sin suspensión en suspensión aérea.',
        norma: 'Calidad de Aire Interior'
      },

      // 🌀 DÍAS ALTERNOS (L-X-V / M-J)
      {
        id: `${planta.id}_alt_1`,
        freq: 'alterna',
        freqLabel: '🌀 Días Alternos (L-X-V)',
        titulo: 'Aspirado mecánico exhaustivo de moquetas y alfombras con filtro HEPA',
        detalle: 'Pasada lenta y cruzada en todas las áreas enmoquetadas y accesos para retirada de ácaros y partículas finas.',
        norma: 'Mantenimiento Suelos'
      },
      {
        id: `${planta.id}_alt_2`,
        freq: 'alterna',
        freqLabel: '🌀 Días Alternos (M-J)',
        titulo: 'Limpieza y desinfección de salas de reuniones, phone booths y pizarras',
        detalle: 'Retirada de rotulador en pizarras blancas con spray específico, desinfección de mandos a distancia, teléfonos y mesas.',
        norma: 'Protocolo de Salas'
      },
      {
        id: `${planta.id}_alt_3`,
        freq: 'alterna',
        freqLabel: '🌀 Días Alternos (L-X-V)',
        titulo: 'Limpieza de mamparas acristaladas interiores y borrado de huellas dactilares',
        detalle: 'Bayeta especial para cristal y solución alcohólica rápida que no deja veladuras ni estelas.',
        norma: 'Estética Visual'
      },

      // 📅 SEMANALES
      {
        id: `${planta.id}_sem_1`,
        freq: 'semanal',
        freqLabel: '📅 Semanal (Miércoles/Viernes)',
        titulo: 'Limpieza a fondo y desincrustación biológica de aseos con producto antical',
        detalle: 'Tratamiento a fondo de juntas de azulejos, desincrustación química de cal en difusores de grifo e inodoros y desinfección de sifones.',
        norma: 'SLA Sanitario'
      },
      {
        id: `${planta.id}_sem_2`,
        freq: 'semanal',
        freqLabel: '📅 Semanal (Viernes Tarde)',
        titulo: 'Tratamiento y protección antihuellas de acero inoxidable y cabinas de ascensores',
        detalle: 'Aplicación de aceite protector abrillantador en embellecedores, puertas de ascensor, papeleras y botoneras metálicas.',
        norma: 'Conservación Metales'
      },
      {
        id: `${planta.id}_sem_3`,
        freq: 'semanal',
        freqLabel: '📅 Semanal (Miércoles)',
        titulo: 'Desempolvado en húmedo de armarios altos, archivadores superiores y extintores',
        detalle: 'Retirada de polvo acumulado en zonas altas inaccesibles en el repaso diario, marcos de puertas y señalizaciones de emergencia.',
        norma: 'Auditoría PRL'
      },

      // 🛠️ BRIGADAS Y PERIÓDICAS
      {
        id: `${planta.id}_brig_1`,
        freq: 'brigada',
        freqLabel: '🛠️ Semestral (Brigada SIFU)',
        titulo: 'Inyección-extracción térmica profunda de moqueta con neutralizador enzimático',
        detalle: 'Lavado mecánico con agua caliente y champú biodegradable para eliminación de manchas rebeldes y reactivación del pelo de la moqueta.',
        norma: 'Brigada Especialista'
      },
      {
        id: `${planta.id}_brig_2`,
        freq: 'brigada',
        freqLabel: '🛠️ Semestral (Brigada SIFU)',
        titulo: isPB
          ? 'Cristalizado y abrillantado de suelos duros (Mármol travertino) con máquina rotativa y lana de acero'
          : 'Decapado, encerado y sellado polimérico de pavimentos de alto tránsito',
        detalle: 'Tratamiento especializado con máquina rotativa de baja velocidad para sellado de poros y brillo espejo antideslizante.',
        norma: 'Certificación Suelos'
      },
      {
        id: `${planta.id}_brig_3`,
        freq: 'brigada',
        freqLabel: '🛠️ Trimestral (Brigada Alturas)',
        titulo: 'Limpieza de fachada muro cortina y cristales exteriores con pértiga de agua pura osmotizada',
        detalle: 'Intervención exterior mediante pértiga hidrodifusora de carbono y góndola suspendida homologada.',
        norma: 'Seguridad en Alturas'
      },
      ...(isP6 ? [{
        id: `${planta.id}_brig_p6_lucernario`,
        freq: 'brigada',
        freqLabel: '🛠️ Mensual (Especial P6)',
        titulo: 'Limpieza y aspirado técnico del gran lucernario central de la cubierta de Presidencia',
        detalle: 'Acceso seguro con línea de vida para desempolvado del domo acristalado y claraboyas cenitales.',
        norma: 'Presidencia Indra'
      }] : []),
      {
        id: `${planta.id}_brig_ddd`,
        freq: 'brigada',
        freqLabel: '🛠️ Trimestral (Sanidad Ambiental)',
        titulo: 'Tratamiento preventivo D.D.D. (Desratización, Desinsectación y Desinfección)',
        detalle: 'Revisión y reposición de cebaderos en arquetas, cuadros técnicos y emisión de certificado oficial de control de plagas.',
        norma: 'Certificado Sanitario'
      },
      {
        id: `${planta.id}_brig_anual`,
        freq: 'brigada',
        freqLabel: '🛠️ Anual (Agosto/Diciembre)',
        titulo: 'Limpieza y aspirado en seco de techos, difusores de climatización y luminarias en altura',
        detalle: 'Desmontaje y lavado de rejillas de aire acondicionado y aspirado de bandejas de falsos techos.',
        norma: 'Mantenimiento Preventivo'
      }
    ];
  }

  // 5. ESTADO CENTRALIZADO Y PERSISTENTE
  const ClientesState = {
    activeTab: 'plantas', // plantas | pliego | cuadrante | papelera | informe | catalogo
    selectedPlantaId: 'p6', // P6 por defecto (Ático / Presidencia)
    operariosAsignados: {}, // { 'p6': 'Rosa Soler', 'pb': 'Marta Gómez', ... }
    tareasStatus: {},       // { 'p6_dia_1': true, 'p6_dia_2': false, ... }
    pesajes: [
      { id: 1, fecha: '2026-10-23', planta: 'Planta 1', fraccion: 'Papel/Cartón', kg: 42.5, operario: 'Ali S.' },
      { id: 2, fecha: '2026-10-23', planta: 'Planta 2', fraccion: 'Envases Ligeros', kg: 18.2, operario: 'Ali S.' },
      { id: 3, fecha: '2026-10-22', planta: 'Planta 3', fraccion: 'Fracción Resto', kg: 26.0, operario: 'Ali S.' },
      { id: 4, fecha: '2026-10-22', planta: 'Planta Baja', fraccion: 'Orgánica (Office)', kg: 14.8, operario: 'Ali S.' },
      { id: 5, fecha: '2026-10-21', planta: 'Planta 4', fraccion: 'Papel/Cartón', kg: 38.0, operario: 'Ali S.' },
      { id: 6, fecha: '2026-10-21', planta: 'Planta 5', fraccion: 'Envases Ligeros', kg: 16.4, operario: 'Ali S.' }
    ]
  };

  // Inicializar asignaciones de operarios por defecto
  PLANTAS_DATA.forEach(p => {
    ClientesState.operariosAsignados[p.id] = p.operarioDefecto;
  });

  // Inicializar todas las tareas como pendientes o cumplidas
  PLANTAS_DATA.forEach(p => {
    const tareas = generarTareasPlanta(p);
    tareas.forEach((t, index) => {
      // Marcamos algunas como cumplidas para realismo operativo
      ClientesState.tareasStatus[t.id] = index < 4;
    });
  });

  // Cargar estado guardado de localStorage
  try {
    const savedOperarios = localStorage.getItem('sifu_indra_operarios_asignados_v2');
    if (savedOperarios) {
      ClientesState.operariosAsignados = Object.assign(ClientesState.operariosAsignados, JSON.parse(savedOperarios));
    }
    const savedTareas = localStorage.getItem('sifu_indra_planta_tasks_v2');
    if (savedTareas) {
      ClientesState.tareasStatus = Object.assign(ClientesState.tareasStatus, JSON.parse(savedTareas));
    }
    const savedPesajes = localStorage.getItem('sifu_indra_pesajes_v2');
    if (savedPesajes) {
      ClientesState.pesajes = JSON.parse(savedPesajes);
    }
  } catch (e) {
    console.warn('Error leyendo localStorage para Indra:', e);
  }

  function persistState() {
    try {
      localStorage.setItem('sifu_indra_operarios_asignados_v2', JSON.stringify(ClientesState.operariosAsignados));
      localStorage.setItem('sifu_indra_planta_tasks_v2', JSON.stringify(ClientesState.tareasStatus));
      localStorage.setItem('sifu_indra_pesajes_v2', JSON.stringify(ClientesState.pesajes));
    } catch (e) {
      console.warn('Error guardando en localStorage para Indra:', e);
    }
  }

  // 6. CÁLCULO DE MÉTRICAS GLOBALES
  function calcularMetricasPlanta(plantaId) {
    const planta = PLANTAS_DATA.find(p => p.id === plantaId) || PLANTAS_DATA[0];
    const tareas = generarTareasPlanta(planta);
    const total = tareas.length;
    const cumplidas = tareas.filter(t => ClientesState.tareasStatus[t.id] === true).length;
    const pct = total > 0 ? Math.round((cumplidas / total) * 100) : 0;
    return { total, cumplidas, pct };
  }

  function calcularMetricasGlobales() {
    let totalTareas = 0;
    let totalCumplidas = 0;
    PLANTAS_DATA.forEach(p => {
      const m = calcularMetricasPlanta(p.id);
      totalTareas += m.total;
      totalCumplidas += m.cumplidas;
    });
    const pctGlobal = totalTareas > 0 ? Math.round((totalCumplidas / totalTareas) * 100) : 0;

    // Métricas de Pesajes
    const totalKg = ClientesState.pesajes.reduce((acc, p) => acc + (Number(p.kg) || 0), 0);
    const papelKg = ClientesState.pesajes.filter(p => p.fraccion.includes('Papel')).reduce((acc, p) => acc + (Number(p.kg) || 0), 0);
    const envasesKg = ClientesState.pesajes.filter(p => p.fraccion.includes('Envases')).reduce((acc, p) => acc + (Number(p.kg) || 0), 0);
    const organicaKg = ClientesState.pesajes.filter(p => p.fraccion.includes('Orgánica')).reduce((acc, p) => acc + (Number(p.kg) || 0), 0);
    const restoKg = ClientesState.pesajes.filter(p => p.fraccion.includes('Resto')).reduce((acc, p) => acc + (Number(p.kg) || 0), 0);
    const tasaReciclaje = totalKg > 0 ? Math.round(((papelKg + envasesKg + organicaKg) / totalKg) * 100) : 0;

    return {
      totalTareas,
      totalCumplidas,
      pctGlobal,
      totalKg: totalKg.toFixed(1),
      papelKg: papelKg.toFixed(1),
      envasesKg: envasesKg.toFixed(1),
      organicaKg: organicaKg.toFixed(1),
      restoKg: restoKg.toFixed(1),
      tasaReciclaje
    };
  }

  // 6.1 INYECCIÓN DE SEGURIDAD DE ESTILOS (Garantiza que la UI nunca se vea rota)
  function ensureStylesInjected() {
    if (document.getElementById('indra-injected-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'indra-injected-styles';
    styleEl.textContent = `
      .clientes-container { width: 100% !important; max-width: 1600px !important; margin: 0 auto !important; padding: 16px 20px 60px !important; font-family: 'Outfit', sans-serif !important; color: #0f172a !important; box-sizing: border-box !important; }
      .indra-hero-card { background: linear-gradient(135deg, #071e3d 0%, #0033a0 45%, #0284c7 100%) !important; border-radius: 16px !important; padding: 24px 28px !important; color: #ffffff !important; box-shadow: 0 12px 30px -6px rgba(0, 51, 160, 0.35) !important; margin-bottom: 22px !important; position: relative !important; overflow: hidden !important; }
      .indra-hero-content { display: flex !important; justify-content: space-between !important; align-items: center !important; flex-wrap: wrap !important; gap: 20px !important; position: relative !important; z-index: 2 !important; }
      .indra-hero-left { flex: 1 !important; min-width: 320px !important; }
      .indra-hero-badges { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; margin-bottom: 10px !important; }
      .indra-badge-pill { font-size: 11px !important; font-weight: 800 !important; padding: 4px 10px !important; border-radius: 6px !important; letter-spacing: 0.5px !important; }
      .indra-badge-pill.strategic { background: rgba(255, 255, 255, 0.18) !important; border: 1px solid rgba(255, 255, 255, 0.35) !important; color: #ffffff !important; }
      .indra-badge-pill.status-live { background: rgba(16, 185, 129, 0.25) !important; border: 1px solid rgba(16, 185, 129, 0.5) !important; color: #a7f3d0 !important; }
      .indra-badge-pill.sap { background: rgba(2, 132, 199, 0.35) !important; border: 1px solid rgba(56, 189, 248, 0.4) !important; color: #bae6fd !important; font-family: monospace !important; }
      .indra-hero-title { font-size: 26px !important; font-weight: 900 !important; color: #ffffff !important; margin: 0 0 8px 0 !important; letter-spacing: -0.5px !important; }
      .hub-name { font-size: 20px !important; font-weight: 700 !important; color: #93c5fd !important; }
      .indra-hero-desc { font-size: 13.5px !important; color: #e0f2fe !important; margin: 0 !important; line-height: 1.5 !important; max-width: 900px !important; }
      .indra-hero-actions { display: flex !important; gap: 10px !important; flex-wrap: wrap !important; }
      .indra-btn { display: inline-flex !important; align-items: center !important; gap: 8px !important; padding: 9px 16px !important; border-radius: 10px !important; font-size: 13px !important; font-weight: 800 !important; border: none !important; cursor: pointer !important; transition: all 0.2s ease !important; }
      .indra-btn-primary { background: #ffffff !important; color: #0033a0 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important; }
      .indra-btn-secondary { background: rgba(255, 255, 255, 0.15) !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.3) !important; }
      .indra-kpi-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important; gap: 14px !important; margin-bottom: 22px !important; }
      .indra-kpi-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 16px 20px !important; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04) !important; position: relative !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
      .indra-kpi-card-bar { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; height: 4px !important; }
      .indra-kpi-top { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 8px !important; }
      .indra-kpi-label { font-size: 11.5px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; color: #64748b !important; }
      .indra-kpi-icon-wrap { width: 32px !important; height: 32px !important; border-radius: 8px !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 15px !important; }
      .indra-kpi-value { font-size: 26px !important; font-weight: 900 !important; color: #0f172a !important; margin-bottom: 4px !important; line-height: 1.15 !important; }
      .indra-kpi-meta { font-size: 12px !important; color: #64748b !important; }
      .indra-nav-container { display: flex !important; gap: 10px !important; background: #ffffff !important; padding: 8px !important; border-radius: 14px !important; border: 1px solid #e2e8f0 !important; margin-bottom: 24px !important; overflow-x: auto !important; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important; }
      .indra-tab-pill { display: inline-flex !important; align-items: center !important; gap: 8px !important; padding: 10px 18px !important; border-radius: 10px !important; border: 1px solid transparent !important; background: #f8fafc !important; color: #475569 !important; font-size: 13px !important; font-weight: 800 !important; cursor: pointer !important; white-space: nowrap !important; transition: all 0.2s ease !important; }
      .indra-tab-pill:hover { background: #f1f5f9 !important; color: #0033a0 !important; border-color: #cbd5e1 !important; }
      .indra-tab-pill.active { background: #0033a0 !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(0, 51, 160, 0.3) !important; border-color: #0033a0 !important; }
      .pill-counter { background: rgba(0, 0, 0, 0.08) !important; padding: 2px 8px !important; border-radius: 10px !important; font-size: 11px !important; font-weight: 800 !important; margin-left: 4px !important; }
      .indra-tab-pill.active .pill-counter { background: rgba(255, 255, 255, 0.25) !important; color: #ffffff !important; }
      .indra-plantas-grid { display: grid !important; grid-template-columns: 340px 1fr !important; gap: 24px !important; align-items: start !important; }
      @media (max-width: 1024px) { .indra-plantas-grid { grid-template-columns: 1fr !important; } }
      .indra-building-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 16px !important; padding: 18px !important; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important; }
      .indra-building-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 12px !important; padding-bottom: 12px !important; border-bottom: 1px solid #f1f5f9 !important; }
      .indra-building-title { font-size: 13.5px !important; font-weight: 900 !important; color: #0033a0 !important; letter-spacing: 0.5px !important; margin: 0 !important; display: flex !important; align-items: center !important; gap: 6px !important; }
      .indra-building-badge { background: #e0f2fe !important; color: #0369a1 !important; font-size: 11px !important; font-weight: 800 !important; padding: 3px 8px !important; border-radius: 6px !important; }
      .indra-levels-list { display: flex !important; flex-direction: column !important; gap: 8px !important; }
      .indra-level-item { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 12px 14px !important; border-radius: 12px !important; background: #f8fafc !important; border: 1.5px solid #e2e8f0 !important; cursor: pointer !important; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important; }
      .indra-level-item:hover { background: #f0f9ff !important; border-color: #38bdf8 !important; transform: translateX(3px) !important; }
      .indra-level-item.active { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; border-color: #0033a0 !important; box-shadow: 0 4px 14px rgba(0, 51, 160, 0.15) !important; transform: translateX(4px) !important; }
      .indra-level-left { display: flex !important; align-items: center !important; gap: 12px !important; }
      .indra-level-num-badge { width: 34px !important; height: 34px !important; border-radius: 8px !important; background: #334155 !important; color: #ffffff !important; font-weight: 900 !important; font-size: 12.5px !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }
      .indra-level-item.active .indra-level-num-badge { background: #0033a0 !important; box-shadow: 0 2px 6px rgba(0, 51, 160, 0.4) !important; }
      .indra-level-name { font-size: 13.5px !important; font-weight: 800 !important; color: #0f172a !important; }
      .indra-level-item.active .indra-level-name { color: #0033a0 !important; font-weight: 900 !important; }
      .indra-level-sub { font-size: 11px !important; color: #64748b !important; margin-top: 2px !important; }
      .indra-level-right { display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 4px !important; }
      .indra-level-progress-pill { font-size: 11px !important; font-weight: 900 !important; padding: 2px 7px !important; border-radius: 6px !important; }
      .indra-level-worker { font-size: 11px !important; color: #475569 !important; font-weight: 600 !important; white-space: nowrap !important; max-width: 95px !important; overflow: hidden !important; text-overflow: ellipsis !important; }
      .indra-floor-detail { display: flex !important; flex-direction: column !important; gap: 20px !important; }
      .indra-floor-header-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 16px !important; padding: 22px 26px !important; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important; }
      .indra-floor-title-row { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; flex-wrap: wrap !important; gap: 14px !important; margin-bottom: 16px !important; }
      .indra-floor-main-title { font-size: 22px !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 6px 0 !important; display: flex !important; align-items: center !important; gap: 8px !important; }
      .indra-floor-desc { font-size: 13px !important; color: #475569 !important; margin: 0 !important; line-height: 1.5 !important; }
      .btn-quick-action { display: inline-flex !important; align-items: center !important; gap: 6px !important; padding: 8px 14px !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 800 !important; cursor: pointer !important; transition: all 0.2s ease !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important; color: #334155 !important; }
      .btn-quick-action:hover { background: #f8fafc !important; border-color: #94a3b8 !important; transform: translateY(-1px) !important; }
      .btn-quick-action.primary { background: #0033a0 !important; color: #ffffff !important; border-color: #0033a0 !important; }
      .indra-floor-meta-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important; gap: 12px !important; margin-bottom: 18px !important; }
      .indra-floor-meta-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px 14px !important; }
      .indra-floor-meta-lbl { font-size: 10.5px !important; font-weight: 800 !important; text-transform: uppercase !important; color: #64748b !important; letter-spacing: 0.5px !important; margin-bottom: 4px !important; }
      .indra-floor-meta-val { font-size: 14px !important; font-weight: 800 !important; color: #0f172a !important; }
      .indra-worker-assign-box { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%) !important; border: 1.5px solid #86efac !important; border-radius: 12px !important; padding: 14px 18px !important; margin-bottom: 18px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; flex-wrap: wrap !important; gap: 14px !important; }
      .indra-worker-left { display: flex !important; align-items: center !important; gap: 12px !important; }
      .indra-worker-avatar { width: 42px !important; height: 42px !important; border-radius: 50% !important; background: #15803d !important; color: #ffffff !important; font-size: 18px !important; font-weight: 900 !important; display: flex !important; align-items: center !important; justify-content: center !important; box-shadow: 0 4px 10px rgba(21, 128, 61, 0.25) !important; }
      .indra-worker-name { font-size: 14px !important; color: #14532d !important; }
      .indra-worker-sub { font-size: 12px !important; color: #166534 !important; margin-top: 2px !important; }
      .indra-worker-select-wrap { display: flex !important; align-items: center !important; gap: 8px !important; }
      .indra-select { padding: 7px 12px !important; border-radius: 8px !important; border: 1.5px solid #16a34a !important; background: #ffffff !important; font-size: 12.5px !important; font-weight: 700 !important; color: #14532d !important; outline: none !important; cursor: pointer !important; }
      .indra-progress-container { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px 14px !important; }
      .indra-progress-header { display: flex !important; justify-content: space-between !important; font-size: 12px !important; font-weight: 700 !important; color: #334155 !important; margin-bottom: 8px !important; }
      .indra-progress-bar-bg { height: 8px !important; background: #e2e8f0 !important; border-radius: 6px !important; overflow: hidden !important; }
      .indra-progress-bar-fill { height: 100% !important; background: linear-gradient(90deg, #10b981 0%, #059669 100%) !important; transition: width 0.3s ease !important; }
      .indra-tasks-frequency-group { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 16px !important; padding: 20px 22px !important; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important; }
      .indra-freq-header { display: flex !important; justify-content: space-between !important; align-items: center !important; flex-wrap: wrap !important; gap: 10px !important; padding-bottom: 14px !important; margin-bottom: 16px !important; border-bottom: 1px solid #f1f5f9 !important; }
      .indra-freq-title { display: flex !important; align-items: center !important; gap: 10px !important; flex-wrap: wrap !important; font-size: 13px !important; font-weight: 700 !important; color: #475569 !important; }
      .indra-freq-badge { font-size: 12px !important; font-weight: 900 !important; padding: 4px 12px !important; border-radius: 8px !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
      .badge-diaria { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; }
      .badge-alterna { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; }
      .badge-semanal { background: #f3e8ff !important; color: #6b21a8 !important; border: 1px solid #e9d5ff !important; }
      .badge-brigada { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fecaca !important; }
      .indra-freq-schedule { font-size: 11.5px !important; font-weight: 700 !important; color: #64748b !important; background: #f8fafc !important; padding: 3px 10px !important; border-radius: 6px !important; border: 1px solid #e2e8f0 !important; }
      .indra-tasks-list { display: flex !important; flex-direction: column !important; gap: 10px !important; }
      .indra-task-item { display: flex !important; align-items: flex-start !important; gap: 14px !important; padding: 14px 16px !important; border-radius: 12px !important; background: #ffffff !important; border: 1.5px solid #e2e8f0 !important; transition: all 0.2s ease !important; }
      .indra-task-item:hover { border-color: #94a3b8 !important; background: #f8fafc !important; box-shadow: 0 2px 8px rgba(15,23,42,0.03) !important; }
      .indra-task-item.completed { background: #f0fdf4 !important; border-color: #86efac !important; }
      .indra-task-checkbox { width: 24px !important; height: 24px !important; border-radius: 6px !important; border: 2px solid #cbd5e1 !important; background: #ffffff !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; flex-shrink: 0 !important; font-size: 14px !important; font-weight: 900 !important; color: #ffffff !important; margin-top: 1px !important; }
      .indra-task-item.completed .indra-task-checkbox { background: #10b981 !important; border-color: #10b981 !important; }
      .indra-task-content { flex: 1 !important; }
      .indra-task-title { margin: 0 0 4px 0 !important; font-size: 14px !important; font-weight: 800 !important; color: #0f172a !important; line-height: 1.35 !important; }
      .indra-task-item.completed .indra-task-title { color: #166534 !important; text-decoration: line-through !important; }
      .indra-task-meta { display: flex !important; align-items: center !important; gap: 10px !important; font-size: 11.5px !important; flex-wrap: wrap !important; margin-top: 6px !important; }
      .indra-task-badge-tag { background: #e2e8f0 !important; color: #334155 !important; font-size: 10.5px !important; font-weight: 700 !important; padding: 2px 6px !important; border-radius: 4px !important; }
      .indra-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 16px !important; padding: 24px 28px !important; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important; margin-bottom: 22px !important; }
      .indra-card-title { font-size: 20px !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 18px 0 !important; display: flex !important; align-items: center !important; gap: 10px !important; }
      .indra-papelera-banner { background: linear-gradient(135deg, #065f46 0%, #047857 100%) !important; border-radius: 14px !important; padding: 20px 24px !important; color: #ffffff !important; display: flex !important; justify-content: space-between !important; align-items: center !important; flex-wrap: wrap !important; gap: 16px !important; margin: 20px 0 !important; }
      .indra-shifts-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important; gap: 18px !important; margin-bottom: 24px !important; }
      .indra-shift-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 18px 20px !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
      .indra-shift-top { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; margin-bottom: 10px !important; }
      .indra-shift-title { font-size: 16px !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 4px 0 !important; }
      .indra-shift-time { font-size: 12px !important; font-weight: 700 !important; color: #0033a0 !important; }
      .indra-shift-workers-list { display: flex !important; flex-direction: column !important; gap: 8px !important; margin-top: 12px !important; border-top: 1px solid #e2e8f0 !important; padding-top: 12px !important; }
      .indra-shift-worker-row { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 12.5px !important; }
      .indra-shift-worker-row .name { font-weight: 800 !important; color: #0f172a !important; }
      .indra-shift-worker-row .role { font-size: 11.5px !important; color: #64748b !important; }
      .indra-recycle-bars-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important; gap: 14px !important; margin-bottom: 22px !important; }
      .indra-recycle-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; padding: 16px !important; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03) !important; }
      .indra-recycle-card-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 8px !important; }
      .indra-recycle-card-title { font-size: 13px !important; font-weight: 800 !important; color: #0f172a !important; }
      .indra-recycle-card-val { font-size: 24px !important; font-weight: 900 !important; color: #0033a0 !important; margin-bottom: 4px !important; }
      .indra-table-responsive { overflow-x: auto !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; }
      .indra-table { width: 100% !important; border-collapse: collapse !important; font-size: 12.5px !important; text-align: left !important; }
      .indra-table th { background: #f8fafc !important; padding: 12px 16px !important; font-weight: 800 !important; color: #475569 !important; border-bottom: 1.5px solid #e2e8f0 !important; }
      .indra-table td { padding: 12px 16px !important; border-bottom: 1px solid #f1f5f9 !important; color: #1e293b !important; }
      .indra-table tr:hover td { background: #f8fafc !important; }
    `;
    document.head.appendChild(styleEl);
  }

  // Gestores oficiales Delegación 0801 Barcelona
  const GESTORES_BCN_CLIENTES = [
    { id: 'todos', nombre: '🏢 Toda Barcelona (Consolidado 9 Gestores)' },
    { id: '00066957', nombre: 'Sonia Cañete Cárdenas Peral (52404278)' },
    { id: '00063967', nombre: 'Adrià Serrano Viu (21773898)' },
    { id: '00001370', nombre: 'Julio Ortiz Sánchez (34754177)' },
    { id: '00015251', nombre: 'Albert Sánchez Padrosa (47906036)' },
    { id: '00060598', nombre: 'Jordi Giménez Ferrer (47817940)' },
    { id: '00065945', nombre: 'Liana Garayshina (03856780)' },
    { id: '00027631', nombre: 'Alba Valverde Cerezo (47782275)' },
    { id: '00010085', nombre: 'José García Quesada (33915443)' },
    { id: '00062620', nombre: 'Alejandro Coscolin Peregrín (46468278 - BCN Indra)' }
  ];

  // 7. RENDERIZADOR PRINCIPAL DE LA VISTA
  function renderClientesDashboardView() {
    ensureStylesInjected();
    const metrics = calcularMetricasGlobales();
    const currentGestor = (window.AppState && window.AppState.gestorFilter) || 'todos';

    return `
      <div class="clientes-container" id="clientes-module-root">

        <!-- BARRA EJECUTIVA MULTI-GESTOR BARCELONA (0801) -->
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:10px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:12px; font-weight:800; color:#0f172a;">👔 Gestor Barcelona:</span>
            <select class="indra-select" style="padding:6px 12px; font-size:12px; font-weight:700; border-radius:8px; border:1.5px solid #0284c7; background:#f0f9ff; color:#0c4a6e; cursor:pointer;" onchange="window.ClientesModule.setGestor(this.value)">
              ${GESTORES_BCN_CLIENTES.map(g => `<option value="${g.id}" ${currentGestor === g.id ? 'selected' : ''}>${g.nombre}</option>`).join('')}
            </select>
          </div>
          <div style="font-size:11.5px; color:#475569; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span>📍 Delegación 0801 · Barcelona</span>
            <span>·</span>
            <span style="color:#0284c7;">Centro Estratégico: <b>Indra Roc Boronat (22@)</b></span>
          </div>
        </div>

        <!-- HERO CORPORATIVO INDRA ROC BORONAT -->
        <div class="indra-hero-card">
          <div class="indra-hero-content">
            <div class="indra-hero-left">
              <div class="indra-hero-badges">
                <span class="indra-badge-pill strategic">🏛️ CLIENTE ESTRATÉGICO · PLIEGO TÉCNICO OFICIAL</span>
                <span class="indra-badge-pill status-live">🟢 SERVICIO ACTIVO EN VIVO</span>
                <span class="indra-badge-pill sap">SAP: ${INDRA_SPEC.proyecto}</span>
              </div>
              <h1 class="indra-hero-title">
                INDRA ROC BORONAT <span class="hub-name">(BARCELONA 22@)</span>
              </h1>
              <p class="indra-hero-desc">
                Gestión Operativa Integral del Edificio Corporativo: <strong>8.250 m²</strong> divididos en <strong>8 plantas</strong> con <strong>797 puestos operativos</strong>.
                Plan maestro de frecuencias, asignación individual de operarios, modelo ecológico de <strong>Papelera Única (8 islas/planta)</strong> y auditoría SLA en tiempo real.
              </p>
            </div>
            <div class="indra-hero-actions">
              <button class="indra-btn indra-btn-primary" onclick="window.ClientesModule.exportarInformePDF()">
                <span>🖨️</span> Imprimir Informe Oficial
              </button>
              <button class="indra-btn indra-btn-secondary" onclick="window.ClientesModule.exportarDatosJSON()">
                <span>📥</span> Descargar Auditoría JSON
              </button>
            </div>
          </div>
        </div>

        <!-- TARJETAS DE KPIS EJECUTIVOS -->
        <div class="indra-kpi-grid">
          <div class="indra-kpi-card">
            <div class="indra-kpi-card-bar" style="background:#0033a0;"></div>
            <div class="indra-kpi-top">
              <span class="indra-kpi-label">Superficie Total</span>
              <div class="indra-kpi-icon-wrap" style="background:#eff6ff; color:#0033a0;">📐</div>
            </div>
            <div class="indra-kpi-value">${INDRA_SPEC.superficieTotal.toLocaleString()} m²</div>
            <div class="indra-kpi-meta">8 plantas: <strong>Sótano, PB y P1 a P6</strong></div>
          </div>

          <div class="indra-kpi-card">
            <div class="indra-kpi-card-bar" style="background:#0ea5e9;"></div>
            <div class="indra-kpi-top">
              <span class="indra-kpi-label">Puestos de Trabajo</span>
              <div class="indra-kpi-icon-wrap" style="background:#e0f2fe; color:#0284c7;">💻</div>
            </div>
            <div class="indra-kpi-value">${INDRA_SPEC.puestosTrabajo}</div>
            <div class="indra-kpi-meta">Puestos <strong>Clean Desk</strong> en Open-Space</div>
          </div>

          <div class="indra-kpi-card">
            <div class="indra-kpi-card-bar" style="background:#10b981;"></div>
            <div class="indra-kpi-top">
              <span class="indra-kpi-label">Cumplimiento SLA Edificio</span>
              <div class="indra-kpi-icon-wrap" style="background:#d1fae5; color:#059669;">🎯</div>
            </div>
            <div class="indra-kpi-value" style="color:#059669;">${metrics.pctGlobal}%</div>
            <div class="indra-kpi-meta"><strong>${metrics.totalCumplidas}</strong> de ${metrics.totalTareas} tareas verificadas</div>
          </div>

          <div class="indra-kpi-card">
            <div class="indra-kpi-card-bar" style="background:#14b8a6;"></div>
            <div class="indra-kpi-top">
              <span class="indra-kpi-label">Papelera Única (Islas)</span>
              <div class="indra-kpi-icon-wrap" style="background:#ccfbf1; color:#0f766e;">♻️</div>
            </div>
            <div class="indra-kpi-value">${INDRA_SPEC.papeleraUnicaUds} uds/planta</div>
            <div class="indra-kpi-meta">Tasa Reciclaje: <strong>${metrics.tasaReciclaje}%</strong> (${metrics.totalKg} kg)</div>
          </div>
        </div>

        <!-- NAVEGACIÓN INTERNA PILL-TABS -->
        <div class="indra-nav-container">
          <button class="indra-tab-pill ${ClientesState.activeTab === 'plantas' ? 'active' : ''}" onclick="window.ClientesModule.switchTab('plantas')">
            <span>🏢</span> 1. Plan de Plantas & Tareas
            <span class="pill-counter">8 Niveles</span>
          </button>
          <button class="indra-tab-pill ${ClientesState.activeTab === 'pliego' ? 'active' : ''}" onclick="window.ClientesModule.switchTab('pliego')">
            <span>📋</span> 2. Ficha Oficial del Pliego
            <span class="pill-counter">SLA 98.5%</span>
          </button>
          <button class="indra-tab-pill ${ClientesState.activeTab === 'cuadrante' ? 'active' : ''}" onclick="window.ClientesModule.switchTab('cuadrante')">
            <span>👥</span> 3. Cuadrante de Turnos & Equipo
            <span class="pill-counter">9 Operarios</span>
          </button>
          <button class="indra-tab-pill ${ClientesState.activeTab === 'papelera' ? 'active' : ''}" onclick="window.ClientesModule.switchTab('papelera')">
            <span>⚖️</span> 4. Papelera Única & Pesajes
            <span class="pill-counter">8 Islas</span>
          </button>
          <button class="indra-tab-pill ${ClientesState.activeTab === 'informe' ? 'active' : ''}" onclick="window.ClientesModule.switchTab('informe')">
            <span>🖨️</span> 5. Informe Oficial PDF
            <span class="pill-counter">Auditoría</span>
          </button>
        </div>

        <!-- VISTA DE LA PESTAÑA ACTIVA -->
        <div class="indra-tab-body">
          ${renderTabContent(metrics)}
        </div>

      </div>
    `;
  }

  // 8. RENDERIZADO POR PESTAÑAS
  function renderTabContent(metrics) {
    switch (ClientesState.activeTab) {
      case 'plantas':
        return renderTabPlantas();
      case 'pliego':
        return renderTabPliego();
      case 'cuadrante':
        return renderTabCuadrante();
      case 'papelera':
        return renderTabPapelera(metrics);
      case 'informe':
        return renderTabInforme();
      default:
        return renderTabPlantas();
    }
  }

  // PESTAÑA 1: PLAN DE PLANTAS & EDIFICIO INTERACTIVO
  function renderTabPlantas() {
    const activePlanta = PLANTAS_DATA.find(p => p.id === ClientesState.selectedPlantaId) || PLANTAS_DATA[0];
    const tareas = generarTareasPlanta(activePlanta);
    const mPlanta = calcularMetricasPlanta(activePlanta.id);
    const assignedWorkerName = ClientesState.operariosAsignados[activePlanta.id] || activePlanta.operarioDefecto;
    const assignedWorkerObj = OPERARIOS_EQUIPO.find(op => op.nombre === assignedWorkerName) || OPERARIOS_EQUIPO[0];

    // Agrupar tareas por frecuencia
    const tareasDiarias = tareas.filter(t => t.freq === 'diaria');
    const tareasAlternas = tareas.filter(t => t.freq === 'alterna');
    const tareasSemanales = tareas.filter(t => t.freq === 'semanal');
    const tareasBrigadas = tareas.filter(t => t.freq === 'brigada');

    return `
      <div class="indra-plantas-grid">

        <!-- SELECTOR TIPO EDIFICIO (COLUMNA IZQUIERDA) -->
        <div class="indra-building-card">
          <div class="indra-building-header">
            <h3 class="indra-building-title">
              <span>🏢</span> EDIFICIO ROC BORONAT
            </h3>
            <span class="indra-building-badge">8.250 m² TOTAL</span>
          </div>

          <div style="font-size:11.5px; color:#64748b; margin-bottom:12px; line-height:1.4;">
            Selecciona una planta para auditar tareas, frecuencias y cambiar el operario asignado:
          </div>

          <div class="indra-levels-list">
            ${PLANTAS_DATA.map(p => {
              const m = calcularMetricasPlanta(p.id);
              const isSelected = p.id === activePlanta.id;
              const worker = ClientesState.operariosAsignados[p.id] || p.operarioDefecto;
              const badgeBg = m.pct >= 80 ? '#d1fae5' : m.pct >= 50 ? '#e0f2fe' : '#fef3c7';
              const badgeColor = m.pct >= 80 ? '#065f46' : m.pct >= 50 ? '#0369a1' : '#92400e';

              return `
                <div class="indra-level-item ${isSelected ? 'active' : ''}" onclick="window.ClientesModule.selectPlanta('${p.id}')">
                  <div class="indra-level-left">
                    <div class="indra-level-num-badge">${p.codigo}</div>
                    <div>
                      <div class="indra-level-name">${p.nombre.split('(')[0].trim()}</div>
                      <div class="indra-level-sub">${p.superficie} m² · ${p.puestos > 0 ? p.puestos + ' puestos' : 'Parking'}</div>
                    </div>
                  </div>
                  <div class="indra-level-right">
                    <span class="indra-level-progress-pill" style="background:${badgeBg}; color:${badgeColor};">
                      ${m.pct}%
                    </span>
                    <span class="indra-level-worker" title="${worker}">👤 ${worker.split(' ')[0]}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- PANEL DE DETALLE DE LA PLANTA SELECCIONADA (COLUMNA DERECHA) -->
        <div class="indra-floor-detail">

          <!-- FICHA CABECERA DE LA PLANTA -->
          <div class="indra-floor-header-card">
            <div class="indra-floor-title-row">
              <div>
                <h2 class="indra-floor-main-title">
                  <span>📍</span> ${activePlanta.nombre}
                </h2>
                <p class="indra-floor-desc">
                  <b>Uso Principal:</b> ${activePlanta.uso}
                </p>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-quick-action" onclick="window.ClientesModule.marcarTodoPlanta('${activePlanta.id}')">
                  <span>✅</span> Completar Todo Hoy
                </button>
                <button class="btn-quick-action" onclick="window.ClientesModule.resetPlanta('${activePlanta.id}')">
                  <span>🔄</span> Reiniciar Checklist
                </button>
              </div>
            </div>

            <!-- METADATOS CLAVE DE LA PLANTA -->
            <div class="indra-floor-meta-grid">
              <div class="indra-floor-meta-box">
                <div class="indra-floor-meta-lbl">Superficie Útil</div>
                <div class="indra-floor-meta-val">${activePlanta.superficie} m²</div>
              </div>
              <div class="indra-floor-meta-box">
                <div class="indra-floor-meta-lbl">Puestos Operativos</div>
                <div class="indra-floor-meta-val">${activePlanta.puestos > 0 ? activePlanta.puestos + ' puestos' : 'Sin puestos (Técnico)'}</div>
              </div>
              <div class="indra-floor-meta-box">
                <div class="indra-floor-meta-lbl">Islas Papelera Única</div>
                <div class="indra-floor-meta-val">${activePlanta.islas} islas centralizadas</div>
              </div>
              <div class="indra-floor-meta-box">
                <div class="indra-floor-meta-lbl">Tipo de Pavimento</div>
                <div class="indra-floor-meta-val" style="font-size:12px; font-weight:600;" title="${activePlanta.suelo}">
                  ${activePlanta.suelo.split(',')[0]}
                </div>
              </div>
            </div>

            <!-- ASIGNACIÓN DE OPERARIO CON SELECTOR REACTIVO -->
            <div class="indra-worker-assign-box">
              <div class="indra-worker-left">
                <div class="indra-worker-avatar">
                  ${assignedWorkerObj.nombre.charAt(0)}
                </div>
                <div>
                  <div class="indra-worker-name">
                    Operario Responsable: <strong>${assignedWorkerObj.nombre}</strong>
                  </div>
                  <div class="indra-worker-sub">
                    ${assignedWorkerObj.turno} · Tel: ${assignedWorkerObj.telefono} · <em>${assignedWorkerObj.rol}</em>
                  </div>
                </div>
              </div>
              <div class="indra-worker-select-wrap">
                <label style="font-size:12px; font-weight:700; color:#166534;">Reasignar a:</label>
                <select class="indra-select" onchange="window.ClientesModule.changeWorker('${activePlanta.id}', this.value)">
                  ${OPERARIOS_EQUIPO.map(op => `
                    <option value="${op.nombre}" ${op.nombre === assignedWorkerName ? 'selected' : ''}>
                      ${op.nombre} (${op.turno.split('(')[0].trim()})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- BARRA DE PROGRESO DE LA PLANTA -->
            <div class="indra-progress-container">
              <div class="indra-progress-header">
                <span>Progreso de Cumplimiento de Tareas Técnicas</span>
                <span><b>${mPlanta.cumplidas} de ${mPlanta.total}</b> tareas completadas (${mPlanta.pct}%)</span>
              </div>
              <div class="indra-progress-bar-bg">
                <div class="indra-progress-bar-fill" style="width: ${mPlanta.pct}%;"></div>
              </div>
            </div>
          </div>

          <!-- GRUPOS DE TAREAS ORGANIZADAS POR FRECUENCIA -->

          <!-- 1. DIARIAS -->
          <div class="indra-tasks-frequency-group">
            <div class="indra-freq-header">
              <div class="indra-freq-title">
                <span class="indra-freq-badge badge-diaria">☀️ DIARIAS (Lunes a Viernes)</span>
                <span>Intervenciones obligatorias de rutina continua</span>
              </div>
              <span class="indra-freq-schedule">Turno Mañana (06:00-14:00) y Turno Tarde (14:00-22:00)</span>
            </div>
            <div class="indra-tasks-list">
              ${tareasDiarias.map(t => renderTaskItem(t)).join('')}
            </div>
          </div>

          <!-- 2. DÍAS ALTERNOS -->
          <div class="indra-tasks-frequency-group">
            <div class="indra-freq-header">
              <div class="indra-freq-title">
                <span class="indra-freq-badge badge-alterna">🌀 DÍAS ALTERNOS</span>
                <span>Aspirado intensivo y desinfección de salas</span>
              </div>
              <span class="indra-freq-schedule">Rotación L-X-V y M-J (Turno Tarde)</span>
            </div>
            <div class="indra-tasks-list">
              ${tareasAlternas.map(t => renderTaskItem(t)).join('')}
            </div>
          </div>

          <!-- 3. SEMANALES -->
          <div class="indra-tasks-frequency-group">
            <div class="indra-freq-header">
              <div class="indra-freq-title">
                <span class="indra-freq-badge badge-semanal">📅 SEMANALES</span>
                <span>Desincrustación profunda y aceros inoxidables</span>
              </div>
              <span class="indra-freq-schedule">Miércoles y Viernes Tarde</span>
            </div>
            <div class="indra-tasks-list">
              ${tareasSemanales.map(t => renderTaskItem(t)).join('')}
            </div>
          </div>

          <!-- 4. BRIGADAS Y PERIÓDICAS -->
          <div class="indra-tasks-frequency-group">
            <div class="indra-freq-header">
              <div class="indra-freq-title">
                <span class="indra-freq-badge badge-brigada">🛠️ BRIGADAS Y PERIÓDICAS</span>
                <span>Tratamientos de choque mecánicos, rotativa y alturas</span>
              </div>
              <span class="indra-freq-schedule">Fines de Semana / Festivos (Especialistas SIFU)</span>
            </div>
            <div class="indra-tasks-list">
              ${tareasBrigadas.map(t => renderTaskItem(t)).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // RENDERIZADO DE UN ÍTEM DE TAREA INDIVIDUAL CON CHECKBOX
  function renderTaskItem(tarea) {
    const isChecked = ClientesState.tareasStatus[tarea.id] === true;

    return `
      <div class="indra-task-item ${isChecked ? 'completed' : ''}">
        <div class="indra-task-checkbox" onclick="window.ClientesModule.toggleTask('${tarea.id}')">
          ${isChecked ? '✓' : ''}
        </div>
        <div class="indra-task-content" onclick="window.ClientesModule.toggleTask('${tarea.id}')" style="cursor:pointer;">
          <h4 class="indra-task-title">${tarea.titulo}</h4>
          <div style="font-size:12px; color:#475569; margin-bottom:4px; line-height:1.4;">${tarea.detalle}</div>
          <div class="indra-task-meta">
            <span class="indra-task-badge-tag">${tarea.norma}</span>
            <span style="color:#64748b;">${tarea.freqLabel}</span>
            ${isChecked ? '<span style="color:#10b981; font-weight:700;">✓ Verificado hoy</span>' : '<span style="color:#f59e0b; font-weight:700;">⏳ Pendiente</span>'}
          </div>
        </div>
      </div>
    `;
  }

  // PESTAÑA 2: FICHA DEL PLIEGO TÉCNICO OFICIAL
  function renderTabPliego() {
    return `
      <div class="indra-card">
        <h2 class="indra-card-title">
          <span>🏛️</span> Pliego Técnico Oficial y Requisitos SLA Indra Roc Boronat
        </h2>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px; margin-bottom:22px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
            <h4 style="margin:0 0 12px 0; color:#0033a0; font-size:14px; font-weight:800;">📍 DATOS DE LOCALIZACIÓN & CONTRATO</h4>
            <table style="width:100%; font-size:12.5px; line-height:1.9;">
              <tr><td style="color:#64748b; width:40%;">Razón Social:</td><td><b>${INDRA_SPEC.cliente}</b></td></tr>
              <tr><td style="color:#64748b;">Centro:</td><td>${INDRA_SPEC.centro}</td></tr>
              <tr><td style="color:#64748b;">Dirección:</td><td>${INDRA_SPEC.direccion}</td></tr>
              <tr><td style="color:#64748b;">Código Proyecto:</td><td><code style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:800;">${INDRA_SPEC.proyecto}</code></td></tr>
              <tr><td style="color:#64748b;">Jefe de Servicios SIFU:</td><td><b>${INDRA_SPEC.responsableSifu}</b></td></tr>
            </table>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
            <h4 style="margin:0 0 12px 0; color:#0033a0; font-size:14px; font-weight:800;">📐 VOLUMETRÍA Y OCUPACIÓN</h4>
            <table style="width:100%; font-size:12.5px; line-height:1.9;">
              <tr><td style="color:#64748b; width:45%;">Superficie Contratada:</td><td><b>8.250 m²</b></td></tr>
              <tr><td style="color:#64748b;">Puestos de Trabajo:</td><td><b>797 puestos</b> (Open-Space y despachos)</td></tr>
              <tr><td style="color:#64748b;">Estructura de Edificio:</td><td>8 Plantas (Sótano, PB y P1 a P6)</td></tr>
              <tr><td style="color:#64748b;">Núcleos Higiénicos:</td><td>16 núcleos de aseos completos</td></tr>
              <tr><td style="color:#64748b;">Zonas Office:</td><td>8 offices de planta + comedor central PB</td></tr>
            </table>
          </div>
        </div>

        <div class="indra-papelera-banner">
          <div style="display:flex; align-items:center; gap:16px;">
            <span style="font-size:36px;">🌿</span>
            <div>
              <div style="font-size:16px; font-weight:800; color:#ffffff;">MODELO SOSTENIBLE DE PAPELERA ÚNICA (8 ISLAS POR PLANTA)</div>
              <div style="font-size:12.5px; color:#d1fae5; margin-top:3px; max-width:850px; line-height:1.5;">
                Conforme al pliego de Indra, se eliminan todas las papeleras individuales de mesa en los 797 puestos operativos.
                La recogida se centraliza estrictamente en 8 islas de segregación multifracción por planta con registro diario de pesajes
                y emisión de certificados de reducción de huella de carbono para auditorías ISO 14001.
              </div>
            </div>
          </div>
          <button class="btn-quick-action primary" onclick="window.ClientesModule.switchTab('papelera')">
            Ver Registro de Pesajes
          </button>
        </div>

        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:18px;">
          <h4 style="margin:0 0 6px 0; color:#1e40af; font-size:14px; font-weight:800;">🎯 COMPROMISO DE CALIDAD SLA & TIEMPOS DE RESPUESTA</h4>
          <p style="margin:0; font-size:12.5px; color:#1e3a8a; line-height:1.6;">
            El pliego establece un cumplimiento mínimo garantizado del <b>98.5%</b> mensual. Las incidencias en aseos o reposición de consumibles tienen un tiempo máximo de subsanación inferior a <b>30 minutos</b> en horario laboral de Indra.
          </p>
        </div>
      </div>
    `;
  }

  // PESTAÑA 3: CUADRANTE DE TURNOS & EQUIPO
  function renderTabCuadrante() {
    return `
      <div class="indra-card">
        <h2 class="indra-card-title">
          <span>👥</span> Cuadrante Operativo de Turnos & Equipo Asignado
        </h2>

        <div class="indra-shifts-grid">
          <!-- TURNO MAÑANA -->
          <div class="indra-shift-card manana">
            <div class="indra-shift-top">
              <div>
                <h3 class="indra-shift-title">Turno de Mañana</h3>
                <span class="indra-shift-time">⏰ 06:00 - 14:00 (Lunes a Viernes)</span>
              </div>
              <span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800;">2 Operarios</span>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">
              Cobertura continua de Planta Baja (Recepción, Auditorio, Tornos), repaso matinal de aseos (10:30h), reposición de consumibles y limpieza mecanizada de parking.
            </p>
            <div class="indra-shift-workers-list">
              <div class="indra-shift-worker-row">
                <span class="name">Marta Gómez</span>
                <span class="role">PB & Aseos Matinales · 638 12 34 50</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Jordi Roca</span>
                <span class="role">Sótano -1 & Fregadora · 669 11 80 45</span>
              </div>
            </div>
          </div>

          <!-- TURNO TARDE -->
          <div class="indra-shift-card tarde">
            <div class="indra-shift-top">
              <div>
                <h3 class="indra-shift-title">Turno de Tarde (Principal)</h3>
                <span class="indra-shift-time">⏰ 14:00 - 22:00 (Lunes a Viernes)</span>
              </div>
              <span style="background:#dbeafe; color:#1e40af; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800;">5 Operarios</span>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">
              Limpieza intensiva de los 797 puestos de trabajo, aspirado de moquetas, vaciado de las 8 islas de reciclaje por planta, pesaje y desinfección vespertina de aseos (16:30h).
            </p>
            <div class="indra-shift-workers-list">
              <div class="indra-shift-worker-row">
                <span class="name">Carlos Benítez</span>
                <span class="role">Planta 1ª · 649 22 11 88</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Fátima Zahra</span>
                <span class="role">Planta 2ª · 671 90 44 21</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Ali S.</span>
                <span class="role">Planta 3ª & Pesajes · 618 33 55 92</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Laura Puig</span>
                <span class="role">Planta 4ª · 622 88 41 19</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Mohamed El Amrani</span>
                <span class="role">Planta 5ª · 634 77 12 04</span>
              </div>
            </div>
          </div>

          <!-- BRIGADA Y PROTOCOLO -->
          <div class="indra-shift-card brigada">
            <div class="indra-shift-top">
              <div>
                <h3 class="indra-shift-title">Brigada & Protocolo P6</h3>
                <span class="indra-shift-time">⏰ Mixto & Fines de Semana</span>
              </div>
              <span style="background:#f3e8ff; color:#6b21a8; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800;">Especialistas</span>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">
              Atención ejecutiva de Planta 6ª (Presidencia), tratamientos con máquina rotativa, inyección-extracción de moqueta y cristalería en altura exterior con pértiga y góndola.
            </p>
            <div class="indra-shift-workers-list">
              <div class="indra-shift-worker-row">
                <span class="name">Rosa Soler</span>
                <span class="role">Planta 6ª Presidencia · 650 44 99 32</span>
              </div>
              <div class="indra-shift-worker-row">
                <span class="name">Equipo Brigada SIFU</span>
                <span class="role">Suelos & Alturas · 900 123 456</span>
              </div>
            </div>
          </div>
        </div>

        <h3 style="font-size:14.5px; font-weight:800; color:#0f172a; margin:20px 0 12px 0;">
          🏢 Distribución Arquitectónica del Edificio por Planta
        </h3>
        <div class="indra-table-responsive">
          <table class="indra-table">
            <thead>
              <tr>
                <th>Planta</th>
                <th>Superficie</th>
                <th>Puestos</th>
                <th>Islas</th>
                <th>Pavimento Dominante</th>
                <th>Operario Asignado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${PLANTAS_DATA.map(p => {
                const worker = ClientesState.operariosAsignados[p.id] || p.operarioDefecto;
                return `
                  <tr>
                    <td><b>${p.nombre}</b></td>
                    <td>${p.superficie} m²</td>
                    <td>${p.puestos > 0 ? p.puestos + ' puestos' : '—'}</td>
                    <td>${p.islas} unidades</td>
                    <td>${p.suelo.split(',')[0]}</td>
                    <td><b>${worker}</b></td>
                    <td><span style="color:#10b981; font-weight:700;">● Asignado</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // PESTAÑA 4: PAPELERA ÚNICA & PESAJE DE RESIDUOS
  function renderTabPapelera(metrics) {
    return `
      <div class="indra-card">
        <h2 class="indra-card-title">
          <span>⚖️</span> Sistema de Papelera Única & Registro Diario de Pesajes
        </h2>

        <!-- RESUMEN VISUAL DE RECICLAJE POR FRACCIONES -->
        <div class="indra-recycle-bars-grid">
          <div class="indra-recycle-card">
            <div class="indra-recycle-card-header">
              <span class="indra-recycle-card-title">📄 Papel y Cartón</span>
              <span style="background:#e0f2fe; color:#0369a1; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:800;">Isla Azul</span>
            </div>
            <div class="indra-recycle-card-val">${metrics.papelKg} kg</div>
            <div style="font-size:11.5px; color:#64748b;">Recogida en las 8 plantas</div>
          </div>

          <div class="indra-recycle-card">
            <div class="indra-recycle-card-header">
              <span class="indra-recycle-card-title">🟡 Envases Ligeros</span>
              <span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:800;">Isla Amarilla</span>
            </div>
            <div class="indra-recycle-card-val">${metrics.envasesKg} kg</div>
            <div style="font-size:11.5px; color:#64748b;">Plásticos y latas segregados</div>
          </div>

          <div class="indra-recycle-card">
            <div class="indra-recycle-card-header">
              <span class="indra-recycle-card-title">🍎 Materia Orgánica</span>
              <span style="background:#d1fae5; color:#065f46; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:800;">Isla Marrón</span>
            </div>
            <div class="indra-recycle-card-val">${metrics.organicaKg} kg</div>
            <div style="font-size:11.5px; color:#64748b;">Offices y Comedores</div>
          </div>

          <div class="indra-recycle-card">
            <div class="indra-recycle-card-header">
              <span class="indra-recycle-card-title">🗑️ Fracción Resto</span>
              <span style="background:#f1f5f9; color:#475569; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:800;">Isla Gris</span>
            </div>
            <div class="indra-recycle-card-val">${metrics.restoKg} kg</div>
            <div style="font-size:11.5px; color:#64748b;">No reciclable</div>
          </div>
        </div>

        <!-- FORMULARIO DE REGISTRO RÁPIDO DE PESAJE -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:20px;">
          <h4 style="margin:0 0 12px 0; font-size:13.5px; font-weight:800; color:#0f172a;">
            ➕ Registrar Nuevo Pesaje de Isla Centralizada
          </h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; align-items:flex-end;">
            <div>
              <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Fecha</label>
              <input type="date" id="pesaje-fecha" value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:12.5px;" />
            </div>
            <div>
              <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Planta</label>
              <select id="pesaje-planta" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:12.5px;">
                ${PLANTAS_DATA.map(p => `<option value="${p.nombre.split('(')[0].trim()}">${p.nombre.split('(')[0].trim()}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Fracción</label>
              <select id="pesaje-fraccion" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:12.5px;">
                <option value="Papel/Cartón">Papel y Cartón (Azul)</option>
                <option value="Envases Ligeros">Envases y Plásticos (Amarillo)</option>
                <option value="Orgánica (Office)">Orgánica (Marrón)</option>
                <option value="Fracción Resto">Fracción Resto (Gris)</option>
              </select>
            </div>
            <div>
              <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Peso (Kg)</label>
              <input type="number" step="0.1" id="pesaje-kg" placeholder="Ej: 24.5" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; font-size:12.5px;" />
            </div>
            <div>
              <button class="btn-quick-action primary" onclick="window.ClientesModule.guardarPesaje()" style="width:100%; justify-content:center; height:38px;">
                Guardar Pesaje
              </button>
            </div>
          </div>
        </div>

        <!-- TABLA HISTÓRICA DE PESAJES -->
        <div class="indra-table-responsive">
          <table class="indra-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Planta</th>
                <th>Fracción de Residuo</th>
                <th>Peso (Kg)</th>
                <th>Operario de Pesaje</th>
              </tr>
            </thead>
            <tbody>
              ${ClientesState.pesajes.map(p => `
                <tr>
                  <td><b>${p.fecha}</b></td>
                  <td>${p.planta}</td>
                  <td>${p.fraccion}</td>
                  <td><b style="color:#0284c7;">${Number(p.kg).toFixed(1)} kg</b></td>
                  <td>${p.operario || 'Ali S.'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px; font-size:11.5px; color:#64748b; background:#f1f5f9; padding:10px 14px; border-radius:8px;">
          ℹ️ Los datos de pesaje se consolidan semanalmente y se transmiten automáticamente a las direcciones técnicas de Indra:
          <strong>${INDRA_SPEC.emailIndraHorizontales}</strong> y <strong>${INDRA_SPEC.emailIndraMedioambiente}</strong>.
        </div>
      </div>
    `;
  }

  // PESTAÑA 5: INFORME TÉCNICO OFICIAL PARA IMPRIMIR / PDF
  function renderTabInforme() {
    const metrics = calcularMetricasGlobales();

    return `
      <div class="indra-card">
        <h2 class="indra-card-title">
          <span>🖨️</span> Generador de Informe Técnico Oficial de Auditoría
        </h2>

        <p style="font-size:13px; color:#475569; margin-bottom:18px;">
          Este informe genera un documento maquetado para impresión en tamaño A4 con membrete oficial de <strong>Grupo SIFU</strong> e <strong>INDRA</strong>, certificando el cumplimiento del SLA (${metrics.pctGlobal}%), la asignación de operarios por cada planta y los pesajes del modelo de Papelera Única.
        </p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; max-width:680px; margin-bottom:20px;">
          <h4 style="margin:0 0 8px 0; color:#0033a0; font-size:14px; font-weight:800;">Resumen del Documento que se Emitirá:</h4>
          <ul style="font-size:12.5px; color:#334155; line-height:1.8; padding-left:20px; margin:0 0 16px 0;">
            <li>Certificación del Pliego: <strong>${INDRA_SPEC.cliente}</strong> (${INDRA_SPEC.centro}).</li>
            <li>Cumplimiento Global: <strong>${metrics.pctGlobal}%</strong> (${metrics.totalCumplidas} de ${metrics.totalTareas} verificadas).</li>
            <li>Cuadrante Completo: 8 plantas con operarios y teléfonos de contacto.</li>
            <li>Balance de Residuos: <strong>${metrics.totalKg} kg</strong> pesados (${metrics.tasaReciclaje}% tasa de reciclaje).</li>
            <li>Firma del Responsable del Servicio: <strong>${INDRA_SPEC.responsableSifu}</strong>.</li>
          </ul>
          <button class="indra-btn indra-btn-primary" onclick="window.ClientesModule.exportarInformePDF()" style="width:100%; justify-content:center;">
            <span>🖨️</span> Abrir Ventana de Impresión / Guardar PDF
          </button>
        </div>
      </div>
    `;
  }

  // 9. OBJETO PÚBLICO CLIENTES_MODULE
  window.ClientesModule = {
    switchTab(tab) {
      ClientesState.activeTab = tab;
      this.reRender();
    },

    selectPlanta(plantaId) {
      ClientesState.selectedPlantaId = plantaId;
      this.reRender();
    },

    toggleTask(taskId) {
      ClientesState.tareasStatus[taskId] = !ClientesState.tareasStatus[taskId];
      persistState();
      this.reRender();
    },

    marcarTodoPlanta(plantaId) {
      const planta = PLANTAS_DATA.find(p => p.id === plantaId);
      if (planta) {
        const tareas = generarTareasPlanta(planta);
        tareas.forEach(t => { ClientesState.tareasStatus[t.id] = true; });
        persistState();
        this.reRender();
        if (typeof window.showToast === 'function') {
          window.showToast(`✅ Tareas de ${planta.nombre.split('(')[0].trim()} marcadas como cumplidas`, 'bg-success');
        }
      }
    },

    resetPlanta(plantaId) {
      const planta = PLANTAS_DATA.find(p => p.id === plantaId);
      if (planta) {
        const tareas = generarTareasPlanta(planta);
        tareas.forEach(t => { ClientesState.tareasStatus[t.id] = false; });
        persistState();
        this.reRender();
      }
    },

    changeWorker(plantaId, workerName) {
      ClientesState.operariosAsignados[plantaId] = workerName;
      persistState();
      this.reRender();
      if (typeof window.showToast === 'function') {
        window.showToast(`👤 Asignado ${workerName} a ${plantaId.toUpperCase()}`, 'bg-success');
      }
    },

    guardarPesaje() {
      const fecha = document.getElementById('pesaje-fecha')?.value || new Date().toISOString().split('T')[0];
      const planta = document.getElementById('pesaje-planta')?.value || 'Planta 1ª';
      const fraccion = document.getElementById('pesaje-fraccion')?.value || 'Papel/Cartón';
      const kgVal = parseFloat(document.getElementById('pesaje-kg')?.value);

      if (isNaN(kgVal) || kgVal <= 0) {
        alert('Por favor introduce un peso válido en Kg (ej: 18.5).');
        return;
      }

      ClientesState.pesajes.unshift({
        id: Date.now(),
        fecha,
        planta,
        fraccion,
        kg: kgVal,
        operario: 'Ali S.'
      });
      persistState();
      this.reRender();

      if (typeof window.showToast === 'function') {
        window.showToast(`⚖️ Pesaje registrado: ${kgVal} kg de ${fraccion} en ${planta}`, 'bg-success');
      }
    },

    exportarDatosJSON() {
      const exportData = {
        pliego: INDRA_SPEC,
        operarios: ClientesState.operariosAsignados,
        tareasStatus: ClientesState.tareasStatus,
        pesajes: ClientesState.pesajes,
        timestamp: new Date().toISOString()
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `Indra_Roc_Boronat_Auditoria_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    exportarInformePDF() {
      const metrics = calcularMetricasGlobales();
      const printWin = window.open('', '_blank', 'width=1000,height=850');
      if (!printWin) {
        window.print();
        return;
      }

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Informe Oficial Pliego Técnico Indra Roc Boronat - Grupo SIFU</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #0f172a; font-size: 13px; line-height: 1.5; }
            .hdr { background: #0033a0; color: #fff; padding: 22px 26px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
            .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
            .kpi-box { border: 1px solid #cbd5e1; padding: 12px 14px; border-radius: 6px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
            td { border-bottom: 1px solid #e2e8f0; padding: 7px 10px; }
            .title-sec { font-size: 15px; font-weight: bold; color: #0033a0; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
            .footer { margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="hdr">
            <div>
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#93c5fd;">GRUPO SIFU · DIRECCIÓN OPERATIVA BARCELONA (0801)</div>
              <h1 style="margin:4px 0 0; font-size:20px;">INFORME TÉCNICO OFICIAL DE PLIEGO Y AUDITORÍA SLA</h1>
              <div style="font-size:12px; color:#e0f2fe; margin-top:4px;"><b>${INDRA_SPEC.cliente}</b> · Sede: ${INDRA_SPEC.centro}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:22px; font-weight:900; color:#4ade80;">SLA: ${metrics.pctGlobal}%</div>
              <div style="font-size:11px; color:#e0f2fe;">SAP: ${INDRA_SPEC.proyecto}</div>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-box"><small>SUPERFICIE TOTAL</small><br><b style="font-size:16px;">8.250 m²</b><br><small>8 Plantas</small></div>
            <div class="kpi-box"><small>PUESTOS OPERATIVOS</small><br><b style="font-size:16px;">797 puestos</b><br><small>Clean Desk</small></div>
            <div class="kpi-box"><small>PAPELERA ÚNICA</small><br><b style="font-size:16px;">8 islas / planta</b><br><small>Cero papeleras mesa</small></div>
            <div class="kpi-box"><small>TASA RECICLAJE</small><br><b style="font-size:16px;">${metrics.tasaReciclaje}%</b><br><small>${metrics.totalKg} kg pesados</small></div>
          </div>

          <div class="title-sec">1. Cuadrante y Asignación de Operarios por Planta</div>
          <table>
            <thead><tr><th>Planta</th><th>Superficie</th><th>Puestos</th><th>Operario Asignado</th><th>Horario / Turno</th></tr></thead>
            <tbody>
              ${PLANTAS_DATA.map(p => {
                const workerName = ClientesState.operariosAsignados[p.id] || p.operarioDefecto;
                const workerObj = OPERARIOS_EQUIPO.find(op => op.nombre === workerName) || { turno: 'Turno Tarde' };
                return `<tr><td><b>${p.nombre}</b></td><td>${p.superficie} m²</td><td>${p.puestos > 0 ? p.puestos : '—'}</td><td><b>${workerName}</b></td><td>${workerObj.turno}</td></tr>`;
              }).join('')}
            </tbody>
          </table>

          <div class="title-sec">2. Matriz de Frecuencias del Pliego Técnico</div>
          <table>
            <thead><tr><th>Frecuencia</th><th>Horario</th><th>Ámbito de Actuación</th><th>Normativa / SLA</th></tr></thead>
            <tbody>
              <tr><td><b>Diarias</b></td><td>Mañana (06:00-14:00) y Tarde (14:00-22:00)</td><td>Islas de reciclaje, 2 veces/día aseos, offices y puestos</td><td>Respuesta &lt;30 min</td></tr>
              <tr><td><b>Días Alternos</b></td><td>L-X-V y M-J (16:00-20:00)</td><td>Aspirado de moquetas con filtro HEPA, phone booths y salas</td><td>Mantenimiento Suelos</td></tr>
              <tr><td><b>Semanales</b></td><td>Miércoles y Viernes</td><td>Desincrustación antical biológica, mamparas y aceros inox</td><td>Auditoría Calidad</td></tr>
              <tr><td><b>Brigadas</b></td><td>Fin de semana / Festivos</td><td>Tratamiento rotativa, inyección moqueta y fachada en altura</td><td>Especialistas SIFU</td></tr>
            </tbody>
          </table>

          <div class="footer">
            Certificación Oficial emitida por Grupo SIFU Integración Laboral SL · Jefatura de Operaciones: <b>${INDRA_SPEC.responsableSifu}</b> (${INDRA_SPEC.jefeServicioEmail})
          </div>

          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
        </html>
      `);
      printWin.document.close();
    },

    setGestor(gId) {
      if (window.AppState) window.AppState.gestorFilter = gId;
      const gestorObj = GESTORES_BCN_CLIENTES.find(x => x.id === gId);
      const nombre = gestorObj ? gestorObj.nombre : gId;
      if (typeof window.showToast === 'function') {
        window.showToast(`👔 Cartera Clientes: ${nombre}`, 'bg-blue');
      }
      this.reRender();
    },

    reRender() {
      const root = document.getElementById('clientes-module-root');
      if (root) {
        root.outerHTML = renderClientesDashboardView();
      }
    },

    attachListeners() {
      // Enganche de eventos complementarios
    }
  };

  // Exponer renderizador en window
  window.renderClientesDashboardView = renderClientesDashboardView;

})();
