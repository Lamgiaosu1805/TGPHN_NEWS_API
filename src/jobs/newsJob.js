const cron = require("node-cron");
const NewsJobService = require("../services/NewsJobService");

class NewsJob {
    constructor() {
        this.isRunning = false;
        this.job = null;
    }

    // Khởi động job
    start() {
        console.log("🚀 Khởi động job quét tin tức...");

        // Chạy job mỗi 5 phút (giây thứ 0 của mỗi 5 phút)
        this.job = cron.schedule(
            "0 */5 * * * *",
            async () => {
                await this.execute();
            },
            {
                scheduled: true,
                timezone: "Asia/Ho_Chi_Minh",
            },
        );

        // Chạy ngay lần đầu
        this.execute();

        console.log("✅ Job đã được lên lịch (chạy mỗi phút)");
    }

    // Dừng job
    stop() {
        if (this.job) {
            this.job.stop();
            console.log("🛑 Job đã dừng");
        }
    }

    // Thực thi job
    async execute() {
        if (this.isRunning) {
            console.log("⏳ Job đang chạy, bỏ qua...");
            return;
        }

        try {
            this.isRunning = true;
            console.log(
                `\n⏰ [${new Date().toLocaleString("vi-VN")}] Bắt đầu quét tin tức...`,
            );

            await NewsJobService.runJob();
        } catch (error) {
            console.error("❌ Lỗi khi chạy job:", error);
        } finally {
            this.isRunning = false;
            console.log(
                `✅ [${new Date().toLocaleString("vi-VN")}] Hoàn thành quét\n`,
            );
        }
    }

    // Chạy job ngay lập tức (dùng cho testing)
    async runNow() {
        return await this.execute();
    }
}

module.exports = new NewsJob();
