const LMRouter = require('./linhMuc')
const GXRouter = require('./giaoXu')
const KinhNguyenRouter = require('./kinhNguyen')
const NotificationRouter = require('./notification')

const route = (app) => {
    app.use(`/linhMuc`, LMRouter)
    app.use(`/giaoXu`, GXRouter)
    app.use(`/kinhNguyen`, KinhNguyenRouter)
    app.use(`/notification`, NotificationRouter)
}

module.exports = route;