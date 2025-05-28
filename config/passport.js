const passport = require('passport');
const User = require('../models/User');
const LocalStrategy = require('passport-local').Strategy;

// Use passport-local-mongoose strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));

// Serialize user by _id and role
passport.serializeUser((user, done) => {
  done(null, { id: user._id, role: user.role });
});

// Deserialize user based on stored id
passport.deserializeUser(async (userObj, done) => {
  try {
    const user = await User.findById(userObj.id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;