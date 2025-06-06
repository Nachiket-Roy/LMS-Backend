const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false }, // Keep consistent with schema
  type: {
    type: String,
    enum: ['info', 'alert', 'due', 'admin', 'general', 'payment', 'approval', 'overdue', 'rejection'],
    default: 'info'
  },
  createdAt: { type: Date, default: Date.now } // Keep consistent with schema
});

module.exports = mongoose.model('Notification', notificationSchema);
