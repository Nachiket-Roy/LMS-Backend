const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
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
    resolvedBy: req.user._id, // Librarian who resolved it
  };

  if (response) updateData.response = response.trim();
  if (notes) updateData.notes = notes.trim();

  // ✅ Set resolvedAt only if resolved or closed
  if (status === "resolved" || status === "closed") {
    updateData.resolvedAt = new Date();
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

  // ✅ Send notification if resolved
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
  if (status && status !== "all") {
    query.status = status;
  }

  const requests = await Borrow.find(query)
    .populate("user_id", "name email contact")
    .populate("book_id", "title author")
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
  if (!req.user || !req.user._id) {
    console.error("❌ req.user is missing");
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing user info",
    });
  }

  // Fixed: Use correct status values from your schema
  const validStatuses = [
    "requested",
    "approved",
    "rejected",
    "borrowed", // instead of "issued"
    "returned",
    "renewed",
    "renew_requested",
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
    processedBy: req.user._id,
  };

  if (notes) updateData.notes = notes.trim();

  // Handle specific status transitions
  switch (status) {
    case "approved":
      updateData.approvedAt = new Date();
      updateData.issueDate = new Date(); // Set issue date when approved
      if (dueDate) updateData.dueDate = new Date(dueDate);
      else {
        // Set default due date (14 days from now)
        updateData.dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }
      break;
    case "borrowed": // instead of "issued"
      updateData.issueDate = new Date();
      if (dueDate) updateData.dueDate = new Date(dueDate);
      // Decrease book quantity
      await Book.findByIdAndUpdate(borrow.book_id._id, {
        $inc: { availableCopies: -1 },
      });
      break;
    case "returned":
      updateData.returnDate = returnDate ? new Date(returnDate) : new Date();
      // Increase book quantity
      await Book.findByIdAndUpdate(borrow.book_id._id, {
        $inc: { availableCopies: 1 },
      });
      break;
    case "rejected":
      updateData.rejectedAt = new Date();
      if (notes) updateData.rejectionReason = notes.trim();
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
    borrowed: "Your book has been issued successfully",
    returned: "Book return confirmed",
  };
  if (!borrow.book_id || !borrow.book_id.title) {
    console.error("❌ book_id missing or not populated");
  }
  console.log("🟢 Update data:", updateData);
  console.log("📦 Borrow.user_id:", borrow.user_id);
  console.log("📖 Borrow.book_id:", borrow.book_id);

  // Send notification to user
  if (notificationMessages[status]) {
    try {
      await Notification.create({
        user_id: borrow.user_id._id,
        title: "Book Request Update",
        message: `${notificationMessages[status]}: "${borrow.book_id.title}"`,
        type: "borrow_update",
        sentBy: req.user._id, // optional
      });
    } catch (notifError) {
      console.error("❌ Failed to send notification:", notifError.message);
      // Don't crash the request — let it continue
    }
  }

  res.status(200).json({
    success: true,
    message: "Borrow status updated successfully",
    data: updatedBorrow,
  });
});
exports.processRenewalRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { action, newDueDate, notes } = req.body;

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

  borrow.renewalProcessedAt = new Date();
  borrow.processedBy = req.user._id;
  if (notes) borrow.notes = notes;

  if (action === "approve") {
    borrow.status = "approve";
    borrow.dueDate = newDueDate
      ? new Date(newDueDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    borrow.renewCount = (borrow.renewCount || 0) + 1;
    borrow.renewalRequestDate = null;
  } else if (action === "reject") {
    borrow.status = "approved"; // Or "approved" depending on your flow
    borrow.renewalRequestDate = null;
  }

  await borrow.save();

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
    data: borrow,
  });
});
//========= BOOK MANAGEMENT (CRUD) ===================

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

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (search?.trim()) {
    query.$or = [
      { title: { $regex: search.trim(), $options: "i" } },
      { author: { $regex: search.trim(), $options: "i" } },
    ];
  }

  if (category) query.category = category;
  if (author) query.author = { $regex: author, $options: "i" };
  if (availability === "available") query.availableCopies = { $gt: 0 };
  if (availability === "unavailable") query.availableCopies = { $lte: 0 };

  const books = await Book.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await Book.countDocuments(query);

  res.status(200).json({
    success: true,
    count: books.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
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
          $sum: {
            $cond: [{ $in: ["$status", ["borrowed", "renewed"]] }, 1, 0],
          },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$dueDate", new Date()] },
                  { $in: ["$status", ["borrowed", "renewed"]] },
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
      ...book.toObject({ virtuals: true }),
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
    const { title, author, category, totalCopies, availableCopies } = req.body;

    if (!title || !author || !totalCopies) {
      return res.status(400).json({
        error: "Title, author, and totalCopies are required",
      });
    }

    const newBook = new Book({
      title,
      author,
      category,
      totalCopies: Number(totalCopies),
      availableCopies: availableCopies
        ? Number(availableCopies)
        : Number(totalCopies),
      coverImagePath: req.file ? `/uploads/${req.file.filename}` : null,
      addedBy: req.user._id,
    });

    await newBook.save();

    res.status(201).json({
      success: true,
      message: "Book added successfully",
      data: newBook,
    });
  } catch (err) {
    console.error("❌ Error in addBook:", err);
    res.status(500).json({ error: err.message });
  }
};

