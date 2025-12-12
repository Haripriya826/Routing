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
  username: { type: String, required: false, index: true }, // optional but useful for your frontend
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },

  settings: { type: SettingsSchema, default: () => ({}) },
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Device" }],
  routers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Router" }],
  permissions: {
    canMonitor: { type: Boolean, default: true },
    canConfigure: { type: Boolean, default: false }
  }

}, { timestamps: true });

// create a small convenience virtual to return a display name
UserSchema.virtual("displayName").get(function () {
  return this.username || this.email;
});

module.exports = mongoose.model("User", UserSchema);
