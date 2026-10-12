// ========================================
// 📝 BLOC DE NOTAS - AUTO-SAVE
// ========================================

const NotesManager = {
    STORAGE_KEY: 'sifu_notepad_notes',
    initialized: false,

    // Cargar notas desde localStorage
    loadNotes() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            const notes = saved ? JSON.parse(saved) : [];
            console.log(`📝 Notas cargadas: ${notes.length}`);
            return notes;
        } catch (e) {
            console.error('❌ Error al cargar notas:', e);
            return [];
        }
    },

    // Guardar notas en localStorage
    saveNotes(notes) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
            console.log(`✅ ${notes.length} notas guardadas automáticamente`);
            return true;
        } catch (e) {
            console.error('❌ Error al guardar notas:', e);
            alert('Error al guardar las notas. Verifica el espacio de almacenamiento.');
            return false;
        }
    },

    // Añadir nueva nota
    addNote(text) {
        if (!text || text.trim() === '') {
            console.warn('⚠️ Texto vacío, no se añade nota');
            return false;
        }

        const notes = this.loadNotes();
        const newNote = {
            id: Date.now(),
            text: text.trim(),
            timestamp: new Date().toISOString(),
            completed: false
        };

        notes.unshift(newNote); // Añadir al principio
        const saved = this.saveNotes(notes);

        if (saved) {
            this.renderNotes();
            console.log('✅ Nota añadida:', newNote.text);
        }

        return saved;
    },

    // Eliminar nota
    deleteNote(id) {
        console.log('🗑️ Eliminando nota:', id);
        const notes = this.loadNotes();
        const filtered = notes.filter(note => note.id !== id);
        this.saveNotes(filtered);
        this.renderNotes();
    },

    // Marcar como completada
    toggleComplete(id) {
        console.log('✅ Toggle completado:', id);
        const notes = this.loadNotes();
        const note = notes.find(n => n.id === id);
        if (note) {
            note.completed = !note.completed;
            this.saveNotes(notes);
            this.renderNotes();
        }
    },

    // Renderizar notas en el DOM
    renderNotes() {
        const container = document.getElementById('top-notes-feed');
        const countBadge = document.getElementById('top-notes-count');

        if (!container) {
            console.error('❌ Contenedor top-notes-feed no encontrado');
            return;
        }

        const notes = this.loadNotes();

        // Actualizar contador
        if (countBadge) {
            countBadge.textContent = notes.length;
        }

        // Renderizar notas
        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-notes">
                    📝 No hay notas. Añade una tarea rápida arriba.
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(note => `
            <div class="note-card ${note.completed ? 'completed' : ''}" data-id="${note.id}">
                <div class="note-content">
                    <div class="note-checkbox" onclick="NotesManager.toggleComplete(${note.id})">
                        ${note.completed ? '✅' : '⬜'}
                    </div>
                    <div class="note-text ${note.completed ? 'strikethrough' : ''}">${this.escapeHtml(note.text)}</div>
                </div>
                <div class="note-actions">
                    <button class="note-delete" onclick="NotesManager.deleteNote(${note.id})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        console.log(`📋 ${notes.length} notas renderizadas`);
    },

    // Escapar HTML para prevenir XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Inicializar
    init() {
        if (this.initialized) {
            console.warn('⚠️ NotesManager ya inicializado');
            return;
        }

        console.log('🚀 Inicializando NotesManager...');

        const input = document.getElementById('quick-note-top');
        if (!input) {
            console.error('❌ Input quick-note-top no encontrado');
            return;
        }

        // Cargar y renderizar notas existentes
        this.renderNotes();

        // Evento Enter para añadir nota
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = input.value;
                if (this.addNote(text)) {
                    input.value = '';
                    input.focus();
                }
            }
        });

        this.initialized = true;
        console.log('✅ Bloc de notas inicializado con auto-guardado');
    }
};

// Inicializar cuando el DOM esté listo
function initNotepad() {
    if (document.getElementById('quick-note-top')) {
        NotesManager.init();
    } else {
        console.warn('⚠️ Esperando a que el DOM esté listo...');
        setTimeout(initNotepad, 100);
    }
}

// Intentar inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotepad);
} else {
    initNotepad();
}

console.log('📝 notepad.js cargado');
