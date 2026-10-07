const bcrypt = require('bcrypt');
const db = require('./database');

function seed() {
    const email = 'admin@admin.com';
    const existente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (existente) {
        console.log('👤 Supervisor já existe, pulando seed.');
        return;
    }

    const senhaHash = bcrypt.hashSync('admin123', 10);

    db.prepare(`
    INSERT INTO usuarios (nome, email, senha, perfil)
    VALUES (?, ?, ?, ?)
  `).run('Supervisor Admin', email, senhaHash, 'supervisor');

    console.log('👤 Supervisor criado: admin@admin.com / admin123');
}

module.exports = seed;