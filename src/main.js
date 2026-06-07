// Consolidación de estilos CSS
import './styles/main.css';

// 1. Cargar bases de datos persistentes (fuentes de verdad en el orden correcto)
import '../indexeddb-persist.js';

// 2. Módulos de motor y lógica de negocio
import '../operational_service.js';
import '../analytics_engine.js';
import '../quality_module.js';
import '../orders_module.js';
import '../it_module.js';
import '../director_module.js';
import '../quadrants_module.js';
import '../notepad.js';

// 3. Módulos inteligentes (Notificaciones, checklist, calendarios)
import '../notifications_engine.js';
import '../daily_checklist.js';
import '../calendar_module.js';
import '../vacation_module.js';
import '../analytics_trends.js';

// 4. Integraciones de modelos LLM y NLP
import '../llm_assistant.js';
import '../nlp_commander.js';

// 5. Módulos IA y predicción de suplentes
import '../ai_predictive_engine.js';
import '../worker_performance.js';
import '../substitute_management.js';

// 6. Componentes de movilidad, PWA e instalación
import '../pwa_installer.js';
import '../internal_chat.js';

// 7. Visión de partes y optimización
import '../aldi_parts_scanner.js';
import '../ml_engine.js';
import '../route_optimizer.js';
import '../service_clustering.js';
import '../integrations_hub.js';
import '../transport_optimizer.js';
import '../advanced_export.js';

// 8. Motores ejecutivos, financieros e BI
import '../bi_engine.js';
import '../security_manager.js';
import '../quality_compliance.js';
import '../document_manager.js';
import '../financial_manager.js';
import '../talent_manager.js';
import '../fleet_logistics_manager.js';
import '../sustainability_manager.js';
import '../executive_command.js';
import '../contract_guardian.js';

// 9. Cliente de API de SIFU
import './services/api.js';

// 10. Lógica Core de la Aplicación (inicializador de eventos y listeners de DOM)
import '../app.js';

console.log('🚀 SIFU Informer V2 (ES Modules / Vite): Inicialización completada.');
