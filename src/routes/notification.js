const express = require("express");
const NotificationController = require("../controllers/NotificationController");
const ipWhitelist = require("../middlewares/ipWhitelist");
const router = express.Router();

router.post("/register-push-device", NotificationController.registerPushDevice);
router.post("/push/tokens", ipWhitelist, NotificationController.pushToTokens);
router.post("/push/all", ipWhitelist, NotificationController.pushToAll);

router.get(
    "/get-global-notifications",
    NotificationController.getGlobalNotifications,
);

module.exports = router;
