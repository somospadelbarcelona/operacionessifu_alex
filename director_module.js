// --- DIRECTOR LEVEL ANALYTICS (EXECUTIVE SUMMARY) ---

window.showDirectorDashboard = function () {
    console.log("🚀 Iniciando Modo Director General...");

    const masterData = state.masterData || [];
    // --- KPI 1: GLOBAL ABSENTEEISM RATE ---
    const totalHeadcount = masterData.length;
    const activeIT = masterData.filter(r => {
        const s = (r['ESTADO1'] || r['Estado1'] || "").toUpperCase();
        return s.includes('IT') || s.includes('BAJA');
    }).length;

    const absRate = totalHeadcount > 0 ? ((activeIT / totalHeadcount) * 100).toFixed(2) : 0;

    // --- KPI 2: OPERATIONAL RISKS (UNCOVERED) ---
    const uncoveredIT = masterData.filter(r => {
        const s = (r['ESTADO'] || "").toUpperCase();
        const sub = (r['SUPLENTE'] || r['SUPL'] || "").trim();
        return s === 'DESCUBIERTO' || (s.includes('BAJA') && sub.length < 2);
    }).length;

    // --- KPI 3: CLIENT CONCENTRATION RISK (Top Centers by Headcount) ---
    const headcountByCenter = {};
    masterData.forEach(r => {
        const c = r['SERVICIO'] || r['Alias/Nombre del centro'] || "OTROS";
        headcountByCenter[c] = (headcountByCenter[c] || 0) + 1;
    });

    const sortedCenters = Object.entries(headcountByCenter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Generate Executive Modal
    const modal = document.getElementById('status-detail-modal');
    const modalTitle = document.getElementById('status-modal-title');
    const modalBody = document.getElementById('status-modal-body');

    modalTitle.innerHTML = "👔 VISIÓN DIRECTIVA";

    let html = `
        <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 5px;">
            
            <!-- TOP LEVEL EXECUTIVE METRICS -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
                
                <!-- CARD 1: ABSENTEEISM -->
                <div class="dir-metric-card" style="
                    background: linear-gradient(135deg, #1e3a8a 0%, #0d1b3e 100%); 
                    color: white; 
                    padding: 22px; 
                    border-radius: 16px; 
                    box-shadow: 0 10px 25px -5px rgba(30, 58, 138, 0.3);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border: 1px solid rgba(255,255,255,0.08);
                ">
                    <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8; letter-spacing: 1.2px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                        <span>🩺</span> TASA ABSENTISMO GLOBAL
                    </div>
                    <div style="font-size: 38px; font-weight: 900; margin: 4px 0; letter-spacing: -1px; line-height: 1;">${absRate}%</div>
                    <div style="font-size: 11.5px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); display: inline-block; padding: 4px 10px; border-radius: 20px; width: fit-content; font-weight: 600;">
                        ${activeIT} Bajas Activas / ${totalHeadcount} Empleados
                    </div>
                </div>

                <!-- CARD 2: OPERATIONAL RISK -->
                <div class="dir-metric-card" style="
                    background: ${uncoveredIT > 0 ? 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #059669 0%, #064e3b 100%)'}; 
                    color: white; 
                    padding: 22px; 
                    border-radius: 16px; 
                    box-shadow: ${uncoveredIT > 0 ? '0 10px 25px -5px rgba(185, 28, 28, 0.3)' : '0 10px 25px -5px rgba(5, 150, 105, 0.3)'};
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border: 1px solid rgba(255,255,255,0.08);
                ">
                    <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8; letter-spacing: 1.2px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                        <span>🚨</span> RIESGO OPERATIVO
                    </div>
                    <div style="font-size: 38px; font-weight: 900; margin: 4px 0; letter-spacing: -1px; line-height: 1;">${uncoveredIT}</div>
                    <div style="font-size: 11.5px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); display: inline-block; padding: 4px 10px; border-radius: 20px; width: fit-content; font-weight: 600;">
                        ${uncoveredIT > 0 ? 'Servicios sin cobertura' : 'Operativa 100% Cubierta'}
                    </div>
                </div>

                <!-- CARD 3: CONCENTRATION -->
                <div class="dir-metric-card" style="
                    background: linear-gradient(135deg, #d97706 0%, #78350f 100%); 
                    color: white; 
                    padding: 22px; 
                    border-radius: 16px; 
                    box-shadow: 0 10px 25px -5px rgba(217, 119, 6, 0.3);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border: 1px solid rgba(255,255,255,0.08);
                ">
                    <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8; letter-spacing: 1.2px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                        <span>📊</span> CONCENTRACIÓN DE SERVICIO
                    </div>
                    <div style="font-size: 38px; font-weight: 900; margin: 4px 0; letter-spacing: -1px; line-height: 1;">Top 5</div>
                    <div style="font-size: 11.5px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); display: inline-block; padding: 4px 10px; border-radius: 20px; width: fit-content; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                        Los 5 mayores centros del sistema
                    </div>
                </div>
            </div>

            <!-- RISK MATRIX (MATRIZ DE RIESGO DE FUGA) -->
            <div style="margin-bottom: 30px;">
                <h4 style="margin: 0 0 15px 0; color: #0f172a; font-size: 14px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️</span> MATRIZ DE RIESGO (Centros Críticos)
                </h4>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                            <tr>
                                <th style="text-align: left; padding: 14px 16px; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px;">CLIENTE / CENTRO</th>
                                <th style="text-align: center; padding: 14px 16px; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; width: 100px;">PLANTILLA</th>
                                <th style="text-align: center; padding: 14px 16px; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; width: 100px;">BAJAS HOY</th>
                                <th style="text-align: center; padding: 14px 16px; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; width: 120px;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCenters.map((item) => {
                                const centerName = item[0];
                                const centerTotal = item[1];
                                const centerIT = masterData.filter(r => {
                                    const s = (r['ESTADO1'] || r['Estado1'] || "").toUpperCase();
                                    const c = r['SERVICIO'] || r['Alias/Nombre del centro'] || "";
                                    return c === centerName && (s.includes('IT') || s.includes('BAJA'));
                                }).length;

                                const centerRisk = (centerIT / centerTotal);
                                let riskBadge = '';
                                
                                if (centerIT === 0) {
                                    riskBadge = '<span style="background:#dcfce7; color:#15803d; font-weight:800; font-size:10.5px; padding:4px 12px; border-radius:12px; border:1px solid rgba(21,128,61,0.2);">OPTIMO</span>';
                                } else if (centerRisk > 0.3) {
                                    riskBadge = '<span style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:10.5px; padding:4px 12px; border-radius:12px; border:1px solid rgba(185,28,28,0.2);">CRÍTICO</span>';
                                } else {
                                    riskBadge = '<span style="background:#fef3c7; color:#b45309; font-weight:800; font-size:10.5px; padding:4px 12px; border-radius:12px; border:1px solid rgba(180,83,9,0.2);">ATENCIÓN</span>';
                                }

                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">${centerName}</td>
                                        <td style="padding: 12px 16px; text-align: center; color: #334155; font-weight: 600;">${centerTotal}</td>
                                        <td style="padding: 12px 16px; text-align: center; font-weight: 800; color: ${centerIT > 0 ? '#ef4444' : '#94a3b8'};">${centerIT}</td>
                                        <td style="padding: 12px 16px; text-align: center;">${riskBadge}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- STRATEGIC INSIGHT -->
            <div style="
                background-color: #f0fdf4; 
                border-left: 5px solid #10b981; 
                padding: 18px; 
                border-radius: 12px;
                border: 1px solid rgba(16,185,129,0.15);
                border-left-width: 5px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
            ">
                <h4 style="margin: 0 0 8px 0; color: #047857; font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                    <span>💡</span> RECOMENDACIÓN ESTRATÉGICA
                </h4>
                <p style="margin: 0; font-size: 12.5px; color: #065f46; line-height: 1.6; font-weight: 500;">
                    El absentismo global del <strong>${absRate}%</strong> está dentro del rango esperado de operación. 
                    Se recomienda enfocar esfuerzos de supervisión y retención en el servicio <strong>${sortedCenters[0][0]}</strong> debido a su volumen de plantilla, 
                    ya que cualquier desviación ahí impacta significativamente en el margen EBITDA global del contrato.
                </p>
            </div>

        </div>
    `;

    modalBody.innerHTML = html;
    modal.classList.add('active');
};
