const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User'); // adjust path if needed

mongoose.connect(process.env.MONGODB)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        // Clear existing users
        await User.deleteMany({});
        console.log('🧹 Cleared existing users');

        // Seed users (with hashed passwords via .register)
        await User.register(new User({
            name: 'Alice Admin',
            email: 'admin@example.com',
            password: '1234',
            role: 'admin',
        }), 'adminpass');

        await User.register(new User({
            name: 'Bob Librarian',
            email: 'librarian@example.com',
            password: '1234',
            role: 'librarian',
        }), 'librarianpass');

        await User.register(new User({
            name: 'Charlie User',
            email: 'user@example.com',
            password: '1234',
            role: 'user',
        }), 'userpass');

        console.log(' Seeded users successfully');
        process.exit();
    })
    .catch((err) => {
        console.error(' MongoDB connection error:', err);
        process.exit(1);
    });
