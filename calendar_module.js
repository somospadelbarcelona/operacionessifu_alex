/**
 * CALENDAR MODULE - Calendario Inteligente Integrado (V2 - Mejorado)
 * Vista de calendario con eventos críticos, vacaciones, contratos y auditorías.
 * Integración con ML Engine y búsqueda avanzada.
 */

const CalendarModule = {
    currentDate: new Date(),
    events: [],
    view: 'month', // month, week, day
    searchQuery: '',
    editingDate: null,

    init() {
        console.log('📅 Inicializando Calendario Inteligente V2...');
        this.loadEvents();
        this.generateEventsFromData();
        this.render();
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Escuchar cambios en los datos del estado para regenerar eventos si es necesario
        window.addEventListener('stateUpdated', () => {
            this.generateEventsFromData();
            this.render();
        });
    },

    loadEvents() {
        const saved = localStorage.getItem('sifu_calendar_events_v2');
        if (saved) {
            this.events = JSON.parse(saved);
        }
    },

    saveEvents() {
        localStorage.setItem('sifu_calendar_events_v2', JSON.stringify(this.events));
    },

    generateEventsFromData() {
        if (!window.state || !window.state.masterData) return;

        const generatedEvents = [];
        const today = new Date();

        window.state.masterData.forEach(service => {
            // 1. CONTRATOS QUE TERMINAN
            if (service['FIN CONTRATO']) {
                const endDate = this.excelDateToJS(service['FIN CONTRATO']);
                if (endDate) {
                    generatedEvents.push({
                        id: `contract_end_${service.PROYECTO}`,
                        type: 'contract_end',
                        title: `Contrato: ${service.TITULAR || 'S/N'}`,
                        description: `Fin de contrato en ${service.SERVICIO}`,
                        date: endDate,
                        color: '#ea4335',
                        icon: '📅',
                        data: service
                    });
                }
            }

            // 2. VACACIONES
            if (service['VACACIONES 2026']) {
                const vacDates = this.parseVacationPeriod(service['VACACIONES 2026']);
                if (vacDates) {
                    generatedEvents.push({
                        id: `vacation_${service.PROYECTO}`,
                        type: 'vacation',
                        title: `Vacaciones: ${service.TITULAR}`,
                        description: service.SERVICIO,
                        date: vacDates.start,
                        endDate: vacDates.end,
                        color: '#fbbc04',
                        icon: '🏖️',
                        data: service
                    });
                }
            }
        });

        // 3. INTEGRACIÓN CON ML ENGINE (ALERTAS DE RIESGO)
        if (window.MLEngine && window.MLEngine.predictions) {
            window.MLEngine.predictions.forEach(pred => {
                // Como las predicciones suelen ser para "próximos días", las ponemos para hoy/mañana 
                // o según la lógica del motor. Aquí simulamos una alerta para hoy.
                generatedEvents.push({
                    id: `risk_${pred.proyecto}`,
                    type: 'risk_alert',
                    title: `RIESGO: ${pred.risk}`,
                    description: `${pred.service}: ${pred.reason}`,
                    date: new Date(),
                    color: '#ff6b6b',
                    icon: '⚠️',
                    isRisk: true
                });
            });
        }

        // Mantener solo los eventos manuales del usuario + los nuevos generados
        const manualEvents = this.events.filter(e => e.custom);
        this.events = [...manualEvents, ...generatedEvents];
        this.saveEvents();
    },

    render() {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        // Búsqueda: Filtrar eventos si hay query
        const filteredEvents = this.searchQuery ?
            this.events.filter(e =>
                e.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (e.description && e.description.toLowerCase().includes(this.searchQuery.toLowerCase()))
            ) : this.events;

        const html = `
            <div class="calendar-header">
                <div class="calendar-controls">
                    <button class="btn-calendar" onclick="CalendarModule.previousPeriod()">◀</button>
                    <h3 class="calendar-title">${this.getTitle()}</h3>
                    <button class="btn-calendar" onclick="CalendarModule.nextPeriod()">▶</button>
                    <button class="btn-calendar today" onclick="CalendarModule.today()">Hoy</button>
                </div>

                <div class="calendar-search">
                    <input type="text" placeholder="Buscar evento..." 
                        oninput="CalendarModule.handleSearch(this.value)" 
                        value="${this.searchQuery}"
                        style="padding: 8px 12px; border-radius: 20px; border: 1px solid #ddd; width: 200px;">
                </div>

                <div class="calendar-view-switcher">
                    <button class="btn-view ${this.view === 'month' ? 'active' : ''}" onclick="CalendarModule.changeView('month')">Mes</button>
                    <button class="btn-view ${this.view === 'week' ? 'active' : ''}" onclick="CalendarModule.changeView('week')">Semana</button>
                    <button class="btn-view ${this.view === 'day' ? 'active' : ''}" onclick="CalendarModule.changeView('day')">Día</button>
                </div>
            </div>

            <div class="calendar-legend">
                <span class="legend-item"><span class="legend-dot" style="background: #ea4335;"></span> Contratos</span>
                <span class="legend-item"><span class="legend-dot" style="background: #fbbc04;"></span> Vacaciones</span>
                <span class="legend-item"><span class="legend-dot" style="background: #ff6b6b;"></span> Riesgo ML</span>
                <span class="legend-item"><span class="legend-dot" style="background: #4285f4;"></span> Personal</span>
            </div>

            <div class="calendar-body">
                ${this.renderCalendarView(filteredEvents)}
            </div>
        `;

        container.innerHTML = html;
    },

    renderCalendarView(events) {
        if (this.view === 'month') return this.renderMonthView(events);
        if (this.view === 'week') return this.renderWeekView(events);
        return this.renderDayView(events);
    },

    renderMonthView(events) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Ajuste para empezar en Lunes (getDay() 1=Lunes, 0=Domingo)
        let startDayOffset = firstDay.getDay() - 1;
        if (startDayOffset === -1) startDayOffset = 6; // Domingo

        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDayOffset);

        let html = `
            <div class="calendar-month">
                <div class="calendar-weekdays">
                    <div class="weekday">Lun</div><div class="weekday">Mar</div><div class="weekday">Mié</div>
                    <div class="weekday">Jue</div><div class="weekday">Vie</div><div class="weekday">Sáb</div><div class="weekday">Dom</div>
                </div>
                <div class="calendar-days">
        `;

        let tempDate = new Date(startDate);
        for (let i = 0; i < 42; i++) {
            if (i % 7 === 0) html += `<div class="calendar-week">`;

            const isCurrentMonth = tempDate.getMonth() === month;
            const isToday = this.isSameDay(tempDate, new Date());
            const dayEvents = this.getEventsForDate(tempDate, events);
            const hasRisk = dayEvents.some(e => e.isRisk);

            html += `
                <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasRisk ? 'risk-day' : ''}" 
                    onclick="CalendarModule.showDayDetails('${tempDate.toISOString()}')">
                    <div class="day-number">${tempDate.getDate()}</div>
                    <div class="day-events">
                        ${dayEvents.slice(0, 3).map(e => `
                            <div class="event-dot" style="background: ${e.color};" title="${e.title}"></div>
                        `).join('')}
                        ${dayEvents.length > 3 ? `<div class="event-more">+${dayEvents.length - 3}</div>` : ''}
                    </div>
                </div>
            `;

            if (i % 7 === 6) html += `</div>`;
            tempDate.setDate(tempDate.getDate() + 1);
        }

        html += `</div></div>`;
        return html;
    },

    renderWeekView(events) {
        const startOfWeek = new Date(this.currentDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Ajuste a Lunes
        startOfWeek.setDate(diff);

        let html = `<div class="calendar-week-grid">`;

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            const dayEvents = this.getEventsForDate(date, events);
            const isToday = this.isSameDay(date, new Date());

            html += `
                <div class="week-column ${isToday ? 'today' : ''}" onclick="CalendarModule.showDayDetails('${date.toISOString()}')">
                    <div class="week-column-header">
                        ${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                    </div>
                    <div class="week-column-events">
                        ${dayEvents.map(e => `
                            <div class="week-mini-event" style="background: ${e.color};">
                                ${e.icon} ${e.title}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    },

    renderDayView(events) {
        const dayEvents = this.getEventsForDate(this.currentDate, events);
        return `
            <div class="calendar-day-view">
                <h4 style="margin-bottom: 20px;">Operativa del ${this.currentDate.toLocaleDateString('es-ES', { dateStyle: 'long' })}</h4>
                ${dayEvents.length === 0 ? '<div class="empty-state">No hay eventos para hoy</div>' : ''}
                <div class="events-detailed-list">
                    ${dayEvents.map(e => `
                        <div class="calendar-event-item" style="border-left-color: ${e.color};">
                            <div class="event-icon-circle">${e.icon}</div>
                            <div class="event-info">
                                <div class="event-item-title">${e.title}</div>
                                <div class="event-item-desc">${e.description || ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // --- LOGICA DE MODAL ---
    showDayDetails(dateIso) {
        const date = new Date(dateIso);
        this.editingDate = date;

        const modal = document.getElementById('calendar-modal');
        if (!modal) return;

        document.getElementById('calendar-modal-date').textContent = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        this.switchModalTab('events');
        this.renderModalEvents();

        modal.style.display = 'flex';
    },

    renderModalEvents() {
        const list = document.getElementById('calendar-modal-list');
        const dayEvents = this.getEventsForDate(this.editingDate, this.events);

        if (dayEvents.length === 0) {
            list.innerHTML = `<div class="empty-events">🏖️ No hay eventos programados.</div>`;
            return;
        }

        list.innerHTML = dayEvents.map(e => `
            <div class="calendar-event-item" style="border-left-color: ${e.color};">
                <div class="event-icon-circle">${e.icon}</div>
                <div class="event-info">
                    <div class="event-item-title">${e.title}</div>
                    <div class="event-item-desc">${e.description || ''}</div>
                </div>
                ${e.custom ? `<button class="btn-delete-event" onclick="CalendarModule.deleteEvent('${e.id}')">🗑️</button>` : ''}
            </div>
        `).join('');
    },

    switchModalTab(tab) {
        const eventsTab = document.getElementById('calendar-modal-content-events');
        const addTab = document.getElementById('calendar-modal-content-add');
        const btnEvents = document.getElementById('tab-btn-events');
        const btnAdd = document.getElementById('tab-btn-add');

        if (tab === 'events') {
            eventsTab.classList.add('active');
            addTab.classList.remove('active');
            btnEvents.classList.add('active');
            btnAdd.classList.remove('active');
            this.renderModalEvents();
        } else {
            eventsTab.classList.remove('active');
            addTab.classList.add('active');
            btnEvents.classList.remove('active');
            btnAdd.classList.add('active');
        }
    },

    handleFormSubmit(e) {
        e.preventDefault();
        const title = document.getElementById('event-title').value;
        const desc = document.getElementById('event-desc').value;
        const tag = document.getElementById('event-tag-type').value;

        const colors = {
            manual_event: '#4285f4',
            manual_urgent: '#ea4335',
            manual_audit: '#34a853',
            manual_task: '#764ba2'
        };

        const icons = {
            manual_event: '📌',
            manual_urgent: '🚨',
            manual_audit: '⭐',
            manual_task: '📝'
        };

        this.addEvent({
            title,
            description: desc,
            type: tag,
            date: this.editingDate,
            color: colors[tag] || '#4285f4',
            icon: icons[tag] || '📌'
        });

        e.target.reset();
        this.switchModalTab('events');
    },

    addEvent(event) {
        event.id = `user_${Date.now()}`;
        event.custom = true;
        this.events.push(event);
        this.saveEvents();
        this.render();
        if (typeof showToast === 'function') showToast('✅ Evento guardado');
    },

    deleteEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
        this.saveEvents();
        this.renderModalEvents();
        this.render();
    },

    closeModal() {
        document.getElementById('calendar-modal').style.display = 'none';
    },

    // --- UTILIDADES ---
    getEventsForDate(date, eventList) {
        return eventList.filter(e => {
            const evDate = new Date(e.date);
            if (this.isSameDay(evDate, date)) return true;
            if (e.endDate) {
                const end = new Date(e.endDate);
                return date >= evDate && date <= end;
            }
            return false;
        });
    },

    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    },

    handleSearch(val) {
        this.searchQuery = val;
        this.render();
    },

    changeView(v) { this.view = v; this.render(); },
    today() { this.currentDate = new Date(); this.render(); },
    previousPeriod() {
        const offset = this.view === 'month' ? -1 : (this.view === 'week' ? -7 : -1);
        if (this.view === 'month') this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        else this.currentDate.setDate(this.currentDate.getDate() + offset);
        this.render();
    },
    nextPeriod() {
        const offset = this.view === 'month' ? 1 : (this.view === 'week' ? 7 : 1);
        if (this.view === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        else this.currentDate.setDate(this.currentDate.getDate() + offset);
        this.render();
    },

    getTitle() {
        const options = this.view === 'month' ? { month: 'long', year: 'numeric' } : { dateStyle: 'medium' };
        return this.currentDate.toLocaleDateString('es-ES', options).toUpperCase();
    },

    excelDateToJS(ed) { return ed ? new Date((ed - 25569) * 86400 * 1000) : null; },

    parseVacationPeriod(v) {
        const m = v.match(/(\d{1,2})\/(\d{1,2})\s+al\s+(\d{1,2})\/(\d{1,2})/);
        if (!m) return null;
        const y = new Date().getFullYear();
        return { start: new Date(y, m[2] - 1, m[1]), end: new Date(y, m[4] - 1, m[3]) };
    }
};

// Inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CalendarModule.init());
} else {
    CalendarModule.init();
}
