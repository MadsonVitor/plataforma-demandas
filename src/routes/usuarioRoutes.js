const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { autenticar, apenasSupervisor } = require('../middlewares/auth');

router.use(autenticar);

// Trocar a própria senha (qualquer usuário logado)
router.get('/senha', usuarioController.formSenha);
router.post('/senha', usuarioController.trocarSenha);

// Gestão de usuários (só supervisor)
router.get('/', apenasSupervisor, usuarioController.listar);
router.get('/novo', apenasSupervisor, usuarioController.formNovo);
router.post('/novo', apenasSupervisor, usuarioController.criar);
router.post('/:id/ativo', apenasSupervisor, usuarioController.alternarAtivo);

module.exports = router;