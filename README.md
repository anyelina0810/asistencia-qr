# 🎓 QRAttend — Sistema de Control de Asistencias por QR

> Prototipo funcional para entornos académicos universitarios.
> Stack: **Node.js + Express + SQLite + Vanilla JS**

---

## 📁 Arquitectura de Carpetas

```
qr-attendance/
├── backend/
│   ├── config/
│   │   └── database.js          # Conexión y arranque de SQLite
│   ├── middleware/
│   │   └── auth.js              # JWT verify + control de roles
│   ├── routes/
│   │   ├── auth.js              # POST /login  GET /me
│   │   ├── subjects.js          # CRUD asignaturas
│   │   ├── sessions.js          # Sesiones + generación QR dinámico
│   │   ├── attendance.js        # Escaneo y registro de asistencia
│   │   └── users.js             # Gestión de usuarios (admin)
│   ├── utils/
│   │   └── qrToken.js           # TOTP simplificado (HMAC-SHA256)
│   └── server.js                # Express app + arranque
│
├── frontend/
│   ├── shared/
│   │   └── api.js               # Cliente HTTP + Auth helper
│   ├── index.html               # Landing + Login universal
│   ├── teacher/
│   │   └── index.html           # Dashboard profesor (QR + asistencias)
│   └── student/
│       └── index.html           # Vista estudiante (cámara + historial)
│
├── database/
│   ├── schema.sql               # DDL + datos de prueba
│   └── attendance.db            # Generado automáticamente
│
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Instalación y Arranque

### 1. Requisitos

- Node.js ≥ 18
- npm ≥ 9

### 2. Clonar e instalar

```bash
git clone <repo>
cd qr-attendance
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env y cambia JWT_SECRET por uno seguro
```

### 4. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor arranca en `http://localhost:3000`.
La base de datos SQLite se crea automáticamente en el primer arranque.

### 5. Resetear la base de datos

```bash
npm run db:reset
```

---

## 🔐 Usuarios de Prueba

| Rol       | Email                        | Contraseña    |
|-----------|------------------------------|---------------|
| Profesor  | `profesor@universidad.edu`   | `password123` |
| Estudiante| `ana.garcia@uni.edu`         | `password123` |
| Estudiante| `luis.torres@uni.edu`        | `password123` |

---

## 🌊 Flujo de Trabajo

### Vista Profesor
1. Login → seleccionar asignatura → crear sesión
2. Clic en **"Abrir Sesión"** → el QR aparece en pantalla
3. El QR **rota cada 15 s** (TOTP-like) → no se puede compartir
4. La tabla de asistencias se actualiza en tiempo real (polling 5 s)
5. Clic en **"Cerrar Sesión"** cuando termina la clase

### Vista Estudiante
1. Login → pestaña "Escanear"
2. Activar cámara → apuntar al QR del profesor
3. Al detectar, el backend valida el token y registra la asistencia
4. El historial queda en la pestaña "Historial"

---

## 🛡️ Seguridad Implementada

| Amenaza                    | Mitigación                                                   |
|----------------------------|--------------------------------------------------------------|
| QR compartido por foto     | Token HMAC-SHA256 rotante cada N segundos (TOTP-like)        |
| Doble registro             | Restricción UNIQUE(session_id, student_id) en BD             |
| Estudiante no inscrito     | Verificación de enrollment antes de registrar                |
| Brute force login          | Rate limiter: 20 req/15 min por IP                           |
| Timing attacks             | `crypto.timingSafeEqual` en comparación de tokens            |
| Inyección SQL              | Prepared statements (better-sqlite3, sin concatenación)      |
| XSS / headers HTTP         | Helmet.js con Content Security Policy                        |
| Sesión expirada            | JWT con expiración + redirección automática al login         |
| Fraude de red              | Log de auditoría con IP + User-Agent en cada escaneo         |

---

## 🔌 API Reference

### Autenticación

| Método | Endpoint         | Descripción            |
|--------|------------------|------------------------|
| POST   | `/api/auth/login`| Login, retorna JWT     |
| GET    | `/api/auth/me`   | Perfil del usuario     |

### Sesiones

| Método | Endpoint                      | Descripción                  |
|--------|-------------------------------|------------------------------|
| GET    | `/api/sessions?subjectId=X`   | Lista sesiones                |
| POST   | `/api/sessions`               | Crear sesión                  |
| POST   | `/api/sessions/:id/open`      | Abrir sesión (QR activo)      |
| POST   | `/api/sessions/:id/close`     | Cerrar sesión                 |
| GET    | `/api/sessions/:id/qr`        | Obtener payload QR actual     |
| GET    | `/api/sessions/:id/attendances` | Lista de asistentes         |

### Asistencias

| Método | Endpoint               | Descripción                   |
|--------|------------------------|-------------------------------|
| POST   | `/api/attendance/scan` | Registrar asistencia (alumno) |
| GET    | `/api/attendance/my`   | Historial del alumno          |

---

## 📈 Próximas Mejoras

- [ ] WebSocket (Socket.io) para asistencias en tiempo real sin polling
- [ ] Exportar asistencias a CSV / Excel
- [ ] Geolocalización opcional para validar que el estudiante está en el aula
- [ ] App PWA con push notifications
- [ ] Migración a PostgreSQL para producción
- [ ] Panel de administrador con reportes globales
- [ ] 2FA para cuentas de profesor

---

## 📄 Licencia

MIT — Libre para uso académico.
