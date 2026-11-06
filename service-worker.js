/**
 * SERVICE WORKER - Modo Purga y Desactivación Definitiva
 * Garantiza que el nuevo diseño de la plataforma Enterprise cargue siempre 100% fresco sin caché obsoleta
 */

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister())
    );
});

// En caso de peticiones, pasar siempre directamente a la red sin interceptar
self.addEventListener('fetch', (event) => {
    return;
});
