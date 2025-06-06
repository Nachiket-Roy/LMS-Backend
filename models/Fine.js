const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  issue_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Borrow', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['paid', 'unpaid', 'pending'], 
    default: 'unpaid' 
  },
  paymentDate: { 
    type: Date 
  },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'upi', 'other', null], 
    default: null 
  },
  description: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
fineSchema.index({ user_id: 1, status: 1 });
fineSchema.index({ borrow: 1 });

module.exports = mongoose.model('Fine', fineSchema);