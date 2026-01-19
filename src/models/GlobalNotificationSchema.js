const mongoose = require("mongoose");

const GlobalNotificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        body: {
            type: String,
            required: true,
            trim: true,
        },

        data: {
            type: Object,
            default: {},
        },

        source: {
            type: String,
            default: "system", // system | admin
        },

        publishedAt: {
            type: Date,
            default: Date.now, // UTC, nhưng server đang set TZ VN
            index: true,
        },
    },
    {
        versionKey: false,
    },
);

module.exports = mongoose.model("GlobalNotification", GlobalNotificationSchema);
