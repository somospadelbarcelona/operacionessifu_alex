/**
 * CRON JOBS - Tareas Programadas en Background
 */

const cron = require('node-cron');
const Service = require('../models/Service');
const logger = require('./logger');
const nodemailer = require('nodemailer');

const init = () => {
    // Tarea diaria a las 08:30 AM: Verificar contratos próximos a vencer
    cron.schedule('30 8 * * *', async () => {
        logger.info('⏰ Ejecutando revisión diaria de contratos...');
        try {
            const today = new Date();
            const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

            const endingSoon = await Service.find({
                finContrato: { $gte: today, $lte: in30Days },
                isActive: true
            }).populate('titular');

            if (endingSoon.length > 0) {
                logger.warn(`Se encontraron ${endingSoon.length} contratos próximos a vencer`);
                // Aquí se podría integrar el envío automático de notificaciones WhatsApp/Email
            }
        } catch (error) {
            logger.error('Error en cron job de contratos:', error);
        }
    });

    // Tarea semanal: Lunes a las 09:00 AM - Informe de Estado
    cron.schedule('0 9 * * 1', async () => {
        logger.info('⏰ Generando informe semanal de estado operativo...');
        // Lógica para enviar email con estadísticas globales
    });

    // Control Horario: Delta Sync cada 5 minutos
    const timeTrackingService = require('../services/timeTrackingService');
    cron.schedule('*/5 * * * *', async () => {
        try {
            await timeTrackingService.syncDelta();
        } catch (error) {
            logger.error('Error en cron delta sync de fichajes:', error);
        }
    });

    // Control Horario: Reconciliación y compactación nocturna completa a las 02:00 AM
    cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('⏰ Iniciando consolidación nocturna de fichajes...');
            await timeTrackingService.syncNightly();
        } catch (error) {
            logger.error('Error en cron nocturno de fichajes:', error);
        }
    });

    logger.success('✅ Sistema de Tareas Programadas activo');
};

module.exports = { init };
