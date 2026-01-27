// config/redis.js
const { createClient } = require('redis');

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
    }
});

client.on('error', (err) => console.error('❌ Redis Client Error', err));
client.on('connect', () => console.log('✅ Đã kết nối Redis'));

// Kết nối ngay khi khởi động
(async () => {
    if (!client.isOpen) await client.connect();
})();

module.exports = client;