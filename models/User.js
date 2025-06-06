const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const refreshTokenSchema = new mongoose.Schema({
  token: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false }); // No need for _id in subdocs

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    contact: String,
    address: String,
    role: {
      type: String,
      enum: ["user", "admin", "librarian"],
      default: "user",
    },
    refreshTokens: [refreshTokenSchema],
  },
  { timestamps: true }
);

// Plugin adds username, hash, salt + authentication methods
UserSchema.plugin(passportLocalMongoose, { usernameField: "email" });

// Methods
UserSchema.methods.addRefreshToken = function (token) {
  this.refreshTokens.push({ token, createdAt: new Date() });
  return this.save();
};

UserSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
  return this.save();
};

UserSchema.methods.hasRefreshToken = function (token) {
  return this.refreshTokens.some(t => t.token === token);
};

UserSchema.methods.clearAllRefreshTokens = function () {
  this.refreshTokens = [];
  return this.save();
};

UserSchema.methods.removeExpiredTokens = function () {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  this.refreshTokens = this.refreshTokens.filter(t => t.createdAt > cutoff);
  return this.save();
};

module.exports = mongoose.model("User", UserSchema);
