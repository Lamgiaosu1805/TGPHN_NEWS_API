const express = require('express');
const KinhNguyenController = require('../controllers/KinhNguyenController');
const router = express.Router()

router.get('/chiTietKinhNguyen/:contentId', KinhNguyenController.getChiTietKinhNguyen);
router.get('/DSKinhNguyen', KinhNguyenController.getDSKinh);
module.exports = router;