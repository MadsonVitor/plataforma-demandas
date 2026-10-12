require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Garante que a pasta uploads exista
const pastaUploads = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads, { recursive: true });
  console.log('📁 Pasta uploads criada');
}

const app = require('./app');
const initDb = require('./config/initDb');
const seed = require('./config/seed');

const PORT = process.env.PORT || 3000;

initDb();
seed();

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});