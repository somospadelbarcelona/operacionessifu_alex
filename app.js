/**
 * CUADRANTE OPERATIVO FILTRABLE POR COLUMNAS
 * Grupo SIFU Barcelona - Operativa de Limpieza
 * Filtros interactivos en cada columna de la cabecera
 */

// ==========================================
// 1. BASE DE DATOS DE SERVICIOS
// ==========================================
const SERVICIOS_BASE = [
  {
    "id": 1,
    "listado": "SRV-001",
    "estado": "OK",
    "dia": "LUNES A VIERNES",
    "horario": "6h a 7h",
    "cliente": "GTV ASOCIADOS",
    "direccion": "C/ Paris 120 , planta 1",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 5.0,
    "personaCubre": "WINSTON",
    "observaciones": "CUBIERTO | a partir del 28/09"
  },
  {
    "id": 2,
    "listado": "SRV-002",
    "estado": "OK",
    "dia": "LUNES A VIERNES",
    "horario": "7,30h a 9h",
    "cliente": "GISAE",
    "direccion": "Av Roma 94",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 7.5,
    "personaCubre": "WINSTON",
    "observaciones": "CUBIERTO | a partir del 28/09"
  },
  {
    "id": 3,
    "listado": "SRV-003",
    "estado": "OK",
    "dia": "LUNES A VIERNES",
    "horario": "10h a 14h",
    "cliente": "ZAL HEMISPHERE",
    "direccion": "Carrer Atlantic s/n ( zal )",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 20.0,
    "personaCubre": "WINSTON",
    "observaciones": "CUBIERTO | a partir del 28/09"
  },
  {
    "id": 4,
    "listado": "SRV-004",
    "estado": "OK",
    "dia": "VIERNES",
    "horario": "15h a 17h",
    "cliente": "MAPHRE",
    "direccion": "Carrer d'Àngel Guimerà, 6",
    "poblacion": "ESPLUGES LLOB",
    "zona": "BAIX LLOBREGAT",
    "hSem": 2.0,
    "personaCubre": "WINSTON",
    "observaciones": "CUBIERTO | a partir del 28/09"
  },
  {
    "id": 5,
    "listado": "SRV-005",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A VIERNES",
    "horario": "6h a 11h",
    "cliente": "NATURE",
    "direccion": "C. de José Agustín Goytisolo",
    "poblacion": "HOSPITALET LLOB",
    "zona": "BAIX LLOBREGAT",
    "hSem": 20.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 6,
    "listado": "SRV-006",
    "estado": "DESCUBIERTO",
    "dia": "MIERCOLES",
    "horario": "8h a 9h",
    "cliente": "CASSA ( VEOLIA )",
    "direccion": "BV-2411, 2",
    "poblacion": "AVINYÓ PEN",
    "zona": "PENEDES GARRAF",
    "hSem": 1.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 7,
    "listado": "SRV-007",
    "estado": "DESCUBIERTO",
    "dia": "MIERCOLES",
    "horario": "10h a 13h",
    "cliente": "GESTIN",
    "direccion": "C/ SANT RAMON DE PENYAFORT II",
    "poblacion": "VILAFRANCA PEN",
    "zona": "PENEDES GARRAF",
    "hSem": 3.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 8,
    "listado": "SRV-008",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A JUEVES",
    "horario": "18h a 21,30h",
    "cliente": "VUELING",
    "direccion": "Carrer Catalunya",
    "poblacion": "VILADECANS",
    "zona": "BAIX LLOBREGAT",
    "hSem": 14.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 9,
    "listado": "SRV-009",
    "estado": "DESCUBIERTO",
    "dia": "VIERNES",
    "horario": "17h a 20,30h",
    "cliente": "VUELING",
    "direccion": "Carrer Catalunya",
    "poblacion": "VILADECANS",
    "zona": "BAIX LLOBREGAT",
    "hSem": 3.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 10,
    "listado": "SRV-010",
    "estado": "DESCUBIERTO",
    "dia": "MARTES",
    "horario": "11h a 12,30h",
    "cliente": "RENFE CASTELLEDEFELS",
    "direccion": "08860 Castelldefels, Barcelona",
    "poblacion": "CASTELLDEFELS",
    "zona": "BAIX LLOBREGAT",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 11,
    "listado": "SRV-011",
    "estado": "DESCUBIERTO",
    "dia": "MIERCOLES",
    "horario": "8h a 9,30h",
    "cliente": "RENFE GAVA",
    "direccion": "08850 Gavà, Barcelona",
    "poblacion": "GAVA",
    "zona": "BAIX LLOBREGAT",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 12,
    "listado": "SRV-012",
    "estado": "DESCUBIERTO",
    "dia": "MARTES",
    "horario": "9h a 10,30h",
    "cliente": "RENFE MOLINS REI",
    "direccion": "08750 Molins de Rei, Barcelona",
    "poblacion": "MOLINS DE REI",
    "zona": "BAIX LLOBREGAT",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 13,
    "listado": "SRV-013",
    "estado": "DESCUBIERTO",
    "dia": "VIERNES",
    "horario": "11h a 12,30h",
    "cliente": "RENFE MARTORELL",
    "direccion": "08760 Martorell, Barcelona",
    "poblacion": "MARTORELL",
    "zona": "BAIX LLOBREGAT",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 14,
    "listado": "SRV-014",
    "estado": "DESCUBIERTO",
    "dia": "VIERNES",
    "horario": "10h a 11,30h",
    "cliente": "RENFE VILAFRANCA PEN",
    "direccion": "Estació RENFE Vilafranca",
    "poblacion": "VILAFRANCA PEN",
    "zona": "PENEDES GARRAF",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 15,
    "listado": "SRV-015",
    "estado": "DESCUBIERTO",
    "dia": "VIERNES",
    "horario": "12h a 13,30h",
    "cliente": "RENFE VILANOVA GELTRU",
    "direccion": "Carrer de l'Agricultura, 08800",
    "poblacion": "VILANOVA GELTRU",
    "zona": "PENEDES GARRAF",
    "hSem": 1.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 16,
    "listado": "SRV-016",
    "estado": "DESCUBIERTO",
    "dia": "MIERCOLES",
    "horario": "15h a 18h",
    "cliente": "RING",
    "direccion": "Zona Costera Garraf",
    "poblacion": "GARRAF",
    "zona": "PENEDES GARRAF",
    "hSem": 3.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 17,
    "listado": "SRV-017",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A VIERNES",
    "horario": "9,30 a 11,30",
    "cliente": "CREC",
    "direccion": "C/ Mallorca",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 10.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 18,
    "listado": "SRV-018",
    "estado": "PENDIENTE",
    "dia": "LUNES A VIERNES",
    "horario": "7h a 9h",
    "cliente": "CREC",
    "direccion": "C/ Letamendi",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 10.0,
    "personaCubre": "",
    "observaciones": "A LA ESPERA DE ARRANQUE"
  },
  {
    "id": 19,
    "listado": "SRV-019",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A VIERNES",
    "horario": "7,30 a 9,30",
    "cliente": "CREC",
    "direccion": "C/ Numancia 73",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 7.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 20,
    "listado": "SRV-020",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A VIERNES",
    "horario": "15h a 17h",
    "cliente": "ARA VINC",
    "direccion": "Carrer Montserrat d'Hisern nº1",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 10.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 21,
    "listado": "SRV-021",
    "estado": "DESCUBIERTO",
    "dia": "LUNES A VIERNES",
    "horario": "15h a 17h",
    "cliente": "ARA VINC",
    "direccion": "C/ Salvador Espriu 3-6",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 20.0,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 22,
    "listado": "SRV-022",
    "estado": "DESCUBIERTO",
    "dia": "LUNES Y JUEVES",
    "horario": "8h a 9,30h",
    "cliente": "MEDIA PROD",
    "direccion": "C. Frederic Mompou, 3",
    "poblacion": "SANT JUST DESVERN",
    "zona": "BAIX LLOBREGAT",
    "hSem": 7.5,
    "personaCubre": "",
    "observaciones": "DESCUBIERTO"
  },
  {
    "id": 23,
    "listado": "SRV-023",
    "estado": "OK",
    "dia": "LUNES A VIERNES",
    "horario": "7h a 12h",
    "cliente": "SEMYDINAMICS",
    "direccion": "C/ Tarragona 161",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 25.0,
    "personaCubre": "MALIKA",
    "observaciones": "CUBIERTO | falta confirmar"
  },
  {
    "id": 24,
    "listado": "SRV-024",
    "estado": "OK",
    "dia": "LUNES A VIERNES",
    "horario": "9h a 10h",
    "cliente": "WURTH CARACAS",
    "direccion": "C/ Caracas 7",
    "poblacion": "BARCELONA",
    "zona": "BARCELONA",
    "hSem": 10.0,
    "personaCubre": "NURIA GARCIA",
    "observaciones": "CUBIERTO | a partir del 21/09"
  }
];

