require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");

const User = require("../models/user");
const Device = require("../models/Device");
const Router = require("../models/Router");
const Efile = require("../models/Efile");

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "netgear_project",
    });

    console.log("MongoDB connected for migration");

    // READ JSON FILES
    const users = JSON.parse(fs.readFileSync("./users.json", "utf8"));
    const routers = JSON.parse(fs.readFileSync("./routers.json", "utf8"));
    const devices = JSON.parse(fs.readFileSync("./devices.json", "utf8"));
    
    let efile = [];
    try {
      efile = JSON.parse(fs.readFileSync("./efile.json", "utf8"));
    } catch {}

    // CLEAR EXISTING COLLECTIONS
    await User.deleteMany({});
    await Router.deleteMany({});
    await Device.deleteMany({});
    await Efile.deleteMany({});

    // INSERT USERS
    for (const u of users) {
      await User.create({
        username: u.username,
        email: u.email || `${u.username}@local.com`,
        passwordHash: u.passwordHash,
        settings: u.settings || { theme: "system" },
      });
    }

    // INSERT ROUTERS
    await Router.insertMany(routers);

    // INSERT DEVICES
    await Device.insertMany(devices);

    // INSERT EFILE (optional)
    if (efile.length > 0) await Efile.insertMany(efile);

    console.log("Migration complete 🎉");
    process.exit();
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

start();
