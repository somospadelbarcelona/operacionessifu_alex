const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    worker: {
        type: String,
        required: [true, 'El nombre del trabajador es obligatorio'],
        trim: true
    },
    type: {
        type: String,
        enum: ['AUSENCIA', 'RETRASO', 'OTRO'],
        default: 'AUSENCIA'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MID', 'HIGH'],
        default: 'MID'
    },
    desc: {
        type: String,
        required: [true, 'La descripción es obligatoria']
    },
    date: {
        type: String,
        required: [true, 'La fecha es obligatoria']
    },
    time: {
        type: String,
        required: [true, 'La hora es obligatoria']
    },
    reported: {
        type: Boolean,
        default: false
    },
    resolved: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Incident', IncidentSchema);

