const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const Feedback = require("../models/Feedback"); // Assuming you have this model
const catchAsync = require("../utils/catchAsync");
const Query = require("../models/Query");

// ===================
// QUERY MANAGEMENT
// ===================

// 1. View all feedback/queries
exports.getAllQueries = catchAsync(async (req, res) => {
  const { status, type, priority, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  // Build query object conditionally
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  const queries = await Query.find(query)
    .populate("user_id", "name email contact")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    count: queries.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: queries,
  });
});

// 2. View single query details
exports.getQueryDetails = catchAsync(async (req, res) => {
  const { id } = req.params;

  const query = await Query.findById(id).populate(
    "user_id",
    "name email contact"
  );

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

// 3. Resolve/Update query status
exports.updateQueryStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, response, notes } = req.body;

  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Must be one of: " + validStatuses.join(", "),
    });
  }

  const updateData = {
    status,
    updatedAt: new Date(),
    resolvedBy: req.user._id, // Librarian who resolved it
  };

  if (response) updateData.response = response.trim();
  if (notes) updateData.notes = notes.trim();
  if (status === "resolved" || status === "closed") {
    updateData.updatedAt = new Date();
  }

  const updatedQuery = await Query.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("user_id", "name email contact");

  if (!updatedQuery) {
    return res.status(404).json({
      success: false,
      message: "Query not found",
    });
  }

  // Send notification to user if query is resolved
  if (status === "resolved" && response) {
    await Notification.create({
      user_id: updatedQuery.user_id._id,
      title: "Query Resolved",
      message: `Your query "${updatedQuery.subject}" has been resolved. Response: ${response}`,
      type: "query_resolved",
    });
  }

  res.status(200).json({
    success: true,
    message: "Query updated successfully",
    data: updatedQuery,
  });
});

// ===================
// BORROW MANAGEMENT
// ===================

// 4. View all borrow requests
exports.getAllBorrowRequests = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;

  const requests = await Borrow.find(query)
    .populate("user_id", "name email contact")
    .populate("book_id", "title author ")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Borrow.countDocuments(query);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: requests,
  });
});

// 5. Update borrow status (approve/reject/issue/return)
exports.updateBorrowStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, notes, dueDate, returnDate } = req.body;

  const validStatuses = [
    "pending",
    "approved",
    "rejected",
    "issued",
    "returned",
    "overdue",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Must be one of: " + validStatuses.join(", "),
    });
  }

  const borrow = await Borrow.findById(id).populate("user_id book_id");
  if (!borrow) {
    return res.status(404).json({
      success: false,
      message: "Borrow record not found",
    });
  }

  const updateData = {
    status,
    updatedAt: new Date(),
    processedBy: req.user._id, // Librarian who processed it
  };

  if (notes) updateData.notes = notes.trim();

  // Handle specific status transitions
  switch (status) {
    case "approved":
      updateData.approvedAt = new Date();
      if (dueDate) updateData.dueDate = new Date(dueDate);
      break;
    case "issued":
      updateData.issuedAt = new Date();
      if (dueDate) updateData.dueDate = new Date(dueDate);
      // Decrease book quantity
      await Book.findByIdAndUpdate(borrow.book_id._id, {
        $inc: { availableQuantity: -1 },
      });
      break;
    case "returned":
      updateData.returnDate = returnDate ? new Date(returnDate) : new Date();
      // Increase book quantity
      await Book.findByIdAndUpdate(borrow.book_id._id, {
        $inc: { availableQuantity: 1 },
      });
      break;
    case "rejected":
      updateData.rejectedAt = new Date();
      break;
  }

  const updatedBorrow = await Borrow.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("user_id book_id");

  // Send notification to user
  const notificationMessages = {
    approved: "Your book request has been approved",
    rejected: "Your book request has been rejected",
    issued: "Your book has been issued successfully",
    returned: "Book return confirmed",
  };

  if (notificationMessages[status]) {
    await Notification.create({
      user_id: borrow.user_id._id,
      title: "Book Request Update",
      message: `${notificationMessages[status]}: "${borrow.book_id.title}"`,
      type: "borrow_update",
    });
  }

  res.status(200).json({
    success: true,
    message: "Borrow status updated successfully",
    data: updatedBorrow,
  });
});