// 10. Update book
exports.updateBook = catchAsync(async (req, res) => {
  const { id } = req.params;

  console.log("📦 UpdateBook req.body:", req.body);
  console.log("📷 UpdateBook req.file:", req.file);

  const updateData = req.body;

  // Don't allow certain fields to be changed
  delete updateData.availableCopies;
  delete updateData.addedBy;

  if (req.file) {
    updateData.coverImagePath = `/uploads/${req.file.filename}`;
  }

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
    status: { $in: ["borrowed", "renewed", "approved"] },
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
  try {
    const { userIds, subject, message, type } = req.body;
    const title = subject;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    let targetUsers = [];

    if (Array.isArray(userIds) && userIds.length > 0) {
      targetUsers = userIds;
    } else {
      const allUsers = await User.find({}, "_id");
      if (!allUsers || allUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No users found to send notification",
        });
      }
      targetUsers = allUsers.map((user) => user._id);
    }

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
      message: `Notification sent to ${targetUsers.length} user(s)`,
      count: targetUsers.length,
    });
  } catch (error) {
    console.error("❌ sendNotification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while sending notifications",
    });
  }
});

// 13. Send overdue reminders
exports.sendOverdueReminders = catchAsync(async (req, res) => {
  try {
    const overdueBooks = await Borrow.find({
      dueDate: { $lt: new Date() },
      status: { $in: ["approved", "borrowed", "renewed"] }, // Fixed status values
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
  } catch (error) {
    console.error("❌ Failed to send overdue reminders:", error); // <- log this
    res.status(500).json({
      success: false,
      message: "Server error while sending overdue reminders",
    });
  }
});

// 14. Send due date reminders
// Fixed sendDueDateReminders
exports.sendDueDateReminders = catchAsync(async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const dueSoonBooks = await Borrow.find({
    dueDate: { $lte: tomorrow, $gte: new Date() },
    status: { $in: ["approved", "borrowed", "renewed"] }, // Fixed status values
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
// Fixed getLibrarianDashboard with correct status values
exports.getLibrarianDashboard = catchAsync(async (req, res) => {
  const currentDate = new Date();

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
    // Fixed: Use correct status values from your schema
    Borrow.countDocuments({
      status: { $in: ["approved", "borrowed", "renewed"] },
    }),
    // Fixed: Use correct status values for overdue books
    Borrow.countDocuments({
      status: { $in: ["approved", "borrowed", "renewed"] },
      dueDate: { $lt: currentDate },
    }),
    // Fixed: Use "requested" instead of "pending"
    Borrow.countDocuments({ status: "requested" }),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Query.countDocuments({ status: { $in: ["open", "in_progress"] } }),
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
          $sum: {
            $cond: [{ $in: ["$status", ["borrowed", "renewed"]] }, 1, 0],
          },
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

  // Fixed: Use correct status values
  const overdueItems = await Borrow.find({
    dueDate: { $lt: new Date() },
    status: { $in: ["approved", "borrowed", "renewed"] },
  })
    .populate("user_id", "name email contact")
    .populate("book_id", "title author")
    .sort({ dueDate: 1 }) // Most overdue first
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Borrow.countDocuments({
    dueDate: { $lt: new Date() },
    status: { $in: ["approved", "borrowed", "renewed"] },
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
