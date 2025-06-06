const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const Feedback = require("../models/Feedback");
const Query = require("../models/Query"); // Assuming you have a Query model
const Category = require("../models/Category"); // For book categories
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Settings = require("../models/Settings");


// ==================== ENHANCED FINE REPORTS ====================

// 1. Comprehensive Fine Analytics
exports.getFineAnalytics = catchAsync(async (req, res) => {
  const { period = 'month', year = new Date().getFullYear() } = req.query;
  
  let groupBy, dateFormat;
  switch (period) {
    case 'week':
      groupBy = { $week: '$createdAt' };
      dateFormat = 'Week %U';
      break;
    case 'month':
      groupBy = { $month: '$createdAt' };
      dateFormat = 'Month %m';
      break;
    case 'quarter':
      groupBy = { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } };
      dateFormat = 'Quarter %d';
      break;
    default:
      groupBy = { $month: '$createdAt' };
      dateFormat = 'Month %m';
  }
  
  const analytics = await Payment.aggregate([
    {
      $match: {
        type: 'fine',
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: {
          period: groupBy,
          status: '$status'
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $group: {
        _id: '$_id.period',
        data: {
          $push: {
            status: '$_id.status',
            totalAmount: '$totalAmount',
            count: '$count',
            avgAmount: '$avgAmount'
          }
        },
        totalPeriodAmount: { $sum: '$totalAmount' },
        totalPeriodCount: { $sum: '$count' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  // Get top defaulters
  const topDefaulters = await Payment.aggregate([
    {
      $match: {
        type: 'fine',
        status: 'pending',
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: '$user',
        totalFines: { $sum: '$amount' },
        fineCount: { $sum: 1 }
      }
    },
    { $sort: { totalFines: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $project: {
        totalFines: 1,
        fineCount: 1,
        userName: { $arrayElemAt: ['$userInfo.name', 0] },
        userEmail: { $arrayElemAt: ['$userInfo.email', 0] }
      }
    }
  ]);
  
  // Fine collection efficiency
  const collectionStats = await Payment.aggregate([
    {
      $match: {
        type: 'fine',
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      analytics,
      topDefaulters,
      collectionStats,
      period,
      year
    }
  });
});

// 2. Export Fine Report
exports.exportFineReport = catchAsync(async (req, res) => {
  const { format = 'pdf', startDate, endDate, includeDetails = true } = req.query;
  
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  
  const fineData = await Payment.aggregate([
    { $match: { type: 'fine', ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $lookup: {
        from: 'borrows',
        localField: 'borrow',
        foreignField: '_id',
        as: 'borrowInfo'
      }
    },
    {
      $lookup: {
        from: 'books',
        localField: 'borrowInfo.book',
        foreignField: '_id',
        as: 'bookInfo'
      }
    },
    {
      $project: {
        amount: 1,
        status: 1,
        createdAt: 1,
        description: 1,
        userName: { $arrayElemAt: ['$userInfo.name', 0] },
        userEmail: { $arrayElemAt: ['$userInfo.email', 0] },
        bookTitle: { $arrayElemAt: ['$bookInfo.title', 0] },
        bookAuthor: { $arrayElemAt: ['$bookInfo.author', 0] }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
  
  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Fine Report');
    
    // Add headers
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'Book Title', key: 'bookTitle', width: 30 },
      { header: 'Book Author', key: 'bookAuthor', width: 20 },
      { header: 'Amount', key: 'amount', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description', key: 'description', width: 40 }
    ];
    
    // Add data
    fineData.forEach(fine => {
      worksheet.addRow({
        date: fine.createdAt.toLocaleDateString(),
        userName: fine.userName,
        userEmail: fine.userEmail,
        bookTitle: fine.bookTitle,
        bookAuthor: fine.bookAuthor,
        amount: fine.amount,
        status: fine.status,
        description: fine.description
      });
    });
    
    // Style the worksheet
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fine-report.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } else {
    // PDF format
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fine-report.pdf"');
    
    doc.pipe(res);
    
    // Add title
    doc.fontSize(20).text('Fine Report', { align: 'center' });
    doc.moveDown();
    
    // Add summary
    const totalAmount = fineData.reduce((sum, fine) => sum + fine.amount, 0);
    const paidAmount = fineData.filter(f => f.status === 'paid').reduce((sum, fine) => sum + fine.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    
    doc.fontSize(12)
       .text(`Total Fines: $${totalAmount}`)
       .text(`Paid: $${paidAmount}`)
       .text(`Pending: $${pendingAmount}`)
       .moveDown();
    
    // Add details if requested
    if (includeDetails === 'true') {
      doc.text('Fine Details:', { underline: true });
      doc.moveDown();
      
      fineData.forEach(fine => {
        doc.fontSize(10)
           .text(`${fine.createdAt.toLocaleDateString()} - ${fine.userName} - ${fine.bookTitle} - $${fine.amount} (${fine.status})`);
      });
    }
    
    doc.end();
  }
});

// ==================== ENHANCED USER MANAGEMENT ====================

// 3. Bulk User Operations
exports.bulkUserOperations = catchAsync(async (req, res) => {
  const { action, userIds, data } = req.body;
  
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "User IDs array is required"
    });
  }
  
  let result;
  switch (action) {
    case 'activate':
      result = await User.updateMany(
        { _id: { $in: userIds } },
        { status: 'active', updatedAt: new Date() }
      );
      break;
      
    case 'suspend':
      result = await User.updateMany(
        { _id: { $in: userIds } },
        { status: 'suspended', updatedAt: new Date() }
      );
      break;
      
    case 'delete':
      // Check for active borrows first
      const activeBorrows = await Borrow.countDocuments({
        user: { $in: userIds },
        status: { $in: ['requested', 'approved', 'renewed'] }
      });
      
      if (activeBorrows > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete users with active borrows"
        });
      }
      
      result = await User.deleteMany({ _id: { $in: userIds } });
      break;
      
    case 'update_membership':
      if (!data.membershipType) {
        return res.status(400).json({
          success: false,
          message: "Membership type is required"
        });
      }
      
      result = await User.updateMany(
        { _id: { $in: userIds } },
        { 
          membershipType: data.membershipType,
          membershipExpiry: data.membershipExpiry ? new Date(data.membershipExpiry) : undefined,
          updatedAt: new Date()
        }
      );
      break;
      
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action"
      });
  }
  
  // Send bulk notifications
  if (['activate', 'suspend'].includes(action)) {
    const notifications = userIds.map(userId => ({
      user: userId,
      type: 'account_status',
      title: `Account ${action === 'activate' ? 'Activated' : 'Suspended'}`,
      message: `Your account has been ${action}d by admin.`,
      sentBy: req.user._id
    }));
    
    await Notification.insertMany(notifications);
  }
  
  res.status(200).json({
    success: true,
    message: `Bulk ${action} completed successfully`,
    modifiedCount: result.modifiedCount || result.deletedCount,
    data: result
  });
});

// 4. User Activity Analytics
exports.getUserActivityAnalytics = catchAsync(async (req, res) => {
  const { period = 'month', userId } = req.query;
  
  const dateRange = {
    $gte: new Date(new Date().setMonth(new Date().getMonth() - (period === 'week' ? 0.25 : period === 'month' ? 1 : 3))),
    $lte: new Date()
  };
  
  let userFilter = {};
  if (userId) userFilter.user = new mongoose.Types.ObjectId(userId);
  
  const [borrowStats, fineStats, activeUsers, topBorrowers] = await Promise.all([
    // Borrow statistics
    Borrow.aggregate([
      { $match: { created_at: dateRange, ...userFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Fine statistics
    Payment.aggregate([
      { $match: { type: 'fine', createdAt: dateRange, ...userFilter } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Active users
    Borrow.aggregate([
      { $match: { created_at: dateRange } },
      { $group: { _id: '$user' } },
      { $count: 'activeUsers' }
    ]),
    
    // Top borrowers
    Borrow.aggregate([
      { $match: { created_at: dateRange } },
      {
        $group: {
          _id: '$user',
          borrowCount: { $sum: 1 }
        }
      },
      { $sort: { borrowCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $project: {
          borrowCount: 1,
          userName: { $arrayElemAt: ['$userInfo.name', 0] },
          userEmail: { $arrayElemAt: ['$userInfo.email', 0] }
        }
      }
    ])
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      borrowStats,
      fineStats,
      activeUsers: activeUsers[0]?.activeUsers || 0,
      topBorrowers,
      period
    }
  });
});

// ==================== LIBRARIAN MANAGEMENT ====================

// 5. Create Librarian Account
exports.createLibrarian = catchAsync(async (req, res) => {
  const { name, email, contact, password, permissions } = req.body;
  
  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and password are required"
    });
  }
  
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User with this email already exists"
    });
  }
  
  const librarian = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    contact,
    password,
    role: 'librarian',
    permissions: permissions || ['manage_books', 'manage_borrows', 'view_reports'],
    status: 'active',
    createdBy: req.user._id
  });
  
  // Remove password from response
  librarian.password = undefined;
  
  res.status(201).json({
    success: true,
    message: "Librarian account created successfully",
    data: librarian
  });
});

// 6. Update Librarian Permissions
exports.updateLibrarianPermissions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  
  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      success: false,
      message: "Permissions must be an array"
    });
  }
  
  const validPermissions = [
    'manage_books', 'manage_borrows', 'manage_users', 
    'view_reports', 'manage_fines', 'system_settings'
  ];
  
  const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
  if (invalidPermissions.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid permissions: ${invalidPermissions.join(', ')}`
    });
  }
  
  const librarian = await User.findOneAndUpdate(
    { _id: id, role: 'librarian' },
    { permissions, updatedAt: new Date() },
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!librarian) {
    return res.status(404).json({
      success: false,
      message: "Librarian not found"
    });
  }
  
  res.status(200).json({
    success: true,
    message: "Librarian permissions updated successfully",
    data: librarian
  });
});

// 7. Get All Librarians
exports.getAllLibrarians = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip = (page - 1) * limit;
  
  const query = { role: 'librarian' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  const librarians = await User.find(query)
    .select('-password')
    .populate('createdBy', 'name')
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit));
    
  const total = await User.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: librarians.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: librarians
  });
});

// ==================== ENHANCED BOOK MANAGEMENT ====================

// 8. Book Categories Management
exports.createCategory = catchAsync(async (req, res) => {
  const { name, description, color } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Category name is required"
    });
  }
  
  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: "Category already exists"
    });
  }
  
  const category = await Category.create({
    name: name.trim(),
    description,
    color: color || '#007bff',
    createdBy: req.user._id
  });
  
  res.status(201).json({
    success: true,
    message: "Category created successfully",
    data: category
  });
});

// 9. Bulk Book Operations
exports.bulkBookOperations = catchAsync(async (req, res) => {
  const { action, bookIds, data } = req.body;
  
  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Book IDs array is required"
    });
  }
  
  let result;
  switch (action) {
    case 'update_category':
      if (!data.category) {
        return res.status(400).json({
          success: false,
          message: "Category is required"
        });
      }
      
      result = await Book.updateMany(
        { _id: { $in: bookIds } },
        { genre: data.category, updatedAt: new Date() }
      );
      break;
      
    case 'update_copies':
      if (!data.totalCopies || data.totalCopies < 1) {
        return res.status(400).json({
          success: false,
          message: "Valid total copies count is required"
        });
      }
      
      // Update each book individually to handle available copies correctly
      const updatePromises = bookIds.map(async (bookId) => {
        const book = await Book.findById(bookId);
        if (book) {
          const borrowedCopies = book.totalCopies - book.availableCopies;
          const newAvailableCopies = Math.max(0, data.totalCopies - borrowedCopies);
          
          return Book.findByIdAndUpdate(bookId, {
            totalCopies: data.totalCopies,
            availableCopies: newAvailableCopies,
            updatedAt: new Date()
          });
        }
      });
      
      await Promise.all(updatePromises);
      result = { modifiedCount: bookIds.length };
      break;
      
    case 'delete':
      // Check for active borrows
      const activeBorrows = await Borrow.countDocuments({
        book: { $in: bookIds },
        status: { $in: ['requested', 'approved', 'renewed'] }
      });
      
      if (activeBorrows > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete books with active borrows"
        });
      }
      
      result = await Book.deleteMany({ _id: { $in: bookIds } });
      break;
      
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action"
      });
  }
  
  res.status(200).json({
    success: true,
    message: `Bulk ${action} completed successfully`,
    modifiedCount: result.modifiedCount || result.deletedCount,
    data: result
  });
});

// 10. Book Inventory Report
exports.getBookInventoryReport = catchAsync(async (req, res) => {
  const { category, availability, format = 'json' } = req.query;
  
  const matchStage = {};
  if (category) matchStage.genre = category;
  if (availability === 'available') matchStage.availableCopies = { $gt: 0 };
  if (availability === 'unavailable') matchStage.availableCopies = { $eq: 0 };
  
  const inventoryReport = await Book.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        borrowedCopies: { $subtract: ['$totalCopies', '$availableCopies'] },
        availabilityPercentage: {
          $multiply: [
            { $divide: ['$availableCopies', '$totalCopies'] },
            100
          ]
        }
      }
    },
    {
      $lookup: {
        from: 'borrows',
        localField: '_id',
        foreignField: 'book',
        as: 'borrowHistory'
      }
    },
    {
      $addFields: {
        totalBorrows: { $size: '$borrowHistory' },
        popularityScore: {
          $divide: [
            { $size: '$borrowHistory' },
            { $add: ['$totalCopies', 1] }
          ]
        }
      }
    },
    {
      $project: {
        title: 1,
        author: 1,
        isbn: 1,
        genre: 1,
        totalCopies: 1,
        availableCopies: 1,
        borrowedCopies: 1,
        availabilityPercentage: 1,
        totalBorrows: 1,
        popularityScore: 1,
        addedAt: '$createdAt'
      }
    },
    { $sort: { popularityScore: -1 } }
  ]);
  
  // Calculate summary statistics
  const summary = {
    totalBooks: inventoryReport.length,
    totalCopies: inventoryReport.reduce((sum, book) => sum + book.totalCopies, 0),
    availableCopies: inventoryReport.reduce((sum, book) => sum + book.availableCopies, 0),
    borrowedCopies: inventoryReport.reduce((sum, book) => sum + book.borrowedCopies, 0),
    averageAvailability: inventoryReport.reduce((sum, book) => sum + book.availabilityPercentage, 0) / inventoryReport.length || 0
  };
  
  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Book Inventory');
    
    // Add summary
    worksheet.addRow(['INVENTORY SUMMARY']);
    worksheet.addRow(['Total Books', summary.totalBooks]);
    worksheet.addRow(['Total Copies', summary.totalCopies]);
    worksheet.addRow(['Available Copies', summary.availableCopies]);
    worksheet.addRow(['Borrowed Copies', summary.borrowedCopies]);
    worksheet.addRow(['Average Availability %', Math.round(summary.averageAvailability)]);
    worksheet.addRow([]);
    
    // Add headers
    worksheet.addRow(['Title', 'Author', 'ISBN', 'Genre', 'Total Copies', 'Available', 'Borrowed', 'Availability %', 'Total Borrows', 'Popularity Score']);
    
    // Add data
    inventoryReport.forEach(book => {
      worksheet.addRow([
        book.title,
        book.author,
        book.isbn,
        book.genre,
        book.totalCopies,
        book.availableCopies,
        book.borrowedCopies,
        Math.round(book.availabilityPercentage),
        book.totalBorrows,
        Math.round(book.popularityScore * 100) / 100
      ]);
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } else {
    res.status(200).json({
      success: true,
      data: {
        books: inventoryReport,
        summary
      }
    });
  }
});

// ==================== QUERY RESOLUTION ====================

// 11. Get All Queries/Support Tickets
exports.getAllQueries = catchAsync(async (req, res) => {
  const { status, priority, category, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  
  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  
  const queries = await Query.find(query)
    .populate('user', 'name email contact')
    .populate('assignedTo', 'name')
    .populate('resolvedBy', 'name')
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
  const total = await Query.countDocuments(query);
  
  // Get query statistics
  const stats = await Query.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    count: queries.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: queries,
    stats: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  });
});

// 12. Assign Query to Librarian
exports.assignQuery = catchAsync(async (req, res) => {
  const { queryId } = req.params;
  const { librarianId, priority } = req.body;
  
  const query = await Query.findById(queryId);
  if (!query) {
    return res.status(404).json({
      success: false,
      message: "Query not found"
    });
  }
  
  const librarian = await User.findOne({ _id: librarianId, role: 'librarian' });
  if (!librarian) {
    return res.status(404).json({
      success: false,
      message: "Librarian not found"
    });
  }
  
  query.assignedTo = librarianId;
  query.status = 'assigned';
  if (priority) query.priority = priority;
  query.assignedAt = new Date();
  await query.save();
  
  // Send notification to librarian
  await Notification.create({
    user: librarianId,
    type: 'query_assigned',
    title: 'New Query Assigned',
    message: `You have been assigned a new ${query.category} query: "${query.subject}"`,
    relatedQuery: query._id,
    sentBy: req.user._id
  });
  
  res.status(200).json({
    success: true,
    message: "Query assigned successfully",
    data: query
  });
});

// 13. Resolve Query
exports.resolveQuery = catchAsync(async (req, res) => {
  const { queryId } = req.params;
  const { resolution, status = 'resolved' } = req.body;
  
  if (!resolution) {
    return res.status(400).json({
      success: false,
      message: "Resolution is required"
    });
  }
  
  const query = await Query.findById(queryId).populate('user');
  if (!query) {    return res.status(404).json({
      success: false,
      message: "Query not found"
    });
  }

  query.status = status;
  query.resolution = resolution;
  query.resolvedBy = req.user._id;
  query.resolvedAt = new Date();
  await query.save();

  // Send notification to user
  await Notification.create({
    user: query.user._id,
    type: 'query_resolved',
    title: 'Your Query Has Been Resolved',
    message: `Your ${query.category} query "${query.subject}" has been resolved. ${resolution}`,
    relatedQuery: query._id
  });

  res.status(200).json({
    success: true,
    message: "Query resolved successfully",
    data: query
  });
});

// ==================== SYSTEM MAINTENANCE ====================

// 14. Backup Database
exports.backupDatabase = catchAsync(async (req, res) => {
  const collections = {
    User: await User.find(),
    Book: await Book.find(),
    Borrow: await Borrow.find(),
    Notification: await Notification.find(),
    Payment: await Payment.find(),
    Feedback: await Feedback.find(),
    Settings: await Settings.find(),
    Query: await Query.find(),
    Category: await Category.find()
  };

  const backupData = {
    timestamp: new Date(),
    collections,
    backupBy: req.user._id
  };

  // In a real implementation, you would save this to a file or cloud storage
  // For demo purposes, we'll just return it as JSON
  res.status(200).json({
    success: true,
    message: "Database backup generated successfully",
    data: backupData
  });
});

// 15. System Health Check
exports.systemHealthCheck = catchAsync(async (req, res) => {
  const [dbStatus, activeBorrows, overdueBooks, pendingFines, unresolvedQueries] = await Promise.all([
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    Borrow.countDocuments({ status: { $in: ['approved', 'renewed'] } }),
    Borrow.countDocuments({ 
      status: { $in: ['approved', 'renewed'] },
      due_date: { $lt: new Date() }
    }),
    Payment.countDocuments({ type: 'fine', status: 'pending' }),
    Query.countDocuments({ status: { $ne: 'resolved' } })
  ]);

  res.status(200).json({
    success: true,
    data: {
      database: dbStatus,
      stats: {
        activeBorrows,
        overdueBooks,
        pendingFines,
        unresolvedQueries
      },
      lastChecked: new Date()
    }
  });
});

// ==================== SCHEDULED TASKS ====================

// 16. Schedule Overdue Notifications
const scheduleOverdueNotifications = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running overdue notifications check...');
    try {
      const overdueBooks = await Borrow.find({
        status: { $in: ['approved', 'renewed'] },
        due_date: { $lt: new Date() },
        lastOverdueNotification: { 
          $lt: new Date(new Date().setHours(0, 0, 0, 0)) 
        }
      }).populate('user book');

      const notifications = overdueBooks.map(borrow => {
        const daysOverdue = Math.ceil((new Date() - borrow.due_date) / (1000 * 60 * 60 * 24));
        return {
          user: borrow.user._id,
          type: 'overdue_reminder',
          title: 'Overdue Book Reminder',
          message: `"${borrow.book.title}" is ${daysOverdue} days overdue. Please return it as soon as possible to avoid additional fines.`,
          relatedBorrow: borrow._id,
          isSystemGenerated: true
        };
      });

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        
        // Update last notification date
        await Borrow.updateMany(
          { _id: { $in: overdueBooks.map(b => b._id) } },
          { lastOverdueNotification: new Date() }
        );
      }

      console.log(`Sent ${notifications.length} overdue notifications`);
    } catch (error) {
      console.error('Error in overdue notifications:', error);
    }
  });
};

// 17. Schedule Membership Expiry Checks
const scheduleMembershipExpiryChecks = () => {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running membership expiry checks...');
    try {
      const expiringSoon = await User.find({
        membershipExpiry: { 
          $gte: new Date(),
          $lte: new Date(new Date().setDate(new Date().getDate() + 7))
        },
        membershipExpiryNotified: false
      });

      const expired = await User.find({
        membershipExpiry: { $lt: new Date() },
        membershipExpiryNotified: false
      });

      // Notify users whose membership is expiring soon
      const soonNotifications = expiringSoon.map(user => ({
        user: user._id,
        type: 'membership_expiry',
        title: 'Membership Expiring Soon',
        message: `Your library membership will expire on ${user.membershipExpiry.toDateString()}. Please renew to avoid interruption of services.`,
        isSystemGenerated: true
      }));

      // Notify users whose membership has expired
      const expiredNotifications = expired.map(user => ({
        user: user._id,
        type: 'membership_expired',
        title: 'Membership Expired',
        message: 'Your library membership has expired. Please renew to continue using library services.',
        isSystemGenerated: true
      }));

      if (soonNotifications.length > 0 || expiredNotifications.length > 0) {
        await Notification.insertMany([...soonNotifications, ...expiredNotifications]);
        
        // Update notification flags
        await User.updateMany(
          { _id: { $in: expiringSoon.map(u => u._id) } },
          { membershipExpiryNotified: true }
        );
        
        await User.updateMany(
          { _id: { $in: expired.map(u => u._id) } },
          { membershipExpiryNotified: true }
        );
      }

      console.log(`Processed ${expiringSoon.length} expiring and ${expired.length} expired memberships`);
    } catch (error) {
      console.error('Error in membership expiry checks:', error);
    }
  });
};

// ==================== INITIALIZATION ====================

// Initialize scheduled tasks
scheduleDailyFineCheck();
scheduleOverdueNotifications();
scheduleMembershipExpiryChecks();

module.exports = exports;