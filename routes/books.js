const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');
const multer = require('multer');
const { authorizeRoles } = require('../middlwares/authorizeRoles');
const librarianController = require('../controllers/librarianController');

// JWT auth middleware (no sessions)
const auth = passport.authenticate('jwt', { session: false });

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Make sure this folder exists and is writable
  },
  filename: (req, file, cb) => {
    // Unique filename with timestamp + original extension
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'));
  }
};

const upload = multer({ storage, fileFilter });

// POST /books - Add a new book with optional cover image
router.post(
  '/books',
  auth,
  authorizeRoles('librarian', 'admin'),
  upload.single('cover'), // 'cover' is the field name expected in the form-data
  librarianController.addBook
);

module.exports = router;
