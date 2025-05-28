const mongoose = require('mongoose');

const bookIssueSchema = new mongoose.Schema({
  issue_id: { type: String, required: true, unique: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issued_by_librarian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Librarian' },
  issued_by_admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  issue_date: Date,
  due_date: Date,
  return_date: Date,
  status: { type: String, enum: ['issued', 'returned', 'overdue'] },
  fine_amount: Number,
});

module.exports = mongoose.model('BookIssue', bookIssueSchema);