// ==========================================
// 2. ESTADO GLOBAL Y FILTROS DE CABECERA
// ==========================================
const SIFU_STATE = {
  servicios: [],
  modoVista: 'cuadrante',
  filtrosColumnas: {
    horario: 'TODOS',
    cliente: 'TODOS',
    poblacion: 'TODOS',
    horas: 'TODAS',
    dias: 'TODOS',
    estado: 'TODOS'
  },
  servicioEnEdicion: null
};

// ==========================================
// 3. INICIO Y EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  cargarEstado();
  poblarOpcionesFiltros();
  configurarEventos();
  renderizarTodo();
});

function cargarEstado() {
  const guardado = localStorage.getItem('sifu_cuadrante_filtros_v7');
  if (guardado) {
    try {
      SIFU_STATE.servicios = JSON.parse(guardado);
    } catch (e) {
      SIFU_STATE.servicios = JSON.parse(JSON.stringify(SERVICIOS_BASE));
    }
  } else {
    SIFU_STATE.servicios = JSON.parse(JSON.stringify(SERVICIOS_BASE));
  }
}

function guardarEstado() {
  localStorage.setItem('sifu_cuadrante_filtros_v7', JSON.stringify(SIFU_STATE.servicios));
}

function poblarOpcionesFiltros() {
  const servicios = SIFU_STATE.servicios;

  // Clientes únicos
  const clientes = Array.from(new Set(servicios.map(s => s.cliente).filter(Boolean))).sort();
  const selectCliente = document.getElementById('filtroColCliente');
  if (selectCliente) {
    const valAnt = selectCliente.value;
    selectCliente.innerHTML = '<option value="TODOS">🏢 Todos los clientes</option>' +
      clientes.map(c => `<option value="${c}">${c}</option>`).join('');
    if (clientes.includes(valAnt)) selectCliente.value = valAnt;
  }

  // Poblaciones únicas
  const poblaciones = Array.from(new Set(servicios.map(s => s.poblacion).filter(Boolean))).sort();
  const selectPob = document.getElementById('filtroColPoblacion');
  if (selectPob) {
    const valAnt = selectPob.value;
    selectPob.innerHTML = '<option value="TODOS">📍 Todas las poblaciones</option>' +
      poblaciones.map(p => `<option value="${p}">${p}</option>`).join('');
    if (poblaciones.includes(valAnt)) selectPob.value = valAnt;
  }
}

