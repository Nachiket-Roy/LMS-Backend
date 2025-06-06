const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Book = require("./models/Book");
const Borrow = require("./models/Borrow");
const Feedback = require("./models/Feedback");
const Notification = require("./models/Notification");
const Payment = require("./models/Payment");

const DB = process.env.MONGODB;

// Sample books data
const booksData = [
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    isbn: "978-0-06-112008-4",
    category: "Fiction",
    totalQuantity: 5,
    availableQuantity: 3,
    publisher: "J.B. Lippincott & Co.",
    publishedYear: 1960,
    description: "A classic novel about racial injustice and childhood in the American South.",
    language: "English",
    pages: 281,
    rating: 4.5,
    location: "A-101"
  },
  {
    title: "1984",
    author: "George Orwell",
    isbn: "978-0-452-28423-4",
    category: "Fiction",
    totalQuantity: 4,
    availableQuantity: 1,
    publisher: "Secker & Warburg",
    publishedYear: 1949,
    description: "A dystopian social science fiction novel about totalitarianism.",
    language: "English",
    pages: 328,
    rating: 4.7,
    location: "A-102"
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    isbn: "978-0-7432-7356-5",
    category: "Fiction",
    totalQuantity: 3,
    availableQuantity: 2,
    publisher: "Charles Scribner's Sons",
    publishedYear: 1925,
    description: "A tale of the Jazz Age and the American Dream.",
    language: "English",
    pages: 180,
    rating: 4.2,
    location: "A-103"
  },
  {
    title: "Clean Code",
    author: "Robert C. Martin",
    isbn: "978-0-13-235088-4",
    category: "Programming",
    totalQuantity: 6,
    availableQuantity: 4,
    publisher: "Prentice Hall",
    publishedYear: 2008,
    description: "A handbook of agile software craftsmanship.",
    language: "English",
    pages: 464,
    rating: 4.8,
    location: "T-201"
  },
  {
    title: "JavaScript: The Good Parts",
    author: "Douglas Crockford",
    isbn: "978-0-596-51774-8",
    category: "Programming",
    totalQuantity: 4,
    availableQuantity: 2,
    publisher: "O'Reilly Media",
    publishedYear: 2008,
    description: "A guide to the best features of JavaScript.",
    language: "English",
    pages: 176,
    rating: 4.1,
    location: "T-202"
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    isbn: "978-0-14-143951-8",
    category: "Fiction",
    totalQuantity: 4,
    availableQuantity: 2,
    publisher: "T. Egerton",
    publishedYear: 1813,
    description: "A romantic novel about manners and marriage in Georgian England.",
    language: "English",
    pages: 432,
    rating: 4.4,
    location: "A-104"
  },
  {
    title: "The Lord of the Rings",
    author: "J.R.R. Tolkien",
    isbn: "978-0-544-00341-5",
    category: "Fantasy",
    totalQuantity: 5,
    availableQuantity: 3,
    publisher: "George Allen & Unwin",
    publishedYear: 1954,
    description: "An epic high fantasy novel about the quest to destroy the One Ring.",
    language: "English",
    pages: 1216,
    rating: 4.9,
    location: "F-101"
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    isbn: "978-0-441-17271-9",
    category: "Science Fiction",
    totalQuantity: 4,
    availableQuantity: 2,
    publisher: "Chilton Books",
    publishedYear: 1965,
    description: "A science fiction epic set in a distant future.",
    language: "English",
    pages: 688,
    rating: 4.6,
    location: "S-101"
  },
  {
    title: "The Psychology of Computer Programming",
    author: "Gerald M. Weinberg",
    isbn: "978-0-932633-42-0",
    category: "Psychology",
    totalQuantity: 3,
    availableQuantity: 3,
    publisher: "Van Nostrand Reinhold",
    publishedYear: 1971,
    description: "Classic work on the human factors in software development.",
    language: "English",
    pages: 288,
    rating: 4.3,
    location: "P-101"
  },
  {
    title: "You Don't Know JS",
    author: "Kyle Simpson",
    isbn: "978-1-491-92415-6",
    category: "Programming",
    totalQuantity: 5,
    availableQuantity: 4,
    publisher: "O'Reilly Media",
    publishedYear: 2015,
    description: "A series diving deep into the core mechanisms of JavaScript.",
    language: "English",
    pages: 278,
    rating: 4.7,
    location: "T-203"
  }
];

// Sample feedback/queries data
const feedbackData = [
  {
    subject: "Request for more programming books",
    message: "Could you please add more books on Python and Machine Learning? The current collection is limited.",
    type: "suggestion",
    priority: "medium",
    status: "open"
  },
  {
    subject: "Library opening hours",
    message: "Can the library stay open until 10 PM on weekdays? It would be very helpful for working professionals.",
    type: "inquiry",
    priority: "low",
    status: "in_progress"
  },
  {
    subject: "Book reservation system",
    message: "It would be great to have a book reservation system for books that are currently borrowed.",
    type: "feature_request",
    priority: "high",
    status: "open"
  },
  {
    subject: "Damaged book report",
    message: "The copy of '1984' I borrowed has several torn pages. Please check other copies.",
    type: "complaint",
    priority: "medium",
    status: "resolved",
    response: "Thank you for reporting. We have checked and replaced the damaged copies."
  },
  {
    subject: "Late fee inquiry",
    message: "I was charged a late fee but I returned the book on time. Can you please check?",
    type: "complaint",
    priority: "high",
    status: "resolved",
    response: "We have reviewed your case and refunded the late fee. Our apologies for the error."
  }
];

