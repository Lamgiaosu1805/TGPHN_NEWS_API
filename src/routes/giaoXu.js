const express = require('express');
const GXController = require('../controllers/GXController');
const router = express.Router()

router.get('/', GXController.getGX);

module.exports = router;