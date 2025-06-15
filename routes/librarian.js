const express = require("express");
const router = express.Router();
const passport = require("passport");
const librarianController = require("../controllers/librarianController");
const { authorizeRoles } = require("../middlwares/authorizeRoles");
const upload = require("./multer");
const catchAsync = require("../utils/catchAsync");

// Auth + Role middleware
const auth = passport.authenticate("jwt", { session: false });

// ===================
// QUERY MANAGEMENT ROUTES
// ===================
router.get(
  "/queries",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getAllQueries)
);

router.get(
  "/queries/:id",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getQueryDetails)
);

router.patch(
  "/queries/:id/status",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.updateQueryStatus)
);

// ===================
// BORROW MANAGEMENT ROUTES
// ===================
router.get(
  "/borrow-requests",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getAllBorrowRequests)
);

router.patch(
  "/borrow-requests/:id/status",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.updateBorrowStatus)
);

router.patch(
  "/renewal-requests/:id/process",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.processRenewalRequest)
);

// ===================
// BOOK MANAGEMENT ROUTES (CRUD)
// ===================
// router.get(
//   "/books",
//   auth,
//   authorizeRoles("librarian", "admin", "user"),
//   catchAsync(librarianController.getAllBooks)
// );

router.get(
  "/books/:id",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getBookDetails)
);

router.post(
  "/books",
  auth,
  authorizeRoles("librarian", "admin"),
  upload.single("coverImage"),
  catchAsync(librarianController.addBook)
);

router.patch(
  "/books/:id",
  auth,
  authorizeRoles("librarian", "admin"),
  upload.single("coverImage"),
  catchAsync(librarianController.updateBook)
);

router.delete(
  "/books/:id",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.deleteBook)
);

// ===================
// NOTIFICATION ROUTES
// ===================
router.post(
  "/notifications/send",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.sendNotification)
);

router.post(
  "/notifications/overdue-reminders",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.sendOverdueReminders)
);

router.post(
  "/notifications/due-reminders",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.sendDueDateReminders)
);

// ===================
// REPORTS & ANALYTICS ROUTES
// ===================
router.get(
  "/dashboard",
  auth,
  authorizeRoles("librarian"),
  catchAsync(librarianController.getLibrarianDashboard)
);

router.get(
  "/reports/most-borrowed",
  catchAsync(librarianController.getMostBorrowedBooks)
);

router.get(
  "/reports/overdue",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getOverdueReport)
);

router.get(
  "/reports/fines",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getFineReport)
);

router.get(
  "/reports/monthly-stats",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getMonthlyBorrowStats)
);

router.get(
  "/reports/user-activity",
  auth,
  authorizeRoles("librarian", "admin"),
  catchAsync(librarianController.getUserActivityReport)
);

module.exports = router;