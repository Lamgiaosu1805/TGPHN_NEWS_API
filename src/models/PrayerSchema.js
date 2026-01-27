const mongoose = require('mongoose');

const PrayerSchema = new mongoose.Schema({
    title: String,
    html: String,
    group: String
}, {
    // Chỉ định chính xác tên collection đã có trong DB của bạn
    collection: 'kinh-nguyen'
});

// Tạo index để tìm kiếm nhanh theo tiêu đề
PrayerSchema.index({ title: 'text' });

module.exports = mongoose.model('Prayer', PrayerSchema);