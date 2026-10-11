const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const registrarAtividade = require('../utils/registrarAtividade');


const pastaUploads = path.join(__dirname, '..', '..', 'uploads');

// Upload de anexo
function upload(req, res) {
    const demandaId = req.params.id;

    if (!req.file) {
        return res.redirect(`/demandas/${demandaId}?erro=` + encodeURIComponent('Nenhum arquivo enviado'));
    }

    const demanda = db.prepare('SELECT id FROM demandas WHERE id = ?').get(demandaId);
    if (!demanda) {
        // Remove o arquivo que foi salvo
        fs.unlinkSync(req.file.path);
        return res.status(404).send('Demanda não encontrada');
    }

    db.prepare(`
    INSERT INTO anexos (demanda_id, nome_original, nome_arquivo, tamanho, tipo, enviado_por)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
        demandaId,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        req.usuario.id
    );

    registrarAtividade({
        demanda_id: demandaId,
        usuario_id: req.usuario.id,
        tipo: 'anexo_adicionado',
        descricao: `Anexo adicionado: ${req.file.originalname}`,
    });

    res.redirect(`/demandas/${demandaId}`);
}

// Download de anexo
function download(req, res) {
    const id = req.params.id;

    const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(id);
    if (!anexo) return res.status(404).send('Anexo não encontrado');

    const caminho = path.join(pastaUploads, anexo.nome_arquivo);

    if (!fs.existsSync(caminho)) {
        return res.status(404).send('Arquivo não encontrado no servidor');
    }

    res.download(caminho, anexo.nome_original);
}

// Excluir anexo (só supervisor)
function excluir(req, res) {
    const id = req.params.id;

    const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(id);
    if (!anexo) return res.status(404).send('Anexo não encontrado');

    // Remove o arquivo físico
    const caminho = path.join(pastaUploads, anexo.nome_arquivo);
    if (fs.existsSync(caminho)) {
        try {
            fs.unlinkSync(caminho);
        } catch (e) {
            console.error('Erro ao remover arquivo:', e.message);
        }
    }

    // Registra no histórico antes de apagar
    registrarAtividade({
        demanda_id: anexo.demanda_id,
        usuario_id: req.usuario.id,
        tipo: 'anexo_removido',
        descricao: `Anexo removido: ${anexo.nome_original}`,
    });

    db.prepare('DELETE FROM anexos WHERE id = ?').run(id);

    res.redirect(`/demandas/${anexo.demanda_id}`);
}
// Visualizar anexo (imagem, PDF, vídeo) direto no navegador
function visualizar(req, res) {
    const id = req.params.id;

    const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(id);
    if (!anexo) return res.status(404).send('Anexo não encontrado');

    const caminho = path.join(pastaUploads, anexo.nome_arquivo);

    if (!fs.existsSync(caminho)) {
        return res.status(404).send('Arquivo não encontrado no servidor');
    }

    // Define o Content-Type correto pra o navegador exibir
    const tiposVisualizaveis = {
        'image/jpeg': 'image/jpeg',
        'image/png': 'image/png',
        'image/gif': 'image/gif',
        'image/webp': 'image/webp',
        'application/pdf': 'application/pdf',
        'video/mp4': 'video/mp4',
        'video/webm': 'video/webm',
        'text/plain': 'text/plain; charset=utf-8',
    };

    const contentType = tiposVisualizaveis[anexo.tipo];
    if (!contentType) {
        // Não é visualizável → força download
        return res.download(caminho, anexo.nome_original);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(anexo.nome_original)}"`);
    res.sendFile(caminho);
}
module.exports = { upload, download, visualizar, excluir };