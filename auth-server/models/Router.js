const mongoose = require("mongoose");

const RouterSchema = new mongoose.Schema({
  routerName: String,
  userName: String,

  connectivity: {
    WAN1Load: String,
    WAN2Load: String,
    attachedDevices: Number,
  },

  systemInfo: {
    model: String,
    region: String,
    ethernetMAC: String,
    serialNumber: String,
    systemUpTime: String,
    currentTime: String,
    insightMode: String,
    fanSpeed: String,
    temperature: String,
    firmwareVersion: String,
    firmwareStatus: String,
  },

  internetPortStatus: mongoose.Schema.Types.Mixed,
  ethernetPortStatus: mongoose.Schema.Types.Mixed,
  vpnStatus: mongoose.Schema.Types.Mixed,
  vlanStatus: mongoose.Schema.Types.Mixed,

}, { timestamps: true });

module.exports = mongoose.model("Router", RouterSchema);
