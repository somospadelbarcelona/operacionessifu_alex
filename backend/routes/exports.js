/**
 * EXPORTS ROUTES - Gestión de Exportaciones desde el Servidor
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const XLSX = require('xlsx');
const Service = require('../models/Service');

router.use(protect);

// @route   GET /api/exports/services
// @desc    Generar y descargar Excel de servicios consolidado
router.get('/services', authorize('admin', 'manager'), async (req, res) => {
    try {
        const services = await Service.find({ isActive: true }).populate('titular');

        const data = services.map(s => ({
            Proyecto: s.proyecto,
            Servicio: s.servicio,
            Tipo: s.tipo,
            Estado: s.estado,
            Titular: s.titular ? s.titular.nombre : 'Sin asignar',
            Gestor: s.gestor,
            'Fin Contrato': s.finContrato ? s.finContrato.toISOString().split('T')[0] : ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Servicios');

        // Generar buffer en lugar de archivo físico
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=Listado_Servicios_SIFU.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
