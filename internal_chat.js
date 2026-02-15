/**
 * INTERNAL CHAT SYSTEM - Sistema de Chat Interno
 * Mensajería integrada para comunicación del equipo
 */

const InternalChat = {
    messages: [],
    users: new Set(),
    currentUser: null,
    unreadCount: 0,
    isOpen: false,

    init() {
        console.log('💬 Inicializando Chat Interno...');
        this.loadMessages();
        this.loadUsers();
        this.setupCurrentUser();
        this.createChatUI();
        this.startPolling();
    },

    setupCurrentUser() {
        // Intentar obtener usuario guardado
        let user = localStorage.getItem('sifu_chat_user');

        if (!user) {
            // Solicitar nombre de usuario
            user = prompt('Introduce tu nombre para el chat:', 'Usuario');
            if (user) {
                localStorage.setItem('sifu_chat_user', user);
            } else {
                user = 'Usuario' + Math.floor(Math.random() * 1000);
            }
        }

        this.currentUser = user;
        this.users.add(user);
        this.saveUsers();
    },

    loadMessages() {
        const saved = localStorage.getItem('sifu_chat_messages_v1');
        if (saved) {
            try {
                this.messages = JSON.parse(saved);
                this.calculateUnread();
            } catch (e) {
                console.error('Error cargando mensajes:', e);
                this.messages = [];
            }
        }
    },

    saveMessages() {
        localStorage.setItem('sifu_chat_messages_v1', JSON.stringify(this.messages));
    },

    loadUsers() {
        const saved = localStorage.getItem('sifu_chat_users_v1');
        if (saved) {
            try {
                this.users = new Set(JSON.parse(saved));
            } catch (e) {
                console.error('Error cargando usuarios:', e);
            }
        }
    },

    saveUsers() {
        localStorage.setItem('sifu_chat_users_v1', JSON.stringify([...this.users]));
    },

    calculateUnread() {
        const lastRead = localStorage.getItem('sifu_chat_last_read');
        const lastReadTime = lastRead ? new Date(lastRead) : new Date(0);

        this.unreadCount = this.messages.filter(msg =>
            new Date(msg.timestamp) > lastReadTime &&
            msg.user !== this.currentUser
        ).length;

        this.updateBadge();
    },

    updateBadge() {
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    createChatUI() {
        // Crear botón flotante de chat
        const chatButton = document.createElement('button');
        chatButton.id = 'chat-float-button';
        chatButton.className = 'chat-float-button';
        chatButton.innerHTML = `
            💬
            <span id="chat-unread-badge" class="chat-unread-badge" style="display: none;">0</span>
        `;
        chatButton.onclick = () => this.toggleChat();
        document.body.appendChild(chatButton);

        // Crear panel de chat
        const chatPanel = document.createElement('div');
        chatPanel.id = 'chat-panel';
        chatPanel.className = 'chat-panel';
        chatPanel.innerHTML = `
            <div class="chat-header">
                <div class="chat-title">
                    <span class="chat-icon">💬</span>
                    <span>Chat Interno</span>
                    <span class="chat-online-count" id="chat-online-count">
                        <span class="online-dot"></span> ${this.users.size}
                    </span>
                </div>
                <button class="chat-close-btn" onclick="InternalChat.toggleChat()">×</button>
            </div>
            
            <div class="chat-users-bar" id="chat-users-bar">
                <!-- Users will be rendered here -->
            </div>

            <div class="chat-messages" id="chat-messages-container">
                <!-- Messages will be rendered here -->
            </div>

            <div class="chat-input-container">
                <input 
                    type="text" 
                    id="chat-message-input" 
                    class="chat-input" 
                    placeholder="Escribe un mensaje..."
                    maxlength="500"
                />
                <button class="chat-send-btn" onclick="InternalChat.sendMessage()">
                    Enviar
                </button>
            </div>
        `;
        document.body.appendChild(chatPanel);

        // Setup input listener
        const input = document.getElementById('chat-message-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        this.updateBadge();
        this.renderUsers();
        this.renderMessages();
    },

    toggleChat() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('chat-panel');

        if (panel) {
            if (this.isOpen) {
                panel.classList.add('open');
                this.markAsRead();
                this.scrollToBottom();

                // Focus input
                const input = document.getElementById('chat-message-input');
                if (input) setTimeout(() => input.focus(), 100);
            } else {
                panel.classList.remove('open');
            }
        }
    },

    renderUsers() {
        const container = document.getElementById('chat-users-bar');
        if (!container) return;

        const usersArray = [...this.users];

        const html = usersArray.map(user => `
            <div class="chat-user-chip ${user === this.currentUser ? 'current-user' : ''}">
                <span class="user-avatar">${user.charAt(0).toUpperCase()}</span>
                <span class="user-name">${user}</span>
                ${user === this.currentUser ? '<span class="user-you">(Tú)</span>' : ''}
            </div>
        `).join('');

        container.innerHTML = html;

        // Update count
        const countEl = document.getElementById('chat-online-count');
        if (countEl) {
            countEl.innerHTML = `<span class="online-dot"></span> ${this.users.size}`;
        }
    },

    renderMessages() {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="chat-empty-state">
                    <div class="empty-icon">💬</div>
                    <p>No hay mensajes aún</p>
                    <p class="empty-subtitle">Sé el primero en escribir</p>
                </div>
            `;
            return;
        }

        const html = this.messages.map((msg, index) => {
            const isOwn = msg.user === this.currentUser;
            const showAvatar = index === 0 || this.messages[index - 1].user !== msg.user;
            const timestamp = new Date(msg.timestamp);
            const timeStr = timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="chat-message ${isOwn ? 'own-message' : 'other-message'}">
                    ${!isOwn && showAvatar ? `
                        <div class="message-avatar">${msg.user.charAt(0).toUpperCase()}</div>
                    ` : '<div class="message-avatar-spacer"></div>'}
                    
                    <div class="message-content">
                        ${!isOwn && showAvatar ? `
                            <div class="message-user">${msg.user}</div>
                        ` : ''}
                        <div class="message-bubble">
                            <div class="message-text">${this.escapeHtml(msg.text)}</div>
                            <div class="message-time">${timeStr}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    sendMessage() {
        const input = document.getElementById('chat-message-input');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const message = {
            id: Date.now(),
            user: this.currentUser,
            text: text,
            timestamp: new Date().toISOString()
        };

        this.messages.push(message);
        this.saveMessages();

        input.value = '';
        this.renderMessages();
        this.scrollToBottom();

        // Notificar a otros usuarios (simulado)
        this.broadcastMessage(message);
    },

    broadcastMessage(message) {
        // En una implementación real, esto enviaría el mensaje a un servidor
        // Por ahora, solo guardamos localmente

        // Simular notificación para otros usuarios
        if (typeof showToast === 'function' && !this.isOpen) {
            showToast(`💬 Nuevo mensaje de ${message.user}`, 'info');
        }
    },

    markAsRead() {
        localStorage.setItem('sifu_chat_last_read', new Date().toISOString());
        this.unreadCount = 0;
        this.updateBadge();
    },

    scrollToBottom() {
        const container = document.getElementById('chat-messages-container');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    },

    startPolling() {
        // Verificar nuevos mensajes cada 5 segundos
        setInterval(() => {
            this.checkNewMessages();
        }, 5000);
    },

    checkNewMessages() {
        // En una implementación real, esto consultaría un servidor
        // Por ahora, solo recalculamos los no leídos
        if (!this.isOpen) {
            this.calculateUnread();
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // INTEGRACIÓN CON NOTIFICACIONES
    sendNotificationMessage(title, body, url) {
        const message = {
            id: Date.now(),
            user: 'Sistema',
            text: `🔔 ${title}: ${body}`,
            timestamp: new Date().toISOString(),
            url: url
        };

        this.messages.push(message);
        this.saveMessages();

        if (this.isOpen) {
            this.renderMessages();
            this.scrollToBottom();
        } else {
            this.calculateUnread();
        }
    },

    // MENSAJES RÁPIDOS PREDEFINIDOS
    sendQuickMessage(type) {
        const quickMessages = {
            'descubierto': '🚨 Hay un servicio descubierto que requiere atención',
            'baja_it': '🏥 Nueva baja IT registrada',
            'contrato': '📄 Contrato próximo a vencer',
            'vacaciones': '🏖️ Vacaciones próximas sin suplente',
            'ok': '✅ Todo correcto',
            'ayuda': '🆘 Necesito ayuda'
        };

        const text = quickMessages[type] || type;

        const input = document.getElementById('chat-message-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    },

    // EXPORTAR CHAT
    exportChat() {
        const chatData = {
            messages: this.messages,
            users: [...this.users],
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(chatData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `chat_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('💾 Chat exportado correctamente', 'success');
        }
    },

    // LIMPIAR CHAT
    clearChat() {
        if (confirm('¿Estás seguro de que quieres borrar todo el historial de chat?')) {
            this.messages = [];
            this.saveMessages();
            this.renderMessages();

            if (typeof showToast === 'function') {
                showToast('🗑️ Chat limpiado', 'info');
            }
        }
    }
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => InternalChat.init());
} else {
    InternalChat.init();
}

// Exponer globalmente
window.InternalChat = InternalChat;
