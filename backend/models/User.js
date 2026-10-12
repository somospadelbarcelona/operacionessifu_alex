/**
 * USER MODEL - Modelo de Usuario
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'worker', 'viewer'],
        default: 'viewer'
    },
    phone: {
        type: String,
        trim: true
    },
    avatar: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    refreshToken: {
        type: String,
        select: false
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpire: {
        type: Date,
        select: false
    }
}, {
    timestamps: true
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Método para comparar contraseñas
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Método para obtener datos públicos del usuario
userSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        phone: this.phone,
        avatar: this.avatar,
        isActive: this.isActive,
        lastLogin: this.lastLogin,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', userSchema);
