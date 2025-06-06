const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  finePerDay: {
    type: Number,
    default: 5,
    min: [0, 'Fine per day cannot be negative']
  },
  maxRenewals: {
    type: Number,
    default: 3,
    min: [0, 'Max renewals cannot be negative']
  }
  
});

module.exports = mongoose.model('Settings', settingsSchema);
