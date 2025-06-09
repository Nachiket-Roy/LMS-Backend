const express = require('express');
const router = express.Router();
const passport = require('passport');
const adminController = require('../controllers/adminController');
const { authorizeRoles } = require('../middlwares/authorizeRoles');

// Auth middleware
const auth = passport.authenticate('jwt', { session: false });

// ==================== USER MANAGEMENT ROUTES ====================

// Get all users with filters and pagination
router.get('/users', auth, authorizeRoles('admin'), adminController.getAllUsers);

// Get specific user by ID with detailed info
router.get('/users/:id', auth, authorizeRoles('admin'), adminController.getUserById);


// Delete/Deactivate user
router.delete('/users/:id', auth, authorizeRoles('admin'), adminController.deleteUser);

// ==================== LIBRARIAN MANAGEMENT ROUTES ====================

// Get all librarians
router.get('/librarians', auth, authorizeRoles('admin'), adminController.getAllLibrarians);


// ==================== DASHBOARD & ANALYTICS ROUTES ====================

// Admin dashboard summary
router.get('/dashboard', auth, authorizeRoles('admin'), adminController.getAdminDashboard);

// User activity logs
router.get('/activity-logs', auth, authorizeRoles('admin'), adminController.getUserActivityLogs);

// ==================== NOTIFICATION MANAGEMENT ROUTES ====================


module.exports = router;