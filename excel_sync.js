// ========================================
// 🔄 SINCRONIZACIÓN AUTOMÁTICA EXCEL
// ========================================

const ExcelSync = {
    EXCEL_PATH: 'MASTER GENERAL.xlsx',
    SYNC_INTERVAL: 30000, // 30 segundos
    lastSync: null,

    // Verificar si hay una nueva versión del Excel
    async checkForUpdates() {
        try {
            const response = await fetch(this.EXCEL_PATH, {
                method: 'HEAD',
                cache: 'no-cache'
            });

            const lastModified = response.headers.get('Last-Modified');

            if (lastModified && lastModified !== this.lastSync) {
                console.log('🔄 Nueva versión del Excel detectada');
                this.lastSync = lastModified;
                return true;
            }

            return false;
        } catch (e) {
            console.warn('⚠️ No se pudo verificar actualizaciones del Excel:', e);
            return false;
        }
    },

    // Cargar datos del Excel
    async loadExcelData() {
        try {
            console.log('📥 Cargando datos del Excel...');

            const response = await fetch(this.EXCEL_PATH, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Leer la primera hoja
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet);

            console.log(`✅ ${data.length} registros cargados del Excel`);

            return data;
        } catch (e) {
            console.error('❌ Error al cargar Excel:', e);
            return null;
        }
    },

    // Sincronizar datos
    async sync() {
        const hasUpdates = await this.checkForUpdates();

        if (hasUpdates || !this.lastSync) {
            const data = await this.loadExcelData();

            if (data) {
                // Actualizar master_data
                window.INITIAL_MASTER_DATA = data;

                // Guardar en localStorage
                localStorage.setItem('sifu_master_data_v4', JSON.stringify(data));
                localStorage.setItem('sifu_last_sync', new Date().toISOString());

                // Recargar la vista
                if (typeof loadGlobalState === 'function') {
                    await loadGlobalState();
                }

                if (typeof renderMasterSummary === 'function') {
                    renderMasterSummary();
                }

                console.log('✅ Sincronización completada');

                // Notificar al usuario
                this.showNotification('Datos actualizados desde Excel');

                return true;
            }
        }

        return false;
    },

    // Mostrar notificación
    showNotification(message) {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = `✅ ${message}`;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Iniciar sincronización automática
    startAutoSync() {
        console.log('🔄 Sincronización automática iniciada');

        // Sincronizar inmediatamente
        this.sync();

        // Sincronizar cada 30 segundos
        setInterval(() => {
            this.sync();
        }, this.SYNC_INTERVAL);
    },

    // Forzar sincronización manual
    async forceSync() {
        this.lastSync = null; // Forzar actualización
        return await this.sync();
    }
};

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof XLSX !== 'undefined') {
            ExcelSync.startAutoSync();
        } else {
            console.warn('⚠️ XLSX library no cargada, sincronización deshabilitada');
        }
    });
} else {
    if (typeof XLSX !== 'undefined') {
        ExcelSync.startAutoSync();
    }
}

// Exponer para uso manual
window.ExcelSync = ExcelSync;

console.log('📊 Excel Sync cargado - Usa ExcelSync.forceSync() para sincronizar manualmente');
