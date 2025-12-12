const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Device = require("../models/Device");
const RouterModel = require("../models/Router");
const bcrypt = require("bcrypt");

// get all users + their routers
router.get("/users", async (req, res) => {
  const users = await User.find()
    .populate("devices")
    .populate("routers")
    .lean();

  res.json({ status: true, users });
});

// get devices + routers for dropdowns
router.get("/resources", async (req, res) => {
  const devices = await Device.find().lean();
  const routers = await RouterModel.find().lean();
  res.json({ status: true, devices, routers });
});

// create user
router.post("/create-user", async (req, res) => {
  const { username, password, devices, routers, permissions } = req.body;

  if (!username || !password)
    return res.status(400).json({ status: false, message: "Missing data" });

  const exists = await User.findOne({ username });
  if (exists) return res.status(409).json({ status: false, message: "User exists" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    username,
    email: username + "@local.com",
    passwordHash,
    devices,
    routers,
    permissions
  });

  res.json({ status: true, user });
});

router.delete("/delete-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    // Prevent deleting the main admin account
    if (user.username === "admin") {
      return res.status(400).json({
        status: false,
        message: "Admin account cannot be deleted",
      });
    }

    await User.findByIdAndDelete(userId);

    return res.json({ status: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete User Error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});

// --------------------------------------------------
// UPDATE USER PERMISSIONS
// --------------------------------------------------
router.put("/update-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, password, permissions } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    // Prevent renaming the admin account
    if (user.username === "admin" && username !== "admin") {
      return res.status(400).json({
        status: false,
        message: "Admin username cannot be changed",
      });
    }

    // Check if new username already exists
    if (username && username !== user.username) {
      const exists = await User.findOne({ username });
      if (exists)
        return res
          .status(400)
          .json({ status: false, message: "Username already taken" });

      user.username = username;
      user.email = `${username}@local.com`; // maintain unique email
    }

    // Update password only if provided
    if (password && password.trim().length > 0) {
      user.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    // Update permissions
    if (permissions) {
      user.permissions = permissions;
    }

    await user.save();

    return res.json({
      status: true,
      message: "User updated successfully",
      user,
    });
  } catch (err) {
    console.error("Update User Error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error while updating user",
    });
  }
});
module.exports = router;
