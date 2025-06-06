const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: { type: Number, required: true },
  method: { type: String, enum: ["cash", "card", "upi", "online"], required: true },
  status: {
    type: String,
    enum: ["paid", "failed", "pending"],
    default: "paid",
  }
}, {timestamps: true});

module.exports = mongoose.model("Payment", paymentSchema);
