const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/passport')
const authRoutes = require('./routes/auth'); 
const bookIssueRoutes = require('./routes/bookIssue');
const path = require('path');
const booksRouter = require('./routes/booksRoutes'); // adjust path if needed
const app = express();

// MongoDB connection
const DB = process.env.MONGODB;
mongoose.connect(DB)
    .then(() => console.log(' MongoDB connected'))
    .catch((err) => console.error(' MongoDB connection error:', err));

// Middleware
app.use(express.json());

// Express session
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultSecret', // Store secret in .env
    resave: false,
    saveUninitialized: false,
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());


const PORT = process.env.PORT || 5000;

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', authRoutes);
app.use('/book-issues', bookIssueRoutes);
app.use('/books', booksRouter);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
// app.post('/login', passport.authenticate('local'), (req, res) => {
//   const role = req.user.role;

//   if (role === 'admin') return res.redirect('/dashboard/admin');
//   if (role === 'librarian') return res.redirect('/dashboard/librarian');
//   return res.redirect('/dashboard/user');
// });

// function requireRole(role) {
//   return (req, res, next) => {
//     if (req.isAuthenticated() && req.user.role === role) return next();
//     return res.status(403).send('Forbidden');
//   };
// }

// Example usage:
// app.get('/dashboard/admin', requireRole('admin'), (req, res) => {
//   res.send('Welcome to Admin Dashboard');
// });
