const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport')
const auth = passport.authenticate('jwt', { session: false });

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me',auth, authController.getMe)
router.post('/public-register', authController.publicRegister); // For public self-signup

module.exports = router; 