// Sample notifications data
const notificationsData = [
  {
    title: "New Books Added",
    message: "We've added 10 new programming books to our collection. Check them out!",
    type: "announcement"
  },
  {
    title: "Library Maintenance",
    message: "The library will be closed for maintenance on Sunday from 9 AM to 2 PM.",
    type: "announcement"
  },
  {
    title: "Reading Challenge 2024",
    message: "Join our annual reading challenge! Read 12 books and win exciting prizes.",
    type: "event"
  }
];

async function seedLibraryData() {
  try {
    console.log("🌱 Starting library data seeding...");
    
    // Connect to MongoDB
    await mongoose.connect(DB);
    console.log("✅ Connected to MongoDB");

    // Get existing users (assuming you have users from your user seed)
    const existingUsers = await User.find({ role: "user" }).limit(10);
    const librarians = await User.find({ role: "librarian" }).limit(2);
    
    if (existingUsers.length === 0) {
      console.log("⚠️  No users found. Please run user seed first.");
      return;
    }

    console.log(`📊 Found ${existingUsers.length} users and ${librarians.length} librarians`);

    // 1. Add Books
    console.log("📚 Adding books...");
    const createdBooks = [];
    
    for (const bookData of booksData) {
      // Check if book already exists
      const existingBook = await Book.findOne({ isbn: bookData.isbn });
      if (!existingBook) {
        const book = await Book.create({
          ...bookData,
          addedBy: librarians[0]?._id || existingUsers[0]._id
        });
        createdBooks.push(book);
        console.log(`  ✅ Added: ${book.title}`);
      } else {
        console.log(`  ⏭️  Skipped: ${bookData.title} (already exists)`);
        createdBooks.push(existingBook);
      }
    }

    // 2. Add Feedback/Queries
    console.log("💬 Adding feedback entries...");
    const createdFeedback = [];
    
    for (let i = 0; i < feedbackData.length; i++) {
      const feedback = await Feedback.create({
        ...feedbackData[i],
        user_id: existingUsers[i % existingUsers.length]._id,
        resolvedBy: feedbackData[i].status === "resolved" ? librarians[0]?._id : undefined,
        resolvedAt: feedbackData[i].status === "resolved" ? new Date() : undefined
      });
      createdFeedback.push(feedback);
      console.log(`  ✅ Added feedback: ${feedback.subject}`);
    }

    // 3. Add some Borrow records
    console.log("📖 Adding borrow records...");
    const borrowStatuses = ["pending", "approved", "issued", "returned", "overdue"];
    
    for (let i = 0; i < Math.min(15, createdBooks.length * 2); i++) {
      const randomUser = existingUsers[Math.floor(Math.random() * existingUsers.length)];
      const randomBook = createdBooks[Math.floor(Math.random() * createdBooks.length)];
      const randomStatus = borrowStatuses[Math.floor(Math.random() * borrowStatuses.length)];
      
      const borrowDate = new Date();
      borrowDate.setDate(borrowDate.getDate() - Math.floor(Math.random() * 30)); // Random date within last 30 days
      
      const dueDate = new Date(borrowDate);
      dueDate.setDate(dueDate.getDate() + 14); // 14 days from borrow date
      
      const borrow = await Borrow.create({
        user_id: randomUser._id,
        book_id: randomBook._id,
        status: randomStatus,
        requestDate: borrowDate,
        dueDate: randomStatus === "issued" || randomStatus === "overdue" ? dueDate : undefined,
        issuedAt: randomStatus === "issued" || randomStatus === "returned" || randomStatus === "overdue" ? borrowDate : undefined,
        returnDate: randomStatus === "returned" ? new Date() : undefined,
        processedBy: librarians[0]?._id,
        notes: `Sample borrow record #${i + 1}`
      });
      
      console.log(`  ✅ Added borrow: ${randomUser.name} - ${randomBook.title} (${randomStatus})`);
    }

    // 4. Add Notifications
    console.log("🔔 Adding notifications...");
    for (const notifData of notificationsData) {
      // Add notification for all users
      const notifications = existingUsers.map(user => ({
        user_id: user._id,
        title: notifData.title,
        message: notifData.message,
        type: notifData.type,
        sentBy: librarians[0]?._id
      }));
      
      await Notification.insertMany(notifications);
      console.log(`  ✅ Added notification: ${notifData.title} (sent to ${existingUsers.length} users)`);
    }

    // 5. Add some Payment records (fines)
    console.log("💰 Adding payment records...");
    for (let i = 0; i < 5; i++) {
      const randomUser = existingUsers[Math.floor(Math.random() * existingUsers.length)];
      const fineAmount = [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)];
      
      const payment = await Payment.create({
        user_id: randomUser._id,
        amount: fineAmount,
        type: "fine",
        description: `Late return fine #${i + 1}`,
        status: Math.random() > 0.3 ? "completed" : "pending",
        paymentMethod: ["cash", "card", "online"][Math.floor(Math.random() * 3)]
      });
      
      console.log(`  ✅ Added payment: $${fineAmount} fine for ${randomUser.name}`);
    }

    // Summary
    console.log("\n🎉 Library data seeding completed successfully!");
    console.log("📊 Summary:");
    console.log(`  📚 Books: ${createdBooks.length}`);
    console.log(`  💬 Feedback entries: ${createdFeedback.length}`);
    console.log(`  📖 Borrow records: ~15`);
    console.log(`  🔔 Notifications: ${notificationsData.length * existingUsers.length}`);
    console.log(`  💰 Payment records: 5`);
    
  } catch (error) {
    console.error("❌ Error seeding library data:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the seeder
if (require.main === module) {
  seedLibraryData();
}

module.exports = seedLibraryData;