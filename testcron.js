const mongoose = require("mongoose");
require("dotenv").config();
require("./models/User");
require("./models/Book");
require("./models/Borrow");
require("./models/Settings"); // if used inside fine logic
require("./models/Notification");
require("./models/Query");
require("./models/Payment");
require("./models/Fine");
require("./models/Feedback");

// testFineUpdate.js
const { performOverdueFineUpdate } = require("./services/fineService");
const DB = process.env.MONGODB;
mongoose
  .connect(DB)
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => console.error(" MongoDB connection error:", err));


(async () => {
  try {
    console.log("🧪 Manually testing fine update...");
    const updated = await performOverdueFineUpdate();
    console.log(`✅ ${updated} fine(s) updated successfully.`);
  } catch (err) {
    console.error("❌ Manual fine update failed:", err.message);
  }
})();
