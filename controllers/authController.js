const User = require('../models/User');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = '1d';
const REFRESH_EXPIRES_IN = '7d';

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid email or password' });

  const isValid = await user.authenticate(password);
  if (!isValid) return res.status(401).json({ message: 'Invalid email or password' });

  // Clean up expired tokens before creating new ones
  await user.removeExpiredTokens();

  const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ id: user._id, role: user.role }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });

  // Save refresh token to user document
  await user.addRefreshToken(refreshToken);

  res.json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    redirectTo:
      user.role === 'admin'
        ? `/dashboard/${user._id}`
        : user.role === 'librarian'
        ? `/dashboard/${user._id}`
        : `/dashboard/user/${user._id}`,
  });
});

// SECURED: Only admins can set custom roles during registration
exports.register = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  // SECURITY: Only allow role setting if requester is an authenticated admin
  let userRole = 'user'; // Default role for all new users
  
  if (role && req.user && req.user.role === 'admin') {
    // Validate the role being set
    const validRoles = ['user', 'librarian', 'admin'];
    if (validRoles.includes(role)) {
      userRole = role;
    } else {
      return res.status(400).json({ 
        message: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      });
    }
  } else if (role && (!req.user || req.user.role !== 'admin')) {
    // If role is provided but user is not admin, reject the request
    return res.status(403).json({ 
      message: 'Forbidden: Only admins can assign custom roles' 
    });
  }

  const newUser = new User({ name, email, role: userRole });
  await User.register(newUser, password);

  res.status(201).json({ 
    message: 'User registered successfully',
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// PUBLIC registration endpoint (no role assignment allowed)
exports.publicRegister = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  // Always create as 'user' role for public registration
  const newUser = new User({ name, email, role: 'user' });
  await User.register(newUser, password);

  res.status(201).json({ 
    message: 'User registered successfully',
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  const user = await User.findById(payload.id);
  if (!user) return res.status(401).json({ message: 'User not found' });

  // Clean up expired tokens before checking if the token exists
  await user.removeExpiredTokens();

  if (!user.hasRefreshToken(refreshToken)) {
    return res.status(403).json({ message: 'Refresh token revoked' });
  }

  // Token is valid and exists: rotate it
  await user.removeRefreshToken(refreshToken); // Remove old
  const newRefreshToken = jwt.sign({ id: user._id, role: user.role }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
  await user.addRefreshToken(newRefreshToken); // Add new

  const newAccessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

exports.logout = catchAsync(async (req, res) => {
  const { refreshToken, allDevices } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    return res.json({ message: 'Logged out successfully' }); // Silent fail for invalid token
  }

  const user = await User.findById(payload.id);
  if (user) {
    // Clean up expired tokens during logout
    await user.removeExpiredTokens();
    
    if (allDevices) {
      await user.clearAllRefreshTokens(); // Invalidate all sessions
    } else {
      await user.removeRefreshToken(refreshToken); // Only remove the one used
    }
  }

  res.json({ message: 'Logged out successfully' });
});

// Optional: Periodic cleanup endpoint (call this from a cron job)
exports.cleanupAllExpiredTokens = catchAsync(async (req, res) => {
  // This should be called periodically (e.g., daily) to clean up all users
  const users = await User.find({ 'refreshTokens.0': { $exists: true } }); // Only users with tokens
  
  let cleanedCount = 0;
  for (const user of users) {
    const originalCount = user.refreshTokens.length;
    await user.removeExpiredTokens();
    if (user.refreshTokens.length < originalCount) {
      cleanedCount++;
    }
  }

  res.json({ 
    message: `Cleanup completed. Cleaned tokens from ${cleanedCount} users.`,
    usersProcessed: users.length 
  });
});