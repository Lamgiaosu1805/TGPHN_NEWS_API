const { default: axios } = require("axios");
const cheerio = require('cheerio');

const KinhNguyenController = {
    getDSKinhNguyen: async (req, res) => {
        try {
            const url = 'https://www.tonggiaophanhanoi.org/kinh-phung-vu-le-cac-thanh-tu-dao-viet-nam/';
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);
            const contentHtml = $("#elementor-tab-content-2271").html();

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
    }
}
module.exports = KinhNguyenController;