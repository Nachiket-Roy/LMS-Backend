const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issue: { type: mongoose.Schema.Types.ObjectId, ref: 'BookIssue' },
  amount: Number,
  status: { type: String, enum: ['paid', 'unpaid'] },
  payment_date: Date,
  payment_mode: String,
});

module.exports = mongoose.model('Fine', fineSchema);
