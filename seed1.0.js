const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const User = require("./models/User");
const Book = require("./models/Book");
const Fine = require("./models/Fine");
const Notification = require("./models/Notification");
const Payment = require("./models/Payment");
require("./models/Settings");
const Borrow = require("./models/Borrow");
const Feedback = require("./models/Feedback");

const DB = process.env.MONGODB;

// Enhanced book data with more variety
const bookData = [
  {
    title: "To Kill a Mockingbird",
    category: "Fiction",
    author: "Harper Lee",
    rating: 4.5,
    totalCopies: 5,
    availableCopies: 3,
    publisher: "J.B. Lippincott & Co.",
    description:
      "A classic novel about racial injustice and childhood in the American South.",
  },
  {
    title: "1984",
    category: "Fiction",
    author: "George Orwell",
    rating: 4.7,
    totalCopies: 4,
    availableCopies: 2,
    publisher: "Secker & Warburg",
    description:
      "A dystopian social science fiction novel about totalitarianism.",
  },
  {
    title: "The Great Gatsby",
    category: "Fiction",
    author: "F. Scott Fitzgerald",
    rating: 4.2,
    totalCopies: 3,
    availableCopies: 1,
    publisher: "Charles Scribner's Sons",
    description: "A tale of the Jazz Age and the American Dream.",
  },
  {
    title: "Clean Code",
    category: "Programming",
    author: "Robert C. Martin",
    rating: 4.8,
    totalCopies: 6,
    availableCopies: 4,
    publisher: "Prentice Hall",
    description: "A handbook of agile software craftsmanship.",
  },
  {
    title: "The Catcher in the Rye",
    category: "Fiction",
    author: "J.D. Salinger",
    rating: 4.0,
    totalCopies: 2,
    availableCopies: 0,
    publisher: "Little, Brown and Company",
    description:
      "A controversial novel about teenage rebellion and alienation.",
  },
  {
    title: "Dune",
    category: "Science",
    author: "Frank Herbert",
    rating: 4.6,
    totalCopies: 4,
    availableCopies: 2,
    publisher: "Chilton Books",
    description: "A science fiction epic set in a distant future.",
  },
  {
    title: "The Psychology of Computer Programming",
    category: "Psychology",
    author: "Gerald M. Weinberg",
    rating: 4.3,
    totalCopies: 3,
    availableCopies: 3,
    publisher: "Van Nostrand Reinhold",
    description: "Classic work on the human factors in software development.",
  },
  {
    title: "JavaScript: The Good Parts",
    category: "Programming",
    author: "Douglas Crockford",
    rating: 4.1,
    totalCopies: 3,
    availableCopies: 1,
    publisher: "O'Reilly Media",
    description: "A guide to the best features of JavaScript.",
  },
  {
    title: "Pride and Prejudice",
    category: "Fiction",
    author: "Jane Austen",
    rating: 4.4,
    totalCopies: 4,
    availableCopies: 2,
    publisher: "T. Egerton",
    description:
      "A romantic novel about manners and marriage in Georgian England.",
  },
  {
    title: "The Lord of the Rings",
    category: "Fantasy",
    author: "J.R.R. Tolkien",
    rating: 4.9,
    totalCopies: 5,
    availableCopies: 3,
    publisher: "George Allen & Unwin",
    description:
      "An epic high fantasy novel about the quest to destroy the One Ring.",
  },
];

