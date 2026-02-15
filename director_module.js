
// --- DIRECTOR LEVEL ANALYTICS (EXECUTIVE SUMMARY) ---

window.showDirectorDashboard = function () {
    console.log("🚀 Iniciando Modo Director General...");

    const masterData = state.masterData || [];
    const orders = state.orders || [];
    // Incidents would be here if available: const incidents = state.incidents || [];

    if (masterData.length === 0) {
        alert("⚠️ Faltan datos maestros para generar el Cuadro de Mando Directivo.");
        return;
    }

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
        const sub = (r['SUPLENTE'] || "").trim();
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

    // --- KPI 4: ESTIMATED VS ACTUAL MATERIAL SPEND (Simple Proxy) ---
    // If we had revenue, we would calculate Margin.
    // Instead we calculate "Material Intensity" per center.
    // (Requires linking orders to centers - fuzzy match needed)

    // Generate Executive Modal
    const modal = document.getElementById('status-detail-modal');
    const modalTitle = document.getElementById('status-modal-title');
    const modalBody = document.getElementById('status-modal-body');

    modalTitle.innerHTML = "👔 VISIÓN DIRECTIVA";

    let html = `
        <div style="font-family: 'Segoe UI', sans-serif; color: #333;">
            
            <!-- TOP LEVEL FINANCIAL/HR METRICS -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                <div class="kpi-card" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8; letter-spacing: 1px;">Tasa Absentismo Global</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${absRate}%</div>
                    <div style="font-size: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 2px 8px; border-radius: 4px;">
                        ${activeIT} Bajas Activas / ${totalHeadcount} Empleados
                    </div>
                </div>

                <div class="kpi-card" style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; font-weight: bold;">Riesgo Operativo (Descubiertos)</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${uncoveredIT > 0 ? '#d93025' : '#188038'};">${uncoveredIT}</div>
                    <div style="font-size: 12px; color: #666;">
                        Impacto directo en facturación y satisfacción.
                    </div>
                </div>

                <div class="kpi-card" style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; font-weight: bold;">Concentración de Servicio</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #f9ab00;">Top 5</div>
                    <div style="font-size: 12px; color: #666;">
                        Los 5 mayores centros agrupan gran parte de la plantilla.
                    </div>
                </div>
            </div>

            <!-- RISK MATRIX (MATRIZ DE RIESGO DE FUGA) -->
            <div style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 15px 0; color: #444; border-bottom: 2px solid #eee; padding-bottom: 8px;">⚠️ MATRIZ DE RIESGO (Centros Críticos)</h4>
                <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th style="text-align: left; padding: 12px; color: #555;">CLIENTE / CENTRO</th>
                                <th style="text-align: center; padding: 12px; color: #555;">PLANTILLA</th>
                                <th style="text-align: center; padding: 12px; color: #555;">BAJAS HOY</th>
                                <th style="text-align: center; padding: 12px; color: #555;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedCenters.map((item, idx) => {
        // Calculate specific center stats
        const centerName = item[0];
        const centerTotal = item[1];
        const centerIT = masterData.filter(r => {
            const s = (r['ESTADO1'] || r['Estado1'] || "").toUpperCase();
            const c = r['SERVICIO'] || r['Alias/Nombre del centro'] || "";
            return c === centerName && (s.includes('IT') || s.includes('BAJA'));
        }).length;

        const centerRisk = (centerIT / centerTotal);
        let riskLevel = '<span class="badge blue">ESTABLE</span>';
        if (centerRisk > 0.1) riskLevel = '<span class="badge yellow">ATENCIÓN</span>';
        if (centerRisk > 0.3) riskLevel = '<span class="badge red">CRÍTICO</span>';
        if (centerIT === 0) riskLevel = '<span class="badge green">OPTIMO</span>';

        return `
                                    <tr style="border-bottom: 1px solid #f0f0f0;">
                                        <td style="padding: 10px 12px; font-weight: 500;">${centerName}</td>
                                        <td style="padding: 10px 12px; text-align: center;">${centerTotal}</td>
                                        <td style="padding: 10px 12px; text-align: center; font-weight: bold; color: ${centerIT > 0 ? '#d93025' : '#ccc'};">${centerIT}</td>
                                        <td style="padding: 10px 12px; text-align: center;">${riskLevel}</td>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- STRATEGIC INSIGHT -->
            <div style="background-color: #f0f4ff; border-left: 4px solid #1a73e8; padding: 15px; border-radius: 4px;">
                <h4 style="margin: 0 0 5px 0; color: #1a73e8; font-size: 14px;">💡 RECOMENDACIÓN ESTRATÉGICA</h4>
                <p style="margin: 0; font-size: 13px; color: #444; line-height: 1.5;">
                    El absentismo global del <strong>${absRate}%</strong> está dentro/fuera de rango. 
                    Se recomienda enfocar esfuerzos de supervisión en <strong>${sortedCenters[0][0]}</strong> debido a su volumen de plantilla, 
                    ya que cualquier desviación ahí impacta significativamente en el margen EBITDA del contrato.
                </p>
            </div>

        </div>
    `;

    modalBody.innerHTML = html;
    modal.classList.add('active');
};
