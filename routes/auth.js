const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Login route
router.post('/login', passport.authenticate('local'), (req, res) => {
  const { role, _id, name } = req.user;

  // Redirect to role-based URL with user ID or name
  if (role === 'admin') return res.redirect(`/dashboard/${_id}`);
  if (role === 'librarian') return res.redirect(`/dashboard/${name}`);
  return res.redirect(`/dashboard/user/${_id}`);
});

// Register route
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const newUser = new User({ name, email, role: role || 'user' }); // omit password
        await User.register(newUser, password); // pass password separately
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


module.exports = router;
