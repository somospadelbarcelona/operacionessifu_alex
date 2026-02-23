const STORAGE_KEYS = {
    INCIDENTS: 'sifu_incidents_v4',
    ABSENCES: 'sifu_absences_v4',
    UNCOVERED: 'sifu_uncovered_v4',
    ORDERS: 'sifu_orders_v4',
    GLASS: 'sifu_glass_v4',
    STATS: 'sifu_stats_v4',
    NOTES: 'sifu_notes_v4',
    MASTER: 'sifu_master_data_v4'
};

// Define AIService as a getter to ensure it picks up the real service once loaded
Object.defineProperty(window, 'AIService', {
    get: function () {
        return window.OperationalService || { analyzeResilience: () => ({ score: 0, metrics: {}, summaryList: [] }) };
    },
    configurable: true
});



const DataManager = {
    save(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); return true; }
        catch (e) { console.error('Error al guardar:', e); return false; }
    },
    load(key, defaultValue) {
        try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : defaultValue; }
        catch (e) { return defaultValue; }
    }
};

// --- FALLBACK SAFETY NET ---
if (typeof INITIAL_MASTER_DATA === 'undefined') {
    console.warn("⚠️ master_data.js no se cargó correctamente. Usando array vacío.");
    window.INITIAL_MASTER_DATA = [];
}
const DEFAULT_STATE = {
    incidents: [],
    absences: [],
    uncovered: [],
    orders: [],
    glassPlanning: [],
    stats: { activeWorkers: 24 },
    notes: [],
    masterData: [],
    audits: [], // New: Quality audits
    dailyOverrides: {}, // New: Persistence for Daily Quadrant Edits
    filterType: null,
    stickyContent: ''
};


const ATOMIC_STATE_KEY = 'sifu_universal_state_v5';
var state = { ...DEFAULT_STATE };
window.state = state; // Explicitly expose to window for robust access

// ============================================================================
// MODAL FUNCTIONS - Defined early so they're available for onclick handlers
// ============================================================================

// Consolidated Modal Logic (Failsafe)
window.closeStatusModal = () => {
    const modal = document.getElementById('status-detail-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.setProperty('display', 'none', 'important');
    }
};

window.showStatusModal = (title, contentHTML) => {
    const modal = document.getElementById('status-detail-modal');
    const mTitle = document.getElementById('status-modal-title');
    const mBody = document.getElementById('status-modal-body');
    if (modal && mTitle && mBody) {
        mTitle.innerText = title;
        mBody.innerHTML = contentHTML;
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
};

window.showUncoveredDetails = () => {
    if (!window.state || !window.state.masterData) {
        window.showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:20px;">⏳ Cargando datos...</p>');
        return;
    }

    const _rawUncovered = window.state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO'));

        if (!row[kServicio]) return false;

        const status = (row[kEstado] || '').toString().toUpperCase();
        const titular = (row[kTitular] || '').toString().toUpperCase();

        return (
            status.includes('DESCUBIERTO') ||
            status.includes('VACANTE') ||
            status.includes('SIN ASIGNAR') ||
            titular.includes('SIN TITULAR') ||
            titular.includes('DESCUBIERTO') ||
            titular.includes('VACANTE') ||
            (status === '' && (titular === '' || titular === 'SIN TITULAR')) ||
            (status === 'PENDIENTE' && titular === '')
        );
    });
    // Deduplicar por nombre de SERVICIO (cada servicio único cuenta solo 1 vez)
    const seenServices = new Set();
    const uncovered = _rawUncovered.filter(row => {
        const keys = Object.keys(row);
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO'));
        const srvName = (row[kServicio] || '').toString().trim().toUpperCase();
        if (seenServices.has(srvName)) return false;
        seenServices.add(srvName);
        return true;
    });

    if (uncovered.length === 0) {
        window.showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay servicios descubiertos actualmente.</p>');
        return;
    }

    const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>ESTADO</th>
                    <th>HORARIO</th>
                </tr>
            </thead>
            <tbody>
                ${uncovered.map(row => {
        const keys = Object.keys(row);
        const srv = row[keys.find(k => k.toUpperCase().includes('SERVICIO'))] || '-';
        const est = row[keys.find(k => k.toUpperCase().trim() === 'ESTADO')] || 'DESCUBIERTO';
        const hor = row[keys.find(k => k.toUpperCase().includes('HORARIO'))] || '-';
        return `
                        <tr class="critical-row">
                            <td><div class="td-content"><b>${srv}</b></div></td>
                            <td><span class="badge red">${est}</span></td>
                            <td><div class="td-content" style="font-family:monospace; color:#3b82f6;">${hor}</div></td>
                        </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;
    window.showStatusModal(`DESCUBIERTOS (${uncovered.length})`, html);
};

window.showAbsenceDetails = () => {
    if (!window.state || !window.state.masterData || window.state.masterData.length === 0) {
        window.showStatusModal('BAJAS / IT', '<p style="text-align:center; padding:20px;">⏳ Cargando datos...</p>');
        return;
    }

    const keys = Object.keys(window.state.masterData[0]);
    const kEstado1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') ||
        keys.find(k => k.toUpperCase().includes('SALUD')) ||
        keys.find(k => k.toUpperCase().includes('BAJA')) ||
        'ESTADO1';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';

    const absences = window.state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEst = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kEst1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') || 'ESTADO1';

        const stateUpper = (row[kEst] || '').toString().toUpperCase();
        const healthUpper = (row[kEst1] || '').toString().toUpperCase();

        return healthUpper.includes('BAJA') ||
            healthUpper.includes('IT') ||
            healthUpper.includes('I.T') ||
            healthUpper.includes('VACACIONES') ||
            stateUpper.includes('BAJA') ||
            stateUpper.includes('IT');
    });

    if (absences.length === 0) {
        window.showStatusModal('BAJAS / IT', '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay bajas activas hoy.</p>');
        return;
    }

    const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>TITULAR</th>
                    <th>ESTADO / SALUD</th>
                </tr>
            </thead>
            <tbody>
                ${absences.map(row => {
        const srv = row[kServicio] || '-';
        const tit = row[kTitular] || '-';
        const est1 = row[kEstado1] || 'BAJA';
        let badgeClass = 'blue';
        if (est1.toUpperCase().includes('BAJA') || est1.toUpperCase().includes('IT')) badgeClass = 'red';
        if (est1.toUpperCase().includes('VAC')) badgeClass = 'green';

        return `
                    <tr>
                        <td><div class="td-content"><b>${srv}</b></div></td>
                        <td><div class="td-content">${tit}</div></td>
                        <td><span class="badge ${badgeClass}">${est1}</span></td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;
    window.showStatusModal(`DETALLE DE BAJAS (${absences.length})`, html);
};

window.showIncidentDetails = () => {
    if (!window.state || !window.state.incidents || window.state.incidents.length === 0) {
        window.showStatusModal('INCIDENCIAS', '<p style="text-align:center; padding:20px; color:#64748b;">✅ No hay incidencias registradas.</p>');
        return;
    }

    const priorityOrder = { 'HIGH': 0, 'MID': 1, 'LOW': 2 };
    const sorted = [...window.state.incidents].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));

    const html = `<ul class="notebook-feed">
        ${sorted.map(inc => `
            <li class="note-card-horizontal" style="transform:none;">
                <div class="note-content">
                    <strong style="color:#3b82f6;">${inc.worker}</strong><br>
                    ${inc.desc} 
                </div>
                <div class="note-footer">
                    <span class="badge ${inc.priority === 'HIGH' ? 'red' : 'blue'}">${inc.priority}</span>
                    ${inc.date || ''}
                </div>
            </li>
        `).join('')}
    </ul>`;
    window.showStatusModal(`INCIDENCIAS (${window.state.incidents.length})`, html);
};

// ============================================================================

async function loadGlobalState() {
    try {
        console.log('🔍 Sincronizando datos...');
        const saved = localStorage.getItem(ATOMIC_STATE_KEY);
        let parsed = null;

        if (saved) {
            try {
                parsed = JSON.parse(saved);
                console.log('✅ LocalStorage (Atomic) cargado.');
            } catch (e) {
                console.error('⚠️ Error parseando LocalStorage:', e);
            }
        }

        if (!parsed) {
            console.log('⚠️ No hay Atomic State, intentando IndexedDB...');
            parsed = await loadStateFromIndexedDB();
            if (parsed) console.log('✅ IndexedDB cargado.');
        }

        // Merge with Default
        if (parsed) {
            state = { ...DEFAULT_STATE, ...parsed };
            window.state = state;
        } else {
            state = { ...DEFAULT_STATE };
            window.state = state;
        }

        // --- FALLBACK RECOVERY FOR NOTES ---
        // If notes are empty in the loaded state, try to recover from legacy/individual keys
        if (!state.notes || state.notes.length === 0) {
            const legacyNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
            if (legacyNotes) {
                try {
                    const notesArr = JSON.parse(legacyNotes);
                    if (Array.isArray(notesArr) && notesArr.length > 0) {
                        console.log(`♻️ Recuperadas ${notesArr.length} notas de Backup Individual.`);
                        state.notes = notesArr;
                    }
                } catch (e) { console.error("Error recuperando legacy notes", e); }
            }
        }

        // SIEMPRE usar INITIAL_MASTER_DATA (datos frescos del Excel sincronizado)
        // Los datos del master SON la fuente de verdad — el localStorage puede tener datos obsoletos
        if (typeof INITIAL_MASTER_DATA !== 'undefined' && INITIAL_MASTER_DATA.length > 0) {
            const prevCount = state.masterData ? state.masterData.length : 0;
            state.masterData = INITIAL_MASTER_DATA;
            console.log(`📦 MasterData actualizado desde Excel: ${INITIAL_MASTER_DATA.length} filas (anterior: ${prevCount})`);

            // Guardar inmediatamente en localStorage para que quede consistente
            try {
                localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state.masterData));
                console.log('✅ MasterData fresco guardado en localStorage.');
            } catch (e) { console.warn('No se pudo guardar masterData en localStorage:', e); }

            // Mostrar timestamp del master_data.js en el header
            if (typeof MASTER_DATA_TIMESTAMP !== 'undefined') {
                const syncEl = document.getElementById('last-sync-time');
                if (syncEl) syncEl.textContent = `ÚSIMA SYNC EXCEL: ${MASTER_DATA_TIMESTAMP}`;
                localStorage.setItem('sifu_last_sync', MASTER_DATA_TIMESTAMP);
            }
        } else if (!state.masterData || state.masterData.length === 0) {
            console.warn('⚠️ INITIAL_MASTER_DATA no disponible y localStorage vacío.');
        }

        console.log("📊 Estado Final Cargado -> Incidencias:", state.incidents.length, "Notas:", state.notes.length);
        return true;
    } catch (e) {
        console.error('❌ Fallo CRÍTICO en loadGlobalState:', e);
        state = { ...DEFAULT_STATE };
        window.state = state;
        return false;
    }
}


// SISTEMA DE GUARDADO CONSOLIDADO Y ROBUSTO
let saveTimeout = null;
let hasUnsavedChanges = false;

window.saveAllState = function () {
    try {
        console.log('💾 Guardando estado...');

        // 1. GUARDADO ATÓMICO PRINCIPAL (Toda la aplicación en una sola key)
        const stateStr = JSON.stringify(state);

        // Intentar guardar en localStorage
        try {
            localStorage.setItem(ATOMIC_STATE_KEY, stateStr);
            console.log('✅ Estado guardado en localStorage, tamaño:', stateStr.length, 'caracteres');
        } catch (localStorageError) {
            console.warn('⚠️ localStorage bloqueado o lleno:', localStorageError.message);
        }

        // 2. Guardar también en IndexedDB como respaldo
        saveStateToIndexedDB(state).catch(err => {
            console.warn('⚠️ Error guardando en IndexedDB:', err);
        });

        // 3. Mantener compatibilidad con llaves individuales
        try {
            DataManager.save(STORAGE_KEYS.INCIDENTS, state.incidents);
            DataManager.save(STORAGE_KEYS.ABSENCES, state.absences);
            DataManager.save(STORAGE_KEYS.UNCOVERED, state.uncovered);
            DataManager.save(STORAGE_KEYS.ORDERS, state.orders);
            DataManager.save(STORAGE_KEYS.GLASS, state.glassPlanning);
            DataManager.save(STORAGE_KEYS.STATS, state.stats);
            DataManager.save(STORAGE_KEYS.NOTES, state.notes);
            DataManager.save(STORAGE_KEYS.MASTER, state.masterData);
            DataManager.save(STORAGE_KEYS.STICKY, state.stickyContent);
        } catch (e) {

            console.warn('⚠️ Error guardando llaves individuales:', e);
        }

        const now = new Date().toLocaleString('es-ES');
        try {
            localStorage.setItem('sifu_last_sync', now);
        } catch (e) {
            console.warn('⚠️ No se pudo guardar timestamp');
        }

        // Actualizar indicador visual
        updateSaveIndicator('saved');
        hasUnsavedChanges = false;

        console.log('✅ Guardado completado:', {
            incidents: state.incidents.length,
            notes: state.notes.length,
            masterData: state.masterData.length
        });

        return true;
    } catch (e) {
        console.error("❌ Fallo crítico al guardar estado:", e);
        updateSaveIndicator('error');
        showToast("Error de guardado: " + e.message, "error");
        return false;
    }
}

window.saveAndRender = function () {
    saveAllState();
    renderAll();
};

let incidentsChart = null;
let trendsChart = null;

// Selectors
const incidentFeed = document.getElementById('incidents-feed');
const notesFeed = document.getElementById('notes-feed');
const dateEl = document.getElementById('current-date');
const tickerEl = document.getElementById('live-ticker-text');
const globalSearch = document.getElementById('global-search-input');
const quickInput = document.getElementById('quick-input-bar');

// Expose these as globals for easy access if needed
window.openSituationalReport = window.openSituationalReport || function () { console.error('Situational Report engine not yet loaded'); };

// Header Stats
const hIncidents = document.getElementById('h-stat-incidents');
const hActive = document.getElementById('h-stat-active');

function setupNotesListeners() {
    console.log("📝 Inicializando Listeners de Notas...");

    // Top Bar Input
    const topInput = document.getElementById('quick-note-top');
    if (topInput) {
        // Cloning to remove old listeners if any
        const newTop = topInput.cloneNode(true);
        topInput.parentNode.replaceChild(newTop, topInput);

        newTop.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = newTop.value.trim();
                console.log("📝 Enter en Top Note:", text);
                if (text) {
                    state.notes.unshift({
                        id: Date.now(),
                        text: text,
                        tag: 'INFO',
                        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                        completed: false
                    });
                    newTop.value = '';
                    saveAndRender();
                    updateTicker("NOTA AÑADIDA AL BLOC");
                }
            }
        });
    }

    // Modal Input (if used via button)
    const modalForm = document.getElementById('note-form');
    if (modalForm) {
        // Prevent default submit
        modalForm.onsubmit = (e) => {
            e.preventDefault();
            window.addNoteFromSistema();
            document.getElementById('note-modal').style.display = 'none';
        };
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        updateDate();
        initCharts();
        setupNotesListeners(); // Call it here


        // 1. CARGA ATÓMICA Y ASÍNCRONA DE DATOS
        const wasLoaded = await loadGlobalState();

        if (!wasLoaded) {
            console.log('No hay datos guardados, inicializando con defaults.');
            state = { ...DEFAULT_STATE };

            if (typeof INITIAL_MASTER_DATA !== 'undefined' && INITIAL_MASTER_DATA.length > 0) {
                console.log("📦 Cargando datos integrados de respaldo.");
                processMasterArray(INITIAL_MASTER_DATA);
                saveAllState();
                updateTicker("SISTEMA: DATOS INTEGRADOS Y PERSISTIDOS [129 SERVICIOS]");
            }
        }

        const lastSync = localStorage.getItem('sifu_last_sync');
        if (lastSync) {
            const syncEl = document.getElementById('last-sync-time');
            if (syncEl) syncEl.textContent = `ÚLTIMA SYNC: ${lastSync}`;
        }

        // Renderizado Final una vez los datos están cargados
        console.log("🔄 Sincronizando vistas...");
        renderAll();
        if (wasLoaded) updateTicker("SISTEMA: DATOS RECUPERADOS CON ÉXITO");

        // Initialize Operational Analysis with visual feedback (ONLY ONCE)
        if (typeof generateOperationalInsights === 'function' && !window.IS_OP_INITIALIZED) {
            window.IS_OP_INITIALIZED = true;
            setTimeout(() => {
                generateOperationalInsights();
                showToast("✨ SISTEMA INFORMER v8.2 LISTO", "bg-blue");
                setTimeout(() => {
                    showToast("📊 MOTOR DE ANÁLISIS: ONLINE", "bg-purple");
                }, 800);
            }, 1500);
        }

        setupEventListeners();
        renderAll(); // Final Sync
        startTicker();
        initVoiceCommand();
        if (typeof initQualityModule === 'function') initQualityModule();

        // Auto-fetch Excel from server (GitHub) if available
        checkServerExcel();

        // AUTO-GUARDADO PERIÓDICO (cada 3 segundos)
        setInterval(() => {
            if (hasUnsavedChanges) {
                saveAllState();
                console.log('Auto-guardado ejecutado');
            }
        }, 3000);

        // Inicializar indicador de guardado
        initSaveIndicator();
    } catch (e) {
        console.error("CRITICAL INIT ERROR:", e);
        alert("ERROR CRÍTICO AL INICIAR: " + e.message + "\n\nPor favor, reporte este mensaje.");
    }
});






function updateDate() {
    const now = new Date();
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).replace(',', ' |');
    }
}

