const LMRouter = require('./linhMuc')
const GXRouter = require('./giaoXu')

const route = (app) => {
    app.use(`/linhMuc`, LMRouter)
    app.use(`/giaoXu`, GXRouter)
}

module.exports = route;