const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const { v4: uuidv4 } = require('uuid'); // for generating unique issue_id

// Issue a book to a user
async function issueBook(req, res) {
  try {
    const { book_id, user_id } = req.body;

    const book = await Book.findOne({ book_id });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    if (book.available_copies === 0) {
      return res.status(400).json({ error: 'No copies available to issue' });
    }

    // Decrement available copies and update status
    book.available_copies -= 1;
    if (book.available_copies === 0) {
      book.availability_status = 'unavailable';
    }
    await book.save();

    // Create book issue record
    const issue = new BookIssue({
      issue_id: uuidv4(),
      book: book._id,
      user_id,
      issue_date: new Date(),
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
      status: 'issued',
      fine_amount: 0,
    });

    await issue.save();

    res.status(201).json({ message: 'Book issued successfully', issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const returnBook = async (req, res) => {
  const { issueId } = req.params;

  const issue = await BookIssue.findOne({ issue_id: issueId }).populate('book');
  if (!issue) return res.status(404).json({ message: 'Issue record not found' });

  if (issue.status === 'returned') {
    return res.status(400).json({ message: 'Book already returned' });
  }

  const returnDate = new Date();
  issue.return_date = returnDate;

  // Fine: ₹5 per day late
  if (returnDate > issue.due_date) {
    const daysLate = Math.ceil((returnDate - issue.due_date) / (1000 * 60 * 60 * 24));
    issue.fine_amount = daysLate * 5;
    issue.status = 'overdue';
  } else {
    issue.status = 'returned';
  }

  await issue.save();

  const book = await book.findById(issue.book._id);
  book.available_copies += 1;
  await book.save();

  res.json({ message: 'Book returned successfully', data: issue });
};


module.exports = {
  issueBook,
  returnBook,
};
