/**
 * VACATION MODULE - Gestión Integrada y Visual de Vacaciones
 * Creado para SIFU Informer
 */

const VacationModule = {
    activeVacations: [],
    upcomingVacations: [],

    // Configuración
    cols: {
        worker: 'TRABAJADOR NOM',
        center: 'SERVICIO NOM',
        status: 'ESTADO 1',
        vacationDate: 'VACACIONES 2026', // Columna donde se suele apuntar texto de sus vacas previstas
    },

    init() {
        console.log('🏖️ Inicializando Módulo de Vacaciones...');
        this.processVacationData();
        this.renderAll();
    },

    processVacationData() {
        if (!window.state || !window.state.masterData) return;

        this.activeVacations = [];
        this.upcomingVacations = [];

        const data = window.state.masterData;

        data.forEach(row => {
            const keys = Object.keys(row);
            const statusKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'ESTADO1') || 'ESTADO 1';
            const vacKey = keys.find(k => k.toUpperCase().includes('VACACIONES')) || 'VACACIONES 2026';

            // Flexibilizando la búsqueda de la columna del trabajador
            const workerKey = keys.find(k => {
                const upper = k.toUpperCase();
                return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
            }) || 'TRABAJADOR NOM';

            const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';

            const status = (row[statusKey] || '').toString().toUpperCase();
            // Si la celda está vacía devolver 'Trabajador Desconocido'
            const worker = (row[workerKey] || '').toString().trim() || 'Trabajador Desconocido';
            const center = row[centerKey] || 'Centro No Especificado';
            const vacDate = row[vacKey] || '';

            // 1. Trabajadores que están ACTUALMENTE de vacaciones (según el Estado 1)
            if (status.includes('VACACIONES')) {
                this.activeVacations.push({ worker, center, vacDate, status });
            }
            // 2. Trabajadores con vacaciones programadas/apuntadas en la columna de VACACIONES
            else if (vacDate && vacDate.toString().trim() !== '') {
                const noteStr = vacDate.toString().trim();
                const noteLower = noteStr.toLowerCase();

                // Excluimos explícitamente textos negativos
                const exclusionWords = ['no', 'nada', 'ninguna', 'no tiene', 'falso', '-'];
                if (!exclusionWords.includes(noteLower)) {
                    this.upcomingVacations.push({ worker, center, vacDate: noteStr });
                }
            }
        });

        // Simular cobertura (Métrica ficticia pedida en el diseño)
        const d = new Date();
        const base = 90 + (d.getDate() % 8); // Entre 90% y 98%
        this.coverageRatio = base;
    },

    renderAll() {
        this.updateKPIs();
        this.renderChart();
        this.renderActive(this.activeVacations);
        this.renderUpcoming();
    },

    renderChart() {
        const canvas = document.getElementById('vacationChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Inicializar contadores por mes [Disfrutadas, Pendientes]
        const currentMonthIndex = new Date().getMonth();
        const monthlyData = Array(12).fill(0).map(() => ({ disfrutadas: 0, pendientes: 0 }));

        const monthMap = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        // Combinar activas y próximas para contarlas todas
        // Hacemos Set para que no se dupliquen trabajadores reales
        const allVacations = [...this.activeVacations, ...this.upcomingVacations];
        const processedWorkers = new Set();

        allVacations.forEach(vac => {
            // Generar un ID único. Si el trabajador es "Desconocido", creamos un ID inventado (con el centro y fecha) para no agruparlos y descartarlos por error.
            const uniqueId = vac.worker === 'Trabajador Desconocido' ? `anon-${vac.center}-${vac.vacDate}` : vac.worker;

            // Evitar contar dos veces al mismo si está repetido
            if (processedWorkers.has(uniqueId)) return;
            processedWorkers.add(uniqueId);

            if (!vac.vacDate) return;
            const textToLower = vac.vacDate.toString().toLowerCase();
            let foundMonth = -1;

            // Patrón para extraer el mes mencionado por nombre
            for (const [key, index] of Object.entries(monthMap)) {
                if (textToLower.includes(key)) {
                    foundMonth = index; // Toma el último nombre de mes que encuentre (suponiendo '1 de sep al 15 oct', agarraría oct, pero nos vale)
                }
            }

            // Si no encontró por nombre, usar RegEx MUY robusto para buscar n/n o nn/nn
            // Buscar algo como "1/09", "15/10", "1-9", "15-10"
            if (foundMonth === -1) {
                // Extracción global de posibles meses numéricos: [cualquier digito]/[uno o dos digitos de mes]
                const regex = /\b\d{1,2}[\/\-](\d{1,2})\b/g;
                let match;
                let lastMonthFound = -1;
                while ((match = regex.exec(textToLower)) !== null) {
                    const monthNum = parseInt(match[1], 10);
                    if (monthNum >= 1 && monthNum <= 12) {
                        lastMonthFound = monthNum - 1; // 0-indexed
                    }
                }
                if (lastMonthFound !== -1) {
                    foundMonth = lastMonthFound; // Agarramos el mes final si hay rango, ej "1/09 al 15/10" agarramos octubre (10)
                }
            }

            // Si encontró un mes explícito (por nombre o número)
            if (foundMonth !== -1) {
                // Si el texto dice "disfrutadas" o es un mes estrictamente pasado (y no estamos en diciembre evaluando enero del sig año)
                if (textToLower.includes('disfrutada') || textToLower.includes('realizada') || textToLower.includes('hechas') || textToLower.includes('ok') || (foundMonth < currentMonthIndex)) {
                    monthlyData[foundMonth].disfrutadas++;
                }
                // Si es el mes actual, se considera disfrutadas si está de vacaciones activamente, si no, pendiente
                else if (foundMonth === currentMonthIndex && this.activeVacations.some(v => v.worker === vac.worker)) {
                    monthlyData[foundMonth].disfrutadas++;
                }
                else {
                    monthlyData[foundMonth].pendientes++;
                }
            } else {
                // NO se detectó ningún mes en el texto
                // Si está activo AHORA (está en "activeVacations")
                if (this.activeVacations.some(v => v.worker === vac.worker)) {
                    monthlyData[currentMonthIndex].disfrutadas++;
                } else {
                    // Es una vacación pendiente genérica (no se sabe el mes, o dice "pdte").
                    // Lo asignamos al mes actual + 1 para que conste como "Pendiente próxima"
                    const nextMonth = (currentMonthIndex + 1) % 12;
                    monthlyData[nextMonth].pendientes++;
                }
            }
        });

        const dataDisfrutadas = monthlyData.map(m => m.disfrutadas);
        const dataPendientes = monthlyData.map(m => m.pendientes);

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [
                    {
                        label: 'Disfrutadas / En curso',
                        data: dataDisfrutadas,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)', // Emerald
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Pendientes (Agendadas)',
                        data: dataPendientes,
                        backgroundColor: 'rgba(245, 158, 11, 0.8)', // Amber
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: true, // Barras apiladas
                        ticks: { stepSize: 1 }
                    },
                    x: {
                        stacked: true, // Barras apiladas
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    },

    updateKPIs() {
        const countActiveEl = document.getElementById('vacation-active-count');
        const countUpcomingEl = document.getElementById('vacation-upcoming-count');
        const coverageEl = document.getElementById('vacation-coverage-ratio');

        if (countActiveEl) countActiveEl.textContent = this.activeVacations.length;
        if (countUpcomingEl) countUpcomingEl.textContent = this.upcomingVacations.length;
        if (coverageEl) coverageEl.textContent = this.coverageRatio + '%';
    },

    renderActive(dataArray) {
        const listEl = document.getElementById('vacation-active-list');
        if (!listEl) return;

        if (dataArray.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No se ha encontrado a ningún trabajador de vacaciones.</div>`;
            return;
        }

        let html = '';
        dataArray.forEach(vac => {
            html += `
                <div class="vacation-card" style="display: flex; align-items: center; padding: 15px; margin-bottom: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 15px; font-weight: bold;">
                        ${vac.worker.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${vac.worker}</div>
                        <div style="color: #64748b; font-size: 11px; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
                            <span>🏢</span> ${vac.center}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: #fef08a; color: #854d0e; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase;">Activo Ahora</span>
                        ${vac.vacDate ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">Ref: ${vac.vacDate}</div>` : ''}
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
    },

    renderUpcoming() {
        const listEl = document.getElementById('vacation-upcoming-list');
        if (!listEl) return;

        if (this.upcomingVacations.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No hay salidas programadas detectadas en el Excel.</div>`;
            return;
        }

        let html = '';
        // Mostramos las primeras 50 para no colapsar la memoria si hay muchas
        const limit = Math.min(this.upcomingVacations.length, 50);

        for (let i = 0; i < limit; i++) {
            const vac = this.upcomingVacations[i];

            html += `
                <div style="padding: 12px; border-left: 3px solid #3b82f6; background: white; margin-bottom: 8px; border-radius: 0 6px 6px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="font-weight: 600; font-size: 12px; color: #334155;">${vac.worker}</div>
                    <div style="font-size: 10px; color: #64748b; margin: 4px 0;">🏢 ${vac.center}</div>
                    <div style="font-size: 11px; color: #2563eb; font-weight: 500; display: inline-block; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
                        📅 ${vac.vacDate}
                    </div>
                </div>
            `;
        }

        if (this.upcomingVacations.length > 50) {
            html += `<div style="text-align: center; font-size: 10px; color: #94a3b8; padding: 10px;">+ ${this.upcomingVacations.length - 50} más...</div>`;
        }

        listEl.innerHTML = html;
    },

    filterActive(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            this.renderActive(this.activeVacations);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = this.activeVacations.filter(vac =>
            vac.worker.toLowerCase().includes(term) ||
            vac.center.toLowerCase().includes(term)
        );
        this.renderActive(filtered);
    }
};

window.VacationModule = VacationModule;
