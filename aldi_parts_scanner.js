/**
 * ALDI PARTS SCANNER – Engine v9.0 STABLE
 * Clean rewrite to fix all accumulated inconsistencies.
 */

const AldiPartsScanner = {
    processedParts: [],
    currentAnalysis: null,
    currentFilter: 'ALL',
    agentKnowledge: { workers: [], centers: [] },
    consts: { API_URL: 'http://localhost:3000/api/aldi-parts' },
    CENTERS_4H: ['FABRA I PUIG', 'MERCAT DE MONTSERRAT', 'SANTS PELEGRI', 'SANTS PELEGRÍ', 'TALLERS'],

    // ── Inicialización ───────────────────────────────────────────────────────
    init() {
        console.log('🚀 ALDI ENGINE v9.0 STABLE');
        this.extractKnowledge();
        this.loadHistory();
        this.setupUpload();
    },

    // ── Regla de Facturación ─────────────────────────────────────────────────
    getBillingHours(centerName, horario) {
        const h = (horario || '').toUpperCase();
        const c = (centerName || '').toUpperCase();
        const t = h.match(/(\d{1,2})[:.]\d{2}/g) || [];
        if (t.length >= 2) {
            const parse = s => { const [hh, mm] = s.split(/[:.]/).map(Number); return hh + mm / 60; };
            if (Math.abs(parse(t[1]) - parse(t[0])) >= 3.6) return 4;
        }
        if (this.CENTERS_4H.some(k => c.includes(k))) return 4;
        return 3;
    },

    // ── Extracción de Master Data ────────────────────────────────────────────
    extractKnowledge() {
        if (typeof INITIAL_MASTER_DATA === 'undefined') { console.warn('⚠️ INITIAL_MASTER_DATA no disponible'); return; }
        const aldi = INITIAL_MASTER_DATA.filter(r => r['TIPO S'] === 'ALDI');

        this.agentKnowledge.workers = aldi
            .map(r => {
                const full = (r.TITULAR || '').toUpperCase().trim();
                if (!full) return null;
                const tokens = full.split(/\s+/).filter(p => p.length > 2);
                return {
                    fullName: full,
                    tokens,
                    nicknames: tokens.map(p => p.substring(0, 5)),
                    assignedCenter: (r.SERVICIO || '').toUpperCase(),
                    horario: r.HORARIO || ''
                };
            })
            .filter(Boolean);

        this.agentKnowledge.centers = aldi.map(r => {
            const raw = (r.SERVICIO || '').toUpperCase();
            const loc = raw.replace(/TIENDA\s+\d+\s*-\s*/, '').trim();
            return {
                fullName: raw,
                location: loc,
                tokens: loc.split(/\s+/).filter(t => t.length > 2),
                horario: r.HORARIO || ''
            };
        });

        console.log(`🧠 ${this.agentKnowledge.workers.length} trabajadores Aldi cargados`);
    },

    // ── Historial ────────────────────────────────────────────────────────────
    async loadHistory() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout
            
            const r = await fetch(this.consts.API_URL, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (r.ok) { 
                this.processedParts = (await r.json()).map(p => this.normalize(p)); 
                console.log('✅ Historial Aldi cargado desde API');
            } else { 
                this.loadLocal(); 
            }
        } catch (e) { 
            console.log('📦 API offline o lenta, cargando local:', e.name);
            this.loadLocal(); 
        }
        this.updateHistoryUI();
    },

    // Interacción manual con el calendario
    toggleDay(day) {
        if (!this.currentAnalysis) return;
        
        const dayIdx = this.currentAnalysis.heatmap.findIndex(h => h.day === day);
        if (dayIdx === -1) return;

        // Cambiar estado
        this.currentAnalysis.heatmap[dayIdx].worked = !this.currentAnalysis.heatmap[dayIdx].worked;

        // Recalcular totales
        const totalWorked = this.currentAnalysis.heatmap.filter(h => h.worked).length;
        this.currentAnalysis.detectedDays = totalWorked;
        this.currentAnalysis.detectedHours = totalWorked * this.currentAnalysis.hPerDay;
        this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - totalWorked);

        console.log(`🖱️ Manual Edit: Day ${day} toggled. Total days: ${totalWorked}`);
        this.renderResults();
    },

    saveToERP() {
        if (!this.currentAnalysis) return;
        
        const part = { ...this.currentAnalysis, status: 'SAVED', timestamp: new Date().toISOString() };
        this.processedParts.unshift(part);
        
        // Guardar en persistencia local
        localStorage.setItem('sifu_aldi_v9', JSON.stringify(this.processedParts.slice(0, 50)));
        
        // Sincronizar con el estado universal si existe
        if (window.UniversalState) {
            UniversalState.addActivity('ALDI_SCAN', `Parte guardado: ${part.worker} (${part.detectedDays} días)`);
        }

        console.log('✅ Parte guardado en ERP local');
        
        // Reset y feedback
        this.updateHistoryUI();
        const view = document.getElementById('aldi-results-view');
        view.innerHTML = `
            <div style="padding: 100px 0; text-align: center; color: #10b981;">
                <span style="font-size: 60px; display: block; margin-bottom: 20px;">✅</span>
                <h3 style="margin:0;">¡PARTE GUARDADO!</h3>
                <p style="color:#64748b;">Los datos han sido integrados en el sistema.</p>
                <button onclick="AldiPartsScanner.renderResults()" style="margin-top:20px; background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 20px; border-radius:10px; cursor:pointer;">VOLVER</button>
            </div>
        `;
    },

    loadLocal() {
        try {
            const s = localStorage.getItem('sifu_aldi_v9');
            if (s) this.processedParts = JSON.parse(s).map(p => this.normalize(p));
        } catch { this.processedParts = []; }
    },

    normalize(p) {
        return {
            ...p,
            worker: p.workerName || p.worker || 'DESCONOCIDO',
            center: p.center || 'CENTRO DESCONOCIDO',
            reportedAbsences: p.absences || p.reportedAbsences || [],
            detectedHours: Number(p.detectedHours) || 0,
            detectedDays: Number(p.detectedDays) || 0,
            month: p.month ?? 2
        };
    },

    persist() {
        try { localStorage.setItem('sifu_aldi_v9', JSON.stringify(this.processedParts)); } catch { }
    },

    setFilter(m) { this.currentFilter = m; this.updateHistoryUI(); },

    updateHistoryUI() {
        const list = document.getElementById('aldi-history-list');
        if (!list) return;
        let arr = [...this.processedParts];
        if (this.currentFilter !== 'ALL') arr = arr.filter(p => String(p.month) === String(this.currentFilter));
        if (!arr.length) {
            list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:11px;">No hay registros previos.</div>';
            return;
        }
        list.innerHTML = arr.slice(0, 30).map(p => {
            const id = String(p._id?.$oid || p._id || p.id || p.timestamp);
            return `<div onclick="AldiPartsScanner.viewDetail('${id}')"
                style="background:#fff;padding:12px 14px;border-radius:10px;border:1px solid #e2e8f0;
                       margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;
                       cursor:pointer;border-left:5px solid #10b981;">
                <div style="font-size:11px;flex:1;">
                    <strong style="color:#1e293b;display:block;">${p.center}</strong>
                    <span style="color:#475569;">${p.worker}</span>
                    <span style="display:block;font-size:10px;color:#94a3b8;margin-top:2px;">
                        ${new Date(p.timestamp || p.createdAt || Date.now()).toLocaleDateString()} •
                        <b>${p.detectedDays}d · ${p.detectedHours}h</b>
                    </span>
                </div>
                <button onclick="AldiPartsScanner.deletePart('${id}',event)"
                    style="background:#fee2e2;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;color:#dc2626;font-size:15px;">🗑️</button>
            </div>`;
        }).join('');
    },

    viewDetail(id) {
        const p = this.processedParts.find(x => String(x._id?.$oid || x._id || x.id || x.timestamp) === String(id));
        if (p) {
            this.currentAnalysis = JSON.parse(JSON.stringify(p));
            this.renderResults();
            showToast('👁️ Registro cargado', 'info');
        }
    },

    async deletePart(id, e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!confirm('¿Eliminar definitivamente?')) return;
        this.processedParts = this.processedParts.filter(
            x => String(x._id?.$oid || x._id || x.id || x.timestamp) !== String(id)
        );
        this.persist();
        this.updateHistoryUI();
        fetch(`${this.consts.API_URL}/${id}`, { method: 'DELETE' }).catch(() => { });
        showToast('🗑️ Eliminado', 'info');
    },

    // ── Upload ───────────────────────────────────────────────────────────────
    setupUpload() {
        const zone = document.getElementById('aldi-upload-zone');
        if (!zone) { console.warn('⚠️ aldi-upload-zone no encontrado'); return; }
        
        console.log('📄 Configurando zona de carga Aldi...');

        // Limpiar eventos anteriores para evitar duplicados
        const newZone = zone.cloneNode(true);
        zone.parentNode.replaceChild(newZone, zone);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
            newZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
        );
        newZone.addEventListener('drop', e => {
            console.log('📥 Archivo soltado');
            if (e.dataTransfer && e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
        });
        newZone.addEventListener('click', () => {
            console.log('🖱️ Clic en zona de carga');
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.onchange = e => { 
                if (e.target.files[0]) {
                    console.log('📂 Archivo seleccionado:', e.target.files[0].name);
                    this.handleFile(e.target.files[0]); 
                }
            };
            inp.click();
        });
    },

    async handleFile(file) {
        if (!file) return;
        const zone = document.getElementById('aldi-upload-zone');
        const overlay = zone ? zone.querySelector('#aldi-scanning-overlay') : document.getElementById('aldi-scanning-overlay');
        const progEl = overlay ? overlay.querySelector('.processing-text') : null;
        const setProgress = msg => { if (progEl) progEl.innerText = msg; console.log(msg); };

        if (overlay) overlay.style.display = 'flex';

        try {
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract.js no cargado');
            }

            setProgress('PRE-PROCESANDO...');
            const blob = await this.preprocessImage(file);
            const imgURL = await this.toDataURL(file);

            setProgress('INICIALIZANDO...');
            const result = await Tesseract.recognize(blob, 'spa', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setProgress(`PROCESANDO: ${(m.progress * 100).toFixed(0)}%`);
                    }
                }
            });

            const text = result.data.text;
            this.lastRawText = text; // Para diagnóstico
            console.log('📄 Contenido detectado. Analizando...');
            this.analyse(text, imgURL, file.name);
            
            if (overlay) overlay.style.display = 'none';
            this.renderResults();
            showToast('✅ Análisis completado', 'success');

        } catch (err) {
            console.error('❌ Error Aldi Scanner:', err);
            showToast(`⚠️ ${err.message}`, 'error');
            if (overlay) overlay.style.display = 'none';
        }
    },

    toDataURL(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    },

    async preprocessImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Mostrar controles tras la primera carga
                const controls = document.getElementById('image-adjust-controls');
                if (controls) controls.style.display = 'block';

                // Obtener valores de los sliders o usar defaults
                const contrastVal = document.getElementById('adj-contrast')?.value || 1.8;
                const thresholdVal = document.getElementById('adj-threshold')?.value || 140;

                // 1. Escalado Proporcional (2000px ancho para mayor estabilidad)
                const targetWidth = 2000;
                const scale = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scale;
                
                ctx.filter = `grayscale(1) contrast(${contrastVal}) brightness(1.1) blur(0.2px)`;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const v = r < thresholdVal ? 0 : 255;
                    data[i] = data[i+1] = data[i+2] = v;
                }
                
                ctx.putImageData(imageData, 0, 0);
                ctx.filter = 'contrast(1.2) brightness(1.0)';
                ctx.drawImage(canvas, 0, 0);

                console.log(`👁️ Vision Engine v11.1: C=${contrastVal}, T=${thresholdVal}`);
                canvas.toBlob(b => resolve(b), 'image/png', 1.0);
            };
            img.src = URL.createObjectURL(file);
        });
    },


    // ── Análisis ─────────────────────────────────────────────────────────────
    analyse(rawText, imgURL, fileName) {
        const T = rawText.toUpperCase();
        const F = fileName.toUpperCase();
        const lines = T.split('\n').map(l => l.trim()).filter(l => l.length > 1);

        // 1) DETECTAR CENTRO (Fuzzy Search)
        let bestCenter = null, bestCScore = 0;
        this.agentKnowledge.centers.forEach(c => {
            let sc = 0;
            // Puntuación por coincidencia de tokens (con tolerancia a errores de 1 char)
            c.tokens.forEach(t => {
                if (T.includes(t)) sc += t.length * 5;
                else {
                    // 1. Recortar primero si es largo (para tolerar error OCR al final)
                    const partial = t.length > 3 ? t.substring(0, t.length - 1) : t;
                    // 2. Escapar DESPUÉS para que las barras de escape (\) nunca queden al final
                    const escaped = partial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    try {
                        const regex = new RegExp(escaped, 'i');
                        if (regex.test(T)) sc += t.length * 2;
                    } catch(e) { console.warn('Regex skip:', escaped); }
                }
            });
            if (sc > bestCScore) { bestCenter = c; bestCScore = sc; }
        });

        // 2) DETECTAR TRABAJADOR (Priorizando los del Centro Detectado)
        let worker = null;
        let bestWScore = 0;
        this.agentKnowledge.workers.forEach(w => {
            let sc = 0;
            // Protocolo Presidencial: Bonus por pertenecer al centro detectado
            if (bestCenter && w.fullName.includes(bestCenter.id)) sc += 200;

            w.tokens.forEach(t => {
                const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const n = (T.match(new RegExp(escaped, 'gi')) || []).length;
                sc += n * 10;
                // Soporte para alias (Montse -> Montserrat)
                if (t === 'MONTSERRAT' && T.includes('MONTSE')) sc += 100;
            });
            if (sc > bestWScore) { worker = w; bestWScore = sc; }
        });

        // 3) DETECTAR MES
        const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        let mIdx = MONTHS.findIndex(m => T.includes(m) || T.includes(m.substring(0, 4)));
        if (mIdx < 0) mIdx = 2;

        // 4) CONTAR DÍAS TRABAJADOS ───────────────────────────────────────────
        const { workingDays, daysInMonth } = this.monthStats(mIdx, 2026);

        // Estrategia A: tiempos matinales amplio (cualquier variante OCR: 0621, 06:21, 06 21…)
        const broadTimeMatches = (T.match(/\b0?[6789]\D{0,2}\d{2}\b/g) || []).length;
        const sA = Math.floor(broadTimeMatches / 2);

        // Estrategia B: ocurrencias del apellido más frecuente del trabajador
        let sB = 0;
        if (worker) {
            const maxToken = worker.tokens.reduce((best, t) => {
                const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const n = (T.match(new RegExp(escaped, 'gi')) || []).length;
                return Math.max(best, n);
            }, 0);
            const maxNick = worker.nicknames.reduce((best, n) => {
                const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const cnt = (T.match(new RegExp(escaped, 'gi')) || []).length;
                return Math.max(best, cnt);
            }, 0);
            sB = Math.max(maxToken, maxNick);
        }

        // Estrategia C: líneas que empiezan con día numérico (formato Aldi "2 Montse…")
        const sC = lines.filter(l => /^\d{1,2}\s+[A-ZÁÉÍÓÚ]/.test(l)).length;

        // Estrategia D: líneas con contenido relevante (excluyendo cabecera ~6 líneas)
        const sD = Math.max(0, lines.filter(l => l.length > 8).length - 6);

        // Estrategia E: números de día ÚNICOS al inicio de línea (columna DÍA, impresa).
        // Solo cuenta inicio de línea: ej "2 Montse" → día 2. Evita falsos positivos del header.
        const uniqueDays = new Set();
        rawText.split('\n').forEach(line => {
            // Nueva Regex flexible: permite basura previa como | o / o espacios
            const m2 = line.trim().match(/(?:^|\||\/|\s)(\d{1,2})(?:\s|$|\.|:|\|)/);
            if (m2) {
                const n = parseInt(m2[1]);
                if (n >= 1 && n <= daysInMonth) {
                    const dow = new Date(2026, mIdx, n).getDay();
                    if (dow !== 0 && dow !== 6) uniqueDays.add(n);
                }
            }
        });
        const sE = uniqueDays.size;

        console.log(`📊 CONTEO: A(tiempos)=${sA} B(nombres)=${sB} C(filas)=${sC} D(contenido)=${sD} E(díasÚnicos)=${sE} laborables=${workingDays}`);


        // Selector: MAX de valores plausibles de A, B, C, E
        const valid = [sA, sB, sC, sE].filter(v => v >= 2 && v <= 31);
        let workedDays;
        if (valid.length === 0) {
            workedDays = workingDays;
        } else {
            workedDays = Math.max(...valid);
            // Si sD es más alto y plausible, úsalo
            if (sD >= 5 && sD <= 28 && sD > workedDays) workedDays = sD;
        }

        // Heurística final: si estamos a 1-2 días de los laborables, redondear arriba
        // (OCR comúnmente pierde las últimas 1-2 filas del documento)
        if (workingDays - workedDays <= 2 && workingDays - workedDays > 0) {
            console.log(`📊 Redondeando a días laborables por margen OCR (${workedDays} → ${workingDays})`);
            workedDays = workingDays;
        }

        workedDays = Math.min(workedDays, daysInMonth);


        // 5) FACTURACIÓN ──────────────────────────────────────────────────────
        const horario = worker?.horario || bestCenter?.horario || '';
        const hPerDay = this.getBillingHours(bestCenter?.fullName || '', horario);
        const totalH = workedDays * hPerDay;
        const absences = Math.max(0, workingDays - workedDays);

        // 6) HEATMAP ──────────────────────────────────────────────────────────
        const heatmap = [];
        let marked = 0;
        for (let d = 1; d <= 31; d++) {
            if (d > daysInMonth) { heatmap.push({ day: d, worked: false, out: true }); continue; }
            const dow = new Date(2026, mIdx, d).getDay();
            const isWDay = dow !== 0 && dow !== 6;
            const doMark = isWDay && marked < workedDays;
            if (doMark) marked++;
            heatmap.push({ day: d, worked: doMark });
        }

        // 7) DETECCIÓN DE FIRMAS
        const hasSignatures = T.includes('FIRMA') || lines.some(l => l.includes('FMA') || l.includes('SIG'));

        // 6) VALIDACIÓN CRUZADA CON MASTER DATA (Discrepancias)
        let discrepancy = false;
        let discrepancyReason = '';
        if (worker && workedDays !== workingDays) {
            discrepancy = true;
            discrepancyReason = `Se detectaron ${workedDays} días, pero el Master espera ${workingDays}.`;
        }

        // 7) CALCULAR SCORE DE CONFIANZA
        const confidence = Math.min(100, Math.round(((sA > 0 ? 30 : 0) + (sB > 0 ? 30 : 0) + (sC > 0 ? 20 : 0) + (sE > 0 ? 20 : 0))));

        this.currentAnalysis = {
            id: Date.now(),
            worker: worker?.fullName || 'NO DETECTADO',
            center: bestCenter?.fullName || 'NO DETECTADO',
            month: mIdx, year: 2026,
            detectedDays: workedDays,
            detectedHours: totalH,
            hPerDay,
            expectedWorkingDays: workingDays,
            absences,
            heatmap,
            imageData: imgURL,
            horario,
            timestamp: new Date().toISOString(),
            confidence,
            hasSignatures,
            discrepancy,
            discrepancyReason,
            _debug: { sA, sB, sC, sD, workingDays }
        };
    },

    monthStats(m, y) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(y, m, d).getDay();
            if (dow !== 0 && dow !== 6) workingDays++;
        }
        return { daysInMonth, workingDays };
    },

    // ── Render ───────────────────────────────────────────────────────────────
    renderResults() {
        const view = document.getElementById('aldi-results-view');
        if (!view) return;
        if (!this.currentAnalysis) {
            view.innerHTML = '<div class="empty-state">Arrastra un parte para analizar...</div>';
            return;
        }
        const R = this.currentAnalysis;
        const MN = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        view.innerHTML = `
        <div style="background:#fff;border-radius:20px;box-shadow:0 15px 25px -5px rgba(0,0,0,.08);overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:#1e293b;padding:22px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                        <h3 style="margin:0;font-size:18px;font-weight:800;">RESULTADO DE ANÁLISIS</h3>
                        <span style="background:${R.confidence > 80 ? '#10b981' : '#f59e0b'}; color:white; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">
                            CONFIANZA: ${R.confidence}%
                        </span>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <span style="background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">ALDI ENGINE v11.8</span>
                        <button onclick="const p = document.getElementById('aldi-ocr-debug'); p.style.display = p.style.display === 'none' ? 'block' : 'none';" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:3px 8px; border-radius:12px; font-size:9px; cursor:pointer;">🔍 DIAGNÓSTICO IA</button>
                    </div>
                </div>
                ${R.imageData ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                    <img src="${R.imageData}" onclick="AldiPartsScanner.showImage()" style="width:100px;height:60px;object-fit:cover;border-radius:10px;border:2px solid rgba(255,255,255,.2);cursor:zoom-in;"/>
                    <button onclick="AldiPartsScanner.showImage()" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 12px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;">👁 VER PARTE</button>
                </div>` : ''}
            </div>

            <!-- Panel de Debug Oculto -->
            <div id="aldi-ocr-debug" style="display:none; padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; animation: fadeIn 0.3s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">LECTURA BRUTA DEL MOTOR (DEBUG):</span>
                    <button onclick="document.getElementById('aldi-ocr-debug').style.display='none'" style="border:none; background:none; cursor:pointer; color:#94a3b8;">✕</button>
                </div>
                <pre style="white-space:pre-wrap; font-size:10px; font-family:'JetBrains Mono', monospace; background:#fff; padding:12px; border:1px solid #e2e8f0; border-radius:8px; max-height:200px; overflow-y:auto; margin:0; color:#334155; line-height:1.4;">${this.lastRawText || 'No hay data disponible.'}</pre>
            </div>

            ${R.discrepancy ? `
                <div style="background:#fff7ed; padding:10px 28px; border-bottom:1px solid #ffedd5; color:#c2410c; font-size:12px; font-weight:700; display:flex; align-items:center; gap:10px;">
                    <span>🚨 DISCREPANCIA DETECTADA:</span>
                    <span style="font-weight:400;">${R.discrepancyReason}</span>
                </div>
            ` : ''}

            <div style="padding:24px 28px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
                    <div onclick="AldiPartsScanner.editField('worker')" style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;">
                        <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;display:block;margin-bottom:6px;">TRABAJADOR ✏️</span>
                        <span style="font-size:14px;font-weight:800;color:#1e293b;">${R.worker}</span>
                    </div>
                    <div onclick="AldiPartsScanner.editField('center')" style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;">
                        <span style="font-size:9px;color:#64748b;font-weight:800;text-transform:uppercase;display:block;margin-bottom:6px;">CENTRO ALDI ✏️</span>
                        <span style="font-size:14px;font-weight:800;color:#1e293b;">${R.center}</span>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start;">
                    <div style="background:#f1f5f9;padding:18px;border-radius:16px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px;color:#475569;">
                            <strong>CALENDARIO — ${MN[R.month]} 2026</strong>
                            <span>${R.detectedDays} / ${R.expectedWorkingDays} laborables</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
                            ${R.heatmap.map(d => `<div title="Día ${d.day}" style="aspect-ratio:1;border-radius:5px;
                                background:${d.out ? '#f8fafc' : d.worked ? '#10b981' : '#e2e8f0'};
                                color:${d.out ? 'transparent' : d.worked ? '#fff' : '#94a3b8'};
                                display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;">${d.day}</div>`).join('')}
                        </div>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="background:#ecfdf5;padding:18px;border-radius:14px;border:1px solid #bbf7d0;text-align:center;">
                            <span style="font-size:9px;color:#065f46;font-weight:800;text-transform:uppercase;display:block;margin-bottom:4px;">HORAS FACTURABLES</span>
                            <span style="font-size:42px;color:#059669;font-weight:900;line-height:1;">${R.detectedHours}</span>
                            <span style="font-size:16px;color:#059669;font-weight:700;">h</span>
                            <span style="display:block;font-size:10px;color:#059669;margin-top:5px;">${R.detectedDays}d × ${R.hPerDay}h</span>
                            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;">
                                <button onclick="AldiPartsScanner.adjustDays(-1)" style="background:#059669;color:#fff;border:none;width:28px;height:28px;border-radius:50%;font-size:18px;cursor:pointer;font-weight:700;line-height:1;">−</button>
                                <span style="font-size:11px;color:#065f46;font-weight:700;">${R.detectedDays} días</span>
                                <button onclick="AldiPartsScanner.adjustDays(+1)" style="background:#059669;color:#fff;border:none;width:28px;height:28px;border-radius:50%;font-size:18px;cursor:pointer;font-weight:700;line-height:1;">+</button>
                            </div>
                        </div>
                        <div style="background:#fff7ed;padding:14px;border-radius:14px;border:1px solid #ffedd5;text-align:center;">
                            <span style="font-size:9px;color:#9a3412;font-weight:800;text-transform:uppercase;display:block;margin-bottom:4px;">DÍAS AUSENTES</span>
                            <span style="font-size:24px;color:#c2410c;font-weight:800;">${R.absences}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:20px;">
                    ${!R._id ? `
                    <button onclick="AldiPartsScanner.save()"
                        style="flex:2;background:#059669;color:#fff;border:none;padding:15px;border-radius:12px;
                               font-weight:800;cursor:pointer;font-size:14px;box-shadow:0 4px 6px -1px rgba(16,185,129,.3);">
                        ✅ GUARDAR EN ERP
                    </button>` : `
                    <div style="flex:2;background:#f1f5f9;color:#64748b;padding:15px;border-radius:12px;font-weight:700;text-align:center;border:1px solid #e2e8f0;">ARCHIVADO ✓</div>`}
                    <button onclick="AldiPartsScanner.reset()"
                        style="flex:1;background:#fff;color:#64748b;border:1px solid #e2e8f0;padding:15px;border-radius:12px;font-weight:700;cursor:pointer;">CERRAR</button>
                </div>

                <details style="margin-top:12px;">
                    <summary style="font-size:10px;color:#94a3b8;cursor:pointer;">🔍 DEBUG OCR LOG</summary>
                    <pre style="font-size:9px;color:#64748b;background:#f8fafc;padding:10px;border-radius:8px;overflow:auto;max-height:100px;margin-top:6px;">A(tiempos)=${R._debug?.sA} B(nombres)=${R._debug?.sB} C(filas)=${R._debug?.sC} D(content)=${R._debug?.sD}
