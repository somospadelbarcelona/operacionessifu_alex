/**
 * SERVICES ROUTES - Rutas de Servicios
 */

const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(protect);

// @route   GET /api/services
// @desc    Obtener todos los servicios
// @access  Private
router.get('/', async (req, res) => {
    try {
        const {
            estado,
            tipo,
            gestor,
            ubicacion,
            page = 1,
            limit = 100,
            sort = '-createdAt'
        } = req.query;

        // Construir query
        const query = { isActive: true };

        if (estado) query.estado = estado;
        if (tipo) query.tipo = tipo;
        if (gestor) query.gestor = gestor;
        if (ubicacion) query.ubicacion = new RegExp(ubicacion, 'i');

        // Ejecutar query con paginación
        const services = await Service.find(query)
            .populate('titular', 'nombre email telefono')
            .populate('suplente', 'nombre email telefono')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Contar total
        const total = await Service.countDocuments(query);

        res.json({
            success: true,
            data: {
                services,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener servicios',
            error: error.message
        });
    }
});

// @route   GET /api/services/stats
// @desc    Obtener estadísticas de servicios
// @access  Private
router.get('/stats', async (req, res) => {
    try {
        const total = await Service.countDocuments({ isActive: true });
        const cubiertos = await Service.countDocuments({ estado: 'CUBIERTO', isActive: true });
        const descubiertos = await Service.countDocuments({ estado: 'DESCUBIERTO', isActive: true });
        const bajasIT = await Service.countDocuments({ estado1: 'BAJA IT', isActive: true });
        const vacaciones = await Service.countDocuments({ estado1: 'VACACIONES', isActive: true });

        // Servicios por tipo
        const porTipo = await Service.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$tipo', count: { $sum: 1 } } }
        ]);

        // Servicios por gestor
        const porGestor = await Service.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$gestor', count: { $sum: 1 } } }
        ]);

        // Contratos que terminan pronto
        const today = new Date();
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const contratosTerminando = await Service.countDocuments({
            finContrato: { $gte: today, $lte: in30Days },
            isActive: true
        });

        res.json({
            success: true,
            data: {
                total,
                cubiertos,
                descubiertos,
                bajasIT,
                vacaciones,
                contratosTerminando,
                porTipo,
                porGestor,
                tasaCobertura: total > 0 ? ((cubiertos / total) * 100).toFixed(2) : 0
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
});

// @route   GET /api/services/:id
// @desc    Obtener un servicio por ID
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id)
            .populate('titular', 'nombre email telefono')
            .populate('suplente', 'nombre email telefono');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        res.json({
            success: true,
            data: { service }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener servicio',
            error: error.message
        });
    }
});

// @route   POST /api/services
// @desc    Crear nuevo servicio
// @access  Private (Admin, Manager)
router.post('/', authorize('admin', 'manager'), async (req, res) => {
    try {
        const serviceData = {
            ...req.body,
            metadata: {
                createdBy: req.user.id
            }
        };

        const service = await Service.create(serviceData);

        // Emitir evento Socket.io
        const io = req.app.get('io');
        io.emit('service-created', service);

        res.status(201).json({
            success: true,
            message: 'Servicio creado exitosamente',
            data: { service }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear servicio',
            error: error.message
        });
    }
});

// @route   PUT /api/services/:id
// @desc    Actualizar servicio
// @access  Private (Admin, Manager)
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
    try {
        let service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        // Actualizar campos
        Object.keys(req.body).forEach(key => {
            if (key !== 'metadata') {
                service[key] = req.body[key];
            }
        });

        service.metadata.updatedBy = req.user.id;
        await service.save();

        // Emitir evento Socket.io
        const io = req.app.get('io');
        io.emit('service-updated', service);

        res.json({
            success: true,
            message: 'Servicio actualizado',
            data: { service }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar servicio',
            error: error.message
        });
    }
});

// @route   DELETE /api/services/:id
// @desc    Eliminar servicio (soft delete)
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        service.isActive = false;
        service.metadata.updatedBy = req.user.id;
        await service.save();

        // Emitir evento Socket.io
        const io = req.app.get('io');
        io.emit('service-deleted', { id: service._id });

        res.json({
            success: true,
            message: 'Servicio eliminado'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al eliminar servicio',
            error: error.message
        });
    }
});

// @route   POST /api/services/bulk
// @desc    Crear múltiples servicios
// @access  Private (Admin)
router.post('/bulk', authorize('admin'), async (req, res) => {
    try {
        const { services } = req.body;

        if (!Array.isArray(services)) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de servicios'
            });
        }

        // Agregar metadata a cada servicio
        const servicesWithMetadata = services.map(service => ({
            ...service,
            metadata: {
                createdBy: req.user.id
            }
        }));

        const createdServices = await Service.insertMany(servicesWithMetadata);

        res.status(201).json({
            success: true,
            message: `${createdServices.length} servicios creados`,
            data: { services: createdServices }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear servicios',
            error: error.message
        });
    }
});

module.exports = router;
