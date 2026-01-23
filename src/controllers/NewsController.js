const News = require("../models/NewsSchema");

const NewsController = {
    /**
     * GET /api/news
     * Query:
     *  - page (default: 1)
     *  - limit (default: 20)
     *  - category (optional)
     */
    getNewsList: async (req, res) => {
        try {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limit = Math.min(parseInt(req.query.limit) || 30, 50);
            const skip = (page - 1) * limit;

            const { category } = req.query;

            // Điều kiện lọc
            const filter = {
                isActive: true,
            };

            if (category) {
                filter.category = category;
            }

            // Query DB
            const [posts, total] = await Promise.all([
                News.find(filter)
                    .sort({ lastPublishedAt: -1 }) // 🔥 QUAN TRỌNG
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                News.countDocuments(filter),
            ]);

            return res.status(200).json({
                success: true,
                message: "Lấy danh sách tin tức thành công",
                data: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    posts,
                },
            });
        } catch (error) {
            console.error("Lỗi getNewsList:", error);
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi lấy danh sách tin tức",
                error: error.message,
            });
        }
    },
};

module.exports = NewsController;
