const LMRouter = require('./linhMuc')

const route = (app) => {
    app.use(`/linhMuc`, LMRouter)
}

module.exports = route;