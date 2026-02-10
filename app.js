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

const DEFAULT_STATE = {
    incidents: [],
    absences: [],
    uncovered: [],
    orders: [],
    glassPlanning: [],
    stats: { activeWorkers: 24 },
    notes: [],
    masterData: [],
    filterType: null
};

const ATOMIC_STATE_KEY = 'sifu_universal_state_v5';
let state = { ...DEFAULT_STATE };

function loadGlobalState() {
    try {
        console.log('🔍 Intentando cargar estado guardado...');
        const saved = localStorage.getItem(ATOMIC_STATE_KEY);

        if (saved) {
            console.log('✅ Datos encontrados en localStorage, tamaño:', saved.length, 'caracteres');
            const parsed = JSON.parse(saved);
            console.log('✅ Datos parseados correctamente:', {
                incidents: parsed.incidents?.length || 0,
                notes: parsed.notes?.length || 0,
                masterData: parsed.masterData?.length || 0
            });

            // Asignar directamente el estado parseado (con fallback a defaults)
            state = {
                incidents: parsed.incidents || [],
                absences: parsed.absences || [],
                uncovered: parsed.uncovered || [],
                orders: parsed.orders || [],
                glassPlanning: parsed.glassPlanning || [],
                stats: parsed.stats || { activeWorkers: 24 },
                notes: parsed.notes || [],
                masterData: parsed.masterData || [],
                filterType: parsed.filterType || null
            };

            console.log('✅ Estado cargado exitosamente desde localStorage');
            return true;
        } else {
            console.log('⚠️ No hay datos en localStorage, intentando IndexedDB...');
            // Intentar cargar desde IndexedDB de forma asíncrona
            loadStateFromIndexedDB().then(data => {
                if (data) {
                    state = {
                        incidents: data.incidents || [],
                        absences: data.absences || [],
                        uncovered: data.uncovered || [],
                        orders: data.orders || [],
                        glassPlanning: data.glassPlanning || [],
                        stats: data.stats || { activeWorkers: 24 },
                        notes: data.notes || [],
                        masterData: data.masterData || [],
                        filterType: data.filterType || null
                    };
                    console.log('✅ Estado cargado desde IndexedDB');
                    renderAll();
                }
            });
        }
    } catch (e) {
        console.error('❌ Error cargando estado:', e);
        // Intentar IndexedDB como último recurso
        loadStateFromIndexedDB().then(data => {
            if (data) {
                state = data;
                renderAll();
            }
        });
    }
    return false;
}

// SISTEMA DE GUARDADO CONSOLIDADO Y ROBUSTO
let saveTimeout = null;
let hasUnsavedChanges = false;

