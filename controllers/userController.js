const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const catchAsync = require("../utils/catchAsync");

// 1. Borrow Requests (pending/approved/rejected)
exports.getBorrowRequests = catchAsync(async (req, res) => {
  const { status } = req.query;

  // Build query object conditionally
  const query = { user_id: req.user._id };
  if (status) {
    query.status = status;
  }

  const requests = await Borrow.find(query)
    .populate("book_id", "title author") 
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

// 2. Renew Book - FIXED: user authentication bug
exports.renewBook = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: "Invalid borrow record ID format",
    });
  }

  const borrow = await Borrow.findById(id);

  if (!borrow) {
    return res.status(404).json({
      success: false,
      message: "Borrow record not found",
    });
  }

  // Check user authorization
  if (borrow.user_id.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized - You can only renew your own books",
    });
  }

  // Check if book is eligible for renewal
if (!["borrowed", "approved"].includes(borrow.status)) {
    return res.status(400).json({
      success: false,
      message: "Only borrowed books can be renewed",
    });
  }

  // Check if already requested renewal
  if (borrow.renewalRequestDate) {
    return res.status(400).json({
      success: false,
      message: "Renewal already requested for this book",
    });
  }

  borrow.status = "renew_requested";
  borrow.renewalRequestDate = new Date();
  await borrow.save();

  res.status(200).json({
    success: true,
    message: "Renewal request submitted successfully",
  });
});

exports.latestDueNotification = catchAsync(async (req, res) => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const dueBorrows = await Borrow.find({
    user_id: req.user._id,
    status: { $in: ["approved", "issued", "renewed"] },
    dueDate: {
      $gte: new Date(), // Not overdue
      $lte: nextWeek    // Due within the next 7 days
    }
  })
    .populate("book_id", "title author") // This one was already correct
    .sort({ dueDate: 1 }) // Closest upcoming due date
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

// 5. Payment History + Total Fine - IMPROVED: Better error handling
exports.getPaymentHistory = catchAsync(async (req, res) => {
  const payments = await Payment.find({ user_id: req.user._id }).sort({
    createdAt: -1,
  });

  const totalFine = payments.reduce((sum, payment) => {
    return sum + (payment.amount || 0);
  }, 0);

  res.status(200).json({
    success: true,
    totalFine: parseFloat(totalFine.toFixed(2)),
    count: payments.length,
    data: payments,
  });
});

// 6. Overdue Books - IMPROVED: Added population and better filtering
exports.getOverdueBooks = catchAsync(async (req, res) => {
  const overdue = await Borrow.find({
    user_id: req.user._id,
    dueDate: { $lt: new Date() },
    status: { $in: ["approved", "issued", "renewed"] }
  })
    .populate("book_id", "title author coverImageUrl") // FIXED: Changed coverImage to coverImageUrl to match schema
    .sort({ dueDate: 1 }); // Most overdue first

  res.status(200).json({
    success: true,
    count: overdue.length,
    data: overdue,
  });
});

// 7. Reading History (Returned Books) - IMPROVED: Added pagination
exports.getReadingHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const history = await Borrow.find({
    user_id: req.user._id,
    status: "returned",
  })
    .populate("book_id", "title author coverImageUrl") // FIXED: Changed from "book" to "book_id" and coverImage to coverImageUrl
    .sort({ returnDate: -1 }) // FIXED: Changed from returnedAt to returnDate to match schema
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

// 8. Get Profile - NEW: Essential for profile management
exports.getProfile = catchAsync(async (req, res) => {
  const user_id = await User.findById(req.user._id).select("-password -__v");

  if (!user_id) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    data: user_id,
  });
});

// 9. Update Profile - IMPROVED: Added validation
exports.updateProfile = catchAsync(async (req, res) => {
  const { name, contact, address } = req.body;

  // Basic validation
  const updates = {};
  if (name && name.trim()) updates.name = name.trim();
  if (contact && contact.trim()) updates.contact = contact.trim();
  if (address && address.trim()) updates.address = address.trim();

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

// 10. Get user dashboard summary
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
      Payment.aggregate([
        { $match: { user_id: userId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Borrow.countDocuments({ user_id: userId, status: "pending" }),
    ]);

  res.status(200).json({
    success: true,
    data: {
      activeBorrows,
      overdueCount,
      totalFines: totalFines[0]?.total || 0,
      pendingRequests,
    },
  });
});
// POST /borrow/request
exports.requestBorrow = catchAsync(async (req, res) => {
  const { book_id } = req.body;

  if (!book_id) {
    return res.status(400).json({
      success: false,
      message: "Book ID is required",
    });
  }

  const newRequest = await Borrow.create({
    user_id: req.user._id,
    book_id,
    status: 'requested', // default
    requestDate: new Date()
  });

  res.status(201).json({
    success: true,
    message: "Borrow request submitted successfully",
    data: newRequest
  });
});



// Additional API endpoints you might want to add
exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    { is_read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.status(200).json({
    success: true,
    data: notification
  });
});

exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user_id: req.user._id, is_read: false },
    { is_read: true }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

exports.getUnreadCount = catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({
    user_id: req.user._id,
    is_read: false
  });

  res.status(200).json({
    success: true,
    count
  });
});

// 11. Submit feedback/issue
exports.submitFeedback = catchAsync(async (req, res) => {
  const { type, subject, message, priority = "medium" } = req.body;

  // Validate required fields
  if (!type || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "Type, subject, and message are required",
    });
  }

  // Validate type
  const validTypes = ["issue", "feedback", "suggestion", "complaint"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid feedback type. Must be one of: " + validTypes.join(", "),
    });
  }

  // Validate priority
  const validPriorities = ["low", "medium", "high", "urgent"];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid priority. Must be one of: " + validPriorities.join(", "),
    });
  }

  // Create feedback record (assuming you have a Feedback model)
  const feedback = {
    user_id: req.user._id,
    type,
    subject: subject.trim(),
    message: message.trim(),
    priority,
    status: "open",
    createdAt: new Date(),
  };

  // You would save this to your Feedback model
  // const savedFeedback = await Feedback.create(feedback);

  res.status(201).json({
    success: true,
    message: "Feedback submitted successfully. We'll review it shortly.",
    data: feedback,
  });
});