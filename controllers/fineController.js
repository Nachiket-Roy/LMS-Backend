// ==================== AUTO FINE SYSTEM ====================

const User = require("../models/User");
const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const Payment = require("../models/Payment");
const Notification = require("../models/Notification");
const catchAsync = require("../utils/catchAsync");
const cron = require('node-cron');

// ==================== METHOD 1: CRON JOB (RECOMMENDED) ====================

// Schedule to run daily at 12:01 AM
const scheduleDailyFineCheck = () => {
  cron.schedule('1 0 * * *', async () => {
    console.log('Running daily fine check...');
    await processDailyFines();
  });
};

// Process daily fines for all overdue books
const processDailyFines = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Find all overdue books that haven't been processed today
    const overdueBooks = await Borrow.find({
      status: { $in: ['borrowed', 'overdue'] },
      dueDate: { $lt: today },
      $or: [
        { lastFineProcessed: { $exists: false } },
        { lastFineProcessed: { $lt: today } }
      ]
    }).populate('user book');

    console.log(`Found ${overdueBooks.length} overdue books to process`);

    for (const borrow of overdueBooks) {
      await addDailyFine(borrow);
    }

    console.log('Daily fine processing completed');
  } catch (error) {
    console.error('Error in daily fine processing:', error);
  }
};

// Add daily fine for a specific borrow
const addDailyFine = async (borrow) => {
  try {
    const today = new Date();
    const fineAmount = 5; // ₹5 per day
    
    // Calculate days overdue
    const daysOverdue = Math.ceil((today - borrow.dueDate) / (1000 * 60 * 60 * 24));
    
    // Update borrow status to overdue if not already
    if (borrow.status !== 'overdue') {
      borrow.status = 'overdue';
    }
    
    // Add today's fine
    const existingFine = await Payment.findOne({
      user: borrow.user._id,
      borrow: borrow._id,
      type: 'fine',
      fineDate: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    });

    if (!existingFine) {
      // Create new fine record
      await Payment.create({
        user: borrow.user._id,
        borrow: borrow._id,
        amount: fineAmount,
        type: 'fine',
        description: `Daily fine for overdue book "${borrow.book.title}" (Day ${daysOverdue})`,
        status: 'pending',
        fineDate: today
      });

      // Update total fine in borrow record
      borrow.totalFine = (borrow.totalFine || 0) + fineAmount;
      
      console.log(`Added ₹${fineAmount} fine for user ${borrow.user.name} - Book: ${borrow.book.title}`);
    }

    // Update last processed date
    borrow.lastFineProcessed = today;
    await borrow.save();

    // Send notification (only on first day or every 7 days)
    if (daysOverdue === 1 || daysOverdue % 7 === 0) {
      await Notification.create({
        user: borrow.user._id,
        type: 'overdue_fine',
        title: 'Overdue Fine Added',
        message: `A fine of ₹${fineAmount} has been added for the overdue book "${borrow.book.title}". Total days overdue: ${daysOverdue}. Please return the book to avoid additional charges.`,
        relatedBorrow: borrow._id
      });
    }

  } catch (error) {
    console.error(`Error adding fine for borrow ${borrow._id}:`, error);
  }
};