function saveAllState() {
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

let incidentsChart = null;
let trendsChart = null;

// Selectors
const incidentFeed = document.getElementById('incidents-feed');
const notesFeed = document.getElementById('notes-feed');
const dateEl = document.getElementById('current-date');
const tickerEl = document.getElementById('live-ticker-text');
const globalSearch = document.getElementById('global-search-input');
const quickInput = document.getElementById('quick-input-bar');

// Headers Stats
const hIncidents = document.getElementById('h-stat-incidents');
const hActive = document.getElementById('h-stat-active');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    initCharts();

    // 1. CARGA ATÓMICA DE DATOS (ORDEN CORREGIDO)
    // Primero intentamos cargar datos guardados
    const wasLoaded = loadGlobalState();

    // Si NO se cargó nada, entonces usamos valores por defecto
    if (!wasLoaded) {
        console.log('No hay datos guardados, usando estado por defecto');
        state = { ...DEFAULT_STATE };
    }

    const lastSync = localStorage.getItem('sifu_last_sync');
    if (lastSync) {
        const syncEl = document.getElementById('last-sync-time');
        if (syncEl) syncEl.textContent = `ÚLTIMA SYNC: ${lastSync}`;
    }

    // 2. LÓGICA DE FALLBACK:
    // Solo cargamos el archivo estático si no hay NADA en la memoria atómica
    if (!wasLoaded && typeof INITIAL_MASTER_DATA !== 'undefined' && INITIAL_MASTER_DATA.length > 0) {
        console.log("Cargando datos iniciales (Primera vez)");
        processMasterArray(INITIAL_MASTER_DATA);
        updateTicker("SISTEMA: DATOS CARGADOS DESDE ARCHIVO INICIAL");
    } else if (wasLoaded) {
        console.log("Sincronizando vistas con datos recuperados...");
        renderAll();
        updateTicker("SISTEMA: DATOS RECUPERADOS CON ÉXITO");
    } else {
        // Si no se cargó nada y no hay datos iniciales, simplemente renderiza el estado por defecto (vacío)
        renderAll();
        updateTicker("SISTEMA: INICIADO CON ESTADO VACÍO");
    }

    setupEventListeners();
    startTicker();
    initVoiceCommand();

    // AUTO-GUARDADO PERIÓDICO (cada 3 segundos)
    setInterval(() => {
        if (hasUnsavedChanges) {
            saveAllState();
            console.log('Auto-guardado ejecutado');
        }
    }, 3000);

    // Inicializar indicador de guardado
    initSaveIndicator();
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

function setupEventListeners() {
    const fab = document.getElementById('main-fab');
    const fabMenu = document.getElementById('fab-menu');
    if (fab) {
        fab.onclick = () => {
            fab.classList.toggle('active');
            if (fabMenu) fabMenu.classList.toggle('active');
        };
    }

    // Add Drag & Drop for Absences Reordering
    const absenceFeed = document.getElementById('absences-feed');
    if (absenceFeed) {
        absenceFeed.addEventListener('dragstart', handleDragStart);
        absenceFeed.addEventListener('dragover', handleDragOver);
        absenceFeed.addEventListener('drop', handleDrop);
        absenceFeed.addEventListener('dragend', handleDragEnd);
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
            // 1. PUTA CRÍTICA: Si hay un handle pendiente de reconexión, usuarlo DIRECTAMENTE.
            if (window.pendingResumeHandle) {
                try {
                    // Solicitar permiso RW (Lectura/Escritura) sobre el handle existente
                    const options = { mode: 'readwrite' };
                    if ((await window.pendingResumeHandle.queryPermission(options)) !== 'granted') {
                        if ((await window.pendingResumeHandle.requestPermission(options)) !== 'granted') {
                            alert("Se requieren permisos para automatizar la sincronización.");
                            return;
                        }
                    }
                    // Reactivar Watchdog con el handle recuperado
                    activateMasterLiveWatch(window.pendingResumeHandle);
                    window.pendingResumeHandle = null; // Consumir handle
                    return;
                } catch (err) {
                    console.error("Error al reanudar handle:", err);
                    updateTicker("⚠️ ERROR AL REANUDAR. SELECCIONE ARCHIVO DE NUEVO.");
                }
            }

            // 2. Flujo normal (Primera vez)
            if (window.showOpenFilePicker) {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [{
                            description: 'Excel Master',
                            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'] }
                        }],
                        multiple: false
                    });

                    if (handle) {
                        activateMasterLiveWatch(handle);
                    }
                } catch (err) {
                    // Fallback silencioso si cancela
                }
            } else {
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

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        };
    });

    const incForm = document.getElementById('incident-form');
    if (incForm) {
        incForm.onsubmit = (e) => {
            e.preventDefault();
            const type = document.getElementById('incident-type').value;
            const worker = document.getElementById('worker-name').value;
            const priority = document.querySelector('input[name="priority"]:checked').value;
            const manualDate = document.getElementById('incident-date').value;
            const manualTime = document.getElementById('incident-time').value;
            const now = new Date();
            const finalDate = manualDate || now.toLocaleDateString('es-ES');
            const finalTime = manualTime || now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            const newIncident = {
                id: Date.now(),
                worker: worker,
                type: type,
                priority: priority,
                desc: document.getElementById('incident-desc').value,
                time: finalTime,
                date: finalDate,
                reported: false
            };
            state.incidents.unshift(newIncident);
            markUnsavedChanges();
            saveAndRender();
            updateTicker(`SISTEMA: INCIDENCIA REGISTRADA (${worker})`);
            e.target.reset();
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        };
    }


    if (noteForm) {
        noteForm.onsubmit = (e) => {
            e.preventDefault();
            const text = document.getElementById('note-text').value;
            if (!text.trim()) return;

            const newNote = {
                id: Date.now(),
                text: text,
                tag: 'INFO', // Default tag
                date: new Date().toLocaleDateString('es-ES'),
                completed: false
            };
            state.notes.unshift(newNote);
            markUnsavedChanges();
            saveAndRender();
            updateTicker("SISTEMA: TAREA AÑADIDA A LA AGENDA");
            e.target.reset();
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        };
    }

    if (globalSearch) {
        globalSearch.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log("Buscando incidencias: ", globalSearch.value);
                renderIncidents(globalSearch.value.toLowerCase().trim());
                showToast("Búsqueda global ejecutada", "success");
            }
        };
        globalSearch.oninput = (e) => renderIncidents(e.target.value.toLowerCase());
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

    // Drag & Drop Sync
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.body.style.border = '2px dashed var(--sifu-blue)';
        document.body.style.backgroundColor = 'rgba(14, 165, 233, 0.05)';
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        document.body.style.border = 'none';
        document.body.style.backgroundColor = '';
    });

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
    window.liveWatchActive = true;

    // Guardar para futuros arranques
    await saveHandle(handle);

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
                    updateTicker("SISTEMA: ACTUALIZACIÓN RECIBIDA DE EXCEL");
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
    if (!rawData || rawData.length === 0) {
        updateTicker("⚠️ ALERTA: EXCEL LEÍDO PERO SIN DATOS");
        return;
    }
    state.masterData = rawData;

    const newAbsences = [];
    const newUncovered = [];
    // Detección Dinámica de Columnas (Smart Key Mapping)
    if (!rawData.length) return;
    const keys = Object.keys(rawData[0]);

    // Función auxiliar para encontrar la mejor clave coincidente
    const findKey = (search) => keys.find(k => k.toUpperCase().trim() === search || k.toUpperCase().includes(search));

    const keyServicio = findKey('SERVICIO') || 'SERVICIO';
    const keyTitular = findKey('TITULAR') || 'TITULAR';
    const keyEstado = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
    const keyEstadoSalud = keys.find(k => k.toUpperCase().includes('ESTADO') && k !== keyEstado) || keys.find(k => k.toUpperCase().includes('BAJA')) || 'ESTADO.1';
    const keySuplente = findKey('SUPLENTE') || 'SUPLENTE';
    const keyHorario = findKey('HORARIO') || 'HORARIO';

    rawData.forEach((row, index) => {
        const servicio = row[keyServicio] || 'CENTRO DESCONOCIDO';
        const titular = row[keyTitular] || '';
        const estadoSalud = row[keyEstadoSalud] || '';
        const estadoCobertura = row[keyEstado] || '';
        const suplente = row[keySuplente] || '';
        const horario = row[keyHorario] || '';

        const estadoUpper = estadoCobertura ? estadoCobertura.toString().toUpperCase() : '';
        const titularUpper = titular ? titular.toString().toUpperCase() : '';
        const saludUpper = estadoSalud ? estadoSalud.toString().toUpperCase() : '';

        // 1. GESTIÓN DE AUSENCIAS (Detectando Bajas, IT, Vacaciones)
        if (saludUpper && (saludUpper.includes('BAJA') || saludUpper.includes('IT') || saludUpper.includes('VACACIONES'))) {
            newAbsences.push({
                id: Date.now() + index,
                worker: titular || 'TITULAR NO ASIGNADO',
                center: servicio,
                shift: horario || 'CONSULTAR EXCEL',
                reason: estadoSalud,
                suggestedSubstitute: suplente || 'PENDIENTE ASIGNAR'
            });
        }

        // 2. LÓGICA DE DESCUBIERTOS INTELIGENTE
        const isSpecialService = estadoUpper.includes('BRIGADA') ||
            titularUpper.includes('RUTA CRISTALES') ||
            estadoUpper.includes('OBRAS') ||
            estadoUpper.includes('CERRADO');

        const isDescubierto = estadoUpper.includes('DESCUBIERTO') ||
            (estadoUpper === '' && titularUpper === '') ||
            (titularUpper === 'SIN TITULAR');

        if (isDescubierto && !isSpecialService) {
            newUncovered.push({
                id: Date.now() + index + 1000,
                center: servicio,
                worker: titular || 'DESCUBIERTO',
                shift: horario || 'CONSULTAR HORARIO',
                startTime: horario ? (horario.split('DE')[0] || 'URGENTE') : 'URGENTE',
                risk: true
            });
        }
    });

    state.absences = newAbsences;
    state.uncovered = newUncovered;
    saveAllState();

    // Al cargar nuevos datos, forzamos repoblación del sistema dinámico
    hasInitializedFilters = false; // Permitir re-detección inteligente de columnas
    renderFilterChips();
    renderAll();

    updateTicker(`${rawData.length} SERVICIOS ANALIZADOS [SISTEMA OK]`);
}

