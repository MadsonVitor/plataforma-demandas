const jwt = require('jsonwebtoken');
const db = require('../config/database');

function autenticar(req, res, next) {
    const token = req.cookies.token;
    console.log('=== [AUTH] ===');
    console.log('1. token presente?', !!token);
    console.log('2. cookies recebidos:', Object.keys(req.cookies));

    if (!token) return res.redirect('/login');

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log('3. payload:', payload);

        const u = db.prepare('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?').get(payload.id);
        console.log('4. usuário no banco:', u);

        if (!u || !u.ativo) {
            console.log('5. ❌ usuário não existe ou inativo — limpando cookie');
            res.clearCookie('token');
            return res.redirect('/login');
        }

        console.log('5. ✅ autenticado');
        req.usuario = u;
        res.locals.usuario = u;
        next();
    } catch (err) {
        console.log('❌ erro jwt:', err.message);
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