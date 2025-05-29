const express = require('express');
const multer = require('multer');
const path = require('path');
const Book = require('../models/Book');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif/;
  if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Only image files are allowed.'));
};

const upload = multer({ storage, fileFilter });

// POST /books/add — add book
router.post('/add', upload.single('cover'), async (req, res) => {
  try {
    const {
      book_id,
      title,
      category,
      publisher,
      total_copies,
      available_copies
    } = req.body;

    const newBook = new Book({
      book_id,
      title,
      category,
      publisher,
      total_copies,
      available_copies,
      cover_image_url: req.file ? `/uploads/${req.file.filename}` : null
    });

    await newBook.save();
    res.status(201).json({ message: 'Book added successfully', book: newBook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
