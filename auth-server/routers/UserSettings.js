// server/routes/userSettings.js
const express = require("express");
const router = express.Router();
const auth = require("./middleware/auth");

// GET /api/user/settings
router.get("/settings", auth, async (req, res) => {
  try {
    const settings = (req.user && req.user.settings) || { theme: "system" };
    return res.json({ success: true, settings });
  } catch (err) {
    console.error("get settings err", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/user/settings  { theme: "dark" }
router.post("/settings", auth, async (req, res) => {
  try {
    const { theme } = req.body;
    const allowed = ["system", "dark", "light"];
    if (theme !== undefined && !allowed.includes(theme)) {
      return res.status(400).json({ success: false, message: "Invalid theme" });
    }

    const user = req.user;
    user.settings = user.settings || {};
    if (theme !== undefined) user.settings.theme = theme;

    await user.save();

    return res.json({ success: true, settings: user.settings });
  } catch (err) {
    console.error("save settings err", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