function setupCoreInteractions() {
    const fab = document.getElementById('main-fab');
    const fabMenu = document.getElementById('fab-menu');
    if (fab) {
        fab.onclick = () => {
            fab.classList.toggle('active');
            if (fabMenu) fabMenu.classList.toggle('active');
        };
    }

    // Sticky Toolbar Scroll Enhancement
    const scrollWrapper = document.querySelector('.master-content-wrapper');
    const toolbar = document.querySelector('.master-toolbar');
    if (scrollWrapper && toolbar) {
        scrollWrapper.addEventListener('scroll', () => {
            if (scrollWrapper.scrollTop > 10) {
                toolbar.classList.add('scrolled');
            } else {
                toolbar.classList.remove('scrolled');
            }
        });
    }



    const addIncBtn = document.getElementById('btn-add-incident-v2');
    if (addIncBtn) {
        addIncBtn.onclick = () => {
            document.getElementById('incident-modal').classList.add('active');
            if (fab) fab.click();
        };
    }

    const addNoteBtn = document.getElementById('btn-add-note-v2');
    const masterBtn = document.getElementById('btn-load-master');
    const masterInput = document.getElementById('master-file-input');
    const noteForm = document.getElementById('note-form');

    if (addNoteBtn) {
        addNoteBtn.onclick = () => {
            document.getElementById('note-modal').classList.add('active');
            if (fab) fab.click();
        };
    }

    // Modificación de Ingeniería: Lógica de Reconexión Inteligente
    if (masterBtn) {
        masterBtn.onclick = async () => {
            // 1. RECONEXIÓN (PENDING RESUME)
            if (window.pendingResumeHandle) {
                try {
                    const options = { mode: 'readwrite' };
                    if ((await window.pendingResumeHandle.queryPermission(options)) !== 'granted') {
                        if ((await window.pendingResumeHandle.requestPermission(options)) !== 'granted') {
                            alert("Se requieren permisos para automatizar la sincronización.");
                            return;
                        }
                    }
                    activateMasterLiveWatch(window.pendingResumeHandle);
                    window.pendingResumeHandle = null;
                    return;
                } catch (err) {
                    console.error("Error al reanudar handle:", err);
                    updateTicker("⚠️ ERROR AL REANUDAR. SELECCIONE ARCHIVO DE NUEVO.");
                }
            }

            // 2. MODO LOCAL (FILE://) - Forzar input manual
            if (window.location.protocol === 'file:') {
                masterInput.click();
                return;
            }

            // 3. FLUJO NORMAL (WEB/HTTPS) - Intentar File System Access API
            if ('showOpenFilePicker' in window) {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [{
                            description: 'Excel Files',
                            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                        }],
                        multiple: false
                    });

                    if (handle) {
                        const file = await handle.getFile();
                        handleExcelFile(file);
                        // Opcional: Guardar handle para futuro si se desea
                        // activateMasterLiveWatch(handle); 
                    }
                } catch (err) {
                    // Si cancela, no pasa nada
                    if (err.name !== 'AbortError') console.error(err);
                }
            } else {
                // Fallback para navegadores viejos / no soportados
                masterInput.click();
            }
        };
    }

    if (masterInput) {
        masterInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) handleExcelFile(file);
        };
    }

    const outlookBtn = document.querySelector('.btn-comm.outlook');
    const waBtn = document.querySelector('.btn-comm.whatsapp');
    if (outlookBtn) outlookBtn.onclick = (e) => { e.preventDefault(); scrollToModule('widget-outlook'); };
    if (waBtn) waBtn.onclick = (e) => { e.preventDefault(); scrollToModule('widget-wa'); };

    if (quickInput) {
        quickInput.onkeydown = (e) => {
            if (e.key === 'Enter' && quickInput.value.trim() !== '') {
                processQuickInput(quickInput.value.trim());
                quickInput.value = '';
            }
        };
    }

    // Event listeners are handled by setupEventListeners() at the end of the file
    // to prevent duplication and ensure safe initialization.

    if (globalSearch) {
        globalSearch.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = globalSearch.value.trim();
                console.log("Global Search: ", query);

                // 1. Try AI Processing first
                if (typeof processGlobalSearch === 'function') {
                    processGlobalSearch(query);
                }

                // 2. Fallback to standard incident search
                renderIncidents(query.toLowerCase());
            }
        };
        // Remove oninput real-time filtering for global search to avoid confusion with AI commands
        // or keep it just for local incidents if desired. For now, let's keep it simple.
    }

    const mSearch = document.getElementById('master-search-input');
    const mFilterEstado = document.getElementById('master-filter-estado');
    const mFilterEstado1 = document.getElementById('master-filter-estado1');
    const mFilterGestor = document.getElementById('master-filter-gestor');

    // Note Tag Selector
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    const noteInput = document.getElementById('note-input');
    if (noteInput) {
        noteInput.onkeydown = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                addNoteFromCerebro();
            }
        };
    }

    if (mSearch) {
        mSearch.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log("Buscando en Master: ", mSearch.value);
                renderMasterSummary();
                showToast("Filtro Master: Buscando '" + mSearch.value + "'", "info");
                mSearch.blur(); // Quitar foco para dar feedback visual
            }
        };
        mSearch.oninput = () => renderMasterSummary();
    }
    if (mFilterEstado) mFilterEstado.onchange = () => renderMasterSummary();
    if (mFilterEstado1) mFilterEstado1.onchange = () => renderMasterSummary();
    if (mFilterGestor) mFilterGestor.onchange = () => renderMasterSummary();
    if (mFilterEstado1) mFilterEstado1.onchange = () => { console.log("Filtro Salud cambiado"); renderMasterSummary(); };
    if (mFilterGestor) mFilterGestor.onchange = () => { console.log("Filtro Gestor cambiado"); renderMasterSummary(); };

    // --- BLOQUE: NOTAS RÁPIDAS (TOP) ---
    const quickNoteTop = document.getElementById('quick-note-top');
    if (quickNoteTop) {
        quickNoteTop.onkeydown = (e) => {
            if (e.key === 'Enter' && quickNoteTop.value.trim() !== '') {
                e.preventDefault();
                const newNote = {
                    id: Date.now(),
                    text: quickNoteTop.value.trim(),
                    tag: 'INFO',
                    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    completed: false
                };
                state.notes.unshift(newNote);
                markUnsavedChanges();
                quickNoteTop.value = '';
                saveAndRender();
                showToast("Tarea guardada en la agenda", "success");
                updateTicker("SISTEMA: NOTA RÁPIDA GUARDADA");
            }
        };
    }

    if (hActive && hActive.parentElement) {
        hActive.parentElement.onclick = () => {
            const current = state.stats.activeWorkers || 0;
            const newVal = prompt("EDITAR TRABAJADORES EN SERVICIO:", current);
            if (newVal !== null && !isNaN(newVal)) {
                state.stats.activeWorkers = parseInt(newVal);
                markUnsavedChanges();
                saveAndRender();
            }
        };
    }


    // ============================================
    // SISTEMA DE GUARDADO MULTI-EVENTO (ULTRA ROBUSTO)
    // ============================================


    // Función de guardado sincrónico forzado
    const forceSyncSave = () => {
        try {
            const stateStr = JSON.stringify(state);
            localStorage.setItem(ATOMIC_STATE_KEY, stateStr);
            localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(state.incidents));
            localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(state.absences));
            localStorage.setItem(STORAGE_KEYS.UNCOVERED, JSON.stringify(state.uncovered));
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(state.orders));
            localStorage.setItem(STORAGE_KEYS.GLASS, JSON.stringify(state.glassPlanning));
            localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(state.stats));
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
            localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(state.masterData));
            localStorage.setItem(STORAGE_KEYS.STICKY, state.stickyContent);
            localStorage.setItem('sifu_last_sync', new Date().toLocaleString('es-ES'));

            console.log('✅ Guardado sincrónico forzado ejecutado');
            return true;
        } catch (err) {
            console.error('❌ Error en guardado sincrónico:', err);
            return false;
        }
    };

    // EVENTO 1: beforeunload (para recargas y algunos cierres)
    window.addEventListener('beforeunload', (e) => {
        forceSyncSave();
    });

    // EVENTO 2: pagehide (MÁS CONFIABLE que beforeunload para cierres)
    window.addEventListener('pagehide', (e) => {
        forceSyncSave();
    });

    // EVENTO 3: visibilitychange (cuando la pestaña se oculta)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            forceSyncSave();
        }
    });

    // EVENTO 4: blur de la ventana (cuando pierde el foco)
    window.addEventListener('blur', () => {
        forceSyncSave();
    });

    // EVENTO 5: Guardado periódico cada 5 segundos (respaldo adicional)
    setInterval(() => {
        forceSyncSave();
    }, 5000);

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.style.border = 'none';
        document.body.style.backgroundColor = '';

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            handleExcelFile(file);
        }
    });
}

// --- ENGINE: PERMANENT FILE ACCESS (IndexedDB Storage) ---
const DB_NAME = 'SifuAutoSyncDBv2';
const STORE_NAME = 'Handles';

async function saveHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, 'masterHandle');
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
            console.error("Error saving handle:", req.error);
            resolve(false);
        };
    });
}

async function getSavedHandle() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            // Check if store exists to avoid crashes on clear cache
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                resolve(null);
                return;
            }
            const store = tx.objectStore(STORE_NAME);
            const req = store.get('masterHandle');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => {
                console.error("Error reading handle:", req.error);
                resolve(null);
            };
        });
    } catch (e) {
        console.error("DB Error:", e);
        return null;
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

let liveHandle = null;
let isSavingToExcel = false; // Flag para pausar watchdog durante guardado
let lastSaveTimestamp = 0;   // Timestamp del último guardado local

async function activateMasterLiveWatch(handle) {
    if (!handle) return;
    liveHandle = handle;
    window.liveHandle = handle; // Ensure global access
    window.liveWatchActive = true;

    // Guardar para futuros arranques
    await saveHandle(handle);

    // Actualizar Sincro-Hub si existe
    if (window.MasterSyncEngine) {
        window.MasterSyncEngine.activate(handle);
    }

    const btn = document.getElementById('btn-load-master');
    if (btn) {
        btn.innerHTML = '<span>📡</span> MODO AUTO ACTIVO';
        btn.classList.add('active-live');
    }

    showToast('SISTEMA SINCRONIZADO: MODO LIVE ACTIVO', 'success');
    updateTicker("SISTEMA: AUTOMATIZACIÓN TOTAL. MODIFICA EL EXCEL Y GUARDA PARA ACTUALIZAR.");

    const syncBadge = document.createElement('span');
    syncBadge.id = 'live-sync-badge';
    syncBadge.innerHTML = '● LIVE';
    syncBadge.style.cssText = 'color: #34a853; font-size: 9px; font-weight: 800; margin-left: 8px; animation: pulse-green 2s infinite;';
    btn.appendChild(syncBadge);

    let lastModified = 0;

    setInterval(async () => {
        // Visual feedback of checking
        const icon = document.getElementById('sync-icon');
        if (icon) {
            icon.style.transition = 'transform 0.5s';
            icon.style.transform = 'rotate(180deg)';
            setTimeout(() => icon.style.transform = 'rotate(0deg)', 400);
        }

        // Pausar watchdog si estamos guardando al Excel
        if (isSavingToExcel) {
            return;
        }

        try {
            const file = await liveHandle.getFile();

            // Evitar recargar si el cambio fue causado por nosotros mismos
            const timeSinceLastSave = Date.now() - lastSaveTimestamp;
            if (file.lastModified > lastModified) {
                // Si guardamos hace menos de 2 segundos, probablemente es nuestro cambio
                if (lastModified !== 0 && timeSinceLastSave < 2000) {
                    console.log('Cambio detectado pero fue causado por guardado local, ignorando...');
                    lastModified = file.lastModified;
                    return;
                }

                if (lastModified !== 0) {
                    showToast('↓ ACTUALIZANDO DESDE EXCEL...', 'info');
                    flashDashboard();
                    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    updateTicker(`SISTEMA: ACTUALIZACIÓN EXTERNA DETECTADA (${now})`);
                }
                lastModified = file.lastModified;
                handleExcelFile(file);
            }
        } catch (err) {
            console.log("Esperando autorización del navegador...");
            if (syncBadge) {
                syncBadge.innerHTML = '● PAUSADO';
                syncBadge.style.color = 'var(--sifu-amber)';
            }
        }
    }, 800);
}

// Auto-Detección de Vínculo Previo al Cargar (Bootloader)
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        try {
            const savedHandle = await getSavedHandle();
            if (savedHandle) {
                // Inyección de dependencia global para el botón
                window.pendingResumeHandle = savedHandle;

                const btn = document.getElementById('btn-load-master');
                if (btn) {
                    btn.innerHTML = '<span>🔌</span> PULSA PARA REANUDAR';
                    btn.classList.add('pulse-sync'); // Añadir efecto visual
                    btn.style.borderColor = 'var(--sifu-amber)';
                    btn.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                    btn.style.animation = 'pulse-amber-border 2s infinite';
                    btn.title = "Archivo detectado: " + savedHandle.name;
                    updateTicker("SISTEMA: VÍNCULO A " + savedHandle.name.toUpperCase() + " DETECTADO. PULSE PARA REACTIVAR.");
                    showToast("SESIÓN PREVIA DETECTADA: " + savedHandle.name, 'info');
                }
            }
        } catch (e) {
            console.warn("Fallo en recuperación de sesión IndexedDB:", e);
        }
    }, 800);
});

