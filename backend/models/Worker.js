/**
 * WORKER MODEL - Modelo de Trabajador
 */

const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        index: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    telefono: {
        type: String,
        trim: true
    },
    dni: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    serviciosActivos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    tiposServicio: [{
        type: String,
        enum: ['LIMPIEZA', 'SEGURIDAD', 'MANTENIMIENTO', 'RECEPCIÓN', 'OTROS']
    }],
    ubicaciones: [{
        type: String,
        trim: true
    }],
    rendimiento: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    fiabilidad: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    historialBajasIT: [{
        servicio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
        },
        fechaInicio: Date,
        fechaFin: Date,
        motivo: String
    }],
    historialVacaciones: [{
        servicio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
        },
        fechaInicio: Date,
        fechaFin: Date
    }],
    proximoFinContrato: {
        type: Date
    },
    disponibilidad: {
        type: String,
        enum: ['DISPONIBLE', 'OCUPADO', 'BAJA_IT', 'VACACIONES', 'NO_DISPONIBLE'],
        default: 'DISPONIBLE'
    },
    calificacion: {
        type: Number,
        min: 0,
        max: 5,
        default: 5
    },
    observaciones: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Índices
workerSchema.index({ nombre: 'text' });
workerSchema.index({ disponibilidad: 1 });

// Virtual para número de servicios activos
workerSchema.virtual('numeroServiciosActivos').get(function () {
    return this.serviciosActivos ? this.serviciosActivos.length : 0;
});

// Virtual para verificar si está sobrecargado
workerSchema.virtual('estaSobrecargado').get(function () {
    return this.numeroServiciosActivos > 5;
});

// Método para calcular rendimiento promedio
workerSchema.methods.calcularRendimiento = function () {
    // Fórmula basada en fiabilidad, número de bajas IT y servicios activos
    const penalizacionBajasIT = this.historialBajasIT.length * 5;
    const penalizacionSobrecarga = this.estaSobrecargado ? 10 : 0;

    const rendimiento = Math.max(0, Math.min(100,
        this.fiabilidad - penalizacionBajasIT - penalizacionSobrecarga
    ));

    this.rendimiento = rendimiento;
    return rendimiento;
};

// Método para verificar disponibilidad
workerSchema.methods.estaDisponible = function () {
    return this.disponibilidad === 'DISPONIBLE' && this.isActive;
};

// Configurar virtuals en JSON
workerSchema.set('toJSON', { virtuals: true });
workerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Worker', workerSchema);
