const User = require("../models/User");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = "1d";
const REFRESH_EXPIRES_IN = "7d";

// Helper function to get consistent cookie options
const getCookieOptions = (maxAgeMs) => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: maxAgeMs,
  };
};

// Enhanced login with better cookie settings
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  // Use passport-local-mongoose's model-level authenticate
  const { user, error } = await new Promise((resolve) => {
    User.authenticate()(email, password, (err, user, info) => {
      if (err || !user) {
        resolve({ user: null, error: info?.message || "Invalid credentials" });
      } else {
        resolve({ user, error: null });
      }
    });
  });

  if (error) {
    return res.status(401).json({ message: error });
  }

  // Clean up expired tokens before creating new ones
  await user.removeExpiredTokens();

  const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

  await user.addRefreshToken(refreshToken);

  // Set cookies with appropriate expiry times
  res
    .cookie("accessToken", accessToken, getCookieOptions(24 * 60 * 60 * 1000)) // 1 day
    .cookie("refreshToken", refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)) // 7 days
    .json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      redirectTo:
        user.role === "admin"
          ? `/admin`
          : user.role === "librarian"
          ? `/librarian`
          : `/user`,
    });
});

// SECURED: Only admins can set custom roles during registration
exports.register = catchAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: "Email already registered" });
  }

  // SECURITY: Only allow role setting if requester is an authenticated admin
  let userRole = "user"; // Default role for all new users

  if (role && req.user && req.user.role === "admin") {
    // Validate the role being set
    const validRoles = ["user", "librarian", "admin"];
    if (validRoles.includes(role)) {
      userRole = role;
    } else {
      return res.status(400).json({
        message: "Invalid role. Must be one of: " + validRoles.join(", "),
      });
    }
  } else if (role && (!req.user || req.user.role !== "admin")) {
    // If role is provided but user is not admin, reject the request
    return res.status(403).json({
      message: "Forbidden: Only admins can assign custom roles",
    });
  }

  const newUser = new User({ name, email, role: userRole });
  await User.register(newUser, password);

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

// PUBLIC registration endpoint (no role assignment allowed)
exports.publicRegister = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: "Email already registered" });
  }

  // Always create as 'user' role for public registration
  const newUser = new User({ name, email, role: "user" });
  await User.register(newUser, password);

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  const user = await User.findById(payload.id);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // Clean up expired tokens before checking if the token exists
  await user.removeExpiredTokens();

  if (!user.hasRefreshToken(refreshToken)) {
    return res.status(403).json({ message: "Refresh token revoked" });
  }

  // Token is valid and exists: rotate it
  await user.removeRefreshToken(refreshToken); // Remove old
  
  const newRefreshToken = jwt.sign(
    { id: user._id, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
  
  const newAccessToken = jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
  
  await user.addRefreshToken(newRefreshToken); // Add new
  
  // FIXED: Added proper response with correct cookie expiry times
  res
    .cookie("accessToken", newAccessToken, getCookieOptions(24 * 60 * 60 * 1000)) // 1 day
    .cookie("refreshToken", newRefreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)) // 7 days
    .json({
      message: "Tokens refreshed successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
});

// Improved logout with better error handling
exports.logout = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const { allDevices = false } = req.body;

  // Get consistent cookie clear options
  const clearCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  };

  if (!refreshToken) {
    return res
      .clearCookie("accessToken", clearCookieOptions)
      .clearCookie("refreshToken", clearCookieOptions)
      .json({ message: "No active session found" });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    // Invalid token - still clear cookies and return success
    return res
      .clearCookie("accessToken", clearCookieOptions)
      .clearCookie("refreshToken", clearCookieOptions)
      .json({ message: "Logged out successfully" });
  }

  const user = await User.findById(payload.id);
  if (user) {
    try {
      // Clean up expired tokens during logout
      await user.removeExpiredTokens();

      if (allDevices) {
        await user.clearAllRefreshTokens();
      } else {
        await user.removeRefreshToken(refreshToken);
      }
    } catch (error) {
      console.error("Error cleaning up tokens:", error);
      // Continue with logout even if cleanup fails
    }
  }

  res
    .clearCookie("accessToken", clearCookieOptions)
    .clearCookie("refreshToken", clearCookieOptions)
    .json({ message: "Logged out successfully" });
});

// Get current authenticated user info
exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select(
    "-password -refreshTokens"
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});