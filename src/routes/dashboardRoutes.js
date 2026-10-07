const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { autenticar } = require('../middlewares/auth');

router.use(autenticar);

router.get('/', dashboardController.index);

module.exports = router;