// 6. Process renewal requests
exports.processRenewalRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { action, newDueDate, notes } = req.body; // action: 'approve' or 'reject'

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "Action must be either 'approve' or 'reject'",
    });
  }

  const borrow = await Borrow.findById(id).populate("user_id book_id");
  if (!borrow || borrow.status !== "renew_requested") {
    return res.status(404).json({
      success: false,
      message: "Renewal request not found or already processed",
    });
  }

  const updateData = {
    processedBy: req.user._id,
    renewalProcessedAt: new Date(),
  };

  if (notes) updateData.notes = notes;

  if (action === "approve") {
    updateData.status = "renewed";
    updateData.dueDate = newDueDate
      ? new Date(newDueDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
    updateData.renewalCount = (borrow.renewalCount || 0) + 1;
  } else {
    updateData.status = borrow.previousStatus || "issued"; // Revert to previous status
    updateData.renewalRequestDate = null;
  }

  const updatedBorrow = await Borrow.findByIdAndUpdate(id, updateData, {
    new: true,
  });

  // Send notification
  await Notification.create({
    user_id: borrow.user_id._id,
    title: "Renewal Request Update",
    message: `Your renewal request for "${borrow.book_id.title}" has been ${action}ed`,
    type: "renewal_update",
  });

  res.status(200).json({
    success: true,
    message: `Renewal request ${action}ed successfully`,
    data: updatedBorrow,
  });
});

// ===================
// BOOK MANAGEMENT (CRUD)
// ===================

// 7. Get all books with filters
exports.getAllBooks = catchAsync(async (req, res) => {
  const {
    search,
    category,
    author,
    availability,
    page = 1,
    limit = 10,
  } = req.query;
  const skip = (page - 1) * limit;

  // Build query object
  const query = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { author: { $regex: search, $options: "i" } },
    ];
  }
  if (category) query.category = category;
  if (author) query.author = { $regex: author, $options: "i" };
  if (availability === "available") query.availableQuantity = { $gt: 0 };
  if (availability === "unavailable") query.availableQuantity = { $lte: 0 };

  const books = await Book.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Book.countDocuments(query);

  res.status(200).json({
    success: true,
    count: books.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: books,
  });
});

// 8. Get single book details
exports.getBookDetails = catchAsync(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    return res.status(404).json({
      success: false,
      message: "Book not found",
    });
  }

  // Get borrowing statistics for this book
  const borrowStats = await Borrow.aggregate([
    { $match: { book_id: book._id } },
    {
      $group: {
        _id: null,
        totalBorrows: { $sum: 1 },
        currentlyBorrowed: {
          $sum: { $cond: [{ $in: ["$status", ["issued", "renewed"]] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$dueDate", new Date()] },
                  { $in: ["$status", ["issued", "renewed"]] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...book.toObject(),
      borrowStats: borrowStats[0] || {
        totalBorrows: 0,
        currentlyBorrowed: 0,
        overdue: 0,
      },
    },
  });
});

// 9. Create new book
exports.addBook = async (req, res) => {
  try {
    const { title, category, author, total_copies, available_copies } =
      req.body;

    if (!title || !author || !total_copies) {
      return res
        .status(400)
        .json({ error: "Title, author, and total_copies are required" });
    }

    const newBook = new Book({
      title,
      category,
      author,
      total_copies: Number(total_copies),
      available_copies: available_copies
        ? Number(available_copies)
        : Number(total_copies),
      cover_image_url: req.file ? `/uploads/${req.file.filename}` : null,
      addedBy: req.user._id, // if you want to track who added it
    });

    await newBook.save();

    res.status(201).json({
      success: true,
      message: "Book added successfully",
      data: newBook,
    });
  } catch (err) {
    console.error("Error adding book:", err);
    res.status(500).json({ error: err.message });
  }
};

// 10. Update book
exports.updateBook = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove fields that shouldn't be updated directly
  delete updateData.availableQuantity; // This should be calculated
  delete updateData.addedBy;

  const book = await Book.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!book) {
    return res.status(404).json({
      success: false,
      message: "Book not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Book updated successfully",
    data: book,
  });
});

// 11. Delete book
exports.deleteBook = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Check if book has active borrows
  const activeBorrows = await Borrow.countDocuments({
    book_id: id,
    status: { $in: ["issued", "renewed", "approved"] },
  });

  if (activeBorrows > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete book with active borrows",
    });
  }

  const book = await Book.findByIdAndDelete(id);
  if (!book) {
    return res.status(404).json({
      success: false,
      message: "Book not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Book deleted successfully",
  });
});

