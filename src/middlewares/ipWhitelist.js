const WHITELIST = [
    '127.0.0.1',
    '::1',
];

module.exports = function ipWhitelist(req, res, next) {
    let ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress;

    // Normalize IPv4-mapped IPv6
    if (ip?.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }

    if (!WHITELIST.includes(ip)) {
        return res.status(403).json({
            message: 'Forbidden: IP not allowed',
            ip,
        });
    }

    next();
};