function configurarEventos() {
  // Restablecer base
  const btnRestablecer = document.getElementById('btnRestablecer');
  if (btnRestablecer) {
    btnRestablecer.addEventListener('click', () => {
      SIFU_STATE.servicios = JSON.parse(JSON.stringify(SERVICIOS_BASE));
      guardarEstado();
      poblarOpcionesFiltros();
      limpiarTodosLosFiltros();
      alert('Datos restablecidos con el Excel original.');
    });
  }

  // Excel
  const excelFileInput = document.getElementById('excelFileInput');
  if (excelFileInput) {
    excelFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        procesarExcel(e.target.files[0]);
      }
    });
  }

  const btnExportar = document.getElementById('btnExportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', exportarExcel);
  }

  const btnImprimir = document.getElementById('btnImprimir');
  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => window.print());
  }
}

// ==========================================
// 4. PARSER DE HORAS Y DÍAS
// ==========================================
function extraerHoraInicio(horarioStr) {
  if (!horarioStr) return 99;
  const s = String(horarioStr).toLowerCase().replace(/,/g, '.');
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return 99;

  let val = parseFloat(m[1]);
  let horas = Math.floor(val);
  let dec = Math.round((val - horas) * 100) / 100;
  if (dec === 0.3) return horas + 0.5;
  return val;
}

