// CLIENTE DE API PARA SIFU BACKEND
const API_BASE_URL = 'http://localhost:3000/api';

export const ApiClient = {
    // --- SERVICIOS ---
    async getServices() {
        try {
            const response = await fetch(`${API_BASE_URL}/services?limit=1000`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.services : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (getServices) Offline:', e.message);
            return null;
        }
    },

    // --- INCIDENCIAS ---
    async getIncidents() {
        try {
            const response = await fetch(`${API_BASE_URL}/incidents`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.incidents : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (getIncidents) Offline:', e.message);
            return null;
        }
    },

    async createIncident(incident) {
        try {
            const response = await fetch(`${API_BASE_URL}/incidents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(incident)
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.incident : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (createIncident) Offline:', e.message);
            return null;
        }
    },

    async updateIncident(id, incident) {
        try {
            const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(incident)
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.incident : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (updateIncident) Offline:', e.message);
            return null;
        }
    },

    async deleteIncident(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/incidents/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const res = await response.json();
                return res.success;
            }
            return false;
        } catch (e) {
            console.warn('📡 API (deleteIncident) Offline:', e.message);
            return false;
        }
    },

    // --- NOTAS BLOC DE NOTAS ---
    async getNotes() {
        try {
            const response = await fetch(`${API_BASE_URL}/notes`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.notes : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (getNotes) Offline:', e.message);
            return null;
        }
    },

    async createNote(note) {
        try {
            const response = await fetch(`${API_BASE_URL}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(note)
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.note : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (createNote) Offline:', e.message);
            return null;
        }
    },

    async updateNote(id, note) {
        try {
            const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(note)
            });
            if (response.ok) {
                const res = await response.json();
                return res.success ? res.data.note : null;
            }
            return null;
        } catch (e) {
            console.warn('📡 API (updateNote) Offline:', e.message);
            return null;
        }
    },

    async deleteNote(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const res = await response.json();
                return res.success;
            }
            return false;
        } catch (e) {
            console.warn('📡 API (deleteNote) Offline:', e.message);
            return false;
        }
    }
};

window.ApiClient = ApiClient;

