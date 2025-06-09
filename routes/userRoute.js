const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { authorizeRoles } = require('../middlwares/authorizeRoles');
const librarianController = require('../controllers/librarianController');

// Auth + Role middleware
const auth = passport.authenticate('jwt', { session: false });

// ===== BOOKS ===== (Accessible to all authenticated users)
router.get('/books', auth, authorizeRoles('librarian', 'admin', 'user'), librarianController.getAllBooks);

// ===== PROFILE MANAGEMENT =====
router.get('/profile', auth, authorizeRoles('user', 'librarian', 'admin'), userController.getProfile);
router.put('/profile', auth, authorizeRoles('user', 'librarian', 'admin'), userController.updateProfile);
router.delete('/profile', auth, authorizeRoles('user', 'librarian', 'admin'), userController.deleteAccount);

// ===== BORROW MANAGEMENT =====
// 🔧 CHANGED: '/borrows' → '/borrow-requests'
router.get('/borrow-requests', auth, authorizeRoles('user'), userController.getBorrowRequests);
router.post('/borrow/request', auth, authorizeRoles('user'), userController.requestBorrow);
router.post('/borrow/renew/:id', auth, authorizeRoles('user'), userController.renewBook);

// ===== OVERDUE & HISTORY =====
// 🔧 CHANGED: '/overdue' → '/overdue-books'
router.get('/overdue-books', auth, authorizeRoles('user'), userController.getOverdueBooks);
router.get('/reading-history', auth, authorizeRoles('user'), userController.getReadingHistory);
// 🔧 CHANGED: '/due-soon' → '/latest-due-notification'
router.get('/latest-due-notification', auth, authorizeRoles('user'), userController.latestDueNotification);

// ===== NOTIFICATIONS =====
router.get('/notifications', auth, authorizeRoles('user'), userController.getNotifications);
router.get('/notifications/unread-count', auth, authorizeRoles('user'), userController.getUnreadCount);
router.put('/notifications/:id/read', auth, authorizeRoles('user'), userController.markAsRead);
router.put('/notifications/mark-all-read', auth, authorizeRoles('user'), userController.markAllAsRead);

// ===== PAYMENTS =====
// 🔧 CHANGED: '/payments' → '/payment-history'
router.get('/payment-history', auth, authorizeRoles('user'), userController.getPaymentHistory);

// ===== DASHBOARD =====
router.get('/dashboard-summary', auth, authorizeRoles('user'), userController.getDashboardSummary);

// ===== FEEDBACK & QUERIES =====
// Submit new feedback/query
router.post('/feedback', auth, authorizeRoles('user'), userController.submitFeedback);

// Get all user's queries with filtering and search
router.get('/queries', auth, authorizeRoles('user'), userController.getUserQueries);

// Get specific query by ID
router.get('/queries/:id', auth, authorizeRoles('user'), userController.getUserQueryById);

// Delete user's open query
router.delete('/queries/:id', auth, authorizeRoles('user'), userController.deleteUserQuery);

module.exports = router;