const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "netgear_project" });
    console.log("MongoDB connected 🟢");
  } catch (err) {
    console.error("MongoDB error ❌:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
