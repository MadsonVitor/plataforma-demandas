const db = require('./database');

function initDb() {
  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('supervisor', 'funcionario')),
      ativo INTEGER DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const colunasUsuarios = db.prepare("PRAGMA table_info(usuarios)").all();
  if (!colunasUsuarios.some(c => c.name === 'ativo')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN ativo INTEGER DEFAULT 1');
    console.log('🔧 Coluna "ativo" adicionada em usuarios');
  }

  // Tabela de clientes
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      contato TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de demandas
  db.exec(`
    CREATE TABLE IF NOT EXISTS demandas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      prioridade TEXT NOT NULL DEFAULT 'media' CHECK(prioridade IN ('baixa','media','alta')),
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','em_andamento','concluido')),
      prazo DATE,
      responsavel_id INTEGER,
      criado_por INTEGER NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
      FOREIGN KEY (criado_por) REFERENCES usuarios(id)
    );
  `);

  const colunasDemandas = db.prepare("PRAGMA table_info(demandas)").all();
  if (!colunasDemandas.some(c => c.name === 'prazo')) {
    db.exec('ALTER TABLE demandas ADD COLUMN prazo DATE');
    console.log('🔧 Coluna "prazo" adicionada em demandas');
  }

  // Tabela de observações
  db.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demanda_id INTEGER NOT NULL,
      autor_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demanda_id) REFERENCES demandas(id) ON DELETE CASCADE,
      FOREIGN KEY (autor_id) REFERENCES usuarios(id)
    );
  `);

  // Tabela de atividades (histórico)
  db.exec(`
    CREATE TABLE IF NOT EXISTS atividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demanda_id INTEGER,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demanda_id) REFERENCES demandas(id) ON DELETE SET NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  // Tabela de anexos
  db.exec(`
    CREATE TABLE IF NOT EXISTS anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demanda_id INTEGER NOT NULL,
      nome_original TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      tamanho INTEGER NOT NULL,
      tipo TEXT,
      enviado_por INTEGER NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (demanda_id) REFERENCES demandas(id) ON DELETE CASCADE,
      FOREIGN KEY (enviado_por) REFERENCES usuarios(id)
    );
  `);

  // Tabela de notificações
  db.exec(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      demanda_id INTEGER,
      tipo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      lida INTEGER DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (demanda_id) REFERENCES demandas(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ Tabelas verificadas/criadas com sucesso');
}

module.exports = initDb;