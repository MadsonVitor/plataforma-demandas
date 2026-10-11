const express = require('express');
const router = express.Router();
const demandaController = require('../controllers/demandaController');
const calendarioController = require('../controllers/calendarioController');
const anexoController = require('../controllers/anexoController');
const upload = require('../config/multer');
const { autenticar, apenasSupervisor } = require('../middlewares/auth');

router.use(autenticar);

// Calendário (antes de /:id pra não conflitar)
router.get('/calendario', calendarioController.index);

// Anexos
router.get('/anexo/:id/visualizar', anexoController.visualizar);
router.get('/anexo/:id/download', anexoController.download);
router.post('/anexo/:id/excluir', apenasSupervisor, anexoController.excluir);

// Demandas
router.get('/', demandaController.listar);
router.get('/nova', apenasSupervisor, demandaController.formNova);
router.post('/nova', apenasSupervisor, demandaController.criar);

router.get('/:id', demandaController.detalhe);
router.get('/:id/editar', apenasSupervisor, demandaController.formEditar);
router.post('/:id/editar', apenasSupervisor, demandaController.atualizar);
router.post('/:id/excluir', apenasSupervisor, demandaController.excluir);
router.post('/:id/status', demandaController.atualizarStatus);
router.post('/:id/observacao', upload.single('arquivo'), demandaController.adicionarObservacao);
router.post('/:id/responsavel', apenasSupervisor, demandaController.atribuirResponsavel);

module.exports = router;