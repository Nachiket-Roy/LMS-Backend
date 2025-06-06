  const mongoose = require('mongoose');

  const feedbackSchema = new mongoose.Schema({
    user_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    book_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Book', 
      required: true 
    },
    rating: { 
      type: Number, 
      required: true,
      min: 1,
      max: 5
    },
    comment: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 500
    },
    anonymous: { 
      type: Boolean, 
      default: false 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  });

  // Add compound index to prevent duplicate feedback from same user for same book
  feedbackSchema.index({ user_id: 1, book_id: 1 }, { unique: true });

  module.exports = mongoose.model('Feedback', feedbackSchema);