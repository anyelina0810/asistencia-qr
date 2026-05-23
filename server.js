/**
 * server.js - Punto de entrada del servidor
 * Sistema de Asistencias por QR · Node.js + Express + SQLite
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');
const path       = require('path');
const { initDB } = require('./config/database');

// -- Rutas de la API (Se cargan antes de los estáticos)
const authRoutes       = require('./routes/auth');
const subjectRoutes    = require('./routes/subjects');
const sessionRoutes    = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const userRoutes       = require('./routes/users');

// -- Inicialización de la Aplicación
const app = express();
const PORT = process.env.PORT || 3000;

// -- Seguridad HTTP (Helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
            fontSrc: ["'self'", 'fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"]
        }
    }
}));

// -- Middlewares básicos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// -- Conectar Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', userRoutes);

// -- Archivos Estáticos
app.use(express.static(path.join(__dirname, 'frontend')));

// -- Rutas SPA (fallback)
app.get('/profesor*', (_, res) => {
    res.sendFile(path.join(__dirname, 'frontend/profesor/index.html'));
});

app.get('/alumno*', (_, res) => {
    res.sendFile(path.join(__dirname, 'frontend/alumno/index.html'));
});

app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, 'frontend/inicio.html'));
});

// -- Manejo de errores global
app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
        error: status === 500 ? 'Error interno del servidor' : err.message
    });
});

// -- Arranque del Servidor
(async () => {
    await initDB();
    app.listen(PORT, () => {
        console.log(`\n🚀 QR Attendance System corriendo en http://localhost:${PORT}`);
        console.log(`  • API:      http://localhost:${PORT}/api`);
        console.log(`  • Profesor: http://localhost:${PORT}/profesor`);
        console.log(`  • Alumno:   http://localhost:${PORT}/alumno\n`);
    });
})();
