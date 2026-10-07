const db = require('../config/database');

// Lista todas as demandas com dados do cliente e responsável
function listar(req, res) {
    const { status = 'todas', busca = '', prioridade = '', responsavel = '', ordem = 'recentes' } = req.query;

    // Monta WHERE dinamicamente
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

    // Ordenação
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

    // Contadores dos cards (respeitando busca/prioridade/responsável, mas ignorando status)
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

    // Lista de funcionários pro filtro
    const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' AND ativo = 1 ORDER BY nome").all();

    // Monta a query string pra preservar filtros nos links
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

// Formulário de nova demanda
function formNova(req, res) {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
    const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' ORDER BY nome").all();

    res.render('demandas/nova', {
        usuario: req.usuario,
        clientes,
        funcionarios,
        erro: null,
    });
}

// Criar demanda
function criar(req, res) {
    const { cliente_id, titulo, descricao, prioridade, responsavel_id, novo_cliente } = req.body;

    try {
        let clienteId = cliente_id;

        // Se veio "novo_cliente" preenchido, cria o cliente primeiro
        if (novo_cliente && novo_cliente.trim()) {
            const result = db.prepare('INSERT INTO clientes (nome) VALUES (?)').run(novo_cliente.trim());
            clienteId = result.lastInsertRowid;
        }

        if (!clienteId) throw new Error('Selecione ou informe um cliente');
        if (!titulo || !titulo.trim()) throw new Error('Informe o título da demanda');

        db.prepare(`
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

        res.redirect('/demandas');
    } catch (err) {
        console.error(err);
        const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
        const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' ORDER BY nome").all();
        res.render('demandas/nova', {
            usuario: req.usuario,
            clientes,
            funcionarios,
            erro: err.message,
        });
    }
}

// Detalhe de uma demanda
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

    const funcionarios = db.prepare("SELECT id, nome FROM usuarios WHERE perfil = 'funcionario' ORDER BY nome").all();

    res.render('demandas/detalhe', {
        usuario: req.usuario,
        demanda,
        observacoes,
        funcionarios,
    });
}

// Atualizar status
function atualizarStatus(req, res) {
    const id = req.params.id;
    const { status } = req.body;

    const statusValidos = ['pendente', 'em_andamento', 'concluido'];
    if (!statusValidos.includes(status)) {
        return res.status(400).send('Status inválido');
    }

    db.prepare(`
    UPDATE demandas 
    SET status = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);

    res.redirect(`/demandas/${id}`);
}

// Adicionar observação
function adicionarObservacao(req, res) {
    const id = req.params.id;
    const { texto } = req.body;

    if (!texto || !texto.trim()) {
        return res.redirect(`/demandas/${id}`);
    }

    db.prepare(`
    INSERT INTO observacoes (demanda_id, autor_id, texto)
    VALUES (?, ?, ?)
  `).run(id, req.usuario.id, texto.trim());

    res.redirect(`/demandas/${id}`);
}

// Atribuir responsável
function atribuirResponsavel(req, res) {
    const id = req.params.id;
    const { responsavel_id } = req.body;

    db.prepare(`
    UPDATE demandas 
    SET responsavel_id = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(responsavel_id || null, id);

    res.redirect(`/demandas/${id}`);
}
// Formulário de edição
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

// Salvar edição
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

// Excluir demanda
function excluir(req, res) {
    const id = req.params.id;

    const demanda = db.prepare('SELECT id FROM demandas WHERE id = ?').get(id);
    if (!demanda) return res.status(404).send('Demanda não encontrada');

    // Observações caem junto por causa do ON DELETE CASCADE
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