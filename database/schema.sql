-- ============================================================
-- 
-- Esquema de Base de Datos - SQLite (compatible con PostgreSQL)
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- TABLA: roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE -- 'admin', 'teacher', 'student'
);

INSERT OR IGNORE INTO roles (name) VALUES ('admin'), ('teacher'), ('student');

-- ------------------------------------------------------------
-- TABLA: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id      INTEGER NOT NULL REFERENCES roles(id),
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,        -- bcrypt hash
    student_code TEXT,                    -- Matrícula universitaria (solo estudiantes)
    avatar_url   TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role_id);

-- ------------------------------------------------------------
-- TABLA: subjects (Asignaturas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,  -- ej: "CS301"
    name        TEXT    NOT NULL,
    description TEXT,
    teacher_id  INTEGER NOT NULL REFERENCES users(id),
    semester    TEXT    NOT NULL,         -- ej: "2025-1"
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);

-- ------------------------------------------------------------
-- TABLA: enrollments (Inscripciones estudiante ↔ asignatura)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    enrolled_at TEXT   NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);

-- ------------------------------------------------------------
-- TABLA: class_sessions (Sesiones de clase donde se genera el QR)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id      INTEGER NOT NULL REFERENCES users(id),
    title           TEXT,                             -- ej: "Clase 12 - Recursión"
    session_date    TEXT    NOT NULL,                 -- DATE: "2025-06-15"
    scheduled_start TEXT    NOT NULL,                 -- TIME: "10:00"
    scheduled_end   TEXT    NOT NULL,                 -- TIME: "12:00"
    -- QR dinámico: token rotante cada N segundos
    qr_secret       TEXT    NOT NULL,                 -- HMAC secret para firmar tokens
    qr_interval_sec INTEGER NOT NULL DEFAULT 15,      -- Intervalo de rotación
    is_open         INTEGER NOT NULL DEFAULT 0,       -- 1 = activa, acepta asistencias
    opened_at       TEXT,
    closed_at       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_subject ON class_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date    ON class_sessions(session_date);

-- ------------------------------------------------------------
-- TABLA: attendances (Registro de asistencias)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL REFERENCES class_sessions(id),
    student_id      INTEGER NOT NULL REFERENCES users(id),
    scanned_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    ip_address      TEXT,                  -- Para detección de fraude
    user_agent      TEXT,
    token_used      TEXT    NOT NULL,      -- Token QR que se escaneó (auditoría)
    -- Evitar doble registro en la misma sesión
    UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendances_session ON attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON attendances(student_id);

-- ------------------------------------------------------------
-- TABLA: audit_log (Intentos fallidos y eventos de seguridad)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,   -- 'invalid_token', 'expired_token', 'duplicate_scan', 'not_enrolled'
    user_id    INTEGER REFERENCES users(id),
    session_id INTEGER REFERENCES class_sessions(id),
    detail     TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- DATOS DE PRUEBA (seed)
-- Contraseñas: "password123" -> hash bcrypt pre-generado para demo
-- CAMBIAR EN PRODUCCIÓN
-- ------------------------------------------------------------
INSERT OR IGNORE INTO users (role_id, name, email, password_hash, student_code) VALUES
-- Profesor (role_id=2)
(2, 'Dr. Carlos Méndez', 'profesor@universidad.edu',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMZJool6MRSijl9qOFHnmH8e5K', NULL),
-- Estudiantes (role_id=3)
(3, 'Ana García López',    'ana.garcia@uni.edu',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMZJool6MRSijl9qOFHnmH8e5K', 'A20210001'),
(3, 'Luis Torres Reyes',   'luis.torres@uni.edu',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMZJool6MRSijl9qOFHnmH8e5K', 'A20210002'),
(3, 'María Rodríguez Vega','maria.rodriguez@uni.edu','$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMZJool6MRSijl9qOFHnmH8e5K', 'A20210003');

INSERT OR IGNORE INTO subjects (code, name, description, teacher_id, semester) VALUES
('CS301', 'Algoritmos y Estructuras de Datos', 'Fundamentos de algoritmia', 1, '2025-1'),
('CS401', 'Programación Web Avanzada',          'Full Stack con tecnologías modernas', 1, '2025-1');

INSERT OR IGNORE INTO enrollments (student_id, subject_id) VALUES
(2, 1), (2, 2),
(3, 1),
(4, 1), (4, 2);
