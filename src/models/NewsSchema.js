const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema(
    {
        postId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            default: "",
        },
        excerpt: {
            type: String,
            default: "",
        },
        link: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: String, // Format: "23/01/2026"
            required: true,
        },
        time: {
            type: String, // Format: "10:19 sáng"
            required: true,
        },
        dateTime: {
            type: String, // Format: "23/01/2026 10:19 sáng"
            required: true,
        },
        image: {
            type: String,
            default: "",
        },
        imageWidth: {
            type: Number,
            default: 0,
        },
        isLargestImage: {
            type: Boolean,
            default: true,
        },
        elementType: {
            type: String,
            default: "elementor-post",
        },
        parsedDate: {
            type: Date, // ISO Date format
            required: true,
            index: true,
        },
        formattedDateTime: {
            type: String,
            default: "",
        },
        hasTime: {
            type: Boolean,
            default: false,
        },
        timestamp: {
            type: Number,
            index: true,
        },
        // Trường để kiểm soát hiển thị lại
        lastPublishedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        originalPublishedAt: {
            type: Date,
            default: Date.now,
        },
        isRepublished: {
            type: Boolean,
            default: false,
        },
        republishCount: {
            type: Number,
            default: 0,
        },
        source: {
            type: String,
            default: "https://www.tonggiaophanhanoi.org/mobile-app-feeding/",
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        aiSummary: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

// Compound index để tìm kiếm nhanh
NewsSchema.index({ postId: 1, lastPublishedAt: -1 });
NewsSchema.index({ isActive: 1, lastPublishedAt: -1 });

module.exports = mongoose.model("News", NewsSchema);
