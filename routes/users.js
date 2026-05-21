/**
 * routes/users.js — Gestión de usuarios (admin)
 */
'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { getDB }                    = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// POST /api/users/register — Registrar nuevo usuario (admin)
router.post('/register', requireRole('admin', 'teacher'), async (req, res, next) => {
    try {
        const { name, email, password, role, studentCode } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Todos los campos son requeridos.' });
        }

        const validRoles = ['teacher', 'student'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Rol inválido.' });
        }

        const db       = getDB();
        const roleRow  = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
        const hash     = await bcrypt.hash(password, 12);

        db.prepare(`
            INSERT INTO users (role_id, name, email, password_hash, student_code)
            VALUES (?, ?, ?, ?, ?)
        `).run(roleRow.id, name, email.toLowerCase(), hash, studentCode || null);

        res.status(201).json({ message: 'Usuario registrado.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'El email ya está registrado.' });
        }
        next(err);
    }
});

// GET /api/users/students?subjectId=X — Lista de alumnos
router.get('/students', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const db = getDB();
        const { subjectId } = req.query;

        let query = `
            SELECT u.id, u.name, u.email, u.student_code, u.created_at
            FROM   users u
            JOIN   roles r ON r.id = u.role_id
            WHERE  r.name = 'student' AND u.is_active = 1
        `;
        const params = [];

        if (subjectId) {
            query += ' AND EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = u.id AND e.subject_id = ?)';
            params.push(subjectId);
        }

        query += ' ORDER BY u.name';
        const students = db.prepare(query).all(...params);
        res.json({ students });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
