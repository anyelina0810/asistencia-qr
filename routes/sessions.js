/**
 * routes/sessions.js — Gestión de Sesiones de Clase y generación de QR dinámico
 */

'use strict';

const router = require('express').Router();
const { getDB }                      = require('../config/database');
const { requireAuth, requireRole }   = require('../middleware/auth');
const { generateQRPayload, generateSessionSecret } = require('../utils/qrToken');

// ── Todas las rutas requieren autenticación ────────────────
router.use(requireAuth);

// ────────────────────────────────────────────────────────────
// GET /api/sessions?subjectId=X
// Lista sesiones de una asignatura (profesor ve las suyas)
// ────────────────────────────────────────────────────────────
router.get('/', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const { subjectId } = req.query;
        const db = getDB();

        let query = `
            SELECT cs.id, cs.title, cs.session_date, cs.scheduled_start,
                   cs.scheduled_end, cs.is_open, cs.opened_at, cs.closed_at,
                   s.name AS subject_name, s.code AS subject_code,
                   (SELECT COUNT(*) FROM attendances a WHERE a.session_id = cs.id) AS attendance_count
            FROM   class_sessions cs
            JOIN   subjects s ON s.id = cs.subject_id
            WHERE  cs.teacher_id = ?
        `;
        const params = [req.user.id];

        if (subjectId) {
            query += ' AND cs.subject_id = ?';
            params.push(subjectId);
        }

        query += ' ORDER BY cs.session_date DESC, cs.scheduled_start DESC';

        const sessions = db.prepare(query).all(...params);
        res.json({ sessions });
    } catch (err) {
        next(err);
    }
});

// ────────────────────────────────────────────────────────────
// POST /api/sessions
// Crea una nueva sesión de clase
// ────────────────────────────────────────────────────────────
router.post('/', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const { subjectId, title, sessionDate, start, end, intervalSec = 15 } = req.body;

        if (!subjectId || !sessionDate || !start || !end) {
            return res.status(400).json({ error: 'Faltan campos obligatorios.' });
        }

        const db = getDB();

        // Verificar que el profesor sea dueño de la asignatura
        const subject = db.prepare(
            'SELECT id FROM subjects WHERE id = ? AND teacher_id = ?'
        ).get(subjectId, req.user.id);

        if (!subject) {
            return res.status(403).json({ error: 'No tienes acceso a esta asignatura.' });
        }

        const secret = generateSessionSecret();
        const info   = db.prepare(`
            INSERT INTO class_sessions
                (subject_id, teacher_id, title, session_date, scheduled_start, scheduled_end,
                 qr_secret, qr_interval_sec)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(subjectId, req.user.id, title || null, sessionDate, start, end, secret, intervalSec);

        res.status(201).json({
            message:   'Sesión creada.',
            sessionId: info.lastInsertRowid,
        });
    } catch (err) {
        next(err);
    }
});

// ────────────────────────────────────────────────────────────
// POST /api/sessions/:id/open   → Abre la sesión (activa QR)
// POST /api/sessions/:id/close  → Cierra la sesión
// ────────────────────────────────────────────────────────────
router.post('/:id/open', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const db      = getDB();
        const session = _getOwnedSession(db, req.params.id, req.user.id);
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

        db.prepare(`
            UPDATE class_sessions
            SET is_open = 1, opened_at = datetime('now')
            WHERE id = ?
        `).run(session.id);

        res.json({ message: 'Sesión abierta. El QR está activo.' });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/close', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const db      = getDB();
        const session = _getOwnedSession(db, req.params.id, req.user.id);
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

        db.prepare(`
            UPDATE class_sessions
            SET is_open = 0, closed_at = datetime('now')
            WHERE id = ?
        `).run(session.id);

        res.json({ message: 'Sesión cerrada.' });
    } catch (err) {
        next(err);
    }
});

// ────────────────────────────────────────────────────────────
// GET /api/sessions/:id/qr
// Retorna el payload QR actual + tiempo restante
// El frontend llama este endpoint cada N segundos para refrescar
// ────────────────────────────────────────────────────────────
router.get('/:id/qr', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const db      = getDB();
        const session = _getOwnedSession(db, req.params.id, req.user.id);

        if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });
        if (!session.is_open) return res.status(409).json({ error: 'La sesión no está abierta.' });

        const { payload, exp } = generateQRPayload(
            session.id,
            session.qr_secret,
            session.qr_interval_sec
        );

        const remainingMs = exp - Date.now();

        res.json({
            payload,                              // String a codificar en el QR
            intervalSec: session.qr_interval_sec,
            remainingMs,
            expiresAt: new Date(exp).toISOString(),
        });
    } catch (err) {
        next(err);
    }
});

// ────────────────────────────────────────────────────────────
// GET /api/sessions/:id/attendances
// Lista de asistencias de una sesión (tiempo real para el profesor)
// ────────────────────────────────────────────────────────────
router.get('/:id/attendances', requireRole('teacher', 'admin'), (req, res, next) => {
    try {
        const db      = getDB();
        const session = _getOwnedSession(db, req.params.id, req.user.id);
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

        const records = db.prepare(`
            SELECT u.id AS student_id, u.name, u.email, u.student_code,
                   a.scanned_at, a.ip_address
            FROM   attendances a
            JOIN   users u ON u.id = a.student_id
            WHERE  a.session_id = ?
            ORDER  BY a.scanned_at ASC
        `).all(session.id);

        // Total inscritos en la materia
        const total = db.prepare(
            'SELECT COUNT(*) AS c FROM enrollments WHERE subject_id = ?'
        ).get(session.subject_id).c;

        res.json({
            session:  { id: session.id, title: session.title, is_open: session.is_open },
            total,
            attended: records.length,
            records,
        });
    } catch (err) {
        next(err);
    }
});

// ── Helper privado ─────────────────────────────────────────
function _getOwnedSession(db, sessionId, teacherId) {
    return db.prepare(
        'SELECT * FROM class_sessions WHERE id = ? AND teacher_id = ?'
    ).get(sessionId, teacherId);
}

module.exports = router;
