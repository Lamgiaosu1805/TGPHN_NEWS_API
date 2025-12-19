const { default: axios } = require("axios");
const cheerio = require('cheerio');

const KinhNguyenController = {
    getChiTietKinhNguyen: async (req, res) => {
        try {
            const { contentId } = req.params;
            const url = 'https://www.tonggiaophanhanoi.org/kinh-phung-vu-le-cac-thanh-tu-dao-viet-nam/';
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);
            const contentHtml = $("#" + contentId).html();

            if (!contentHtml) {
                return res.json({
                    success: false,
                    message: "Không tìm thấy nội dung",
                });
            }

            return res.json({
                success: true,
                data: contentHtml,
            });
        } catch (error) {
            console.error('Lỗi crawl:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
    getDSKinh: async (req, res) => {
        try {
            const url =
                "https://www.tonggiaophanhanoi.org/kinh-phung-vu-le-cac-thanh-tu-dao-viet-nam/";
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);

            const result = [];

            $(".elementor-toggle-item").each((_, item) => {
                // 🔥 LẤY CONTENT
                const contentDiv = $(item)
                    .find("div[id^='elementor-tab-content-']")
                    .first();

                const contentId = contentDiv.attr("id");

                // 🔥 LẤY TITLE TƯƠNG ỨNG
                const title = $(item)
                    .find("a.elementor-toggle-title")
                    .first()
                    .text()
                    .trim();

                if (contentId && title) {
                    result.push({
                        contentId, // elementor-tab-content-2271
                        title,     // Kinh chiều I
                    });
                }
            });

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Lỗi crawl:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
module.exports = KinhNguyenController;