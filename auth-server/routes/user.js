// auth-server/routes/user.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const User = require("../models/user"); // correct relative path

const BASE = path.join(__dirname, "..");
const USERS_JSON = path.join(BASE, "users.json");
const EFILE = path.join(BASE, "efile.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "8h";

// ensure files exist
if (!fs.existsSync(USERS_JSON)) fs.writeFileSync(USERS_JSON, JSON.stringify([], null, 2));
if (!fs.existsSync(EFILE)) fs.writeFileSync(EFILE, JSON.stringify([], null, 2));

function readJSON(file, fallback = []) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

/* ---------------------------------------
   REGISTER
---------------------------------------*/
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body || {};

    if (!password || !confirmPassword || (!username && !email)) {
      return res.status(400).json({ status: false, message: "username/email and passwords required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ status: false, message: "Passwords do not match" });
    }

    // check duplicates (username or email)
    const query = {};
    if (username) query.username = username;
    if (email) query.email = email;

    const existing = await User.findOne({
      $or: [
        username ? { username } : null,
        email ? { email } : null
      ].filter(Boolean)
    }).exec();

    if (existing) {
      return res.status(409).json({ status: false, message: "User (username/email) already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await User.create({
      username: username || undefined,
      email: email || undefined,
      passwordHash,
      settings: { theme: "system" }
    });

    // mirror minimal record in users.json for UI mocks
    const usersList = readJSON(USERS_JSON, []);
    usersList.push({
      id: created._id.toString(),
      username: created.username || null,
      email: created.email || null,
      createdAt: created.createdAt
    });
    writeJSON(USERS_JSON, usersList);

    // audit log in efile.json (no secret)
    const e = readJSON(EFILE, []);
    e.push({ action: "register", userId: created._id.toString(), username: created.username || created.email, at: new Date().toISOString() });
    writeJSON(EFILE, e);

    return res.status(201).json({ status: true, message: "User created", user: { id: created._id.toString(), username: created.username, email: created.email } });
  } catch (err) {
    console.error("REGISTER error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});

/* ---------------------------------------
   LOGIN
---------------------------------------*/
router.post("/login", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!password || (!username && !email)) {
      return res.status(400).json({ status: false, message: "username/email and password required" });
    }

    const user = await User.findOne({
      $or: [
        username ? { username } : null,
        email ? { email } : null
      ].filter(Boolean)
    }).exec();

    if (!user) return res.status(401).json({ status: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ status: false, message: "Invalid credentials" });

    const token = jwt.sign({ sub: user._id.toString(), username: user.username || user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // write token record to efile.json for dev debugging
    const e = readJSON(EFILE, []);
    e.push({ token, username: user.username || user.email, loggedAt: new Date().toISOString() });
    writeJSON(EFILE, e);

    return res.json({ status: true, token });
  } catch (err) {
    console.error("LOGIN error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});

module.exports = router;
