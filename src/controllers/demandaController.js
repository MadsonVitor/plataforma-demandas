const db = require('../config/database');
const registrarAtividade = require('../utils/registrarAtividade');
const { agruparPorDia, horaDoItem } = require('../utils/agruparPorDia');

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

        registrarAtividade({
            demanda_id: result.lastInsertRowid,
            usuario_id: req.usuario.id,
            tipo: 'demanda_criada',
            descricao: `Demanda "${titulo.trim()}" criada`,
        });

        res.redirect('/demandas');
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

        res.redirect(`/demandas/${id}`);
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
};