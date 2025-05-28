const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose')

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  role: {
    type: String,
    enum: ['user', 'admin', 'librarian'],
    default: 'user',
  },
});

UserSchema.plugin(passportLocalMongoose, { usernameField: 'email' })

module.exports = mongoose.model('User', UserSchema);