// ===================
// NOTIFICATION MANAGEMENT
// ===================

// 12. Send notification/reminder to users
exports.sendNotification = catchAsync(async (req, res) => {
  const { userIds, title, message, type = "general" } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: "Title and message are required",
    });
  }

  let targetUsers = [];

  if (userIds && userIds.length > 0) {
    // Send to specific users
    targetUsers = userIds;
  } else {
    // Send to all users
    const allUsers = await User.find({}, "_id");
    targetUsers = allUsers.map((user) => user._id);
  }

  // Create notifications for all target users
  const notifications = targetUsers.map((userId) => ({
    user_id: userId,
    title,
    message,
    type,
    sentBy: req.user._id,
  }));

  await Notification.insertMany(notifications);

  res.status(200).json({
    success: true,
    message: `Notification sent to ${targetUsers.length} users`,
    count: targetUsers.length,
  });
});

// 13. Send overdue reminders
exports.sendOverdueReminders = catchAsync(async (req, res) => {
  const overdueBooks = await Borrow.find({
    dueDate: { $lt: new Date() },
    status: { $in: ["issued", "renewed"] },
  }).populate("user_id book_id");

  const notifications = overdueBooks.map((borrow) => ({
    user_id: borrow.user_id._id,
    title: "Overdue Book Reminder",
    message: `Your book "${borrow.book_id.title}" is overdue. Please return it as soon as possible to avoid additional fines.`,
    type: "overdue_reminder",
    sentBy: req.user._id,
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  res.status(200).json({
    success: true,
    message: `Overdue reminders sent to ${notifications.length} users`,
    count: notifications.length,
  });
});

// 14. Send due date reminders
exports.sendDueDateReminders = catchAsync(async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const dueSoonBooks = await Borrow.find({
    dueDate: { $lte: tomorrow, $gte: new Date() },
    status: { $in: ["issued", "renewed"] },
  }).populate("user_id book_id");

  const notifications = dueSoonBooks.map((borrow) => ({
    user_id: borrow.user_id._id,
    title: "Book Due Tomorrow",
    message: `Your book "${
      borrow.book_id.title
    }" is due tomorrow (${borrow.dueDate.toDateString()}). Please return or renew it.`,
    type: "due_reminder",
    sentBy: req.user._id,
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  res.status(200).json({
    success: true,
    message: `Due date reminders sent to ${notifications.length} users`,
    count: notifications.length,
  });
});

// ===================
// REPORTS & ANALYTICS
// ===================

// 15. Dashboard summary for librarian
exports.getLibrarianDashboard = catchAsync(async (req, res) => {
  const [
    totalBooks,
    totalUsers,
    activeBorrows,
    overdueBooks,
    pendingRequests,
    totalFines,
    openQueries,
    todayReturns,
  ] = await Promise.all([
    Book.countDocuments(),
    User.countDocuments({ role: "user" }),
    Borrow.countDocuments({ status: { $in: ["issued", "renewed"] } }),
    Borrow.countDocuments({
      status: { $in: ["issued", "renewed"] },
      dueDate: { $lt: new Date() },
    }),
    Borrow.countDocuments({ status: "pending" }),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Feedback.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    Borrow.countDocuments({
      status: "returned",
      returnDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalBooks,
      totalUsers,
      activeBorrows,
      overdueBooks,
      pendingRequests,
      totalFines: totalFines[0]?.total || 0,
      openQueries,
      todayReturns,
    },
  });
});

// 16. Most borrowed books report
exports.getMostBorrowedBooks = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const mostBorrowed = await Borrow.aggregate([
    {
      $group: {
        _id: "$book_id",
        borrowCount: { $sum: 1 },
        currentlyBorrowed: {
          $sum: { $cond: [{ $in: ["$status", ["issued", "renewed"]] }, 1, 0] },
        },
        totalReturned: {
          $sum: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] },
        },
      },
    },
    { $sort: { borrowCount: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "books",
        localField: "_id",
        foreignField: "_id",
        as: "bookDetails",
      },
    },
    { $unwind: "$bookDetails" },
  ]);

  res.status(200).json({
    success: true,
    count: mostBorrowed.length,
    data: mostBorrowed,
  });
});

// 17. Overdue items report
exports.getOverdueReport = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const overdueItems = await Borrow.find({
    dueDate: { $lt: new Date() },
    status: { $in: ["issued", "renewed"] },
  })
    .populate("user_id", "name email contact")
    .populate("book_id", "title author")
    .sort({ dueDate: 1 }) // Most overdue first
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Borrow.countDocuments({
    dueDate: { $lt: new Date() },
    status: { $in: ["issued", "renewed"] },
  });

  // Calculate days overdue for each item
  const overdueWithDays = overdueItems.map((item) => ({
    ...item.toObject(),
    daysOverdue: Math.floor(
      (new Date() - new Date(item.dueDate)) / (1000 * 60 * 60 * 24)
    ),
  }));

  res.status(200).json({
    success: true,
    count: overdueItems.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: overdueWithDays,
  });
});

