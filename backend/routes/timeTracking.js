/**
 * TIME TRACKING ROUTES - RUTAS DE CONTROL HORARIO INTELIGENTE
 * API REST para sincronización multi-mes, validación de fichajes y auditoría.
 * Soporta filtros avanzados por los 9 Gestores Oficiales de Barcelona (0801) y por Días.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const timeTrackingService = require('../services/timeTrackingService');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware de autenticación flexible (permite token JWT o usuario del sistema)
const optionalOrProtect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token && process.env.JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                if (user) req.user = user;
            } catch (err) {
                logger.warn(`Token en timeTracking no validado: ${err.message}`);
            }
        }

        if (!req.user) {
            req.user = {
                id: req.headers['x-user-id'] || 'GESTOR-LOCAL',
                name: req.headers['x-user-name'] || 'Gestor Operaciones SIFU',
                email: req.headers['x-user-email'] || 'operaciones@gruposifu.com',
                role: 'gestor'
            };
        }

        next();
    } catch (error) {
        next();
    }
};

router.use(optionalOrProtect);

/**
 * @route   GET /api/time-tracking/months
 * @desc    Obtener lista de meses históricos disponibles
 */
router.get('/months', (req, res) => {
    try {
        const months = timeTrackingService.getAvailableMonths();
        res.json({
            success: true,
            currentMonth: timeTrackingService.getCurrentMonthString(),
            months
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/time-tracking/gestores
 * @desc    Obtener los 9 Gestores Oficiales de Barcelona (0801) con su censo y KPIs
 */
router.get('/gestores', (req, res) => {
    try {
        const gestores = timeTrackingService.getOfficialManagers();
        res.json({
            success: true,
            total_gestores: gestores.length,
            censo_total: 680,
            delegacion: '0801 - BARCELONA',
            data: gestores,
            gestores
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/time-tracking/records
 * @desc    Obtener registros de fichajes con filtros avanzados (gestor, día, canal, paginación)
 */
router.get('/records', async (req, res) => {
    try {
        const result = await timeTrackingService.getRecords(req.query);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error(`Error al obtener fichajes: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/time-tracking/sync/status
 * @desc    Monitor de estado de sincronización en vivo (con telemetría SAP HO + CTI)
 */
router.get('/sync/status', (req, res) => {
    try {
        const status = timeTrackingService.getSyncStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/time-tracking/sync/trigger
 * @desc    Disparador manual de sincronización (forzada)
 */
router.post('/sync/trigger', async (req, res) => {
    try {
        const { gestor, centro, empleado, mes, dia, tipo = 'manual' } = req.body;
        logger.info(`Disparo manual de sincronización solicitado por ${req.user.name}:`, req.body);

        let result;
        if (tipo === 'delta') {
            result = await timeTrackingService.syncDelta();
        } else if (tipo === 'nightly') {
            result = await timeTrackingService.syncNightly(mes);
        } else {
            result = await timeTrackingService.syncManual({ gestor, centro, empleado, mes, dia, tipo });
        }

        res.json({
            success: result.success,
            data: result
        });
    } catch (error) {
        logger.error(`Error en sync/trigger: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/time-tracking/validations/alerts
 * @desc    Alertas detectadas por el motor de validación
 */
router.get('/validations/alerts', async (req, res) => {
    try {
        const result = await timeTrackingService.getAlerts(req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`Error al obtener alertas de validación: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/time-tracking/records/:id/adjust
 * @desc    Regularización/ajuste de fichaje con auditoría formal obligatoria
 */
router.post('/records/:id/adjust', async (req, res) => {
    try {
        const recordId = req.params.id;
        const adjustmentData = req.body;

        const result = await timeTrackingService.adjustRecord(recordId, adjustmentData, req.user);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error(`Error en regularización de fichaje (${req.params.id}): ${error.message}`);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/time-tracking/audit-log
 * @desc    Historial inmutable de auditoría
 */
router.get('/audit-log', (req, res) => {
    try {
        const result = timeTrackingService.getAuditLog(req.query);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/time-tracking/events/punch
 * @desc    Ingesta de evento de marcaje en tiempo real
 */
router.post('/events/punch', async (req, res) => {
    try {
        const punchData = req.body;
        if (!punchData.workerId && !punchData.dni) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar el workerId o dni del empleado'
            });
        }

        const result = await timeTrackingService.ingestRecordEvent(punchData);
        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`Error en punch realtime: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
