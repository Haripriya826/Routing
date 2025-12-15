// =======================
// server.js (UPDATED)
// =======================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// MongoDB Connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "netgear_project" });
    console.log("MongoDB connected 🟢");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

connectDB();

// MODELS
const User = require("./models/user");
const Device = require("./models/Device");
const Router = require("./models/Router");
const Efile = require("./models/Efile");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_in_prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })
);
app.use(express.json());

// ----------------- AUTH MIDDLEWARE -----------------
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token)
      return res
        .status(401)
        .json({ status: false, message: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.sub || decoded.id).exec();
    if (!user)
      return res.status(401).json({ status: false, message: "User not found" });

    req.user = user;
    req.token = token;

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res
      .status(401)
      .json({ status: false, message: "Invalid or expired token" });
  }
}

// ----------------- AUTH ROUTES -----------------

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!email || !password)
      return res
        .status(400)
        .json({ status: false, message: "Email and password required" });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res
        .status(409)
        .json({ status: false, message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
        username,
        email,
        passwordHash,
        settings: { theme: "system" },

        // ⭐ VERY IMPORTANT
        permissions: {
          canMonitor: false,
          canConfigure: false,
        },
      });


    res.json({ status: true, user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!password)
      return res
        .status(400)
        .json({ status: false, message: "Password required" });

    const user = await User.findOne({
      $or: [username ? { username } : null, email ? { email } : null].filter(
        Boolean
      ),
    });

    if (!user)
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username || user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await Efile.create({
      token,
      username: user.username || user.email,
      loggedAt: new Date(),
    });

    res.json({ status: true, token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
});

// LOGOUT → remove token entry
app.delete("/api/efile/remove", requireAuth, async (req, res) => {
  try {
    await Efile.deleteOne({ token: req.token });
    res.json({ status: true, message: "Token removed" });
  } catch (err) {
    res.status(500).json({ status: false, message: "Error removing token" });
  }
});

// ----------------- USER SETTINGS -----------------

// ⭐ UPDATED /api/me — includes permissions + username for frontend navigation
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // load all routers
    const rawRouters = await Router.find().lean();

    // find router for this user
    let router = rawRouters.find(
      (r) =>
        (r.userName || "").toLowerCase() ===
        (user.username || "").toLowerCase()
    );

    // fallback so frontend NEVER breaks
    if (!router && rawRouters.length > 0) router = rawRouters[0];

    // ⭐ NEW: include permissions + username in response
    const safeUser = {
      id: user._id,
      username: user.username,
      email: user.email,
      settings: user.settings || { theme: "system" },

      // ⭐ ADDED — permissions sent to frontend
      permissions: {
        canMonitor: user.permissions?.canMonitor ?? false,
        canConfigure: user.permissions?.canConfigure ?? false
      },

    };

    return res.json({
      status: true,
      user: safeUser,
      router: router ? normalizeRouter(router) : null,
    });
  } catch (err) {
    console.error("/api/me error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// ----------------- USER THEME SETTINGS -----------------
app.get("/api/user/settings", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      status: true,
      settings: user.settings || { theme: "system" },
    });
  } catch (err) {
    console.error("GET /api/user/settings error:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
});

const adminRoutes = require("./routes/admin");
app.use("/api/admin", requireAuth, adminRoutes);

app.post("/api/user/settings", requireAuth, async (req, res) => {
  try {
    const { theme } = req.body || {};
    if (!["system", "light", "dark"].includes(theme))
      return res
        .status(400)
        .json({ status: false, message: "Invalid theme" });

    req.user.settings.theme = theme;
    await req.user.save();

    res.json({ status: true, settings: req.user.settings });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
});

// ----------------- NORMALIZE ROUTER -----------------
function normalizeRouter(raw) {
  if (!raw) return null;

  const r = JSON.parse(JSON.stringify(raw));

  r.connectivity = r.connectivity || {};
  r.connectivity.WAN1Load ||= "0%";
  r.connectivity.WAN2Load ||= "0%";
  r.connectivity.attachedDevices ||= 0;

  r.systemInfo = r.systemInfo || {};
  r.systemInfo.model ||= "PR60X";
  r.systemInfo.region ||= "Worldwide";
  r.systemInfo.currentTime ||= new Date().toString();

  return r;
}

// ----------------- ROUTER ENDPOINTS -----------------
app.get("/api/routers", requireAuth, async (req, res) => {
  const routers = await Router.find().lean();
  res.json({ status: true, routers: routers.map(normalizeRouter) });
});

app.get("/api/router/:id", requireAuth, async (req, res) => {
  const router = await Router.findById(req.params.id).lean();
  res.json({ status: true, router: normalizeRouter(router) });
});

// ----------------- DEVICES -----------------
app.get("/api/devices", requireAuth, async (req, res) => {
  const devices = await Device.find().lean();
  res.json({ status: true, devices });
});

// ----------------- START SERVER -----------------
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
