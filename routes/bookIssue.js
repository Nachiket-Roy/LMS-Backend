const express = require('express');
const router = express.Router();
const { issueBook, returnBook } = require('../controllers/bookIssueReturnContoller');

// Issue book route
router.post('/issue', issueBook);

// Return book route
router.post('/return/:issue_id', returnBook);

module.exports = router;
