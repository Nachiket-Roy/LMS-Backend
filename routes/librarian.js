const express = require('express');
const router = express.Router();
const passport = require('passport');
const librarianController = require('../controllers/librarianController');
const { authorizeRoles } = require('../middlwares/authorizeRoles');
const multer = require("../routes/books")
// Auth + Role middleware
const auth = passport.authenticate('jwt', { session: false });
// ===================
// QUERY MANAGEMENT ROUTES
// ===================

// Get all queries/feedback
router.get('/queries', auth, authorizeRoles('librarian', 'admin'), librarianController.getAllQueries);

// Get single query details
router.get('/queries/:id', auth, authorizeRoles('librarian', 'admin'), librarianController.getQueryDetails);

// Update query status (resolve/update)
router.patch('/queries/:id/status', auth, authorizeRoles('librarian', 'admin'), librarianController.updateQueryStatus);

// ===================
// BORROW MANAGEMENT ROUTES
// ===================

// Get all borrow requests
router.get('/borrow-requests', auth, authorizeRoles('librarian', 'admin'), librarianController.getAllBorrowRequests);

// Update borrow status (approve/reject/issue/return)
router.patch('/borrow-requests/:id/status', auth, authorizeRoles('librarian', 'admin'), librarianController.updateBorrowStatus);

// Process renewal requests
router.patch('/renewal-requests/:id/process', auth, authorizeRoles('librarian', 'admin'), librarianController.processRenewalRequest);

// ===================
// BOOK MANAGEMENT ROUTES (CRUD)
// ===================

// Get all books
router.get('/books', auth, authorizeRoles('librarian', 'admin'), librarianController.getAllBooks);

// Get single book details
router.get('/books/:id', auth, authorizeRoles('librarian', 'admin'), librarianController.getBookDetails);

// Create new book
router.post('/books', auth, authorizeRoles('librarian', 'admin'), librarianController.addBook);

// Update book
router.patch('/books/:id', auth, authorizeRoles('librarian', 'admin'), librarianController.updateBook);

// Delete book
router.delete('/books/:id', auth, authorizeRoles('librarian', 'admin'), librarianController.deleteBook);

// ===================
// NOTIFICATION ROUTES
// ===================

// Send custom notification
router.post('/notifications/send', auth, authorizeRoles('librarian', 'admin'), librarianController.sendNotification);

// Send overdue reminders
router.post('/notifications/overdue-reminders', auth, authorizeRoles('librarian', 'admin'), librarianController.sendOverdueReminders);

// Send due date reminders
router.post('/notifications/due-reminders', auth, authorizeRoles('librarian', 'admin'), librarianController.sendDueDateReminders);

// ===================
// REPORTS & ANALYTICS ROUTES
// ===================

// Librarian dashboard summary
router.get('/dashboard', auth, authorizeRoles('librarian'), librarianController.getLibrarianDashboard);

// Most borrowed books report
router.get('/reports/most-borrowed', auth, authorizeRoles('librarian', 'admin'), librarianController.getMostBorrowedBooks);

// Overdue items report
router.get('/reports/overdue', auth, authorizeRoles('librarian', 'admin'), librarianController.getOverdueReport);

// Fine collection report
router.get('/reports/fines', auth, authorizeRoles('librarian', 'admin'), librarianController.getFineReport);

// Monthly borrow statistics
router.get('/reports/monthly-stats', auth, authorizeRoles('librarian', 'admin'), librarianController.getMonthlyBorrowStats);

// User activity report
router.get('/reports/user-activity', auth, authorizeRoles('librarian', 'admin'), librarianController.getUserActivityReport);

module.exports = router;