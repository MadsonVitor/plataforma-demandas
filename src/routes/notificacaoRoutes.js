const express = require('express');
const router = express.Router();
const notificacaoController = require('../controllers/notificacaoController');
const { autenticar } = require('../middlewares/auth');

router.use(autenticar);

router.get('/', notificacaoController.listar);
router.post('/:id/lida', notificacaoController.marcarLida);
router.post('/lidas', notificacaoController.marcarTodasLidas);
router.delete('/:id', notificacaoController.excluir);

module.exports = router;