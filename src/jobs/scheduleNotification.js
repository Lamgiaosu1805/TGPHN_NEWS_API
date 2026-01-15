const cron = require("node-cron");
const axios = require("axios");

const PUSH_API = "http://localhost:6789/notification/push/all";

cron.schedule("0 */2 * * *", async () => {
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