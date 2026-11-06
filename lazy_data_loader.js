/**
 * SIFU BARCELONA (0801) — LazyDataLoader
 * ═══════════════════════════════════════
 * Reemplaza la carga de archivos .js estáticos de 12+ MB por peticiones API
 * con caché inteligente en memoria + IndexedDB.
 *
 * ANTES: 33 <script> tags bloqueantes → 12 MB descargados al inicio
 * DESPUÉS: 1 loader → solo descarga lo necesario bajo demanda (~200 KB inicio)
 *
 * Uso:
 *   const data = await LazyDataLoader.get('master');
 *   const kpis = await LazyDataLoader.get('contraste/kpis');
 *   const gestor = await LazyDataLoader.get('carteras/gestor/00062620');
 */

const DATA_API_BASE = 'http://localhost:3001/api/data';
const FALLBACK_MODE = true; // Si la API no responde, carga archivos estáticos

// ─── Caché en memoria ───────────────────────────────────────────────────────────
const memoryCache = new Map();
const cacheTimestamps = new Map();
const CACHE_TTL = 60_000; // 60 segundos en memoria

// ─── IndexedDB para caché persistente ───────────────────────────────────────────
const DB_NAME = 'sifu_data_cache';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function idbGet(key) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result?.data || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function idbSet(key, data) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, data, ts: Date.now() });
    } catch { /* silencioso */ }
}

// ─── Status de la API ───────────────────────────────────────────────────────────
let apiAvailable = null; // null = no comprobado, true/false

async function checkApiHealth() {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const resp = await fetch(`${DATA_API_BASE}/health`, { signal: ctrl.signal });
        clearTimeout(timer);
        apiAvailable = resp.ok;
    } catch {
        apiAvailable = false;
    }
    return apiAvailable;
}

// ─── Mapeo de datasets a variables globales (modo fallback) ─────────────────────
const GLOBAL_VAR_MAP = {
    'master':     'INITIAL_MASTER_DATA',
    'fichajes':   'FICHAJES_RAW_PAYLOAD',
    'contraste':  'FICHAJES_CONTRASTE_PAYLOAD',
    'carteras':   'HO_CARTERAS_PAYLOAD',
    'vacaciones': 'HO_VACACIONES_PAYLOAD',
    'supervisor': 'SUPERVISOR_SNAPSHOT',
    'orders':     'INITIAL_ORDERS_DATA',
};

