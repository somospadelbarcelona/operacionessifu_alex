const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    text: {
        type: String,
        required: [true, 'El texto de la nota es obligatorio'],
        trim: true
    },
    tag: {
        type: String,
        default: 'INFO'
    },
    date: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Note', NoteSchema);
