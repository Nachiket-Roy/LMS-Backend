const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const Fine = require("../models/Fine");
const catchAsync = require("../utils/catchAsync");
const Query = require("../models/Query");
const { performOverdueFineUpdate } = require("../services/fineService");

// 1. Borrow Requests (pending/approved/rejected)
exports.getBorrowRequests = catchAsync(async (req, res) => {
  const { status } = req.query;

  // Build query object conditionally
  const query = { user_id: req.user._id };
  if (status) {
    query.status = status;
  }

  const requests = await Borrow.find(query)
    .populate("book_id", "title author coverImagePath") // ✅ Add coverImagePath here
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: requests.length,
    data: requests,
  });
});


// 2. Renew Book
exports.renewBook = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: "Invalid borrow record ID format",
    });
  }

  // Find borrow record with book details
  const borrow = await Borrow.findById(id).populate("book_id", "title author");

  if (!borrow) {
    return res.status(404).json({
      success: false,
      message: "Borrow record not found",
    });
  }

  // Verify ownership
  if (borrow.user_id.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized - You can only renew your own books",
    });
  }

  // Check eligibility
  if (!["borrowed", "approved"].includes(borrow.status)) {
    return res.status(400).json({
      success: false,
      message: `Book is currently ${borrow.status} - only borrowed books can be renewed`,
    });
  }

  if (borrow.renewalRequestDate) {
    return res.status(400).json({
      success: false,
      message: "Renewal already requested for this book",
    });
  }

  // Process renewal
  borrow.status = "renew_requested";
  borrow.renewalRequestDate = new Date();
  await borrow.save();

  res.status(200).json({
    success: true,
    message: "Renewal request submitted successfully",
    data: {
      _id: borrow._id,
      status: borrow.status,
      book_id: {
        _id: borrow.book_id._id,
        title: borrow.book_id.title,
        author: borrow.book_id.author,
      },
      renewalRequestDate: borrow.renewalRequestDate,
    },
  });
});

// 3. Latest Due Notification
exports.latestDueNotification = catchAsync(async (req, res) => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const dueBorrows = await Borrow.find({
    user_id: req.user._id,
    status: { $in: ["approved", "borrowed", "renewed"] }, // not "issued"
    dueDate: {
      $gte: new Date(),
      $lte: nextWeek,
    },
  })
    .populate("book_id", "title author")
    .sort({ dueDate: 1 })
    .limit(1);

  res.status(200).json({
    success: true,
    data: dueBorrows[0] || null,
  });
});

// 4. All Notifications
exports.getNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const notifs = await Notification.find({ user_id: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments({ user_id: req.user._id });

  res.status(200).json({
    success: true,
    count: notifs.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: notifs,
  });
});
// View a specific notification by ID (only if it belongs to the user)
// exports.getNotificationById = catchAsync(async (req, res) => {
//   const { id } = req.params;

//   const notification = await Notification.findOne({
//     _id: id,
//     user_id: req.user._id,
//   });

//   if (!notification) {
//     return res.status(404).json({
//       success: false,
//       message: "Notification not found",
//     });
//   }

//   res.status(200).json({
//     success: true,
//     data: notification,
//   });
// });