function servicioAplicaADia(diaStr, diaBuscado) {
  if (!diaStr) return false;
  const d = diaStr.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const b = diaBuscado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (b === 'FINDE') {
    return d.includes('SABADO') || d.includes('DOMINGO') || d.includes('FIN DE SEMANA');
  }

  if (d.includes('LUNES A VIERNES')) return ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'].includes(b);
  if (d.includes('LUNES A JUEVES')) return ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES'].includes(b);
  if (d.includes('LUNES A SABADO')) return ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].includes(b);
  if (d.includes('LUNES Y JUEVES')) return ['LUNES', 'JUEVES'].includes(b);
  if (d.includes('MARTES Y JUEVES')) return ['MARTES', 'JUEVES'].includes(b);
  if (d.includes('SABADO Y DOMINGO') || d.includes('FIN DE SEMANA')) return ['SABADO', 'DOMINGO'].includes(b);
  return d === b || d.includes(b);
}

// ==========================================
// 5. APLICAR FILTROS DE CABECERA
// ==========================================
function aplicarFiltrosColumnas() {
  SIFU_STATE.filtrosColumnas.horario = document.getElementById('filtroColHorario').value;
  SIFU_STATE.filtrosColumnas.cliente = document.getElementById('filtroColCliente').value;
  SIFU_STATE.filtrosColumnas.poblacion = document.getElementById('filtroColPoblacion').value;
  SIFU_STATE.filtrosColumnas.horas = document.getElementById('filtroColHoras').value;
  SIFU_STATE.filtrosColumnas.dias = document.getElementById('filtroColDias').value;
  SIFU_STATE.filtrosColumnas.estado = document.getElementById('filtroColEstado').value;

  actualizarEstilosFiltros();
  renderizarTodo();
}

function actualizarEstilosFiltros() {
  const ids = ['filtroColHorario', 'filtroColCliente', 'filtroColPoblacion', 'filtroColHoras', 'filtroColDias', 'filtroColEstado'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value;
    if (val !== 'TODOS' && val !== 'TODAS') {
      el.classList.add('activo');
    } else {
      el.classList.remove('activo');
    }
  });
}

function limpiarTodosLosFiltros() {
  document.getElementById('filtroColHorario').value = 'TODOS';
  document.getElementById('filtroColCliente').value = 'TODOS';
  document.getElementById('filtroColPoblacion').value = 'TODOS';
  document.getElementById('filtroColHoras').value = 'TODAS';
  document.getElementById('filtroColDias').value = 'TODOS';
  document.getElementById('filtroColEstado').value = 'TODOS';

  SIFU_STATE.filtrosColumnas = {
    horario: 'TODOS',
    cliente: 'TODOS',
    poblacion: 'TODOS',
    horas: 'TODAS',
    dias: 'TODOS',
    estado: 'TODOS'
  };

  actualizarEstilosFiltros();
  renderizarTodo();
}

