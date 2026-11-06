# 🏗️ ARQUITECTURA TÉCNICA ENTERPRISE (SEOP)
## Plataforma Corporativa Integral de Gestión Operativa — Grupo SIFU

### 1. Capas de la Arquitectura Corporativa
`
┌────────────────────────────────────────────────────────┐
│                   CAPA DE EXPERIENCIA                   │
│   Web Enterprise Suite (SEOP)  |  App Móvil Supervisores │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────▼────────────────────────────┐
│                    API GATEWAY & SEGURIDAD              │
│   Rate Limiting  |  JWT Auth  |  RBAC  |  CORS & Helmet │
└───────────────────────────┬────────────────────────────┘
                            │ Microservicios
┌───────────────────────────▼────────────────────────────┐
│                  CAPA DE LÓGICA DE NEGOCIO              │
│   • TimeTracking Service    • Rule Engine (7 Reglas)   │
│   • Sincronizador HO-SAP    • Conector CTI Telefónico   │
│   • Módulo de Rentabilidad  • Gestor de Regularizaciones│
└───────────────┬───────────────────────────┬────────────┘
                │                           │
┌───────────────▼──────────┐     ┌──────────▼────────────┐
│   PERSISTENCIA & CACHÉ   │     │ INTEGRACIÓN EXTERNA   │
│ • TimescaleDB / Postgres │     │ • SAP S/4HANA (OData) │
│ • Redis (Caché caliente) │     │ • CTI PBX Asterisk/SIP│
│ • Históricos JSON 4-Capas│     │ • Power BI Embedded   │
└──────────────────────────┘     └───────────────────────┘
`

### 2. Pipeline de Sincronización 4-Capas
1. **Capa 1 (Ingesta OData SAP & CTI):** Consultas controladas al servicio ZPS_HOPER_SRV y eventos de telefonía fija.
2. **Capa 2 (Normalización y Validación):** Motor de 7 reglas que audita solapes, huérfanos, jornadas excesivas y congruencia de contrato.
3. **Capa 3 (Particionado Histórico):** Almacenamiento mensual segmentado (ichajes_historico/AAAA-MM.json) garantizando 0 pérdidas al cerrar mes.
4. **Capa 4 (Caché en Memoria y Difusión WebSocket):** Actualización instantánea hacia los gestores conectados sin recargar la página.
