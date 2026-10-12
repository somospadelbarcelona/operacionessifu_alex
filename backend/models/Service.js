/**
 * SERVICE MODEL - Modelo de Servicio
 */

const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    proyecto: {
        type: String,
        required: [true, 'El proyecto es requerido'],
        trim: true,
        index: true
    },
    servicio: {
        type: String,
        required: [true, 'El nombre del servicio es requerido'],
        trim: true
    },
    tipo: {
        type: String,
        enum: ['LIMPIEZA', 'SEGURIDAD', 'MANTENIMIENTO', 'RECEPCIÓN', 'OTROS'],
        required: [true, 'El tipo de servicio es requerido']
    },
    titular: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker'
    },
    estado: {
        type: String,
        enum: ['CUBIERTO', 'DESCUBIERTO'],
        default: 'DESCUBIERTO',
        index: true
    },
    estado1: {
        type: String,
        enum: ['ACTIVO', 'BAJA IT', 'VACACIONES', 'PERMISO', 'OTRO'],
        default: 'ACTIVO'
    },
    suplente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker'
    },
    gestor: {
        type: String,
        trim: true
    },
    horario: {
        type: String,
        trim: true
    },
    ubicacion: {
        type: String,
        trim: true
    },
    coordenadas: {
        lat: Number,
        lng: Number
    },
    finContrato: {
        type: Date
    },
    inicioVacaciones: {
        type: Date
    },
    finVacaciones: {
        type: Date
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

// Índices compuestos para búsquedas frecuentes
serviceSchema.index({ proyecto: 1, estado: 1 });
serviceSchema.index({ titular: 1, estado: 1 });
serviceSchema.index({ tipo: 1, ubicacion: 1 });

// Virtual para días hasta fin de contrato
serviceSchema.virtual('diasHastaFinContrato').get(function () {
    if (!this.finContrato) return null;

    const today = new Date();
    const diffTime = this.finContrato - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
});

// Método para verificar si el contrato está próximo a vencer
serviceSchema.methods.isContractEnding = function (days = 30) {
    const diasRestantes = this.diasHastaFinContrato;
    return diasRestantes !== null && diasRestantes > 0 && diasRestantes <= days;
};

// Método para verificar si está en vacaciones
serviceSchema.methods.isOnVacation = function () {
    if (!this.inicioVacaciones || !this.finVacaciones) return false;

    const today = new Date();
    return today >= this.inicioVacaciones && today <= this.finVacaciones;
};

// Configurar virtuals en JSON
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);
