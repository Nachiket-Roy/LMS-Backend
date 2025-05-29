const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const User = require('../models/User');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const Fine = require('../models/Fine');

const DB = process.env.MONGODB;

async function seed() {
  try {
    await mongoose.connect(DB);

    // Clear existing data
    await User.deleteMany({});
    await Book.deleteMany({});
    await BookIssue.deleteMany({});
    await Fine.deleteMany({});

    // Seed users
    const users = await User.insertMany([
      {
        name: 'user',
        email: 'user@example.com',
        password: 'password123',
        role: 'user',
      },
      {
        name: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      },
      {
        name: 'librarian',
        email: 'librarian@example.com',
        password: 'password123',
        role: 'librarian',
      }
    ]);

    // Seed books
    const books = await Book.insertMany([
      {
        book_id: 'B001',
        title: 'Quantum Physics for Beginners',
        category: 'Science',
        publisher: 'TechBooks',
        total_copies: 5,
        available_copies: 4,
        cover_image_url: '/uploads/js.jpg'
      },
      {
        book_id: 'B002',
        title: 'The Haunted Manor',
        category: 'Horror',
        publisher: 'SpookyPress',
        total_copies: 3,
        available_copies: 0,
        cover_image_url: '/uploads/node.jpg'
      }
    ]);
    // Seed book issues
    const bookIssues = await BookIssue.insertMany([
      {
        issue_id: uuidv4(),
        book: books[0]._id,
        user_id: users[0]._id,
        issue_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'issued',
        fine_amount: 0,
      },
    ]);

    // Seed fines
    await Fine.insertMany([
      {
        user_id: users[0]._id,
        issue_id: bookIssues[0]._id,
        amount: 10.0,
        status: 'unpaid',
        payment_date: null,
        payment_mode: null,
      },
    ]);

    console.log(' Seed data inserted successfully');
  } catch (error) {
    console.error(' Error inserting seed data:', error);
  } finally {
    mongoose.connection.close();
  }
}

seed();
