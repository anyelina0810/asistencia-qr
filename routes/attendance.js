/**
 * routes/attendance.js — Registro de asistencia al escanear QR
 *
 * Validaciones anti-fraude:
 *  1. Token QR dentro de la ventana temporal válida
 *  2. Sesión abierta por el profesor
 *  3. Estudiante inscrito en la materia
 *  4. No se puede registrar dos veces en la misma sesión (UNIQUE constraint)
 *  5. Log de auditoría para intentos fallidos
 */

'use strict';

const router = require('express').Router();
const { getDB }                    = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateQRToken }          = require('../utils/qrToken');

// ── Todas las rutas requieren autenticación ────────────────
router.use(requireAuth);

// ────────────────────────────────────────────────────────────
// POST /api/attendance/scan
// Body: { payload: "<string del QR escaneado>" }
// ────────────────────────────────────────────────────────────
router.post('/scan', requireRole('student'), (req, res, next) => {
    const db    = getDB();
    const audit = _logAudit.bind(null, db);

    try {
        const { payload } = req.body;
        const studentId   = req.user.id;
        const ip          = req.ip || req.connection.remoteAddress;
        const ua          = req.headers['user-agent'] || '';

        // ── 1. Parsear payload QR ──────────────────────────
        let qrData;
        try {
            qrData = JSON.parse(payload);
        } catch {
            return res.status(400).json({ error: 'Formato de QR inválido.' });
        }

        const { s: sessionId, t: token } = qrData;

        if (!sessionId || !token) {
            return res.status(400).json({ error: 'QR incompleto.' });
        }

        // ── 2. Obtener la sesión ───────────────────────────
        const session = db.prepare(
            'SELECT * FROM class_sessions WHERE id = ?'
        ).get(sessionId);

        if (!session) {
            audit('invalid_session', studentId, sessionId, 'Sesión inexistente', ip);
            return res.status(404).json({ error: 'Sesión de clase no encontrada.' });
        }

        // ── 3. Verificar que la sesión está abierta ────────
        if (!session.is_open) {
            audit('session_closed', studentId, sessionId, 'Sesión cerrada', ip);
            return res.status(409).json({
                error: 'La sesión no está activa. El profesor debe abrir la clase.',
            });
        }

        // ── 4. Validar token QR (ventana temporal) ─────────
        const { valid, reason } = validateQRToken(
            token,
            session.id,
            session.qr_secret,
            session.qr_interval_sec
        );

        if (!valid) {
            audit('invalid_token', studentId, sessionId, reason, ip);
            return res.status(401).json({
                error: `QR expirado o inválido. ${reason} Pide al profesor que muestre el QR actualizado.`,
            });
        }

        // ── 5. Verificar inscripción en la materia ─────────
        const enrolled = db.prepare(`
            SELECT id FROM enrollments
            WHERE student_id = ? AND subject_id = ?
        `).get(studentId, session.subject_id);

        if (!enrolled) {
            audit('not_enrolled', studentId, sessionId, 'No inscrito en la materia', ip);
            return res.status(403).json({
                error: 'No estás inscrito en esta asignatura.',
            });
        }

        // ── 6. Registrar asistencia (UNIQUE previene duplicados) ──
        try {
            db.prepare(`
                INSERT INTO attendances
                    (session_id, student_id, ip_address, user_agent, token_used)
                VALUES (?, ?, ?, ?, ?)
            `).run(session.id, studentId, ip, ua, token);
        } catch (err) {
            if (err.message.includes('UNIQUE')) {
                audit('duplicate_scan', studentId, sessionId, 'Intento de doble registro', ip);
                return res.status(409).json({
                    error: 'Ya registraste tu asistencia en esta sesión.',
                });
            }
            throw err;
        }

        // ── 7. Respuesta exitosa ───────────────────────────
        const subject = db.prepare('SELECT name, code FROM subjects WHERE id = ?')
            .get(session.subject_id);

        res.json({
            success: true,
            message: '✅ ¡Asistencia registrada exitosamente!',
            data: {
                studentName:  req.user.name,
                subjectName:  subject.name,
                subjectCode:  subject.code,
                sessionTitle: session.title,
                sessionDate:  session.session_date,
                scannedAt:    new Date().toISOString(),
            },
        });

    } catch (err) {
        next(err);
    }
});

// ────────────────────────────────────────────────────────────
// GET /api/attendance/my?subjectId=X
// Historial de asistencias del estudiante autenticado
// ────────────────────────────────────────────────────────────
router.get('/my', requireRole('student'), (req, res, next) => {
    try {
        const db = getDB();
        const { subjectId } = req.query;

        let query = `
            SELECT a.scanned_at, cs.session_date, cs.title, cs.scheduled_start,
                   s.name AS subject_name, s.code AS subject_code
            FROM   attendances a
            JOIN   class_sessions cs ON cs.id = a.session_id
            JOIN   subjects s ON s.id = cs.subject_id
            WHERE  a.student_id = ?
        `;
        const params = [req.user.id];

        if (subjectId) {
            query += ' AND s.id = ?';
            params.push(subjectId);
        }

        query += ' ORDER BY a.scanned_at DESC';

        const records = db.prepare(query).all(...params);
        res.json({ records });
    } catch (err) {
        next(err);
    }
});

// ── Helper: log de auditoría ───────────────────────────────
function _logAudit(db, eventType, userId, sessionId, detail, ip) {
    try {
        db.prepare(`
            INSERT INTO audit_log (event_type, user_id, session_id, detail, ip_address)
            VALUES (?, ?, ?, ?, ?)
        `).run(eventType, userId, sessionId, detail, ip);
    } catch { /* no interrumpir el flujo principal */ }
}

module.exports = router;