// FUNCIÓN ELIMINADA - Ahora usamos la versión consolidada arriba (línea ~54)

function saveAndRender() {
    saveAllState();
    const lastSyncEl = document.getElementById('last-sync-time');
    if (lastSyncEl) lastSyncEl.textContent = `ÚLTIMA SYNC: ${localStorage.getItem('sifu_last_sync')}`;
    renderAll();
}

function renderAll() {
    renderPriorityPanel();
    renderMasterSummary();
    renderAbsences();
    renderUncovered();
    renderOrders();
    renderIncidents();
    renderNotes();
    updateHeaderStats();
    updateCharts();
    updateSisPredict();
    updateInsights();
    updateAnalytics();
    updateEmergencyPopup();
}

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

function renderAbsences() {
    const feed = document.getElementById('absences-feed');
    if (!feed) return;
    if (state.absences.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN AUSENCIAS REGISTRADAS</div>';
        return;
    }
    feed.innerHTML = `<div class="detail-box-list">
        ${state.absences.map((abs, index) => {
        const colorClass = `casilla-c${(index % 6) + 1}`;
        return `
            <div class="casilla-small draggable ${colorClass}" draggable="true" data-id="${abs.id}" data-index="${index}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <div style="flex:1.2;">
                        <span class="casilla-label">📍 Servicio / Titular</span>
                        <div class="casilla-value" contenteditable="true" onblur="updateAbsenceField(${abs.id}, 'center', this.innerText)">${abs.center} / <b>${abs.worker}</b></div>
                    </div>
                    <div style="flex:0.8; text-align:right;">
                        <span class="casilla-label">⏰ Horario</span>
                        <div class="casilla-value" style="font-family:var(--font-mono); color:var(--sifu-blue);">${abs.shift || '--:--'}</div>
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px; margin-top:4px;">
                    <div style="flex:0.6;">
                        <span class="badge red" style="font-size:8px; padding:1px 4px;">🏥 ${abs.reason}</span>
                    </div>
                    <div style="flex:1; text-align:right;">
                        <span class="casilla-label">🔄 Reemplazo:</span>
                        <span class="casilla-value" contenteditable="true" onblur="updateAbsenceField(${abs.id}, 'suggestedSubstitute', this.innerText)" style="color:#d32f2f; margin-left:4px;">${abs.suggestedSubstitute}</span>
                    </div>
                </div>
            </div>
            `;
    }).join('')}
    </div>`;
}

