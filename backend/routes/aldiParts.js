const express = require('express');
const router = express.Router();
const AldiPart = require('../models/AldiPart');

// @route   POST /api/aldi-parts
// @desc    Store a validated Aldi part
router.post('/', async (req, res) => {
    try {
        const newPart = new AldiPart({
            workerName: req.body.worker,
            center: req.body.center,
            month: req.body.month,
            year: req.body.year,
            schedule: req.body.schedule,
            detectedDays: req.body.detectedDays,
            detectedHours: req.body.detectedHours,
            absences: req.body.reportedAbsences,
            fileName: req.body.fileName,
            rawOutput: req.body.rawOutput
        });

        const savedPart = await newPart.save();
        res.status(201).json(savedPart);
    } catch (err) {
        console.error('Error saving Aldi Part:', err);
        res.status(500).json({ error: 'Fallo al guardar el parte en la base de datos' });
    }
});

// @route   GET /api/aldi-parts
// @desc    Get all stored parts
router.get('/', async (req, res) => {
    try {
        const parts = await AldiPart.find().sort({ timestamp: -1 });
        res.json(parts);
    } catch (err) {
        res.status(500).json({ error: 'Error al recuperar el historial' });
    }
});

// @route   DELETE /api/aldi-parts/:id
// @desc    Delete an erroneous part
router.delete('/:id', async (req, res) => {
    try {
        await AldiPart.findByIdAndDelete(req.params.id);
        res.json({ message: 'Parte eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el parte' });
    }
});

module.exports = router;
