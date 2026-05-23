const bcrypt = require('bcryptjs');
const { getDB } = require('./config/database'); 

// Conectamos a la base de datos activa
const db = getDB();

const miCedula = '31698570'; 
const miNombre = 'Anyelina Gonzalez';
const miClavePlana = 'admin123'; 
const miEmail = 'anyelinahg8@gmail.com'; 
const miRol = 'admin';

try {
    // Encriptamos la contraseña con bcryptjs
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(miClavePlana, salt);

    // Insertamos en la tabla 'users' con los campos exactos de tu sistema
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO users (name, email, password, role, studentCode) 
        VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(miNombre, miEmail, hash, miRol, miCedula);
    console.log('¡Usuario administrador sembrado con éxito en la tabla users!');
} catch (error) {
    console.error('Error en el sembrador:', error.message);
}
