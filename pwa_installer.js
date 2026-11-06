/**
 * PWA INSTALLER - Gestor de Instalación de Progressive Web App
 * Permite instalar la app en móviles y escritorio
 */

const PWAInstaller = {
    deferredPrompt: null,
    isInstalled: false,

    init() {
        console.log('📱 Inicializando PWA Installer...');

        // Registrar Service Worker
        /* SW desactivado (rendimiento): provocaba bucle de recarga con index.html */

        // Detectar si ya está instalada
        this.checkIfInstalled();

        // Escuchar evento de instalación
        this.setupInstallPrompt();

        // Detectar cuando se instala
        this.detectInstallation();

        // Mostrar banner de instalación si procede
        this.showInstallBanner();
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('✅ Service Worker registrado:', registration.scope);

                // Actualizar Service Worker si hay nueva versión
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Hay nueva versión disponible
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.error('❌ Error registrando Service Worker:', error);
            }
        }
    },

    checkIfInstalled() {
        // Detectar si está en modo standalone (instalada)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('✅ App instalada y ejecutándose en modo standalone');
            this.hideInstallButton();
        }

        // Detectar en iOS
        if (window.navigator.standalone === true) {
            this.isInstalled = true;
            console.log('✅ App instalada en iOS');
            this.hideInstallButton();
        }
    },

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 Evento beforeinstallprompt capturado');

            // Prevenir el mini-infobar automático de Chrome
            e.preventDefault();

            // Guardar el evento para usarlo después
            this.deferredPrompt = e;

            // Mostrar botón de instalación personalizado
            this.showInstallButton();
        });
    },

    detectInstallation() {
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA instalada correctamente');
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideInstallButton();

            if (typeof showToast === 'function') {
                showToast('✅ App instalada correctamente', 'success');
            }
        });
    },

    showInstallButton() {
        // Crear botón de instalación si no existe
        let installBtn = document.getElementById('pwa-install-btn');

        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'pwa-install-button';
            installBtn.innerHTML = '📱 Instalar App';
            installBtn.onclick = () => this.promptInstall();

            // Agregar al header
            const header = document.querySelector('.global-header');
            if (header) {
                header.appendChild(installBtn);
            }
        }

        installBtn.style.display = 'block';
    },

    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    },

    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('⚠️ No hay prompt de instalación disponible');
            return;
        }

        // Mostrar el prompt de instalación
        this.deferredPrompt.prompt();

        // Esperar la respuesta del usuario
        const { outcome } = await this.deferredPrompt.userChoice;

        console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);

        if (outcome === 'accepted') {
            if (typeof showToast === 'function') {
                showToast('📱 Instalando app...', 'info');
            }
        }

        // Limpiar el prompt
        this.deferredPrompt = null;
        this.hideInstallButton();
    },

    showInstallBanner() {
        // Solo mostrar si no está instalada y es móvil
        if (this.isInstalled || !this.isMobile()) return;

        // Verificar si ya se mostró antes
        const bannerDismissed = localStorage.getItem('pwa_banner_dismissed');
        if (bannerDismissed) return;

        setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'pwa-install-banner';
            banner.innerHTML = `
                <div class="banner-content">
                    <div class="banner-icon">📱</div>
                    <div class="banner-text">
                        <strong>Instala SIFU Informer</strong>
                        <p>Acceso rápido y modo offline</p>
                    </div>
                    <button class="banner-install-btn" onclick="PWAInstaller.promptInstall()">
                        Instalar
                    </button>
                    <button class="banner-close-btn" onclick="PWAInstaller.dismissBanner()">
                        ×
                    </button>
                </div>
            `;

            document.body.appendChild(banner);

            // Animar entrada
            setTimeout(() => banner.classList.add('show'), 100);
        }, 3000);
    },

    dismissBanner() {
        const banner = document.querySelector('.pwa-install-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
        localStorage.setItem('pwa_banner_dismissed', 'true');
    },

    showUpdateNotification() {
        if (typeof showToast === 'function') {
            showToast('🔄 Nueva versión disponible. Recarga para actualizar.', 'info');
        }

        // Crear botón de actualización
        const updateBtn = document.createElement('button');
        updateBtn.className = 'pwa-update-button';
        updateBtn.innerHTML = '🔄 Actualizar';
        updateBtn.onclick = () => {
            window.location.reload();
        };

        const header = document.querySelector('.global-header');
        if (header) {
            header.appendChild(updateBtn);
        }
    },

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Solicitar permiso para notificaciones push
    async requestPushPermission() {
        if (!('Notification' in window)) {
            console.log('⚠️ Este navegador no soporta notificaciones');
            return false;
        }

        if (Notification.permission === 'granted') {
            console.log('✅ Permiso de notificaciones ya concedido');
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Permiso de notificaciones concedido');
                return true;
            }
        }

        console.log('❌ Permiso de notificaciones denegado');
        return false;
    },

    // Suscribirse a notificaciones push
    async subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Verificar si ya está suscrito
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Crear nueva suscripción
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(
                        'YOUR_PUBLIC_VAPID_KEY_HERE' // Reemplazar con tu clave VAPID
                    )
                });

                console.log('✅ Suscrito a notificaciones push');

                // Aquí enviarías la suscripción a tu servidor
                // await this.sendSubscriptionToServer(subscription);
            }

            return subscription;
        } catch (error) {
            console.error('❌ Error suscribiendo a push:', error);
            return null;
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // Enviar notificación push de prueba
    async sendTestNotification() {
        if (!('serviceWorker' in navigator)) return;

        const registration = await navigator.serviceWorker.ready;

        registration.showNotification('SIFU Informer', {
            body: 'Las notificaciones están funcionando correctamente',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'test-notification',
            requireInteraction: false
        });
    }
};

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWAInstaller.init());
} else {
    PWAInstaller.init();
}

// Exponer globalmente
window.PWAInstaller = PWAInstaller;
