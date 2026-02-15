/**
 * SIFU INFORMER - BACKEND SERVER
 * Servidor Node.js con Express, MongoDB y Socket.io
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');

// Importar rutas
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const workersRoutes = require('./routes/workers');
const predictionsRoutes = require('./routes/predictions');
const notificationsRoutes = require('./routes/notifications');
const exportsRoutes = require('./routes/exports');
const integrationsRoutes = require('./routes/integrations');

// Importar middlewares
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Importar utilidades
const logger = require('./utils/logger');
const cronJobs = require('./utils/cronJobs');

// Crear app Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = socketIO(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        methods: ['GET', 'POST']
    }
});

// Middleware de seguridad
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true
}));

// Compresión
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: { write: message => logger.info(message.trim()) }
    }));
}

// Rate limiting
app.use('/api/', rateLimiter);

// Rutas públicas
app.get('/', (req, res) => {
    res.json({
        message: 'SIFU Informer API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            services: '/api/services',
            workers: '/api/workers',
            predictions: '/api/predictions',
            notifications: '/api/notifications',
            exports: '/api/exports',
            integrations: '/api/integrations'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Error handler (debe ser el último middleware)
app.use(errorHandler);

// Socket.io eventos
io.on('connection', (socket) => {
    logger.info(`Cliente conectado: ${socket.id}`);

    socket.on('join-room', (room) => {
        socket.join(room);
        logger.info(`Cliente ${socket.id} se unió a la sala: ${room}`);
    });

    socket.on('service-update', (data) => {
        io.emit('service-updated', data);
        logger.info('Servicio actualizado:', data);
    });

    socket.on('chat-message', (data) => {
        io.to(data.room).emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}`);
    });
});

// Hacer io accesible globalmente
app.set('io', io);

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        logger.info('✅ Conectado a MongoDB');

        // Iniciar cron jobs si están habilitados
        if (process.env.ENABLE_CRON_JOBS === 'true') {
            cronJobs.init();
            logger.info('✅ Cron jobs iniciados');
        }
    })
    .catch((error) => {
        logger.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    });

// Manejar errores de MongoDB
mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error:', error);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB desconectado');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
    logger.info(`🌍 Entorno: ${process.env.NODE_ENV}`);
    logger.info(`📊 MongoDB: ${process.env.MONGODB_URI}`);
});

// Manejar shutdown gracefully
process.on('SIGTERM', () => {
    logger.info('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        logger.info('Servidor cerrado');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB desconectado');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT recibido, cerrando servidor...');
    server.close(() => {
        logger.info('Servidor cerrado');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB desconectado');
            process.exit(0);
        });
    });
});

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});

module.exports = { app, server, io };
