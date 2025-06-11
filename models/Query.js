const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['suggestion', 'inquiry', 'feature_request', 'complaint'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
  },
  status: {
  type: String,
  enum: ['open', 'in_progress', 'resolved', 'closed'],
  default: 'open',
},
  response: { type: String },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, {
  timestamps: true
});

module.exports = mongoose.model('Query', querySchema);
