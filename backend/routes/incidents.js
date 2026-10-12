const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');

// @route   GET /api/incidents
// @desc    Obtener todas las incidencias
// @access  Public
router.get('/', async (req, res) => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: { incidents }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener incidencias',
            error: error.message
        });
    }
});

// @route   POST /api/incidents
// @desc    Crear una nueva incidencia
// @access  Public
router.post('/', async (req, res) => {
    try {
        const incident = await Incident.create(req.body);
        
        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('incident-created', incident);
        }

        res.status(201).json({
            success: true,
            message: 'Incidencia creada con éxito',
            data: { incident }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear incidencia',
            error: error.message
        });
    }
});

// @route   PUT /api/incidents/:id
// @desc    Actualizar una incidencia por su ID numérico
// @access  Public
router.put('/:id', async (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const incident = await Incident.findOneAndUpdate(
            { id: incidentId },
            { $set: req.body },
            { new: true }
        );

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incidencia no encontrada'
            });
        }

        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('incident-updated', incident);
        }

        res.json({
            success: true,
            message: 'Incidencia actualizada con éxito',
            data: { incident }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar incidencia',
            error: error.message
        });
    }
});

// @route   DELETE /api/incidents/:id
// @desc    Eliminar una incidencia por su ID numérico
// @access  Public
router.delete('/:id', async (req, res) => {
    try {
        const incidentId = parseInt(req.params.id);
        const result = await Incident.deleteOne({ id: incidentId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Incidencia no encontrada'
            });
        }

        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('incident-deleted', { id: incidentId });
        }

        res.json({
            success: true,
            message: 'Incidencia eliminada correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al eliminar incidencia',
            error: error.message
        });
    }
});

module.exports = router;

