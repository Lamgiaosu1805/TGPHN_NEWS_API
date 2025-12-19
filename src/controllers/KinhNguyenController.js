const { default: axios } = require("axios");
const cheerio = require('cheerio');

const checkType = (type) => {
    switch (type) {
        case "1":
            return {
                url: 'https://www.tonggiaophanhanoi.org/phan-thu-nhat-cac-kinh-doc-sang-toi-ngay-thuong-va-chua-nhat/',
                idPrefix: '.elementor-element-44cf93ac'
            };
        case "2":
            return {
                url: 'https://www.tonggiaophanhanoi.org/phan-thu-hai-cac-kinh-cau/',
                idPrefix: '.elementor-element-5c0f1a5a'
            };
        case "3":
            return {
                url: 'https://www.tonggiaophanhanoi.org/phan-thu-ba-ngam-cac-phep-lan-hat/',
                idPrefix: '.elementor-element-138a1027'
            };
        case "4":
            return {
                url: 'https://www.tonggiaophanhanoi.org/phan-thu-tu-kinh-dang-le-nhung-kinh-don-minh-chiu-le-va-nhung-kinh-cam-on/',
                idPrefix: '.elementor-element-7c7eb5c6'
            };
        case "5":
            return {
                url: 'https://www.tonggiaophanhanoi.org/phan-thu-nam-kinh-ngam-dang-thanh-gia-va-it-nhieu-kinh-khac/',
                idPrefix: '.elementor-element-2ba8d6e8'
            };

        default:
            return null;
    }
}

const KinhNguyenController = {
    getChiTietKinhNguyen: async (req, res) => {
        try {
            const { contentId } = req.params;
            const { type } = req.query;
            let url;
            let id;
            if (!type) {
                url = 'https://www.tonggiaophanhanoi.org/kinh-phung-vu-le-cac-thanh-tu-dao-viet-nam/';
                id = "#" + contentId
            }
            else {
                url = checkType(type)?.url;
                id = checkType(type)?.idPrefix;
            }
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);
            const contentHtml = $(id).html();

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
    },
}
module.exports = KinhNguyenController;