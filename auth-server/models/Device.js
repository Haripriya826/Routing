const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  deviceName: String,
  ipAddress: String,
  ipv6Address: String,
  macAddress: String,
  port: String,
  vlan: String
}, { timestamps: true });

module.exports = mongoose.model("Device", DeviceSchema);
