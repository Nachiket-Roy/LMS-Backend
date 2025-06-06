const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Book title is required'], 
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  category: {
    type: String,
    enum: {
      values: ['Science', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Crime', 'Drama', 'Programming', 'Fiction', 'Psychology'],
      message: 'Invalid category selected'
    },
    required: [true, 'Category is required']
  },
  author: { 
    type: String, 
    required: [true, 'Author is required'], 
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  rating: { 
    type: Number, 
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot exceed 5'],
    default: 0
  },
  totalCopies: { 
    type: Number, 
    required: [true, 'Total copies is required'],
    min: [1, 'Total copies must be at least 1']
  },
  availableCopies: { 
    type: Number, 
    required: [true, 'Available copies is required'],
    min: [0, 'Available copies cannot be negative']
  },
  availabilityStatus: {
    type: String,
    enum: {
      values: ['available', 'unavailable', 'reserved'],
      message: 'Invalid availability status'
    },
    default: 'available'
  },
  coverImageUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Please provide a valid image URL'
    }
  },
  publisher: {
    type: String,
    trim: true,
    maxlength: [100, 'Publisher name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Custom validation for available copies
bookSchema.path('availableCopies').validate(function(value) {
  return value <= this.totalCopies;
}, 'Available copies cannot exceed total copies');

// Indexes for better query performance
bookSchema.index({ title: 'text', author: 'text', description: 'text' });
bookSchema.index({ category: 1, availabilityStatus: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ availabilityStatus: 1 });
bookSchema.index({ createdAt: -1 });

// Virtual fields
bookSchema.virtual('borrowedCopies').get(function() {
  return this.totalCopies - this.availableCopies;
});

bookSchema.virtual('availabilityPercentage').get(function() {
  return ((this.availableCopies / this.totalCopies) * 100).toFixed(1);
});

bookSchema.virtual('isAvailable').get(function() {
  return this.availableCopies > 0;
});

// Instance methods
bookSchema.methods.canBeBorrowed = function() {
  return this.availableCopies > 0 && this.availabilityStatus !== 'unavailable';
};

bookSchema.methods.borrowCopy = function() {
  if (this.canBeBorrowed()) {
    this.availableCopies -= 1;
    return this.save();
  }
  throw new Error('Book cannot be borrowed');
};

bookSchema.methods.returnCopy = function() {
  if (this.availableCopies < this.totalCopies) {
    this.availableCopies += 1;
    return this.save();
  }
  throw new Error('Cannot return more copies than total');
};

// Static methods
bookSchema.statics.findAvailable = function() {
  return this.find({ availableCopies: { $gt: 0 } });
};

bookSchema.statics.findByCategory = function(category) {
  return this.find({ category: category });
};

bookSchema.statics.searchBooks = function(searchTerm) {
  return this.find({
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { author: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

// Pre-save middleware
bookSchema.pre('save', function(next) {
  // Validate available copies
  if (this.availableCopies > this.totalCopies) {
    return next(new Error('Available copies cannot exceed total copies'));
  }
  
  if (this.availableCopies < 0) {
    return next(new Error('Available copies cannot be negative'));
  }
  
  // Set availability status based on available copies
  if (this.availableCopies === 0) {
    this.availabilityStatus = 'unavailable';
  } else if (this.availableCopies < this.totalCopies) {
    this.availabilityStatus = 'reserved';
  } else {
    this.availabilityStatus = 'available';
  }
  
  next();
});

// Post-save middleware for logging
bookSchema.post('save', function(doc) {
  console.log(`Book "${doc.title}" saved with ${doc.availableCopies}/${doc.totalCopies} copies available`);
});

// Pre-remove middleware to prevent deletion of books with active borrows
bookSchema.pre('remove', async function(next) {
  try {
    const Borrow = mongoose.model('Borrow');
    const activeBorrows = await Borrow.countDocuments({
      book: this._id,
      status: { $in: ['requested', 'approved', 'issued', 'renewed'] }
    });
    
    if (activeBorrows > 0) {
      return next(new Error('Cannot delete book with active borrows'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Book', bookSchema);