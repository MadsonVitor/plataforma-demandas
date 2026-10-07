const bcrypt = require('bcrypt');
const db = require('../config/database');

// Listar usuários
function listar(req, res) {
    const usuarios = db.prepare(`
    SELECT id, nome, email, perfil, ativo, criado_em
    FROM usuarios
    ORDER BY ativo DESC, nome
  `).all();

    res.render('usuarios/lista', {
        usuario: req.usuario,
        usuarios,
        erro: req.query.erro || null,
        sucesso: req.query.sucesso || null,
    });
}

// Formulário de novo usuário
function formNovo(req, res) {
    res.render('usuarios/novo', {
        usuario: req.usuario,
        erro: null,
    });
}

// Criar usuário
function criar(req, res) {
    const { nome, email, senha, perfil } = req.body;

    try {
        if (!nome || !email || !senha) {
            throw new Error('Preencha todos os campos');
        }
        if (!['supervisor', 'funcionario'].includes(perfil)) {
            throw new Error('Perfil inválido');
        }
        if (senha.length < 6) {
            throw new Error('Senha precisa ter ao menos 6 caracteres');
        }

        const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
        if (existente) {
            throw new Error('Já existe um usuário com esse e-mail');
        }

        const hash = bcrypt.hashSync(senha, 10);

        db.prepare(`
      INSERT INTO usuarios (nome, email, senha, perfil)
      VALUES (?, ?, ?, ?)
    `).run(nome.trim(), email.trim().toLowerCase(), hash, perfil);

        res.redirect('/usuarios?sucesso=' + encodeURIComponent('Usuário criado com sucesso'));
    } catch (err) {
        res.render('usuarios/novo', {
            usuario: req.usuario,
            erro: err.message,
        });
    }
}

// Ativar/desativar
function alternarAtivo(req, res) {
    const id = req.params.id;

    if (Number(id) === req.usuario.id) {
        return res.redirect('/usuarios?erro=' + encodeURIComponent('Você não pode desativar a si mesmo'));
    }

    const u = db.prepare('SELECT ativo FROM usuarios WHERE id = ?').get(id);
    if (!u) return res.status(404).send('Usuário não encontrado');

    db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(u.ativo ? 0 : 1, id);

    res.redirect('/usuarios?sucesso=' + encodeURIComponent('Status atualizado'));
}

// Formulário de troca de senha
function formSenha(req, res) {
    res.render('usuarios/senha', {
        usuario: req.usuario,
        erro: null,
        sucesso: null,
    });
}

// Trocar a própria senha
function trocarSenha(req, res) {
    const { senha_atual, senha_nova, senha_confirma } = req.body;

    try {
        const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);

        if (!bcrypt.compareSync(senha_atual, u.senha)) {
            throw new Error('Senha atual incorreta');
        }
        if (senha_nova.length < 6) {
            throw new Error('A nova senha precisa ter pelo menos 6 caracteres');
        }
        if (senha_nova !== senha_confirma) {
            throw new Error('As senhas não coincidem');
        }

        const hash = bcrypt.hashSync(senha_nova, 10);
        db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(hash, req.usuario.id);

        res.render('usuarios/senha', {
            usuario: req.usuario,
            erro: null,
            sucesso: 'Senha alterada com sucesso!',
        });
    } catch (err) {
        res.render('usuarios/senha', {
            usuario: req.usuario,
            erro: err.message,
            sucesso: null,
        });
    }
}

module.exports = { listar, formNovo, criar, alternarAtivo, formSenha, trocarSenha };