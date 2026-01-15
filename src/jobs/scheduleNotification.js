const cron = require("node-cron");
const axios = require("axios");

const PUSH_API = `http://localhost:${process.env.PORT || 3456}/notification/push/all`;

cron.schedule("*/30 * * * * *", async () => {
    try {
        await axios.post(
            PUSH_API,
            {
                title: "TGP Hà Nội",
                body: "Test Schedule Notification every 2 hour",
                data: {
                    type: "schedule",
                },
            }
        );

        console.log("✅ Push schedule sent");
    } catch (err) {
        console.error("❌ Push schedule failed", err.message);
    }
});