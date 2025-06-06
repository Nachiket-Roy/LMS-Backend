const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const { authorizeRoles } = require('../middlwares/authorizeRoles');

// Auth + Role middleware
const auth = passport.authenticate('jwt', { session: false });

// Borrow Management
router.get('/borrows', auth, authorizeRoles('user'), userController.getBorrowRequests); 
router.post('/borrow/request', auth, authorizeRoles('user'), userController.requestBorrow); // <-- ADD THIS LINE
router.post('/borrow/renew/:id', auth, authorizeRoles('user'), userController.renewBook);
router.get('/overdue', auth, authorizeRoles('user'), userController.getOverdueBooks);
router.get('/reading-history', auth, authorizeRoles('user'), userController.getReadingHistory);

// Notification Management
router.get('/notifications', auth, authorizeRoles('user'), userController.getNotifications); // Get all notifications with pagination
router.get('/notifications/unread-count', auth, authorizeRoles('user'), userController.getUnreadCount); // Get count of unread notifications
router.put('/notifications/:id/read', auth, authorizeRoles('user'), userController.markAsRead); // Mark specific notification as read
router.put('/notifications/mark-all-read', auth, authorizeRoles('user'), userController.markAllAsRead); // Mark all notifications as read
router.get('/due-soon', auth, authorizeRoles('user'), userController.latestDueNotification); // Get latest due notification

// Payment Management
router.get('/payments', auth, authorizeRoles('user'), userController.getPaymentHistory);

// Profile Management
router.get('/profile', auth, authorizeRoles('user', 'librarian', 'admin'), userController.getProfile);
router.put('/profile', auth, authorizeRoles('user', 'librarian', 'admin'), userController.updateProfile);


module.exports = router;