// 18. Fine collection report
exports.getFineReport = catchAsync(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const fines = await Payment.find(query)
    .populate("user_id", "name email contact")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(query);

  // Get summary statistics
  const summary = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalCount: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: fines.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    summary: summary[0] || { totalAmount: 0, totalCount: 0, averageAmount: 0 },
    data: fines,
  });
});

// 19. Monthly borrow statistics
exports.getMonthlyBorrowStats = catchAsync(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const monthlyStats = await Borrow.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        totalBorrows: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        issued: { $sum: { $cond: [{ $eq: ["$status", "issued"] }, 1, 0] } },
        returned: { $sum: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  // Fill in missing months with zero values
  const completeStats = [];
  for (let month = 1; month <= 12; month++) {
    const existingStat = monthlyStats.find((stat) => stat._id.month === month);
    completeStats.push(
      existingStat || {
        _id: { month },
        totalBorrows: 0,
        approved: 0,
        issued: 0,
        returned: 0,
        rejected: 0,
      }
    );
  }

  res.status(200).json({
    success: true,
    year: parseInt(year),
    data: completeStats,
  });
});

// 20. User activity report
exports.getUserActivityReport = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const userActivity = await User.aggregate([
    { $match: { role: "user" } },
    {
      $lookup: {
        from: "borrows",
        localField: "_id",
        foreignField: "user_id",
        as: "borrows",
      },
    },
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "user_id",
        as: "payments",
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        contact: 1,
        createdAt: 1,
        totalBorrows: { $size: "$borrows" },
        activeBorrows: {
          $size: {
            $filter: {
              input: "$borrows",
              cond: { $in: ["$$this.status", ["issued", "renewed"]] },
            },
          },
        },
        overdueBorrows: {
          $size: {
            $filter: {
              input: "$borrows",
              cond: {
                $and: [
                  { $in: ["$$this.status", ["issued", "renewed"]] },
                  { $lt: ["$$this.dueDate", new Date()] },
                ],
              },
            },
          },
        },
        totalFines: { $sum: "$payments.amount" },
        lastActivity: { $max: "$borrows.createdAt" },
      },
    },
    { $sort: { totalBorrows: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
  ]);

  const total = await User.countDocuments({ role: "user" });

  res.status(200).json({
    success: true,
    count: userActivity.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: userActivity,
  });
});
