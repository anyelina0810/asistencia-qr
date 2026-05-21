/**
 * routes/subjects.js — Gestión de Asignaturas
 */

'use strict';

const router = require('express').Router();
const { getDB }                    = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/subjects — Lista según rol
router.get('/', (req, res, next) => {
    try {
        const db = getDB();
        let subjects;

        if (req.user.role === 'student') {
            // Estudiante ve solo las materias en las que está inscrito
            subjects = db.prepare(`
                SELECT s.id, s.code, s.name, s.semester, u.name AS teacher_name
                FROM   subjects s
                JOIN   enrollments e ON e.subject_id = s.id
                JOIN   users u ON u.id = s.teacher_id
                WHERE  e.student_id = ? AND s.is_active = 1
                ORDER  BY s.name
            `).all(req.user.id);
        } else {
            // Profesor ve sus materias
            subjects = db.prepare(`
                SELECT s.id, s.code, s.name, s.semester,
                       (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id) AS student_count
                FROM   subjects s
                WHERE  s.teacher_id = ? AND s.is_active = 1
                ORDER  BY s.name
            `).all(req.user.id);
        }

        res.json({ subjects });
    } catch (err) {
        next(err);
    }
});

// GET /api/subjects/:id — Detalle de una asignatura
router.get('/:id', (req, res, next) => {
    try {
        const db      = getDB();
        const subject = db.prepare(`
            SELECT s.*, u.name AS teacher_name
            FROM   subjects s
            JOIN   users u ON u.id = s.teacher_id
            WHERE  s.id = ?
        `).get(req.params.id);

        if (!subject) return res.status(404).json({ error: 'Asignatura no encontrada.' });
        res.json({ subject });
    } catch (err) {
        next(err);
    }
});

// POST /api/subjects — Crear asignatura (solo profesor/admin)
router.post('/', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const { code, name, description, semester } = req.body;
        if (!code || !name || !semester) {
            return res.status(400).json({ error: 'Código, nombre y semestre son obligatorios.' });
        }

        const db   = getDB();
        const info = db.prepare(`
            INSERT INTO subjects (code, name, description, teacher_id, semester)
            VALUES (?, ?, ?, ?, ?)
        `).run(code.toUpperCase(), name, description || null, req.user.id, semester);

        res.status(201).json({ message: 'Asignatura creada.', subjectId: info.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Ya existe una asignatura con ese código.' });
        }
        next(err);
    }
});

module.exports = router;
