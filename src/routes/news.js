const express = require("express");
const NewsController = require("../controllers/NewsController");
const router = express.Router();

router.get("/", NewsController.getNewsList);
router.get("/get-featured-news", NewsController.getFeaturedNews);
router.post("/summarize-post", NewsController.summarizePost);

module.exports = router;
