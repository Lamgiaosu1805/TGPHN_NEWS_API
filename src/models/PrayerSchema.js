const mongoose = require('mongoose');

const PrayerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    html: {
        type: String,
        required: true
    },
    plainText: {
        type: String,
        default: ''
    },
    group: String
}, {
    collection: 'kinh-nguyen',
    timestamps: true
});

/**
 * Text index cho AI + search
 * title + plainText
 */
PrayerSchema.index({
    title: 'text',
    plainText: 'text'
});

module.exports = mongoose.model('Prayer', PrayerSchema);
