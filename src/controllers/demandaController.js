const db = require('../config/database');
const registrarAtividade = require('../utils/registrarAtividade');
const { agruparPorDia, horaDoItem } = require('../utils/agruparPorDia');
const { criarNotificacao, criarNotificacaoMultiplos } = require('../utils/criarNotificacao');

function listar(req, res) {
  const { status = 'todas', busca = '', prioridade = '', responsavel = '', ordem = 'recentes' } = req.query;

  const where = [];
  const params = [];

  if (status !== 'todas') {
    where.push('d.status = ?');
    params.push(status);
  }
  if (busca.trim()) {
    where.push('(d.titulo LIKE ? OR c.nome LIKE ? OR d.descricao LIKE ?)');
    const termo = `%${busca.trim()}%`;
    params.push(termo, termo, termo);
  }
  if (prioridade) {
    where.push('d.prioridade = ?');
    params.push(prioridade);
  }
  if (responsavel) {
    where.push('d.responsavel_id = ?');
    params.push(responsavel);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  let orderSql = 'ORDER BY d.criado_em DESC';
  if (ordem === 'antigas') orderSql = 'ORDER BY d.criado_em ASC';
  if (ordem === 'prioridade') {
    orderSql = `ORDER BY CASE d.prioridade WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 END, d.criado_em DESC`;
  }

  const query = `
    SELECT d.*,
           c.nome AS cliente_nome,
           u.nome AS responsavel_nome,
           uc.nome AS criador_nome
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    JOIN usuarios uc ON uc.id = d.criado_por
    ${whereSql}
    ${orderSql}
  `;

  const demandas = db.prepare(query).all(...params);

  const grupos = agruparPorDia(demandas);
  grupos.forEach(g => {
    g.itens = g.itens.map(d => ({ ...d, hora: horaDoItem(d.criado_em) }));
  });

  const whereSemStatus = [];
  const paramsSemStatus = [];

  if (busca.trim()) {
    whereSemStatus.push('(d.titulo LIKE ? OR c.nome LIKE ? OR d.descricao LIKE ?)');
    const termo = `%${busca.trim()}%`;
    paramsSemStatus.push(termo, termo, termo);
  }
  if (prioridade) {
    whereSemStatus.push('d.prioridade = ?');
    paramsSemStatus.push(prioridade);
  }
  if (responsavel) {
    whereSemStatus.push('d.responsavel_id = ?');
    paramsSemStatus.push(responsavel);
  }

  const whereSemStatusSql = whereSemStatus.length ? 'WHERE ' + whereSemStatus.join(' AND ') : '';

  const stats = {
    pendente: db.prepare(`
      SELECT COUNT(*) AS total FROM demandas d
      JOIN clientes c ON c.id = d.cliente_id
      ${whereSemStatusSql ? whereSemStatusSql + ' AND' : 'WHERE'} d.status = 'pendente'
    `).get(...paramsSemStatus).total,

    em_andamento: db.prepare(`
      SELECT COUNT(*) AS total FROM demandas d
      JOIN clientes c ON c.id = d.cliente_id
      ${whereSemStatusSql ? whereSemStatusSql + ' AND' : 'WHERE'} d.status = 'em_andamento'
    `).get(...paramsSemStatus).total,

    concluido: db.prepare(`
      SELECT COUNT(*) AS total FROM demandas d
      JOIN clientes c ON c.id = d.cliente_id
      ${whereSemStatusSql ? whereSemStatusSql + ' AND' : 'WHERE'} d.status = 'concluido'
    `).get(...paramsSemStatus).total,
  };

  const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();

  const querystring = (extra = {}) => {
    const q = { status, busca, prioridade, responsavel, ordem, ...extra };
    return Object.entries(q)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  };

  res.render('demandas/lista', {
    usuario: req.usuario,
    demandas,
    grupos,
    filtro: status,
    busca,
    prioridade,
    responsavel,
    ordem,
    stats,
    funcionarios,
    querystring,
  });
}

function formNova(req, res) {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
  const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();

  res.render('demandas/nova', {
    usuario: req.usuario,
    clientes,
    funcionarios,
    erro: null,
  });
}

function criar(req, res) {
  const { cliente_id, titulo, descricao, prioridade, responsavel_id, novo_cliente } = req.body;

  try {
    let clienteId = cliente_id;

    if (novo_cliente && novo_cliente.trim()) {
      const result = db.prepare('INSERT INTO clientes (nome) VALUES (?)').run(novo_cliente.trim());
      clienteId = result.lastInsertRowid;
    }

    if (!clienteId) throw new Error('Selecione ou informe um cliente');
    if (!titulo || !titulo.trim()) throw new Error('Informe o título da demanda');

    const result = db.prepare(`
      INSERT INTO demandas (cliente_id, titulo, descricao, prioridade, responsavel_id, criado_por, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente')
    `).run(
      clienteId,
      titulo.trim(),
      descricao || '',
      prioridade || 'media',
      responsavel_id || null,
      req.usuario.id
    );

    const demandaId = result.lastInsertRowid;

    registrarAtividade({
      demanda_id: demandaId,
      usuario_id: req.usuario.id,
      tipo: 'demanda_criada',
      descricao: `Demanda "${titulo.trim()}" criada`,
    });

    // Notifica responsável se foi atribuído
    if (responsavel_id) {
      criarNotificacao({
        usuario_id: responsavel_id,
        demanda_id: demandaId,
        tipo: 'demanda_atribuida',
        mensagem: `Supervisor te deixou responsável pela demanda "${titulo.trim()}"`,
        autor_id: req.usuario.id,
      });
    }

    // Notifica supervisores se for alta prioridade
    if (prioridade === 'alta') {
      const supervisores = db.prepare("SELECT id FROM usuarios WHERE perfil = 'supervisor' AND ativo = 1").all();
      criarNotificacaoMultiplos(supervisores.map(s => s.id), {
        demanda_id: demandaId,
        tipo: 'alta_prioridade',
        mensagem: `Nova demanda de alta prioridade: "${titulo.trim()}"`,
        autor_id: req.usuario.id,
      });
    }

    // Salva os anexos enviados na criação
    if (req.files && req.files.length > 0) {
      const insertAnexo = db.prepare(`
        INSERT INTO anexos (demanda_id, nome_original, nome_arquivo, tamanho, tipo, enviado_por)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      req.files.forEach(file => {
        insertAnexo.run(
          demandaId,
          file.originalname,
          file.filename,
          file.size,
          file.mimetype,
          req.usuario.id
        );

        registrarAtividade({
          demanda_id: demandaId,
          usuario_id: req.usuario.id,
          tipo: 'anexo_adicionado',
          descricao: `Anexo: ${file.originalname}`,
        });
      });
    }

    res.redirect('/demandas?sucesso=' + encodeURIComponent('Demanda criada com sucesso'));
  } catch (err) {
    console.error(err);
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
    const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();
    res.render('demandas/nova', {
      usuario: req.usuario,
      clientes,
      funcionarios,
      erro: err.message,
    });
  }
}

function detalhe(req, res) {
  const id = req.params.id;

  const demanda = db.prepare(`
    SELECT d.*, 
           c.nome AS cliente_nome,
           u.nome AS responsavel_nome,
           uc.nome AS criador_nome
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    JOIN usuarios uc ON uc.id = d.criado_por
    WHERE d.id = ?
  `).get(id);

  if (!demanda) return res.status(404).send('Demanda não encontrada');

  const observacoes = db.prepare(`
    SELECT o.*, u.nome AS autor_nome
    FROM observacoes o
    JOIN usuarios u ON u.id = o.autor_id
    WHERE o.demanda_id = ?
    ORDER BY o.criado_em DESC
  `).all(id);

  const historico = db.prepare(`
    SELECT a.*, u.nome AS usuario_nome
    FROM atividades a
    JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.demanda_id = ?
    ORDER BY a.criado_em DESC
  `).all(id);

  const anexos = db.prepare(`
    SELECT a.*, u.nome AS enviado_por_nome
    FROM anexos a
    JOIN usuarios u ON u.id = a.enviado_por
    WHERE a.demanda_id = ?
    ORDER BY a.criado_em DESC
  `).all(id);

  const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();

  res.render('demandas/detalhe', {
    usuario: req.usuario,
    demanda,
    observacoes,
    historico,
    anexos,
    funcionarios,
  });
}

function atualizarStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body;

  const statusValidos = ['pendente', 'em_andamento', 'concluido'];
  if (!statusValidos.includes(status)) {
    return res.status(400).send('Status inválido');
  }

  const anterior = db.prepare('SELECT status FROM demandas WHERE id = ?').get(id);

  db.prepare(`
    UPDATE demandas 
    SET status = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);

  registrarAtividade({
    demanda_id: id,
    usuario_id: req.usuario.id,
    tipo: 'status_alterado',
    descricao: `Status: "${anterior?.status || '?'}" para "${status}"`,
  });

  // Notifica responsável e criador
  const demandaInfo = db.prepare('SELECT responsavel_id, criado_por FROM demandas WHERE id = ?').get(id);
  const destinatarios = [demandaInfo?.responsavel_id, demandaInfo?.criado_por].filter(Boolean);

  criarNotificacaoMultiplos(destinatarios, {
    demanda_id: id,
    tipo: 'status_alterado',
    mensagem: `Demanda #${id} mudou para "${status.replace('_', ' ')}"`,
    autor_id: req.usuario.id,
  });

  res.redirect(`/demandas/${id}`);
}

function adicionarObservacao(req, res) {
  const id = req.params.id;
  const body = req.body || {};
  const texto = body.texto;

  const temTexto = texto && texto.trim();
  const temArquivo = !!req.file;

  if (!temTexto && !temArquivo) {
    return res.redirect(`/demandas/${id}`);
  }

  if (temTexto) {
    db.prepare(`
      INSERT INTO observacoes (demanda_id, autor_id, texto)
      VALUES (?, ?, ?)
    `).run(id, req.usuario.id, texto.trim());

    registrarAtividade({
      demanda_id: id,
      usuario_id: req.usuario.id,
      tipo: 'observacao_adicionada',
      descricao: 'Nova observação adicionada',
    });
  }

  if (temArquivo) {
    db.prepare(`
      INSERT INTO anexos (demanda_id, nome_original, nome_arquivo, tamanho, tipo, enviado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.file.originalname,
      req.file.filename,
      req.file.size,
      req.file.mimetype,
      req.usuario.id
    );

    registrarAtividade({
      demanda_id: id,
      usuario_id: req.usuario.id,
      tipo: 'anexo_adicionado',
      descricao: `Anexo: ${req.file.originalname}`,
    });
  }

  // Notifica responsável e criador
  const demandaInfo = db.prepare('SELECT responsavel_id, criado_por FROM demandas WHERE id = ?').get(id);
  const destinatarios = [demandaInfo?.responsavel_id, demandaInfo?.criado_por].filter(Boolean);

  criarNotificacaoMultiplos(destinatarios, {
    demanda_id: id,
    tipo: 'observacao_adicionada',
    mensagem: `Nova observação na demanda #${id}`,
    autor_id: req.usuario.id,
  });

  res.redirect(`/demandas/${id}`);
}

function atribuirResponsavel(req, res) {
  const id = req.params.id;
  const { responsavel_id } = req.body;

  db.prepare(`
    UPDATE demandas 
    SET responsavel_id = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(responsavel_id || null, id);

  const resp = responsavel_id
    ? db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(responsavel_id)
    : null;

  registrarAtividade({
    demanda_id: id,
    usuario_id: req.usuario.id,
    tipo: 'responsavel_atribuido',
    descricao: resp ? `Responsável definido: ${resp.nome}` : 'Responsável removido',
  });

  // Notifica o novo responsável
  if (responsavel_id) {
    criarNotificacao({
      usuario_id: responsavel_id,
      demanda_id: id,
      tipo: 'demanda_atribuida',
      mensagem: `Você foi designado responsável pela demanda #${id}`,
      autor_id: req.usuario.id,
    });
  }

  res.redirect(`/demandas/${id}`);
}

function formEditar(req, res) {
  const id = req.params.id;

  const demanda = db.prepare('SELECT * FROM demandas WHERE id = ?').get(id);
  if (!demanda) return res.status(404).send('Demanda não encontrada');

  const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
  const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();

  res.render('demandas/editar', {
    usuario: req.usuario,
    demanda,
    clientes,
    funcionarios,
    erro: null,
  });
}

function atualizar(req, res) {
  const id = req.params.id;
  const { cliente_id, titulo, descricao, prioridade, responsavel_id } = req.body;

  try {
    if (!cliente_id) throw new Error('Selecione um cliente');
    if (!titulo || !titulo.trim()) throw new Error('Informe o título');
    if (!['baixa', 'media', 'alta'].includes(prioridade)) throw new Error('Prioridade inválida');

    db.prepare(`
      UPDATE demandas
      SET cliente_id = ?, titulo = ?, descricao = ?, prioridade = ?,
          responsavel_id = ?, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      cliente_id,
      titulo.trim(),
      descricao || '',
      prioridade,
      responsavel_id || null,
      id
    );

    registrarAtividade({
      demanda_id: id,
      usuario_id: req.usuario.id,
      tipo: 'demanda_editada',
      descricao: 'Demanda editada',
    });

    res.redirect(`/demandas/${id}?sucesso=` + encodeURIComponent('Demanda atualizada'));
  } catch (err) {
    const demanda = db.prepare('SELECT * FROM demandas WHERE id = ?').get(id);
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
    const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();
    res.render('demandas/editar', {
      usuario: req.usuario,
      demanda,
      clientes,
      funcionarios,
      erro: err.message,
    });
  }
}

function excluir(req, res) {
  const id = req.params.id;

  const demanda = db.prepare('SELECT id FROM demandas WHERE id = ?').get(id);
  if (!demanda) return res.status(404).send('Demanda não encontrada');

  registrarAtividade({
    demanda_id: id,
    usuario_id: req.usuario.id,
    tipo: 'demanda_excluida',
    descricao: `Demanda #${id} excluída`,
  });

  db.prepare('DELETE FROM demandas WHERE id = ?').run(id);

  res.redirect('/demandas?sucesso=' + encodeURIComponent('Demanda excluída'));
}

function exportarCsv(req, res) {
  const { status = 'todas', busca = '', prioridade = '', responsavel = '', ordem = 'recentes' } = req.query;

  const where = [];
  const params = [];

  if (status !== 'todas') {
    where.push('d.status = ?');
    params.push(status);
  }
  if (busca.trim()) {
    where.push('(d.titulo LIKE ? OR c.nome LIKE ? OR d.descricao LIKE ?)');
    const termo = `%${busca.trim()}%`;
    params.push(termo, termo, termo);
  }
  if (prioridade) {
    where.push('d.prioridade = ?');
    params.push(prioridade);
  }
  if (responsavel) {
    where.push('d.responsavel_id = ?');
    params.push(responsavel);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  let orderSql = 'ORDER BY d.criado_em DESC';
  if (ordem === 'antigas') orderSql = 'ORDER BY d.criado_em ASC';
  if (ordem === 'prioridade') {
    orderSql = `ORDER BY CASE d.prioridade WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 END, d.criado_em DESC`;
  }

  const demandas = db.prepare(`
    SELECT d.id,
           c.nome AS cliente_nome,
           d.titulo,
           d.descricao,
           d.prioridade,
           d.status,
           u.nome AS responsavel_nome,
           uc.nome AS criador_nome,
           d.criado_em,
           d.atualizado_em
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    JOIN usuarios uc ON uc.id = d.criado_por
    ${whereSql}
    ${orderSql}
  `).all(...params);

  const cabecalho = ['ID', 'Cliente', 'Título', 'Descrição', 'Prioridade', 'Status', 'Responsável', 'Criado por', 'Criado em', 'Atualizado em'];

  const escapar = (valor) => {
    if (valor === null || valor === undefined) return '';
    const str = String(valor).replace(/"/g, '""');
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const linhas = [cabecalho.join(';')];

  demandas.forEach(d => {
    linhas.push([
      d.id,
      escapar(d.cliente_nome),
      escapar(d.titulo),
      escapar(d.descricao || ''),
      d.prioridade,
      d.status.replace('_', ' '),
      escapar(d.responsavel_nome || ''),
      escapar(d.criador_nome),
      d.criado_em,
      d.atualizado_em,
    ].join(';'));
  });

  const csv = '\uFEFF' + linhas.join('\r\n');

  const data = new Date().toISOString().split('T')[0];
  const nomeArquivo = `demandas-${data}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.send(csv);
}

module.exports = {
  listar,
  formNova,
  criar,
  detalhe,
  atualizarStatus,
  adicionarObservacao,
  atribuirResponsavel,
  formEditar,
  atualizar,
  excluir,
  exportarCsv,
};