const CheckVersionController = {
    getCurrentVersionApp: (req, res, next) => {
        try {
            let versionApp = "1.1.3"
            const appName = "TGPHN"
            res.json({
                version: versionApp,
                forceUpdate: false,
                appName: appName
            })
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = CheckVersionController;