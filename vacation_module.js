/**
 * VACATION MODULE v2.0 - Gestión Integrada, Planificación y Detección de Conflictos
 * Creado para SIFU Informer
 */

var VacationModule = {
    activeVacations: [],
    upcomingVacations: [],
    coverageRatio: 100,
    chartInstance: null,

    // Configuración de columnas
    cols: {
        worker: 'TRABAJADOR NOM',
        center: 'SERVICIO NOM',
        status: 'ESTADO 1',
        vacationDate: 'VACACIONES 2026',
    },

    init() {
        console.log('🏖️ Inicializando Módulo de Vacaciones v2.0...');
        try {
            this.processVacationData();
            this.populateWorkerSelect();
            this.renderAll();
            this.detectConflicts();
        } catch (error) {
            console.error("Error in VacationModule.init():", error);
            if (typeof showToast === 'function') {
                showToast("⚠️ ERROR EN MÓDULO VACACIONES: " + error.message, "danger");
            }
        }
    },

    isDateInVacationRange(vacStr, refDate = new Date()) {
        if (!vacStr) return false;
        
        // Limpiar cadena: normalizar espacios y mayúsculas
        const cleanStr = vacStr.toString().replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();
        const exclusions = ['NO', 'NADA', 'NINGUNA', 'NO TIENE', 'FALSO', '-', '', 'OBRAS'];
        if (exclusions.includes(cleanStr)) return false;
        
        // Dividir por delimitadores para manejar rangos múltiples
        const parts = cleanStr.split(/\b(?:Y\s+DEL|Y\s+EN|Y|,|;)\b|\s+(?=SEMANA)/);
        const refYear = refDate.getFullYear();
        const refTime = refDate.getTime();
        
        for (let part of parts) {
            part = part.trim();
            if (!part) continue;
            
            // Match rango estándar: ej "01/06 AL 30/06" o "29/06/2026 - 12/07/2026"
            const rangeRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(?:AL|A|-)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
            const rangeMatch = part.match(rangeRegex);
            
            if (rangeMatch) {
                const startDay = parseInt(rangeMatch[1], 10);
                const startMonth = parseInt(rangeMatch[2], 10) - 1; // Mes 0-indexado
                let startYear = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : refYear;
                if (startYear < 100) startYear += 2000;
                
                const endDay = parseInt(rangeMatch[4], 10);
                const endMonth = parseInt(rangeMatch[5], 10) - 1; // Mes 0-indexado
                let endYear = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : refYear;
                if (endYear < 100) endYear += 2000;
                
                // Ajustar si cruza fin de año (ej 21/12 al 05/01)
                if (!rangeMatch[6] && endMonth < startMonth) {
                    endYear = startYear + 1;
                }
                
                const startDate = new Date(startYear, startMonth, startDay);
                const endDate = new Date(endYear, endMonth, endDay);
                endDate.setHours(23, 59, 59, 999);
                
                if (refTime >= startDate.getTime() && refTime <= endDate.getTime()) {
                    return true;
                }
            } else {
                // Chequear por "SEMANA DD/MM"
                const semanaRegex = /SEMANA\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
                const semanaMatch = part.match(semanaRegex);
                if (semanaMatch) {
                    const startDay = parseInt(semanaMatch[1], 10);
                    const startMonth = parseInt(semanaMatch[2], 10) - 1;
                    let startYear = semanaMatch[3] ? parseInt(semanaMatch[3], 10) : refYear;
                    if (startYear < 100) startYear += 2000;
                    
                    const startDate = new Date(startYear, startMonth, startDay);
                    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000); // 7 días después
                    
                    if (refTime >= startDate.getTime() && refTime <= endDate.getTime()) {
                        return true;
                    }
                } else {
                    // Chequear por nombre de mes completo ("JUNIO", etc)
                    const months = {
                        'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
                        'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
                    };
                    for (const [mName, mIdx] of Object.entries(months)) {
                        if (part === mName || part.includes(mName)) {
                            if (refDate.getMonth() === mIdx && refDate.getFullYear() === refYear) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
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
            const workerKey = keys.find(k => {
                const upper = k.toUpperCase();
                return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
            }) || 'TRABAJADOR NOM';
            const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';

            const status = (row[statusKey] || '').toString().toUpperCase();
            const worker = (row[workerKey] || '').toString().trim() || 'Trabajador Desconocido';
            const center = row[centerKey] || 'Centro No Especificado';
            const vacDate = row[vacKey] || '';

            const isOnVacationToday = this.isDateInVacationRange(vacDate);

            // 1. Trabajadores activos de vacaciones hoy (por estado de columna o porque cae en fecha hoy)
            if (status.includes('VACACIONES') || isOnVacationToday) {
                this.activeVacations.push({ worker, center, vacDate, status: status || 'VACACIONES' });
            }
            // 2. Próximas programadas (solo si son futuras)
            else if (vacDate && vacDate.toString().trim() !== '') {
                const noteStr = vacDate.toString().trim();
                const noteLower = noteStr.toLowerCase();
                const exclusionWords = ['no', 'nada', 'ninguna', 'no tiene', 'falso', '-', 'obras'];
                if (!exclusionWords.includes(noteLower)) {
                    const range = this.parseVacationRange(noteStr);
                    let isPast = false;
                    if (range) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (range.end < today) {
                            isPast = true;
                        }
                    }
                    if (!isPast) {
                        this.upcomingVacations.push({ worker, center, vacDate: noteStr });
                    }
                }
            }
        });

        // Tasa de cobertura estimada
        const totalStaff = data.length;
        const onVacation = this.activeVacations.length;
        if (totalStaff > 0) {
            this.coverageRatio = Math.round(((totalStaff - onVacation) / totalStaff) * 100);
        } else {
            this.coverageRatio = 100;
        }
    },

    populateWorkerSelect() {
        const datalist = document.getElementById('vacation-workers-datalist');
        if (!datalist || !window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';

        // Obtener trabajadores ordenados
        const workers = [...new Set(window.state.masterData
            .map(row => (row[workerKey] || '').toString().trim())
            .filter(name => name !== ''))
        ].sort();

        datalist.innerHTML = workers.map(w => `<option value="${w}"></option>`).join('');
    },

    renderAll() {
        this.updateKPIs();
        this.renderChart();
        this.applyActiveFilters();
        this.applyUpcomingFilters();
    },

    renderChart() {
        const canvas = document.getElementById('vacationChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const currentMonthIndex = new Date().getMonth();
        const monthlyData = Array(12).fill(0).map(() => ({ disfrutadas: 0, pendientes: 0 }));

        const monthMap = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        const allVacations = [...this.activeVacations, ...this.upcomingVacations];
        const processedWorkers = new Set();

        allVacations.forEach(vac => {
            const uniqueId = vac.worker === 'Trabajador Desconocido' ? `anon-${vac.center}-${vac.vacDate}` : vac.worker;
            if (processedWorkers.has(uniqueId)) return;
            processedWorkers.add(uniqueId);

            if (!vac.vacDate) return;
            const textToLower = vac.vacDate.toString().toLowerCase();
            let foundMonth = -1;

            for (const [key, index] of Object.entries(monthMap)) {
                if (textToLower.includes(key)) {
                    foundMonth = index;
                }
            }

            if (foundMonth === -1) {
                const regex = /\b\d{1,2}[\/\-](\d{1,2})\b/g;
                let match;
                let lastMonthFound = -1;
                while ((match = regex.exec(textToLower)) !== null) {
                    const monthNum = parseInt(match[1], 10);
                    if (monthNum >= 1 && monthNum <= 12) {
                        lastMonthFound = monthNum - 1;
                    }
                }
                if (lastMonthFound !== -1) {
                    foundMonth = lastMonthFound;
                }
            }

            if (foundMonth !== -1) {
                if (textToLower.includes('disfrutada') || textToLower.includes('realizada') || textToLower.includes('hechas') || textToLower.includes('ok') || (foundMonth < currentMonthIndex)) {
                    monthlyData[foundMonth].disfrutadas++;
                } else if (foundMonth === currentMonthIndex && this.activeVacations.some(v => v.worker === vac.worker)) {
                    monthlyData[foundMonth].disfrutadas++;
                } else {
                    monthlyData[foundMonth].pendientes++;
                }
            } else {
                if (this.activeVacations.some(v => v.worker === vac.worker)) {
                    monthlyData[currentMonthIndex].disfrutadas++;
                } else {
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
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Pendientes',
                        data: dataPendientes,
                        backgroundColor: '#fbbf24',
                        borderColor: '#d97706',
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
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11, family: 'Outfit' } }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: true,
                        ticks: { font: { family: 'Outfit' }, stepSize: 1 }
                    },
                    x: {
                        stacked: true,
                        ticks: { font: { family: 'Outfit' } }
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

    parseVacationRange(vacStr) {
        if (!vacStr) return null;
        const cleanStr = vacStr.toString().replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();
        const exclusions = ['NO', 'NADA', 'NINGUNA', 'NO TIENE', 'FALSO', '-', '', 'OBRAS'];
        if (exclusions.includes(cleanStr)) return null;

        const refYear = new Date().getFullYear();

        // 1. Rango estándar: "01/06 AL 30/06" o "29/06/2026 - 12/07/2026"
        const rangeRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(?:AL|A|-)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
        const rangeMatch = cleanStr.match(rangeRegex);

        if (rangeMatch) {
            const startDay = parseInt(rangeMatch[1], 10);
            const startMonth = parseInt(rangeMatch[2], 10) - 1;
            let startYear = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : refYear;
            if (startYear < 100) startYear += 2000;

            const endDay = parseInt(rangeMatch[4], 10);
            const endMonth = parseInt(rangeMatch[5], 10) - 1;
            let endYear = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : refYear;
            if (endYear < 100) endYear += 2000;

            if (!rangeMatch[6] && endMonth < startMonth) {
                endYear = startYear + 1;
            }

            const start = new Date(startYear, startMonth, startDay);
            const end = new Date(endYear, endMonth, endDay);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }

        // 2. Semana: "SEMANA 20/07"
        const semanaRegex = /SEMANA\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
        const semanaMatch = cleanStr.match(semanaRegex);
        if (semanaMatch) {
            const startDay = parseInt(semanaMatch[1], 10);
            const startMonth = parseInt(semanaMatch[2], 10) - 1;
            let startYear = semanaMatch[3] ? parseInt(semanaMatch[3], 10) : refYear;
            if (startYear < 100) startYear += 2000;

            const start = new Date(startYear, startMonth, startDay);
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
            return { start, end };
        }

        // 3. Mes completo: "JUNIO"
        const months = {
            'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
            'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
        };
        for (const [mName, mIdx] of Object.entries(months)) {
            if (cleanStr === mName || cleanStr.includes(mName)) {
                const start = new Date(refYear, mIdx, 1);
                const end = new Date(refYear, mIdx + 1, 0, 23, 59, 59, 999);
                return { start, end };
            }
        }

        return null;
    },

    getVacationDetails(vacDate) {
        const range = this.parseVacationRange(vacDate);
        if (!range) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);

        const end = new Date(range.end);
        end.setHours(23, 59, 59, 999);

        const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let statusText = '';
        let statusClass = '';
        let daysUntil = 0;

        if (today >= start && today <= end) {
            statusText = 'Activa y En curso';
            statusClass = 'active-now';
        } else if (today < start) {
            daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil === 1) {
                statusText = 'Empieza mañana';
                statusClass = 'starts-tomorrow';
            } else {
                statusText = `Empieza en ${daysUntil} días`;
                statusClass = 'starts-future';
            }
        } else {
            statusText = 'Finalizada';
            statusClass = 'finished';
        }

        return {
            start,
            end,
            durationDays,
            daysUntil,
            statusText,
            statusClass
        };
    },

    getSubstituteCoverage(worker, center) {
        try {
            const clean = (str) => (str || '').toString().toLowerCase().replace(/\s/g, '');
            const cleanWorker = clean(worker);
            const cleanCenter = clean(center);

            let assignment = null;
            if (typeof SubstituteManagement !== 'undefined' && SubstituteManagement.assignments) {
                assignment = SubstituteManagement.assignments.find(a => 
                    clean(a.originalTitular) === cleanWorker && 
                    clean(a.service) === cleanCenter && 
                    a.status === 'active'
                );
            }
            
            if (!assignment) {
                const saved = localStorage.getItem('sifu_substitute_assignments_v1');
                if (saved) {
                    const list = JSON.parse(saved);
                    assignment = list.find(a => 
                        clean(a.originalTitular) === cleanWorker && 
                        clean(a.service) === cleanCenter && 
                        a.status === 'active'
                    );
                }
            }

            return assignment ? assignment.substitute : null;
        } catch (e) {
            console.error('Error checking substitute coverage:', e);
            return null;
        }
    },

    toggleCardDetails(cardElement) {
        const detailsEl = cardElement.querySelector('.vacation-card-details');
        if (detailsEl) {
            const isCollapsed = detailsEl.style.display === 'none';
            detailsEl.style.display = isCollapsed ? 'block' : 'none';
            
            if (isCollapsed) {
                cardElement.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                cardElement.style.borderColor = '#cbd5e1';
            } else {
                cardElement.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)';
                cardElement.style.borderColor = '#e2e8f0';
            }
        }
    },

    renderVacationCard(vac, isUpcoming) {
        const substitute = this.getSubstituteCoverage(vac.worker, vac.center);
        const details = this.getVacationDetails(vac.vacDate);
        
        let stateClass = 'state-future';
        if (details) {
            if (details.statusClass === 'finished') {
                stateClass = 'state-finished';
            } else if (substitute) {
                stateClass = 'state-covered';
            } else {
                if (details.statusClass === 'active-now' || details.daysUntil <= 7) {
                    stateClass = 'state-critical';
                } else if (details.daysUntil <= 30) {
                    stateClass = 'state-warning';
                } else {
                    stateClass = 'state-future';
                }
            }
        } else {
            stateClass = substitute ? 'state-covered' : 'state-warning';
        }

        const cleanWorkerName = vac.worker.replace(/'/g, "\\'");
        const cleanCenterName = vac.center.replace(/'/g, "\\'");

        // Calcular claves de masterData para obtener listado de trabajadores y sugerencias IA
        let workerKey = 'TRABAJADOR NOM';
        let centerKey = 'SERVICIO NOM';
        if (window.state && window.state.masterData && window.state.masterData[0]) {
            const keys = Object.keys(window.state.masterData[0]);
            workerKey = keys.find(k => {
                const upper = k.toUpperCase();
                return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
            }) || 'TRABAJADOR NOM';
            centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';
        }

        const allWorkers = (window.state && window.state.masterData) ? [...new Set(window.state.masterData
            .map(row => (row[workerKey] || '').toString().trim())
            .filter(name => name !== '' && name !== vac.worker))
        ].sort() : [];

        const serviceRow = (window.state && window.state.masterData) ? window.state.masterData.find(r => 
            (r[workerKey] || '').toString().trim() === vac.worker &&
            (r[centerKey] || '').toString().trim() === vac.center
        ) : null;

        let iaSuggestionsHTML = '';
        if (serviceRow && typeof SubstituteManagement !== 'undefined' && typeof SubstituteManagement.findBestSubstitutes === 'function') {
            const suggestions = SubstituteManagement.findBestSubstitutes(serviceRow, 3);
            if (suggestions && suggestions.length > 0) {
                iaSuggestionsHTML = `
                    <optgroup label="⭐ Recomendados por IA">
                        ${suggestions.map(sug => `<option value="${sug.worker}">⭐ ${sug.worker} (${sug.totalScore}% match)</option>`).join('')}
                    </optgroup>
                `;
            }
        }

        const workerOptionsHTML = allWorkers.map(w => `<option value="${w}">${w}</option>`).join('');

        const initial = vac.worker ? vac.worker.trim().charAt(0).toUpperCase() : '?';
        const avatarBg = isUpcoming ? '#eff6ff' : '#fffbeb';
        const avatarColor = isUpcoming ? '#1d4ed8' : '#d97706';

        return `
            <div class="vacation-card ${stateClass}" onclick="VacationModule.toggleCardDetails(this)" style="display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 15px; align-items: center; padding: 14px; margin-bottom: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.2s; position: relative; cursor: pointer; color: #000000 !important;">
                <!-- Columna 1: Info Trabajador -->
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; color: #000000 !important;">
                    <div class="vacation-avatar" style="width: 36px; height: 36px; background: ${avatarBg}; color: ${avatarColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; border: 1px solid ${isUpcoming ? '#dbeafe' : '#fef3c7'};">
                        ${initial}
                    </div>
                    <div style="min-width: 0; flex: 1; color: #000000 !important;">
                        <div style="font-weight: 800; color: #000000 !important; font-size: 13.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vac.worker}">
                            ${vac.worker}
                        </div>
                        <div style="color: #000000 !important; font-size: 11px; margin-top: 4px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vac.center}">
                            <span>🗂️</span> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #000000 !important;">${vac.center}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Columna 2: Fechas y Estado Temporal -->
                <div style="display: flex; flex-direction: column; gap: 5px; min-width: 0; color: #000000 !important;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <span style="display: inline-flex; align-items: center; background: ${avatarBg}; color: ${avatarColor}; border: 1px solid ${isUpcoming ? '#dbeafe' : '#fef3c7'}; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${isUpcoming ? 'PLANIFICADA' : 'ACTIVA'}
                        </span>
                    </div>
                    <div class="vacation-date-badge" style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #000000 !important; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; width: fit-content;">
                        <span>📅</span> <span style="color: #000000 !important;">${vac.vacDate}</span>
                    </div>
                    ${details ? `
                        <div style="font-size: 10px; font-weight: 700; color: #000000 !important; display: flex; align-items: center; gap: 4px; padding-left: 4px;">
                            <span>⏱️</span> <span style="color: #000000 !important;">${details.durationDays} días • ${details.statusText}</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Columna 3: Cobertura & Acciones -->
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 0; color: #000000 !important;">
                    ${substitute ? `
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; max-width: 100%; color: #000000 !important;">
                            <span class="substitute-badge-covered" style="display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #000000 !important; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 12px; font-size: 9.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="Suplido por ${substitute}">
                                🛡️ <span style="color: #000000 !important;">${substitute}</span>
                            </span>
                            <button class="vacation-btn-action" onclick="event.stopPropagation(); VacationModule.removeSubstituteInSitu('${cleanWorkerName}', '${cleanCenterName}')" style="background: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; height: 24px;" title="Quitar Suplente">
                                ❌
                            </button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; width: 100%; color: #000000 !important;">
                            <span class="substitute-badge-uncovered" style="display: inline-flex; align-items: center; gap: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; white-space: nowrap;">
                                ⚠️ Sin Suplente
                            </span>
                            <select class="vacation-select-sub" onchange="event.stopPropagation(); if(this.value === 'ADD_NEW_WORKER_IN_SITU') { this.value = ''; VacationModule.promptAddNewWorkerInSitu('${cleanWorkerName}', '${cleanCenterName}', this); } else { VacationModule.assignSubstituteInSitu('${cleanWorkerName}', '${cleanCenterName}', this.value); }" style="width: 125px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 9.5px; font-weight: 700; color: #000000 !important; background: white; cursor: pointer; font-family: 'Outfit'; margin-top: 4px;">
                                <option value="" style="color: #000000 !important;">➕ Elegir Suplente...</option>
                                <option value="ADD_NEW_WORKER_IN_SITU" style="font-weight: 800; color: #2563eb; background: #e0f2fe;">➕ [Nuevo suplente...]</option>
                                ${iaSuggestionsHTML}
                                <optgroup label="👥 Todos los trabajadores" style="color: #000000 !important;">
                                    ${workerOptionsHTML}
                                </optgroup>
                            </select>
                        </div>
                    `}
                    
                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                        ${!substitute && isUpcoming ? `
                            <button class="vacation-btn-action primary" onclick="event.stopPropagation(); VacationModule.promptAssignSubstitute('${cleanWorkerName}', '${cleanCenterName}')" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 5px 10px; border-radius: 8px; font-size: 9.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                                🤖 IA Match
                            </button>
                        ` : ''}
                        <button class="vacation-btn-action" onclick="event.stopPropagation(); VacationModule.promptDeleteVacation('${cleanWorkerName}')" style="background: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; padding: 5px 10px; border-radius: 8px; font-size: 9.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Eliminar Planificación">
                            🗑️
                        </button>
                    </div>
                </div>

                <!-- Detalle Desplegable -->
                <div class="vacation-card-details" style="display: none; grid-column: span 3; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; color: #000000 !important; font-size: 11.5px; line-height: 1.5; text-align: left; width: 100%;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 15px; color: #000000 !important;">
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">🆔 ID Trabajador:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.ID || 'N/A' : 'N/A'}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">📁 Proyecto:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.PROYECTO || 'N/A' : 'N/A'}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">⏰ Horario:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.HORARIO || 'N/A' : 'N/A'}</span></div>
                        <div style="color: #000000 !important;"><strong style="color: #000000 !important;">📅 Fin Contrato:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow['FIN CONTRATO'] || 'N/A' : 'N/A'}</span></div>
                        <div style="grid-column: span 2; color: #000000 !important;"><strong style="color: #000000 !important;">📍 Dirección:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow['S DIRECCION'] || 'N/A' : 'N/A'}</span></div>
                        <div style="grid-column: span 2; color: #000000 !important;"><strong style="color: #000000 !important;">💬 Observaciones:</strong> <span style="color: #000000 !important;">${serviceRow ? serviceRow.OBSERVACIONES || 'Ninguna' : 'Ninguna'}</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    promptAssignSubstitute(workerName, centerName) {
        if (!window.state || !window.state.masterData) return;
        
        const keys = Object.keys(window.state.masterData[0] || {});
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';
        const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';

        const serviceRow = window.state.masterData.find(r => 
            (r[workerKey] || '').toString().trim() === workerName &&
            (r[centerKey] || '').toString().trim() === centerName
        );

        if (!serviceRow) {
            if (typeof showToast === 'function') {
                showToast("⚠️ No se encontró la fila del servicio en Master Data", "danger");
            }
            return;
        }

        if (typeof window.switchTab === 'function') {
            window.switchTab('avanzado');
            setTimeout(() => {
                const container = document.getElementById('substitute-manager-container');
                if (container) {
                    container.scrollIntoView({ behavior: 'smooth' });
                    if (typeof SubstituteManagement !== 'undefined') {
                        SubstituteManagement.promptAssignment(serviceRow.PROYECTO, '');
                    }
                }
            }, 300);
        }
    },

    promptDeleteVacation(workerName) {
        const confirmed = confirm(`¿Estás seguro de que deseas eliminar la planificación de vacaciones de ${workerName}?`);
        if (!confirmed) return;

        if (!window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const statusKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'ESTADO1') || 'ESTADO 1';
        const vacKey = keys.find(k => k.toUpperCase().includes('VACACIONES')) || 'VACACIONES 2026';
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';

        const row = window.state.masterData.find(r => (r[workerKey] || '').toString().trim() === workerName);
        if (row) {
            row[vacKey] = '';
            if (row[statusKey] === 'VACACIONES') {
                row[statusKey] = '';
            }

            if (typeof window.saveAndRender === 'function') {
                window.saveAndRender();
            } else {
                this.processVacationData();
                this.populateWorkerSelect();
                this.renderAll();
                this.detectConflicts();
            }

            if (typeof showToast === 'function') showToast(`🗑️ Vacaciones eliminadas para ${workerName}`, "info");
        }
    },

    assignSubstituteInSitu(workerName, centerName, substituteName) {
        if (!substituteName) return;

        if (!window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';
        const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';

        const row = window.state.masterData.find(r => 
            (r[workerKey] || '').toString().trim() === workerName &&
            (r[centerKey] || '').toString().trim() === centerName
        );

        if (row) {
            const suplenteKey = keys.find(k => k.toUpperCase() === 'SUPLENTE') || 'SUPLENTE';
            row[suplenteKey] = substituteName;
            
            const estadoKey = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
            if (row[estadoKey] === 'DESCUBIERTO') {
                row[estadoKey] = 'CUBIERTO';
            }

            if (typeof SubstituteManagement !== 'undefined') {
                SubstituteManagement.assignSubstitute(row, substituteName, true);
            } else {
                try {
                    const saved = localStorage.getItem('sifu_substitute_assignments_v1');
                    const assignments = saved ? JSON.parse(saved) : [];
                    const assignment = {
                        id: `assign_${Date.now()}`,
                        service: row[centerKey] || centerName,
                        proyecto: row.PROYECTO,
                        originalTitular: workerName,
                        substitute: substituteName,
                        assignedDate: new Date().toISOString(),
                        temporary: true,
                        status: 'active',
                        notes: 'Asignado in-situ desde módulo vacaciones'
                    };
                    assignments.push(assignment);
                    localStorage.setItem('sifu_substitute_assignments_v1', JSON.stringify(assignments));
                } catch (e) {
                    console.error('Error saving assignment to localStorage:', e);
                }
            }

            if (typeof window.saveAndRender === 'function') {
                window.saveAndRender();
            } else {
                this.processVacationData();
                this.populateWorkerSelect();
                this.renderAll();
                this.detectConflicts();
            }

            if (typeof showToast === 'function') {
                showToast(`✅ ${substituteName} asignado como suplente de ${workerName}`, "success");
            }
        } else {
            if (typeof showToast === 'function') {
                showToast("⚠️ No se encontró el registro del servicio", "danger");
            }
        }
    },

    removeSubstituteInSitu(workerName, centerName) {
        const confirmed = confirm(`¿Quitar el suplente asignado para las vacaciones de ${workerName}?`);
        if (!confirmed) return;

        if (!window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';
        const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';

        const row = window.state.masterData.find(r => 
            (r[workerKey] || '').toString().trim() === workerName &&
            (r[centerKey] || '').toString().trim() === centerName
        );

        if (row) {
            const suplenteKey = keys.find(k => k.toUpperCase() === 'SUPLENTE') || 'SUPLENTE';
            row[suplenteKey] = '';
            
            const estadoKey = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
            const statusKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'ESTADO1') || 'ESTADO 1';
            if (row[statusKey] === 'VACACIONES') {
                row[estadoKey] = 'DESCUBIERTO';
            }

            if (typeof SubstituteManagement !== 'undefined') {
                const clean = (str) => (str || '').toString().toLowerCase().replace(/\s/g, '');
                const cleanWorker = clean(workerName);
                const cleanCenter = clean(centerName);
                
                const assignment = SubstituteManagement.assignments.find(a => 
                    clean(a.originalTitular) === cleanWorker && 
                    clean(a.service) === cleanCenter && 
                    a.status === 'active'
                );
                
                if (assignment) {
                    SubstituteManagement.endSubstitution(assignment.id);
                }
            } else {
                try {
                    const saved = localStorage.getItem('sifu_substitute_assignments_v1');
                    if (saved) {
                        const assignments = JSON.parse(saved);
                        const clean = (str) => (str || '').toString().toLowerCase().replace(/\s/g, '');
                        const cleanWorker = clean(workerName);
                        const cleanCenter = clean(centerName);
                        
                        const assignment = assignments.find(a => 
                            clean(a.originalTitular) === cleanWorker && 
                            clean(a.service) === cleanCenter && 
                            a.status === 'active'
                        );
                        
                        if (assignment) {
                            assignment.status = 'completed';
                            assignment.endDate = new Date().toISOString();
                            localStorage.setItem('sifu_substitute_assignments_v1', JSON.stringify(assignments));
                        }
                    }
                } catch (e) {
                    console.error('Error ending assignment in localStorage:', e);
                }
            }

            if (typeof window.saveAndRender === 'function') {
                window.saveAndRender();
            } else {
                this.processVacationData();
                this.populateWorkerSelect();
                this.renderAll();
                this.detectConflicts();
            }

            if (typeof showToast === 'function') {
                showToast(`🗑️ Suplente removido para ${workerName}`, "info");
            }
        }
    },

    applyActiveFilters() {
        const searchInput = document.getElementById('vacation-active-search');
        const sortSelect = document.getElementById('vacation-active-sort');
        const coverageSelect = document.getElementById('vacation-active-coverage');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const sort = sortSelect ? sortSelect.value : 'worker-asc';
        const coverage = coverageSelect ? coverageSelect.value : 'all';

        let filtered = [...this.activeVacations];

        if (search) {
            filtered = filtered.filter(vac => 
                vac.worker.toLowerCase().includes(search) ||
                vac.center.toLowerCase().includes(search)
            );
        }

        if (coverage !== 'all') {
            filtered = filtered.filter(vac => {
                const sub = this.getSubstituteCoverage(vac.worker, vac.center);
                return coverage === 'covered' ? !!sub : !sub;
            });
        }

        filtered.sort((a, b) => {
            if (sort === 'worker-asc') {
                return a.worker.localeCompare(b.worker);
            } else if (sort === 'center-asc') {
                return a.center.localeCompare(b.center);
            }
            return 0;
        });

        this.renderActive(filtered);
    },

    applyUpcomingFilters() {
        const searchInput = document.getElementById('vacation-upcoming-search');
        const sortSelect = document.getElementById('vacation-upcoming-sort');
        const coverageSelect = document.getElementById('vacation-upcoming-coverage');
        const timeframeSelect = document.getElementById('vacation-upcoming-timeframe');
        const monthSelect = document.getElementById('vacation-upcoming-month');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const sort = sortSelect ? sortSelect.value : 'date-asc';
        const coverage = coverageSelect ? coverageSelect.value : 'all';
        const timeframe = timeframeSelect ? timeframeSelect.value : 'all';
        const month = monthSelect ? monthSelect.value : 'all';

        let filtered = [...this.upcomingVacations];

        if (search) {
            filtered = filtered.filter(vac => 
                vac.worker.toLowerCase().includes(search) ||
                vac.center.toLowerCase().includes(search) ||
                vac.vacDate.toLowerCase().includes(search)
            );
        }

        if (coverage !== 'all') {
            filtered = filtered.filter(vac => {
                const sub = this.getSubstituteCoverage(vac.worker, vac.center);
                return coverage === 'covered' ? !!sub : !sub;
            });
        }

        if (timeframe !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let maxDays = 0;
            if (timeframe === '15days') maxDays = 15;
            else if (timeframe === '30days') maxDays = 30;
            else if (timeframe === '90days') maxDays = 90;

            filtered = filtered.filter(vac => {
                const details = this.getVacationDetails(vac.vacDate);
                if (!details) return false;
                
                if (details.statusClass === 'active-now') return true;
                return details.daysUntil > 0 && details.daysUntil <= maxDays;
            });
        }

        if (month !== 'all') {
            const monthIdx = parseInt(month, 10);
            const refYear = new Date().getFullYear();
            const monthStart = new Date(refYear, monthIdx, 1);
            const monthEnd = new Date(refYear, monthIdx + 1, 0, 23, 59, 59, 999);

            filtered = filtered.filter(vac => {
                const range = this.parseVacationRange(vac.vacDate);
                if (!range) return false;
                return range.start <= monthEnd && range.end >= monthStart;
            });
        }
        filtered.sort((a, b) => {
            const detailA = this.getVacationDetails(a.vacDate);
            const detailB = this.getVacationDetails(b.vacDate);

            if (sort === 'date-asc' || sort === 'date-desc') {
                if (!detailA) return 1;
                if (!detailB) return -1;
                return sort === 'date-asc' ? (detailA.start - detailB.start) : (detailB.start - detailA.start);
            } else if (sort === 'worker-asc') {
                return a.worker.localeCompare(b.worker);
            } else if (sort === 'center-asc') {
                return a.center.localeCompare(b.center);
            }
            return 0;
        });

        this.renderUpcomingList(filtered);
    },

    renderActive(dataArray) {
        const listEl = document.getElementById('vacation-active-list');
        if (!listEl) return;

        if (dataArray.length === 0) {
            listEl.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#64748b;">🚫 Ningún operario de vacaciones actualmente.</div>`;
            return;
        }

        listEl.innerHTML = dataArray.map(vac => this.renderVacationCard(vac, false)).join('');
    },

    renderUpcomingList(dataArray) {
        const listEl = document.getElementById('vacation-upcoming-list');
        if (!listEl) return;

        if (dataArray.length === 0) {
            listEl.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#64748b;">📅 No hay salidas planificadas registradas.</div>`;
            return;
        }

        const limit = Math.min(dataArray.length, 50);
        let html = '';

        for (let i = 0; i < limit; i++) {
            const vac = dataArray[i];
            html += this.renderVacationCard(vac, true);
        }

        if (dataArray.length > 50) {
            html += `<div style="text-align: center; font-size: 10px; color: #94a3b8; padding: 10px;">+ ${dataArray.length - 50} más...</div>`;
        }

        listEl.innerHTML = html;
    },

    handleFormSubmit() {
        const workerSelect = document.getElementById('vacation-form-worker');
        const startInput = document.getElementById('vacation-form-start');
        const endInput = document.getElementById('vacation-form-end');
        const statusSelect = document.getElementById('vacation-form-status');

        if (!workerSelect || !startInput || !endInput || !statusSelect) return;

        const worker = workerSelect.value.trim();
        const startVal = startInput.value;
        const endVal = endInput.value;
        const status = statusSelect.value; // 'VACACIONES' o 'PENDIENTE'

        if (!worker || !startVal || !endVal) {
            if (typeof showToast === 'function') showToast("⚠️ Por favor completa todos los campos", "warning");
            return;
        }

        // Formatear fechas
        const formatDate = (dateStr) => {
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}`;
        };
        const rangeText = `Del ${formatDate(startVal)} al ${formatDate(endVal)}`;

        // Encontrar trabajador en masterData
        if (!window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const statusKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'ESTADO1') || 'ESTADO 1';
        const vacKey = keys.find(k => k.toUpperCase().includes('VACACIONES')) || 'VACACIONES 2026';
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';

        let row = window.state.masterData.find(r => (r[workerKey] || '').toString().trim() === worker);
        let isNewWorker = false;

        if (!row) {
            isNewWorker = true;
            row = {};
            const templateRow = window.state.masterData[0] || {};
            Object.keys(templateRow).forEach(key => {
                row[key] = '';
            });
            
            row[workerKey] = worker;
            
            const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';
            row[centerKey] = 'SERVICIO SIN ASIGNAR';
            
            const estadoKey = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
            row[estadoKey] = 'CUBIERTO';
            
            const tipoKey = keys.find(k => k.toUpperCase() === 'TIPO S') || 'TIPO S';
            row[tipoKey] = 'NUEVO';
            
            const idKey = keys.find(k => k.toUpperCase() === 'ID') || 'ID';
            row[idKey] = 'NEW_' + Date.now();
            
            window.state.masterData.push(row);
        }

        // Modificar persistente
        if (status === 'VACACIONES') {
            row[statusKey] = 'VACACIONES';
        } else {
            row[statusKey] = '';
        }
        row[vacKey] = rangeText;

        // Guardar base de datos
        if (typeof window.saveAndRender === 'function') {
            window.saveAndRender();
        } else {
            this.processVacationData();
            this.populateWorkerSelect();
            this.renderAll();
            this.detectConflicts();
            if (typeof renderMasterBodyOnly === 'function') renderMasterBodyOnly();
        }

        const successMsg = isNewWorker 
            ? `✅ Creado trabajador nuevo y registradas vacaciones para ${worker}`
            : `✅ Vacaciones planificadas para ${worker}`;

        if (typeof showToast === 'function') showToast(successMsg, "success");

        // Reset formulario
        workerSelect.value = '';
        startInput.value = '';
        endInput.value = '';
    },

    detectConflicts() {
        const conflictCard = document.getElementById('vacation-conflict-card');
        const conflictList = document.getElementById('vacation-conflict-list');
        if (!conflictCard || !conflictList || !window.state || !window.state.masterData) return;

        const keys = Object.keys(window.state.masterData[0] || {});
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';
        const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';
        const vacKey = keys.find(k => k.toUpperCase().includes('VACACIONES')) || 'VACACIONES 2026';
        const statusKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'ESTADO1') || 'ESTADO 1';

        // Agrupar vacaciones activas/planificadas por centro
        const centerVacations = {};

        // Recopilar todas
        const allVacations = [...this.activeVacations, ...this.upcomingVacations];

        allVacations.forEach(vac => {
            if (!centerVacations[vac.center]) {
                centerVacations[vac.center] = [];
            }
            // Evitar duplicar
            if (!centerVacations[vac.center].some(v => v.worker === vac.worker)) {
                centerVacations[vac.center].push(vac);
            }
        });

        const conflicts = [];

        for (const [center, list] of Object.entries(centerVacations)) {
            // Si hay más de 1 persona de vacaciones en el mismo centro, hay conflicto táctico
            if (list.length > 1) {
                const names = list.map(v => v.worker).join(', ');
                conflicts.push(`⚠️ <strong>Conflicto en ${center}</strong>: Se detectan múltiples solicitudes/vacaciones coincidentes para: <strong>${names}</strong>. Por favor, revisa la cobertura para evitar descubiertos en el servicio.`);
            }
        }

        if (conflicts.length > 0) {
            conflictCard.style.display = 'block';
            conflictList.innerHTML = conflicts.map(c => `<div style="padding:6px 0; border-bottom:1px dashed rgba(220, 38, 38, 0.1);">${c}</div>`).join('');
        } else {
            conflictCard.style.display = 'none';
        }
    },

    filterActive(searchTerm) {
        this.applyActiveFilters();
    },

    filterUpcoming(searchTerm) {
        this.applyUpcomingFilters();
    },

    showNewWorkerModal(defaultName, callback) {
        // Remove existing modal if any
        const existing = document.getElementById('sifu-new-worker-modal');
        if (existing) existing.remove();

        const modalDiv = document.createElement('div');
        modalDiv.id = 'sifu-new-worker-modal';
        modalDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: 'Outfit', sans-serif;
        `;

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5);
            border-radius: 24px;
            width: 440px;
            max-width: 90%;
            padding: 28px;
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            color: #0f172a;
        `;

        contentDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 8px;">
                    <span>👥</span> REGISTRAR TRABAJADOR
                </h3>
                <button type="button" id="sifu-close-worker-btn" style="background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; line-height: 1; padding: 4px; transition: color 0.2s;">&times;</button>
            </div>
            
            <form id="sifu-new-worker-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre Completo *</label>
                    <input type="text" id="new-worker-name" required value="${defaultName || ''}" placeholder="Ej: LUIS ALBERTO GÓMEZ" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Servicio / Centro</label>
                    <input type="text" id="new-worker-service" value="SERVICIO GENERAL" placeholder="Ej: LIMPIEZA CENTRO CULTURAL" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div>
                    <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo de Servicio / Cliente</label>
                    <input type="text" id="new-worker-client" value="GENERAL" placeholder="Ej: ALDI" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                </div>
                <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Proyecto / Código</label>
                        <input type="text" id="new-worker-project" value="PROY-NUEVO" placeholder="Ej: SVO0001" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: 800; color: #475569; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Horario</label>
                        <input type="text" id="new-worker-schedule" value="L a V" placeholder="Ej: L a V de 8h a 14h" style="width: 100%; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #ffffff; outline: none; transition: border-color 0.2s; font-family: inherit; font-weight: 600;">
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 14px; justify-content: flex-end;">
                    <button type="button" id="sifu-cancel-worker-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit;">CANCELAR</button>
                    <button type="submit" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); transition: all 0.2s; font-family: inherit;">REGISTRAR</button>
                </div>
            </form>
        `;

        modalDiv.appendChild(contentDiv);
        document.body.appendChild(modalDiv);

        // Animation in
        setTimeout(() => {
            modalDiv.style.opacity = '1';
            contentDiv.style.transform = 'scale(1)';
        }, 10);

        // Autofocus
        setTimeout(() => {
            const nameInput = document.getElementById('new-worker-name');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 150);

        const closeModal = () => {
            modalDiv.style.opacity = '0';
            contentDiv.style.transform = 'scale(0.9)';
            setTimeout(() => {
                modalDiv.remove();
            }, 300);
        };

        document.getElementById('sifu-close-worker-btn').onclick = closeModal;
        document.getElementById('sifu-cancel-worker-btn').onclick = closeModal;

        // Input active focus styling
        const inputs = [
            'new-worker-name',
            'new-worker-service',
            'new-worker-client',
            'new-worker-project',
            'new-worker-schedule'
        ];
        inputs.forEach(id => {
            const inp = document.getElementById(id);
            if (inp) {
                inp.onfocus = () => {
                    inp.style.borderColor = '#2563eb';
                    inp.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                };
                inp.onblur = () => {
                    inp.style.borderColor = '#cbd5e1';
                    inp.style.boxShadow = 'none';
                };
            }
        });

        document.getElementById('sifu-new-worker-form').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('new-worker-name').value;
            const service = document.getElementById('new-worker-service').value;
            const client = document.getElementById('new-worker-client').value;
            const project = document.getElementById('new-worker-project').value;
            const schedule = document.getElementById('new-worker-schedule').value;

            closeModal();
            callback({ name, service, client, project, schedule });
        };
    },

    createWorkerRow(name, service, client, project, schedule) {
        if (!window.state || !window.state.masterData || !window.state.masterData[0]) return null;

        // Clonamos la estructura de la primera fila
        const template = window.state.masterData[0];
        const newRow = {};
        for (const key in template) {
            newRow[key] = "";
        }

        const keys = Object.keys(template);
        const workerKey = keys.find(k => {
            const upper = k.toUpperCase();
            return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
        }) || 'TRABAJADOR NOM';
        const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';
        const tipoSKey = keys.find(k => k.toUpperCase().replace(/\s/g, '') === 'TIPOS') || 'TIPO S';
        const proyectoKey = keys.find(k => k.toUpperCase().includes('PROYECTO')) || 'PROYECTO';
        const horarioKey = keys.find(k => k.toUpperCase().includes('HORARIO')) || 'HORARIO';
        const estadoKey = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
        const finContratoKey = keys.find(k => k.toUpperCase().includes('FIN CONTRATO')) || 'FIN CONTRATO';

        newRow[workerKey] = name.trim().toUpperCase();
        newRow[centerKey] = (service || 'SERVICIO GENERAL').trim().toUpperCase();
        newRow[tipoSKey] = (client || 'GENERAL').trim().toUpperCase();
        newRow[proyectoKey] = (project || 'PROY-NUEVO').trim().toUpperCase();
        newRow[horarioKey] = (schedule || 'L a V').trim().toUpperCase();
        newRow[estadoKey] = 'CUBIERTO';
        newRow[finContratoKey] = 'temporal';

        return newRow;
    },

    promptAddNewWorker() {
        const inputWorker = document.getElementById('vacation-form-worker');
        const typedName = inputWorker ? inputWorker.value : '';

        this.showNewWorkerModal(typedName, (data) => {
            const newRow = this.createWorkerRow(data.name, data.service, data.client, data.project, data.schedule);
            if (newRow) {
                window.state.masterData.push(newRow);

                if (typeof window.saveAndRender === 'function') {
                    window.saveAndRender();
                } else {
                    this.processVacationData();
                    this.populateWorkerSelect();
                    this.renderAll();
                    this.detectConflicts();
                }

                // Seleccionar al trabajador en el formulario
                const keys = Object.keys(newRow);
                const workerKey = keys.find(k => {
                    const upper = k.toUpperCase();
                    return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
                }) || 'TRABAJADOR NOM';
                
                const finalWorkerName = newRow[workerKey];
                setTimeout(() => {
                    const select = document.getElementById('vacation-form-worker');
                    if (select) {
                        select.value = finalWorkerName;
                    }
                }, 200);

                if (typeof showToast === 'function') {
                    showToast(`👥 ${finalWorkerName} registrado en el sistema`, "success");
                }
            }
        });
    },

    promptAddNewWorkerInSitu(workerName, centerName, selectEl) {
        this.showNewWorkerModal('', (data) => {
            const newRow = this.createWorkerRow(data.name, data.service, data.client, data.project, data.schedule);
            if (newRow) {
                window.state.masterData.push(newRow);

                const keys = Object.keys(newRow);
                const workerKey = keys.find(k => {
                    const upper = k.toUpperCase();
                    return upper.includes('TRABAJADOR') || upper.includes('TITULAR') || upper === 'NOMBRE';
                }) || 'TRABAJADOR NOM';
                const finalWorkerName = newRow[workerKey];

                // Asignar el nuevo trabajador como suplente
                const titularKey = workerKey;
                const centerKey = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO NOM';
                const targetRow = window.state.masterData.find(r => 
                    (r[titularKey] || '').toString().trim() === workerName &&
                    (r[centerKey] || '').toString().trim() === centerName
                );

                if (targetRow) {
                    const suplenteKey = keys.find(k => k.toUpperCase() === 'SUPLENTE') || 'SUPLENTE';
                    targetRow[suplenteKey] = finalWorkerName;
                    
                    const estadoKey = keys.find(k => k.toUpperCase() === 'ESTADO') || 'ESTADO';
                    if (targetRow[estadoKey] === 'DESCUBIERTO') {
                        targetRow[estadoKey] = 'CUBIERTO';
                    }

                    if (typeof SubstituteManagement !== 'undefined') {
                        SubstituteManagement.assignSubstitute(targetRow, finalWorkerName, true);
                    } else {
                        try {
                            const saved = localStorage.getItem('sifu_substitute_assignments_v1');
                            const assignments = saved ? JSON.parse(saved) : [];
                            const assignment = {
                                id: `assign_${Date.now()}`,
                                service: targetRow[centerKey] || centerName,
                                proyecto: targetRow.PROYECTO,
                                originalTitular: workerName,
                                substitute: finalWorkerName,
                                assignedDate: new Date().toISOString(),
                                temporary: true,
                                status: 'active',
                                notes: 'Asignado in-situ desde módulo vacaciones (nuevo operario)'
                            };
                            assignments.push(assignment);
                            localStorage.setItem('sifu_substitute_assignments_v1', JSON.stringify(assignments));
                        } catch (e) {
                            console.error('Error saving assignment to localStorage:', e);
                        }
                    }
                }

                if (typeof window.saveAndRender === 'function') {
                    window.saveAndRender();
                } else {
                    this.processVacationData();
                    this.populateWorkerSelect();
                    this.renderAll();
                    this.detectConflicts();
                }

                if (typeof showToast === 'function') {
                    showToast(`✅ ${finalWorkerName} creado y asignado como suplente de ${workerName}`, "success");
                }
            }
        });
    },

    exportExcel() {
        if (!window.state || !window.state.masterData) return;
        try {
            const dataToExport = [
                ...this.activeVacations.map(v => ({ TRABAJADOR: v.worker, SERVICIO: v.center, RANGO: v.vacDate, ESTADO: 'ACTIVA' })),
                ...this.upcomingVacations.map(v => ({ TRABAJADOR: v.worker, SERVICIO: v.center, RANGO: v.vacDate, ESTADO: 'PLANIFICADA' }))
            ];

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");
            XLSX.writeFile(wb, "PLANIFICACION_VACACIONES_SIFU.xlsx");
            if (typeof showToast === 'function') showToast("📁 Excel de vacaciones exportado", "success");
        } catch (e) {
            console.error(e);
            alert("Error al exportar a Excel. Asegúrese de que la librería XLSX esté disponible.");
        }
    },

    exportPDF() {
        const element = document.getElementById('tab-vacaciones');
        if (!element) return;
        try {
            // Ocultar botones de acción temporalmente
            const toolbar = element.querySelector('div[style*="border-bottom"]');
            const form = document.getElementById('vacation-form').parentElement;
            
            let originalDisplayToolbar = '';
            let originalDisplayForm = '';
            
            if (toolbar) {
                const buttons = toolbar.querySelector('div');
                if (buttons) {
                    originalDisplayToolbar = buttons.style.display;
                    buttons.style.display = 'none';
                }
            }
            if (form) {
                originalDisplayForm = form.style.display;
                form.style.display = 'none';
            }

            const opt = {
                margin:       10,
                filename:     'INFORME_VACACIONES_SIFU.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                if (toolbar) {
                    const buttons = toolbar.querySelector('div');
                    if (buttons) buttons.style.display = originalDisplayToolbar;
                }
                if (form) form.style.display = originalDisplayForm;
            });
            if (typeof showToast === 'function') showToast("📁 Informe PDF generado", "success");
        } catch (e) {
            console.error(e);
            alert("Error al exportar a PDF.");
        }
    }
};

window.VacationModule = VacationModule;
