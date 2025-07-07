const axios = require('axios');
const cheerio = require('cheerio');

// ✅ Hàm chèn xuống dòng trước các cụm từ đặc trưng
function insertLineBreaksBeforeKeywords(text) {
  const keyPhrases = [
    'Sinh năm',
    'Lễ quan thầy',
    'Thụ phong linh mục',
    'Đ/c',
    'Chính xứ',
    'Phó xứ',
    'Giám đốc',
    'Giảng viên',
    'Quản xứ',
    'Tổng đại diện',
    'Hiệu trưởng',
    'Cha xứ',
    'Bề trên',
  ];

  keyPhrases.forEach(phrase => {
    const regex = new RegExp(`(?!^)${phrase}`, 'g');
    text = text.replace(regex, `\n${phrase}`);
  });

  return text;
}

// ✅ Hàm xử lý 1 khối elementor
function extractItemsFromElement($, elementClass, type = '') {
  const results = [];
  const container = $(elementClass);
  const toggleItems = container.find('.elementor-toggle-item');

  toggleItems.each((i, el) => {
    const item = $(el);

    // Lấy tiêu đề
    let title = item.find('a.elementor-toggle-title').text().trim();
    if (!title) {
      title = item.find('.elementor-toggle-title').text().trim();
    }

    // Lấy phần nội dung
    const contentEl = item.find('.elementor-tab-content');
    const rawHtml = contentEl.html() || '';
    const $content = cheerio.load(rawHtml);

    // ✅ Thay <br> bằng \n trước khi lấy text
    $content('br').replaceWith('\n');

    // Lấy ảnh
    const firstImg = $content('img').first();
    let image = '';
    if (firstImg.length) {
      const src = firstImg.attr('src') || '';
      const dataSrc = firstImg.attr('data-src') || '';
      image = dataSrc && !dataSrc.startsWith('data:image/') ? dataSrc : src;
    }

    // Xóa ảnh và noscript
    $content('img').remove();
    $content('noscript').remove();

    // Lấy text, giữ \n và xuống dòng đúng
    let fullText = $content.root().text()
      .replace(/\s+\n/g, '\n')      // bỏ khoảng trắng trước dòng mới
      .replace(/\n\s+/g, '\n')      // bỏ khoảng trắng đầu dòng
      .replace(/\s+/g, ' ')         // chuẩn hóa khoảng trắng
      .trim();

    // ✅ Tách dòng tại các keyword như "Sinh năm", "Lễ quan thầy",...
    fullText = insertLineBreaksBeforeKeywords(fullText);

    const contentLines = fullText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Kết quả
    const result = {
      title,
      image,
      content: contentLines,
    };

    if (type) {
      result.type = type;
    }

    results.push(result);
  });

  return results;
}

const LMController = {
  getLM: async (req, res, next) => {
    try {
      const url = 'https://www.tonggiaophanhanoi.org/linh-muc-doan-tong-giao-phan-ha-noi-nam-2019/';
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);

      const diocesanPriests1 = extractItemsFromElement($, '.elementor-element-e2c2281');
      const diocesanPriests2 = extractItemsFromElement($, '.elementor-element-90c602e');
      const religiousPriests = extractItemsFromElement($, '.elementor-element-11b9164', 'Linh mục dòng');

      const results = [...diocesanPriests1, ...diocesanPriests2, ...religiousPriests];

      return res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      console.error('Lỗi crawl:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = LMController;
