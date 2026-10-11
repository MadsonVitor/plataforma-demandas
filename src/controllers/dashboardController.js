const db = require('../config/database');
const { agruparPorDia, horaDoItem } = require('../utils/agruparPorDia');
function index(req, res) {
  const usuario = req.usuario;

  // ====== Números gerais ======
  const totais = {
    total: db.prepare('SELECT COUNT(*) AS n FROM demandas').get().n,
    pendente: db.prepare("SELECT COUNT(*) AS n FROM demandas WHERE status = 'pendente'").get().n,
    em_andamento: db.prepare("SELECT COUNT(*) AS n FROM demandas WHERE status = 'em_andamento'").get().n,
    concluido: db.prepare("SELECT COUNT(*) AS n FROM demandas WHERE status = 'concluido'").get().n,
    alta_prioridade_pendente: db.prepare(`
      SELECT COUNT(*) AS n FROM demandas
      WHERE prioridade = 'alta' AND status != 'concluido'
    `).get().n,
    sem_responsavel: db.prepare(`
      SELECT COUNT(*) AS n FROM demandas
      WHERE responsavel_id IS NULL AND status != 'concluido'
    `).get().n,
  };

  // ====== Ranking de funcionários ======
  const funcionarios = db.prepare(`
    SELECT 
      u.id,
      u.nome,
      COUNT(d.id) AS total,
      SUM(CASE WHEN d.status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
      SUM(CASE WHEN d.status = 'em_andamento' THEN 1 ELSE 0 END) AS em_andamento,
      SUM(CASE WHEN d.status = 'concluido' THEN 1 ELSE 0 END) AS concluidas
    FROM usuarios u
    LEFT JOIN demandas d ON d.responsavel_id = u.id
    WHERE u.perfil = 'funcionario' AND u.ativo = 1
    GROUP BY u.id
    ORDER BY total DESC, u.nome
  `).all();

  // ====== Demandas paradas (sem atualização há mais de 3 dias) ======
  const paradas = db.prepare(`
    SELECT d.id, d.titulo, d.status, d.prioridade, d.atualizado_em,
           c.nome AS cliente_nome,
           u.nome AS responsavel_nome,
           CAST((julianday('now') - julianday(d.atualizado_em)) AS INTEGER) AS dias_parada
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    WHERE d.status != 'concluido'
      AND julianday('now') - julianday(d.atualizado_em) >= 3
    ORDER BY dias_parada DESC
    LIMIT 10
  `).all();

  // ====== Alta prioridade pendente/em andamento ======
  const urgentes = db.prepare(`
    SELECT d.id, d.titulo, d.status, d.criado_em,
           c.nome AS cliente_nome,
           u.nome AS responsavel_nome
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    WHERE d.prioridade = 'alta' AND d.status != 'concluido'
    ORDER BY d.criado_em ASC
    LIMIT 10
  `).all();

  // ====== Últimas demandas criadas ======
  const recentes = db.prepare(`
    SELECT d.id, d.titulo, d.status, d.prioridade, d.criado_em,
           c.nome AS cliente_nome,
           u.nome AS responsavel_nome
    FROM demandas d
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN usuarios u ON u.id = d.responsavel_id
    ORDER BY d.criado_em DESC
    LIMIT 8
  `).all();

  // Agrupa as recentes por dia
  const recentesGrupos = agruparPorDia(recentes);
  recentesGrupos.forEach(g => {
    g.itens = g.itens.map(d => ({ ...d, hora: horaDoItem(d.criado_em) }));
  });

  res.render('dashboard/index', {
    usuario,
    totais,
    funcionarios,
    paradas,
    urgentes,
    recentes,
    recentesGrupos,
  });
}

module.exports = { index };