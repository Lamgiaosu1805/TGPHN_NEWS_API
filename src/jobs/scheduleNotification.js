const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment");
const LichCongGiao = require("../models/LichCongGiaoSchema");

const PUSH_API = `http://localhost:${process.env.PORT || 3456}/notification/push/all`;

cron.schedule("30 7 * * *", async () => {
    try {
        const today = moment().format("YYYY-MM-DD");

        console.log("📅 Checking date:", today);

        const data = await LichCongGiao.findOne({ date: today });

        if (!data) {
            console.log("⚠️ Không có dữ liệu hôm nay");
            return;
        }

        const bodyText = `${data.cau_loi_chua}. (${data.tin_mung})`;

        await axios.post(PUSH_API, {
            title: data.title,
            body: bodyText,
            data: {
                type: "mass-readings",
                date: today,
                screen: "Home",
                dateKey: today,
            },
        });

        console.log("✅ Đã gửi thông báo phụng vụ");
    } catch (err) {
        console.error("❌ Push failed:", err.message);
    }
});