const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Onde os arquivos vão ficar
const pastaUploads = path.join(__dirname, '..', '..', 'uploads');

// Configuração do armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pastaUploads);
    },
    filename: (req, file, cb) => {
        // Gera nome único pra evitar sobrescrever
        const hash = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        const nomeSeguro = `${Date.now()}-${hash}${ext}`;
        cb(null, nomeSeguro);
    },
});

// Filtro: só aceita alguns tipos
const tiposPermitidos = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
];

const fileFilter = (req, file, cb) => {
    if (tiposPermitidos.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
    },
});
function adicionarObservacao(req, res) {
    const id = req.params.id;
    console.log('=== [OBS] ===');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    const body = req.body || {};
    const texto = body.texto;
    // ... resto igual
}

module.exports = upload;