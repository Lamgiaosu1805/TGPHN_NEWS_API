const express = require("express");
const NewsController = require("../controllers/NewsController");
const router = express.Router();

router.get("/", NewsController.getNewsList);
router.get("/get-featured-news", NewsController.getFeaturedNews);

module.exports = router;
