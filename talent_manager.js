/**
 * TALENT & TRAINING MANAGER - Gestión de Formación y Plan de Carrera
 * Gestiona cursos, competencias, evaluaciones y el progreso profesional de los trabajadores.
 */

const TalentManager = {
    courses: [
        { id: 'TR-001', name: 'Limpieza Técnica Hospitalaria', category: 'ESPECIALIZACIÓN', points: 150, duration: '20h', enrollment: 12 },
        { id: 'TR-002', name: 'Prevención de Riesgos (PRL) Avanzada', category: 'OBLIGATORIO', points: 100, duration: '10h', enrollment: 45 },
        { id: 'TR-003', name: 'Gestión de Equipos para Supervisores', category: 'LIDERAZGO', points: 300, duration: '40h', enrollment: 5 },
        { id: 'TR-004', name: 'Sostenibilidad y Productos Ecológicos', category: 'INNOVACIÓN', points: 80, duration: '5h', enrollment: 28 }
    ],
    workerTalent: {},

    init() {
        console.log('🎓 Inicializando Gestor de Talento...');
        this.generateMockTalentData();
    },

    generateMockTalentData() {
        if (!window.state || !window.state.masterData) return;

        window.state.masterData.forEach(s => {
            if (s.TITULAR && !this.workerTalent[s.TITULAR]) {
                this.workerTalent[s.TITULAR] = {
                    level: Math.floor(Math.random() * 5) + 1,
                    experience: Math.floor(Math.random() * 1000),
                    skills: {
                        'Técnica': Math.floor(Math.random() * 100),
                        'Seguridad': Math.floor(Math.random() * 100),
                        'Actitud': Math.floor(Math.random() * 100),
                        'Digital': Math.floor(Math.random() * 100)
                    },
                    completedCourses: ['TR-002'],
                    careerGoal: 'Supervisor de Zona',
                    recommendations: ['TR-001', 'TR-003'].slice(0, Math.floor(Math.random() * 3))
                };
            }
        });
    },

    // ========================================
    // RENDERIZADO UI
    // ========================================

    renderTalentDashboard() {
        const container = document.getElementById('talent-management-container');
        if (!container) return;

        container.innerHTML = `
            <div class="talent-grid">
                <!-- Sección de Cursos y Formación -->
                <div class="t-section">
                    <div class="t-section-header">
                        <h3>📚 Catálogo de Formación SIFU Academy</h3>
                        <span class="t-badge-count">${this.courses.length} Cursos Activos</span>
                    </div>
                    <div class="course-list">
                        ${this.courses.map(c => `
                            <div class="course-card">
                                <div class="course-main">
                                    <span class="course-cat">${c.category}</span>
                                    <h4 class="course-name">${c.name}</h4>
                                    <div class="course-meta">
                                        <span>⏱️ ${c.duration}</span>
                                        <span>🏆 ${c.points} pts</span>
                                        <span>👥 ${c.enrollment} inscritos</span>
                                    </div>
                                </div>
                                <button class="enroll-btn" onclick="TalentManager.enrollWorker('${c.id}')">Asignar</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Resumen de Talento y Competencias -->
                <div class="t-section">
                    <div class="t-section-header">
                        <h3>🌟 Top Talento y Plan de Carrera</h3>
                        <div class="t-search-box">
                            <input type="text" id="talent-search" placeholder="Buscar trabajador..." onkeyup="TalentManager.filterTalent()">
                        </div>
                    </div>
                    <div class="talent-list" id="talent-list-results">
                        ${this.renderTalentRows(Object.entries(this.workerTalent).slice(0, 5))}
                    </div>
                </div>
            </div>
        `;
    },

    renderTalentRows(talentEntries) {
        return talentEntries.map(([name, data]) => `
            <div class="talent-card">
                <div class="t-profile">
                    <div class="t-avatar">${name.charAt(0)}</div>
                    <div class="t-info">
                        <span class="t-name">${name}</span>
                        <span class="t-goal">Objetivo: ${data.careerGoal}</span>
                    </div>
                </div>
                <div class="t-level-box">
                    <span class="t-level">Nivel ${data.level}</span>
                    <div class="t-xp-bar"><div class="t-xp-fill" style="width: ${data.experience % 100}%"></div></div>
                </div>
                <div class="t-skills-mini">
                    <div class="t-skill-tag">Téc: ${data.skills.Técnica}%</div>
                    <div class="t-skill-tag">Seg: ${data.skills.Seguridad}%</div>
                    <div class="t-skill-tag">Dig: ${data.skills.Digital}%</div>
                </div>
                <button class="t-view-btn">Ver Plan</button>
            </div>
        `).join('');
    },

    enrollWorker(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (typeof showToast === 'function') {
            showToast(`Formación "${course.name}" abierta para asignación masiva`, 'info');
        }
    },

    filterTalent() {
        const term = document.getElementById('talent-search').value.toLowerCase();
        const filtered = Object.entries(this.workerTalent)
            .filter(([name]) => name.toLowerCase().includes(term));

        document.getElementById('talent-list-results').innerHTML = this.renderTalentRows(filtered.slice(0, 5));
    }
};

window.TalentManager = TalentManager;
