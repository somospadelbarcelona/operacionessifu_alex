
/**
 * 🛰️ MASTER SYNC ENGINE v3.5 PRO
 * Enterprise-grade Excel synchronization for SIFU Dashboard.
 */

const MasterSyncEngine = {
    handle: null,
    lastUpdate: null,
    isWatching: false,
    watchTimer: null,
    lastDataHash: null,
    autoReloadTimer: null,

    elements: {
        iconBtn: null,
        statusDot: null,
        hud: null,
        statusBadge: null,
        fileName: null,
        lastSync: null,
        totalRows: null,
        watchStatus: null
    },

    init() {
        console.log('🛰️ MasterSyncEngine: Inicializando Consola PRO...');
        this.injectStyles();
        this.createIcon();
        this.createHUD();
        this.attachEventListeners();
        this.restoreSession();
        this.startHyperAutoSync();
    },

    injectStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'master_sync_v2.css';
        document.head.appendChild(link);
    },

    createIcon() {
        const container = document.querySelector('.header-comm-links');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'btn-sync-hud-toggle';
        btn.className = 'sync-icon-btn';
        btn.title = 'Consola de Sincronización';
        btn.innerHTML = `
            <span>🛰️</span>
            <div id="sync-icon-status" class="status-dot"></div>
        `;

        container.prepend(btn);
        this.elements.iconBtn = btn;
        this.elements.statusDot = document.getElementById('sync-icon-status');
    },

    createHUD() {
        const hud = document.createElement('div');
        hud.id = 'master-sync-hud';
        hud.className = 'sync-hub-hud pro-version';
        hud.innerHTML = `
            <div class="sync-hub-header">
                <div class="sync-hub-title">
                    <div class="pro-badge">PRO</div>
                    <div>
                        <h3>MASTER SYNC HUB</h3>
                        <div id="hud-file-path">MODO AUTOMÁTICO ACTIVO</div>
                    </div>
                </div>
                <div id="hud-status-badge" class="sync-status-badge active">
                    <span class="sync-status-dot"></span>
                    <span class="status-text">ONLINE</span>
                </div>
            </div>

            <div class="sync-stats-grid">
                <div class="sync-stat-item">
                    <div class="sync-stat-label">REGISTROS</div>
                    <div id="hud-stat-total" class="sync-stat-value">---</div>
                </div>
                <div class="sync-stat-item">
                    <div class="sync-stat-label">ÚLTIMA SINCRONIZACIÓN</div>
                    <div id="hud-stat-time" class="sync-stat-value">--:--:--</div>
                </div>
                <div class="sync-stat-item">
                    <div class="sync-stat-label">M MOTOR</div>
                    <div id="hud-stat-watch" class="sync-stat-value pro">HYPER-SYNC</div>
                </div>
            </div>

            <div class="sync-controls-pro">
                <button id="hud-sync-now" class="pro-btn primary">SINCRONIZAR AHORA</button>
                <button id="hud-sync-config" class="pro-btn secondary">AJUSTES</button>
            </div>

            <div id="hud-log-container" class="pro-log">
                <div class="pro-log-header">
                    <span>REGISTRO DE OPERACIONES</span>
                    <span id="hud-log-count">0 EVENTOS</span>
                </div>
                <div id="hud-log-list" class="pro-log-list">
                    <div class="log-placeholder">Sistema listo para recibir datos...</div>
                </div>
            </div>
        `;

        document.body.appendChild(hud);
        this.elements.hud = hud;
        this.elements.statusBadge = document.getElementById('hud-status-badge');
        this.elements.fileName = document.getElementById('hud-file-path');
        this.elements.lastSync = document.getElementById('hud-stat-time');
        this.elements.totalRows = document.getElementById('hud-stat-total');
        this.elements.watchStatus = document.getElementById('hud-stat-watch');
    },

    attachEventListeners() {
        this.elements.iconBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.elements.hud.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (this.elements.hud && !this.elements.hud.contains(e.target) && e.target !== this.elements.iconBtn) {
                this.elements.hud.classList.remove('active');
            }
        });

        document.getElementById('hud-sync-now')?.addEventListener('click', () => this.triggerManualSync());
    },

    startHyperAutoSync() {
        console.log('🔥 Hyper-Sync Pro Cargado');

        // Polling loop
        this.autoReloadTimer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            this.checkMasterDataUpdate();
            this.checkExcelFileUpdate();
        }, 3000);
    },

    async checkExcelFileUpdate() {
        if (window.location.protocol === 'file:') return;
        try {
            const response = await fetch('MASTER GENERAL.xlsx', { method: 'HEAD', cache: 'no-cache' });
            const lastMod = response.headers.get('Last-Modified');
            if (lastMod && lastMod !== this.lastUpdate) {
                const res = await fetch('MASTER GENERAL.xlsx');
                const buf = await res.arrayBuffer();
                const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
                this.lastUpdate = lastMod;
                this.onMasterDataReloaded(data, "XLSX Direct");
            }
        } catch (e) { }
    },

    async checkMasterDataUpdate() {
        const scriptId = 'master-data-poller';
        const existing = document.getElementById(scriptId);
        if (existing) existing.remove();

        const script = document.createElement('script');
        script.id = scriptId;
        const nocache = Math.random().toString(36).substring(7);
        script.src = `master_data.js?nocache=${nocache}&t=${Date.now()}`;

        script.onload = () => {
            const currentData = window.INITIAL_MASTER_DATA;
            if (!currentData) return;
            const currentHash = JSON.stringify(currentData).length;
            if (this.lastDataHash && currentHash !== this.lastDataHash) {
                this.onMasterDataReloaded(currentData, "Auto-Extract");
            }
            this.lastDataHash = currentHash;
        };
        document.head.appendChild(script);
    },

    onMasterDataReloaded(newData, source) {
        this.addLogEntry(`Update: ${source} (${newData.length} rows)`, "success");
        this.elements.hud.classList.add('file-change-flash');
        setTimeout(() => this.elements.hud.classList.remove('file-change-flash'), 800);

        localStorage.setItem('sifu_master_data_v4', JSON.stringify(newData));
        localStorage.setItem('sifu_last_sync', `PRO ${new Date().toLocaleTimeString()}`);

        if (window.state) {
            window.state.masterData = newData;
            if (typeof window.processMasterArray === 'function') window.processMasterArray(newData);
            if (typeof window.renderAll === 'function') window.renderAll();
            if (typeof window.saveAllState === 'function') window.saveAllState();
        }

        this.updateUI('active', 'SYNC OK');
        showToast("✨ Dashboard Pro Actualizado", "success");
    },

    updateUI(status, message = "") {
        if (!this.elements.statusBadge) return;
        this.elements.statusBadge.className = `sync-status-badge ${status}`;
        const text = this.elements.statusBadge.querySelector('.status-text');
        const statusColors = { 'active': '#10b981', 'paused': '#f59e0b', 'disconnected': '#ef4444' };

        if (this.elements.statusDot) {
            this.elements.statusDot.style.background = statusColors[status] || '#94a3b8';
        }

        if (window.state && window.state.masterData) {
            this.elements.totalRows.textContent = window.state.masterData.length;
        }
        const lastSync = localStorage.getItem('sifu_last_sync');
        if (lastSync && this.elements.lastSync) {
            this.elements.lastSync.textContent = lastSync.split(' ')[1] || lastSync;
        }
    },

    addLogEntry(message, type = "info") {
        const list = document.getElementById('hud-log-list');
        if (!list) return;
        if (list.querySelector('.log-placeholder')) list.innerHTML = '';
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span>${message}</span> <small>${time}</small>`;
        list.prepend(entry);
        if (list.children.length > 20) list.removeChild(list.lastChild);
        document.getElementById('hud-log-count').textContent = `${list.children.length} EVENTOS`;
    },

    triggerManualSync() {
        this.addLogEntry("Iniciando sincronización forzada...", "info");
        const btn = document.getElementById('btn-load-master');
        if (btn) btn.click();
    },

    restoreSession() {
        setTimeout(() => {
            if (window.liveHandle) this.updateUI('active');
        }, 1500);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => MasterSyncEngine.init(), 1000);
});

window.MasterSyncEngine = MasterSyncEngine;
