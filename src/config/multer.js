const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const pastaUploads = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pastaUploads);
    },
    filename: (req, file, cb) => {
        const hash = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        const nomeSeguro = `${Date.now()}-${hash}${ext}`;
        cb(null, nomeSeguro);
    },
});

const tiposPermitidos = [
    // Imagens
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    // Vídeos
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    // Documentos
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Texto e compactados
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
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
        fileSize: 200 * 1024 * 1024, // 200 MB (pra caber vídeos)
    },
});

module.exports = upload;