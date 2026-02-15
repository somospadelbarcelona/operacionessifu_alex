/**
 * SERVICE WORKER - Modo Offline y Cache
 * Permite que la app funcione sin conexión
 */

const CACHE_NAME = 'sifu-informer-v1';
const OFFLINE_URL = 'offline.html';

// Archivos críticos para cachear
const CRITICAL_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/operational_styles.css',
    '/filter_bar_sticky.css',
    '/notepad.css',
    '/orders_styles.css',
    '/layout_styles.css',
    '/smart_modules.css',
    '/advanced_modules.css',
    '/app.js',
    '/master_data.js',
    '/operational_service.js',
    '/director_module.js',
    '/quadrants_module.js',
    '/notepad.js',
    '/notifications_engine.js',
    '/daily_checklist.js',
    '/calendar_module.js',
    '/analytics_trends.js',
    '/ai_predictive_engine.js',
    '/worker_performance.js',
    '/substitute_management.js'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando archivos críticos');
                return cache.addAll(CRITICAL_FILES);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de Fetch: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    // Solo cachear GET requests
    if (event.request.method !== 'GET') return;

    // Ignorar requests de Chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, cachearla
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, intentar desde cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        // Si es una navegación y no hay cache, mostrar página offline
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});

// Manejo de mensajes desde la app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[Service Worker] Cache limpiada');
            event.ports[0].postMessage({ success: true });
        });
    }
});

// Notificaciones Push
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push recibido:', event);

    const data = event.data ? event.data.json() : {};
    const title = data.title || 'SIFU Informer';
    const options = {
        body: data.body || 'Nueva notificación',
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'sifu-notification',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [],
        data: data.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notificación clickeada:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir nueva ventana
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Sincronización en background
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background Sync:', event.tag);

    if (event.tag === 'sync-master-data') {
        event.waitUntil(syncMasterData());
    }
});

async function syncMasterData() {
    try {
        // Intentar sincronizar datos con el servidor
        console.log('[Service Worker] Sincronizando datos master...');

        // Aquí iría la lógica de sincronización
        // Por ahora, solo registramos el intento

        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Error en sincronización:', error);
        return Promise.reject(error);
    }
}

console.log('[Service Worker] Cargado y listo');
