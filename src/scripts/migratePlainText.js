const mongoose = require('mongoose');
const Prayer = require('../models/PrayerSchema');
const htmlToPlainText = require('../utils/htmlToPlainText');

async function run() {
    await mongoose.connect('');

    const prayers = await Prayer.find({
        $or: [
            { plainText: { $exists: false } },
            { plainText: '' }
        ]
    });

    console.log(`Found ${prayers.length} prayers to migrate`);

    for (const p of prayers) {
        p.plainText = htmlToPlainText(p.html);
        await p.save();
    }

    console.log('Done');
    process.exit();
}

run();
