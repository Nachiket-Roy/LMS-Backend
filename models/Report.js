const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  report_id: { type: String, required: true, unique: true },
  report_type:  {enum: ['Top-issued', 'Fine-summary']},
  created_at: { type: Date, default: Date.now },
  description: String,
});

module.exports = mongoose.model('Report', reportSchema);
