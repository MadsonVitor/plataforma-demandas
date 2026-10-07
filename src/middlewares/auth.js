const jwt = require('jsonwebtoken');
const db = require('../config/database');

function autenticar(req, res, next) {
    const token = req.cookies.token;

    if (!token) return res.redirect('/login');

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Confere se o usuário ainda existe e está ativo
        const u = db.prepare('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?').get(payload.id);
        if (!u || !u.ativo) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        req.usuario = u;
        res.locals.usuario = u;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
}

function apenasSupervisor(req, res, next) {
    if (req.usuario?.perfil !== 'supervisor') {
        return res.status(403).send('Acesso negado: apenas supervisores.');
    }
    next();
}

module.exports = { autenticar, apenasSupervisor };