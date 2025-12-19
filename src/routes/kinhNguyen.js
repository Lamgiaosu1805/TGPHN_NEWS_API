const express = require('express');
const KinhNguyenController = require('../controllers/KinhNguyenController');
const router = express.Router()

router.get('/', KinhNguyenController.getDSKinhNguyen);

module.exports = router;