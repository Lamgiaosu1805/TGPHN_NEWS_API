const express = require('express');
const LMController = require('../controllers/LMController');
const router = express.Router()

router.get('/', LMController.getLM);

module.exports = router;