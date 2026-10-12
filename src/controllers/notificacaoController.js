const db = require('../config/database');

// Lista as últimas 10 notificações do usuário logado (JSON, pro sininho)
function listar(req, res) {
  const usuarioId = req.usuario.id;

  const notificacoes = db.prepare(`
    SELECT n.id, n.demanda_id, n.tipo, n.mensagem, n.lida, n.criado_em
    FROM notificacoes n
    WHERE n.usuario_id = ?
    ORDER BY n.criado_em DESC
    LIMIT 10
  `).all(usuarioId);

  const naoLidas = db.prepare(`
    SELECT COUNT(*) AS total FROM notificacoes
    WHERE usuario_id = ? AND lida = 0
  `).get(usuarioId).total;

  // Formata data em pt-BR
  const formatadas = notificacoes.map(n => {
    const iso = String(n.criado_em).replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    const dataBR = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const dia = String(dataBR.getUTCDate()).padStart(2, '0');
    const mes = String(dataBR.getUTCMonth() + 1).padStart(2, '0');
    const ano = dataBR.getUTCFullYear();
    const hora = String(dataBR.getUTCHours()).padStart(2, '0');
    const min = String(dataBR.getUTCMinutes()).padStart(2, '0');
    return {
      ...n,
      data_formatada: `${dia}/${mes}/${ano} às ${hora}:${min}`,
    };
  });

  res.json({ notificacoes: formatadas, nao_lidas: naoLidas });
}

// Marca uma notificação como lida
function marcarLida(req, res) {
  const id = req.params.id;

  db.prepare(`
    UPDATE notificacoes SET lida = 1
    WHERE id = ? AND usuario_id = ?
  `).run(id, req.usuario.id);

  res.json({ ok: true });
}

// Marca todas como lidas
function marcarTodasLidas(req, res) {
  db.prepare(`
    UPDATE notificacoes SET lida = 1
    WHERE usuario_id = ?
  `).run(req.usuario.id);

  res.json({ ok: true });
}

// Excluir (opcional)
function excluir(req, res) {
  db.prepare(`
    DELETE FROM notificacoes
    WHERE id = ? AND usuario_id = ?
  `).run(req.params.id, req.usuario.id);

  res.json({ ok: true });
}

module.exports = { listar, marcarLida, marcarTodasLidas, excluir };