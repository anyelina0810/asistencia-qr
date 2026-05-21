/**
 * config/database.js — Configuración y conexión SQLite
 */

'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH     = process.env.DB_PATH || path.join(__dirname, '../../database/attendance.db');
const SCHEMA_PATH = path.join(__dirname, '../../database/schema.sql');

let db;

/**
 * Inicializa la base de datos: crea el archivo y ejecuta el schema si es nuevo.
 */
async function initDB() {
    const isNew = !fs.existsSync(DB_PATH);

    // Asegurar que el directorio existe
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    if (isNew) {
        console.log('[DB] Creando base de datos y aplicando schema...');
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        db.exec(schema);
        console.log('[DB] ✓ Base de datos inicializada con datos de prueba.');
    } else {
        console.log('[DB] ✓ Base de datos cargada.');
    }
}

/**
 * Retorna la instancia de la base de datos.
 * @returns {Database}
 */
function getDB() {
    if (!db) throw new Error('La base de datos no ha sido inicializada.');
    return db;
}

module.exports = { initDB, getDB };
