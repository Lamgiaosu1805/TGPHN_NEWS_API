const LMRouter = require('./linhMuc')
const GXRouter = require('./giaoXu')
const KinhNguyenRouter = require('./kinhNguyen')

const route = (app) => {
    app.use(`/linhMuc`, LMRouter)
    app.use(`/giaoXu`, GXRouter)
    app.use(`/kinhNguyen`, KinhNguyenRouter)
}

module.exports = route;