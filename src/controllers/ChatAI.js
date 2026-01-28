const { GoogleGenerativeAI } = require("@google/generative-ai");
const { convert } = require('html-to-text');
const Prayer = require('../models/PrayerSchema');
const redisClient = require('../config/redis');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

const ChatAIController = {
    CACHE_TTL: 86400,

    // --- 1. ĐỊNH NGHĨA CÔNG CỤ ---
    tools: [{
        functionDeclarations: [{
            name: "find_prayer_in_db",
            description: "Tra cứu nội dung kinh nguyện hoặc nghi thức trong database.",
            parameters: {
                type: "OBJECT",
                properties: {
                    keyword: { type: "STRING", description: "Tên kinh chính xác (vd: Sáng Danh, Lạy Cha, Tin Kính)" },
                },
                required: ["keyword"],
            },
        }]
    }],

    // --- 2. HÀM NÉN DỮ LIỆU ---
    formatContent: (html) => {
        if (!html) return "";
        return convert(html, {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
            ]
        }).replace(/\n\s*\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    },

    // --- 3. LOGIC XỬ LÝ CHÍNH ---
    handleChat: async (req, res) => {
        try {
            const { message, history = [] } = req.body;
            if (!message) return res.status(400).json({ success: false, message: "Thiếu nội dung" });

            const userQuery = message.trim().toLowerCase();
            const cacheKey = `tgp_chat:${userQuery}`;

            // Check Redis Cache
            const cachedReply = await redisClient.get(cacheKey);
            if (cachedReply) return res.json({ success: true, reply: JSON.parse(cachedReply), fromCache: true });

            const model = genAI.getGenerativeModel({
                // Đổi sang 1.5-flash để tránh lỗi cạn kiệt quota 20 lượt của bản 2.5
                model: "gemini-1.5-flash",
                tools: ChatAIController.tools,
                systemInstruction: `Con là "Trợ lý AI TGP Hà Nội".
                QUY TẮC PHẢN HỒI:
                1. TUYỆT ĐỐI KHÔNG chào hỏi, không giới thiệu dẫn dắt (vd: Không nói "Thưa Quý ông bà", "Con xin gửi").
                2. VÀO THẲNG NỘI DUNG: Hiển thị ngay tiêu đề và nội dung bài kinh người dùng yêu cầu.
                3. XỬ LÝ KINH DÀI:
                   - Nếu bài kinh ngắn: Hiển thị toàn văn trang trọng.
                   - Nếu bài kinh quá dài (như các kinh ngắm, nghi thức): Chỉ trích đoạn đầu (khoảng 300-500 chữ), sau đó kết thúc bằng: "*(Kinh còn dài, Quý ông bà/anh chị vui lòng xem toàn văn tại mục [Kinh Nguyện] trong ứng dụng)*".
                4. Xưng hô: Nếu bắt buộc phải giải thích, dùng "Con" và "Quý ông bà/anh chị".
                5. Chỉ trả lời các vấn đề liên quan đến Công giáo.`
            });

            const chat = model.startChat({ history: history });
            let result = await chat.sendMessage(message);
            let response = result.response;

            const call = response.functionCalls()?.[0];

            if (call && call.name === "find_prayer_in_db") {
                const { keyword } = call.args;

                const data = await Prayer.findOne(
                    {
                        $or: [
                            { title: { $regex: keyword, $options: 'i' } },
                            { html: { $regex: keyword, $options: 'i' } }
                        ]
                    },
                    { title: 1, html: 1 }
                );

                if (data) {
                    let fullContent = ChatAIController.formatContent(data.html);

                    // Gửi một phần dữ liệu cho AI để tiết kiệm token và tránh quá tải hiển thị
                    let isTooLong = fullContent.length > 2500;
                    let processedContent = isTooLong ? fullContent.substring(0, 2500) : fullContent;

                    const finalResult = await chat.sendMessage([{
                        functionResponse: {
                            name: "find_prayer_in_db",
                            response: {
                                title: data.title,
                                content: processedContent,
                                isDataTruncated: isTooLong, // Báo hiệu cho AI biết là dữ liệu gốc còn dài
                                searchKeyword: keyword
                            }
                        }
                    }]);

                    const replyText = finalResult.response.text();
                    await redisClient.setEx(cacheKey, ChatAIController.CACHE_TTL, JSON.stringify(replyText));

                    return res.json({ success: true, reply: replyText });
                } else {
                    const failReply = "Dạ, con không tìm thấy bài kinh này trong hệ thống. Quý ông bà/anh chị có thể kiểm tra lại tên bài kinh ạ.";
                    return res.json({ success: true, reply: failReply });
                }
            }

            res.json({ success: true, reply: response.text() });

        } catch (error) {
            console.error('Lỗi Chat AI:', error.message);

            // Bắt lỗi vượt quá giới hạn (Quota Exceeded)
            if (error.message.includes('429')) {
                return res.status(200).json({
                    success: true,
                    reply: "Dạ, hiện tại số lượt yêu cầu AI đang quá tải (vượt định mức miễn phí). Quý ông bà/anh chị vui lòng thử lại sau giây lát hoặc tra cứu trực tiếp trong mục Kinh Nguyện ạ."
                });
            }

            res.status(500).json({
                success: false,
                reply: "Dạ, hệ thống đang gặp gián đoạn kỹ thuật, xin lỗi Quý vị về sự bất tiện này."
            });
        }
    }
};

module.exports = ChatAIController;