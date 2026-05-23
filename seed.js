const bcrypt = require('bcryptjs');
const { getDB } = require('./config/database'); // Ajustado a tu línea 8 de users.js

const db = getDB();

// Aquí creamos tu usuario administradora con tu cédula
const cedulaAdmin = '31698570'; // Tu cédula de la foto
const nombreAdmin = 'Anyelina Gonzalez';
const contrasenaPlana = 'admin123'; // Cambia esta clave por la que tú quieras
const rolAdmin = 'admin';
const emailAdmin = 'anyelina@uptaapc.edu.ve'; // Tu proyecto pide un email en la línea 16

try {
    // Encriptamos la contraseña para que el sistema la reconozca de forma segura
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(contrasenaPlana, salt);

    // Insertamos directamente en tu tabla de usuarios
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO usuarios (cedula, name, email, password, role) 
        VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(cedulaAdmin, nombreAdmin, emailAdmin, hash, rolAdmin);
    console.error('¡Usuario administrador creado con éxito en SQLite!');
} catch (error) {
    console.error('Error al sembrar el administrador:', error.message);
}
