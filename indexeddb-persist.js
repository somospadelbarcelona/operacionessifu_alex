// ============================================
// SISTEMA DE PERSISTENCIA ALTERNATIVO CON INDEXEDDB
// ============================================

const DB_PERSIST_NAME = 'SifuPersistDB';
const DB_PERSIST_VERSION = 1;
const STORE_PERSIST_NAME = 'AppState';

// Abrir base de datos IndexedDB
function openPersistDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_PERSIST_NAME, DB_PERSIST_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_PERSIST_NAME)) {
                db.createObjectStore(STORE_PERSIST_NAME);
            }
        };
    });
}

// Guardar estado en IndexedDB
async function saveStateToIndexedDB(stateData) {
    try {
        const db = await openPersistDB();
        const transaction = db.transaction([STORE_PERSIST_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_PERSIST_NAME);

        store.put(stateData, 'appState');

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('✅ Estado guardado en IndexedDB');
                resolve(true);
            };
            transaction.onerror = () => {
                console.error('❌ Error guardando en IndexedDB:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('❌ Error en saveStateToIndexedDB:', error);
        return false;
    }
}

// Cargar estado desde IndexedDB
async function loadStateFromIndexedDB() {
    try {
        const db = await openPersistDB();
        const transaction = db.transaction([STORE_PERSIST_NAME], 'readonly');
        const store = transaction.objectStore(STORE_PERSIST_NAME);
        const request = store.get('appState');

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                if (request.result) {
                    console.log('✅ Estado cargado desde IndexedDB');
                    resolve(request.result);
                } else {
                    console.log('⚠️ No hay datos en IndexedDB');
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error('❌ Error cargando desde IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('❌ Error en loadStateFromIndexedDB:', error);
        return null;
    }
}

// Exportar funciones
window.saveStateToIndexedDB = saveStateToIndexedDB;
window.loadStateFromIndexedDB = loadStateFromIndexedDB;
