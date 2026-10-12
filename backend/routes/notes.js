const express = require('express');
const router = express.Router();
const Note = require('../models/Note');

// @route   GET /api/notes
// @desc    Obtener todas las notas
// @access  Public
router.get('/', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: { notes }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener notas',
            error: error.message
        });
    }
});

// @route   POST /api/notes
// @desc    Crear una nota
// @access  Public
router.post('/', async (req, res) => {
    try {
        const note = await Note.create(req.body);

        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('note-created', note);
        }

        res.status(201).json({
            success: true,
            message: 'Nota creada con éxito',
            data: { note }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al crear nota',
            error: error.message
        });
    }
});

// @route   PUT /api/notes/:id
// @desc    Actualizar una nota por su ID numérico
// @access  Public
router.put('/:id', async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);
        const note = await Note.findOneAndUpdate(
            { id: noteId },
            { $set: req.body },
            { new: true }
        );

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Nota no encontrada'
            });
        }

        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('note-updated', note);
        }

        res.json({
            success: true,
            message: 'Nota actualizada con éxito',
            data: { note }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar nota',
            error: error.message
        });
    }
});

// @route   DELETE /api/notes/:id
// @desc    Eliminar una nota por su ID numérico
// @access  Public
router.delete('/:id', async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);
        const result = await Note.deleteOne({ id: noteId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nota no encontrada'
            });
        }

        // Emitir evento por socket.io
        const io = req.app.get('io');
        if (io) {
            io.emit('note-deleted', { id: noteId });
        }

        res.json({
            success: true,
            message: 'Nota eliminada correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al eliminar nota',
            error: error.message
        });
    }
});

module.exports = router;

