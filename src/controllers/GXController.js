const axios = require('axios');
const cheerio = require('cheerio');

const GXController = {
  getGX: async (req, res) => {
    try {
      const baseUrl = 'https://www.tonggiaophanhanoi.org';
      const url = `${baseUrl}/cac-giao-xu-trong-tong-giao-phan-ha-noi/`;
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);

      const container = $('.elementor-element-7f81fffa');
      const rows = container.find('tr');

      const giaoXuList = [];

      rows.slice(1).each((index, row) => {
        const columns = $(row).find('td');

        const tenGXElement = $(columns[0]).find('a');
        const tenGX = tenGXElement.text().trim() || $(columns[0]).text().trim();

        let link = tenGXElement.attr('href') || null;
        if (link && !link.startsWith('http')) {
          link = baseUrl + '/' + link.replace(/^\/+/, ''); // loại bỏ dấu / đầu nếu có
        }

        const giaoXu = {
          tenGX,
          link,
          tenKhac: $(columns[1]).text().trim(),
          giaoHat: $(columns[2]).text().trim(),
          diaChi: $(columns[3]).text().trim(),
        };

        giaoXuList.push(giaoXu);
      });

      res.json({
        success: true,
        data: giaoXuList,
      });
    } catch (error) {
      console.error('Lỗi crawl giáo xứ:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi crawl giáo xứ',
        error: error.message,
      });
    }
  }
};

module.exports = GXController;
