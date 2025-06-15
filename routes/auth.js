const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const catchAsync = require('../utils/catchAsync');
const { authorizeRoles } = require('../middlwares/authorizeRoles');

const auth = passport.authenticate('jwt', { session: false });

// Public routes (no authentication required)
router.post('/login', catchAsync(authController.login));
router.post('/register',auth, authorizeRoles("admin"), catchAsync(authController.register));
router.post('/refresh-token', catchAsync(authController.refreshToken));
router.post('/public-register', catchAsync(authController.publicRegister));

// Protected routes (require JWT authentication)
router.post('/logout', auth, catchAsync(authController.logout));
router.get('/me', auth, catchAsync(authController.getMe));

module.exports = router;