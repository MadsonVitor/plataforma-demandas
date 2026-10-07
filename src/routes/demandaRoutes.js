const express = require('express');
const router = express.Router();
const demandaController = require('../controllers/demandaController');
const { autenticar, apenasSupervisor } = require('../middlewares/auth');

router.use(autenticar);

router.get('/', demandaController.listar);
router.get('/nova', apenasSupervisor, demandaController.formNova);
router.post('/nova', apenasSupervisor, demandaController.criar);

router.get('/:id', demandaController.detalhe);
router.get('/:id/editar', apenasSupervisor, demandaController.formEditar);
router.post('/:id/editar', apenasSupervisor, demandaController.atualizar);
router.post('/:id/excluir', apenasSupervisor, demandaController.excluir);
router.post('/:id/status', demandaController.atualizarStatus);
router.post('/:id/observacao', demandaController.adicionarObservacao);
router.post('/:id/responsavel', demandaController.atribuirResponsavel);

module.exports = router;