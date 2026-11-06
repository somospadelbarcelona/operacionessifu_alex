/**
 * ============================================================================
 * SIFU BARCELONA — 2.5 OPERADOR AUTÓNOMO SAP HO & MEMORIA DE OFICIO (v3.0)
 * Interfaz Operativa de Trabajo Real, Entrenamiento de Criterio y Auditoría SAP
 * Especialista Exclusivo para: ALEJANDRO COSCOLIN (46468278) · Delegación BCN 0801
 * ============================================================================
 */

(function () {
  'use strict';

  const ViewState = {
    gestorFilter: 'todos',
    activeSubTab: 'bandeja', // 'bandeja' | 'reglas' | 'auditoria' | 'directo'
    categoriaFilter: 'TODOS', // 'TODOS' | 'DESCUBIERTO_HO' | 'BAJA_IT' | 'VACACIONES' | 'CONTRATO_CMH' | 'ALTA_CONFIANZA' | 'RESUELTOS'
    busqueda: '',
    paginaActual: 1,
    itemsPorPagina: 15,
    modalEnsenarCaso: null, // Objeto del caso abierto para corregir/enseñar
    ejecutandoId: null,
    ejecutandoLote: false
  };

  window.setHOAutoGestor = function (gid) {
    ViewState.gestorFilter = gid || 'todos';
    ViewState.paginaActual = 1;
    if (typeof window.showToast === 'function') {
      window.showToast('🎯 Cartera actualizada en el Operador Autónomo 2.5', 'bg-blue');
    }
    refreshView();
  };

  function refreshView() {
    const rootContainer = document.getElementById('ho-auto-view-container');
    if (rootContainer && rootContainer.parentElement) {
      rootContainer.outerHTML = window.renderHOAutoDashboardView();
      return;
    }
    if (typeof window.renderAppShell === 'function') {
      window.renderAppShell();
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // RENDER PRINCIPAL DE LA SECCIÓN 2.5
  // ==========================================================================
  window.renderHOAutoDashboardView = function () {
    const engine = window.HOAutoEngine;
    if (!engine) {
      return `
        <div style="padding: 60px 20px; text-align: center; font-family: 'Outfit', sans-serif;">
          <div style="font-size: 38px; margin-bottom: 12px;">⏳</div>
          <h3 style="color:#0f172a; margin-bottom: 8px;">Iniciando Operador Autónomo SAP HO...</h3>
        </div>
      `;
    }

    const gestores = engine.getGestoresBCN ? engine.getGestoresBCN() : [];
    const resumen = engine.getResumenOperativo(ViewState.gestorFilter);
    const colaFiltrada = engine.getColaTrabajo(ViewState.gestorFilter, ViewState.categoriaFilter, ViewState.busqueda);
    const reglas = engine.getReglasOficio(ViewState.gestorFilter);
    const ejecuciones = engine.getEjecucionesSAP();

    return `
      <div class="ho-auto-root" id="ho-auto-view-container" style="padding: 12px 18px 48px; max-width: 1800px; margin: 0 auto; font-family: 'Outfit', system-ui, sans-serif;">

        <!-- 1. HEADER EJECUTIVO: NIVEL DE AUTONOMÍA, DOMINIO DEL OFICIO Y CARTERA -->
        <header style="background: linear-gradient(135deg, #09101f 0%, #0f172a 55%, #1e293b 100%); border-radius: 16px; padding: 18px 22px; color: #fff; box-shadow: 0 12px 28px rgba(15,23,42,0.18); border: 1px solid rgba(56,189,248,0.22); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">

            <!-- Identidad y Estado de Aprendizaje -->
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 0 20px rgba(56,189,248,0.4); border: 1px solid rgba(255,255,255,0.25);">
                🧠
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <h1 style="font-size: 19px; font-weight: 900; margin: 0; color: #ffffff; letter-spacing: 0.2px;">
                    OPERADOR AUTÓNOMO SAP HO · APRENDIZ DE TU OFICIO
                  </h1>
                  <span style="background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.4); font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 99px; display: inline-flex; align-items: center; gap: 6px;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #34d399; display: inline-block;"></span>
                    DOMINIO DEL OFICIO: ${resumen.nivel_dominio_oficio}% (${resumen.total_reglas} Reglas Activas)
                  </span>
                  <span style="background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.35); font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 99px;">
                    ${resumen.sap_online ? '🟢 BRIDGE SAP S/4HANA CONECTADO' : '⚡ MODO INTELIGENTE (COLA SAP LISTA)'}
                  </span>
                </div>
                <div style="font-size: 12.5px; color: #94a3b8; margin-top: 4px;">
                  Detecta tus incidencias reales en Barcelona (0801), aprende tus criterios cuando lo corriges y ejecuta el trabajo rutinario en <code>ZPS_HOPER_SRV</code>.
                </div>
              </div>
            </div>

            <!-- Controles Superiores: Selector de Cartera + Nivel de Autonomía + Ejecución Lote -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">

              <!-- Selector de Cartera (9 Gestores BCN) -->
              <div style="display: flex; align-items: center; gap: 6px; background: rgba(15,23,42,0.85); border: 1px solid rgba(148,163,184,0.3); padding: 6px 10px; border-radius: 10px;">
                <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">Cartera:</span>
                <select onchange="window.setHOAutoGestor(this.value)" style="background: transparent; border: none; color: #fff; font-size: 12.5px; font-weight: 700; outline: none; cursor: pointer;">
                  ${gestores.map(g => `
                    <option value="${g.id}" style="color:#0f172a;" ${ViewState.gestorFilter === g.id ? 'selected' : ''}>
                      ${escapeHtml(g.nombre)}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Selector de Nivel de Autonomía -->
              <div style="display: flex; background: rgba(15,23,42,0.9); border: 1px solid rgba(56,189,248,0.3); border-radius: 10px; padding: 3px; gap: 3px;">
                <button onclick="window.HOAutoUI.cambiarAutonomia(1)" title="Solo diagnostica y espera tu aprobación o corrección" style="border: none; padding: 6px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${resumen.nivel_autonomia === 1 ? 'background:#0284c7; color:#fff;' : 'background:transparent; color:#94a3b8;'}">
                  🎓 1. Aprendiz
                </button>
                <button onclick="window.HOAutoUI.cambiarAutonomia(2)" title="Prepara lotes de alta confianza basados en tus reglas para ejecutar en 1 clic" style="border: none; padding: 6px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${resumen.nivel_autonomia === 2 ? 'background:#2563eb; color:#fff;' : 'background:transparent; color:#94a3b8;'}">
                  ⚡ 2. Casi Autónomo
                </button>
                <button onclick="window.HOAutoUI.cambiarAutonomia(3)" title="Ejecuta automáticamente en SAP HO los casos con Regla de Oficio Autónoma" style="border: none; padding: 6px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${resumen.nivel_autonomia === 3 ? 'background:#059669; color:#fff; box-shadow:0 0 12px rgba(16,185,129,0.4);' : 'background:transparent; color:#94a3b8;'}">
                  🤖 3. Autónomo 24x7
                </button>
              </div>

              <!-- Botón Ejecutar Lote de Alta Confianza -->
              <button onclick="window.HOAutoUI.ejecutarLoteValidado()" ${ViewState.ejecutandoLote ? 'disabled' : ''} style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; padding: 9px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.35); display: inline-flex; align-items: center; gap: 7px;">
                <span>⚡</span>
                <span>${ViewState.ejecutandoLote ? 'Ejecutando en SAP...' : `Ejecutar Lote Fiable (${resumen.listos_alta_confianza})`}</span>
              </button>
            </div>

          </div>

          <!-- Barra rápida para enseñarle una regla o darle una instrucción con tus palabras -->
          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-size: 12px; font-weight: 800; color: #38bdf8; white-space: nowrap;">
              💬 Enseñar Regla / Orden Directa:
            </span>
            <input
              type="text"
              id="ho-pizarra-quick-input"
              placeholder="Ej: 'Siempre que falle alguien en PROY015730 pon a DORIS IMADE de 07:00 a 15:00' o 'En la cartera de José García usa a JORGE ALBERO para suplencias'..."
              onkeydown="if(event.key==='Enter') window.HOAutoUI.enviarOrdenDirecta()"
              style="flex: 1; min-width: 280px; background: rgba(15,23,42,0.9); border: 1px solid rgba(56,189,248,0.35); color: #ffffff; padding: 8px 14px; border-radius: 8px; font-size: 12.5px; outline: none;"
            >
            <button onclick="window.HOAutoUI.enviarOrdenDirecta()" style="background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap;">
              🧠 Enseñar al Agente
            </button>
          </div>
        </header>

        <!-- 2. BARRA DE NAVEGACIÓN DE LAS 4 ÁREAS DE TRABAJO -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.HOAutoUI.setSubTab('bandeja')" style="padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid ${ViewState.activeSubTab === 'bandeja' ? '#0284c7' : '#cbd5e1'}; background: ${ViewState.activeSubTab === 'bandeja' ? '#0284c7' : '#ffffff'}; color: ${ViewState.activeSubTab === 'bandeja' ? '#ffffff' : '#1e293b'}; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
              <span>📥</span>
              <span>1. Bandeja de Trabajo Operativo</span>
              <span style="background: ${ViewState.activeSubTab === 'bandeja' ? 'rgba(255,255,255,0.22)' : '#fee2e2'}; color: ${ViewState.activeSubTab === 'bandeja' ? '#fff' : '#dc2626'}; padding: 2px 8px; border-radius: 99px; font-size: 11px;">
                ${resumen.total_pendientes} pendientes
              </span>
            </button>

            <button onclick="window.HOAutoUI.setSubTab('reglas')" style="padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid ${ViewState.activeSubTab === 'reglas' ? '#0284c7' : '#cbd5e1'}; background: ${ViewState.activeSubTab === 'reglas' ? '#0284c7' : '#ffffff'}; color: ${ViewState.activeSubTab === 'reglas' ? '#ffffff' : '#1e293b'}; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
              <span>🧠</span>
              <span>2. Libro de Oficio (Reglas Aprendidas)</span>
              <span style="background: ${ViewState.activeSubTab === 'reglas' ? 'rgba(255,255,255,0.22)' : '#e0f2fe'}; color: ${ViewState.activeSubTab === 'reglas' ? '#fff' : '#0369a1'}; padding: 2px 8px; border-radius: 99px; font-size: 11px;">
                ${reglas.length} reglas
              </span>
            </button>

            <button onclick="window.HOAutoUI.setSubTab('auditoria')" style="padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid ${ViewState.activeSubTab === 'auditoria' ? '#0284c7' : '#cbd5e1'}; background: ${ViewState.activeSubTab === 'auditoria' ? '#0284c7' : '#ffffff'}; color: ${ViewState.activeSubTab === 'auditoria' ? '#ffffff' : '#1e293b'}; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
              <span>📜</span>
              <span>3. Ejecuciones SAP & Deshacer (↩️)</span>
              <span style="background: ${ViewState.activeSubTab === 'auditoria' ? 'rgba(255,255,255,0.22)' : '#d1fae5'}; color: ${ViewState.activeSubTab === 'auditoria' ? '#fff' : '#047857'}; padding: 2px 8px; border-radius: 99px; font-size: 11px;">
                ${ejecuciones.length}
              </span>
            </button>

            <button onclick="window.HOAutoUI.setSubTab('directo')" style="padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid ${ViewState.activeSubTab === 'directo' ? '#0284c7' : '#cbd5e1'}; background: ${ViewState.activeSubTab === 'directo' ? '#0284c7' : '#ffffff'}; color: ${ViewState.activeSubTab === 'directo' ? '#ffffff' : '#1e293b'}; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
              <span>⚡</span>
              <span>4. Imputación Manual Directa SAP</span>
            </button>
          </div>

          <!-- Resumen rápido de casos resueltos hoy -->
          <div style="font-size: 12.5px; color: #475569; font-weight: 700; background: #ffffff; padding: 8px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
            ✅ Trabajo quitado de encima: <b style="color:#059669;">${ejecuciones.filter(e => !e.revertido).length} gestiones SAP</b> · 
            🤖 Reglas autónomas 24x7: <b style="color:#0284c7;">${resumen.reglas_autonomas}</b>
          </div>
        </div>

        <!-- 3. CONTENIDO DINÁMICO SEGÚN PESTAÑA ACTIVA -->
        ${ViewState.activeSubTab === 'bandeja' ? renderBandejaTrabajo(engine, resumen, colaFiltrada) : ''}
        ${ViewState.activeSubTab === 'reglas' ? renderLibroOficio(engine, reglas) : ''}
        ${ViewState.activeSubTab === 'auditoria' ? renderAuditoriaEjecuciones(engine, ejecuciones) : ''}
        ${ViewState.activeSubTab === 'directo' ? renderImputacionDirecta(engine) : ''}

        <!-- 4. MODAL PARA ENSEÑAR / CORREGIR PROPUESTA Y CREAR REGLA DE OFICIO -->
        ${ViewState.modalEnsenarCaso ? renderModalEnsenarOficio(engine, ViewState.modalEnsenarCaso) : ''}

      </div>
    `;
  };

  // ==========================================================================
  // PESTAÑA 1: BANDEJA DE TRABAJO OPERATIVO REAL
  // ==========================================================================
  function renderBandejaTrabajo(engine, resumen, colaFiltrada) {
    const totalItems = colaFiltrada.length;
    const totalPaginas = Math.max(1, Math.ceil(totalItems / ViewState.itemsPorPagina));
    if (ViewState.paginaActual > totalPaginas) ViewState.paginaActual = 1;
    const inicio = (ViewState.paginaActual - 1) * ViewState.itemsPorPagina;
    const itemsPagina = colaFiltrada.slice(inicio, inicio + ViewState.itemsPorPagina);

    return `
      <!-- Tarjetas KPI de Filtro Rápido por Problema Operativo -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px;">
        
        <div onclick="window.HOAutoUI.setCategoria('TODOS')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'TODOS' ? '#0284c7' : '#e2e8f0'}; border-left: 5px solid #0284c7; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#475569; text-transform:uppercase;">Toda la Cola</span>
            <span style="font-size:18px; font-weight:900; color:#0284c7;">${resumen.total_pendientes}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Propuestas calculadas listas para revisar o lanzar a SAP.</div>
        </div>

        <div onclick="window.HOAutoUI.setCategoria('ALTA_CONFIANZA')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'ALTA_CONFIANZA' ? '#059669' : '#e2e8f0'}; border-left: 5px solid #059669; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#047857; text-transform:uppercase;">🎯 Alta Confianza (≥88%)</span>
            <span style="font-size:18px; font-weight:900; color:#059669;">${resumen.listos_alta_confianza}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Respaldados por Regla de Oficio o presencia en bitácora.</div>
        </div>

        <div onclick="window.HOAutoUI.setCategoria('DESCUBIERTO_HO')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'DESCUBIERTO_HO' ? '#dc2626' : '#e2e8f0'}; border-left: 5px solid #dc2626; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#b91c1c; text-transform:uppercase;">🚨 Descubiertos SAP HO</span>
            <span style="font-size:18px; font-weight:900; color:#dc2626;">${resumen.conteos.DESCUBIERTO_HO}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">0h en SAP HO pero con operario identificado para imputar.</div>
        </div>

        <div onclick="window.HOAutoUI.setCategoria('BAJA_IT')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'BAJA_IT' ? '#d97706' : '#e2e8f0'}; border-left: 5px solid #d97706; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#b45309; text-transform:uppercase;">🏥 Bajas IT & Art. 38.3</span>
            <span style="font-size:18px; font-weight:900; color:#d97706;">${resumen.conteos.BAJA_IT}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Titulares de baja con propuesta de suplente <code>SB</code> en cartera.</div>
        </div>

        <div onclick="window.HOAutoUI.setCategoria('VACACIONES')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'VACACIONES' ? '#7c3aed' : '#e2e8f0'}; border-left: 5px solid #7c3aed; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#6d28d9; text-transform:uppercase;">🏖️ Vacaciones Pendientes</span>
            <span style="font-size:18px; font-weight:900; color:#7c3aed;">${resumen.conteos.VACACIONES}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Operarios con ≥10 días pendientes de cuadrar (<code>VC</code> + <code>SV</code>).</div>
        </div>

        <div onclick="window.HOAutoUI.setCategoria('CONTRATO_CMH')" style="background: #fff; border: 2px solid ${ViewState.categoriaFilter === 'CONTRATO_CMH' ? '#0f172a' : '#e2e8f0'}; border-left: 5px solid #475569; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.15s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:800; color:#334155; text-transform:uppercase;">⚖️ Contratos / CMH</span>
            <span style="font-size:18px; font-weight:900; color:#334155;">${resumen.conteos.CONTRATO_CMH}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Contratos que vencen en ≤30 días y ajustes preventivos.</div>
        </div>

      </div>

      <!-- Layout Principal: Lista de Casos Reales (Izquierda) + Consola de Actividad del Agente (Derecha) -->
      <div style="display: grid; grid-template-columns: 1fr 370px; gap: 16px; align-items: start;">

        <!-- Columna Principal: Casos de Trabajo con Propuesta y Botones de Aprendizaje -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 4px 12px rgba(15,23,42,0.04); overflow: hidden;">
          
          <!-- Barra de búsqueda y paginación -->
          <div style="padding: 14px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 14px; font-weight: 800; color: #0f172a;">
                📋 Propuestas Operativas Calculadas (${totalItems})
              </span>
              <span style="font-size: 11.5px; color: #64748b;">
                Revisa lo que voy a hacer por ti o corrígeme para que aprenda tu criterio
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <input
                type="text"
                placeholder="🔍 Buscar proyecto, cliente, trabajador, gestor..."
                value="${escapeHtml(ViewState.busqueda)}"
                oninput="window.HOAutoUI.onBuscarCola(this.value)"
                style="padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12.5px; min-width: 260px; outline: none;"
              >
            </div>
          </div>

          <!-- Lista de Tarjetas Operativas -->
          <div style="divide-y: 1px solid #f1f5f9;">
            ${itemsPagina.length === 0 ? `
              <div style="padding: 48px 20px; text-align: center; color: #64748b;">
                <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">No hay casos pendientes con este filtro</div>
                <div style="font-size: 12.5px; margin-top: 4px;">Cambia el filtro superior o selecciona "Toda Barcelona".</div>
              </div>
            ` : itemsPagina.map(caso => renderTarjetaCasoOperativo(caso)).join('')}
          </div>

          <!-- Paginación -->
          ${totalPaginas > 1 ? `
            <div style="padding: 12px 18px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                Mostrando ${inicio + 1} - ${Math.min(inicio + ViewState.itemsPorPagina, totalItems)} de ${totalItems} casos
              </span>
              <div style="display: flex; gap: 6px;">
                <button onclick="window.HOAutoUI.irPagina(${ViewState.paginaActual - 1})" ${ViewState.paginaActual <= 1 ? 'disabled' : ''} style="padding: 5px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; font-size: 12px; font-weight: 700; cursor: pointer;">
                  ← Anterior
                </button>
                <span style="padding: 5px 10px; font-size: 12px; font-weight: 800; color: #0f172a;">
                  Página ${ViewState.paginaActual} / ${totalPaginas}
                </span>
                <button onclick="window.HOAutoUI.irPagina(${ViewState.paginaActual + 1})" ${ViewState.paginaActual >= totalPaginas ? 'disabled' : ''} style="padding: 5px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; font-size: 12px; font-weight: 700; cursor: pointer;">
                  Siguiente →
                </button>
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Columna Derecha: Cerebro en Vivo y Resumen de Aprendizaje -->
        <div style="display: flex; flex-direction: column; gap: 14px;">

          <!-- Card: Cómo estoy trabajando ahora mismo -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; box-shadow: 0 4px 12px rgba(15,23,42,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 13px; font-weight: 800; color: #0f172a;">🤖 Estado de Autonomía</span>
              <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; background: ${resumen.nivel_autonomia === 3 ? '#d1fae5' : '#e0f2fe'}; color: ${resumen.nivel_autonomia === 3 ? '#047857' : '#0369a1'};">
                Nivel ${resumen.nivel_autonomia} de 3
              </span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 0 0 12px; line-height: 1.45;">
              ${resumen.nivel_autonomia === 1
                ? 'Estoy en <b>Modo Aprendiz</b>: cruzo SAP HO + Bitácora + Fichajes + Vacaciones y te propongo la solución exacta. Si me corriges con <b>"✏️ Enseñar"</b>, memorizo tu regla.'
                : resumen.nivel_autonomia === 2
                ? 'Estoy en <b>Modo Casi Autónomo (Copiloto)</b>: aplico tus Reglas de Oficio automáticamente a toda la cola y dejo listos <b>' + resumen.listos_alta_confianza + ' casos</b> para que los lances a SAP HO en 1 clic.'
                : 'Estoy en <b>Modo Autónomo 24x7</b>: ejecuto automáticamente en SAP S/4HANA cualquier caso que coincida con una regla marcada como <b>AUTÓNOMA</b> y te dejo el botón de <b>Revertir</b> en la pestaña 3.'}
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font-size: 11.5px; color: #334155;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Reglas de Oficio memorizadas:</span>
                <b>${resumen.total_reglas}</b>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Reglas con ejecución 100% autónoma:</span>
                <b style="color:#059669;">${resumen.reglas_autonomas}</b>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Decisiones aprendidas de ti:</span>
                <b style="color:#0284c7;">${resumen.total_experiencias}</b>
              </div>
            </div>
          </div>

          <!-- Terminal Centinela de Oficio en Vivo -->
          <div style="background: #09101f; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 20px rgba(15,23,42,0.18);">
            <div style="padding: 12px 14px; background: #0f172a; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${resumen.activo ? '#10b981' : '#f59e0b'}; display: inline-block;"></span>
                <span style="color: #38bdf8; font-size: 12px; font-weight: 800;">BITÁCORA DEL AGENTE EN VIVO</span>
              </div>
              <button onclick="window.HOAutoUI.toggleCentinela()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;">
                ${resumen.activo ? '⏸️ Pausar' : '▶️ Reanudar'}
              </button>
            </div>

            <div id="ho-centinela-feed-box" style="padding: 12px 14px; max-height: 390px; overflow-y: auto; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11.5px; line-height: 1.5; color: #cbd5e1;">
              ${(resumen.logs || []).slice(0, 18).map(l => {
                const col = l.nivel === 'OK' ? '#34d399' : l.nivel === 'WARN' ? '#fbbf24' : '#38bdf8';
                return `
                  <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.07);">
                    <span style="color: #64748b;">[${escapeHtml(l.hora)}]</span>
                    <span style="color: ${col}; font-weight: 600;"> ${escapeHtml(l.texto)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  function renderTarjetaCasoOperativo(caso) {
    const badgeColor = caso.categoria === 'DESCUBIERTO_HO' ? '#dc2626'
      : caso.categoria === 'BAJA_IT' ? '#d97706'
      : caso.categoria === 'VACACIONES' ? '#7c3aed' : '#475569';

    const confColor = caso.confianza >= 90 ? '#059669' : caso.confianza >= 80 ? '#0284c7' : '#d97706';
    const isRunning = ViewState.ejecutandoId === caso.id;

    return `
      <div style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: ${caso.resuelto ? '#f0fdf4' : '#ffffff'}; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
        
        <!-- Bloque Izquierdo: Diagnóstico Real y Propuesta Calculada -->
        <div style="flex: 1; min-width: 320px;">
          
          <!-- Fila Superior: Etiquetas de Proyecto, Sociedad, Gestor y Confianza -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
            <span style="background: ${badgeColor}15; color: ${badgeColor}; border: 1px solid ${badgeColor}40; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
              ${escapeHtml(caso.categoria_label)}
            </span>
            <span style="font-family: monospace; font-size: 12px; font-weight: 900; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px;">
              ${escapeHtml(caso.proyecto_destino_sap)}
            </span>
            <span style="font-size: 11px; font-weight: 800; color: #334155; background: #f1f5f9; padding: 2px 8px; border-radius: 6px;">
              🏢 ${escapeHtml(caso.sociedad_activa)}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 6px;">
              👤 Gestor: ${escapeHtml(caso.gestor_nombre)}
            </span>
            <span style="font-size: 11px; font-weight: 800; color: ${confColor}; background: ${confColor}15; border: 1px solid ${confColor}40; padding: 2px 8px; border-radius: 99px;">
              🎯 ${caso.confianza}% Confianza ${caso.regla_aplicada ? `· Regla ${escapeHtml(caso.regla_aplicada)}` : ''}
            </span>
            ${caso.resuelto ? `
              <span style="background: #10b981; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px;">
                ✅ EJECUTADO EN SAP HO
              </span>
            ` : ''}
          </div>

          <!-- Nombre del Centro y Cliente -->
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
            ${escapeHtml(caso.denominacion)} <span style="font-weight: 500; color: #64748b; font-size: 12.5px;">· ${escapeHtml(caso.cliente)} (${escapeHtml(caso.poblacion)})</span>
          </div>

          <!-- Problema Detectado + Evidencia Real -->
          <div style="font-size: 12.5px; color: #334155; margin-bottom: 8px; line-height: 1.4;">
            <b>Diagnóstico:</b> ${escapeHtml(caso.problema_detectado)}
            <span style="color: #64748b;"> — ${escapeHtml(caso.evidencia_real)}</span>
          </div>

          <!-- Caja de la Propuesta del Agente (Qué voy a grabar en SAP HO) -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">
                🤖 Propuesta SAP HO: <span style="color: #0284c7;">${escapeHtml(caso.propuesta_resumen)}</span>
              </div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                Criterio usado: <b>${escapeHtml(caso.origen_propuesta)}</b>
              </div>
            </div>
          </div>

        </div>

        <!-- Bloque Derecho: Botones de Acción Directa y Aprendizaje -->
        <div style="display: flex; flex-direction: column; gap: 6px; min-width: 195px; align-items: stretch;">
          ${!caso.resuelto ? `
            <button
              onclick="window.HOAutoUI.aprobarYEjecutarCaso('${escapeHtml(caso.id)}')"
              ${isRunning ? 'disabled' : ''}
              style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(2,132,199,0.3);"
            >
              <span>⚡</span>
              <span>${isRunning ? 'Grabando en SAP...' : 'Aprobar y Ejecutar SAP'}</span>
            </button>

            <button
              onclick="window.HOAutoUI.abrirModalEnsenar('${escapeHtml(caso.id)}')"
              style="background: #ffffff; color: #0f172a; border: 1px solid #94a3b8; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"
            >
              <span>✏️</span>
              <span>Corregir / Enseñarme</span>
            </button>
          ` : `
            <button
              onclick="window.HOAutoUI.abrirModalEnsenar('${escapeHtml(caso.id)}')"
              style="background: #ffffff; color: #047857; border: 1px solid #10b981; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;"
            >
              ✏️ Reajustar / Ver Regla
            </button>
          `}

          <button
            onclick="window.HOAutoUI.abrirProyectoEnHO('${escapeHtml(caso.proyecto_destino_sap)}')"
            style="background: #f8fafc; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; text-align: center;"
          >
            🔗 Ver Cuadrante SAP UI5 ↗
          </button>
        </div>

      </div>
    `;
  }

  // ==========================================================================
  // PESTAÑA 2: LIBRO DE OFICIO (REGLAS APRENDIDAS Y MODO AUTÓNOMO POR REGLA)
  // ==========================================================================
  function renderLibroOficio(engine, reglas) {
    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 4px 12px rgba(15,23,42,0.04);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">
              🧠 Libro de Reglas de tu Oficio (${reglas.length} Reglas Operativas Activas)
            </h3>
            <p style="margin: 4px 0 0; font-size: 12.5px; color: #64748b;">
              Aquí se guarda todo lo que me enseñas cuando corriges un caso o escribes una instrucción arriba. Puedes decidir qué reglas ejecuto de forma <b>100% Autónoma</b>.
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 14px;">
          ${reglas.map(r => {
            const isAuto = r.modo === 'AUTONOMO';
            const isLote = r.modo === 'LOTE';
            return `
              <div style="border: 1px solid ${isAuto ? '#10b981' : '#cbd5e1'}; border-left: 5px solid ${isAuto ? '#10b981' : isLote ? '#0284c7' : '#94a3b8'}; border-radius: 12px; padding: 14px 16px; background: ${isAuto ? '#f0fdf4' : '#ffffff'}; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="font-family: monospace; font-size: 11.5px; font-weight: 800; color: #0f172a; background: #e2e8f0; padding: 2px 8px; border-radius: 6px;">
                      ${escapeHtml(r.id)} · ${escapeHtml(r.ambito)}
                    </span>
                    <span style="font-size: 11px; font-weight: 800; color: #059669;">
                      🎯 ${r.confianza || 95}% Confianza · Aplicada ${r.veces_aplicada || 1} veces
                    </span>
                  </div>

                  <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
                    ${escapeHtml(r.target_label)}
                  </div>

                  <div style="font-size: 12.5px; color: #334155; line-height: 1.45; background: rgba(255,255,255,0.8); padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    ${escapeHtml(r.criterio)}
                  </div>

                  <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; color: #475569;">
                    <span>👤 Operario pref.: <b>${escapeHtml(r.empleado_preferido || 'Auto')}</b></span>
                    <span>· ⏱️ Turno: <b>T${escapeHtml(r.turno || '01')} (${escapeHtml(r.hora_inicio || '08:00')}-${escapeHtml(r.hora_fin || '15:00')})</b></span>
                    <span>· 🏷️ Cód. SAP: <b>${escapeHtml(r.tipo_imputacion || 'TI')}</b></span>
                  </div>
                </div>

                <div style="padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <div style="display: flex; gap: 4px;">
                    <button onclick="window.HOAutoUI.cambiarModoRegla('${escapeHtml(r.id)}', 'SUGERIR')" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid #cbd5e1; background: ${r.modo === 'SUGERIR' ? '#334155' : '#fff'}; color: ${r.modo === 'SUGERIR' ? '#fff' : '#475569'};">
                      💡 Solo Sugerir
                    </button>
                    <button onclick="window.HOAutoUI.cambiarModoRegla('${escapeHtml(r.id)}', 'LOTE')" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid #0284c7; background: ${r.modo === 'LOTE' ? '#0284c7' : '#fff'}; color: ${r.modo === 'LOTE' ? '#fff' : '#0284c7'};">
                      ⚡ En Lote 1-Clic
                    </button>
                    <button onclick="window.HOAutoUI.cambiarModoRegla('${escapeHtml(r.id)}', 'AUTONOMO')" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid #059669; background: ${r.modo === 'AUTONOMO' ? '#059669' : '#fff'}; color: ${r.modo === 'AUTONOMO' ? '#fff' : '#059669'};">
                      🤖 100% Autónomo
                    </button>
                  </div>

                  <button onclick="window.HOAutoUI.eliminarRegla('${escapeHtml(r.id)}')" title="Borrar esta regla" style="background: none; border: none; color: #dc2626; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                    🗑️ Borrar
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  }

  // ==========================================================================
  // PESTAÑA 3: HISTORIAL DE EJECUCIONES SAP Y REVERSIÓN EN 1 CLIC
  // ==========================================================================
  function renderAuditoriaEjecuciones(engine, ejecuciones) {
    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 4px 12px rgba(15,23,42,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">
              📜 Registro de Operaciones Ejecutadas en SAP S/4HANA (${ejecuciones.length})
            </h3>
            <p style="margin: 4px 0 0; font-size: 12.5px; color: #64748b;">
              Control total: cualquier acción ejecutada por el Operador Autónomo puede revertirse en SAP HO con el botón <b>"↩️ Revertir en SAP"</b>.
            </p>
          </div>
        </div>

        ${ejecuciones.length === 0 ? `
          <div style="padding: 40px 20px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 10px;">
            Todavía no has ejecutado ninguna operación en esta sesión. Aprueba un caso en la Pestaña 1 o lanza el Lote Fiable.
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
              <thead>
                <tr style="background: #0f172a; color: #fff; text-align: left;">
                  <th style="padding: 10px 12px;">Fecha / Hora</th>
                  <th style="padding: 10px 12px;">Proyecto SAP</th>
                  <th style="padding: 10px 12px;">Acción / Cód.</th>
                  <th style="padding: 10px 12px;">Trabajador / Suplente</th>
                  <th style="padding: 10px 12px;">Horario</th>
                  <th style="padding: 10px 12px;">Regla Usada</th>
                  <th style="padding: 10px 12px;">Resultado SAP OData</th>
                  <th style="padding: 10px 12px; text-align: right;">Control / Deshacer</th>
                </tr>
              </thead>
              <tbody>
                ${ejecuciones.map(ex => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${ex.revertido ? '#fef2f2' : '#ffffff'};">
                    <td style="padding: 10px 12px; font-family: monospace; font-size: 11.5px; color: #475569;">${escapeHtml(ex.fecha_hora)}</td>
                    <td style="padding: 10px 12px; font-weight: 800; color: #1e40af;">
                      ${escapeHtml(ex.proyecto)}
                      <div style="font-size: 11px; color: #64748b; font-weight: 500;">${escapeHtml(ex.cliente || '')}</div>
                    </td>
                    <td style="padding: 10px 12px;">
                      <span style="background: #e0f2fe; color: #0369a1; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 11px;">
                        ${escapeHtml(ex.accion)} (${escapeHtml(ex.codigo_sap)})
                      </span>
                    </td>
                    <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
                      ${escapeHtml(ex.trabajador)}
                      ${ex.suplente ? `<div style="font-size:11px; color:#059669;">→ Suplente: ${escapeHtml(ex.suplente)}</div>` : ''}
                    </td>
                    <td style="padding: 10px 12px; font-family: monospace;">${escapeHtml(ex.horario)}</td>
                    <td style="padding: 10px 12px; font-size: 11.5px; color: #475569;">${escapeHtml(ex.regla_usada)}</td>
                    <td style="padding: 10px 12px; font-size: 11.5px; color: ${ex.revertido ? '#dc2626' : '#047857'}; font-weight: 600;">
                      ${ex.revertido ? `↩️ REVERTIDO (${escapeHtml(ex.fecha_reversion || '')})` : `✅ ${escapeHtml(ex.mensaje_sap)}`}
                    </td>
                    <td style="padding: 10px 12px; text-align: right;">
                      ${!ex.revertido ? `
                        <button onclick="window.HOAutoUI.revertirEjecucion('${escapeHtml(ex.id_ejecucion)}')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer;">
                          ↩️ Revertir en SAP
                        </button>
                      ` : `<span style="font-size:11px; color:#94a3b8;">Deshecho</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  // ==========================================================================
  // PESTAÑA 4: IMPUTACIÓN MANUAL DIRECTA + ENSEÑAR AL AGENTE
  // ==========================================================================
  function renderImputacionDirecta(engine) {
    const trabs = engine.getTrabajadoresCartera(ViewState.gestorFilter);
    const hoyIso = new Date().toISOString().slice(0, 10);

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; max-width: 920px; box-shadow: 0 4px 12px rgba(15,23,42,0.04);">
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 800; color: #0f172a;">
          ⚡ Consola de Ejecución Directa en SAP S/4HANA + Aprendizaje
        </h3>
        <p style="margin: 0 0 18px; font-size: 12.5px; color: #64748b;">
          Lanza cualquier imputación de cuadrante, suplencia, baja IT o vacaciones a <code>ZPS_HOPER_SRV</code> y márcala si quieres que el agente la memorice como regla fija.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 16px;">
          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Tipo de Operación SAP HO</label>
            <select id="ho-dir-accion" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700;">
              <option value="CUADRANTE">📅 Imputar en Cuadrante (CargaHASet)</option>
              <option value="SUSTITUIR">🔄 Sustituir Titular / Suplencia (CargaSPSet)</option>
              <option value="BAJA">🏥 Registrar Baja IT Titular (BJ)</option>
              <option value="VACACIONES">🏖️ Registrar Vacaciones (VC)</option>
              <option value="CESE">🗑️ Borrar / Cese de Turno en Cuadrante</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Código Proyecto SAP (P1 o P2)</label>
            <input type="text" id="ho-dir-proyecto" placeholder="Ej: PROY015730-P1 o P000080-P1" value="PROY015730-P1" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-family:monospace; font-weight:700; box-sizing:border-box;">
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Trabajador Principal / Ausente</label>
            <input type="text" id="ho-dir-trabajador" list="ho-dir-workers-list" placeholder="Nombre o busca en la lista..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; box-sizing:border-box;">
            <datalist id="ho-dir-workers-list">
              ${trabs.slice(0, 300).map(t => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.dni || '')} · ${escapeHtml(t.responsable_corto || '')}</option>`).join('')}
            </datalist>
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Suplente (si es Sustitución)</label>
            <input type="text" id="ho-dir-suplente" list="ho-dir-workers-list" placeholder="Opcional: Nombre del suplente..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; box-sizing:border-box;">
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Turno y Horario (Inicio - Fin)</label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="ho-dir-turno" value="01" placeholder="T01" style="width:55px; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; text-align:center; font-weight:700;">
              <input type="time" id="ho-dir-hini" value="08:00" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px;">
              <input type="time" id="ho-dir-hfin" value="15:00" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px;">
            </div>
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Fechas (Desde - Hasta)</label>
            <div style="display:flex; gap:6px;">
              <input type="date" id="ho-dir-fini" value="${hoyIso}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px;">
              <input type="date" id="ho-dir-ffin" value="2026-11-30" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px;">
            </div>
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Código Imputación SAP</label>
            <select id="ho-dir-tipoimp" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700;">
              <option value="TI">TI · Titular Servicio</option>
              <option value="SB">SB · Suplencia por Baja IT</option>
              <option value="SV">SV · Suplencia por Vacaciones</option>
              <option value="SP">SP · Suplencia Puntual / Apoyo</option>
              <option value="HE">HE · Horas Extras</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Tipo de Exceso SAP</label>
            <select id="ho-dir-exceso" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700;">
              <option value="Esporadico">Esporádico</option>
              <option value="Estructura">Estructura</option>
              <option value="Deuda">Bolsa / Deuda Horas</option>
              <option value="No">Sin Exceso</option>
            </select>
          </div>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="ho-dir-aprender" checked style="width: 16px; height: 16px; cursor: pointer;">
          <label for="ho-dir-aprender" style="font-size: 12.5px; font-weight: 700; color: #0369a1; cursor: pointer;">
            🧠 Memorizar esta asignación como Regla de Oficio para este proyecto (el agente la aplicará solo la próxima vez)
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button onclick="window.HOAutoUI.ejecutarFormularioDirecto()" style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #fff; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(2,132,199,0.3);">
            ⚡ Grabar en SAP S/4HANA y Enseñar Regla
          </button>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // MODAL DE ENSEÑANZA DEL OFICIO ("✏️ CORREGIR Y ENSEÑARME")
  // ==========================================================================
  function renderModalEnsenarOficio(engine, caso) {
    const trabs = engine.getTrabajadoresCartera(caso.gestor_id || ViewState.gestorFilter);
    const p = caso.payload_sap || {};

    return `
      <div class="ho-modal-backdrop" onclick="if(event.target===this) window.HOAutoUI.cerrarModalEnsenar()" style="position: fixed; inset: 0; background: rgba(15,23,42,0.65); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #ffffff; border-radius: 16px; max-width: 680px; width: 100%; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid #cbd5e1; font-family: 'Outfit', sans-serif;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800;">
                ✏️ Enseñar tu Criterio Operativo · ${escapeHtml(caso.proyecto_id)}
              </h3>
              <p style="margin: 3px 0 0; font-size: 12px; color: #94a3b8;">
                ${escapeHtml(caso.denominacion)} · Cartera: ${escapeHtml(caso.gestor_nombre)}
              </p>
            </div>
            <button onclick="window.HOAutoUI.cerrarModalEnsenar()" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 18px 20px;">
            
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #92400e; margin-bottom: 14px;">
              <b>Situación detectada:</b> ${escapeHtml(caso.problema_detectado)}<br>
              <b>Evidencia:</b> ${escapeHtml(caso.evidencia_real)}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              
              <div>
                <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Proyecto / Sociedad SAP Destino</label>
                <input type="text" id="ho-teach-proy" value="${escapeHtml(caso.proyecto_destino_sap)}" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-family:monospace; font-weight:700; box-sizing:border-box;">
                ${caso.proyecto_alternativo ? `
                  <div style="font-size:11px; color:#0284c7; margin-top:3px; cursor:pointer;" onclick="document.getElementById('ho-teach-proy').value='${escapeHtml(caso.proyecto_alternativo.replace('-C001',''))}'">
                    🔄 Cambiar a sociedad alternativa: <b>${escapeHtml(caso.proyecto_alternativo.replace('-C001',''))}</b>
                  </div>
                ` : ''}
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">
                  ${caso.categoria === 'BAJA_IT' ? 'Suplente a Imputar en SAP HO' : 'Trabajador a Imputar en SAP HO'}
                </label>
                <input type="text" id="ho-teach-emp" list="ho-teach-emp-list" value="${escapeHtml(p.suplente || p.trabajador || '')}" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; box-sizing:border-box;">
                <datalist id="ho-teach-emp-list">
                  ${(caso.candidatos_alternativos || []).map(c => `<option value="${escapeHtml(c)}">⭐ Detectado en Bitácora del Centro</option>`).join('')}
                  ${trabs.map(t => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.horas_semana || 35)}h/sem · ${escapeHtml(t.responsable_corto || '')}</option>`).join('')}
                </datalist>
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Turno y Horario (Inicio - Fin)</label>
                <div style="display:flex; gap:6px;">
                  <input type="text" id="ho-teach-turno" value="${escapeHtml(p.turno || '01')}" style="width:52px; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; text-align:center;">
                  <input type="time" id="ho-teach-hini" value="${escapeHtml(p.hora_inicio || '08:00')}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px;">
                  <input type="time" id="ho-teach-hfin" value="${escapeHtml(p.hora_fin || '15:00')}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px;">
                </div>
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:800; color:#334155; margin-bottom:4px;">Código Imputación y Tipo Exceso</label>
                <div style="display:flex; gap:6px;">
                  <select id="ho-teach-tipoimp" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; font-weight:700;">
                    <option value="TI" ${p.tipo_imputacion === 'TI' ? 'selected' : ''}>TI · Titular</option>
                    <option value="SB" ${p.tipo_imputacion === 'SB' ? 'selected' : ''}>SB · Supl. Baja</option>
                    <option value="SV" ${p.tipo_imputacion === 'SV' ? 'selected' : ''}>SV · Supl. Vacac.</option>
                    <option value="SP" ${p.tipo_imputacion === 'SP' ? 'selected' : ''}>SP · Supl. Puntual</option>
                  </select>
                  <select id="ho-teach-exceso" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; font-weight:700;">
                    <option value="Esporadico" ${p.tipo_exceso === 'Esporadico' ? 'selected' : ''}>Esporádico</option>
                    <option value="Estructura" ${p.tipo_exceso === 'Estructura' ? 'selected' : ''}>Estructura</option>
                    <option value="Deuda" ${p.tipo_exceso === 'Deuda' ? 'selected' : ''}>Deuda Horas</option>
                  </select>
                </div>
              </div>

            </div>

            <!-- Bloque de Aprendizaje de Regla -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <input type="checkbox" id="ho-teach-save-rule" checked style="width:16px; height:16px;">
                <label for="ho-teach-save-rule" style="font-size:12.5px; font-weight:800; color:#065f46; cursor:pointer;">
                  🧠 Aprender esta decisión como Regla de Oficio Permanente
                </label>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:8px;">
                <div>
                  <label style="display:block; font-size:11px; font-weight:700; color:#047857; margin-bottom:3px;">Aplicar esta regla a:</label>
                  <select id="ho-teach-ambito" style="width:100%; padding:6px 8px; border:1px solid #86efac; border-radius:6px; font-size:12px; font-weight:700;">
                    <option value="PROYECTO">Este Proyecto (${escapeHtml(caso.proyecto_id)})</option>
                    <option value="CLIENTE">Todo el Cliente (${escapeHtml(caso.cliente)})</option>
                    <option value="GESTOR">Toda la Cartera de ${escapeHtml(caso.gestor_nombre)}</option>
                  </select>
                </div>

                <div>
                  <label style="display:block; font-size:11px; font-weight:700; color:#047857; margin-bottom:3px;">Nivel de Autonomía para esta regla:</label>
                  <select id="ho-teach-modo" style="width:100%; padding:6px 8px; border:1px solid #86efac; border-radius:6px; font-size:12px; font-weight:700;">
                    <option value="AUTONOMO">🤖 100% Autónomo (Hacerlo solo en el futuro)</option>
                    <option value="LOTE" selected>⚡ Casi Autónomo (Incluir en Lote 1-Clic)</option>
                    <option value="SUGERIR">💡 Solo Sugerir</option>
                  </select>
                </div>
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:700; color:#047857; margin-bottom:3px;">Nota de criterio (opcional):</label>
                <input type="text" id="ho-teach-nota" placeholder="Ej: Usar siempre a este correturnos cuando falle el titular en este cliente..." style="width:100%; padding:6px 10px; border:1px solid #86efac; border-radius:6px; font-size:12px; box-sizing:border-box;">
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
            <button onclick="window.HOAutoUI.cerrarModalEnsenar()" style="background: #fff; border: 1px solid #cbd5e1; color: #475569; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
              Cancelar
            </button>
            <button onclick="window.HOAutoUI.guardarEnsenanza('${escapeHtml(caso.id)}', false)" style="background: #0f172a; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer;">
              💾 Solo Guardar Regla
            </button>
            <button onclick="window.HOAutoUI.guardarEnsenanza('${escapeHtml(caso.id)}', true)" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.3);">
              ⚡ Guardar Regla y Ejecutar Ahora en SAP HO
            </button>
          </div>

        </div>
      </div>
    `;
  }

  // ==========================================================================
  // CONTROLADOR DE EVENTOS DE LA INTERFAZ (window.HOAutoUI)
  // ==========================================================================
  window.HOAutoUI = {
    setSubTab: function (tab) {
      ViewState.activeSubTab = tab;
      refreshView();
    },

    setCategoria: function (cat) {
      ViewState.categoriaFilter = cat;
      ViewState.paginaActual = 1;
      refreshView();
    },

    onBuscarCola: function (q) {
      ViewState.busqueda = q;
      ViewState.paginaActual = 1;
      refreshView();
    },

    irPagina: function (pag) {
      ViewState.paginaActual = Math.max(1, pag);
      refreshView();
    },

    cambiarAutonomia: function (nivel) {
      if (!window.HOAutoEngine) return;
      window.HOAutoEngine.setNivelAutonomia(nivel);
      const etiquetas = {
        1: '🎓 Modo Aprendiz activado: Te propongo cada caso y aprendo de tus correcciones.',
        2: '⚡ Modo Casi Autónomo activado: Lotes fiables listos para ejecutar en 1 clic.',
        3: '🤖 Modo Autónomo 24x7 activado: Ejecutando automáticamente las reglas autorizadas.'
      };
      if (typeof window.showToast === 'function') {
        window.showToast(etiquetas[nivel] || 'Nivel de autonomía actualizado', 'bg-blue');
      }
      refreshView();
    },

    aprobarYEjecutarCaso: async function (idCaso) {
      if (!window.HOAutoEngine) return;
      ViewState.ejecutandoId = idCaso;
      refreshView();

      const res = await window.HOAutoEngine.ejecutarCasoEnSAP(idCaso);
      ViewState.ejecutandoId = null;

      if (typeof window.showToast === 'function') {
        window.showToast((res && res.ok ? '✅ ' : '⚠️ ') + (res ? res.mensaje : 'Operación procesada'), res && res.ok ? 'bg-emerald' : 'bg-amber');
      }
      refreshView();
    },

    ejecutarLoteValidado: async function () {
      if (!window.HOAutoEngine || ViewState.ejecutandoLote) return;
      ViewState.ejecutandoLote = true;
      refreshView();

      const res = await window.HOAutoEngine.ejecutarLoteAltaConfianza(ViewState.gestorFilter, 8);
      ViewState.ejecutandoLote = false;

      if (typeof window.showToast === 'function') {
        window.showToast('⚡ ' + res.mensaje, 'bg-emerald');
      }
      refreshView();
    },

    abrirModalEnsenar: function (idCaso) {
      if (!window.HOAutoEngine) return;
      const caso = window.HOAutoEngine.getCasoById(idCaso);
      if (!caso) return;
      ViewState.modalEnsenarCaso = caso;
      refreshView();
    },

    cerrarModalEnsenar: function () {
      ViewState.modalEnsenarCaso = null;
      refreshView();
    },

    guardarEnsenanza: async function (idCaso, ejecutarAhora) {
      if (!window.HOAutoEngine) return;
      const proy = (document.getElementById('ho-teach-proy') || {}).value || '';
      const emp = (document.getElementById('ho-teach-emp') || {}).value || '';
      const turno = (document.getElementById('ho-teach-turno') || {}).value || '01';
      const hini = (document.getElementById('ho-teach-hini') || {}).value || '08:00';
      const hfin = (document.getElementById('ho-teach-hfin') || {}).value || '15:00';
      const tipoimp = (document.getElementById('ho-teach-tipoimp') || {}).value || 'TI';
      const exceso = (document.getElementById('ho-teach-exceso') || {}).value || 'Esporadico';
      const saveRule = Boolean((document.getElementById('ho-teach-save-rule') || {}).checked);
      const ambito = (document.getElementById('ho-teach-ambito') || {}).value || 'PROYECTO';
      const modo = (document.getElementById('ho-teach-modo') || {}).value || 'LOTE';
      const nota = (document.getElementById('ho-teach-nota') || {}).value || '';

      const resLearn = window.HOAutoEngine.ensenarCorreccionOficio(idCaso, {
        proyecto: proy.trim(),
        trabajador: emp.trim(),
        suplente: emp.trim(),
        turno: turno.trim(),
        hora_inicio: hini,
        hora_fin: hfin,
        tipo_imputacion: tipoimp,
        tipo_exceso: exceso,
        guardar_regla: saveRule,
        ambito_regla: ambito,
        modo_autonomo: modo,
        criterio_texto: nota.trim()
      });

      ViewState.modalEnsenarCaso = null;

      if (ejecutarAhora) {
        await this.aprobarYEjecutarCaso(idCaso);
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast('🧠 ' + resLearn.mensaje, 'bg-blue');
        }
        refreshView();
      }
    },

    enviarOrdenDirecta: function () {
      const input = document.getElementById('ho-pizarra-quick-input');
      if (!input || !input.value.trim() || !window.HOAutoEngine) return;
      const texto = input.value.trim();
      input.value = '';

      const res = window.HOAutoEngine.aprenderReglaDesdeTexto(texto, ViewState.gestorFilter);
      if (typeof window.showToast === 'function') {
        window.showToast('🧠 ' + res.mensaje, 'bg-emerald');
      }
      refreshView();
    },

    cambiarModoRegla: function (idRegla, nuevoModo) {
      if (!window.HOAutoEngine) return;
      window.HOAutoEngine.cambiarModoRegla(idRegla, nuevoModo);
      if (typeof window.showToast === 'function') {
        window.showToast(`⚙️ Regla ${idRegla} actualizada a modo ${nuevoModo}`, 'bg-blue');
      }
      refreshView();
    },

    eliminarRegla: function (idRegla) {
      if (!window.HOAutoEngine) return;
      window.HOAutoEngine.eliminarRegla(idRegla);
      if (typeof window.showToast === 'function') {
        window.showToast(`🗑️ Regla ${idRegla} eliminada`, 'bg-amber');
      }
      refreshView();
    },

    revertirEjecucion: async function (idEjecucion) {
      if (!window.HOAutoEngine) return;
      const res = await window.HOAutoEngine.revertirEjecucionSAP(idEjecucion);
      if (typeof window.showToast === 'function') {
        window.showToast('↩️ ' + res.mensaje, 'bg-amber');
      }
      refreshView();
    },

    ejecutarFormularioDirecto: async function () {
      if (!window.HOAutoEngine) return;
      const accion = (document.getElementById('ho-dir-accion') || {}).value || 'CUADRANTE';
      const proy = ((document.getElementById('ho-dir-proyecto') || {}).value || 'PROY015730-P1').trim();
      const trab = ((document.getElementById('ho-dir-trabajador') || {}).value || '').trim();
      const sup = ((document.getElementById('ho-dir-suplente') || {}).value || '').trim();
      const turno = ((document.getElementById('ho-dir-turno') || {}).value || '01').trim();
      const hini = (document.getElementById('ho-dir-hini') || {}).value || '08:00';
      const hfin = (document.getElementById('ho-dir-hfin') || {}).value || '15:00';
      const fini = (document.getElementById('ho-dir-fini') || {}).value || new Date().toISOString().slice(0, 10);
      const ffin = (document.getElementById('ho-dir-ffin') || {}).value || '2026-11-30';
      const tipoimp = (document.getElementById('ho-dir-tipoimp') || {}).value || 'TI';
      const exceso = (document.getElementById('ho-dir-exceso') || {}).value || 'Esporadico';
      const aprender = Boolean((document.getElementById('ho-dir-aprender') || {}).checked);

      if (!trab && !sup) {
        if (typeof window.showToast === 'function') {
          window.showToast('⚠️ Indica al menos el nombre del trabajador o suplente.', 'bg-amber');
        }
        return;
      }

      if (aprender) {
        window.HOAutoEngine.aprenderReglaDesdeTexto(
          `En ${proy} asignar siempre a ${sup || trab} de ${hini} a ${hfin} con código ${tipoimp} (${exceso})`,
          ViewState.gestorFilter
        );
      }

      try {
        await fetch('http://127.0.0.1:5005/tramitar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: accion,
            proyecto: proy,
            trabajador: trab || sup,
            suplente: sup,
            turno: turno,
            hora_inicio: hini,
            hora_fin: hfin,
            fecha_inicio: fini,
            fecha_fin: ffin,
            tipo_imputacion: tipoimp,
            tipo_exceso: exceso
          })
        });
      } catch (e) {}

      if (typeof window.showToast === 'function') {
        window.showToast(`✅ Operación ${accion} enviada a SAP HO para ${proy} (${sup || trab})`, 'bg-emerald');
      }
      ViewState.activeSubTab = 'auditoria';
      refreshView();
    },

    toggleCentinela: function () {
      if (!window.HOAutoEngine) return;
      window.HOAutoEngine.toggleCentinela24x7();
      refreshView();
    },

    abrirProyectoEnHO: function (proyId) {
      if (window.ProApp && typeof window.ProApp.abrirEnHO === 'function') {
        window.ProApp.abrirEnHO(proyId);
      } else {
        const clean = (proyId || 'PROY015730-P1').trim();
        const url = `http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/index.html?sap-client=100&sap-language=ES&tab=CUADR#/projectDetail/${encodeURIComponent(JSON.stringify({ value: clean, type: 'Edm.String' }))}`;
        window.open(url, '_blank');
      }
    },

    // Compatibilidad
    autoRepararTodo: function () { this.ejecutarLoteValidado(); },
    autoRepararCaso: function (idCaso) { this.aprobarYEjecutarCaso(idCaso); },
    attachListeners: function () {},
    actualizarDOMCentinela: function (estado) {
      const feedBox = document.getElementById('ho-centinela-feed-box');
      if (!feedBox || !estado || !Array.isArray(estado.logs)) return;
      feedBox.innerHTML = estado.logs.slice(0, 18).map(l => {
        const col = l.nivel === 'OK' ? '#34d399' : l.nivel === 'WARN' ? '#fbbf24' : '#38bdf8';
        return `
          <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.07);">
            <span style="color: #64748b;">[${escapeHtml(l.hora)}]</span>
            <span style="color: ${col}; font-weight: 600;"> ${escapeHtml(l.texto)}</span>
          </div>
        `;
      }).join('');
    }
  };

  if (window.HOAutoEngine && typeof window.HOAutoEngine.onCentinelaTick === 'function') {
    window.HOAutoEngine.onCentinelaTick(function (nuevoEstado) {
      if (window.HOAutoUI) window.HOAutoUI.actualizarDOMCentinela(nuevoEstado);
    });
  }

})();
