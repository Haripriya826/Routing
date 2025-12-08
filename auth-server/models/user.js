// server/models/User.js
const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  theme: {
    type: String,
    enum: ["system", "dark", "light"],
    default: "system",
  },
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  // ... your other fields ...
  settings: { type: SettingsSchema, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
