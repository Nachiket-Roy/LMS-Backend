const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  book_id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['Science', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Crime', 'Drama']
  },
  publisher: String,
  total_copies: { type: Number, required: true },
  available_copies: { type: Number, required: true },
  availability_status: {
    type: String,
    enum: ['available', 'unavailable', 'reserved'],
    default: 'available'
  },
  cover_image_url: String
});

// Pre-save hook to set availability_status based on available_copies
bookSchema.pre('save', function (next) {
  if (this.available_copies === 0) {
    this.availability_status = 'unavailable';
  } else if (this.available_copies < this.total_copies) {
    this.availability_status = 'reserved'; // optional logic
  } else {
    this.availability_status = 'available';
  }
  next();
});

module.exports = mongoose.model('Book', bookSchema);
