const express = require("express");
const CheckVersionController = require("../controllers/CheckVersionController");
const router = express.Router();

router.get("/getVersion", CheckVersionController.getCurrentVersionApp);

module.exports = router;