async function seed() {
  try {
    await mongoose.connect(DB);
    console.log("Connected to MongoDB");

    // Clear all collections
    await User.deleteMany({});
    await Book.deleteMany({});
    await Fine.deleteMany({});
    await Notification.deleteMany({});
    await Payment.deleteMany({});
    await Borrow.deleteMany({});

    // Drop collections to remove any problematic indexes
    const collections = [
      "users",
      "books",
      "fines",
      "notifications",
      "payments",
      "borrows",
    ];
    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).drop();
        console.log(`Dropped ${collectionName} collection`);
      } catch (error) {
        console.log(
          `${collectionName} collection does not exist or already dropped`
        );
      }
    }

    console.log("Cleared all collections");

    // Insert users with more detailed profiles
    const users = await User.insertMany([
      {
        name: "John Doe",
        email: "user@example.com",
        password: "password123",
        role: "user",
        phone: "+1234567890",
        address: "123 Main St, City, State 12345",
      },
      {
        name: "Jane Smith",
        email: "admin@example.com",
        password: "password123",
        role: "admin",
        phone: "+1234567891",
        address: "456 Admin Ave, City, State 12345",
      },
      {
        name: "Bob Johnson",
        email: "librarian@example.com",
        password: "password123",
        role: "librarian",
        phone: "+1234567892",
        address: "789 Library Ln, City, State 12345",
      },
      {
        name: "Alice Brown",
        email: "alice@example.com",
        password: "password123",
        role: "user",
        phone: "+1234567893",
        address: "321 User Rd, City, State 12345",
      },
      {
        name: "Charlie Wilson",
        email: "charlie@example.com",
        password: "password123",
        role: "user",
        phone: "+1234567894",
        address: "654 Reader St, City, State 12345",
      },
    ]);

    console.log("Users seeded successfully");

    // Insert books
    const books = [];
    for (const bookInfo of bookData) {
      try {
        const book = new Book(bookInfo);
        const savedBook = await book.save();
        books.push(savedBook);
        console.log(`Inserted book: ${bookInfo.title}`);
      } catch (error) {
        console.error(`Error inserting book ${bookInfo.title}:`, error.message);
      }
    }

    console.log(`Books seeded: ${books.length} books inserted`);
    const feedbackData = [
      {
        user_id: users[0]._id, // Changed from 'user' to 'user_id'
        book_id: books[0]._id, // Changed from 'book' to 'book_id'
        rating: 4,
        comment: "Great read! The characters were really well written.",
        anonymous: false,
      },
      {
        user_id: users[1]._id,
        book_id: books[2]._id,
        rating: 5,
        comment: "Absolutely loved it. Highly recommended.",
        anonymous: false,
      },
      {
        user_id: users[2]._id,
        book_id: books[1]._id,
        rating: 3,
        comment: "Informative but could have been shorter.",
        anonymous: true,
      },
      {
        user_id: users[3]._id,
        book_id: books[3]._id,
        rating: 2,
        comment: "Didn't enjoy it much. Writing style was difficult to follow.",
        anonymous: false,
      },
      {
        user_id: users[4]._id,
        book_id: books[4]._id,
        rating: 5,
        comment: "Masterpiece. I would read it again.",
        anonymous: true,
      },
    ];
    // Insert feedback
    const feedbacks = [];
    for (const entry of feedbackData) {
      try {
        const feedback = new Feedback(entry);
        const saved = await feedback.save();
        feedbacks.push(saved);
        console.log(
          `Inserted feedback: ${entry.rating}⭐ - ${entry.comment.slice(
            0,
            30
          )}...`
        );
      } catch (error) {
        if (error.code === 11000) {
          console.warn(
            "Duplicate feedback skipped (user-book combination already exists)"
          );
        } else {
          console.error("Error inserting feedback:", error.message);
        }
      }
    }

    // Comprehensive borrow records to test all scenarios
    const borrowsData = [
      // ACTIVE BORROWS for John Doe (user@example.com)
      {
        user_id: users[0]._id,
        book_id: books[0]._id, // To Kill a Mockingbird
        status: "approved",
        requestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        issueDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },
      {
        user_id: users[0]._id,
        book_id: books[3]._id, // Clean Code
        status: "approved",
        requestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },

      // OVERDUE BOOKS for John Doe
      {
        user_id: users[0]._id,
        book_id: books[1]._id, // 1984
        status: "approved",
        requestDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        issueDate: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000), // 19 days ago
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
        renewCount: 1,
        fineAmount: 25, // 5 days × 5 per day
        totalFine: 25,
      },
      {
        user_id: users[0]._id,
        book_id: books[7]._id, // JavaScript: The Good Parts
        status: "approved",
        requestDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
        issueDate: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000), // 24 days ago
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
        renewCount: 0,
        fineAmount: 50, // 10 days × 5 per day
        totalFine: 50,
      },

      // DUE SOON for John Doe
      {
        user_id: users[0]._id,
        book_id: books[5]._id, // Dune
        status: "approved",
        requestDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
        issueDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), // 11 days ago
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },

      // READING HISTORY - RETURNED BOOKS for John Doe
      {
        user_id: users[0]._id,
        book_id: books[2]._id, // The Great Gatsby
        status: "returned",
        requestDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        issueDate: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000), // 34 days ago
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        returnDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), // Returned on time
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },
      {
        user_id: users[0]._id,
        book_id: books[4]._id, // The Catcher in the Rye
        status: "returned",
        requestDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
        issueDate: new Date(Date.now() - 49 * 24 * 60 * 60 * 1000), // 49 days ago
        dueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        returnDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 5 days late
        renewCount: 1,
        fineAmount: 25, // 5 days × 5 per day
        totalFine: 25,
      },
      {
        user_id: users[0]._id,
        book_id: books[8]._id, // Pride and Prejudice
        status: "returned",
        requestDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        issueDate: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000), // 59 days ago
        dueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        returnDate: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000), // Returned on time
        renewCount: 2,
        fineAmount: 0,
        totalFine: 0,
      },

      // RENEWABLE BOOK for John Doe (can be renewed)
      {
        user_id: users[0]._id,
        book_id: books[6]._id, // The Psychology of Computer Programming
        status: "approved",
        requestDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        renewCount: 1, // Can still renew once more (assuming max 2 renewals)
        fineAmount: 0,
        totalFine: 0,
      },

      // PENDING REQUEST for John Doe
      {
        user_id: users[0]._id,
        book_id: books[9]._id, // The Lord of the Rings
        status: "requested",
        requestDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },

      // Additional records for other users
      {
        user_id: users[1]._id, // Jane Smith (admin)
        book_id: books[1]._id, // 1984
        status: "approved",
        requestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
      },
      {
        user_id: users[3]._id, // Alice Brown
        book_id: books[2]._id, // The Great Gatsby
        status: "rejected",
        requestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        renewCount: 0,
        fineAmount: 0,
        totalFine: 0,
        rejectionReason: "Book already at maximum circulation",
      },
      {
        user_id: users[4]._id, // Charlie Wilson
        book_id: books[4]._id, // The Catcher in the Rye
        status: "returned",
        requestDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        issueDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        returnDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 5 days late
        renewCount: 0,
        fineAmount: 25,
        totalFine: 25,
      },
    ];