Días elegidos: ${R.detectedDays} | h/día: ${R.hPerDay} | Total: ${R.detectedHours}h | Esperados: ${R._debug?.workingDays}
Horario master: ${R.horario}</pre>
                </details>
            </div>
        </div>`;
    },

    editField(field) {
        const cur = this.currentAnalysis[field];
        const val = prompt(`Corregir "${field}":`, cur);
        if (val !== null) {
            this.currentAnalysis[field] = val.toUpperCase();
            this.renderResults();
        }
    },

    showImage() {
        if (!this.currentAnalysis?.imageData) return;
        const src = this.currentAnalysis.imageData;
        // Crear lightbox
        const existing = document.getElementById('aldi-lightbox');
        if (existing) existing.remove();
        const lb = document.createElement('div');
        lb.id = 'aldi-lightbox';
        lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
        lb.innerHTML = `
            <div style="position:relative;max-width:92vw;max-height:88vh;">
                <img src="${src}" style="max-width:100%;max-height:85vh;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,.5);"/>
                <button onclick="document.getElementById('aldi-lightbox').remove()" style="position:absolute;top:-14px;right:-14px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;font-weight:800;line-height:1;">×</button>
            </div>
            <div style="display:flex;gap:12px;">
                <button onclick="window.open('${src}')" style="background:#059669;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;">⬇ Abrir / Descargar</button>
                <button onclick="document.getElementById('aldi-lightbox').remove()" style="background:#475569;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;">Cerrar</button>
            </div>`;
        lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
        document.body.appendChild(lb);
    },

    adjustDays(delta) {
        if (!this.currentAnalysis) return;
        const newDays = Math.max(1, Math.min(31, this.currentAnalysis.detectedDays + delta));
        this.currentAnalysis.detectedDays = newDays;
        this.currentAnalysis.detectedHours = newDays * this.currentAnalysis.hPerDay;
        this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - newDays);
        // Actualizar heatmap
        let marked = 0;
        this.currentAnalysis.heatmap = this.currentAnalysis.heatmap.map(d => {
            if (d.out) return d;
            const dow = new Date(2026, this.currentAnalysis.month, d.day).getDay();
            const isWDay = dow !== 0 && dow !== 6;
            const doMark = isWDay && marked < newDays;
            if (doMark) marked++;
            return { ...d, worked: doMark };
        });
        this.renderResults();
    },

    editDays() {
        const days = prompt('Corregir días trabajados:', this.currentAnalysis.detectedDays);
        if (days !== null && !isNaN(parseInt(days))) {
            this.currentAnalysis.detectedDays = parseInt(days);
            this.currentAnalysis.detectedHours = parseInt(days) * this.currentAnalysis.hPerDay;
            this.currentAnalysis.absences = Math.max(0, this.currentAnalysis.expectedWorkingDays - parseInt(days));
            this.renderResults();
        }
    },

    // ── Guardar ──────────────────────────────────────────────────────────────
    async save() {
        if (!this.currentAnalysis) return;
        const item = { ...this.currentAnalysis, timestamp: new Date().toISOString() };

        // Guardado optimista inmediato
        this.processedParts.unshift(item);
        this.persist();
        this.updateHistoryUI();
        showToast('💾 Guardado localmente', 'success');

        // Sincronización con servidor (async)
        fetch(this.consts.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        }).then(async r => {
            if (r.ok) {
                const saved = await r.json();
                const idx = this.processedParts.findIndex(p => p.timestamp === item.timestamp);
                if (idx !== -1) {
                    this.processedParts[idx] = this.normalize(saved);
                    this.persist();
                    this.updateHistoryUI();
                }
                showToast('☁️ Sincronizado en la nube', 'success');
            }
        }).catch(() => showToast('⚠️ Modo offline (guardado localmente)', 'warning'));

        this.reset();
    },

    reset() {
        this.currentAnalysis = null;
        const view = document.getElementById('aldi-results-view');
        if (view) view.innerHTML = '<div class="empty-state" style="padding:80px 0;text-align:center;color:#94a3b8;"><span style="font-size:40px;display:block;margin-bottom:20px;">🤖</span><p>Arrastra un parte para analizar...</p></div>';
    }
};

window.AldiPartsScanner = AldiPartsScanner;
document.addEventListener('DOMContentLoaded', () => AldiPartsScanner.init());