// ─── Loader principal ───────────────────────────────────────────────────────────
window.LazyDataLoader = {
    /**
     * Carga un dataset bajo demanda.
     * @param {string} endpoint - Ej: 'master', 'contraste/kpis', 'carteras/gestor/00062620'
     * @param {object} opts - { search, page, limit, fields, forceRefresh, timeout }
     * @returns {Promise<any>} Los datos del dataset
     */
    async get(endpoint, opts = {}) {
        const cacheKey = `${endpoint}?${new URLSearchParams(opts).toString()}`;
        
        // 1. Caché en memoria (más rápido)
        if (!opts.forceRefresh && memoryCache.has(cacheKey)) {
            const age = Date.now() - (cacheTimestamps.get(cacheKey) || 0);
            if (age < CACHE_TTL) {
                return memoryCache.get(cacheKey);
            }
        }
        
        // 2. Intentar API primero
        if (apiAvailable === null) await checkApiHealth();
        
        if (apiAvailable) {
            try {
                const data = await this._fetchFromApi(endpoint, opts);
                memoryCache.set(cacheKey, data);
                cacheTimestamps.set(cacheKey, Date.now());
                // Guardar en IndexedDB en background (solo datasets completos)
                if (!endpoint.includes('/') && !opts.page) {
                    idbSet(endpoint, data);
                }
                return data;
            } catch (e) {
                console.warn(`⚠️ API falló para '${endpoint}':`, e.message);
                apiAvailable = false;
            }
        }
        
        // 3. Fallback: IndexedDB
        const idbData = await idbGet(endpoint);
        if (idbData) {
            console.log(`📦 Usando caché IndexedDB para: ${endpoint}`);
            memoryCache.set(cacheKey, idbData);
            cacheTimestamps.set(cacheKey, Date.now());
            return idbData;
        }
        
        // 4. Último recurso: variables globales (archivos .js ya cargados)
        if (FALLBACK_MODE) {
            const baseName = endpoint.split('/')[0];
            const globalVar = GLOBAL_VAR_MAP[baseName];
            if (globalVar && window[globalVar]) {
                console.log(`🔄 Fallback a variable global: ${globalVar}`);
                return window[globalVar];
            }
        }
        
        console.error(`❌ No se pudieron cargar datos para: ${endpoint}`);
        return null;
    },
    
    /**
     * Precarga datasets en background sin bloquear la UI.
     * @param {string[]} datasets - Lista de endpoints a precargar
     */
    async preload(datasets) {
        const promises = datasets.map(ds => 
            this.get(ds).catch(e => console.warn(`Preload failed: ${ds}`, e.message))
        );
        await Promise.allSettled(promises);
    },
    
    /**
     * Obtiene solo los KPIs/resumen de un dataset pesado.
     * Usa endpoints ligeros del servidor.
     */
    async getKpis(dataset) {
        return this.get(`${dataset}/kpis`);
    },
    
    /**
     * Busca en un dataset con paginación server-side.
     */
    async search(dataset, query, page = 1, limit = 50) {
        return this.get(dataset, { search: query, page, limit });
    },
    
    /**
     * Verifica si hay datos más nuevos que los cacheados.
     */
    async checkForUpdates(dataset) {
        try {
            const resp = await fetch(`${DATA_API_BASE}/timestamp/${dataset}`);
            if (resp.ok) {
                const { lastModified } = await resp.json();
                return { dataset, lastModified, hasUpdate: true };
            }
        } catch { /* silencioso */ }
        return { dataset, hasUpdate: false };
    },
    
    /**
     * Limpia toda la caché.
     */
    clearCache() {
        memoryCache.clear();
        cacheTimestamps.clear();
        console.log('🗑️ Caché de datos limpiada');
    },
    
    /**
     * Stats de la caché.
     */
    getCacheStats() {
        return {
            memoryEntries: memoryCache.size,
            totalSizeKB: Math.round(
                [...memoryCache.values()].reduce((sum, v) => sum + JSON.stringify(v).length, 0) / 1024
            ),
            apiAvailable,
        };
    },
    
    // ─── Privado ────────────────────────────────────────────────────────────────
    async _fetchFromApi(endpoint, opts = {}) {
        const url = new URL(`${DATA_API_BASE}/${endpoint}`);
        if (opts.search) url.searchParams.set('search', opts.search);
        if (opts.page) url.searchParams.set('page', opts.page);
        if (opts.limit) url.searchParams.set('limit', opts.limit);
        if (opts.fields) url.searchParams.set('fields', opts.fields);
        
        const timeout = opts.timeout || 10_000;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        
        try {
            const resp = await fetch(url.toString(), {
                headers: { 'Accept-Encoding': 'gzip' },
                signal: ctrl.signal
            });
            clearTimeout(timer);
            
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            clearTimeout(timer);
            throw e;
        }
    }
};

// ─── Compatibilidad: exponer variables globales bajo demanda ────────────────────
// Esto permite que el código existente siga funcionando mientras se migra.
// Las variables se pueblan lazy cuando alguien las lee.

const LAZY_GLOBALS = {
    INITIAL_MASTER_DATA:         'master',
    FICHAJES_RAW_PAYLOAD:        'fichajes',
    FICHAJES_CONTRASTE_PAYLOAD:  'contraste',
    HO_CARTERAS_PAYLOAD:         'carteras',
    HO_VACACIONES_PAYLOAD:       'vacaciones',
    SUPERVISOR_SNAPSHOT:          'supervisor',
    INITIAL_ORDERS_DATA:         'orders',
};

// Solo definir getters para variables que NO están ya definidas
// (no pisamos datos que se hayan cargado de forma estática)
for (const [varName, dataset] of Object.entries(LAZY_GLOBALS)) {
    if (typeof window[varName] === 'undefined') {
        let _cached = null;
        let _loading = null;
        
        Object.defineProperty(window, varName, {
            get() {
                if (_cached) return _cached;
                // Lanzar carga asíncrona si no está cargado
                if (!_loading) {
                    _loading = LazyDataLoader.get(dataset).then(data => {
                        _cached = data;
                        console.log(`🔗 ${varName} cargado bajo demanda (${dataset})`);
                    });
                }
                return _cached || []; // Devolver array vacío mientras carga
            },
            set(val) {
                _cached = val; // Permitir asignación directa
            },
            configurable: true,
            enumerable: true
        });
    }
}

// ─── Auto-detección del servidor de datos ───────────────────────────────────────
checkApiHealth().then(available => {
    if (available) {
        console.log('⚡ LazyDataLoader: API de datos disponible en', DATA_API_BASE);
        // Precargar KPIs ligeros para la vista inicial
        LazyDataLoader.preload(['contraste/kpis', 'vacaciones/kpis']);
    } else {
        console.warn('⚠️ LazyDataLoader: API no disponible, usando fallback a archivos estáticos');
    }
});

console.log('🚀 LazyDataLoader inicializado');
