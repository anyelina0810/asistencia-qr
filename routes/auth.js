/**
 * routes/auth.js — Autenticación (Login / Me)
 */

'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDB }      = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validación básica de entrada
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }
        if (typeof email !== 'string' || email.length > 255) {
            return res.status(400).json({ error: 'Email inválido.' });
        }

        const db   = getDB();
        const user = db.prepare(`
            SELECT u.id, u.name, u.email, u.password_hash, u.student_code,
                   u.is_active, r.name AS role
            FROM   users u
            JOIN   roles r ON r.id = u.role_id
            WHERE  u.email = ?
        `).get(email.toLowerCase().trim());

        // Mensaje genérico para no revelar si el email existe
        if (!user) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }
        if (!user.is_active) {
            return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const payload = {
            id:          user.id,
            name:        user.name,
            email:       user.email,
            role:        user.role,
            studentCode: user.student_code,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        res.json({
            token,
            user: payload,
            expiresIn: JWT_EXPIRES,
        });

    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/auth/me
 * Retorna el perfil del usuario autenticado.
 */
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