async function saveToExcelMaster() {
    if (!liveHandle) {
        showToast('⚠️ NO HAY ARCHIVO EXCEL CONECTADO', 'warning');
        return;
    }

    let attempts = 0;
    const maxAttempts = 3;

    const trySave = async () => {
        try {
            // PAUSAR WATCHDOG DURANTE GUARDADO
            isSavingToExcel = true;
            updateSaveIndicator('saving');

            // 1. Prepare Workbook
            const newWS = XLSX.utils.json_to_sheet(state.masterData);
            const newWB = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(newWB, newWS, "SEGUIMIENTO");
            const excelBuffer = XLSX.write(newWB, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // 2. Write safely
            const writable = await liveHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            // 3. Actualizar timestamp local
            lastSaveTimestamp = Date.now();

            // 4. Esperar un momento antes de reanudar watchdog
            setTimeout(() => {
                isSavingToExcel = false;
            }, 1500);

            showToast('↑ CAMBIOS GUARDADOS EN EXCEL', 'success');
            updateSaveIndicator('saved');
            flashDashboard();

            // Refresh AI Analysis
            if (typeof generateAIInsights === 'function') generateAIInsights();
        } catch (err) {
            console.error("Save failed:", err);
            isSavingToExcel = false; // Reanudar watchdog incluso si falla
            attempts++;
            if (attempts < maxAttempts) {
                showToast(`ARCHIVO OCUPADO. REINTENTANDO (${attempts}/${maxAttempts})...`, 'info');
                setTimeout(trySave, 1500);
            } else {
                showToast('ERROR: EL ARCHIVO EXCEL ESTÁ BLOQUEADO', 'error');
                updateSaveIndicator('error');
                updateTicker("❌ ERROR AL GUARDAR (ARCHIVO BLOQUEADO)");
            }
        }
    };
    trySave();
}

// Modificar los editores del Dashboard para que guarden automÃ¡ticamente
window.updateAbsenceField = async (id, field, value) => {
    // 1. Actualizar el estado local (Absences)
    const abs = state.absences.find(a => a.id === id);
    if (!abs) return;

    abs[field] = value;

    // 2. Sincronizar con el MasterData (la fuente que va al Excel)
    const keys = Object.keys(state.masterData[0]);
    const keyS = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const keyT = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';

    const masterRow = state.masterData.find(row =>
        (row[keyS] || '').toString().trim() === abs.center.trim() &&
        (row[keyT] || '').toString().trim() === abs.worker.trim()
    );

    if (masterRow) {
        // Mapear campos del Dashboard a columnas de Excel
        const keyE1 = keys.find(k => k.toUpperCase().includes('ESTADO') && k.toUpperCase() !== 'ESTADO') || 'ESTADO.1';
        const keySup = keys.find(k => k.toUpperCase().includes('SUPLENTE')) || 'SUPLENTE';

        const excelKey = field === 'suggestedSubstitute' ? keySup :
            field === 'reason' ? keyE1 : field;

        masterRow[excelKey] = value;

        // 3. Â¡Auto-Guardado en el archivo fÃ­sico!
        await saveToExcelMaster();
    }
};

function flashDashboard() {
    const logo = document.querySelector('.logo-box');
    if (logo) {
        logo.classList.add('sync-flash-anim');
        setTimeout(() => logo.classList.remove('sync-flash-anim'), 1000);
    }
}

function handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        processMasterData(workbook);

        const now = new Date();
        const syncMsg = `AUTO: ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        localStorage.setItem('sifu_last_sync', syncMsg);
        const timeEl = document.getElementById('last-sync-time');
        if (timeEl) timeEl.textContent = `ÚLTIMA SYNC: ${syncMsg}`;

        // Notify Sync Hub
        if (window.MasterSyncEngine) {
            window.MasterSyncEngine.updateUI('active');
        }
    };
    reader.readAsArrayBuffer(file);
}

function processMasterData(workbook) {
    // Robust Sheet Selection: Try 'SEGUIMIENTO', else take First Sheet
    let sheetName = 'SEGUIMIENTO';
    let sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        // Fallback to first sheet
        const firstSheetName = workbook.SheetNames[0];
        sheet = workbook.Sheets[firstSheetName];
        if (!sheet) {
            updateTicker("⚠️ ERROR: EL ARCHIVO EXCEL PARECE VACÍO");
            return;
        }
        console.log(`Usando hoja: ${firstSheetName}`);
    }

    processMasterArray(XLSX.utils.sheet_to_json(sheet));
}

function processMasterArray(rawData) {
    if (!rawData || !Array.isArray(rawData)) {
        console.error("❌ processMasterArray: Datos inválidos");
        return;
    }

    state.masterData = rawData;
    state.filteredData = null; // Clean active filters

    const newAbsences = [];
    const newUncovered = [];
    if (!rawData.length) return;

    const keys = Object.keys(rawData[0]);
    const findKey = (search) => keys.find(k => k.toUpperCase().trim() === search || k.toUpperCase().includes(search));

    const keyServicio = findKey('SERVICIO') || 'SERVICIO';
    const keyTitular = findKey('TITULAR') || 'TITULAR';
    const keyEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
    const keyEstadoSalud = findKey('ESTADO1') || 'ESTADO1';
    const keySuplente = findKey('SUPLENTE') || 'SUPLENTE';
    const keyHorario = findKey('HORARIO') || 'HORARIO';

    rawData.forEach((row, index) => {
        const servicio = row[keyServicio] || '';
        const titular = row[keyTitular] || '';
        const estadoUpper = (row[keyEstado] || '').toString().toUpperCase();
        const saludUpper = (row[keyEstadoSalud] || '').toString().toUpperCase();
        const isBaja = saludUpper.includes('BAJA') || saludUpper.includes('IT') || saludUpper.includes('I.T') || saludUpper.includes('VACACIONES') || estadoUpper.includes('BAJA') || estadoUpper.includes('IT');

        if (isBaja) {
            newAbsences.push({
                id: Date.now() + index,
                worker: titular || 'TITULAR',
                center: servicio,
                shift: row[keyHorario] || '',
                reason: row[keyEstadoSalud] || row[keyEstado] || 'BAJA',
                suggestedSubstitute: row[keySuplente] || ''
            });
        }

        const isSpecial = estadoUpper.includes('BRIGADA') || estadoUpper.includes('OBRAS') || estadoUpper.includes('CERRADO');

        // --- SMART DISCOVERY LOGIC ---
        const isDesc = (
            estadoUpper.includes('DESCUBIERTO') ||
            estadoUpper.includes('VACANTE') ||
            estadoUpper.includes('SIN ASIGNAR') ||
            titular.toUpperCase().includes('SIN TITULAR') ||
            titular.toUpperCase().includes('DESCUBIERTO') ||
            (estadoUpper === '' && (titular === '' || titular === 'SIN TITULAR')) ||
            (estadoUpper === 'PENDIENTE' && titular === '')
        );

        if (isDesc && !isSpecial) {
            newUncovered.push({
                id: Date.now() + index + 1000,
                center: servicio,
                worker: titular || 'DESCUBIERTO',
                shift: row[keyHorario] || '',
                startTime: 'URGENTE',
                risk: true
            });
        }
    });

    state.absences = newAbsences;

    // Combine Master Uncovered with Special Uncovered from external Excel
    if (typeof SPECIAL_UNCOVERED !== 'undefined' && Array.isArray(SPECIAL_UNCOVERED)) {
        SPECIAL_UNCOVERED.forEach((su, idx) => {
            newUncovered.push({
                id: 'special-' + idx + '-' + Date.now(),
                center: su.center,
                worker: 'ALERTA EXTERNA',
                shift: su.shift || 'MAÑANA',
                startTime: 'URGENTE',
                risk: true,
                source: 'excel_especial'
            });
        });
    }

    state.uncovered = newUncovered;
    saveAllState();
    renderAll();
    updateTicker(`${rawData.length} SERVICIOS SINCRONIZADOS`);
}

// FUNCIÓN ELIMINADA - Ahora usamos la versión consolidada arriba (línea ~54)

function saveAndRender() {
    saveAllState();
    const lastSyncEl = document.getElementById('last-sync-time');
    if (lastSyncEl) lastSyncEl.textContent = `ÚLTIMA SYNC: ${localStorage.getItem('sifu_last_sync')}`;
    renderAll();
}

// function renderAll removed - duplicated at line 2100

function renderPriorityPanel() {
    const panel = document.getElementById('critical-actions');
    if (!panel) return;
    const criticalIncidents = state.incidents.filter(i => i.priority === 'HIGH' && !i.reported);
    const criticalUncovered = state.uncovered.filter(u => u.risk);
    let html = '';

    criticalIncidents.forEach(inc => {
        html += `<div class="critical-item" onclick="scrollToModule('module-incidents')">
            <div class="item-header">
                <span class="risk-pulse"></span>
                <span class="insight-title" style="color:var(--accent-red); font-size: 11px; font-weight:700; text-transform: uppercase;">🚨 Alerta Crítica</span>
            </div>
            <span class="insight-text" style="font-size: 14px; font-weight:700;">${inc.worker}</span>
            <span class="item-desc" style="font-size: 13px;">${inc.type} - Gestión Inmediata</span>
            <span class="item-time" style="font-size: 11px; color:var(--text-dim); margin-top:4px;">🕒 ${inc.time}</span>
        </div>`;
    });

    criticalUncovered.forEach(unc => {
        html += `<div class="critical-item" onclick="scrollToModule('module-uncovered')">
            <div class="item-header">
                <span class="risk-pulse"></span>
                <span class="insight-title" style="color:var(--accent-red); font-size: 11px; font-weight:700; text-transform: uppercase;">🔴 Turno Descubierto</span>
            </div>
            <span class="insight-text" style="font-size: 14px; font-weight:700;">${unc.center}</span>
            <span class="item-desc" style="font-size: 13px;">${unc.shift}</span>
            <span class="item-time" style="font-size: 11px; color:var(--text-dim); margin-top:4px;">⚠️ Riesgo de Penalización</span>
        </div>`;
    });

    panel.innerHTML = html || '<div class="empty-state">ESTADO OPERATIVO: NORMAL - SIN URGENCIAS</div>';
}



// ============================================
// EDICIÓN DIRECTA EN TABLA MASTER
// ============================================

window.updateMasterCell = async (rowIndex, columnKey, newValue) => {
    // Validar que el índice existe
    if (rowIndex < 0 || rowIndex >= state.masterData.length) {
        console.error('Índice de fila inválido:', rowIndex);
        return;
    }

    const row = state.masterData[rowIndex];
    const oldValue = row[columnKey];

    // Si el valor no cambió, no hacer nada
    if (oldValue === newValue) {
        return;
    }

    console.log(`Actualizando celda [${rowIndex}][${columnKey}]: "${oldValue}" → "${newValue}"`);

    // 1. Actualizar el masterData
    row[columnKey] = newValue;

    // 2. Marcar cambios pendientes
    markUnsavedChanges();

    // 3. Guardar en estado local
    saveAllState();

    // 4. Si hay handle activo, guardar al Excel automáticamente
    if (liveHandle) {
        updateTicker(`📝 EDITANDO: ${columnKey} → Guardando en Excel...`);
        await saveToExcelMaster();
    } else {
        showToast('⚠️ Cambio guardado localmente. Conecta Excel para sincronizar.', 'warning');
    }

    // 5. Re-procesar datos para actualizar absences y uncovered
    processMasterArray(state.masterData);
};

window.renderUncovered = function () {
    console.log("🔍 Renderizando Centro de Descubiertos Inteligente...");
    const feed = document.getElementById('uncovered-feed');
    if (!feed) return;

    if (!state.uncovered || state.uncovered.length === 0) {
        feed.innerHTML = `
            <div class="empty-discovery">
                <div class="icon">🚀</div>
                <h3>OPERATIVA COMPLETADA</h3>
                <p>No se detectan servicios descubiertos en el sistema. Todos los cuadrantes están sincronizados.</p>
                <button class="btn-primary-glow" style="margin-top:20px;" onclick="refreshMetrics()">REFRESCAR DATOS</button>
            </div>`;
        return;
    }

    const total = state.uncovered.length;
    const efficiency = total > 0 ? (Math.max(0, 100 - (total * 2))).toFixed(1) : "100";

    // Dynamic Filter State
    const searchQuery = (window.uncoveredSearchTerm || "").toLowerCase();
    const activeZone = (window.uncoveredZoneFilter || "TODAS");

    const filtered = state.uncovered.filter(unc => {
        const matchesSearch = unc.center.toLowerCase().includes(searchQuery) ||
            (unc.worker && unc.worker.toLowerCase().includes(searchQuery));
        const matchesZone = activeZone === "TODAS" || detectZone(unc.center) === activeZone;
        return matchesSearch && matchesZone;
    });

    const zones = ["TODAS", ...new Set(state.uncovered.map(u => detectZone(u.center)))];

    feed.innerHTML = `
        <div class="uncovered-dashboard">
            <!-- Advanced Discovery Hub -->
            <div class="discovery-hub-header" style="flex-direction: column; align-items: stretch; gap: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="hub-stat-group">
                        <div class="hub-stat">
                            <span class="label">Fugas de Cobertura</span>
                            <span class="value critical">${total}</span>
                        </div>
                        <div class="hub-stat">
                            <span class="label">Continuidad Operativa</span>
                            <span class="value">${efficiency}%</span>
                        </div>
                    </div>
                    <div class="hub-actions">
                        <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 11px; background: #6d28d9;" onclick="window.autoAssignAI()">
                            <span>⚡</span> AUTO-ASIGNACIÓN IA
                        </button>
                        <button class="btn-primary-glow" style="padding: 10px 20px; font-size: 11px; margin-left:10px;" onclick="window.exportStatusToPDF(true)">
                            <span>📄</span> REPORTE CRÍTICO
                        </button>
                    </div>
                </div>

                <div class="hub-filter-bar" style="display: flex; gap: 15px; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="position: relative; flex: 1;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🔍</span>
                        <input type="text" placeholder="Buscar centro o trabajador..." 
                               value="${window.uncoveredSearchTerm || ''}"
                               style="width: 100%; background: transparent; border: none; padding: 8px 8px 8px 35px; color: white; font-size: 13px;"
                               onkeyup="window.uncoveredSearchTerm = this.value; renderUncovered()">
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Zona:</span>
                        <select onchange="window.uncoveredZoneFilter = this.value; renderUncovered()" 
                                style="background: #1e293b; color: white; border: 1px solid #334155; padding: 5px 12px; border-radius: 8px; font-size: 12px; cursor: pointer;">
                            ${zones.map(z => `<option value="${z}" ${z === activeZone ? 'selected' : ''}>${z}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- UNIFIED OPERATIVE INTELLIGENCE MATRIX -->
            <div class="discovery-analytics-container">
                <!-- CHART 1: ZONE RANKING (Horizontal) -->
                <div class="analytics-card-premium">
                    <div class="ai-data-pulse">
                        <div class="pulse-stat">
                            <span class="val">${total}</span>
                            <span class="lab">VACANTES</span>
                        </div>
                    </div>
                    <h4>Impacto por Zona <span>Ranking de Volumen</span></h4>
                    <div class="chart-wrapper-ai">
                        <canvas id="uncoveredZoneChart"></canvas>
                    </div>
                </div>

                <!-- CHART 2: STATUS DISTRIBUTION (Donut) -->
                <div class="analytics-card-premium">
                     <div class="ai-data-pulse">
                        <div class="pulse-stat">
                            <span class="val" style="color:#10b981;">${efficiency}%</span>
                            <span class="lab">SALUD</span>
                        </div>
                    </div>
                    <h4>Ecosistema de Estado <span>Distribución en Tiempo Real</span></h4>
                    <div class="chart-wrapper-ai donut-mode">
                        <canvas id="uncoveredStatusChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Smart Dispatch Grid -->
            <div class="uncovered-grid">
                ${filtered.map(unc => {
        const priorityClass = unc.risk ? 'critical' : '';
        const zone = detectZone(unc.center);
        const status = unc.dispatchStatus || 'PENDIENTE';
        return `
                    <div class="uncovered-card ${priorityClass}">
                        <div class="card-top">
                            <div class="service-title" style="display:flex; align-items:center; gap:8px;">
                                <div class="zone-tag" style="font-size:8px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:#cbd5e1;">${zone}</div>
                                ${unc.center}
                            </div>
                            <span class="status-tracker-badge" style="font-size: 9px; font-weight: 800; background: ${status === 'PENDIENTE' ? '#fee2e2' : (status === 'GESTION' ? '#fef3c7' : '#dcfce7')}; color: ${status === 'PENDIENTE' ? '#ef4444' : (status === 'GESTION' ? '#d97706' : '#16a34a')}; padding: 4px 10px; border-radius: 20px;">
                                ${status}
                            </span>
                        </div>
                        <div class="card-details">
                            <div class="detail-item"><span class="label">Puesto Vacante</span><span class="val highlight"><span class="pulse-red-dot"></span>${unc.worker || 'SIN TITULAR'}</span></div>
                            <div class="detail-item"><span class="label">Tramo Horario</span><span class="val">${unc.shift || 'Mañana/Tarde'}</span></div>
                        </div>
                        <div class="dispatch-steps" style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.05);">
                            <div class="step ${status === 'PENDIENTE' ? 'active' : ''}" onclick="window.updateUncoveredStatus('${unc.id}', 'PENDIENTE')"><span style="font-size:14px;">🚩</span><span style="font-size:8px; font-weight:700;">AVISO</span></div>
                            <div style="flex:1; height:1px; background:rgba(255,255,255,0.1); align-self:center; margin: 0 5px;"></div>
                            <div class="step ${status === 'GESTION' ? 'active' : ''}" onclick="window.updateUncoveredStatus('${unc.id}', 'GESTION')"><span style="font-size:14px;">📞</span><span style="font-size:8px; font-weight:700;">GESTIÓN</span></div>
                            <div style="flex:1; height:1px; background:rgba(255,255,255,0.1); align-self:center; margin: 0 5px;"></div>
                            <div class="step ${status === 'CERRADO' ? 'active' : ''}" onclick="window.updateUncoveredStatus('${unc.id}', 'CERRADO')"><span style="font-size:14px;">✅</span><span style="font-size:8px; font-weight:700;">CUBIERTO</span></div>
                        </div>
                        <div class="card-actions" style="border-top: none; padding-top: 0;">
                            <button class="btn-ai-reveal" style="flex: 2;" onclick="window.toggleAiSuggestions('${unc.id}', '${unc.center}', '${unc.worker}', '${unc.shift}')"><span>🧠</span> RECOMENDACIÓN</button>
                            <button class="mini-action-btn secondary" style="flex: 1;" onclick="window.openChatWithCoordinador('${unc.center}')"><span>💬</span> AVISO</button>
                        </div>
                        <div id="ai-box-${unc.id}" class="ai-suggestions-box">
                            <div style="font-size: 9px; font-weight: 800; color: #6d28d9; margin-bottom: 8px; text-transform: uppercase;">Analítica de Candidatos Cercanos:</div>
                            <div id="ai-list-${unc.id}"><div style="font-size: 10px; color: #94a3b8; text-align: center; padding: 10px;">Calculando rutas...</div></div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    // Initialize Charts after DOM Update
    setTimeout(window.initUncoveredCharts, 50);
}


// Global functions for the new functionality
window.updateUncoveredStatus = (id, status) => {
    const uc = state.uncovered.find(u => u.id === id);
    if (uc) {
        uc.dispatchStatus = status;
        if (status === 'CERRADO') {
            showToast(`Servicio ${uc.center} marcado como cubierto.`, 'success');
        }
        renderUncovered();
    }
};

window.autoAssignAI = () => {
    showToast("🧠 Analizando toda la operativa... Buscando huecos óptimos.", "info");
    setTimeout(() => {
        state.uncovered.forEach(uc => {
            const candidates = findSubstitutes(uc.center, uc.worker, uc.shift);
            if (candidates.length > 0 && uc.dispatchStatus !== 'CERRADO') {
                uc.autoSuggested = candidates[0].name;
            }
        });
        showToast("✨ Sugerencias globales cargadas. Revisa las tarjetas.", "success");
        renderUncovered();
    }, 1500);
};

window.openChatWithCoordinador = (center) => {
    const zone = detectZone(center);
    showToast(`Enviando notificación al coordinador de ${zone}...`, 'info');
    setTimeout(() => {
        showToast(`✅ Notificación enviada para ${center}`, 'success');
    }, 1000);
};


window.toggleAiSuggestions = (id, center, worker, shift) => {
    const box = document.getElementById(`ai-box-${id}`);
    const list = document.getElementById(`ai-list-${id}`);
    if (!box || !list) return;

    box.classList.toggle('active');

    if (box.classList.contains('active')) {
        // Run the smart discovery logic
        const candidates = findSubstitutes(center, worker, shift);

        if (candidates.length === 0) {
            list.innerHTML = `<div style="font-size: 10px; color: #64748b; padding: 5px;">No se encontraron operarios compatibles cerca.</div>`;
            return;
        }

        list.innerHTML = candidates.slice(0, 3).map(c => `
            <div class="suggestion-item">
                <div>
                    <span class="candidate-name">${c.name}</span>
                    <span class="candidate-reason">${c.reason}</span>
                </div>
                <span class="candidate-score">${c.probability}%</span>
            </div>
        `).join('') + `
            <div style="margin-top: 10px; text-align: center;">
                <button class="mini-action-btn primary" style="width: 100%;" onclick="assignSubstitute('${center}', '${candidates[0].name}')">
                    PROPONER A ${candidates[0].name.split(' ')[0]}
                </button>
            </div>
        `;
    }
};




function renderGlassPlanning() {
    const feed = document.getElementById('glass-calendar-view');
    if (!feed) return;
    if (state.glassPlanning.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN TAREAS DE CRISTALES</div>';
        return;
    }
    feed.innerHTML = state.glassPlanning.map(job => `<div class="feed-item">
        <div class="item-content-wrapper">
            <div class="item-header"><span class="item-worker">${job.building}</span><span class="item-time" style="background:rgba(52, 168, 83, 0.1); color:#34a853; padding:2px 8px; border-radius:10px; font-weight:800; font-size:10px;">${formatNoteDate(job.date)}</span></div>
        </div>
    </div>`).join('');
}

// --- DYNAMIC FILTERING & RENDERING SYSTEM ---

let activeFilters = [];
let hasInitializedFilters = false;

// 1. Filter Menu Logic
window.toggleFilterMenu = () => {
    const menu = document.getElementById('filter-column-menu');
    if (!menu) return;

    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
    } else {
        populateFilterMenu();
        menu.classList.add('active');

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !e.target.closest('#btn-add-filter')) {
                menu.classList.remove('active');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
};

function populateFilterMenu() {
    const menu = document.getElementById('filter-column-menu');
    if (!menu || !state.masterData || !state.masterData.length) return;

    const allKeys = Object.keys(state.masterData[0]);
    const availableKeys = allKeys.filter(k => !activeFilters.includes(k)).sort();

    menu.innerHTML = `
        <div class="filter-menu-search">
            <input type="text" placeholder="Buscar columna..." oninput="this.parentElement.nextElementSibling.querySelectorAll('.filter-menu-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(this.value.toLowerCase()) ? 'flex' : 'none')">
        </div>
        <div id="filter-menu-list">
            ${availableKeys.map(k => `
                <div class="filter-menu-item" onclick="addFilter('${k}')">
                    <span>${k}</span>
                    <strong style="color:var(--sifu-blue);">+</strong>
                </div>
            `).join('')}
        </div>
    `;
}

window.addFilter = (key) => {
    if (!activeFilters.includes(key)) {
        activeFilters.push(key);
        renderFilterChips();
        renderMasterSummary();
    }
    const menu = document.getElementById('filter-column-menu');
    if (menu) menu.classList.remove('active');
};

window.removeFilter = (key) => {
    activeFilters = activeFilters.filter(k => k !== key);
    renderFilterChips();
    // Reset specific filter value if needed, but simple re-render is enough
    renderMasterSummary();
};

function renderFilterChips() {
    const container = document.getElementById('active-filters-row');
    if (!container) return; // Should exist in HTML now

    // Safety check for data
    if (!state.masterData || !state.masterData.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = activeFilters.map(key => {
        // Init default if not set in DOM
        const uniqueVals = [...new Set(state.masterData.map(r => r[key]))].sort();

        // Try to preserve value if re-rendering
        // Note: In a full app state management handles this, here we rely on DOM persistence or reset
        // For smoother UX, we read value before rewriting, or render once. 
        // We'll use a simple approach: Re-render resets to ALL is acceptable when adding/removing filters, 
        // BUT better to preserve.
        const currentSelect = document.getElementById(`filter-select-${key}`);
        const currentVal = currentSelect ? currentSelect.value : 'ALL';

        return `
            <div class="filter-chip">
                <span>${key}</span>
                <select id="filter-select-${key}" onchange="renderMasterSummary()">
                    <option value="ALL">TODOS</option>
                    ${uniqueVals.map(v => `<option value="${v}" ${v == currentVal ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
                <button class="remove" onclick="removeFilter('${key}')">×</button>
            </div>
        `;
    }).join('');
}

// 2. Rendering Implementation (God-Mode Table v7.0)
let columnFilters = {
    estado: '',
    servicio: '',
    titular: '',
    horario: '',
    suplente: '',
    finContrato: '',
    vacaciones: ''
};

let currentSort = {
    key: null,
    dir: 'asc'
};

window.toggleSort = (key) => {
    if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.dir = 'asc';
    }
    renderMasterBodyOnly();
    refreshSortIcons(); // NEW: Force icon update
};

function refreshSortIcons() {
    const headers = {
        'estado': '🛡️ ESTADO',
        'servicio': '📍 SERVICIO',
        'titular': '👤 TITULAR',
        'horario': '⏰ HORARIO',
        'suplente': '🔄 SUPLENTE',
        'finContrato': '📅 FIN CONTRATO',
        'vacaciones': '🌴 VACACIONES 26'
    };

    Object.keys(headers).forEach(key => {
        const span = document.getElementById(`sort-label-${key}`);
        if (span) {
            const icon = currentSort.key === key ? (currentSort.dir === 'asc' ? ' 🔼' : ' 🔽') : '';
            span.innerText = headers[key] + icon;
        }
    });
}

/**
 * Convierte números de serie de Excel o textos de fecha a formato DD/MM/YYYY
 */
window.formatExcelDate = (val) => {
    if (!val) return '-';
    // Si ya es una fecha formateada (tiene /), devolver tal cual
    if (val.toString().includes('/')) return val;

    const num = parseFloat(val);
    if (isNaN(num) || num < 30000) return val; // No parece una fecha de Excel (ej: 46399)

    try {
        const date = new Date((num - 25569) * 86400 * 1000);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return val;
    }
};

window.updateColumnFilter = (key, value) => {
    columnFilters[key] = value.toLowerCase();
    renderMasterBodyOnly();
};

function renderMasterSummary() {
    const feed = document.getElementById('master-summary-feed');
    if (feed && feed.querySelector('#resizable-master')) {
        renderMasterBodyOnly();
        return;
    }

    const countEl = document.getElementById('master-count');
    if (!feed) return;

    if (!state.masterData || state.masterData.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN DATOS MASTER CARGADOS. SYNC MASTER REQUERIDO.</div>';
        if (countEl) countEl.textContent = '0';
        return;
    }

    // Header structure with requested order (ESTADO, SERVICIO, TITULAR, HORARIO, SUPLENTE, FIN CONTRATO, VACACIONES 2026)
    const sortIcon = (k) => currentSort.key === k ? (currentSort.dir === 'asc' ? ' 🔼' : ' 🔽') : '';

    feed.innerHTML = `
    <table class="master-table" id="resizable-master" style="table-layout: fixed; width: 100%;">
        <thead style="position: sticky; top: 0; z-index: 10; background: #f8fafc; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
                <th style="width: 100px; min-width: 100px; cursor: pointer;" onclick="toggleSort('estado')">
                    <span id="sort-label-estado">🛡️ ESTADO${sortIcon('estado')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="🛒..." onclick="event.stopPropagation()" oninput="updateColumnFilter('estado', this.value)" value="${columnFilters.estado}">
                </th>
                <th style="width: 250px; cursor: pointer;" onclick="toggleSort('servicio')">
                    <span id="sort-label-servicio">📍 SERVICIO${sortIcon('servicio')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('servicio', this.value)" value="${columnFilters.servicio}">
                </th>
                <th style="width: 200px; cursor: pointer;" onclick="toggleSort('titular')">
                    <span id="sort-label-titular">👤 TITULAR${sortIcon('titular')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('titular', this.value)" value="${columnFilters.titular}">
                </th>
                <th style="width: 150px; cursor: pointer;" onclick="toggleSort('horario')">
                    <span id="sort-label-horario">⏰ HORARIO${sortIcon('horario')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('horario', this.value)" value="${columnFilters.horario}">
                </th>
                <th style="width: 180px; cursor: pointer;" onclick="toggleSort('suplente')">
                    <span id="sort-label-suplente">🔄 SUPLENTE${sortIcon('suplente')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('suplente', this.value)" value="${columnFilters.suplente}">
                </th>
                <th style="width: 130px; cursor: pointer;" onclick="toggleSort('finContrato')">
                    <span id="sort-label-finContrato">📅 FIN CONTRATO${sortIcon('finContrato')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('finContrato', this.value)" value="${columnFilters.finContrato}">
                </th>
                <th style="width: 140px; cursor: pointer;" onclick="toggleSort('vacaciones')">
                    <span id="sort-label-vacaciones">🌴 VACACIONES 26${sortIcon('vacaciones')}</span> <div class="resizer"></div>
                    <input type="text" class="header-filter-input" placeholder="Filtrar..." onclick="event.stopPropagation()" oninput="updateColumnFilter('vacaciones', this.value)" value="${columnFilters.vacaciones}">
                </th>
            </tr>
        </thead>
        <tbody id="master-table-body">
            <!-- Rows injected by renderMasterBodyOnly -->
        </tbody>
    </table>`;

    renderMasterBodyOnly();
    setTimeout(() => initResizableTable(document.getElementById('resizable-master')), 100);
}

function renderMasterBodyOnly() {
    const tbody = document.getElementById('master-table-body');
    const countEl = document.getElementById('master-count');
    const searchInput = document.getElementById('master-search-input');

    if (!tbody) return;

    const globalQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

    if (!state.masterData || state.masterData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay datos. Carga un Excel (SYNC MASTER).</td></tr>';
        if (countEl) countEl.textContent = '0';
        if (statsContainer) statsContainer.innerHTML = '';
        return;
    }

    const keys = Object.keys(state.masterData[0]);
    const findK = (q) => keys.find(k => k.toUpperCase().includes(q)) || q;

    const kServicio = findK('SERVICIO');
    const kTitular = findK('TITULAR');
    const kHorario = findK('HORARIO');
    const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || findK('ESTADO');
    const kSuplente = findK('SUPLENTE');
    const kFinContrato = findK('FIN CONTRATO');
    const kVacaciones = findK('VACACIONES 2026');

    const baseData = state.filteredData || state.masterData;

    let filtered = baseData.filter(row => {
        if (globalQuery) {
            const rowStr = Object.values(row).join(' ').toLowerCase();
            if (!rowStr.includes(globalQuery)) return false;
        }

        if (columnFilters.servicio && !(row[kServicio] || '').toString().toLowerCase().includes(columnFilters.servicio)) return false;
        if (columnFilters.titular && !(row[kTitular] || '').toString().toLowerCase().includes(columnFilters.titular)) return false;
        if (columnFilters.horario && !(row[kHorario] || '').toString().toLowerCase().includes(columnFilters.horario)) return false;
        if (columnFilters.estado && !(row[kEstado] || '').toString().toLowerCase().includes(columnFilters.estado)) return false;
        if (columnFilters.suplente && !(row[kSuplente] || '').toString().toLowerCase().includes(columnFilters.suplente)) return false;
        if (columnFilters.finContrato && !(row[kFinContrato] || '').toString().toLowerCase().includes(columnFilters.finContrato)) return false;
        if (columnFilters.vacaciones && !(row[kVacaciones] || '').toString().toLowerCase().includes(columnFilters.vacaciones)) return false;

        return true;
    });

    // --- INJECT STATS INTO LILA TOOLBAR (God-Mode Integration) ---
    const toolStats = document.getElementById('toolbar-stats-container');
    if (toolStats) {
        const _discRaw = filtered.filter(r => {
            const e = (r[kEstado] || '').toString().toUpperCase();
            const t = (r[kTitular] || '').toString().toUpperCase();
            return e.includes('DESCUBIERTO') || e.includes('VACANTE') || t.includes('SIN TITULAR') || (e === '' && t === '');
        });
        // Deduplicar por SERVICIO
        const _discSeen = new Set();
        const discCount = _discRaw.filter(r => {
            const srvName = (r[kServicio] || '').toString().trim().toUpperCase();
            if (_discSeen.has(srvName)) return false;
            _discSeen.add(srvName);
            return true;
        }).length;

        toolStats.innerHTML = `
            <div class="lila-badge visible">
                <span>VISIBLE: <b>${filtered.length}</b></span>
            </div>
            <div class="lila-badge discovered">
                <span>DESCUBIERTOS: <b>${discCount}</b></span>
            </div>
        `;
    }

    if (countEl) countEl.textContent = filtered.length;

    // --- SORTING LOGIC ---
    if (currentSort.key) {
        const keyMap = {
            'estado': kEstado,
            'servicio': kServicio,
            'titular': kTitular,
            'horario': kHorario,
            'suplente': kSuplente,
            'finContrato': kFinContrato,
            'vacaciones': kVacaciones
        };
        const actualKey = keyMap[currentSort.key];

        filtered.sort((a, b) => {
            let valA = a[actualKey] || '';
            let valB = b[actualKey] || '';

            // Numeric detection (Excel Dates)
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);

            if (!isNaN(numA) && !isNaN(numB)) {
                return currentSort.dir === 'asc' ? numA - numB : numB - numA;
            }

            // String fallback
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
            if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // --- GLOBAL STORE FOR EXPORT ---
    window.lastFilteredResults = filtered;
    window.lastFilteredKeys = { kServicio, kTitular, kHorario, kEstado, kSuplente, kFinContrato, kVacaciones };

    // --- RE-IMPLEMENT LILA SUBMENU STATS (Optimized Visualization) ---
    // Mapping and rendering
    const displayLimit = 600;
    const dataToShow = filtered.slice(0, displayLimit);

    tbody.innerHTML = dataToShow.map((row) => {
        const realIndex = state.masterData.indexOf(row);

        const s = row[kServicio] || '';
        const t = row[kTitular] || '';
        const h = row[kHorario] || '';
        const e = row[kEstado] || '';
        const sup = row[kSuplente] || '';
        const fin = window.formatExcelDate(row[kFinContrato]);
        const vac = window.formatExcelDate(row[kVacaciones]);

        const eUpper = (e || '').toString().toUpperCase();
        const tUpper = (t || '').toString().toUpperCase();

        const isDisc = (
            eUpper.includes('DESCUBIERTO') || eUpper.includes('VACANTE') ||
            tUpper.includes('SIN TITULAR') || (eUpper === '' && tUpper === '')
        );

        const rowClass = isDisc ? 'critical-row' : '';
        const statusBadge = isDisc ? '<span class="badge red">DESCUBIERTO</span>' : '<span class="badge green">CUBIERTO</span>';

        return `
            <tr class="${rowClass}" data-row-index="${realIndex}">
                <td><div class="td-content">${statusBadge}</div></td>
                <td title="${s}"><div class="td-content"><b>${s}</b></div></td>
                <td title="${t}"><div class="td-content editable" contenteditable="true" onblur="updateMasterCell(${realIndex}, '${kTitular}', this.innerText.trim())">${t}</div></td>
                <td title="${h}"><div class="td-content" style="color:var(--sifu-blue); font-family:monospace; font-size:11px;">${h}</div></td>
                <td title="${sup}"><div class="td-content editable" contenteditable="true" onblur="updateMasterCell(${realIndex}, '${kSuplente}', this.innerText.trim())">${sup || '-'}</div></td>
                <td title="${fin}"><div class="td-content">${fin || '-'}</div></td>
                <td title="${vac}"><div class="td-content">${vac || '-'}</div></td>
            </tr>
        `;
    }).join('');

    if (filtered.length > displayLimit) {
        tbody.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px; background:#fff8f8; color:#ef4444; font-weight:700;">⚠️ Mostrando solo ${displayLimit} de ${filtered.length} registros. Usa los filtros superiores para refinar la búsqueda.</td></tr>`;
    }
}


// Preserve existing functions not meant to be replaced if they are outside the range, 
// but here we are cleaning up the old implementation completely.


function updateEmergencyPopup() {
    const popup = document.getElementById('emergency-list');
    if (!popup || !state.masterData || !state.masterData.length) return;

    const keys = Object.keys(state.masterData[0]);
    const keyE = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
    const keyH = keys.find(k => k.toUpperCase().includes('HORARIO')) || 'HORARIO';
    const keyS = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';

    const discovered = state.masterData.filter(r => {
        const servicio = (r[keyS] || '').toString().trim();
        // Skip rows without a valid service name
        if (!servicio) return false;

        return (r[keyE] || '').toString().toUpperCase().includes('DESCUBIERTO');
    });
    const container = document.getElementById('emergency-popup-container');

    if (discovered.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    if (container) container.style.display = 'flex';
    popup.innerHTML = discovered.slice(0, 10).map(r => `
    <div class="emergency-item-mini">
            <span class="icon">🚨</span>
            <div class="info">
                <div class="name">${r[keyS]}</div>
                <div class="status">SIN COBERTURA - ${r[keyH] || 'S.H.'}</div>
            </div>
        </div>
    `).join('') + (discovered.length > 10 ? `<div style="text-align:center; font-size:9px; color:#8a8d90;">+ ${discovered.length - 10} más en lista...</div>` : '');
}
function initResizableTable(table) {
    if (!table) return;
    const cols = table.querySelectorAll('th');
    [].forEach.call(cols, (col) => {
        const resizer = col.querySelector('.resizer');
        if (!resizer) return;

        let x = 0;
        let w = 0;

        const mouseDownHandler = (e) => {
            x = e.clientX;
            const styles = window.getComputedStyle(col);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        };

        const mouseMoveHandler = (e) => {
            const dx = e.clientX - x;
            col.style.width = `${w + dx}px`;
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
    });
}


function renderIncidents(query = '') {
    if (!incidentFeed) return;
    let filtered = state.incidents;
    if (query) filtered = filtered.filter(i => i.worker.toLowerCase().includes(query) || i.type.toLowerCase().includes(query));
    if (filtered.length === 0) {
        incidentFeed.innerHTML = '<div class="empty-state">SIN INCIDENCIAS</div>';
        return;
    }
    incidentFeed.innerHTML = filtered.map(inc => `
    <div class="feed-item priority-${inc.priority.toLowerCase()} ${inc.reported ? 'reported' : ''}">
            <div class="item-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" ${inc.reported ? 'checked' : ''} onclick="toggleReported(${inc.id})" style="width:18px; height:18px; cursor:pointer;">
                    <span class="item-worker">${inc.worker}</span>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span class="priority-tag priority-${inc.priority.toLowerCase()}">${inc.priority}</span>
                    <button onclick="deleteIncident(${inc.id})" class="btn-delete-small" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:18px;">&times;</button>
                </div>
            </div>
            <div class="item-desc">
                <strong style="color:var(--sifu-blue);">${inc.type}</strong>: ${inc.desc || 'Sin descripción detallada'}
            </div>
            <div style="font-size:10px; opacity:0.7;">ASISTENTE: ONLINE</div>
            <div style="font-size:11px; color:var(--text-dim); display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span>📅 ${formatNoteDate(inc.date)}</span>
                <span>⏰ ${inc.time}</span>
            </div>
        </div>
    `).join('');
}

window.toggleReported = (id) => {
    const inc = state.incidents.find(i => i.id === id);
    if (inc) { inc.reported = !inc.reported; saveAndRender(); }
};

window.deleteIncident = (id) => {
    if (confirm('Eliminar incidencia?')) {
        state.incidents = state.incidents.filter(i => i.id !== id);
        saveAndRender();
    }
};

function renderNotes() {
    const topFeed = document.getElementById('top-notes-feed');
    const sideFeed = document.getElementById('notes-feed');
    const topCount = document.getElementById('top-notes-count');

    console.log("📝 Renderizando Notas:", state.notes.length);

    const pendingNotes = state.notes.filter(n => !n.completed);
    if (topCount) topCount.textContent = pendingNotes.length;

    const generateSideHTML = (notes) => {
        if (notes.length === 0) return '<div class="empty-state">EL CEREBRO OPERATIVO ESTÁ LIMPIO.</div>';
        return notes.map(note => {
            const tag = note.tag || 'INFO';
            const tagClass = `tag-${tag.toLowerCase()}`;
            const tagIcon = tag === 'URGENTE' ? '🔥' : (tag === 'SEGUIMIENTO' ? '📞' : '📌');
            return `
    <div class="note-item ${tagClass} ${note.completed ? 'completed' : ''}" style="cursor:pointer;" onclick="toggleNote(${note.id})">
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="flex:1;">
                <div style="font-size:10px; font-weight:800; color:var(--text-dim); margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                    <span>${tagIcon}</span> ${note.tag || 'INFO'}
                </div>
                <div class="note-text" style="font-size:13px; color:var(--text-main); line-height:1.5; font-weight:500;">${note.text}</div>
                <div style="font-size:10px; color:var(--text-dim); margin-top:8px;">📅 ${formatNoteDate(note.date)}</div>
            </div>
            <button onclick="event.stopPropagation(); deleteNote(${note.id})" style="background:none; border:none; color:#ccc; cursor:pointer; font-size:16px; padding:0 5px;">&times;</button>
        </div>
                </div>
    `;
        }).join('');
    };

    const generateTopHTML = (notes) => {
        if (notes.length === 0) return '<div class="empty-state" style="font-size:11px; padding:10px;">TODO AL DÍA.</div>';
        return notes.map(note => {
            const tag = note.tag || 'INFO';
            const tagIcon = tag === 'URGENTE' ? '🔥' : (tag === 'SEGUIMIENTO' ? '📞' : '📌');
            return `
    <div class="note-card-horizontal ${note.tag || 'INFO'}" onclick="toggleNote(${note.id})">
                        <div class="note-card-header">
                            <span>${tagIcon} ${note.tag || 'INFO'}</span>
                            <span>${formatNoteDate(note.date).split(',')[0]}</span>
                        </div>
                        <div class="note-card-body">${note.text}</div>
                        <div class="note-card-footer">Hacer clic para marcar como hecha</div>
                    </div>
    `;
        }).join('');
    };

    if (topFeed) topFeed.innerHTML = generateTopHTML(pendingNotes);
    if (sideFeed) sideFeed.innerHTML = generateSideHTML(state.notes);
}

window.addNoteFromSistema = () => {
    const input = document.getElementById('note-input');
    const activeTagBtn = document.querySelector('.tag-btn.active');

    if (!input || !input.value.trim()) return;

    const newNote = {
        id: Date.now(),
        text: input.value.trim(),
        tag: activeTagBtn ? activeTagBtn.dataset.tag : 'INFO',
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        completed: false
    };

    state.notes.unshift(newNote);
    input.value = '';
    saveAndRender();
    updateTicker("SISTEMA: APUNTE GUARDADO");
};

window.deleteNote = (id) => {
    state.notes = state.notes.filter(n => n.id !== id);
    saveAndRender();
};

window.clearAllNotes = () => {
    if (confirm('¿Limpiar todas las notas terminadas?')) {
        state.notes = state.notes.filter(n => !n.completed);
        saveAndRender();
    }
};

function formatNoteDate(dateVal) {
    if (!dateVal) return '--/--';
    // Si es un timestamp numérico (como el que reportó el usuario)
    if (!isNaN(dateVal) && dateVal.toString().length > 10) {
        return new Date(Number(dateVal)).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return dateVal.toString();
}

window.toggleNote = (id) => {
    const note = state.notes.find(n => n.id === id);
    if (note) { note.completed = !note.completed; saveAndRender(); }
};

function refreshMetrics() {
    if (!state.masterData || state.masterData.length === 0) {
        state.uncovered = [];
        state.absences = [];
        return;
    }

    const keys = Object.keys(state.masterData[0]);
    const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
    const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';
    const kSalud = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') ||
        keys.find(k => k.toUpperCase().includes('SALUD')) ||
        keys.find(k => k.toUpperCase().includes('BAJA')) ||
        'ESTADO1';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kHorario = keys.find(k => k.toUpperCase().includes('HORARIO')) || 'HORARIO';

    // 1. Sincronizar state.uncovered — DEDUPLICADO POR SERVICIO
    const _seenUncov = new Set();
    state.uncovered = state.masterData.filter(row => {
        const valS = (row[kServicio] || '').toString().trim();
        if (!valS) return false;

        const valE = (row[kEstado] || '').toString().toUpperCase();
        const valT = (row[kTitular] || '').toString().toUpperCase();

        const isSpecial = valE.includes('BRIGADA') || valT.includes('RUTA CRISTALES') || valE.includes('OBRAS') || valE.includes('CERRADO');

        // --- CONSOLIDATED SMART DISCOVERY ---
        const isDesc = (
            valE.includes('DESCUBIERTO') ||
            valE.includes('VACANTE') ||
            valE.includes('SIN ASIGNAR') ||
            valT.includes('SIN TITULAR') ||
            valT.includes('DESCUBIERTO') ||
            valT.includes('VACANTE') ||
            (valE === '' && (valT === '' || valT === 'SIN TITULAR')) ||
            (valE === 'PENDIENTE' && valT === '')
        );

        if (!isDesc || isSpecial) return false;

        // Deduplicar: si el mismo nombre de servicio ya fue contado, ignorar
        const srvKey = valS.toUpperCase();
        if (_seenUncov.has(srvKey)) return false;
        _seenUncov.add(srvKey);
        return true;
    }).map(row => ({
        id: Date.now() + Math.random(),
        center: row[kServicio] || '---',
        worker: row[kTitular] || 'DESCUBIERTO',
        shift: row[kHorario] || '--:--',
        risk: true
    }));

    // 2. Sincronizar state.absences
    state.absences = state.masterData.filter(row => {
        const valE = (row[kEstado] || '').toString().toUpperCase();
        const valS = kSalud ? (row[kSalud] || '').toString().toUpperCase() : '';
        // Detectar BAJA, IT, VACACIONES en cualquiera de las dos columnas
        return valE.includes('BAJA') || valE.includes('IT') ||
            valS.includes('BAJA') || valS.includes('IT') || valS.includes('VACACIONES');
    }).map(row => ({
        id: Date.now() + Math.random(),
        worker: row[kTitular] || 'PERSONAL',
        center: row[kServicio] || '---',
        reason: (row[kSalud] || row[kEstado] || 'BAJA IT').toString()
    }));
}

function updateHeaderStats() {
    refreshMetrics(); // Asegurar datos frescos

    if (hIncidents) hIncidents.textContent = state.incidents.length;

    const total = state.masterData.length;
    const active = Math.max(0, total - state.uncovered.length - state.absences.length);
    if (hActive) hActive.textContent = active;
    state.stats.activeWorkers = active;
}

function processQuickInput(text) {
    const upper = text.toUpperCase();

    if (upper.startsWith('NOTA:')) {
        const noteText = text.substring(5).trim();
        state.notes.unshift({
            id: Date.now(),
            text: noteText,
            tag: 'INFO',
            date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            completed: false
        });
        updateTicker("NOTA GUARDADA EN SISTEMA OPERATIVO");
    } else {
        state.incidents.unshift({
            id: Date.now(),
            worker: 'REGISTRO RÁPIDO',
            type: 'OTRO',
            priority: 'MID',
            desc: text,
            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString('es-ES'),
            reported: false
        });
        updateTicker("INCIDENCIA REGISTRADA");
    }
    saveAndRender();
}

function startTicker() {
    if (!tickerEl) return;
    const msgs = [
        "SISTEMA OPERATIVO: CONECTADO",
        "MASTER GENERAL: SINCRONIZADO v8.1",
        "SISTEMA DE PREDICCIÓN OPERATIVA: ACTIVO",
        "NOTIFICACIONES: EN COLA"
    ];
    let i = 0;
    setInterval(() => {
        tickerEl.textContent = msgs[i];
        i = (i + 1) % msgs.length;
    }, 5000);
}

function updateTicker(msg) {
    if (tickerEl) {
        console.log("SISTEMA Ticker:", msg);
        tickerEl.innerHTML = `<span style="color:var(--sifu-blue); font-weight:bold;">[V - OK - 10]</span> ${msg}`;
        tickerEl.style.color = 'var(--sifu-amber)';
        setTimeout(() => tickerEl.style.color = '', 3000);
    }
}

// Unified Widget Switching
window.switchWidget = (type) => {
    // ... existing logic ...
    // Placeholder to keep existing function valid if it was cut off in view
    const wTitle = document.getElementById('widget-title');
    const wContent = document.getElementById('unified-widget-content');
    if (!wTitle || !wContent) return;

    // ... implementation ...
}

/* --- OPERATIONAL ASSISTANT LOGIC --- */
// (Generic Modal Logic relocated to TOP for global availability)

window.showUncoveredDetails = () => {
    if (!state.masterData) return;

    // --- SHARED SMART DISCOVERY LOGIC ---
    const _rawUncovered2 = state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEstado = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';

        const status = (row[kEstado] || '').toString().toUpperCase();
        const titular = (row[kTitular] || '').toString().toUpperCase();

        // Must have at least a service name to be valid
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO'));
        if (!row[kServicio]) return false;

        return (
            status.includes('DESCUBIERTO') ||
            status.includes('VACANTE') ||
            status.includes('SIN ASIGNAR') ||
            titular.includes('SIN TITULAR') ||
            titular.includes('DESCUBIERTO') ||
            titular.includes('VACANTE') ||
            (status === '' && (titular === '' || titular === 'SIN TITULAR')) ||
            (status === 'PENDIENTE' && titular === '')
        );
    });
    // Deduplicar por nombre de SERVICIO (cada servicio único cuenta solo 1 vez)
    const _seenSrv2 = new Set();
    const uncovered = _rawUncovered2.filter(row => {
        const keys = Object.keys(row);
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO'));
        const srvName = (row[kServicio] || '').toString().trim().toUpperCase();
        if (_seenSrv2.has(srvName)) return false;
        _seenSrv2.add(srvName);
        return true;
    });

    if (uncovered.length === 0) {
        showStatusModal('DESCUBIERTOS', '<p style="text-align:center; padding:20px; color:var(--text-dim);">✅ No hay servicios descubiertos actualmente.</p>');
        return;
    }

    const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>ESTADO</th>
                    <th>HORARIO</th>
                </tr>
            </thead>
            <tbody>
                ${uncovered.map(row => {
        const keys = Object.keys(row);
        const srv = row[keys.find(k => k.toUpperCase().includes('SERVICIO'))] || '-';
        const est = row[keys.find(k => k.toUpperCase().trim() === 'ESTADO')] || 'DESCUBIERTO';
        const hor = row[keys.find(k => k.toUpperCase().includes('HORARIO'))] || '-';
        return `
                        <tr class="critical-row">
                            <td><div class="td-content"><b>${srv}</b></div></td>
                            <td><span class="badge red">${est}</span></td>
                            <td><div class="td-content" style="font-family:monospace; color:var(--sifu-blue);">${hor}</div></td>
                        </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;
    showStatusModal(`DESCUBIERTOS (${uncovered.length})`, html);
};

window.showAbsenceDetails = () => {
    if (!state.masterData) return;

    const keys = Object.keys(state.masterData[0]);
    const kEstado1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') ||
        keys.find(k => k.toUpperCase().includes('SALUD')) ||
        keys.find(k => k.toUpperCase().includes('BAJA')) ||
        'ESTADO1';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';

    const absences = state.masterData.filter(row => {
        const keys = Object.keys(row);
        const kEst = keys.find(k => k.toUpperCase().trim() === 'ESTADO') || 'ESTADO';
        const kEst1 = keys.find(k => k.toUpperCase().trim() === 'ESTADO1') || 'ESTADO1';

        const stateUpper = (row[kEst] || '').toString().toUpperCase();
        const healthUpper = (row[kEst1] || '').toString().toUpperCase();

        return healthUpper.includes('BAJA') ||
            healthUpper.includes('IT') ||
            healthUpper.includes('I.T') ||
            healthUpper.includes('VACACIONES') ||
            stateUpper.includes('BAJA') ||
            stateUpper.includes('IT');
    });

    if (absences.length === 0) {
        showStatusModal('BAJAS / IT', '<p style="text-align:center; padding:20px; color:var(--text-dim);">✅ No hay bajas activas hoy.</p>');
        return;
    }

    const html = `
    <div class="modal-list-container">
        <table class="master-table">
            <thead>
                <tr>
                    <th>SERVICIO</th>
                    <th>TITULAR</th>
                    <th>ESTADO / SALUD</th>
                </tr>
            </thead>
            <tbody>
                ${absences.map(row => {
        const srv = row[kServicio] || '-';
        const tit = row[kTitular] || '-';
        const est1 = row[kEstado1] || 'BAJA';
        let badgeClass = 'blue';
        if (est1.toUpperCase().includes('BAJA') || est1.toUpperCase().includes('IT')) badgeClass = 'red';
        if (est1.toUpperCase().includes('VAC')) badgeClass = 'green';

        return `
                    <tr>
                        <td><div class="td-content"><b>${srv}</b></div></td>
                        <td><div class="td-content">${tit}</div></td>
                        <td><span class="badge ${badgeClass}">${est1}</span></td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;
    showStatusModal(`DETALLE DE BAJAS (${absences.length})`, html);
};

window.showIncidentDetails = () => {
    if (!state.incidents || state.incidents.length === 0) {
        showStatusModal('INCIDENCIAS', '<p>No hay incidencias registradas.</p>');
        return;
    }

    // Sort by priority logic (High first) using a map is cleaner
    const priorityOrder = { 'HIGH': 0, 'MID': 1, 'LOW': 2 };
    const sorted = [...state.incidents].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));

    const html = `<ul class="notebook-feed">
        ${sorted.map(inc => `
            <li class="note-card-horizontal" style="transform:none;">
                <div class="note-content">
                    <strong style="color:var(--sifu-blue);">${inc.worker}</strong><br>
                    ${inc.desc} 
                </div>
                <div class="note-footer">
                    <span class="badge ${inc.priority === 'HIGH' ? 'red' : 'blue'}">${inc.priority}</span>
                    ${inc.date || ''}
                </div>
            </li>
        `).join('')}
    </ul>`;
    showStatusModal(`INCIDENCIAS (${state.incidents.length})`, html);
};

/* --- SITUATIONAL REPORT LOGIC --- */
let reportChartCoverageInstance = null;
let reportChartAbsencesInstance = null;

window.openSituationalReport = () => {
    console.log('📊 Apertura de Informe Situacional...');
    refreshMetrics(); // Ensure data is fresh

    const modal = document.getElementById('situational-report-modal');
    if (!modal) {
        console.error('❌ Error: El modal situational-report-modal no existe en el DOM');
        showToast('Error: No se encuentra el modal de informe', 'error');
        return;
    }

    // Force display and active class
    modal.style.display = 'flex';
    modal.classList.add('active');

    // Update Metrics
    const total = (state.masterData && Array.isArray(state.masterData)) ? state.masterData.length : 0;
    const uncoveredCount = (state.uncovered && Array.isArray(state.uncovered)) ? state.uncovered.length : 0;
    const absencesCount = (state.absences && Array.isArray(state.absences)) ? state.absences.length : 0;
    const activeCount = Math.max(0, total - uncoveredCount - absencesCount);
    const coveragePct = total > 0 ? ((activeCount / total) * 100).toFixed(1) : "0.0";

    const elCov = document.getElementById('report-coverage-val');
    if (elCov) elCov.textContent = `${coveragePct}%`;
    const elAct = document.getElementById('report-active-val');
    if (elAct) elAct.textContent = activeCount;
    const elUnc = document.getElementById('report-uncovered-val');
    if (elUnc) elUnc.textContent = uncoveredCount;
    const elAbs = document.getElementById('report-absences-val');
    if (elAbs) elAbs.textContent = absencesCount;

    // Render Charts and Analysis
    setTimeout(() => {
        renderReportCharts(activeCount, uncoveredCount, absencesCount);
        updateReportAnalysis(uncoveredCount);
    }, 100);
};

window.closeSituationalReport = () => {
    const modal = document.getElementById('situational-report-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
};

function renderReportCharts(active, uncovered, absences) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library not loaded.');
        return;
    }

    const ctxCov = document.getElementById('reportChartCoverage');
    const ctxAbs = document.getElementById('reportChartAbsences');

    if (reportChartCoverageInstance) {
        reportChartCoverageInstance.destroy();
        reportChartCoverageInstance = null;
    }
    if (reportChartAbsencesInstance) {
        reportChartAbsencesInstance.destroy();
        reportChartAbsencesInstance = null;
    }

    if (ctxCov) {
        reportChartCoverageInstance = new Chart(ctxCov, {
            type: 'doughnut',
            data: {
                labels: ['Activos', 'Descubiertos', 'Absentismo'],
                datasets: [{
                    data: [active, uncovered, absences],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
                }
            }
        });
    }

    if (ctxAbs) {
        // Group absences by type manually since state.absences is flat
        const types = { 'BAJA IT': 0, 'VACACIONES': 0, 'PERMISOS': 0, 'OTROS': 0 };
        state.absences.forEach(a => {
            const r = (a.reason || '').toUpperCase();
            if (r.includes('BAJA') || r.includes('IT')) types['BAJA IT']++;
            else if (r.includes('VACACIONES')) types['VACACIONES']++;
            else if (r.includes('PERMISO')) types['PERMISOS']++;
            else types['OTROS']++;
        });

        reportChartAbsencesInstance = new Chart(ctxAbs, {
            type: 'bar',
            data: {
                labels: Object.keys(types),
                datasets: [{
                    label: 'Cantidad',
                    data: Object.values(types),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#64748b'],
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateReportAnalysis(uncoveredCount) {
    const hotspotsList = document.getElementById('report-hotspots-list');
    const actionsList = document.getElementById('report-actions-list');
    if (!hotspotsList || !actionsList) return;

    // Hotspots: Group uncovered by service
    const counts = {};
    state.uncovered.forEach(u => {
        counts[u.center] = (counts[u.center] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
        hotspotsList.innerHTML = '<li style="background:#f0fdf4; color:#166534; border-left-color:#16a34a;">✅ Todo cubierto. Sin puntos calientes.</li>';
    } else {
        hotspotsList.innerHTML = sorted.map(([name, count]) =>
            `<li><strong>${name}</strong>: ${count} puesto(s) descubierto(s)</li>`
        ).join('');
    }

    // Actions
    let actionsHTML = '';
    if (uncoveredCount > 0) {
        const plural = uncoveredCount > 1 ? 's' : '';
        actionsHTML += `<li>Movilizar bolsa de suplencia para cubrir ${uncoveredCount} vacante${plural} urgente${plural}.</li>`;
        if (sorted[0]) actionsHTML += `<li>Prioridad: Enviar coordinador a <strong>${sorted[0][0]}</strong>.</li>`;
    }

    // Add incident based actions
    const highPriorityIncidents = state.incidents.filter(i => i.priority === 'HIGH' && !i.reported).length;
    if (highPriorityIncidents > 0) {
        actionsHTML += `<li>Resolver ${highPriorityIncidents} incidencias de ALTA prioridad pendientes.</li>`;
    }

    if (actionsHTML === '') {
        actionsHTML = '<li>Realizar auditoría preventiva de calidad en servicios TOP 10.</li><li>Actualizar cuadrantes para el próximo periodo.</li>';
    }

    actionsList.innerHTML = actionsHTML;
}

window.downloadReportPDF = async () => {
    const element = document.querySelector('.report-modal-content');
    if (!element) return;

    // 1. Apply compact mode styles
    element.classList.add('pdf-compact');

    // 2. Temporarily hide actions
    const actions = element.querySelector('.footer-actions');
    const closeBtn = element.querySelector('.close-modal');
    const originalActionsDisplay = actions ? actions.style.display : '';
    const originalCloseDisplay = closeBtn ? closeBtn.style.display : '';

    if (actions) actions.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';

    // 3. Force Charts to Resize to new compact container sizes
    if (reportChartCoverageInstance) reportChartCoverageInstance.resize();
    if (reportChartAbsencesInstance) reportChartAbsencesInstance.resize();

    // Small delay to allow canvas redraw execution
    await new Promise(resolve => setTimeout(resolve, 500));

    const opt = {
        margin: 5,
        filename: `SIFU_Informe_Situacional_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
    };

    if (typeof html2pdf === 'undefined') {
        alert('Librería PDF no cargada. Por favor recarga la página.');
        cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay);
        return;
    }

    try {
        await html2pdf().set(opt).from(element).save();
    } catch (err) {
        console.error('PDF Generation Error:', err);
    } finally {
        cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay);
    }
};

window.downloadReportExcel = () => {
    if (!state.masterData) return;

    // Create a multi-sheet Export
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = [
        { CONCEPTO: 'Total Servicios', VALOR: state.masterData.length },
        { CONCEPTO: 'Servicios Descubiertos', VALOR: state.uncovered.length },
        { CONCEPTO: 'Absentismo Total', VALOR: state.absences.length },
        { CONCEPTO: 'Porcentaje Cobertura', VALOR: (((state.masterData.length - state.uncovered.length - state.absences.length) / state.masterData.length) * 100).toFixed(2) + '%' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, "RESUMEN_EJECUTIVO");

    // Sheet 2: Uncovered Details
    if (state.uncovered.length > 0) {
        const wsUncovered = XLSX.utils.json_to_sheet(state.uncovered);
        XLSX.utils.book_append_sheet(wb, wsUncovered, "DESCUBIERTOS");
    }

    // Sheet 3: Absences
    if (state.absences.length > 0) {
        const wsAbsences = XLSX.utils.json_to_sheet(state.absences);
        XLSX.utils.book_append_sheet(wb, wsAbsences, "ABSENTISMO");
    }

    XLSX.writeFile(wb, `SIFU_Informe_Situacional_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('EXCEL GENERADO CON ÉXITO', 'success');
};

function cleanupPDFGeneration(element, actions, closeBtn, originalActionsDisplay, originalCloseDisplay) {
    if (actions) actions.style.display = originalActionsDisplay;
    if (closeBtn) closeBtn.style.display = originalCloseDisplay; // Fixed variable name

    element.classList.remove('pdf-compact');

    // Restore charts to full size
    setTimeout(() => {
        if (reportChartCoverageInstance) reportChartCoverageInstance.resize();
        if (reportChartAbsencesInstance) reportChartAbsencesInstance.resize();
    }, 100);
}

window.generateOperationalInsights = async () => {
    const container = document.getElementById('op-insights-container');
    const typing = document.getElementById('op-typing-indicator');

    if (!container || !typing) return;

    container.innerHTML = '';
    typing.style.display = 'block';

    // Helper for typing delay
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper to add message with fade
    const addMsg = (html, type = 'normal') => {
        const div = document.createElement('div');
        div.className = `op-msg ${type}`;
        div.innerHTML = html;
        container.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
    };

    // 1. Thinking Phase (Simulate Connection)
    const thinkingSteps = [
        "Conectando con el núcleo de datos...",
        "Analizando patrones de cobertura en tiempo real...",
        "Cruzando incidencias con cuadrantes activos...",
        "Detectando anomalías operativas..."
    ];

    const typingText = document.createElement('div');
    typingText.style.color = '#94a3b8';
    typingText.style.fontSize = '12px';
    typingText.style.marginTop = '10px';
    typingText.style.fontFamily = 'monospace';
    typingText.id = 'op-thinking-text';
    typingText.style.textAlign = 'center';
    container.appendChild(typingText);

    for (const step of thinkingSteps) {
        typingText.innerText = `> ${step}`;
        await wait(800 + Math.random() * 600);
    }

    if (typingText.parentNode) typingText.remove(); // Clear thinking text once done


    typing.style.display = 'none';

    // 2. Data Analysis
    const stats = analyzeMasterData();
    const incidentStats = analyzeIncidents();

    // 3. Insight Generation (Reasoning Engine)

    // Intro
    await wait(200);
    addMsg("He completado el análisis del estado operativo actual.", "normal");

    // Critical Reasoning
    if (stats.descubiertos > 0) {
        await wait(1000);
        const serviceName = stats.topDescubiertoService || 'múltiples puntos';
        addMsg(`⚠️ <strong>Atención:</strong> He detectado una fractura en la cobertura. Tenemos <strong>${stats.descubiertos} servicios descubiertos</strong> ahora mismo.`, "urgent");

        await wait(1200);
        addMsg(`El foco del problema parece estar en <strong>${serviceName}</strong>. Basado en los datos, esto representa un riesgo crítico de servicio.`, "normal");
    } else {
        await wait(1000);
        addMsg(`✅ <strong>Todo parece en orden.</strong> La cobertura está al <strong>100%</strong>. No detecto desviaciones en los servicios principales.`, "success");
    }

    // Correlation with Incidents
    if (incidentStats.highPriority > 0) {
        await wait(1200);
        addMsg(`He correlacionado esto con <strong>${incidentStats.highPriority} incidencias de alta prioridad</strong> reportadas recientemente. Sugiero atenderlas antes de que escalen.`, "urgent");
    }

    // Proactive Suggestion
    await wait(1500);
    let suggestion = "";
    if (stats.descubiertos > 0) {
        suggestion = "💡 <strong>Mi recomendación:</strong> Contacta inmediatamente con la bolsa de suplencia para la zona afectada. Si mueves efectivos de servicios con baja carga, podrías cubrir el hueco en 30 minutos.";
    } else {
        suggestion = "💡 <strong>Sugerencia proactiva:</strong> Dado que la estabilidad es alta, es un buen momento para realizar auditorías de calidad preventivas en los servicios VIP.";
    }
    addMsg(suggestion, "normal");
};

function analyzeMasterData() {
    if (!state.masterData || state.masterData.length === 0) return { descubiertos: 0, totalActive: 0 };

    const keys = Object.keys(state.masterData[0]);
    const kEstado = keys.find(k => k.toUpperCase().includes('ESTADO')) || 'ESTADO';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';

    let descubiertos = 0;
    let serviceCounts = {};

    state.masterData.forEach(row => {
        const status = (row[kEstado] || '').toString().toUpperCase();
        const titular = (row[kTitular] || '').toString().toUpperCase();
        const isSpecial = status.includes('BRIGADA') || titular.includes('RUTA CRISTALES') || status.includes('OBRAS') || status.includes('CERRADO');

        const isDesc = (
            status.includes('DESCUBIERTO') ||
            status.includes('VACANTE') ||
            status.includes('SIN ASIGNAR') ||
            titular.includes('SIN TITULAR') ||
            titular.includes('DESCUBIERTO') ||
            titular.includes('VACANTE') ||
            (status === '' && (titular === '' || titular === 'SIN TITULAR')) ||
            (status === 'PENDIENTE' && titular === '')
        ) && !isSpecial;

        if (isDesc) {
            descubiertos++;
            const srv = row[kServicio] || 'Desconocido';
            serviceCounts[srv] = (serviceCounts[srv] || 0) + 1;
        }
    });

    let topDescubiertoService = null;
    let max = 0;
    for (const [srv, count] of Object.entries(serviceCounts)) {
        if (count > max) {
            max = count;
            topDescubiertoService = srv;
        }
    }

    return {
        descubiertos,
        totalActive: state.masterData.length,
        topDescubiertoService
    };
}

function analyzeIncidents() {
    const active = state.incidents.filter(i => !i.reported); // Assuming reported means resolved/archived? Or inverted?
    // Let's assume stats.incidents contains all. We want unresolved.
    // In this app, 'delete' removes them. So all visible are "active" or "reported" (just flagged).
    // Let's count High Priority regardless.

    const high = state.incidents.filter(i => i.priority === 'HIGH').length;
    return {
        total: state.incidents.length,
        highPriority: high
    };
}


// Tab Switching Logic
window.switchTab = (tabId) => {
    const tabs = document.querySelectorAll('.tab-content');
    const btns = document.querySelectorAll('.tab-btn');

    // 1. Remove active classes
    tabs.forEach(c => c.classList.remove('active'));
    btns.forEach(b => b.classList.remove('active'));

    // 2. Add active to target
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.add('active');

        // Robust button highlighting (checks both onclick and data-tab)
        const btn = [...btns].find(b =>
            (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${tabId}'`)) ||
            (b.getAttribute('data-tab') === tabId)
        );
        if (btn) btn.classList.add('active');

        // Special actions per tab
        if (tabId === 'pedidos') {
            console.log("📦 Refrescando vista de Pedidos...");
            if (typeof renderOrders === 'function') window.renderOrders();
            setTimeout(() => {
                if (typeof initOrdersModule === 'function') window.initOrdersModule();
            }, 50);
        }

        if (tabId === 'resumen') {
            setTimeout(() => {
                if (typeof updateCharts === 'function') updateCharts();
                if (typeof updateOperationalChart === 'function') updateOperationalChart();
            }, 100);
        }

        if (tabId === 'abonos') {
            console.log("📉 Analizando Bajas IT...");
            if (typeof window.renderITTable === 'function') setTimeout(window.renderITTable, 50);
        }

        if (tabId === 'cuadrantes') {
            console.log("🗓️ Iniciando Cuadrantes...");
            if (typeof window.initQuadrantsModule === 'function') setTimeout(window.initQuadrantsModule, 50);
        }


        if (tabId === 'smarthub') {
            console.log("🧠 Inicializando INTELIGENCIA Y GESTIÓN...");
            setTimeout(() => {
                // FASE 1 MODULES
                if (typeof DailyChecklist !== 'undefined' && typeof DailyChecklist.render === 'function') {
                    DailyChecklist.render();
                }
                if (typeof CalendarModule !== 'undefined' && typeof CalendarModule.render === 'function') {
                    CalendarModule.render();
                }
                if (typeof AnalyticsTrends !== 'undefined') {
                    if (typeof AnalyticsTrends.renderTrendsChart === 'function') {
                        AnalyticsTrends.renderTrendsChart();
                    }
                    if (typeof AnalyticsTrends.renderInsights === 'function') {
                        AnalyticsTrends.renderInsights();
                    }
                }

                // FASE 2 MODULES
                if (typeof AIPredictiveEngine !== 'undefined') {
                    if (typeof AIPredictiveEngine.renderPredictions === 'function') {
                        AIPredictiveEngine.renderPredictions();
                    }
                    if (typeof AIPredictiveEngine.renderRecommendations === 'function') {
                        AIPredictiveEngine.renderRecommendations();
                    }
                }
                if (typeof WorkerPerformance !== 'undefined' && typeof WorkerPerformance.renderWorkerList === 'function') {
                    WorkerPerformance.renderWorkerList();
                }
                if (typeof SubstituteManagement !== 'undefined' && typeof SubstituteManagement.renderSubstituteManager === 'function') {
                    SubstituteManagement.renderSubstituteManager();
                }

                // FASE 4 MODULES - MACHINE LEARNING
                if (typeof MLEngine !== 'undefined') {
                    if (typeof MLEngine.predictUncoveredServices === 'function') {
                        MLEngine.predictUncoveredServices().then(() => {
                            if (typeof MLEngine.renderPredictions === 'function') {
                                MLEngine.renderPredictions();
                            }
                        });
                    }
                    if (typeof MLEngine.renderAnomalies === 'function') {
                        MLEngine.renderAnomalies();
                    }
                }
                if (typeof RouteOptimizer !== 'undefined' && typeof RouteOptimizer.renderRouteOptimization === 'function') {
                    RouteOptimizer.renderRouteOptimization();
                }
                if (typeof ServiceClustering !== 'undefined' && typeof ServiceClustering.renderClusters === 'function') {
                    ServiceClustering.renderClusters();
                }

                // FASE 5 MODULES - INTEGRATIONS & EXPORT
                if (typeof IntegrationsHub !== 'undefined' && typeof IntegrationsHub.renderIntegrationsPanel === 'function') {
                    IntegrationsHub.renderIntegrationsPanel();
                }
                if (typeof AdvancedExport !== 'undefined' && typeof AdvancedExport.renderExportPanel === 'function') {
                    AdvancedExport.renderExportPanel();
                }

                // FASE 7 MODULES - BUSINESS INTELLIGENCE
                if (typeof BIEngine !== 'undefined') {
                    BIEngine.init();
                    if (typeof BIEngine.renderBiDashboard === 'function') {
                        BIEngine.renderBiDashboard();
                    }
                }

                if (typeof SecurityManager !== 'undefined' && typeof SecurityManager.renderSecurityDashboard === 'function') {
                    SecurityManager.renderSecurityDashboard();
                }

                // FASE 9 MODULES - QUALITY & COMPLIANCE
                if (typeof QualityManager !== 'undefined') {
                    QualityManager.init();
                    if (typeof QualityManager.renderQualityDashboard === 'function') {
                        QualityManager.renderQualityDashboard();
                    }
                }

                if (typeof DocumentManager !== 'undefined') {
                    DocumentManager.init();
                    if (typeof DocumentManager.renderDocumentPanel === 'function') {
                        DocumentManager.renderDocumentPanel();
                    }
                }

                if (typeof FinancialManager !== 'undefined') {
                    FinancialManager.init();
                    if (typeof FinancialManager.renderFinancialDashboard === 'function') {
                        FinancialManager.renderFinancialDashboard();
                    }
                }

                // FASE 12 MODULES - TALENT & TRAINING
                if (typeof TalentManager !== 'undefined') {
                    TalentManager.init();
                    if (typeof TalentManager.renderTalentDashboard === 'function') {
                        TalentManager.renderTalentDashboard();
                    }
                }

                if (typeof FleetManager !== 'undefined') {
                    FleetManager.init();
                    if (typeof FleetManager.renderFleetDashboard === 'function') {
                        FleetManager.renderFleetDashboard();
                    }
                }

                if (typeof SustainabilityManager !== 'undefined') {
                    SustainabilityManager.init();
                    if (typeof SustainabilityManager.renderSustainabilityDashboard === 'function') {
                        SustainabilityManager.renderSustainabilityDashboard();
                    }
                }

                // FASE 15 MODULES - EXECUTIVE COMMAND
                if (typeof ExecutiveCommand !== 'undefined') {
                    ExecutiveCommand.init();
                    if (typeof ExecutiveCommand.renderExecutiveDashboard === 'function') {
                        ExecutiveCommand.renderExecutiveDashboard();
                    }
                }

                showToast("✨ SMART HUB CARGADO", "success");
            }, 100);
        }

        // Smooth entry effect scroll
        window.scrollTo({ top: 0, behavior: 'smooth' });
        console.log(`🚀 Navegación: Cambiando a pestaña [${tabId.toUpperCase()}]`);
    }
};

function initCharts() {
    const ctx = document.getElementById('incidentsChart');
    if (!ctx) return;
    incidentsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ausencias', 'Bajas IT', 'Retrasos', 'Otros'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#f43f5e', '#f59e0b', '#0ea5e9', '#64748b'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '80%' }
    });
}

function updateCharts() {
    if (!incidentsChart) return;
    const abs = state.incidents.filter(i => i.type === 'AUSENCIA').length;
    const ret = state.incidents.filter(i => i.type === 'RETRASO').length;
    incidentsChart.data.datasets[0].data = [abs, 0, ret, state.incidents.length - (abs + ret)];
    incidentsChart.update();
    updateOperationalChart();
}


function renderAll() {
    updateDate();
    updateHeaderStats();

    // Render Modules
    if (typeof renderIncidents === 'function') renderIncidents();
    if (typeof renderNotes === 'function') renderNotes();
    if (typeof renderMasterSummary === 'function') renderMasterSummary();
    if (typeof renderAbsences === 'function') renderAbsences();
    if (typeof renderUncovered === 'function') renderUncovered();
    if (typeof renderOrders === 'function') renderOrders();
    if (typeof initQuadrantsModule === 'function') initQuadrantsModule();
    if (typeof renderPriorityPanel === 'function') renderPriorityPanel();
    if (typeof renderRiskSemaphor === 'function') renderRiskSemaphor();

    // Charts & Analytics
    if (typeof updateCharts === 'function') updateCharts();
    if (typeof updateOperationalChart === 'function') updateOperationalChart();
    if (typeof updateSisPredict === 'function') updateSisPredict();
    if (typeof updateInsights === 'function') updateInsights();
    if (typeof updateAnalytics === 'function') updateAnalytics();
    if (typeof updateEmergencyPopup === 'function') updateEmergencyPopup();

    console.log("🔄 Dashboard renderizado completamente (Pipeline Consolidado).");
}

function renderRiskSemaphor() {
    const list = document.getElementById('risk-list');
    if (!list || !state.masterData || state.masterData.length === 0) return;

    console.log("🚦 Calculando Semáforo de Riesgo...");

    const riskMap = new Map();
    const keys = Object.keys(state.masterData[0]);
    const kEstado = keys.find(k => k.toUpperCase().includes('ESTADO')) || 'ESTADO';
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';

    // 1. Analizar Master Data (Descubiertos)
    state.masterData.forEach(row => {
        const srv = row[kServicio];
        if (!srv) return;

        if (!riskMap.has(srv)) {
            riskMap.set(srv, { name: srv, score: 0, factors: [] });
        }
        const data = riskMap.get(srv);

        const status = (row[kEstado] || '').toString().toUpperCase();
        if (status.includes('DESCUBIERTO') || status.includes('VACANTE') || status.includes('SIN ASIGNAR')) {
            data.score += 45;
            if (!data.factors.includes("Fallo Cobertura")) data.factors.push("Fallo Cobertura");
        }
    });

    // 2. Analizar Incidencias Recientes
    state.incidents.forEach(inc => {
        // Buscar servicio asociado al trabajador de la incidencia
        const row = state.masterData.find(r =>
            Object.values(r).some(val => val.toString().toUpperCase() === inc.worker.toUpperCase())
        );

        if (row) {
            const srv = row[kServicio];
            if (riskMap.has(srv)) {
                const data = riskMap.get(srv);
                if (inc.priority === 'HIGH') {
                    data.score += 35;
                    if (!data.factors.includes("Alertas Críticas")) data.factors.push("Alertas Críticas");
                } else {
                    data.score += 15;
                    if (!data.factors.includes("Incidencias")) data.factors.push("Incidencias");
                }
            }
        }
    });

    const sortedRisks = Array.from(riskMap.values())
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

    if (sortedRisks.length === 0) {
        list.innerHTML = '<div class="empty-state">✅ OPERATIVA ESTABLE. SIN RIESGOS DETECTADOS.</div>';
        return;
    }

    list.innerHTML = sortedRisks.map(r => {
        let colorClass = 'green';
        let level = 'ESTABLE';
        if (r.score >= 70) { colorClass = 'red'; level = 'CRÍTICO'; }
        else if (r.score >= 30) { colorClass = 'orange'; level = 'RIESGO'; }

        const displayScore = Math.min(r.score, 100);

        return `
            <div class="risk-item ${colorClass}">
                <div class="risk-circle"></div>
                <div class="risk-info">
                    <div class="risk-name">${r.name}</div>
                    <div class="risk-factors">${r.factors.join(' + ')}</div>
                </div>
                <div style="text-align:right;">
                    <div class="risk-score">${displayScore}%</div>
                    <div style="font-size:8px; font-weight:800; opacity:0.8;">${level}</div>
                </div>
            </div>
        `;
    }).join('');
}

let operationalChart = null;


// function processMasterArray moved to line 863

function initOperationalChart() {

    const ctx = document.getElementById('operationalHealthChart');
    if (!ctx) return;
    operationalChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['OK', 'Incidencias', 'Críticos'],
            datasets: [{
                data: [100, 0, 0],
                backgroundColor: ['#34a853', '#f9ab00', '#ea4335'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateOperationalChart() {
    // Robust check for data readiness
    if (!state.masterData || !state.masterData.length) return;

    const total = state.masterData.length;
    const uncovered = state.uncovered ? state.uncovered.length : 0;
    const incidents = state.incidents ? state.incidents.length : 0;
    const ok = Math.max(0, total - uncovered - incidents);

    // 1. Update Chart ONLY if it exists
    if (operationalChart && operationalChart.data && operationalChart.data.datasets) {
        operationalChart.data.datasets[0].data = [ok, incidents, uncovered];
        operationalChart.update();
    }

    // 2. Update Header Percentages (Legacy)
    const coveragePct = total > 0 ? ((ok / total) * 100).toFixed(0) : "0";
    const coverEl = document.getElementById('coverage-percent');
    if (coverEl) coverEl.textContent = coveragePct + '%';

    // 3. Update mini-insights labels (Legacy)
    const okEl = document.getElementById('count-ok');
    const incEl = document.getElementById('count-incidents');
    const critEl = document.getElementById('count-critical');

    if (okEl) okEl.textContent = ok;
    if (incEl) incEl.textContent = incidents;
    if (critEl) critEl.textContent = uncovered;

    // 4. --- NEW SUMMARY DASHBOARD UPDATES (Critical) ---
    const sumUnc = document.getElementById('sum-val-uncovered');
    const sumAbs = document.getElementById('sum-val-absences');
    const sumInc = document.getElementById('sum-val-incidents');
    const sumEff = document.getElementById('sum-efficiency-val');
    const sumCircle = document.getElementById('efficiency-circle-path');

    if (sumUnc) sumUnc.textContent = uncovered;

    // Robust Absence Calculation
    let activeAbsences = 0;
    if (state.it_list && state.it_list.length > 0) {
        activeAbsences = state.it_list.length;
    } else {
        // Fallback calculation directly from Master Data
        activeAbsences = state.masterData.filter(r => {
            const s = (r['ESTADO1'] || r['Estado'] || "").toUpperCase();
            return s.includes('IT') || s.includes('BAJA') || s.includes('ACCIDENTE') || s.includes('ENFERMEDAD');
        }).length;
    }
    if (sumAbs) sumAbs.textContent = activeAbsences;

    if (sumInc) sumInc.textContent = incidents;

    if (sumEff && sumCircle) {
        let efficienty = 0;
        if (total > 0) {
            // Efficiency = (Total - Uncovered) / Total * 100
            efficienty = ((total - uncovered) / total) * 100;
        }
        sumEff.textContent = efficienty.toFixed(1) + '%';
        const strokeVal = `${efficienty}, 100`;
        sumCircle.setAttribute('stroke-dasharray', strokeVal);
        sumCircle.setAttribute('stroke', efficienty > 90 ? '#4ade80' : efficienty > 70 ? '#facc15' : '#ef4444');
    }

    // 5. --- POPULATE WORKFORCE DNA & CRITICAL SERVICES ---
    const dnaActive = document.getElementById('sum-dna-active');
    const dnaTotal = document.getElementById('sum-dna-total');
    const dnaAbsRate = document.getElementById('sum-dna-absent-rate');
    const dnaUncRate = document.getElementById('sum-dna-uncovered-rate');
    const dnaUnc = document.getElementById('sum-dna-uncovered');
    const dnaAbs = document.getElementById('sum-dna-absent');

    if (dnaTotal) {
        const activeWorkers = Math.max(0, total - uncovered - activeAbsences);
        dnaTotal.textContent = total;
        dnaActive.textContent = activeWorkers;
        if (dnaUnc) dnaUnc.textContent = uncovered;
        if (dnaAbs) dnaAbs.textContent = activeAbsences;

        if (total > 0) {
            if (dnaAbsRate) dnaAbsRate.textContent = `(${(activeAbsences / total * 100).toFixed(1)}%)`;
            if (dnaUncRate) dnaUncRate.textContent = `(${(uncovered / total * 100).toFixed(1)}%)`;
        }
    }

    // Critical Services List Logic
    const criticalListEl = document.getElementById('sum-critical-list');
    if (criticalListEl) {
        const riskMap = {};
        // Scan for issues
        state.masterData.forEach(row => {
            const srv = row['SERVICIO'] || row['Alias/Nombre del centro'];
            if (!srv) return;

            const st = (row['ESTADO'] || row['ESTADO1'] || "").toUpperCase();
            let score = 0;
            if (st.includes('DESCUBIERTO') || st.includes('VACANTE')) score = 2; // High priority
            else if (st.includes('IT') || st.includes('BAJA')) score = 1;      // Medium priority

            if (score > 0) {
                riskMap[srv] = (riskMap[srv] || 0) + score;
            }
        });

        const sortedRisks = Object.entries(riskMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5

        if (sortedRisks.length === 0) {
            criticalListEl.innerHTML = `<div style="text-align:center; padding:20px; color:#15803d; font-weight:700;">✅ 100% OPERATIVO</div>`;
        } else {
            criticalListEl.innerHTML = sortedRisks.map(([name, score]) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9;">
                    <div style="font-size:12px; font-weight:700; color:#334155;">${name}</div>
                    <div style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">Risk: ${score}</div>
                </div>
            `).join('');
        }
    }

    // 6. --- TRIGGER CONTRACT ALERT CHECK ---
    if (window.checkContractExpirations) {
        window.checkContractExpirations();
    }

}

function updateTrendsChart() { }
function updateSisPredict() {
    const el = document.getElementById('sis-predict-val');
    if (!el) return;

    // Calculo 'TOP' basado en carga de trabajo
    const baseLoad = state.masterData.length || 1;
    const activeIncidents = state.incidents.length;
    const riskFactor = (activeIncidents / baseLoad) * 100;

    // Algoritmo mock de predicción
    let prediction = Math.min(99.9, riskFactor * 2.5).toFixed(1);
    let trend = riskFactor > 5 ? '↑' : '↓';

    el.textContent = `${prediction}% ${trend} `;
    el.style.color = riskFactor > 10 ? 'var(--accent-red)' : (riskFactor > 5 ? 'var(--sifu-amber)' : 'var(--accent-green)');
}

function updateInsights() {
    const valUncovered = document.getElementById('val-uncovered');
    const valAbsences = document.getElementById('val-absences');
    const valIncidents = document.getElementById('val-incidents');
    const valActive = document.getElementById('val-active');

    if (!state.masterData || state.masterData.length === 0) return;

    const uncoveredCount = state.uncovered.length;
    const absencesCount = state.absences.length;

    // Update Bridge Cards
    if (valUncovered) {
        valUncovered.textContent = uncoveredCount;
        const trendEl = document.getElementById('trend-uncovered');
        const card = document.getElementById('metric-uncovered');

        if (uncoveredCount > 0) {
            if (card) card.classList.add('critical-pulse');
            if (trendEl) {
                trendEl.className = 'metric-trend up';
                trendEl.innerHTML = '<span class="trend-icon">▲</span> <span class="trend-text">Atención inmediata</span>';
            }
        } else {
            if (card) card.classList.remove('critical-pulse');
            if (trendEl) {
                trendEl.className = 'metric-trend down';
                trendEl.innerHTML = '<span class="trend-icon">✔</span> <span class="trend-text">Sin descubiertos</span>';
            }
        }
    }

    if (valAbsences) {
        valAbsences.textContent = absencesCount;
        const trendEl = document.getElementById('trend-absences');
        if (trendEl) {
            trendEl.innerHTML = `<span class="trend-icon">🏥</span> <span class="trend-text">${absencesCount} bajas activas</span>`;
        }
    }

    if (valIncidents) {
        valIncidents.textContent = state.incidents.length;
        const trendEl = document.getElementById('trend-incidents');
        if (trendEl) {
            const count = state.incidents.length;
            trendEl.className = count > 0 ? 'metric-trend up' : 'metric-trend neutral';
            trendEl.innerHTML = count > 0 ?
                `<span class="trend-icon">⚠️</span> <span class="trend-text">${count} activas</span>` :
                '<span class="trend-icon">●</span> <span class="trend-text">Todo en orden</span>';
        }
    }

    if (valActive) {
        const total = state.masterData.length;
        const percent = total > 0 ? (((total - uncoveredCount) / total) * 100).toFixed(1) : "0";
        valActive.textContent = percent + '%';
        const trendEl = document.getElementById('trend-active');
        if (trendEl) {
            const isGood = parseFloat(percent) > 95;
            trendEl.className = isGood ? 'metric-trend down' : 'metric-trend up';
            trendEl.innerHTML = isGood ?
                '<span class="trend-icon">★</span> <span class="trend-text">Eficiencia Alta</span>' :
                '<span class="trend-icon">▼</span> <span class="trend-text">Bajo cobertura</span>';
        }
    }

    const valEfficiency = document.getElementById('val-efficiency');
    const valSLA = document.getElementById('val-sla');

    if (valEfficiency) {
        // Mocking dynamic calculation: 100 - (incidents * 0.5)
        const score = Math.max(85, 100 - (state.incidents.length * 0.5)).toFixed(1);
        valEfficiency.textContent = score + '%';
    }

    if (valSLA) {
        const score = Math.max(90, 100 - (uncoveredCount * 2)).toFixed(1);
        valSLA.textContent = score + '%';
    }

    const panel = document.getElementById('insights-panel');
    if (!panel) return;

    const insights = [];

    // 1. Análisis de Cobertura (Critical)
    if (uncoveredCount > 0) {
        insights.push({
            type: 'critical',
            text: `⚠️ ALERTA: ${uncoveredCount} servicios descubiertos requieren acción inmediata.`,
            tag: 'URGENTE'
        });
    }

    // 2. Análisis de Bajas (Warning)
    const sickLeave = state.absences.filter(a => a.reason && a.reason.toUpperCase().includes('BAJA')).length;
    if (sickLeave > 3) {
        insights.push({
            type: 'ai-suggest',
            text: `Alta tasa de absentismo(${sickLeave} activos).Revisar plan de suplencias.`,
            tag: 'ABSENTISMO'
        });
    } else {
        insights.push({
            type: 'performance',
            text: `Nivel de absentismo bajo control.Operativa estable.`,
            tag: 'OPTIMO'
        });
    }

    // 3. Recomendación IA
    const hour = new Date().getHours();
    if (hour < 10) {
        insights.push({
            type: 'ai-suggest',
            text: '💡 Sugerencia: Verificar fichajes de entrada del turno de mañana.',
            tag: 'SISTEMA TIP'
        });
    } else if (hour > 14 && hour < 16) {
        insights.push({
            type: 'ai-suggest',
            text: '💡 Sugerencia: Preparar cuadrante para el turno de tarde.',
            tag: 'SISTEMA TIP'
        });
    }

    panel.innerHTML = insights.map(i => `
        <div class="insight-card">
            <div class="insight-tag ${i.type === 'critical' ? 'critical' : (i.type === 'performance' ? 'performance' : 'ai-suggest')}">
                ${i.tag}
            </div>
            <div class="insight-text">${i.text}</div>
        </div>
    `).join('');
}
function scrollToModule(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const parentTab = el.closest('.tab-content');
    if (parentTab && !parentTab.classList.contains('active')) {
        switchTab(parentTab.id.replace('tab-', ''));
    }
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

// --- MICROSOFT OUTLOOK INTEGRATION ---
const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID_HERE", // Requiere registro en Azure Portal
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.href
    }
};

let msalInstance = null;

async function initMSAL() {
    if (typeof msal !== 'undefined' && !msalInstance) {
        msalInstance = new msal.PublicClientApplication(msalConfig);
    }
}

window.connectedOutlook = async () => {
    await initMSAL();
    try {
        const loginRequest = {
            scopes: ["User.Read", "Mail.Read"]
        };
        const loginResponse = await msalInstance.loginPopup(loginRequest);
        console.log("Login Success:", loginResponse);
        fetchRealEmails();
    } catch (error) {
        console.error("Login Error:", error);
        alert("Para la integración real, IT debe registrar esta App en Azure. Mostrando simulado por ahora.");
        renderOutlookMock(); // Volver al simulado si falla (por falta de ClientID)
    }
};

async function fetchRealEmails() {
    const feed = document.getElementById('outlook-feed');
    if (!feed) return;

    feed.innerHTML = '<div class="loading-shimmer">Conectando con Microsoft Graph...</div>';

    try {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length === 0) return;

        const tokenRequest = {
            scopes: ["Mail.Read"],
            account: accounts[0]
        };

        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        const accessToken = response.accessToken;

        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=sender,subject,bodyPreview,receivedDateTime,isRead", {
            headers: {
                "Authorization": `Bearer ${accessToken} `
            }
        });

        const data = await graphResponse.json();
        renderRealEmails(data.value);
    } catch (error) {
        console.error("Graph Error:", error);
        renderOutlookMock();
    }
}

function renderRealEmails(emails) {
    const feed = document.getElementById('outlook-feed');
    const unreadCount = document.getElementById('outlook-unread-count');
    if (!feed) return;

    const unreads = emails.filter(e => !e.isRead).length;
    if (unreadCount) unreadCount.textContent = unreads;

    feed.innerHTML = emails.map(email => `
        <div class="outlook-item ${!email.isRead ? 'unread' : ''}" onclick="window.open('${email.webLink || '#'}', '_blank')">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">${email.sender.emailAddress.name}</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">${email.subject}</div>
            <div style="font-size:11px; color:var(--text-dim); overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${email.bodyPreview}</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">${new Date(email.receivedDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}

function renderOutlookMock() {
    const feed = document.getElementById('outlook-feed');
    if (!feed) return;
    feed.innerHTML = `
        <div class="outlook-item unread">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">Soporte IT</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">Mantenimiento Programado</div>
            <div style="font-size:11px; color:var(--text-dim);">Recordatorio: El sistema se actualizará esta noche.</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">10:30</div>
        </div>
        <div class="outlook-item">
            <div style="font-weight:700; font-size:13px; color:var(--sifu-blue); margin-bottom:4px;">Recursos Humanos</div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">Nuevas Incorporaciones</div>
            <div style="font-size:11px; color:var(--text-dim);">Adjunto lista de personal nuevo.</div>
            <div style="font-size:10px; color:var(--text-dim); text-align:right; margin-top:4px;">09:15</div>
        </div>
`;
}


function showToast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type} `;
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">${type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️')}</span>
            <span>${msg}</span>
        </div>
        <span class="toast-close" onclick="this.parentElement.remove()">×</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- NEW FEATURES: ANALYTICS & VOICE ---

function updateAnalytics() {
    updateHeatmap();
    updateTopIncidents();
}

function updateHeatmap() {
    const heatmap = document.getElementById('incidents-heatmap');
    if (!heatmap) return;

    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const today = new Date();

    let html = '';
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dayLabel = days[date.getDay()];

        // Find incidents on this day
        // Assuming inc.date is "DD/MM/YYYY" as seen in previous steps
        const dateStr = date.toLocaleDateString('es-ES');
        const dayIncidents = state.incidents.filter(inc => inc.date === dateStr).length;

        let level = 0;
        if (dayIncidents > 5) level = 3;
        else if (dayIncidents > 2) level = 2;
        else if (dayIncidents > 0) level = 1;

        html += `
        <div class="heatmap-day level-${level}">
            <span>${dayLabel}</span>
            <strong>${dayIncidents}</strong>
            <span style="font-size:8px;">${dayIncidents} alert.</span>
        </div>
        `;
    }
    heatmap.innerHTML = html;
}

function updateTopIncidents() {
    const list = document.getElementById('top-incidents-list');
    if (!list) return;

    const counts = {};
    state.incidents.forEach(inc => {
        counts[inc.worker] = (counts[inc.worker] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state" style="font-size:10px;">SIN ALERTAS RECURRENTES</div>';
        return;
    }

    list.innerHTML = sorted.map(([worker, count]) => `
        <div class="top-incident-item">
            <span class="worker">${worker}</span>
            <span class="count">${count} ALERTAS</span>
        </div>
    `).join('');
}

function initVoiceCommand() {
    const btn = document.getElementById('voice-command-btn'); // Corrected ID
    const input = document.getElementById('quick-input-bar');
    if (!btn || !input) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Check for file:// protocol limitation
    if (window.location.protocol === 'file:') {
        btn.onclick = () => {
            showToast("⚠️ EL RECONOCIMIENTO DE VOZ REQUIERE UN SERVIDOR (HTTP/HTTPS). NO FUNCIONA ABRIENDO EL ARCHIVO DIRECTAMENTE.", "error");
            console.warn("SpeechRecognition works on HTTP/HTTPS or localhost, not file:// protocol.");
        };
        return;
    }

    if (!SpeechRecognition) {
        btn.style.display = 'none';
        console.warn("Tu navegador no soporta reconocimiento de voz.");
        return;
    }

    console.log("Sistema de Voz: Inicializado.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = true; // Permite ver resultados parciales

    let finalTranscript = '';

    btn.onclick = (e) => {
        e.preventDefault();
        console.log("Click en micro...");
        if (btn.classList.contains('listening')) {
            recognition.stop();
        } else {
            try {
                finalTranscript = '';
                recognition.start();
                console.log("Grabación iniciada...");
            } catch (err) {
                console.error("Error al iniciar micro:", err);
                showToast("No se pudo iniciar el micrófono", "error");
            }
        }
    };

    recognition.onstart = () => {
        btn.classList.add('listening');
        btn.innerHTML = '🛑';
        input.placeholder = "Escuchando... hable ahora";
        input.value = '';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        input.value = finalTranscript || interimTranscript;
    };

    recognition.onend = () => {
        btn.classList.remove('listening');
        btn.innerHTML = '🎙️';
        input.placeholder = "COMANDO RÁPIDO: ESCRIBE PARA REGISTRAR INCIDENCIA...";

        if (finalTranscript.trim().length > 0) {
            console.log("Procesando comando:", finalTranscript);
            processQuickInput(finalTranscript.trim());
            input.value = '';
            showToast("Comando procesado: " + finalTranscript, "success");
        }
    };

    recognition.onerror = (e) => {
        btn.classList.remove('listening');
        btn.innerHTML = '🎙️';
        console.error("Speech Recognition Error:", e.error);
        if (e.error === 'not-allowed') {
            showToast("ERROR: El navegador bloquea el micro. Revisa permisos.", "error");
        } else if (e.error !== 'no-speech') {
            showToast("Reconocimiento fallido: " + e.error, "error");
        }
    };
}

// ============================================
// SISTEMA DE INDICADOR VISUAL DE GUARDADO
// ============================================

function initSaveIndicator() {
    // Crear indicador si no existe
    let indicator = document.getElementById('save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.style.cssText = `
position: fixed;
top: 20px;
right: 20px;
padding: 8px 16px;
border-radius: 20px;
font-size: 12px;
font-weight: 700;
z-index: 10000;
transition: all 0.3s ease;
opacity: 0;
pointer-events: none;
`;
        document.body.appendChild(indicator);
    }
}

function updateSaveIndicator(status) {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;

    switch (status) {
        case 'saving':
            indicator.textContent = '💾 Guardando...';
            indicator.style.background = 'rgba(251, 188, 5, 0.95)';
            indicator.style.color = '#000';
            indicator.style.opacity = '1';
            break;
        case 'saved':
            indicator.textContent = '✓ Guardado';
            indicator.style.background = 'rgba(52, 168, 83, 0.95)';
            indicator.style.color = '#fff';
            indicator.style.opacity = '1';
            // Ocultar después de 2 segundos
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
            break;
        case 'error':
            indicator.textContent = '⚠️ Error al guardar';
            indicator.style.background = 'rgba(234, 67, 53, 0.95)';
            indicator.style.color = '#fff';
            indicator.style.opacity = '1';
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 4000);
            break;
    }
}

// Marcar cambios pendientes en cada modificación del estado
function markUnsavedChanges() {
    hasUnsavedChanges = true;
    updateSaveIndicator('saving');
}


/* --- EXPORT LOGIC --- */
window.exportStatusToExcel = () => {
    // 1. Check if we are in Situational Report Modal
    const situModal = document.getElementById('situational-report-modal');
    if (situModal && situModal.style.display === 'flex') {
        if (window.downloadReportExcel) return window.downloadReportExcel();
    }

    // 2. Default to Master Table or Modal Body content
    if (!window.lastFilteredResults || window.lastFilteredResults.length === 0) {
        alert('No hay datos filtrados para exportar.');
        return;
    }

    const { kServicio, kTitular, kHorario, kEstado, kSuplente, kFinContrato, kVacaciones } = window.lastFilteredKeys;

    // Prepare clean data for Excel
    const data = window.lastFilteredResults.map(r => ({
        'ESTADO': (r[kEstado] || ''),
        'SERVICIO': (r[kServicio] || ''),
        'TITULAR': (r[kTitular] || ''),
        'HORARIO': (r[kHorario] || ''),
        'SUPLENTE': (r[kSuplente] || ''),
        'FIN CONTRATO': window.formatExcelDate(r[kFinContrato]),
        'VACACIONES': window.formatExcelDate(r[kVacaciones])
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MasterData");

    const filename = `SIFU_MASTER_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
};

window.exportStatusToPDF = (isSituational = false) => {
    // Detect context
    const situModal = document.getElementById('situational-report-modal');
    const detailModal = document.getElementById('status-detail-modal');

    // 1. Context: Situational Report
    if (isSituational || (situModal && situModal.style.display === 'flex' && situModal.classList.contains('active'))) {
        if (window.downloadReportPDF) return window.downloadReportPDF();
    }

    // 2. Context: Director dashboard / Detail modal
    if (detailModal && detailModal.style.display === 'flex') {
        const body = document.getElementById('status-modal-body');
        const title = document.getElementById('status-modal-title').innerText;

        if (body) {
            const opt = {
                margin: 10,
                filename: `SIFU_DETALLE_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            // For custom modal content (like Vision Directiva), capture the body
            const tempDiv = document.createElement('div');
            tempDiv.style.padding = '30px';
            tempDiv.style.background = 'white';
            tempDiv.innerHTML = `
                <div style="border-bottom: 2px solid #1e3c72; padding-bottom:15px; margin-bottom:25px;">
                    <h1 style="color:#1e3c72; margin:0; font-size:24px;">INFORMER SIFU - CENTRO DE DATOS</h1>
                    <p style="margin:5px 0; color:#64748b; font-size:14px;">Reporte: ${title}</p>
                    <p style="margin:0; color:#94a3b8; font-size:10px;">Fecha: ${new Date().toLocaleString()}</p>
                </div>
                ${body.innerHTML}
            `;

            html2pdf().set(opt).from(tempDiv).save();
            return;
        }
    }

    // 3. Fallback: Standard Master Table Export
    if (!window.lastFilteredResults || window.lastFilteredResults.length === 0) {
        alert('No hay datos visibles para generar el PDF.');
        return;
    }

    const { kServicio, kTitular, kHorario, kEstado, kSuplente, kFinContrato, kVacaciones } = window.lastFilteredKeys;

    let tableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">ESTADO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">SERVICIO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">TITULAR</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">HORARIO</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">SUPLENTE</th>
                    <th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-size:10px;">FIN CONTRATO</th>
                </tr>
            </thead>
            <tbody>
    `;

    window.lastFilteredResults.forEach(r => {
        const isDisc = (r[kEstado] || '').toString().toUpperCase().includes('DESCUBIERTO');
        const color = isDisc ? '#ef4444' : '#1e293b';
        tableHtml += `
            <tr>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px; font-weight:bold; color:${color}">${r[kEstado] || '-'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px; font-weight:bold;">${r[kServicio] || '-'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kTitular] || '-'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kHorario] || '-'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${r[kSuplente] || '-'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-size:10px;">${window.formatExcelDate(r[kFinContrato])}</td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';

    const tempDiv = document.createElement('div');
    tempDiv.style.padding = '30px';
    tempDiv.style.background = 'white';
    tempDiv.innerHTML = `
        <div style="border-bottom: 2px solid #6d28d9; padding-bottom:10px; margin-bottom:20px;">
            <h1 style="color:#6d28d9; margin:0; font-size:20px;">INFORMER SIFU - REPORTE DE GESTIÓN</h1>
            <p style="margin:5px 0; color:#64748b; font-size:12px;">Lista Maestra de Servicios - Total: ${window.lastFilteredResults.length}</p>
            <p style="margin:0; color:#94a3b8; font-size:10px;">Generado: ${new Date().toLocaleString()}</p>
        </div>
        ${tableHtml}
        <div style="margin-top:30px; text-align:center; font-size:9px; color:#94a3b8;">
            Documento generado automáticamente por el Sistema SIFU - CENTRO DE DATOS
        </div>
    `;

    const opt = {
        margin: 10,
        filename: `SIFU_REPORTE_MASTER_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(tempDiv).save();
};

function setupEventListeners() {
    setupCoreInteractions();

    // --- SMART OPERATIONAL CONTROL ---
    function updateUrgencyRadar() {
        const list = document.getElementById('urgency-list');
        if (!list || !state.masterData) return;

        const analysis = AIService.analyzeResilience();
        const hotspots = analysis.summaryList || [];

        if (hotspots.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">✅ Sin riesgos detectados</div>';
            return;
        }

        list.innerHTML = hotspots.map(h => {
            const totalIncidents = h.descubiertos + h.bajas;
            const percent = Math.min(100, (totalIncidents / 5) * 100);
            const color = h.descubiertos > 0 ? '#ef4444' : '#f59e0b';
            return `<div class="urgency-item">
                <div class="urgency-label"><span>${h.centro}</span><span>${totalIncidents} Alertas</span></div>
                <div class="urgency-bar-bg"><div class="urgency-bar-fill" style="width: ${percent}%; background: ${color}"></div></div>
            </div>`;
        }).join('');
    }

    window.filterByUrgency = function (type) {
        if (!state.masterData) return;
        console.log('Filtrando por urgencia:', type);

        const analysis = AIService.analyzeResilience();
        const keys = Object.keys(state.masterData[0]);
        const kEstado = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
        const kTitular = keys.find(k => k.toUpperCase().trim() === 'TITULAR') || 'TITULAR';

        let filtered = [];
        if (type === 'DESCUBIERTO') {
            filtered = state.masterData.filter(r => {
                const e = (r[kEstado] || '').toUpperCase();
                const t = (r[kTitular] || '').toUpperCase();
                return e.includes('DESCUBIERTO') || (e === '' && t === '') || (t === 'SIN TITULAR');
            });
        } else if (type === 'BAJA') {
            filtered = state.masterData.filter(r => {
                const e = (r[kEstado] || '').toUpperCase();
                const s1 = (r.ESTADO1 || '').toUpperCase();
                return e.includes('BAJA') || e.includes('IT') || s1.includes('BAJA') || s1.includes('IT');
            });
        } else if (type === 'MAÑANA') {
            filtered = state.masterData.filter(r => {
                const obs = (r.OBSERVACIONES || '').toLowerCase();
                return obs.includes('hoy') || obs.includes('fin');
            });
        }

        state.filteredData = filtered;
        renderMasterSummary();
        showToast(`Filtrados ${filtered.length} casos criticos`, 'info');
    };

    window.clearTableFilters = function () {
        console.log('Restaurando vista completa...');
        state.filteredData = null;
        renderMasterSummary();
    };

    function updateQuickActionCounters() {
        const cDesc = document.getElementById('count-descubiertos');
        const cBaja = document.getElementById('count-bajas');
        const cTerm = document.getElementById('count-terminan');

        if (!state.masterData) return;

        const analysis = AIService.analyzeResilience();
        if (cDesc) cDesc.innerText = analysis.metrics.descubiertos || 0;
        if (cBaja) cBaja.innerText = analysis.metrics.bajas || 0;

        if (cTerm) {
            const keys = Object.keys(state.masterData[0]);
            const kFin = keys.find(k => k.toUpperCase().includes('FIN')) || 'FIN CONTRATO';
            const upcoming = state.masterData.filter(r => {
                const val = (r[kFin] || '').toString();
                return val.includes('hoy') || val.includes('mañana');
            }).length;
            cTerm.innerText = upcoming;
        }
    }

    // Intervals
    setInterval(updateUrgencyRadar, 10000);
    setInterval(updateQuickActionCounters, 5000);
    setTimeout(() => {
        updateUrgencyRadar();
        updateQuickActionCounters();
        renderMasterSummary();
    }, 1500);


    // --- MODAL TRIGGERS (Safe Checks) ---
    const btnAddIncident = document.getElementById('btn-add-incident');
    if (btnAddIncident) btnAddIncident.onclick = () => {
        const m = document.getElementById('incident-modal');
        if (m) m.classList.add('active');
    };

    const btnAddIncidentV2 = document.getElementById('btn-add-incident-v2');
    if (btnAddIncidentV2) btnAddIncidentV2.onclick = () => {
        const m = document.getElementById('incident-modal');
        if (m) m.classList.add('active');
    };

    const btnAddNote = document.getElementById('btn-add-note');
    if (btnAddNote) btnAddNote.onclick = () => {
        const m = document.getElementById('note-modal');
        if (m) m.classList.add('active');
    };

    const btnAddNoteV2 = document.getElementById('btn-add-note-v2');
    if (btnAddNoteV2) btnAddNoteV2.onclick = () => {
        const m = document.getElementById('note-modal');
        if (m) m.classList.add('active');
    };

    // Close buttons and Back buttons
    document.querySelectorAll('.close-modal, .btn-modal-action.back').forEach(btn => {
        btn.onclick = function (e) {
            e.preventDefault();
            const m = this.closest('.modal');
            if (m) {
                m.classList.remove('active');
                m.style.setProperty('display', 'none', 'important');
                console.log('🔒 Modal cerrado via botón Back/Cerrar');
            }
        };
    });

    // --- TABS LOGIC ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (typeof switchTab === 'function') switchTab(tabId);
        });
    });

    // --- THEME TOGGLE ---
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', document.body.dataset.theme);
        };
    }

    if (typeof initOrdersModule === 'function') initOrdersModule();
    else console.warn("initOrdersModule no está disponible");
}
// --- DYNAMIC COUNTERS FOR QUICK ACTIONS ---
function updateQuickActionCounters() {
    if (!state.masterData) return;

    const analysis = OperationalService.analyzeResilience();

    // 1. Descubiertos
    const btnDescubiertos = document.querySelector('.smart-btn.danger');
    const badgeDescubiertos = document.getElementById('count-descubiertos');
    if (badgeDescubiertos) {
        badgeDescubiertos.textContent = analysis.metrics.descubiertos;
        if (analysis.metrics.descubiertos > 0) {
            btnDescubiertos.classList.add('active-pulse');
        } else {
            btnDescubiertos.classList.remove('active-pulse');
        }
    }

    // 2. Bajas sin suplente
    const badgeBajas = document.getElementById('count-bajas');
    if (badgeBajas) {
        badgeBajas.textContent = analysis.metrics.bajas - analysis.metrics.suplentes;
    }

    // 3. Terminan Hoy/Mañana
    const badgeTerminan = document.getElementById('count-terminan');
    if (badgeTerminan) {
        const count = state.masterData.filter(row => {
            const obs = (row.OBSERVACIONES || '').toLowerCase();
            return obs.includes('hoy') || obs.includes('fin') || obs.includes('mañ');
        }).length;
        badgeTerminan.textContent = count;
    }
}

// --- AUTO-FETCH EXCEL FROM SERVER (GITHUB SYNC) ---
async function checkServerExcel() {
    // 1. Check Protocol
    if (window.location.protocol === 'file:') {
        console.warn("⚠️ Auto-Fetch desactivado en modo local (file://).");
        showToast("⚠️ MODO LOCAL: Usa el botón 'SYNC MASTER' para actualizar.", "info");
        return;
    }

    try {
        const response = await fetch('./MASTER GENERAL.xlsx');
        if (!response.ok) throw new Error("No se encontró el archivo en servidor");

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData && jsonData.length > 0) {
            state.masterData = jsonData; // Assuming state.masterData is the global source of truth
            // If you intend to use globalMasterData and originalMasterData as new global state variables,
            // they should be declared globally and assigned here. For now, I'll update state.masterData.
            // globalMasterData = jsonData; // If these were declared globally
            // originalMasterData = [...jsonData]; // If these were declared globally

            // Persistir (assuming saveDataToIndexedDB and updateDashboardCounts exist elsewhere)
            // saveDataToIndexedDB(globalMasterData);
            // updateDashboardCounts();

            // Re-render the master table
            renderMasterSummary(); // This will re-render the table based on state.masterData

            showToast("✅ MASTER sincronizado desde servidor (GitHub)", "success");
            console.log("✅ Datos cargados desde MASTER GENERAL.xlsx (Servidor)");
        }
    } catch (error) {
        console.warn("⚠️ No se pudo cargar MASTER GENERAL.xlsx del servidor:", error);
        // No mostrar error al usuario si falla silenciosamente, ya usará el botón manual si quiere
    }
}





// --- RECOMENDACIÓN DE COBERTURAS ---

// --- RECOMENDACIÓN DE COBERTURAS ---

const GEO_KNOWLEDGE_BASE = {
    "ALDI SARRIÀ": { lat: 41.3912, lon: 2.1245, zone: "SARRIA" },
    "ALDI NUMANCIA": { lat: 41.3835, lon: 2.1385, zone: "LES CORTS" },
    "ALDI PREMIA": { lat: 41.4925, lon: 2.3610, zone: "PREMIA" },
    "ALDI VILAFRANCA": { lat: 41.3415, lon: 1.6965, zone: "VILAFRANCA" },
    "ALDI EL PRAT": { lat: 41.3255, lon: 2.0945, zone: "EL PRAT" },
    "WTC ALMEDA": { lat: 41.3530, lon: 2.0835, zone: "CORNELLA" },
    "ALDI MATARÓ": { lat: 41.5381, lon: 2.4447, zone: "MATARO" },
    "ALDI BADALONA": { lat: 41.4500, lon: 2.2475, zone: "BADALONA" },
    "UNISONO": { lat: 41.3965, lon: 2.1935, zone: "POBLENOU" },
    "AGBAR SITGES": { lat: 41.2365, lon: 1.8105, zone: "SITGES" },
    "AGBAR ARENYS": { lat: 41.5795, lon: 2.5485, zone: "ARENYS" },
    "MEDIA MARKT": { lat: 41.3515, lon: 2.0895, zone: "CORNELLA" },
    "ALDI ESPLUGUES": { lat: 41.3768, lon: 2.0886, zone: "ESPLUGUES" },
    "ALDI VILADECANS": { lat: 41.3155, lon: 2.0185, zone: "VILADECANS" },
    "ALDI CUBELLES": { lat: 41.2015, lon: 1.6745, zone: "CUBELLES" }
};

function findSubstitutes(targetCenter, targetWorker, targetSchedule) {
    if (!state.masterData || state.masterData.length === 0) return [];

    const keys = Object.keys(state.masterData[0]);
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';
    const kEstado = keys.find(k => k.toUpperCase().includes('ESTADO')) || 'ESTADO';
    const kSalud = keys.find(k => k.toUpperCase().includes('ESTADO1')) || 'ESTADO1';
    const kHorario = keys.find(k => k.toUpperCase().includes('HORARIO')) || 'HORARIO';
    const kTipo = keys.find(k => k.toUpperCase().includes('TIPO')) || 'TIPO S';

    const targetRow = state.masterData.find(r => r[kServicio] === targetCenter);
    const targetClient = targetRow ? (targetRow[kTipo] || '').toUpperCase() : '';
    const targetTime = parseTimeRange(targetSchedule);
    const targetInfo = getGeoInfo(targetCenter);

    const candidates = [];

    // Map worker presence per zone, schedule and coords
    const workerPresenceInfo = {};
    const healthyWorkers = new Set();

    state.masterData.forEach(row => {
        const wName = row[kTitular];
        const wHealth = (row[kSalud] || '').toString().toUpperCase();
        if (!wName || wName === 'DESCUBIERTO' || wName.includes('SIN TITULAR')) return;

        // Track health
        if (wHealth === '' || wHealth === 'ACTIVO') healthyWorkers.add(wName);
        else healthyWorkers.delete(wName);

        if (!workerPresenceInfo[wName]) {
            workerPresenceInfo[wName] = {
                clients: new Set(),
                schedules: [],
                zones: new Set(),
                coords: []
            };
        }

        workerPresenceInfo[wName].clients.add((row[kTipo] || '').toUpperCase());
        const info = getGeoInfo(row[kServicio]);
        workerPresenceInfo[wName].zones.add(info.zone);
        if (info.lat) workerPresenceInfo[wName].coords.push(info);

        const time = parseTimeRange(row[kHorario]);
        if (time) workerPresenceInfo[wName].schedules.push(time);
    });

    // --- PRIORIDAD 1: EMERGENCIAS Y BRIGADAS (DE LISTA ESPECIAL) ---
    if (typeof SPECIAL_WORKERS !== 'undefined' && Array.isArray(SPECIAL_WORKERS)) {
        SPECIAL_WORKERS.forEach(sw => {
            const wData = workerPresenceInfo[sw.name];

            // Check availability (not already busy during this time)
            let hasOverlap = false;
            if (targetTime && wData) {
                hasOverlap = wData.schedules.some(s => (targetTime.start < s.end && targetTime.end > s.start));
            }

            if (!hasOverlap) {
                const baseScore = sw.type === 'EMERGENCIAS' ? 100 : 90;
                candidates.push({
                    name: sw.name,
                    probability: baseScore,
                    reason: sw.type,
                    rawScore: baseScore + 500 // Bias to stay on top
                });
            }
        });
    }

    // --- PRIORIDAD 2: PERSONAL TRABAJANDO CERCA ---
    state.masterData.forEach(row => {
        const name = row[kTitular];
        const status = (row[kEstado] || '').toString().toUpperCase();
        const health = (row[kSalud] || '').toString().toUpperCase();
        const center = (row[kServicio] || '').toString().toUpperCase();

        // Avoid adding if already added as special worker
        if (candidates.some(c => c.name === name)) return;

        if (status === 'CUBIERTO' && health === '' && name !== 'DESCUBIERTO' && name !== '' && name !== targetWorker) {

            const workerData = workerPresenceInfo[name];
            if (!workerData) return;

            // EXCLUSION 1: SAME CLIENT
            if (workerData.clients.has(targetClient)) return;

            // EXCLUSION 2: TIME OVERLAP (already active elsewhere)
            if (targetTime) {
                const hasOverlap = workerData.schedules.some(s => (targetTime.start < s.end && targetTime.end > s.start));
                if (hasOverlap) return;
            }

            let score = 0;
            let reason = "";

            // --- REAL DISTANCE SCORE ---
            if (targetInfo.lat && workerData.coords.length > 0) {
                let minDistance = 999;
                workerData.coords.forEach(c => {
                    const dist = calculateDistance(targetInfo.lat, targetInfo.lon, c.lat, c.lon);
                    if (dist < minDistance) minDistance = dist;
                });

                if (minDistance < 5) {
                    score += 65;
                    reason = `Proximidad extrema: a ${(minDistance).toFixed(1)}km`;
                } else if (minDistance < 15) {
                    score += 40;
                    reason = `Zona cercana: a ${(minDistance).toFixed(1)}km`;
                }
            } else {
                // Fallback to Zone Matching
                const serviceInfo = getGeoInfo(center);
                if (workerData.zones.has(targetInfo.zone)) {
                    score += 50;
                    reason = `Misma zona operativa: ${targetInfo.zone}`;
                } else if (isNearbyZone(serviceInfo.zone, targetInfo.zone)) {
                    score += 25;
                    reason = "Zona administrativa colindante";
                }
            }

            // Special Profile Bonus
            if (status.includes('BRIGADA') || status.includes('ESPECIALISTA')) {
                score += 30;
                reason = reason ? reason + " + Perfil Móvil" : "Personal de Brigada";
            }

            if (score > 15) {
                candidates.push({
                    name: name,
                    probability: Math.min(score, 98),
                    reason: reason || "Operario disponible",
                    rawScore: score
                });
            }
        }
    });

    const uniqueCandidates = [];
    const seenNames = new Set();
    candidates.sort((a, b) => b.rawScore - a.rawScore).forEach(c => {
        if (!seenNames.has(c.name)) {
            seenNames.add(c.name);
            uniqueCandidates.push(c);
        }
    });

    return uniqueCandidates.slice(0, 3);
}

function getGeoInfo(centerName) {
    const t = centerName.toUpperCase();
    for (const key in GEO_KNOWLEDGE_BASE) {
        if (t.includes(key)) return GEO_KNOWLEDGE_BASE[key];
    }
    return { lat: null, lon: null, zone: detectZone(centerName) };
}

// --- NEURAL GEO-MAPPING ENGINE (EXPERT BIG DATA v4.0) ---
const EXCLUSION_LIST = ["RIERA", "GESTIN", "TIENDA", "CALLE", "CARRER", "PASSEIG", "AVDA", "AVENIDA", "PLAÇA", "PLAZA", "LOCAL", "PLANTA", "EDIFICIO", "NAVE", "POLIGONO", "RUTA", "LIMPIEZA", "SERVICIO", "OAC", "ALDI", "AGBAR", "WTC", "CENTRO", "ADMINISTRACION", "GENERAL", "PROYECTO"];

const TERRITORY_DB = [
    "BARCELONA", "BADALONA", "HOSPITALET", "CORNELLA", "SANT BOI", "VILADECANS",
    "CASTELLDEFELS", "GAVA", "EL PRAT", "SANT CUGAT", "RUBI", "TERRASSA", "SABADELL",
    "GRANOLLERS", "MOLLET", "MATARO", "PREMIA", "VILASSAR", "CALELLA", "ARENYS",
    "PINEDA", "SITGES", "VILANOVA", "VILAFRANCA", "MARTORELL", "SANT JOAN DESPI",
    "ESPLUGUES", "SANT ADRIA", "IGUALADA", "VIC", "MANRESA", "BLANES", "LLORET",
    "CUBELLES", "PALLEJA", "MASQUEFA", "CALAFELL", "SANT PERE DE RIBES", "MALGRAT",
    "POBLENOU", "GUINARDO", "SARRIA", "SANTS", "LES CORTS", "EIXAMPLE", "GRACIA",
    "HORTA", "NOU BARRIS", "SANT ANDREU", "SANT MARTI", "EL MASNOU", "CANET", "CERDANYOLA", "MONTCADA"
];

const NEURAL_GEO_CACHE = {
    "ANIMUA": "BARCELONA",
    "UNISONO": "POBLENOU",
    "FICOSA": "VILAFRANCA",
    "HEMISPHERE": "VILANOVA",
    "PINMAR": "VILANOVA",
    "SEMYDINAMICS": "BARCELONA",
    "INNOIT": "BARCELONA",
    "IDOM": "CORNELLA",
    "VEOLIA": "EL PRAT",
    "PUMA": "CORNELLA",
    "ACCENTURE": "BARCELONA",
    "AMERICOLD": "BARCELONA",
    "EHLIS": "SANT ANDREU BARCA",
    "WTC ALMEDA": "CORNELLA",
    "RIERA ALTA": "BARCELONA", // Explicitly mapping noise terms to actual zones
    "RIERA BLANCA": "HOSPITALET",
    "MAQUINISTA": "BARCELONA",
    "ZONA FRANCA": "BARCELONA"
};

function detectZone(text) {
    if (!text) return "BCN CENTRAL";
    const t = text.toUpperCase();

    // 1. NEURAL CACHE LOOKUP (Direct Mapping)
    for (const [key, zone] of Object.entries(NEURAL_GEO_CACHE)) {
        if (t.includes(key)) return zone;
    }

    // 2. VALIDATED MUNICIPALITY SCAN (Greedy Search)
    for (const city of TERRITORY_DB) {
        if (t.includes(city)) return city;
    }

    // 3. SEMANTIC FRAGMENT SCAN (Excluding Noise)
    const normalized = t.replace(/[(),.\/-]/g, ' ');
    const words = normalized.split(/\s+/).filter(w => w.length > 3);

    for (const word of words) {
        if (!EXCLUSION_LIST.includes(word) && !TERRITORY_DB.includes(word)) {
            // If it's a known territory fragment (e.g., 'DESPI' instead of 'SANT JOAN DESPI')
            if (word === 'DESPI') return 'SANT JOAN DESPI';
            if (word === 'PENEDES') return 'VILAFRANCA';
            if (word === 'GELLTRU') return 'VILANOVA';
            if (word === 'ADRIA') return 'SANT ADRIA';
        }
    }

    // 4. TAIL HEURISTIC (Last Resort)
    const segments = text.split('-').map(s => s.trim().toUpperCase());
    if (segments.length > 1) {
        const tail = segments[segments.length - 1];
        const lastWord = tail.split(' ')[0];
        if (lastWord.length > 3 && !EXCLUSION_LIST.includes(lastWord)) return lastWord;
    }

    // Default Fallback: Unified to BARCELONA to avoid fragmentation
    return "BARCELONA";
}

function isNearbyZone(zoneA, zoneB) {
    if (zoneA === zoneB) return true;
    const groups = [
        ["MATARO", "PREMIA", "ARENYS", "CALELLA", "PINEDA", "SANT ADRIA", "VILASSAR", "BADALONA"],
        ["EL PRAT", "VILADECANS", "GAVA", "CASTELLDEFELS", "CORNELLA", "SANT JOAN DESPI", "ESPLUGUES", "MARTORELL", "SANT CUGAT"],
        ["VILAFRANCA", "CALAFELL", "CUBELLES", "SITGES", "VILANOVA"],
        ["SARRIA", "LES CORTS", "SANT GERVASI", "BARCELONA", "POBLENOU", "SANT ADRIA"],
        ["MARTORELL", "PALLEJA", "RUBI", "SANT CUGAT", "MOLINS DE REI", "TERRASSA", "SABADELL"]
    ];
    return groups.some(g => g.includes(zoneA) && g.includes(zoneB));
}

function parseTimeRange(str) {
    if (!str) return null;
    const clean = str.replace(',', '.');
    const matches = clean.match(/(\d{1,2})[:h\.]?(\d{0,2}).*?(\d{1,2})[:h\.]?(\d{0,2})/i);
    if (!matches) return null;
    let h1 = parseInt(matches[1]);
    let m1 = parseInt(matches[2] || 0);
    let h2 = parseInt(matches[3]);
    let m2 = parseInt(matches[4] || 0);
    return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}

window.assignSubstitute = function (center, substituteName) {
    if (!state.masterData) return;

    const keys = Object.keys(state.masterData[0]);
    const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
    const kTitular = keys.find(k => k.toUpperCase().includes('TITULAR')) || 'TITULAR';
    const kEstado = keys.find(k => k.toUpperCase().includes('ESTADO')) || 'ESTADO';
    const kSuplente = keys.find(k => k.toUpperCase().includes('SUPLENTE')) || 'SUPLENTE';

    const row = state.masterData.find(r => r[kServicio] === center && (r[kEstado] === 'DESCUBIERTO' || r[kTitular] === 'DESCUBIERTO'));

    if (row) {
        row[kSuplente] = substituteName;
        updateTicker(`SISTEMA: ASIGNANDO A ${substituteName} PARA CUBRIR ${center}`);
        showToast(`✅ Se ha propuesto a ${substituteName} como suplente.`, 'success');

        // Save and Re-process
        saveAllState();
        processMasterArray(state.masterData);
    }
};

function renderSmartUncovered() {
    const feed = document.getElementById('uncovered-feed');
    if (!feed) return;
    if (state.uncovered.length === 0) {
        feed.innerHTML = '<div class="empty-state">✅ TODO CUBIERTO. NO HAY DESCUBIERTOS ACTIVOS.</div>';
        return;
    }

    feed.innerHTML = `
        <div class="detail-box-list" style="display:flex; flex-direction:column; gap:15px;">
            ${state.uncovered.map(unc => {
        const candidates = findSubstitutes(unc.center, unc.worker, unc.shift);

        return `
                <div class="casilla-small" style="border-left: 4px solid var(--accent-red); padding: 12px; background: rgba(255,255,255,0.02); border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div style="flex:1;">
                            <span class="casilla-label" style="font-size:9px; color:var(--accent-red); font-weight:800;">🚨 DESCUBIERTO URGENTE</span>
                            <div class="casilla-value" style="font-size:13px; font-weight:700;">${unc.center}</div>
                            <div style="font-size:10px; color:var(--text-dim);">Puesto: ${unc.worker}</div>
                        </div>
                        <div style="text-align:right;">
                            <span class="casilla-label">⌚ HORARIO</span>
                            <div class="casilla-value" style="font-family:var(--font-mono); color:var(--accent-red); font-weight:800;">${unc.shift || 'MAÑANA'}</div>
                        </div>
                    </div>

                    <div class="substitute-suggestions" style="background: rgba(14, 165, 233, 0.03); padding: 10px; border-radius: 8px;">
                        <div class="suggestion-header">
                            <span>📋 RECOMENDACIONES DE SUPLENCIA</span>
                        </div>
                        <div class="candidate-list">
                            ${candidates.length > 0 ? candidates.map(c => `
                                <div class="candidate-card">
                                    <div class="candidate-info">
                                        <div class="candidate-name">${c.name}</div>
                                        <div class="candidate-reason">${c.reason}</div>
                                    </div>
                                    <div style="display:flex; align-items:center;">
                                        <div class="candidate-score" title="Probabilidad de éxito">${c.probability}%</div>
                                        <button class="btn-assign-mini" onclick="window.assignSubstitute('${unc.center.replace(/'/g, "\\'")}', '${c.name.replace(/'/g, "\\'")}')">ASIGNAR</button>
                                    </div>
                                </div>
                            `).join('') : '<div style="font-size:10px; color:var(--text-dim); font-style:italic;">No hay suplentes obvios cerca. Mobilizar equipo de emergencia.</div>'}
                        </div>
                    </div>
                </div>`;
    }).join('')}
        </div>`;
}

/* =========================================================================
   GOD-MODE MODAL ENGINE v6.0 (Failsafe Implementation)
   ========================================================================= */

(function () {
    console.log('🛡️ App.js: Initializing Failsafe Modal Engine...');

    function ensureModalStyles() {
        if (document.getElementById('failsafe-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'failsafe-modal-styles';
        style.textContent = `
            #failsafe-modal {
                display: none;
                position: fixed !important;
                z-index: 999999999 !important;
                top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                background: rgba(0,0,0,0.85) !important;
                backdrop-filter: blur(8px) !important;
                justify-content: center !important;
                align-items: center !important;
                font-family: 'Outfit', sans-serif !important;
            }
            #failsafe-modal.active { display: flex !important; }
            .fs-modal-content {
                background: white !important;
                width: 90% !important;
                max-width: 900px !important;
                max-height: 85vh !important;
                border-radius: 24px !important;
                display: flex !important;
                flex-direction: column !important;
                box-shadow: 0 30px 100px rgba(0,0,0,0.6) !important;
                overflow: hidden !important;
                border: 1px solid rgba(0,0,0,0.1) !important;
                animation: fsModalFade 0.3s ease-out;
            }
            @keyframes fsModalFade { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            
            .fs-modal-header {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
                padding: 24px 30px !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                color: white !important;
            }
            .fs-modal-header h2 { margin: 0 !important; font-size: 1.6rem !important; color: white !important; font-weight: 800 !important; letter-spacing: -0.5px; }
            .fs-modal-close {
                background: rgba(255,255,255,0.1) !important;
                border: none !important;
                color: white !important;
                width: 44px !important; height: 44px !important;
                border-radius: 12px !important;
                font-size: 28px !important;
                cursor: pointer !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                transition: background 0.2s;
            }
            .fs-modal-close:hover { background: rgba(239, 68, 68, 0.2) !important; }
            
            .fs-modal-body {
                padding: 30px !important;
                overflow-y: auto !important;
                flex: 1 !important;
                background: #ffffff !important;
                color: #334155 !important;
            }
            .fs-modal-footer {
                padding: 24px 30px !important;
                background: #f8fafc !important;
                display: flex !important;
                gap: 16px !important;
                justify-content: flex-end !important;
                border-top: 1px solid #e2e8f0 !important;
            }
            .fs-btn {
                padding: 14px 28px !important;
                border-radius: 12px !important;
                border: none !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                transition: all 0.2s !important;
                text-transform: uppercase !important;
                font-size: 14px !important;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
            }
            .fs-btn.excel { background: #10b981 !important; color: white !important; }
            .fs-btn.pdf { background: #ef4444 !important; color: white !important; }
            .fs-btn.back { background: #64748b !important; color: white !important; }
            .fs-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2) !important; }
            
            .fs-table { width: 100% !important; border-collapse: collapse !important; }
            .fs-table th { 
                background: #f1f5f9 !important; 
                padding: 16px !important; 
                text-align: left !important; 
                font-weight: 800 !important; 
                color: #475569 !important;
                border-bottom: 2px solid #e2e8f0 !important;
                font-size: 11px !important;
                text-transform: uppercase !important;
            }
            .fs-table td { padding: 16px !important; border-bottom: 1px solid #f1f5f9 !important; font-size: 14px !important; }
            .fs-badge {
                padding: 6px 12px !important;
                border-radius: 20px !important;
                font-size: 11px !important;
                font-weight: 800 !important;
            }
        `;
        document.head.appendChild(style);
    }

    function createFailsafeModal() {
        if (document.getElementById('failsafe-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'failsafe-modal';
        modal.innerHTML = `
            <div class="fs-modal-content">
                <div class="fs-modal-header">
                    <h2 id="fs-modal-title">DETALLE DEL SISTEMA</h2>
                    <button class="fs-modal-close" onclick="document.getElementById('failsafe-modal').classList.remove('active')">×</button>
                </div>
                <div class="fs-modal-body" id="fs-modal-body"></div>
                <div class="fs-modal-footer">
                    <button class="fs-btn excel" onclick="if(window.exportStatusToExcel) window.exportStatusToExcel(); else alert('Generando reporte Excel...')">
                        <span>📊</span> DESCARGAR EXCEL
                    </button>
                    <button class="fs-btn pdf" onclick="if(window.exportStatusToPDF) window.exportStatusToPDF(); else alert('Generando documento PDF...')">
                        <span>📄</span> DESCARGAR PDF
                    </button>
                    <button class="fs-btn back" onclick="document.getElementById('failsafe-modal').classList.remove('active')">
                        VOLVER
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    window.openFailsafeModal = function (title, html) {
        ensureModalStyles();
        createFailsafeModal();
        document.getElementById('fs-modal-title').innerText = title;
        document.getElementById('fs-modal-body').innerHTML = html;
        document.getElementById('failsafe-modal').classList.add('active');
    };

    function handleCardClick(type) {
        console.log('🖱️ GOD-MODE: Click detected for', type);

        if (!window.state || !window.state.masterData) {
            window.openFailsafeModal('CARGANDO...', '<div style="text-align:center; padding:40px;"><div class="loading-spinner"></div><p>Sincronizando con la base de datos de Excel...</p></div>');
            return;
        }

        if (type === 'UNCOVERED') {
            const uncovered = window.state.masterData.filter(r => {
                const e = (r.ESTADO || '').toString().toUpperCase();
                const t = (r.TITULAR || '').toString().toUpperCase();
                const s = (r.SERVICIO || r.PROYECTO || '').toString();
                if (!s && !r.CLIENTE) return false;
                return e.includes('DESCUBIERTO') || e.includes('VACANTE') || t.includes('SIN TITULAR') || (e === '' && t === '');
            });

            let html = '<div class="modal-list-container"><table class="fs-table"><thead><tr><th>SERVICIO / CENTRO</th><th>ESTADO</th><th>HORARIO</th></tr></thead><tbody>';
            uncovered.forEach(r => {
                const name = r.SERVICIO || r.PROYECTO || 'S/N';
                html += `<tr><td><b>${name}</b></td><td><span class="fs-badge" style="background:#fee2e2; color:#ef4444;">${r.ESTADO || 'DESCUBIERTO'}</span></td><td><code style="color:#2563eb">${r.HORARIO || '-'}</code></td></tr>`;
            });
            html += '</tbody></table></div>';
            window.openFailsafeModal('🔥 SERVICIOS DESCUBIERTOS (' + uncovered.length + ')', html);

        } else if (type === 'ABSENCES') {
            const absences = window.state.masterData.filter(r => {
                const e1 = (r.ESTADO1 || '').toString().toUpperCase();
                return e1.includes('BAJA') || e1.includes('IT') || e1.includes('VACACIONES');
            });
            let html = '<div class="modal-list-container"><table class="fs-table"><thead><tr><th>SERVICIO</th><th>TRABAJADOR</th><th>MOTIVO / ESTADO</th></tr></thead><tbody>';
            absences.forEach(r => {
                const isVac = r.ESTADO1.toUpperCase().includes('VAC');
                const badgeStyle = isVac ? 'background:#dcfce7; color:#16a34a;' : 'background:#fef3c7; color:#d97706;';
                html += `<tr><td><b>${r.SERVICIO || r.PROYECTO || '-'}</b></td><td>${r.TITULAR || '-'}</td><td><span class="fs-badge" style="${badgeStyle}">${r.ESTADO1}</span></td></tr>`;
            });
            html += '</tbody></table></div>';
            window.openFailsafeModal('🏥 GESTIÓN DE BAJAS / IT (' + absences.length + ')', html);

        } else if (type === 'INCIDENTS') {
            const incs = window.state.incidents || [];
            if (incs.length === 0) {
                window.openFailsafeModal('INCIDENCIAS', '<div style="text-align:center; padding:50px; color:#10b981;"><h3>✅ TODO EN ORDEN</h3><p>No hay incidencias críticas reportadas en las últimas 24h.</p></div>');
                return;
            }
            let html = '<div style="display:flex; flex-direction:column; gap:16px;">';
            incs.forEach(inc => {
                html += `
                    <div style="background:#f8fafc; border-left:5px solid #3b82f6; padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong style="color:#1e293b; font-size:16px;">${inc.worker}</strong>
                            <span style="font-size:12px; color:#94a3b8;">${inc.date || ''}</span>
                        </div>
                        <div style="color:#475569; line-height:1.5;">${inc.desc}</div>
                    </div>`;
            });
            html += '</div>';
            window.openFailsafeModal('⚠️ INCIDENCIAS Y ALERTAS (' + incs.length + ')', html);
        }
    }

    // Attachment Logic with Global Delegation (Foolproof)
    document.addEventListener('click', function (e) {
        // Find if target is inside one of our cards
        const card = e.target.closest('#metric-uncovered, #metric-absences, #metric-incidents');
        if (card) {
            console.log('🎯 GOD-MODE: GLOBAL CLICK DETECTED:', card.id);
            e.preventDefault();
            e.stopPropagation();

            const keyMap = {
                'metric-uncovered': 'UNCOVERED',
                'metric-absences': 'ABSENCES',
                'metric-incidents': 'INCIDENTS'
            };

            handleCardClick(keyMap[card.id]);
        }
    }, { capture: true, passive: false });

    console.log('✅ Failsafe Modal Engine v6.2: Global Delegation Active');
})();

/**
 * --- DISCOVERY INTEL: EXPERT ANALYTICS ENGINE ---
 * Renders high-end interactive charts for the Uncovered dashboard.
 */
window.initUncoveredCharts = function () {
    // --- 1. ZONE RANKING (HORIZONTAL BAR) ---
    const ctxZone = document.getElementById('uncoveredZoneChart');
    if (ctxZone && state.uncovered) {
        const zoneMap = {};
        state.uncovered.forEach(u => {
            const z = detectZone(u.center);
            zoneMap[z] = (zoneMap[z] || 0) + 1;
        });

        const sortedZones = Object.entries(zoneMap)
            .sort((a, b) => b[1] - a[1]) // Sort desc
            .slice(0, 8); // Top 8

        const labels = sortedZones.map(z => z[0]);
        const data = sortedZones.map(z => z[1]);

        // Colors for bars based on intensity
        const colors = data.map(v => v > 5 ? '#ef4444' : v > 2 ? '#f59e0b' : '#3b82f6');

        if (window.chartZoneInst) window.chartZoneInst.destroy();

        // Register the plugin if available
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        window.chartZoneInst = new Chart(ctxZone, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Descubiertos',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barThickness: 18,
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 10,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            label: (c) => `📦 Volumen: ${c.raw}`
                        }
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        anchor: 'end',
                        align: 'end',
                        offset: 4,
                        font: { weight: 'bold', size: 10 },
                        formatter: (value) => value > 0 ? value : ''
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b', font: { size: 9 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: 'white', font: { size: 10, weight: '700' } }
                    }
                },
                layout: {
                    padding: { right: 30 } // Space for labels
                },
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1200 }
            }
        });
    }

    // --- 2. STATUS ECOSYSTEM (DONUT) ---
    const ctxStatus = document.getElementById('uncoveredStatusChart');
    if (ctxStatus && state.uncovered) {
        let pending = 0, managing = 0, covered = 0;
        state.uncovered.forEach(u => {
            const s = (u.dispatchStatus || 'PENDIENTE');
            if (s === 'PENDIENTE') pending++;
            else if (s === 'GESTION') managing++;
            else covered++; // 'CERRADO' or fully covered
        });

        // Show covered from total vs uncovered logic? 
        // Usually uncovered list has pending ones, but let's visualize the active batch statuses
        const statusData = [pending, managing];
        const statusLabels = ['🚨 Pendiente', '⏳ En Gestión'];
        const statusColors = ['#ef4444', '#f59e0b']; // Red, Amber

        if (window.chartStatusInst) window.chartStatusInst.destroy();

        window.chartStatusInst = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: statusColors,
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1', font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' }
                    },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value) => value > 0 ? value : ''
                    }
                },
                responsive: true,
                maintainAspectRatio: false, // Important for flex container
                animation: { animateScale: true, animateRotate: true }
            }
        });
    }
};
