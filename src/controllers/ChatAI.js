const { GoogleGenerativeAI } = require("@google/generative-ai");
const { convert } = require('html-to-text');
const Prayer = require('../models/PrayerSchema');

// Khởi tạo Gemini với API Key từ môi trường
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

const ChatAIController = {
    // --- 1. ĐỊNH NGHĨA CÔNG CỤ (TOOLS) ---
    tools: [{
        functionDeclarations: [{
            name: "find_prayer_in_db",
            description: "Tìm nội dung kinh nguyện hoặc nghi thức trong kho dữ liệu.",
            parameters: {
                type: "OBJECT",
                properties: {
                    keyword: {
                        type: "STRING",
                        description: "Từ khóa tên kinh hoặc cụm từ bên trong (vd: 'Lạy Cha', 'Viếng nhà thờ')",
                    },
                },
                required: ["keyword"],
            },
        }]
    }],

    // --- 2. HÀM NÉN DỮ LIỆU (TIẾT KIỆM TOKEN) ---
    formatContent: (html) => {
        if (!html) return "";
        let text = convert(html, {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
            ]
        });
        // Nén văn bản tối đa để tiết kiệm chi phí bản miễn phí
        return text
            .replace(/\n\s*\n/g, '\n') // Xóa dòng trống dư thừa
            .replace(/[ \t]+/g, ' ')   // Xóa khoảng trắng dư thừa
            .trim();
    },

    // --- 3. LOGIC XỬ LÝ CHÍNH ---
    handleChat: async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({ success: false, message: "Thiếu nội dung tin nhắn" });
            }

            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                tools: ChatAIController.tools,
                systemInstruction: `Bạn là trợ lý tìm kinh Công giáo. 
        - Khi tìm thấy dữ liệu, hãy chỉ trích xuất đúng đoạn kinh người dùng cần.
        - Trả lời ngắn gọn, súc tích, trình bày bằng Markdown.
        - Nếu bài kinh quá dài, hãy tóm tắt ý chính trước.`
            });

            const chat = model.startChat();
            let result = await chat.sendMessage(message);
            let response = result.response;

            // Kiểm tra yêu cầu gọi Function
            const call = response.functionCalls()?.[0];

            if (call && call.name === "find_prayer_in_db") {
                const { keyword } = call.args;

                // TỐI ƯU: Chỉ lấy title và html để nhẹ bộ nhớ
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
                    let cleanText = ChatAIController.formatContent(data.html);

                    // TỐI ƯU: Cắt đoạn thông minh nếu văn bản quá dài (> 3000 ký tự)
                    // Giúp tránh lỗi quá tải (Overloaded) của gói Miễn phí
                    if (cleanText.length > 3000) {
                        const index = cleanText.toLowerCase().indexOf(keyword.toLowerCase());
                        const start = Math.max(0, index - 1000);
                        const end = Math.min(cleanText.length, index + 2000);
                        cleanText = "..." + cleanText.substring(start, end) + "...";
                    }

                    const finalResult = await chat.sendMessage([{
                        functionResponse: {
                            name: "find_prayer_in_db",
                            response: {
                                title: data.title,
                                content: cleanText
                            }
                        }
                    }]);

                    return res.json({
                        success: true,
                        reply: finalResult.response.text()
                    });
                } else {
                    return res.json({
                        success: true,
                        reply: "Con xin lỗi, hiện tại không tìm thấy nội dung này trong Sách Kinh."
                    });
                }
            }

            // Trả về phản hồi bình thường
            res.json({ success: true, reply: response.text() });

        } catch (error) {
            console.error('Lỗi Chat AI:', error.message);

            // Xử lý lỗi quá tải cho bản Miễn phí
            if (error.message.includes('503') || error.message.includes('overloaded')) {
                return res.status(503).json({
                    success: false,
                    message: 'Hệ thống AI đang bận xử lý, bạn vui lòng thử lại sau vài giây nhé.'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Lỗi máy chủ AI',
                error: error.message,
            });
        }
    }
};

module.exports = ChatAIController;