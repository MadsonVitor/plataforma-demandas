const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const demandaRoutes = require('./routes/demandaRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificacaoRoutes = require('./routes/notificacaoRoutes');
const { autenticar } = require('./middlewares/auth');

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Anti-cache pra rotas dinâmicas (depois do static, antes das rotas)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/', authRoutes);

app.get('/', autenticar, (req, res) => res.redirect('/dashboard'));

app.use('/dashboard', dashboardRoutes);
app.use('/demandas', demandaRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/notificacoes', notificacaoRoutes);

module.exports = app;