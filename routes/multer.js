
const multer = require("multer")
const path = require('path');

// Multer config for file uploads

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Make sure this folder exists
  },
  filename: (req, file, cb) => {
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

// ✅ You missed this line:
const upload = multer({ storage, fileFilter });
module.exports = upload; // ✅ export the instance itself
