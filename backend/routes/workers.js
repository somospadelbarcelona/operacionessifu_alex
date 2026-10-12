/**
 * WORKERS ROUTES - Rutas de Trabajadores
 */

const express = require('express');
const router = express.Router();
const Worker = require('../models/Worker');
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/workers
// @desc    Obtener lista de trabajadores
router.get('/', async (req, res) => {
    try {
        const { disponibilidad, search, page = 1, limit = 50 } = req.query;
        const query = { isActive: true };

        if (disponibilidad) query.disponibilidad = disponibilidad;
        if (search) {
            query.$or = [
                { nombre: new RegExp(search, 'i') },
                { dni: new RegExp(search, 'i') }
            ];
        }

        const workers = await Worker.find(query)
            .populate('serviciosActivos', 'servicio proyecto estado')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ nombre: 1 });

        const total = await Worker.countDocuments(query);

        res.json({
            success: true,
            data: {
                workers,
                pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   GET /api/workers/:id
router.get('/:id', async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id)
            .populate('serviciosActivos')
            .populate('historialBajasIT.servicio')
            .populate('historialVacaciones.servicio');

        if (!worker) return res.status(404).json({ success: false, message: 'Trabajador no encontrado' });

        res.json({ success: true, data: worker });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   POST /api/workers
router.post('/', authorize('admin', 'manager'), async (req, res) => {
    try {
        const worker = await Worker.create({
            ...req.body,
            metadata: { createdBy: req.user.id }
        });
        res.status(201).json({ success: true, data: worker });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   PUT /api/workers/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
    try {
        const worker = await Worker.findByIdAndUpdate(
            req.params.id,
            { ...req.body, 'metadata.updatedBy': req.user.id },
            { new: true, runValidators: true }
        );
        res.json({ success: true, data: worker });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @route   POST /api/workers/:id/it-leave
// @desc    Registrar baja IT
router.post('/:id/it-leave', authorize('admin', 'manager'), async (req, res) => {
    try {
        const { servicioId, fechaInicio, motivo } = req.body;
        const worker = await Worker.findById(req.params.id);

        if (!worker) return res.status(404).json({ success: false, message: 'Trabajador no encontrado' });

        worker.historialBajasIT.push({ servicio: servicioId, fechaInicio, motivo });
        worker.disponibilidad = 'BAJA_IT';
        await worker.save();

        // Actualizar servicio asociado si aplica
        if (servicioId) {
            await Service.findByIdAndUpdate(servicioId, { estado1: 'BAJA IT', estado: 'DESCUBIERTO' });
        }

        res.json({ success: true, message: 'Baja IT registrada', data: worker });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
