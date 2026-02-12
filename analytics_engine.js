
/* --- ADVANCED ANALYTICS MODULE --- */

function renderAnalytics() {
    renderHeatmap();
    renderTopClients();
}

function renderHeatmap() {
    const ctx = document.getElementById('heatmapCanvas');
    if (!ctx) return;

    // Destroy existing chart if any (to avoid duplicates/memory leaks)
    if (window.heatmapChart instanceof Chart) {
        window.heatmapChart.destroy();
    }

    // Prepare Data: Count status types
    let covered = 0;
    let uncovered = 0;
    let medical = 0;
    let vacations = 0;

    state.masterData.forEach(row => {
        const est = (row.ESTADO || '').toUpperCase();
        const est1 = (row.ESTADO1 || '').toUpperCase();
        const obs = (row.OBSERVACIONES || '').toLowerCase();

        if (est.includes('DESCUBIERTO')) uncovered++;
        else if (est1.includes('BAJA') || est.includes('BAJA') || est.includes(' IT')) medical++;
        else if (est1.includes('VACACIONES')) vacations++;
        else covered++;
    });

    // Chart.js Configuration
    window.heatmapChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cubiertos', 'Descubiertos', 'Bajas IT', 'Vacaciones'],
            datasets: [{
                data: [covered, uncovered, medical, vacations],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',  // Green
                    'rgba(239, 68, 68, 0.8)',  // Red
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(245, 158, 11, 0.8)'  // Amber
                ],
                borderColor: [
                    '#22c55e',
                    '#ef4444',
                    '#3b82f6',
                    '#f59e0b'
                ],
                borderWidth: 1,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#cbd5e1',
                        font: { family: 'Outfit', size: 10 }
                    }
                },
                title: {
                    display: false,
                    text: 'Estado Global de Servicios'
                }
            },
            cutout: '70%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function renderTopClients() {
    const ctx = document.getElementById('topClientsChart');
    if (!ctx) return;

    if (window.topClientsChart instanceof Chart) {
        window.topClientsChart.destroy();
    }

    // Aggregate Data by Client (TIPO_S)
    const clientCounts = {};
    state.masterData.forEach(row => {
        const client = row.TIPO_S || 'OTROS';
        clientCounts[client] = (clientCounts[client] || 0) + 1;
    });

    // Sort and take top 5
    const sortedClients = Object.entries(clientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    window.topClientsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedClients.map(x => x[0]),
            datasets: [{
                label: 'Servicios Activos',
                data: sortedClients.map(x => x[1]),
                backgroundColor: 'rgba(14, 165, 233, 0.6)',
                borderColor: '#0ea5e9',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0' }
                }
            }
        }
    });
}

// Auto-init analytics when file loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for master data to be populated
    setTimeout(renderAnalytics, 1500);
});

// Expose refresh function
window.refreshAnalytics = renderAnalytics;
