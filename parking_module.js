/**
 * PARKING MANAGER MODULE (v3.0 Matrix Mode 2026)
 * Cuadrante Anual Tecnológico con Scroll Infinito y Tooltips
 */

const ParkingManager = {
    parkingsData: [],
    selectedParking: null,
    isSidebarOpen: true,
    yearMatrix: 2026,
    months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    daysInMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], // 2026 no es bisiesto
    
    KEYWORDS: ['PARKING', 'SABA', 'BSM', 'B:SM', 'EMPAR', 'APARCAMIENTO'],

    init() {
        console.log("🚗 Inicializando Panel Premium de PARKING's (MATRIX MODE 2026)...");
        this.extractParkings();
        if (this.parkingsData.length > 0) this.selectedParking = this.parkingsData[0];
        this.renderDashboard();
    },

    extractParkings() {
        if (!window.state || !window.state.masterData) return;
        
        this.parkingsData = window.state.masterData.filter(row => {
            const keys = Object.keys(row);
            const tipoS = (row[keys.find(k => k.toUpperCase().includes('TIPO S'))] || '').toString().toUpperCase();
            const servicio = (row[keys.find(k => k.toUpperCase().trim() === 'SERVICIO')] || '').toString().toUpperCase();
            const proyecto = (row[keys.find(k => k.toUpperCase().trim() === 'PROYECTO')] || '').toString().toUpperCase();
            const textToSearch = `${tipoS} ${servicio} ${proyecto}`;
            return this.KEYWORDS.some(kw => textToSearch.includes(kw));
        });

        // Add some mock metrics
        this.parkingsData = this.parkingsData.map(p => ({
            ...p,
            _m2: ((JSON.stringify(p).length) % 10 * 1200) + 500
        }));

        // --- INYECCIÓN 2026: PARKING LEGALITAT ---
        const parkingLegalitat = {
            "TIPO S": "PARKING",
            "SERVICIO": "PARKING LEGALITAT 60-62",
            "TITULAR": "DIEGO PEREZ GONZALEZ (T01), JONATHAN ANTUNEZ (T02), JOSE LIÑAN (T03/T04), ANTONIO BENZAL (T05/T06)",
            "_m2": 4500
        };
        
        this.parkingsData = this.parkingsData.filter(p => !p.SERVICIO || !p.SERVICIO.includes('LEGALITAT 60-62'));
        this.parkingsData.unshift(parkingLegalitat);

        this.generateAnnualMatrix(); 
    },

    generateAnnualMatrix() {
        // Generar 365 días del 2026
        const totalDays = 365;
        // 1 Jan 2026 es Jueves
        this.parkingsData.forEach(p => {
            let titulares = p.TITULAR ? p.TITULAR.split(',').map(t => t.trim()) : ['EMPLEADO GENÉRICO'];
            
            p._quadrant = titulares.map((emp, index) => {
                let shifts = Array(totalDays).fill(null);
                
                for(let i=0; i<totalDays; i++) {
                    let d = new Date(this.yearMatrix, 0, i+1);
                    let dayOfWeek = d.getDay(); // 0(Sun) - 6(Sat)
                    let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                    let isWeekday = !isWeekend;
                    
                    if (p.SERVICIO.includes('LEGALITAT')) {
                        // Patrones exactos extrapolados de la imagen de marzo
                        if (emp.includes('DIEGO PEREZ')) {
                            if (isWeekend) shifts[i] = { type: 'M', time: '06:00-14:00', total: '8.00' };
                            if ((i === 59 || i === 66 || i === 73) && shifts[i]) shifts[i].alert = 'FICHAJE INCORRECTO';
                        } 
                        else if (emp.includes('JONATHAN')) {
                            if (isWeekend) shifts[i] = { type: 'T', time: '14:00-22:00', total: '8.00' };
                            if ((i === 60 || i === 74) && shifts[i]) shifts[i].alert = 'SALIDA ANTES TIEMPO';
                        } 
                        else if (emp.includes('JOSE LIÑAN')) {
                            if (isWeekday) shifts[i] = { type: 'N', time: '22:00-06:00', total: '8.00' };
                            if (i % 17 === 0 && isWeekday && shifts[i]) shifts[i].alert = 'SIN FICHAJES';
                        } 
                        else if (emp.includes('ANTONIO BENZAL')) {
                            if (isWeekend) shifts[i] = { type: 'N', time: '22:00-06:00', total: '8.00' };
                        }
                    } else {
                        // Generación para el resto de parkings
                        if (!isWeekend && index % 2 === 0) shifts[i] = { type: 'M', time: '06:00-14:00', total: '8.00' };
                        if (!isWeekend && index % 2 !== 0) shifts[i] = { type: 'T', time: '14:00-22:00', total: '8.00' };
                    }
                }
                return { name: emp, shifts };
            });
        });
    },

    selectParking(index) {
        this.selectedParking = this.parkingsData[index];
        this.renderDashboard();
    },

    scrollToMonth(monthIndex) {
        const targetTh = document.getElementById(`th-month-${monthIndex}`);
        const container = document.getElementById('matrix-scroll-container');
        if (targetTh && container) {
            // Desplazamiento suave considerando la columna fija lateral
            container.scrollTo({
                left: targetTh.offsetLeft - 220, // 220 es el width de la columna sticky de empleados
                behavior: 'smooth'
            });
            
            // Highlight button
            document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById(`btn-month-${monthIndex}`);
            if (btn) btn.classList.add('active');
        }
    },

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.renderDashboard();
    },

    showTooltip(event, htmlContent) {
        let tt = document.getElementById('global-mx-tooltip');
        if (!tt) {
            tt = document.createElement('div');
            tt.id = 'global-mx-tooltip';
            document.body.appendChild(tt);
        }
        tt.innerHTML = htmlContent;
        tt.classList.add('visible');
        
        // Calcular posición
        const rect = event.target.getBoundingClientRect();
        let top = rect.top - tt.offsetHeight - 15;
        let left = rect.left + (rect.width/2) - (tt.offsetWidth/2);
        
        // Control de bordes (viewport bounds)
        if (top < 10) top = rect.bottom + 15; // Mostrar debajo si se sale por arriba
        if (left < 10) left = 10; // Margen izquierdo
        if (left + tt.offsetWidth > window.innerWidth - 10) left = window.innerWidth - tt.offsetWidth - 10;
        
        tt.style.top = top + 'px';
        tt.style.left = left + 'px';
    },

    hideTooltip() {
        const tt = document.getElementById('global-mx-tooltip');
        if (tt) tt.classList.remove('visible');
    },

    renderDashboard() {
        const container = document.getElementById('tab-parkings');
        if (!container) return;

        // Main Dashboard Layout (Matrix Mode 2026)
        // Se añade max-width: 100% y min-width: 0 para evitar que la matriz infinita expanda el DOM global y deforme los tabs nav
        let html = `
            <div class="parking-dashboard" style="display: flex; flex-direction: column; height: 100%; width: 100%; max-width: 100%; overflow: hidden; box-sizing: border-box;">
                <div class="parking-header" style="flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <h2 class="parking-title" style="margin:0;"><i class="fas fa-parking"></i> MATRIZ DE CUADRANTES ${this.yearMatrix}</h2>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-primary" onclick="ParkingManager.init()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color:white; padding: 8px 15px; border-radius:8px; cursor:pointer;">
                            <i class="fas fa-sync-alt"></i> REFRESCAR
                        </button>
                    </div>
                </div>

                <div class="parking-main-grid" style="display: flex; gap: 20px; flex: 1; overflow: hidden; min-width: 0; min-height: 0; width: 100%;">
                    <!-- LEFT COLUMN: Selector (Collapsible) -->
                    ${this.isSidebarOpen ? `
                    <div class="parking-card" style="padding: 15px; width: 300px; flex-shrink: 0; display: flex; flex-direction: column;">
                        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="font-size: 14px; margin:0;"><i class="fas fa-users-cog"></i> CLIENTES</h3>
                            <button onclick="ParkingManager.toggleSidebar()" style="background:none; border:none; cursor:pointer; color:#64748b;"><i class="fas fa-chevron-left"></i> Ocultar</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1;">
                            ${this.renderParkingList()}
                        </div>
                    </div>
                    ` : ''}

                    <!-- RIGHT COLUMN: Matrix View -->
                    <div class="parking-card" style="padding: 20px; background: #fafafa; flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0; min-height: 0;">
                        ${this.renderMatrixView()}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
        
        // Auto-scroll y filtrado visual al mes actual por defecto
        if (this.selectedParking) {
            const currentMonth = new Date().getMonth();
            setTimeout(() => {
                this.scrollToMonth(currentMonth);
            }, 300); // 300ms de delay para asegurar que el DOM está montado y listo para SCROLL
        }
    },

    renderParkingList() {
        if (this.parkingsData.length === 0) return `<div style="text-align:center; color:#64748b;">No hay clientes.</div>`;
        let html = '';
        this.parkingsData.forEach((row, i) => {
            const keys = Object.keys(row);
            const srv = row[keys.find(k => k.toUpperCase().includes('SERVICIO'))] || `Parking ${i}`;
            const isSelected = this.selectedParking && this.selectedParking === row;
            html += `
                <div class="parking-row-clickable ${isSelected ? 'selected' : ''}" 
                     style="padding: 12px; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 11px; font-weight:700;"
                     onclick="ParkingManager.selectParking(${i})">
                    ${srv.length > 25 ? srv.substring(0, 25) + '...' : srv}
                </div>
            `;
        });
        return html;
    },

    renderMatrixView() {
        if (!this.selectedParking) return `<div>Selecciona un Parking a la izquierda.</div>`;

        const srv = this.selectedParking.SERVICIO || 'SERVICIO DESCONOCIDO';
        const qData = this.selectedParking._quadrant;
        
        // Month Navigator
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display:flex; align-items:center; gap: 15px;">
                    ${!this.isSidebarOpen ? `<button onclick="ParkingManager.toggleSidebar()" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; cursor:pointer; color:#334155; font-weight:bold;"><i class="fas fa-bars"></i> Menú</button>` : ''}
                    <h3 style="margin:0; font-size:18px; color:#1e293b;">${srv}</h3>
                </div>
                <div class="month-nav" style="margin-bottom:0; flex:1; max-width: 60%; margin-left: 20px;">
                    ${this.months.map((m, i) => `<button id="btn-month-${i}" class="month-btn" onclick="ParkingManager.scrollToMonth(${i})">${m}</button>`).join('')}
                </div>
                <button class="q-btn export" onclick="ParkingManager.exportQuadrant()">📄 EXPORTAR</button>
            </div>
            
            <div class="matrix-container" id="matrix-scroll-container" style="flex:1;">
                <table class="matrix-table" id="printable-matrix">
                    <thead>
                        <tr class="matrix-header-month">
                            <th class="matrix-sticky-col" style="z-index: 30; background: white; border-bottom: none !important;">EMPLEADO</th>
        `;

        // Generar Cabeceras de Meses (Colspan) con Data Attribute para el Scroll
        this.months.forEach((m, i) => {
            html += `<th colspan="${this.daysInMonth[i]}" id="th-month-${i}" data-mon="${i}">${m.toUpperCase()} ${this.yearMatrix}</th>`;
        });

        html += `
                        </tr>
                        <tr class="matrix-header-day">
                            <th class="matrix-sticky-col" style="z-index: 30;">Totales Anuales</th>
        `;

        // Generar Cabeceras de Días (Num y Letra)
        const dayLetters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        let d = new Date(this.yearMatrix, 0, 1);
        for (let i = 0; i < 365; i++) {
            let letter = dayLetters[d.getDay()];
            let num = d.getDate();
            let isWeekend = (d.getDay()===0 || d.getDay()===6) ? 'class="matrix-weekend"' : '';
            html += `<th ${isWeekend}>${num}<span>${letter}</span></th>`;
            d.setDate(d.getDate() + 1);
        }

        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Filas de Empleados y Celdas de 365 Días
        qData.forEach(emp => {
            html += `<tr>`;
            html += `<td class="matrix-sticky-col"><i class="fas fa-user-circle" style="color:#94a3b8; margin-right:5px;"></i>${emp.name}</td>`;
            
            let tempDate = new Date(this.yearMatrix, 0, 1);
            
            emp.shifts.forEach((shift, dayIdx) => {
                let isWe = (tempDate.getDay()===0 || tempDate.getDay()===6) ? 'matrix-weekend' : '';
                
                html += `<td class="${isWe}">`;
                if (shift) {
                    let alertClass = shift.alert ? 'alert' : '';
                    let alertHtml = shift.alert ? `<span class="mx-tt-alert">${shift.alert}</span>` : '';
                    
                    let tooltipHtml = `
                        <span class="mx-tt-title">${tempDate.toLocaleDateString('es-ES', {weekday:'short', day:'2-digit', month:'long'})}</span>
                        <div class="mx-tt-detail"><span>Horario:</span> <strong>${shift.time}</strong></div>
                        <div class="mx-tt-detail"><span>Total:</span> <strong>${shift.total} hrs</strong></div>
                        ${alertHtml}
                        <div style="margin-top:10px; font-size:9px; color:#94a3b8; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px; text-align:center;">Click para Editar/Borrar</div>
                    `.replace(/"/g, '&quot;').replace(/'/g, "\\'");
                    
                    html += `
                        <div class="mx-shift ${shift.type} ${alertClass}" 
                             onclick="ParkingManager.editShift('${emp.name}', ${dayIdx})"
                             onmouseenter="ParkingManager.showTooltip(event, '${tooltipHtml}')"
                             onmouseleave="ParkingManager.hideTooltip()">
                            ${shift.type}
                        </div>
                    `;
                } else {
                    html += `
                        <div class="mx-empty" onclick="ParkingManager.forceAddShift('${emp.name}', ${dayIdx})" title="Añadir Turno"></div>
                    `;
                }
                html += `</td>`;
                tempDate.setDate(tempDate.getDate() + 1);
            });
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top:15px; display:flex; gap:15px; font-size:11px; color:#64748b; background: white; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <strong>Leyenda 365 Matrix:</strong>
                <span><span class="mx-shift M" style="width:15px;height:15px;">M</span> Mañana</span>
                <span><span class="mx-shift T" style="width:15px;height:15px;">T</span> Tarde</span>
                <span><span class="mx-shift N" style="width:15px;height:15px;">N</span> Noche</span>
                <span style="border-left:1px solid #cbd5e1; padding-left:15px;">Pulsando sobre los meses en la barra superior te deslizarás al instante. Hover muestra detalles.</span>
            </div>
        `;

        return html;
    },

    editShift(empName, dayIdx) {
        let tempDate = new Date(this.yearMatrix, 0, dayIdx + 1);
        const action = prompt(`Editando turno de ${empName} el ${tempDate.toLocaleDateString('es-ES')}.\n\nPara borrar, escribe "BORRAR".\nPara cambiar, escribe el tipo,hora (Ej: M,06:00-14:00 o T,14:00-22:00)`);
        
        if (!action) return;
        
        const emp = this.selectedParking._quadrant.find(e => e.name === empName);
        if (action.toUpperCase() === 'BORRAR') {
            emp.shifts[dayIdx] = null;
        } else {
            const parts = action.split(',');
            const tipo = parts[0] ? parts[0].trim().toUpperCase() : 'M';
            const hora = parts[1] ? parts[1].trim() : '06:00-14:00';
            emp.shifts[dayIdx] = { type: tipo.charAt(0), time: hora, total: '8.00', alert: 'TURNO EDITADO' };
        }
        
        const currentScroll = document.getElementById('matrix-scroll-container')?.scrollLeft;
        this.renderDashboard();
        if(currentScroll) setTimeout(() => document.getElementById('matrix-scroll-container').scrollLeft = currentScroll, 10);
    },

    forceAddShift(empName, dayIdx) {
        let tempDate = new Date(this.yearMatrix, 0, dayIdx + 1);
        const action = prompt(`Nuevo turno para ${empName} el ${tempDate.toLocaleDateString('es-ES')}.\n\nIntroduce el tipo,hora (Ej: M,06:00-14:00):`);
        if (action) {
            const emp = this.selectedParking._quadrant.find(e => e.name === empName);
            const parts = action.split(',');
            const tipo = parts[0] ? parts[0].trim().toUpperCase() : 'M';
            const hora = parts[1] ? parts[1].trim() : '14:00-22:00';
            emp.shifts[dayIdx] = { type: tipo.charAt(0), time: hora, total: '8.00' };
            
            const currentScroll = document.getElementById('matrix-scroll-container')?.scrollLeft;
            this.renderDashboard();
            if(currentScroll) setTimeout(() => document.getElementById('matrix-scroll-container').scrollLeft = currentScroll, 10);
        }
    },

    exportQuadrant() {
        if (typeof html2pdf !== 'undefined') {
            const element = document.getElementById('printable-matrix');
            const opt = {
                margin:       1,
                filename:     `${this.selectedParking.SERVICIO}_Matriz_${this.yearMatrix}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
            };
            html2pdf().set(opt).from(element).save();
        } else {
            alert('El visor PDF no está disponible.');
        }
    }
};

window.ParkingManager = ParkingManager;
