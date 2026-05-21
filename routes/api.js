/**
 * shared/api.js — Cliente HTTP centralizado para todos los frontends
 * Maneja JWT, refresco de errores 401 y helpers de autenticación.
 */

const API_BASE = '/api';

// ── Almacenamiento de sesión ───────────────────────────────
const Auth = {
    getToken:  ()      => localStorage.getItem('qr_token'),
    getUser:   ()      => JSON.parse(localStorage.getItem('qr_user') || 'null'),
    save:      (token, user) => {
        localStorage.setItem('qr_token', token);
        localStorage.setItem('qr_user', JSON.stringify(user));
    },
    clear:     ()      => {
        localStorage.removeItem('qr_token');
        localStorage.removeItem('qr_user');
    },
    isLoggedIn: ()     => !!localStorage.getItem('qr_token'),
    hasRole:   (role)  => Auth.getUser()?.role === role,
};

// ── Función fetch con autenticación ───────────────────────
async function apiFetch(path, options = {}) {
    const token = Auth.getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(API_BASE + path, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Sesión expirada → redirigir al login
    if (res.status === 401) {
        Auth.clear();
        window.location.href = '/';
        return;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const err  = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }

    return data;
}

// ── Endpoints ──────────────────────────────────────────────
const API = {
    // Auth
    login:   (email, password) =>
        apiFetch('/auth/login', { method: 'POST', body: { email, password } }),

    // Subjects
    mySubjects: () => apiFetch('/subjects'),

    // Sessions
    getSessions:    (subjectId) => apiFetch(`/sessions?subjectId=${subjectId}`),
    createSession:  (data)      => apiFetch('/sessions', { method: 'POST', body: data }),
    openSession:    (id)        => apiFetch(`/sessions/${id}/open`, { method: 'POST' }),
    closeSession:   (id)        => apiFetch(`/sessions/${id}/close`, { method: 'POST' }),
    getQRPayload:   (id)        => apiFetch(`/sessions/${id}/qr`),
    getAttendances: (id)        => apiFetch(`/sessions/${id}/attendances`),

    // Attendance
    scan:           (payload)   => apiFetch('/attendance/scan', { method: 'POST', body: { payload } }),
    myAttendances:  ()          => apiFetch('/attendance/my'),
};

// ── Formatters ─────────────────────────────────────────────
function formatTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d} ${months[parseInt(m)]} ${y}`;
}
