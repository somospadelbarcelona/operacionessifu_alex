/**
 * PREDICTIONS ROUTES - API para Insights de Machine Learning
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');

// Modelo rápido para persistir logs de predicciones (opcional, se puede usar memoria)
const predictionSchema = new mongoose.Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    probability: Number,
    risk: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
});

const MLPrediction = mongoose.model('MLPrediction', predictionSchema);

router.use(protect);

// @route   POST /api/predictions/log
// @desc    Guardar una predicción generada por el frontend (o motor interno)
router.post('/log', async (req, res) => {
    try {
        const { serviceId, probability, risk, reason } = req.body;
        const log = await MLPrediction.create({ serviceId, probability, risk, reason });
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   GET /api/predictions/history
// @desc    Obtener historial de riesgos detectados
router.get('/history', async (req, res) => {
    try {
        const history = await MLPrediction.find()
            .populate('serviceId', 'servicio proyecto')
            .sort('-timestamp')
            .limit(50);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
