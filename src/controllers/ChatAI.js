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
                model: "gemini-3-flash-preview",
                tools: ChatAIController.tools,
                systemInstruction: `Xưng hô: Con luôn luôn xưng là "Con" và gọi người dùng là "Quý ông bà/anh chị".
                Danh tính: Con là "Trợ lý AI TGP Hà Nội".
                Nhiệm vụ:
                - Chỉ hỗ trợ tìm kinh và các vấn đề Công giáo. Chặn mọi chủ đề thế tục, chính trị, giải trí.
                - Khi tìm kinh, BẮT BUỘC dùng 'find_prayer_in_db'.
                - Nếu kết quả từ database chứa nhiều bài kinh hoặc quá dài, con phải TRÍCH XUẤT CHÍNH XÁC bài kinh người dùng yêu cầu để hiển thị. 
                - Nếu kinh quá dài (vượt quá khả năng hiển thị), con trích đoạn đầu trang trọng và chỉ mục người dùng xem toàn văn tại: [Kinh Nguyện] > [Tên bài kinh].
                - Giọng văn: Khiêm nhường, lễ phép, trang trọng.`
            });

            const chat = model.startChat({ history: history });
            let result = await chat.sendMessage(message);
            let response = result.response;

            const call = response.functionCalls()?.[0];

            if (call && call.name === "find_prayer_in_db") {
                const { keyword } = call.args;

                // Tìm kiếm linh hoạt như code cũ
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
                    let processedContent = fullContent;
                    let isTooLong = fullContent.length > 3500;

                    // Logic cắt đoạn thông minh bao quanh keyword để AI luôn thấy nội dung cần trích xuất
                    if (isTooLong) {
                        const idx = fullContent.toLowerCase().indexOf(keyword.toLowerCase());
                        const start = Math.max(0, idx - 500);
                        const end = Math.min(fullContent.length, idx + 3000);
                        processedContent = fullContent.substring(start, end);
                    }

                    const finalResult = await chat.sendMessage([{
                        functionResponse: {
                            name: "find_prayer_in_db",
                            response: {
                                title: data.title,
                                content: processedContent,
                                isLong: isTooLong,
                                searchKeyword: keyword
                            }
                        }
                    }]);

                    const replyText = finalResult.response.text();
                    await redisClient.setEx(cacheKey, ChatAIController.CACHE_TTL, JSON.stringify(replyText));

                    return res.json({ success: true, reply: replyText });
                } else {
                    const failReply = "Dạ, con đã cố gắng tìm kiếm nhưng hiện tại không thấy bài kinh này trong tư liệu chính thức của TGP ạ.";
                    return res.json({ success: true, reply: failReply });
                }
            }

            res.json({ success: true, reply: response.text() });

        } catch (error) {
            console.error('Lỗi:', error.message);
            res.status(500).json({ success: false, reply: "Dạ, con đang gặp chút gián đoạn kỹ thuật, xin quý vị thử lại sau ạ." });
        }
    }
};

module.exports = ChatAIController;