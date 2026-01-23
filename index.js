process.env.TZ = "Asia/Ho_Chi_Minh";
require("dotenv").config();
const express = require("express");
const app = express();
const route = require("./src/routes");
const morgan = require("morgan");
const cors = require("cors");
const db = require("./src/config/connectDB");

//use middlewares
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);

//routing
route(app);

// Connect to MongoDB và start server
(async () => {
  try {
    await db.connect();

    // Import cron job sau khi DB connect
    // require("./src/jobs/scheduleNotification");
    require("./src/jobs/newsJob").start();

    const port = process.env.PORT || 3456;
    app.listen(port, () => {
      console.log(`App listening on port ${port}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Dừng app nếu DB không connect được
  }
})();
