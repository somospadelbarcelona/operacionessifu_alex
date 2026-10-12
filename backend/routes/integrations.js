/**
 * INTEGRATIONS ROUTES - Pasarela para servicios externos
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(protect);
router.use(authorize('admin')); // Solo admins pueden gestionar integraciones

// @route   POST /api/integrations/whatsapp/test
router.post('/whatsapp/test', async (req, res) => {
    try {
        const { phone, message } = req.body;
        logger.info(`Test de WhatsApp solicitado para: ${phone}`);

        // Aquí iría la llamada real a la API de WhatsApp Business

        res.json({ success: true, message: 'Simulación de mensaje enviada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   GET /api/integrations/status
router.get('/status', async (req, res) => {
    res.json({
        success: true,
        data: {
            whatsapp: 'online',
            googleCalendar: 'connected',
            emailServer: 'online'
        }
    });
});

module.exports = router;
