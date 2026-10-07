require('dotenv').config();
const app = require('./app');
const initDb = require('./config/initDb');
const seed = require('./config/seed');

const PORT = process.env.PORT || 3000;

// Inicializa banco (cria tabelas se não existirem)
initDb();
seed();

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});