const express = require("express");
const cookieParser = require('cookie-parser')
require("dotenv").config();
const mongoose = require("mongoose");
const passport = require('./config/passport');// const authRoutes = require('./routes/authRoutes');
// const bookIssueRoutes = require('./routes/issue&returnRoute');
const path = require("path");
// const booksRouter = require('./routes/booksRoutes');
const app = express();
// const topBooks = require('./routes/topBookRouter')
const User = require("./routes/userRoute");
const router = require("./routes/auth");
const Librarian = require("./routes/librarian")
const Admin = require("./routes/admin")
const cors = require("cors");
// const User = require('./models/User');
// MongoDB connection
const DB = process.env.MONGODB;
mongoose
  .connect(DB)
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => console.error(" MongoDB connection error:", err));


// Middleware
app.use(cors({
  origin: "http://localhost:5173", // Change to your frontend domain
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());


// Passport initialization
app.use(passport.initialize());

const PORT = process.env.PORT || 5000;
app.use("/auth", router);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", User);
app.use("/api", Librarian);
app.use("/api", Admin);
// Catch all error
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  res.status(statusCode).json({ error: message });
});

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
