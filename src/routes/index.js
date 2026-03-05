const LMRouter = require("./linhMuc");
const GXRouter = require("./giaoXu");
const KinhNguyenRouter = require("./kinhNguyen");
const NotificationRouter = require("./notification");
const NewsRouter = require("./news");
const CheckVersionRouter = require("./checkVersion");

const route = (app) => {
    app.use(`/linhMuc`, LMRouter);
    app.use(`/giaoXu`, GXRouter);
    app.use(`/kinhNguyen`, KinhNguyenRouter);
    app.use(`/notification`, NotificationRouter);
    app.use(`/news`, NewsRouter);
    app.use(`/version`, CheckVersionRouter);
};

module.exports = route;