// ==========================================
// 6. RENDERIZADO VISUAL DEL CUADRANTE
// ==========================================
function renderizarTodo() {
  const f = SIFU_STATE.filtrosColumnas;

  const serviciosFiltrados = SIFU_STATE.servicios.filter(s => {
    // Filtro Horario
    if (f.horario !== 'TODOS') {
      const hora = extraerHoraInicio(s.horario);
      if (f.horario === 'MANANA' && hora >= 14) return false;
      if (f.horario === 'TARDE' && hora < 14) return false;
    }

    // Filtro Cliente
    if (f.cliente !== 'TODOS' && s.cliente !== f.cliente) {
      return false;
    }

    // Filtro Población
    if (f.poblacion !== 'TODOS' && s.poblacion !== f.poblacion) {
      return false;
    }

    // Filtro Horas
    if (f.horas !== 'TODAS') {
      const h = Number(s.hSem) || 0;
      if (f.horas === '0-5' && h > 5) return false;
      if (f.horas === '5-10' && (h <= 5 || h > 10)) return false;
      if (f.horas === '10-20' && (h <= 10 || h > 20)) return false;
      if (f.horas === '20+' && h <= 20) return false;
    }

    // Filtro Días
    if (f.dias !== 'TODOS') {
      if (!servicioAplicaADia(s.dia, f.dias)) return false;
    }

    // Filtro Estado
    if (f.estado !== 'TODOS' && s.estado !== f.estado) {
      return false;
    }

    return true;
  });

  // Ordenar cronológicamente por hora
  serviciosFiltrados.sort((a, b) => extraerHoraInicio(a.horario) - extraerHoraInicio(b.horario));

  // KPIs
  const totalDesc = SIFU_STATE.servicios.filter(s => s.estado === 'DESCUBIERTO').length;
  const totalCub = SIFU_STATE.servicios.filter(s => s.estado === 'OK' && s.personaCubre).length;
  const horasDesc = SIFU_STATE.servicios.filter(s => s.estado === 'DESCUBIERTO').reduce((acc, s) => acc + (Number(s.hSem) || 0), 0);

  document.getElementById('kpiDescubiertos').textContent = totalDesc;
  document.getElementById('kpiCubiertos').textContent = totalCub;
  document.getElementById('kpiHoras').textContent = `${horasDesc.toFixed(1)}h`;
  document.getElementById('contadorResultados').textContent = serviciosFiltrados.length;

  renderizarCuadrante(serviciosFiltrados);
  renderizarColumnas(serviciosFiltrados);
}

