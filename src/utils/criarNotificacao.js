const db = require('../config/database');

// Cria notificação pra um usuário
// Ignora se o destinatário for o próprio autor da ação
function criarNotificacao({ usuario_id, demanda_id, tipo, mensagem, autor_id }) {
  // Não notifica a si mesmo
  if (autor_id && Number(usuario_id) === Number(autor_id)) {
    return;
  }

  try {
    db.prepare(`
      INSERT INTO notificacoes (usuario_id, demanda_id, tipo, mensagem)
      VALUES (?, ?, ?, ?)
    `).run(usuario_id, demanda_id || null, tipo, mensagem);
  } catch (err) {
    console.error('❌ Erro ao criar notificação:', err.message);
  }
}

// Cria notificação pra vários usuários de uma vez
function criarNotificacaoMultiplos(usuarioIds, { demanda_id, tipo, mensagem, autor_id }) {
  const ids = [...new Set(usuarioIds)].filter(Boolean);
  ids.forEach(uid => {
    criarNotificacao({ usuario_id: uid, demanda_id, tipo, mensagem, autor_id });
  });
}

module.exports = { criarNotificacao, criarNotificacaoMultiplos };