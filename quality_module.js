
// --- QUALITY MODULE (Expert Auditor Edition) ---

window.openQualityModal = function () {
    const modal = document.getElementById('quality-modal');
    const select = document.getElementById('quality-service-select');

    if (select && state.masterData) {
        // Get unique services
        const keys = Object.keys(state.masterData[0] || {});
        const kServicio = keys.find(k => k.toUpperCase().includes('SERVICIO')) || 'SERVICIO';
        const uniqueServices = [...new Set(state.masterData.map(r => r[kServicio]))].filter(s => s).sort();

        select.innerHTML = uniqueServices.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    modal.classList.add('active');
};

window.closeQualityModal = function () {
    document.getElementById('quality-modal').classList.remove('active');
};

window.initQualityModule = function () {
    console.log("⭐ Inicializando Módulo de Calidad Master...");

    const form = document.getElementById('quality-form');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            saveAudit();
        };
    }

    renderQualityDashboard();
};

function saveAudit() {
    const service = document.getElementById('quality-service-select').value;
    const score = parseInt(document.getElementById('quality-score-range').value);
    const notes = document.getElementById('quality-notes').value;

    const newAudit = {
        id: Date.now(),
        service: service,
        score: score,
        notes: notes,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        supervisor: "Gestor Principal"
    };

    if (!state.audits) state.audits = [];
    state.audits.unshift(newAudit);

    if (typeof saveAllState === 'function') saveAllState();

    closeQualityModal();
    renderQualityDashboard();

    // Feedback
    updateTicker(`AUDITORÍA REGISTRADA: ${service} (${score}/10)`);
    showToast(`✅ Auditoría guardada correctamente.`, 'success');
}

window.renderQualityDashboard = function () {
    const feed = document.getElementById('quality-feed');
    const scoreEl = document.getElementById('avg-quality-score');
    const countEl = document.getElementById('quality-count-total');
    const rankingEl = document.getElementById('quality-ranking');

    if (!feed || !state.audits) return;

    console.log("📊 Renderizando Dashboard de Calidad:", state.audits.length);

    if (state.audits.length === 0) {
        feed.innerHTML = '<div class="empty-state">No hay auditorías registradas todavía.</div>';
        scoreEl.textContent = "--";
        countEl.textContent = "0 AUDITORÍAS REALIZADAS";
        return;
    }

    // Stats
    const totalScore = state.audits.reduce((acc, curr) => acc + curr.score, 0);
    const avg = (totalScore / state.audits.length).toFixed(1);
    scoreEl.textContent = avg;
    countEl.textContent = `${state.audits.length} AUDITORÍAS REALIZADAS`;

    // Ranking logic
    const serviceAvg = {};
    state.audits.forEach(a => {
        if (!serviceAvg[a.service]) serviceAvg[a.service] = { sum: 0, count: 0 };
        serviceAvg[a.service].sum += a.score;
        serviceAvg[a.service].count++;
    });

    const sortedRanking = Object.entries(serviceAvg)
        .map(([name, data]) => ({ name, avg: (data.sum / data.count).toFixed(1) }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5);

    rankingEl.innerHTML = sortedRanking.map((r, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:11px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; color:var(--text-dim);">${i + 1}.</span>
                <span title="${r.name}">${r.name.length > 25 ? r.name.substring(0, 22) + '...' : r.name}</span>
            </div>
            <strong style="color:${r.avg >= 8 ? 'var(--accent-green)' : r.avg >= 5 ? '#fbbc04' : '#ea4335'}">${r.avg}</strong>
        </div>
    `).join('');

    // Feed
    feed.innerHTML = state.audits.map(a => {
        let scoreColor = 'var(--accent-green)';
        if (a.score < 5) scoreColor = '#ea4335';
        else if (a.score < 8) scoreColor = '#fbbc04';

        return `
            <div class="analysis-card" style="padding:15px; border-left:4px solid ${scoreColor};">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                    <div>
                        <div style="font-weight:700; color:var(--text-main); font-size:14px;">${a.service}</div>
                        <div style="font-size:10px; color:var(--text-dim);">${a.date} | Por: ${a.supervisor}</div>
                    </div>
                    <div style="font-size:20px; font-weight:900; color:${scoreColor}">${a.score}<span style="font-size:10px; opacity:0.6;">/10</span></div>
                </div>
                <div style="font-size:11px; color:var(--text-main); line-height:1.4;">${a.notes || 'Sin observaciones adicionales.'}</div>
            </div>
        `;
    }).join('');
};
