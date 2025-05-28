const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Login route
router.post('/login', passport.authenticate('local'), (req, res) => {
    const role = req.user.role;

    if (role === 'admin') return res.redirect('/dashboard/admin');
    if (role === 'librarian') return res.redirect('/dashboard/librarian');
    return res.redirect('/dashboard/user');
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
