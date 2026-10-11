const db = require('../config/database');

function registrarAtividade({ demanda_id, usuario_id, tipo, descricao }) {
    try {
        db.prepare(`
      INSERT INTO atividades (demanda_id, usuario_id, tipo, descricao)
      VALUES (?, ?, ?, ?)
    `).run(demanda_id || null, usuario_id, tipo, descricao || null);
    } catch (err) {
        console.error('❌ Erro ao registrar atividade:', err.message);
    }
}

module.exports = registrarAtividade;