function renderizarCuadrante(servicios) {
  const tbody = document.getElementById('tablaCuadranteBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (servicios.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-slate-400 font-bold">
          <i class="fa-solid fa-filter-circle-xmark text-3xl text-slate-300 mb-1 block"></i>
          No hay servicios que coincidan con los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  const DIAS_LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  servicios.forEach(s => {
    const esCubierto = s.estado === 'OK';
    const tr = document.createElement('tr');
    tr.className = `row-cuadrante ${esCubierto ? 'cubierto' : 'descubierto'}`;

    // Construir píldoras de días L M X J V S D
    const pillsHtml = DIAS.map((dia, idx) => {
      const aplica = servicioAplicaADia(s.dia, dia);
      const clase = aplica ? (esCubierto ? 'dia-pill activo-cubierto' : 'dia-pill activo-descubierto') : 'dia-pill inactivo';
      return `<span class="${clase}" title="${dia}: ${aplica ? 'Activo' : 'No opera'}">${DIAS_LETRAS[idx]}</span>`;
    }).join('');

    tr.innerHTML = `
      <!-- Hora -->
      <td class="py-2.5 px-3 whitespace-nowrap">
        <span class="inline-flex items-center gap-1 font-mono font-extrabold text-xs px-2 py-0.5 rounded ${esCubierto ? 'bg-emerald-200/70 text-emerald-900' : 'bg-red-200 text-red-900'}">
          <i class="fa-regular fa-clock text-[10px]"></i>
          ${s.horario}
        </span>
      </td>

      <!-- Cliente -->
      <td class="py-2.5 px-3">
        <div class="font-black text-slate-900 text-sm leading-tight">${s.cliente}</div>
        <div class="text-[10px] text-slate-500 font-semibold tracking-wider">${s.listado} • ${s.dia}</div>
      </td>

      <!-- Población y Dirección -->
      <td class="py-2.5 px-3">
        <div class="font-bold text-slate-800 text-xs flex items-center gap-1">
          <span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800">${s.poblacion}</span>
        </div>
        <div class="text-[11px] text-slate-600 truncate max-w-xs mt-0.5" title="${s.direccion}">${s.direccion}</div>
      </td>

      <!-- Horas semanales -->
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        <span class="font-black text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
          ${s.hSem}h
        </span>
      </td>

      <!-- Días de la semana -->
      <td class="py-2.5 px-3 text-center whitespace-nowrap">
        <div class="inline-flex items-center">
          ${pillsHtml}
        </div>
      </td>

      <!-- Estado y Cobertura -->
      <td class="py-2.5 px-4 text-right whitespace-nowrap">
        ${esCubierto ? `
          <div class="inline-flex items-center gap-2">
            <div class="text-right">
              <span class="text-xs font-black text-emerald-800 block">
                <i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i>${s.personaCubre || 'CUBIERTO'}
              </span>
              <span class="text-[10px] text-emerald-700 block">${s.observaciones || ''}</span>
            </div>
            <button onclick="revertirEstado(${s.id})" class="btn-touch bg-white border border-slate-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-slate-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg shadow-2xs transition" title="Volver a poner descubierto">
              <i class="fa-solid fa-rotate-left"></i> Revertir
            </button>
          </div>
        ` : `
          <button onclick="abrirModal(${s.id})" class="btn-touch bg-red-600 hover:bg-red-700 text-white font-black text-xs py-1.5 px-4 rounded-lg shadow-xs flex items-center gap-1.5 transition ml-auto">
            <i class="fa-solid fa-user-plus"></i>
            <span>Cubrir Servicio</span>
          </button>
        `}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ==========================================
// 7. RENDERIZADO COLUMNAS COMPACTAS
// ==========================================
function renderizarColumnas(servicios) {
  const cont = document.getElementById('gridColumnasCompactas');
  if (!cont) return;

  cont.innerHTML = '';
  const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  DIAS.forEach(dia => {
    const lista = servicios.filter(s => servicioAplicaADia(s.dia, dia));
    const pendientes = lista.filter(s => s.estado === 'DESCUBIERTO').length;

    const col = document.createElement('div');
    col.className = 'day-column';

    col.innerHTML = `
      <div class="day-column-header bg-slate-200/80 flex items-center justify-between">
        <h4 class="font-black text-slate-900 text-xs uppercase">${dia}</h4>
        <span class="text-[10px] font-black px-1.5 py-0.2 rounded-full ${pendientes > 0 ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-700'}">${pendientes}</span>
      </div>
      <div class="day-column-body space-y-1.5">
        ${lista.length === 0 ? `
          <div class="py-8 text-center text-[11px] text-slate-400 font-bold">Sin servicios</div>
        ` : lista.map(s => {
          const esCub = s.estado === 'OK';
          return `
            <div class="mini-strip-card ${esCub ? 'cubierto' : 'descubierto'} flex flex-col justify-between gap-1">
              <div class="flex items-center justify-between font-mono font-bold text-[10px]">
                <span class="${esCub ? 'text-emerald-800' : 'text-red-700'}">⏰ ${s.horario}</span>
                <span class="text-slate-500">${s.hSem}h</span>
              </div>
              <div class="font-black text-slate-900 text-[11px] leading-tight truncate" title="${s.cliente}">${s.cliente}</div>
              <div class="text-[10px] text-slate-500 truncate">${s.poblacion}</div>
              
              <div class="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                ${esCub ? `
                  <span class="text-[10px] font-extrabold text-emerald-800 truncate">✅ ${s.personaCubre}</span>
                  <button onclick="revertirEstado(${s.id})" class="text-[10px] text-slate-500 hover:text-red-600 underline font-bold">Revertir</button>
                ` : `
                  <button onclick="abrirModal(${s.id})" class="w-full bg-red-600 text-white font-bold text-[10px] py-1 rounded">Cubrir</button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    cont.appendChild(col);
  });
}

// ==========================================
// 8. CAMBIO DE MODO DE VISTA
// ==========================================
function cambiarModoVista(modo) {
  SIFU_STATE.modoVista = modo;

  const btnCuadrante = document.getElementById('btnModoCuadrante');
  const btnColumnas = document.getElementById('btnModoColumnas');
  const vistaCuadrante = document.getElementById('vistaCuadrante');
  const vistaColumnas = document.getElementById('vistaColumnas');

  if (modo === 'cuadrante') {
    btnCuadrante.className = 'px-3 py-1 rounded-lg bg-white shadow-xs font-black text-slate-900 text-xs flex items-center gap-1.5';
    btnColumnas.className = 'px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1.5';
    vistaCuadrante.classList.remove('hidden');
    vistaColumnas.classList.add('hidden');
  } else {
    btnColumnas.className = 'px-3 py-1 rounded-lg bg-white shadow-xs font-black text-slate-900 text-xs flex items-center gap-1.5';
    btnCuadrante.className = 'px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1.5';
    vistaColumnas.classList.remove('hidden');
    vistaCuadrante.classList.add('hidden');
  }
}

// ==========================================
// 9. MODAL CUBRIR Y REVERTIR
// ==========================================
function abrirModal(id) {
  const srv = SIFU_STATE.servicios.find(s => s.id === id);
  if (!srv) return;

  SIFU_STATE.servicioEnEdicion = srv;

  document.getElementById('modalClienteNombre').textContent = srv.cliente;
  document.getElementById('modalClienteDetalle').textContent = `${srv.horario} • ${srv.poblacion} (${srv.hSem} h/sem)`;
  document.getElementById('inputNombrePersona').value = '';
  document.getElementById('inputNota').value = `Cubierto ${new Date().toLocaleDateString('es-ES')}`;

  document.getElementById('modalResolver').classList.remove('hidden');
  document.getElementById('inputNombrePersona').focus();
}

function cerrarModalResolver() {
  document.getElementById('modalResolver').classList.add('hidden');
  SIFU_STATE.servicioEnEdicion = null;
}

function guardarResolucion() {
  const srv = SIFU_STATE.servicioEnEdicion;
  if (!srv) return;

  const persona = document.getElementById('inputNombrePersona').value.trim();
  const nota = document.getElementById('inputNota').value.trim();

  if (!persona) {
    alert('Por favor, indica el nombre de la persona que cubre.');
    return;
  }

  srv.estado = 'OK';
  srv.personaCubre = persona;
  srv.observaciones = `CUBIERTO (${persona}) | ${nota}`;

  guardarEstado();
  cerrarModalResolver();
  renderizarTodo();
}

function revertirEstado(id) {
  const srv = SIFU_STATE.servicios.find(s => s.id === id);
  if (!srv) return;

  if (confirm(`¿Revertir ${srv.cliente} a DESCUBIERTO?`)) {
    srv.estado = 'DESCUBIERTO';
    srv.personaCubre = '';
    srv.observaciones = 'DESCUBIERTO';

    guardarEstado();
    renderizarTodo();
  }
}

// ==========================================
// 10. EXPORTACIÓN EXCEL
// ==========================================
function procesarExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let headerIdx = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const str = rows[i].join(' ').toUpperCase();
        if (str.includes('CLIENTE') || str.includes('HORARIO')) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        alert('No se detectaron las columnas esperadas.');
        return;
      }

      const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());
      const getCol = (k) => headers.findIndex(h => h.includes(k));

      const colCliente = getCol('CLIENTE');
      const colDia = getCol('DIA');
      const colHorario = getCol('HORARIO');
      const colPoblacion = getCol('POBLACION');
      const colDireccion = getCol('DIRECCION');
      const colHsem = getCol('H/SEM');
      const colEstado = getCol('ESTADO');
      const colObs = getCol('OBSERVACIONES');
      const colTrab = getCol('TRABAJADOR');

      const parsed = [];
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const cliente = colCliente !== -1 ? String(row[colCliente] || '').trim() : '';
        if (!cliente) continue;

        let hSem = 0;
        if (colHsem !== -1) {
          const rawH = String(row[colHsem] || '').replace(',', '.');
          const m = rawH.match(/([0-9]+(?:\.[0-9]+)?)/);
          if (m) hSem = parseFloat(m[1]);
        }

        const estadoRaw = colEstado !== -1 ? String(row[colEstado] || '').toUpperCase() : '';
        const obsRaw = colObs !== -1 ? String(row[colObs] || '').toUpperCase() : '';
        const trabRaw = colTrab !== -1 ? String(row[colTrab] || '').trim() : '';
        const pob = colPoblacion !== -1 ? String(row[colPoblacion] || '').trim().toUpperCase() : 'BARCELONA';

        let estado = 'DESCUBIERTO';
        let personaCubre = '';
        if (estadoRaw.includes('OK') || obsRaw.includes('CUBIERTO')) {
          estado = 'OK';
          personaCubre = trabRaw || 'CUBIERTO';
        }

        let zona = 'BARCELONA';
        if (pob.includes('LLOB') || pob.includes('VILADECANS') || pob.includes('GAVA') || pob.includes('CASTELLDEFELS') || pob.includes('MOLINS') || pob.includes('MARTORELL') || pob.includes('JUST')) {
          zona = 'BAIX LLOBREGAT';
        } else if (pob.includes('PEN') || pob.includes('GARRAF') || pob.includes('VILANOVA') || pob.includes('AVINYO')) {
          zona = 'PENEDES GARRAF';
        }

        parsed.push({
          id: Date.now() + r,
          listado: `SRV-${String(parsed.length + 1).padStart(3, '0')}`,
          estado: estado,
          dia: colDia !== -1 ? String(row[colDia] || 'Lunes a Viernes').trim() : 'Lunes a Viernes',
          horario: colHorario !== -1 ? String(row[colHorario] || '').trim() : '',
          cliente: cliente,
          direccion: colDireccion !== -1 ? String(row[colDireccion] || '').trim() : 'Consultar centro',
          poblacion: pob,
          zona: zona,
          hSem: hSem,
          personaCubre: personaCubre,
          observaciones: String(row[colObs] || 'DESCUBIERTO').trim()
        });
      }

      SIFU_STATE.servicios = parsed;
      guardarEstado();
      poblarOpcionesFiltros();
      renderizarTodo();
      alert(`✅ ¡Cargados ${parsed.length} servicios del Excel!`);
    } catch (e) {
      console.error(e);
      alert('Error al leer el archivo Excel.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportarExcel() {
  try {
    const rows = [
      ['LISTADO', 'ESTADO', 'DÍA', 'HORARIO', 'CLIENTE', 'DIRECCIÓN', 'POBLACIÓN', 'H/SEM', 'PERSONA QUE CUBRE', 'OBSERVACIONES']
    ];

    SIFU_STATE.servicios.forEach(s => {
      rows.push([
        s.listado,
        s.estado,
        s.dia,
        s.horario,
        s.cliente,
        s.direccion,
        s.poblacion,
        `${s.hSem}h/sem`,
        s.personaCubre || (s.estado === 'DESCUBIERTO' ? 'SIN COBERTURA' : ''),
        s.observaciones
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CUADRANTE SIFU BCN');

    const f = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cuadrante_Semanal_SIFU_BCN_${f}.xlsx`);
  } catch (e) {
    console.error(e);
    alert('Error al guardar Excel.');
  }
}
