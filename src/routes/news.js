const express = require("express");
const NewsController = require("../controllers/NewsController");
const ChatAIController = require("../controllers/ChatAI");
const router = express.Router();

router.get("/", NewsController.getNewsList);
router.get("/get-featured-news", NewsController.getFeaturedNews);
router.post("/summarize-post", NewsController.summarizePost);
router.post("/chat", ChatAIController.handleChat);

module.exports = router;
