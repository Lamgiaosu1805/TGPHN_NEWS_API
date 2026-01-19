const GlobalNotificationSchema = require("../models/GlobalNotificationSchema");
const PushDeviceSchema = require("../models/PushDeviceSchema");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

const NotificationController = {
    // ===============================
    // REGISTER DEVICE
    // ===============================
    registerPushDevice: async (req, res) => {
        try {
            const {
                expoPushToken,
                platform,
                deviceName,
                modelName,
                manufacturer,
                brand,
                osName,
                osVersion,
                appVersion,
                appBuild,
            } = req.body;

            if (!expoPushToken || !platform) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            if (!Expo.isExpoPushToken(expoPushToken)) {
                return res.status(400).json({ message: "Invalid Expo push token" });
            }

            await PushDeviceSchema.findOneAndUpdate(
                { expoPushToken },
                {
                    platform,
                    deviceName,
                    modelName,
                    manufacturer,
                    brand,
                    osName,
                    osVersion,
                    appVersion,
                    appBuild,
                    isActive: true,
                    lastActiveAt: new Date(),
                },
                { upsert: true, new: true },
            );

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // ===============================
    // PUSH TO MANY TOKENS
    // ===============================
    pushToTokens: async (req, res) => {
        try {
            const { tokens, title, body, data } = req.body;

            if (!Array.isArray(tokens) || tokens.length === 0) {
                return res.status(400).json({ message: "tokens must be an array" });
            }

            const messages = tokens
                .filter((token) => Expo.isExpoPushToken(token))
                .map((token) => ({
                    to: token,
                    sound: "default",
                    title,
                    body,
                    data,
                }));

            if (!messages.length) {
                return res.status(400).json({ message: "No valid Expo tokens" });
            }

            const chunks = expo.chunkPushNotifications(messages);
            const tickets = [];

            for (const chunk of chunks) {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }

            // Disable invalid tokens
            for (let i = 0; i < tickets.length; i++) {
                const ticket = tickets[i];
                if (
                    ticket.status === "error" &&
                    ticket.details?.error === "DeviceNotRegistered"
                ) {
                    await PushDeviceSchema.updateOne(
                        { expoPushToken: messages[i].to },
                        { isActive: false },
                    );
                }
            }

            return res.json({
                success: true,
                sent: messages.length,
                tickets,
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // ===============================
    // PUSH TO ALL DEVICES
    // ===============================
    pushToAll: async (req, res) => {
        try {
            const { title, body, data } = req.body;

            if (!title || !body) {
                return res.status(400).json({ message: "Missing title or body" });
            }

            // 1. Lưu notification chung
            const notification = await GlobalNotificationSchema.create({
                title,
                body,
                data,
            });

            // 2. Lấy danh sách device active
            const devices = await PushDeviceSchema.find({
                isActive: true,
            }).lean();

            if (!devices.length) {
                return res.json({
                    success: true,
                    message: "Notification saved, no active devices",
                    notificationId: notification._id,
                });
            }

            // 3. Tạo message push
            const messages = devices
                .map((d) => d.expoPushToken)
                .filter((token) => Expo.isExpoPushToken(token))
                .map((token) => ({
                    to: token,
                    sound: "default",
                    title,
                    body,
                    data,
                }));

            if (!messages.length) {
                return res.json({
                    success: true,
                    message: "Notification saved, no valid tokens",
                    notificationId: notification._id,
                });
            }

            // 4. Push Expo
            const chunks = expo.chunkPushNotifications(messages);
            const tickets = [];

            for (const chunk of chunks) {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }

            // 5. Disable token invalid
            for (let i = 0; i < tickets.length; i++) {
                const ticket = tickets[i];
                if (
                    ticket.status === "error" &&
                    ticket.details?.error === "DeviceNotRegistered"
                ) {
                    await PushDeviceSchema.updateOne(
                        { expoPushToken: messages[i].to },
                        { isActive: false },
                    );
                }
            }

            return res.json({
                success: true,
                sent: messages.length,
                notificationId: notification._id,
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },
    getGlobalNotifications: async (req, res) => {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(50, Number(req.query.limit) || 20);
            const skip = (page - 1) * limit;

            const [items, total] = await Promise.all([
                GlobalNotificationSchema.find({})
                    .sort({ publishedAt: -1 }) // mới → cũ
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                GlobalNotificationSchema.countDocuments(),
            ]);

            return res.json({
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },
};

module.exports = NotificationController;
