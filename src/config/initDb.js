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
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
      responsavel_id INTEGER,
      criado_por INTEGER NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
      FOREIGN KEY (criado_por) REFERENCES usuarios(id)
    );
  `);

    // Tabela de observações (histórico de cada demanda)
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

    console.log('✅ Tabelas verificadas/criadas com sucesso');
}

module.exports = initDb;