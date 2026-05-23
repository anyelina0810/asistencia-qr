const bcrypt = require('bcryptjs');
const { initDB } = require('./config/database'); // Ajustado a tu línea 14 de server.js

// Obtenemos la base de datos llamando a la función correcta de tu proyecto
const db = initDB();

// Tus datos de prueba como Administradora Suprema
const miCedula = '31698570'; 
const miNombre = 'Anyelina Gonzalez';
const miClavePlana = 'admin123'; // Esta será tu contraseña para entrar
const miEmail = 'anyelinahg8@gmail.com';
const miRol = 'admin';

try {
    // Encriptamos la contraseña con la librería de tu proyecto
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(miClavePlana, salt);

    // Insertamos directamente usando la estructura de campos que vimos en tu users.js
    // Usaremos la cédula en el campo studentCode para identificar tu usuario
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO users (name, email, password, role, studentCode) 
        VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(miNombre, miEmail, hash, miRol, miCedula);
    console.error('¡Anyelina ha sido registrada como Administradora con éxito!');
} catch (error) {
    console.error('Error en el sembrador:', error.message);
}
