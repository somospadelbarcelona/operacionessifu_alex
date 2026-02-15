/**
 * AUTH MIDDLEWARE - Middleware de Autenticación
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Proteger rutas - Verificar token JWT
exports.protect = async (req, res, next) => {
    try {
        let token;

        // Obtener token del header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Verificar si existe el token
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado - Token no proporcionado'
            });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuario
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado - Usuario no encontrado'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Usuario desactivado'
            });
        }

        // Agregar usuario a la request
        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado - Token inválido',
            error: error.message
        });
    }
};

// Autorizar roles específicos
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Rol '${req.user.role}' no autorizado para acceder a este recurso`
            });
        }
        next();
    };
};

// Verificar si el usuario es el propietario del recurso
exports.isOwner = (model) => {
    return async (req, res, next) => {
        try {
            const resource = await model.findById(req.params.id);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Recurso no encontrado'
                });
            }

            // Verificar si el usuario es admin o el propietario
            if (req.user.role === 'admin' ||
                resource.metadata?.createdBy?.toString() === req.user.id) {
                next();
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'No autorizado para modificar este recurso'
                });
            }

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos',
                error: error.message
            });
        }
    };
};
