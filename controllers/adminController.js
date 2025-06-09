const User = require("../models/User");
const Borrow = require("../models/Borrow");
const Payment = require("../models/Payment");
const Notification = require("../models/Notification");
const catchAsync = require("../utils/catchAsync");

// ==================== USER MANAGEMENT ====================

// 1. Get all users with filters and pagination
exports.getAllUsers = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    search 
  } = req.query;
  
  const skip = (page - 1) * limit;

  const query = {
    role: "user" 
  };
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select("-password -__v")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: users,
  });
});

// 2. Get user by ID with detailed info
exports.getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID format",
    });
  }

  const user = await User.findById(id).select("-password -__v");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Get user statistics
  const [activeBorrows, totalBorrows, overdueBooks, totalFines] = await Promise.all([
    Borrow.countDocuments({ user_id: id, status: { $in: ["approved", "issued", "renewed"] } }),
    Borrow.countDocuments({ user_id: id }),
    Borrow.countDocuments({
      user_id: id,
      status: { $in: ["approved", "issued", "renewed"] },
      dueDate: { $lt: new Date() }
    }),
    Payment.aggregate([
      { $match: { user_id: user._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);

  const userWithStats = {
    ...user.toObject(),
    statistics: {
      activeBorrows,
      totalBorrows,
      overdueBooks,
      totalFines: totalFines[0]?.total || 0
    }
  };

  res.status(200).json({
    success: true,
    data: userWithStats,
  });
});

// 6. Permanently delete user
exports.deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  await User.deleteOne({ _id: id });

  res.status(200).json({ success: true, message: "User deleted successfully" });
});

// ==================== LIBRARIAN MANAGEMENT ====================

// 7. Get all librarians
exports.getAllLibrarians = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const skip = (page - 1) * limit;

  // Build query for librarians
  const query = { role: "librarian" };
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } }
    ];
  }

  const librarians = await User.find(query)
    .select("-password -__v")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: librarians.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: librarians,
  });
});



// ==================== DASHBOARD & ANALYTICS ====================

// 10. Admin dashboard summary
exports.getAdminDashboard = catchAsync(async (req, res) => {
  const [
    totalUsers,
    totalLibrarians,
    activeUsers,
    suspendedUsers,
    totalBorrows,
    activeBorrows,
    overdueBooks,
    totalFines
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "librarian" }),
    User.countDocuments({ role: "user", status: "active" }),
    User.countDocuments({ role: "user", status: "suspended" }),
    Borrow.countDocuments(),
    Borrow.countDocuments({ status: { $in: ["approved", "issued", "renewed"] } }),
    Borrow.countDocuments({
      status: { $in: ["approved", "issued", "renewed"] },
      dueDate: { $lt: new Date() }
    }),
    Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers
      },
      librarians: {
        total: totalLibrarians
      },
      borrows: {
        total: totalBorrows,
        active: activeBorrows,
        overdue: overdueBooks
      },
      finances: {
        totalFines: totalFines[0]?.total || 0
      }
    },
  });
});

// 11. User activity logs (last 30 days)
exports.getUserActivityLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, userId } = req.query;
  const skip = (page - 1) * limit;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const query = { createdAt: { $gte: thirtyDaysAgo } };
  if (userId) query.user_id = userId;

  // Get recent borrows as activity logs
  const activities = await Borrow.find(query)
    .populate("user_id", "name email")
    .populate("book_id", "title author")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Borrow.countDocuments(query);

  res.status(200).json({
    success: true,
    count: activities.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: activities,
  });
});
