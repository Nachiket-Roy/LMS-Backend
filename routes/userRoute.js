const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/userController");
const { authorizeRoles } = require("../middlwares/authorizeRoles");
const librarianController = require("../controllers/librarianController");
const catchAsync = require("../utils/catchAsync");

// Auth + Role middleware
const auth = passport.authenticate("jwt", { session: false });

// ===== BOOKS ===== (Accessible to all authenticated users)
router.get(
  "/books",
  catchAsync(librarianController.getAllBooks)
);

// ===== PROFILE MANAGEMENT =====
router.get(
  "/profile",
  auth,
  authorizeRoles("user", "librarian", "admin"),
  catchAsync(userController.getProfile)
);
router.put(
  "/profile",
  auth,
  authorizeRoles("user", "librarian", "admin"),
  catchAsync(userController.updateProfile)
);
router.delete(
  "/profile",
  auth,
  authorizeRoles("user", "librarian", "admin"),
  catchAsync(userController.deleteAccount)
);

// ===== BORROW MANAGEMENT =====
router.get(
  "/borrow-requests",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getBorrowRequests)
);
router.post(
  "/borrow/request",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.requestBorrow)
);
router.post(
  "/borrow/renew/:id",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.renewBook)
);

// ===== OVERDUE & HISTORY =====
router.get(
  "/overdue-books",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getOverdueBooks)
);
router.get(
  "/reading-history",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getReadingHistory)
);
router.get(
  "/latest-due-notification",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.latestDueNotification)
);

// ===== NOTIFICATIONS =====
router.get(
  "/notifications",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getNotifications)
);
router.get(
  "/notifications/unread-count",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getUnreadCount)
);
router.put(
  "/notifications/:id/read",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.markAsRead)
);
router.put(
  "/notifications/mark-all-read",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.markAllAsRead)
);

// ===== PAYMENTS =====
router.get(
  "/payment-history",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getPaymentHistory)
);

// ===== DASHBOARD =====
router.get(
  "/dashboard-summary",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getDashboardSummary)
);

// ===== FEEDBACK & QUERIES =====
router.post(
  "/feedback",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.submitQuery)
);
router.get(
  "/queries",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getUserQueries)
);
router.get(
  "/queries/:id",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.getUserQueryById)
);
router.delete(
  "/queries/:id",
  auth,
  authorizeRoles("user"),
  catchAsync(userController.deleteUserQuery)
);

module.exports = router;