// Drag & Drop Handlers
let draggedItem = null;

function handleDragStart(e) {
    if (e.target.classList.contains('casilla-small')) {
        draggedItem = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.casilla-small');
    if (target && target !== draggedItem) {
        const feed = document.getElementById('absences-feed');
        const items = [...feed.querySelectorAll('.casilla-small')];
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(target.dataset.index);

        // Update state
        const [movedItem] = state.absences.splice(fromIndex, 1);
        state.absences.splice(toIndex, 0, movedItem);

        markUnsavedChanges();
        saveAndRender();
    }
}

function handleDragEnd(e) {
    if (draggedItem) draggedItem.classList.remove('dragging');
    draggedItem = null;
}

// Edit Handler
window.updateAbsenceField = (id, field, value) => {
    const abs = state.absences.find(a => a.id === id);
    if (abs && abs[field] !== value) {
        abs[field] = value;
        markUnsavedChanges();
        // Guardar en estado atómico completo
        saveAllState();
        updateTicker(`DATO ACTUALIZADO: ${field.toUpperCase()}`);
    }
};

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

function renderUncovered() {
    const feed = document.getElementById('uncovered-feed');
    if (!feed) return;
    if (state.uncovered.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN DATOS DE DESCUBIERTOS</div>';
        return;
    }
    feed.innerHTML = `<div class="detail-box-list">
        ${state.uncovered.map(unc => `
            <div class="casilla-small" style="border-left: 3px solid var(--accent-red); padding: 6px 10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1;">
                        <span class="casilla-label">ðŸ¢ Servicio / Titular</span>
                        <div class="casilla-value" style="font-size:11px;">${unc.center} / <b>${unc.worker}</b></div>
                    </div>
                    <div style="text-align:right; flex:0.5;">
                        <span class="casilla-label">â° Horario</span>
                        <div class="casilla-value" style="font-family:var(--font-mono); color:var(--accent-red);">${unc.shift || '--:--'}</div>
                    </div>
                </div>
                <div class="risk-meter-mini" style="width:100%; height:2px; background:#f1f3f4; border-radius:2px; margin-top:6px; overflow:hidden;">
                    <div style="width:100%; height:100%; background:var(--accent-red); animation: pulse-red 2s infinite;"></div>
                </div>
            </div>`).join('')}
    </div>`;
}

function renderOrders() {
    const feed = document.getElementById('orders-feed');
    if (!feed) return;
    if (state.orders.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN PEDIDOS ACTIVOS</div>';
        return;
    }
    feed.innerHTML = `<div class="detail-box-list">
        ${state.orders.map(order => `
            <div class="casilla-small" style="border-left: 3px solid var(--sifu-blue);">
                <div style="display:flex; justify-content:space-between;">
                    <div>
                        <span class="casilla-label">ðŸ“¦ Material / Centro</span>
                        <div class="casilla-value">${order.material} / <b>${order.center}</b></div>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge ${order.status === 'PENDIENTE' ? 'amber' : 'green'}">${order.status}</span>
                    </div>
                </div>
            </div>`).join('')}
    </div>`;
}

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

// 2. Rendering Implementation (Requested Columns: SERVICIO, TITULAR, HORARIO, ESTADO, SUPLENTE)
function renderMasterSummary() {
    const feed = document.getElementById('master-summary-feed');
    const countEl = document.getElementById('master-count');
    const searchInput = document.getElementById('master-search-input');
    const statsContainer = document.getElementById('master-stats-summary');

    if (!feed) return;
    if (!state.masterData || state.masterData.length === 0) {
        feed.innerHTML = '<div class="empty-state">SIN DATOS MASTER CARGADOS.</div>';
        if (countEl) countEl.textContent = '0';
        return;
    }

    // Initialize Default Filters (First Run Only)
    if (!hasInitializedFilters) {
        // User didn't specify default filters, but let's default to ESTADO and SUPLENTE as they are key
        const keys = Object.keys(state.masterData[0]);
        // Try to find intelligent defaults
        const kEstado = keys.find(k => k.toUpperCase() === 'ESTADO');
        const kSuplente = keys.find(k => k.toUpperCase() === 'SUPLENTE');

        if (kEstado) activeFilters.push(kEstado);
        if (kSuplente) activeFilters.push(kSuplente);

        hasInitializedFilters = true;
        renderFilterChips();
    }

    // --- FILTERING LOGIC ---
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    // Get current filter values
    const criteria = activeFilters.map(key => {
        const el = document.getElementById(`filter-select-${key}`);
        return { key, val: el ? el.value : 'ALL' };
    });

    let filtered = state.masterData.filter(row => {
        // Global Search
        const rowStr = Object.values(row).join(' ').toLowerCase();
        if (query && !rowStr.includes(query)) return false;

        // Column Filters
        for (let c of criteria) {
            if (c.val !== 'ALL') {
                if (row[c.key] != c.val) return false;
            }
        }
        return true;
    });

    if (countEl) countEl.textContent = filtered.length;

    // --- STATS BAR ---
    if (statsContainer) {
        // Recalculate basic stats on filtered view
        const keyEstado = Object.keys(state.masterData[0]).find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';

        const disc = filtered.filter(r => (r[keyEstado] || '').toString().toUpperCase().includes('DESCUBIERTO')).length;
        const total = filtered.length;

        statsContainer.innerHTML = `
            <div class="master-stat-badge"><span>VISIBLE:</span> ${total}</div>
            <div class="master-stat-badge red"><span>DESCUBIERTOS:</span> ${disc}</div>
        `;
    }

    if (filtered.length === 0) {
        feed.innerHTML = '<div class="empty-state">NO HAY RESULTADOS PARA ESTE FILTRO</div>';
        return;
    }

    // --- RENDER TABLE ---
    // Columns: SERVICIO, TITULAR, HORARIO, ESTADO, SUPLENTE
    const keys = Object.keys(state.masterData[0]);

    // Helper for loose matching
    const findK = (query) => keys.find(k => k.toUpperCase().includes(query));

    const kServicio = findK('SERVICIO') || keys[0];
    const kTitular = findK('TITULAR') || keys[1] || 'TITULAR';
    const kHorario = findK('HORARIO') || keys[2] || 'HORARIO';
    const kEstado = keys.find(k => k.toUpperCase() === 'ESTADO') || findK('ESTADO') || keys[3];
    const kSuplente = findK('SUPLENTE') || (keys.length > 4 ? keys[4] : 'SUPLENTE');

    const displayLimit = 300;
    const dataToShow = filtered.slice(0, displayLimit);

    let html = `
    <table class="master-table" id="resizable-master">
        <thead>
            <tr>
                <th style="width: 25%;">📍 SERVICIO <div class="resizer"></div></th>
                <th style="width: 20%;">👤 TITULAR <div class="resizer"></div></th>
                <th style="width: 20%;">⏰ HORARIO <div class="resizer"></div></th>
                <th style="width: 15%;">🛡️ COBERTURA <div class="resizer"></div></th>
                <th style="width: 20%;">🔄 SUPLENTE <div class="resizer"></div></th>
            </tr>
        </thead>
        <tbody>
            ${dataToShow.map((row, idx) => {
        // Encontrar el índice real en masterData (no en filtered)
        const realIndex = state.masterData.findIndex(r =>
            r[kServicio] === row[kServicio] &&
            r[kTitular] === row[kTitular] &&
            r[kHorario] === row[kHorario]
        );

        const s = row[kServicio] || '';
        const t = row[kTitular] || '';
        const h = row[kHorario] || '';
        const e = row[kEstado] || '';
        const sup = row[kSuplente] || '';

        const isDisc = (e.toString().toUpperCase().includes('DESCUBIERTO'));
        const rowClass = isDisc ? 'critical-row' : '';
        const badgeClass = isDisc ? 'red' : 'green';

        return `
                <tr class="${rowClass}" data-row-index="${realIndex}">
                    <td title="${s}"><div class="td-content">${s}</div></td>
                    <td title="${t}">
                        <div class="td-content editable" 
                             contenteditable="true" 
                             data-column="${kTitular}"
                             onblur="updateMasterCell(${realIndex}, '${kTitular}', this.innerText.trim())"
                             style="cursor: text; border: 1px solid transparent; padding: 4px; border-radius: 3px;"
                             onfocus="this.style.border='1px solid var(--sifu-blue)'; this.style.background='rgba(14, 165, 233, 0.05)';"
                             onblur="this.style.border='1px solid transparent'; this.style.background='transparent'; updateMasterCell(${realIndex}, '${kTitular}', this.innerText.trim());">
                            <b>${t}</b>
                        </div>
                    </td>
                    <td title="${h}"><div class="td-content" style="color:var(--sifu-blue); font-family:monospace;">${h}</div></td>
                    <td>
                        <div class="td-content editable" 
                             contenteditable="true" 
                             data-column="${kEstado}"
                             style="cursor: text;"
                             onfocus="this.style.background='rgba(14, 165, 233, 0.05)';"
                             onblur="this.style.background='transparent'; updateMasterCell(${realIndex}, '${kEstado}', this.innerText.trim());">
                            <span class="badge ${badgeClass}">${e || 'OK'}</span>
                        </div>
                    </td>
                    <td title="${sup}">
                        <div class="td-content editable" 
                             contenteditable="true" 
                             data-column="${kSuplente}"
                             style="cursor: text; border: 1px solid transparent; padding: 4px; border-radius: 3px;"
                             onfocus="this.style.border='1px solid var(--sifu-blue)'; this.style.background='rgba(14, 165, 233, 0.05)';"
                             onblur="this.style.border='1px solid transparent'; this.style.background='transparent'; updateMasterCell(${realIndex}, '${kSuplente}', this.innerText.trim());">
                            ${sup || '-'}
                        </div>
                    </td>
                </tr>
                `;
    }).join('')}
        </tbody>
    </table>`;

    if (filtered.length > displayLimit) {
        html += `<div style="text-align:center; padding:10px; color:#888;">⚠️ Mostrando primeros ${displayLimit} registros. Usa filtros para ver más.</div>`;
    }

    feed.innerHTML = html;
    initResizableTable(document.getElementById('resizable-master'));
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

    const discovered = state.masterData.filter(r => (r[keyE] || '').toString().toUpperCase().includes('DESCUBIERTO'));
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
                <strong style="color:var(--sifu-blue);">${inc.type}</strong>: ${inc.desc || 'Sin descripciÃ³n detallada'}
            </div>
            <div style="font-size:11px; color:var(--text-dim); display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span>ðŸ“… ${formatNoteDate(inc.date)}</span>
                <span>ðŸ•’ ${inc.time}</span>
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

window.addNoteFromCerebro = () => {
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
    updateTicker("SISTEMA: APUNTE GUARDADO EN EL CEREBRO");
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

function updateHeaderStats() {
    if (hIncidents) hIncidents.textContent = state.incidents.length;
    if (hActive) hActive.textContent = state.stats.activeWorkers;
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
        updateTicker("NOTA GUARDADA EN CEREBRO OPERATIVO");
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
        "SISTEMA DE PREDICCIÓN IA: ACTIVO",
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
        tickerEl.textContent = msg;
        tickerEl.style.color = 'var(--sifu-amber)';
        setTimeout(() => tickerEl.style.color = '', 3000);
    }
}

// Unified Widget Switching
window.switchWidget = (type) => {
    document.querySelectorAll('.w-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.w-tab').forEach(t => t.classList.remove('active'));

    document.getElementById(`w-content-${type}`)?.classList.add('active');
    const btn = document.querySelector(`.w-tab[onclick*="${type}"]`);
    if (btn) btn.classList.add('active');
};

// Tab Switching Logic
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.add('active');
        const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (btn) btn.classList.add('active');
        if (tabId === 'resumen') setTimeout(updateCharts, 100);
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

let operationalChart = null;
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
    if (!operationalChart || !state.masterData.length) return;

    const total = state.masterData.length;
    const uncovered = state.masterData.filter(r => (r['ESTADO'] || '').toString().toUpperCase().includes('DESCUBIERTO')).length;
    const incidents = state.incidents.length;
    const ok = Math.max(0, total - uncovered - incidents);

    operationalChart.data.datasets[0].data = [ok, incidents, uncovered];
    operationalChart.update();

    const coveragePct = ((ok / total) * 100).toFixed(0);
    const coverEl = document.getElementById('coverage-percent');
    if (coverEl) coverEl.textContent = coveragePct + '%';

    // Update mini-insights labels
    const okEl = document.getElementById('count-ok');
    const incEl = document.getElementById('count-incidents');
    const critEl = document.getElementById('count-critical');

    if (okEl) okEl.textContent = ok;
    if (incEl) incEl.textContent = incidents;
    if (critEl) critEl.textContent = uncovered;
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

    el.textContent = `${prediction}% ${trend}`;
    el.style.color = riskFactor > 10 ? 'var(--accent-red)' : (riskFactor > 5 ? 'var(--sifu-amber)' : 'var(--accent-green)');
}

function updateInsights() {
    const valUncovered = document.getElementById('val-uncovered');
    const valAbsences = document.getElementById('val-absences');
    const valIncidents = document.getElementById('val-incidents');
    const valActive = document.getElementById('val-active');

    if (!state.masterData || state.masterData.length === 0) return;

    // --- PROFESSIONAL DATA SCANNING ---
    const keys = Object.keys(state.masterData[0]);
    const kEstado = keys.find(k => k.toUpperCase().includes('ESTADO')) || 'ESTADO';
    const kSalud = keys.find(k => k.toUpperCase().includes('SALUD')) || keys.find(k => k.toUpperCase().includes('IT')) || '';

    // Count Uncovered
    const uncoveredCount = state.masterData.filter(row => {
        const val = (row[kEstado] || '').toString().toUpperCase();
        return val.includes('DESCUBIERTO');
    }).length;

    // Count Absences (IT / Sick Leave)
    const absencesCount = state.masterData.filter(row => {
        const valE = (row[kEstado] || '').toString().toUpperCase();
        const valS = kSalud ? (row[kSalud] || '').toString().toUpperCase() : '';
        return valE.includes('BAJA') || valE.includes(' IT') || valS.includes('BAJA') || valS.includes('SI');
    }).length;

    // Update Bridge Cards
    if (valUncovered) {
        valUncovered.textContent = uncoveredCount;
        const card = document.getElementById('metric-uncovered');
        if (uncoveredCount > 0) card.classList.add('critical-pulse');
        else card.classList.remove('critical-pulse');
    }

    if (valAbsences) {
        valAbsences.textContent = absencesCount;
    }

    if (valIncidents) {
        valIncidents.textContent = state.incidents.length;
    }

    if (valActive) {
        const total = state.masterData.length;
        const percent = (((total - uncoveredCount) / total) * 100).toFixed(1);
        valActive.textContent = percent + '%';
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
    const uncovered = state.uncovered.length;
    if (uncovered > 0) {
        insights.push({
            type: 'critical',
            text: `⚠️ ALERTA: ${uncovered} servicios descubiertos requieren acción inmediata.`,
            tag: 'URGENTE'
        });
    }

    // 2. Análisis de Bajas (Warning)
    const sickLeave = state.absences.filter(a => a.reason && a.reason.toUpperCase().includes('BAJA')).length;
    if (sickLeave > 3) {
        insights.push({
            type: 'ai-suggest',
            text: `Alta tasa de absentismo (${sickLeave} activos). Revisar plan de suplencias.`,
            tag: 'ABSENTISMO'
        });
    } else {
        insights.push({
            type: 'performance',
            text: `Nivel de absentismo bajo control. Operativa estable.`,
            tag: 'OPTIMO'
        });
    }

    // 3. Recomendación IA
    const hour = new Date().getHours();
    if (hour < 10) {
        insights.push({
            type: 'ai-suggest',
            text: '💡 Sugerencia: Verificar fichajes de entrada del turno de mañana.',
            tag: 'IA TIP'
        });
    } else if (hour > 14 && hour < 16) {
        insights.push({
            type: 'ai-suggest',
            text: '💡 Sugerencia: Preparar cuadrante para el turno de tarde.',
            tag: 'IA TIP'
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
                "Authorization": `Bearer ${accessToken}`
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
    toast.className = `toast ${type}`;
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
    const btn = document.getElementById('voice-btn');
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

