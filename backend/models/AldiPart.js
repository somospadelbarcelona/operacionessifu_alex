const mongoose = require('mongoose');

const AldiPartSchema = new mongoose.Schema({
    workerName: {
        type: String,
        required: true,
        trim: true
    },
    center: {
        type: String,
        required: true,
        trim: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    schedule: {
        start: String,
        end: String,
        hoursPerDay: Number
    },
    detectedDays: {
        type: Number,
        required: true
    },
    detectedHours: {
        type: Number,
        required: true
    },
    absences: [Number],
    status: {
        type: String,
        enum: ['PENDING', 'VALIDATED', 'ARCHIVED'],
        default: 'VALIDATED'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    fileName: String,
    rawOutput: String
}, {
    timestamps: true
});

module.exports = mongoose.model('AldiPart', AldiPartSchema);