// 5. Payment History + Total Fine
exports.getPaymentHistory = catchAsync(async (req, res) => {
  // Get payment history for the user
  const payments = await Payment.find({ user_id: req.user._id }).sort({
    createdAt: -1,
  });

  // Calculate total amount paid from Payment collection
  const totalPaid = await Payment.aggregate([
    {
      $match: {
        user_id: req.user._id,
        status: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  // Calculate total outstanding fines from Fine collection
  const totalOutstandingFines = await Fine.aggregate([
    {
      $match: {
        user_id: req.user._id,
        status: { $in: ["unpaid", "pending"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  // Calculate total fines (all fines regardless of status)
  const totalFines = await Fine.aggregate([
    {
      $match: {
        user_id: req.user._id,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    totalPaid: totalPaid[0]?.total || 0,
    totalFines: totalFines[0]?.total || 0,
    totalOutstandingFines: totalOutstandingFines[0]?.total || 0,
    totalPayments: payments.length,
    data: { payments },
  });
});

// 6. Overdue Books
exports.getOverdueBooks = catchAsync(async (req, res) => {
  const overdue = await Borrow.find({
    user_id: req.user._id,
    dueDate: { $lt: new Date() },
    status: { $in: ["approved", "issued", "renewed"] },
  })
    .populate("book_id", "title author coverImagePath")
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    count: overdue.length,
    data: { items: overdue },
  });
});

// 7. Reading History (Returned Books)
exports.getReadingHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const history = await Borrow.find({
    user_id: req.user._id,
    status: "returned",
  })
    .populate("book_id", "title author coverImagePath")
    .sort({ returnDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Borrow.countDocuments({
    user_id: req.user._id,
    status: "returned",
  });

  res.status(200).json({
    success: true,
    count: history.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: history,
  });
});

// 8. Get Profile
exports.getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -__v");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// 9. Update Profile
exports.updateProfile = catchAsync(async (req, res) => {
  const { name, contact, address } = req.body;

  // Basic validation
  const updates = {};
  if (name && name.trim()) updates.name = name.trim();
  if (contact !== undefined) updates.contact = contact.trim(); // Allow empty string
  if (address !== undefined) updates.address = address.trim(); // Allow empty string

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided for update",
    });
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
    select: "-password -__v",
  });

  if (!updatedUser) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});
exports.deleteAccount = catchAsync(async (req, res) => {
  const targetUserId = req.params.id || req.user._id; // Admin can specify target
  const requesterRole = req.user.role;
  const isSelfDelete = targetUserId.toString() === req.user._id.toString();

  // ✅ Only check borrows/fines for self-deleting users
  if (requesterRole === 'user' || isSelfDelete) {
    const activeBorrows = await Borrow.countDocuments({
      user_id: targetUserId,
      status: { $in: ["approved", "issued", "renewed", "requested"] },
    });

    if (activeBorrows > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete account with active book borrows. Please return all books first.",
      });
    }

    const outstandingFines = await Fine.countDocuments({
      user_id: targetUserId,
      status: { $in: ["unpaid", "pending"] },
    });

    if (outstandingFines > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete account with outstanding fines. Please clear all dues first.",
      });
    }
  }

  // ✅ Perform deletion
  await Promise.all([
    User.findByIdAndDelete(targetUserId),
    Borrow.deleteMany({ user_id: targetUserId }),
    Notification.deleteMany({ user_id: targetUserId }),
    Payment.deleteMany({ user_id: targetUserId }),
    Fine.deleteMany({ user_id: targetUserId }),
  ]);

  res.status(200).json({
    success: true,
    message: `Account deleted successfully${isSelfDelete ? '' : ' by admin'}`,
  });
});

// 11. Get user dashboard summary
exports.getDashboardSummary = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Get counts in parallel
  const [activeBorrows, overdueCount, totalFines, pendingRequests] =
    await Promise.all([
      Borrow.countDocuments({ user_id: userId, status: "borrowed" }),
      Borrow.countDocuments({
        user_id: userId,
        status: { $in: ["borrowed", "overdue"] },
        dueDate: { $lt: new Date() },
      }),
      Fine.aggregate([
        { $match: { user_id: userId, status: { $in: ["unpaid", "pending"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Borrow.countDocuments({ user_id: userId, status: "pending" }),
    ]);

  res.status(200).json({
    success: true,
    data: {
      activeBorrows,
      overdueCount,
      totalOutstandingFines: totalFines[0]?.total || 0,
      pendingRequests,
    },
  });
});

// 12. Request Borrow
exports.requestBorrow = catchAsync(async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Request params:", req.params);
  console.log("User:", req.user?._id);

  // Check if user is authenticated
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Extract book_id from both body and params to handle different request formats
  const book_id =
    req.body.book_id ||
    req.body.bookId ||
    req.params.book_id ||
    req.params.bookId ||
    req.params.id;

  console.log("Extracted book_id:", book_id);

  if (!book_id) {
    return res.status(400).json({
      success: false,
      message: "Book ID is required",
    });
  }

  // Validate ObjectId format
  if (!book_id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: "Invalid book ID format",
    });
  }

  // Validate if book exists and is available
  const book = await Book.findById(book_id);
  if (!book) {
    return res.status(404).json({
      success: false,
      message: "Book not found",
    });
  }

  if (book.availableCopies <= 0) {
    return res.status(400).json({
      success: false,
      message: "Book is currently unavailable",
    });
  }

  // Check if user already has a pending request for this book
  const existingRequest = await Borrow.findOne({
    user_id: req.user._id,
    book_id,
    status: { $in: ["requested", "approved"] },
  });

  if (existingRequest) {
    return res.status(400).json({
      success: false,
      message:
        existingRequest.status === "requested"
          ? "You already have a pending request for this book"
          : "You have already borrowed this book",
    });
  }

  const newRequest = await Borrow.create({
    user_id: req.user._id,
    book_id,
    status: "requested",
    requestDate: new Date(),
  });

  // Populate the request with book and user details for the response
  const populatedRequest = await Borrow.findById(newRequest._id)
    .populate("book_id", "title author")
    .populate("user_id", "name email");

  res.status(201).json({
    success: true,
    message: "Borrow request submitted successfully",
    data: populatedRequest,
  });
});

// 13. Mark notification as read
exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    { is_read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  res.status(200).json({
    success: true,
    data: notification,
  });
});

// 14. Mark all notifications as read
exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user_id: req.user._id, is_read: false },
    { is_read: true }
  );

  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

