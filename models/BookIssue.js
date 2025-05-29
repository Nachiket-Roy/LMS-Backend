const mongoose = require('mongoose');

const bookIssueSchema = new mongoose.Schema({
  issue_id: { type: String, required: true, unique: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issue_date: { type: Date, required: true },
  due_date: { type: Date, required: true },
  return_date: Date,
  status: { type: String, enum: ['issued', 'returned', 'overdue'], default: 'issued' },
  fine_amount: { type: Number, default: 0 },
});

module.exports = mongoose.model('BookIssue', bookIssueSchema);
