/**
 * middleware/auth.js — Verificación de JWT y control de roles
 */

'use strict';

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Middleware: verifica el token JWT del encabezado Authorization.
 * Adjunta `req.user` con { id, role, name, email } si es válido.
 */
function requireAuth(req, res, next) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
        }
        return res.status(401).json({ error: 'Token inválido.' });
    }
}

/**
 * Factory: verifica que el usuario tenga uno de los roles permitidos.
 * @param {...string} roles - 'admin' | 'teacher' | 'student'
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
