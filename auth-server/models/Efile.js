const mongoose = require("mongoose");

const EfileSchema = new mongoose.Schema({
  token: String,
  username: String,
  loggedAt: Date,
  action: String,
}, { timestamps: true });

module.exports = mongoose.model("Efile", EfileSchema);
