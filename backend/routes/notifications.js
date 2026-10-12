/**
 * NOTIFICATIONS ROUTES - Gestión de Notificaciones Centralizada
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'error', 'success'], default: 'info' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

router.use(protect);

// @route   GET /api/notifications
router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort('-createdAt')
            .limit(20);
        res.json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true });
        res.json({ success: true, message: 'Notificación marcada como leída' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
