/**
 * utils/qrToken.js — Motor de tokens QR dinámicos
 *
 * Estrategia: TOTP simplificado (Time-based One-Time Token)
 * ─────────────────────────────────────────────────────────
 * • Cada sesión tiene un `qr_secret` único (generado aleatoriamente).
 * • El token QR se construye como HMAC-SHA256(secret, "sessionId:windowIndex")
 *   donde `windowIndex = floor(Date.now() / intervalMs)`.
 * • El escáner envía el token; el backend acepta la ventana actual
 *   y la inmediatamente anterior (tolerancia de 1 ventana).
 * • El QR tiene formato: JSON { sessionId, token, exp }
 *   que se convierte a string y se codifica en el QR visual.
 */

'use strict';

const crypto = require('crypto');

/**
 * Genera el token para una ventana de tiempo específica.
 */
function _computeToken(secret, sessionId, windowIndex) {
    const message = `${sessionId}:${windowIndex}`;
    return crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex')
        .slice(0, 32); // 128 bits en hex es suficiente
}

/**
 * Genera el payload QR vigente para una sesión.
 * @param {number} sessionId
 * @param {string} qrSecret      - Secret único de la sesión
 * @param {number} intervalSec   - Duración de cada ventana en segundos
 * @returns {{ sessionId, token, windowIndex, exp, payload: string }}
 */
function generateQRPayload(sessionId, qrSecret, intervalSec = 15) {
    const intervalMs  = intervalSec * 1000;
    const windowIndex = Math.floor(Date.now() / intervalMs);
    const token       = _computeToken(qrSecret, sessionId, windowIndex);
    const exp         = (windowIndex + 1) * intervalMs; // timestamp Unix ms cuando expira

    const payload = JSON.stringify({ s: sessionId, t: token, e: exp });
    return { sessionId, token, windowIndex, exp, payload };
}

/**
 * Valida un token recibido del escáner.
 * Acepta la ventana actual y la anterior (tolerancia anti-lag de red).
 * @param {string} submittedToken
 * @param {number} sessionId
 * @param {string} qrSecret
 * @param {number} intervalSec
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateQRToken(submittedToken, sessionId, qrSecret, intervalSec = 15) {
    if (!submittedToken || typeof submittedToken !== 'string') {
        return { valid: false, reason: 'Token vacío o inválido.' };
    }

    const intervalMs    = intervalSec * 1000;
    const nowWindow     = Math.floor(Date.now() / intervalMs);
    const prevWindow    = nowWindow - 1;

    const validTokens = [
        _computeToken(qrSecret, sessionId, nowWindow),
        _computeToken(qrSecret, sessionId, prevWindow),
    ];

    // Comparación en tiempo constante para evitar timing attacks
    const isValid = validTokens.some(vt =>
        crypto.timingSafeEqual(
            Buffer.from(submittedToken.padEnd(64)),
            Buffer.from(vt.padEnd(64))
        )
    );

    if (!isValid) {
        return { valid: false, reason: 'Token expirado o incorrecto.' };
    }
    return { valid: true };
}

/**
 * Genera un secret aleatorio seguro para una sesión nueva.
 * @returns {string} 64 hex chars (256 bits)
 */
function generateSessionSecret() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateQRPayload, validateQRToken, generateSessionSecret };
