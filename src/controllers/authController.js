const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

function mostrarLogin(req, res) {
    res.render('login', { erro: null });
}

function login(req, res) {
    const { email, senha } = req.body;

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (!usuario) {
        return res.render('login', { erro: 'E-mail ou senha inválidos' });
    }

    const senhaOk = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaOk) {
        return res.render('login', { erro: 'E-mail ou senha inválidos' });
    }

    const token = jwt.sign(
        { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production', // 👈 seguro só em produção
        maxAge: 8 * 60 * 60 * 1000,
    });

    return res.redirect('/dashboard');
}

function logout(req, res) {
    res.clearCookie('token');
    res.redirect('/login');
}

module.exports = { mostrarLogin, login, logout };