const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  book_id: { type: String, required: true, unique: true },
  title: { type: String, required: true},
  category: String,
  publisher: String,
  availability_status: { type: String, enum: ['available', 'unavailable', 'reserved']},
  total_copies: { type: Number, required: true},
  available_copies: { type: Number, required: true},
});

module.exports = mongoose.model('Book', bookSchema);