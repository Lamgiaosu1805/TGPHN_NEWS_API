const express = require("express");
const NewsController = require("../controllers/NewsController");
const router = express.Router();

router.get("/", NewsController.getNewsList);

module.exports = router;
