const mongoose = require("mongoose");

const PushDeviceSchema = new mongoose.Schema(
    {
        expoPushToken: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        platform: {
            type: String,
            enum: ["ios", "android"],
            required: true,
        },

        // ===== DEVICE INFO =====
        deviceName: String,
        modelName: String,
        manufacturer: String,
        brand: String,

        // ===== OS INFO =====
        osName: String,
        osVersion: String,

        // ===== APP INFO =====
        appVersion: String,
        appBuild: String,

        // ===== PUSH STATUS =====
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        lastActiveAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("PushDevice", PushDeviceSchema);