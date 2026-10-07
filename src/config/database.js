const path = require('path');
const Database = require('better-sqlite3');

// O banco fica na raiz do projeto, arquivo "database.sqlite"
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new Database(dbPath);

// Ativa foreign keys (importante pra relacionamentos)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦 Banco de dados conectado em:', dbPath);

module.exports = db;