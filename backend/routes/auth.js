/**
 * AUTH ROUTES - Rutas de Autenticación
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Crear usuario
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'viewer'
        });

        // Generar token
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Guardar refresh token
        user.refreshToken = refreshToken;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                user: user.toPublicJSON(),
                token,
                refreshToken
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario',
            error: error.message
        });
    }
});

// @route   POST /api/auth/login
// @desc    Iniciar sesión
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar campos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }

        // Buscar usuario (incluir password)
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Verificar contraseña
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Usuario desactivado'
            });
        }

        // Actualizar último login
        user.lastLogin = new Date();

        // Generar tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Guardar refresh token
        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                user: user.toPublicJSON(),
                token,
                refreshToken
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión',
            error: error.message
        });
    }
});

// @route   POST /api/auth/refresh
// @desc    Refrescar token
// @access  Public
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token requerido'
            });
        }

        // Verificar refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        // Buscar usuario
        const user = await User.findById(decoded.id).select('+refreshToken');

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token inválido'
            });
        }

        // Generar nuevo token
        const newToken = generateToken(user._id);

        res.json({
            success: true,
            data: {
                token: newToken
            }
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Refresh token inválido o expirado',
            error: error.message
        });
    }
});

// @route   GET /api/auth/me
// @desc    Obtener usuario actual
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            data: {
                user: user.toPublicJSON()
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario',
            error: error.message
        });
    }
});

// @route   PUT /api/auth/me
// @desc    Actualizar perfil
// @access  Private
router.put('/me', protect, async (req, res) => {
    try {
        const { name, phone, avatar } = req.body;

        const user = await User.findById(req.user.id);

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (avatar) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            message: 'Perfil actualizado',
            data: {
                user: user.toPublicJSON()
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar perfil',
            error: error.message
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Cerrar sesión
// @access  Private
router.post('/logout', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.refreshToken = null;
        await user.save();

        res.json({
            success: true,
            message: 'Logout exitoso'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cerrar sesión',
            error: error.message
        });
    }
});

// Funciones auxiliares
function generateToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
}

function generateRefreshToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
}

module.exports = router;