// 15. Get unread notification count
exports.getUnreadCount = catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({
    user_id: req.user._id,
    is_read: false,
  });

  res.status(200).json({
    success: true,
    count,
  });
});

// 16. Submit feedback/query
exports.submitQuery = catchAsync(async (req, res) => {
  const { type, subject, message, priority = "low" } = req.body;

  // Validate required fields
  if (!type || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "Type, subject, and message are required",
    });
  }

  // Validate type according to model enum
  const validTypes = ["suggestion", "inquiry", "feature_request", "complaint"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid feedback type. Must be one of: " + validTypes.join(", "),
    });
  }

  // Validate priority according to model enum
  const validPriorities = ["low", "medium", "high"];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid priority. Must be one of: " + validPriorities.join(", "),
    });
  }

  try {
    // Create feedback/query record using the Query model
    const query = await Query.create({
      user_id: req.user._id,
      type,
      subject: subject.trim(),
      message: message.trim(),
      priority,
      status: "open", // Default status from model
    });

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully. We'll review it shortly.",
      data: {
        id: query._id,
        type: query.type,
        subject: query.subject,
        message: query.message,
        priority: query.priority,
        status: query.status,
        createdAt: query.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback. Please try again.",
      error: error.message,
    });
  }
});

// Get all queries for the authenticated user (simplified version)
exports.getUserQueries = catchAsync(async (req, res) => {
  const { status, type, priority, page = 1, limit = 10, search } = req.query;
  const skip = (page - 1) * limit;

  // Build query object for user's queries only
  const query = { user_id: req.user._id };

  // Add optional filters
  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  // Add search functionality
  if (search && search.trim()) {
    query.$or = [
      { subject: { $regex: search.trim(), $options: "i" } },
      { message: { $regex: search.trim(), $options: "i" } },
      { response: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const queries = await Query.find(query)
    .populate("resolvedBy", "name email") // Admin who resolved it
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Query.countDocuments(query);

  res.status(200).json({
    success: true,
    count: queries.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: queries,
  });
});

// Get a specific query by ID (only if it belongs to the user)
exports.getUserQueryById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const query = await Query.findOne({
    _id: id,
    user_id: req.user._id,
  }).populate("resolvedBy", "name email");

  if (!query) {
    return res.status(404).json({
      success: false,
      message: "Query not found",
    });
  }

  res.status(200).json({
    success: true,
    data: query,
  });
});

// Delete a query (only if it's open and belongs to the user)
exports.deleteUserQuery = catchAsync(async (req, res) => {
  const { id } = req.params;

  const query = await Query.findOne({
    _id: id,
    user_id: req.user._id,
  });

  if (!query) {
    return res.status(404).json({
      success: false,
      message: "Query not found",
    });
  }

  // Only allow deletion of open queries
  if (query.status !== "open") {
    return res.status(400).json({
      success: false,
      message: "Only open queries can be deleted",
    });
  }

  await Query.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Query deleted successfully",
  });
});
exports.updateOverdueFines = catchAsync(async (req, res) => {
  const updated = await performOverdueFineUpdate();

  res.status(200).json({
    success: true,
    message: `${updated} overdue fine(s) updated.`,
  });
});