const borrows = [];
for (const borrowData of borrowsData) {
  try {
    const borrow = new Borrow(borrowData);
    borrow._skipStatusValidation = true;
    const savedBorrow = await borrow.save();
    borrows.push(savedBorrow);
    console.log(
      // FIXED: Use user_id and book_id to match your data structure
      `Inserted borrow: ${borrowData.status} - User: ${borrowData.user_id} - Book: ${borrowData.book_id}`
    );
  } catch (error) {
    console.error(`Error inserting borrow:`, error.message);
    console.error("Borrow data:", borrowData);
  }
}

console.log(`Borrows seeded: ${borrows.length} borrow records inserted`);

// Preprocess map for easy lookups
const borrowMap = {};
for (const borrow of borrows) {
  // Create keys for lookup by fineAmount or by user+book
  if (borrow.fineAmount > 0) {
    borrowMap[`fine_${borrow.fineAmount}`] = borrow;
  }
  if (borrow.user_id && borrow.book_id) {
    borrowMap[`${borrow.user_id.toString()}_${borrow.book_id.toString()}`] = borrow;
  }
}

    // Now create your fine seed data using reliable references
    const finesData = [
      // Unpaid fines for John Doe
      {
        user_id: users[0]._id,
        issue_id: borrowMap[`fine_25`]?._id,
        amount: 25,
        status: "unpaid",
        payment_date: null,
        payment_mode: null,
        description: 'Late return fee for "1984"',
      },
      {
        user_id: users[0]._id,
        issue_id: borrowMap[`fine_50`]?._id,
        amount: 50,
        status: "unpaid",
        payment_date: null,
        payment_mode: null,
        description: 'Late return fee for "JavaScript: The Good Parts"',
      },
      {
        user_id: users[0]._id,
        // FIXED: Corrected the borrow lookup key
        issue_id:
          borrowMap[`${users[0]._id.toString()}_${books[4]._id.toString()}`]
            ?._id,
        amount: 25,
        status: "paid",
        payment_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        payment_mode: "upi",
        description: 'Late return fee for "The Catcher in the Rye"',
      },
      {
        user_id: users[4]._id,
        // FIXED: Corrected the borrow lookup key
        issue_id:
          borrowMap[`${users[4]._id.toString()}_${books[4]._id.toString()}`]
            ?._id,
        amount: 25,
        status: "paid",
        payment_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        payment_mode: "cash",
        description: "Late return fee",
      },
    ];
    const fines = [];
    for (const fineData of finesData) {
      if (fineData.issue_id) {
        try {
          const fine = new Fine(fineData);
          const savedFine = await fine.save();
          fines.push(savedFine);
          console.log(
            `Inserted fine: ${fineData.amount} - Status: ${fineData.status}`
          );
        } catch (error) {
          console.error(`Error inserting fine:`, error.message);
        }
      } else {
        console.warn(
          "Skipped fine (no matching borrow):",
          fineData.description
        );
      }
    }

    console.log(`Fines seeded: ${fines.length} fines inserted`);

    // Comprehensive notifications for John Doe to test getNotifications
    const notificationsData = [
      // Due soon notifications
      {
        user_id: users[0]._id,
        message:
          'Your book "Dune" is due in 2 days. Please return or renew it.',
        type: "due",
        is_read: false, // Changed from 'read' to 'is_read'
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Changed from 'created_at' to 'createdAt'
      },
      {
        user_id: users[0]._id,
        message: 'Your book "To Kill a Mockingbird" is due in 10 days.',
        type: "due",
        is_read: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      // Overdue notifications
      {
        user_id: users[0]._id,
        message:
          'Your book "1984" is overdue! Fine: $25. Please return immediately.',
        type: "overdue",
        is_read: false,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        user_id: users[0]._id,
        message:
          'Your book "JavaScript: The Good Parts" is overdue! Fine: $50. Please return immediately.',
        type: "overdue",
        is_read: false,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      // Approval notifications
      {
        user_id: users[0]._id,
        message:
          'Your request for "Clean Code" has been approved! You can collect it from the library.',
        type: "approval",
        is_read: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      // Admin notifications
      {
        user_id: users[0]._id,
        message: "Library will be closed on Sunday for maintenance work.",
        type: "admin",
        is_read: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: users[0]._id,
        message: "New books have been added to the Programming section!",
        type: "admin",
        is_read: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      // Payment notifications
      {
        user_id: users[0]._id,
        message: "Your fine payment of $25 has been processed successfully.",
        type: "payment",
        is_read: true,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      // General notifications
      {
        user_id: users[0]._id,
        message: "Welcome to the Digital Library System!",
        type: "general",
        is_read: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    ];

    // Seed function remains the same
    const notifications = [];
    for (const notificationData of notificationsData) {
      try {
        const notification = new Notification(notificationData);
        const savedNotification = await notification.save();
        notifications.push(savedNotification);
        console.log(
          `Inserted notification: ${notificationData.type} for user ${notificationData.user_id}`
        );
      } catch (error) {
        console.error(`Error inserting notification:`, error.message);
      }
    }

    console.log(
      `Notifications seeded: ${notifications.length} notifications inserted`
    );

    console.log(
      `Notifications seeded: ${notifications.length} notifications inserted`
    );

    // Comprehensive payment history for John Doe
    const paymentsData = [
      // Recent payments
      {
        user_id: users[0]._id,
        amount: 25,
        method: "upi",
        status: "paid",
        transaction_id: "TXN001234567",
        description: "Fine payment for late return",
        created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      },
      {
        user_id: users[0]._id,
        amount: 10,
        method: "card",
        status: "paid",
        transaction_id: "TXN001234568",
        description: "Membership renewal fee",
        created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      },
      // Pending payment
      {
        user_id: users[0]._id,
        amount: 75, // Combined fine for current overdue books
        method: "upi",
        status: "pending",
        transaction_id: "TXN001234569",
        description: "Fine payment for overdue books",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      // Failed payment
      {
        user_id: users[0]._id,
        amount: 20,
        method: "card",
        status: "failed",
        transaction_id: "TXN001234570",
        description: "Fine payment - card declined",
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
      // Other users' payments
      {
        user_id: users[1]._id,
        amount: 15,
        method: "cash",
        status: "paid",
        transaction_id: "TXN001234571",
        description: "Fine payment",
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: users[4]._id,
        amount: 25,
        method: "cash",
        status: "paid",
        transaction_id: "TXN001234572",
        description: "Late return fine",
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    ];

    const payments = [];
    for (const paymentData of paymentsData) {
      try {
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        payments.push(savedPayment);
        console.log(
          `Inserted payment: ${paymentData.method} - ${paymentData.amount} - ${paymentData.status}`
        );
      } catch (error) {
        console.error(`Error inserting payment:`, error.message);
      }
    }

    console.log(`Payments seeded: ${payments.length} payments inserted`);

    // Summary
    console.log("\n=== SEED SUMMARY ===");
    console.log(`✓ Users: ${users.length}`);
    console.log(`✓ Books: ${books.length}`);
    console.log(`✓ Borrows: ${borrows.length}`);
    console.log(`✓ Fines: ${fines.length}`);
    console.log(`✓ Notifications: ${notifications.length}`);
    console.log(`✓ Payments: ${payments.length}`);
    console.log("===================\n");

    // Test data summary for John Doe (user@example.com)
    console.log("=== TEST DATA FOR JOHN DOE (user@example.com) ===");
    console.log("Active Borrows: 2 books");
    console.log("Overdue Books: 2 books (with fines)");
    console.log("Due Soon: 1 book (due in 2 days)");
    console.log("Reading History: 3 returned books");
    console.log("Renewable Books: 1 book (can renew)");
    console.log("Pending Requests: 1 book");
    console.log("Notifications: 9 notifications (mix of read/unread)");
    console.log("Payment History: 4 payments (paid/pending/failed)");
    console.log("Outstanding Fines: $75 (from 2 overdue books)");
    console.log("===============================================\n");

    console.log("Seed data inserted successfully!");
    console.log(
      "You can now test all user routes with the account: user@example.com / password123"
    );
  } catch (error) {
    console.error("Error inserting seed data:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

seed();
