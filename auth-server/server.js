// =======================
// server.js (CLOUD READY)
// =======================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// =======================
// CONFIG
// =======================
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_in_prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// =======================
// MONGODB CONNECTION
// =======================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "netgear_project",
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("🟢 MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
}

connectDB();

// =======================
// MODELS
// =======================
const User = require("./models/user");
const Device = require("./models/Device");
const Router = require("./models/Router");
const Efile = require("./models/Efile");

// =======================
// APP SETUP
// =======================
const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://router-mngt.vercel.app",
  "https://routing-tp0l.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server / curl / postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    credentials: true,
  })
);

// 🔴 THIS LINE IS MANDATORY
app.options("*", cors());


app.use(express.json());

// =======================
// HEALTH CHECK (RENDER)
// =======================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// =======================
// AUTH MIDDLEWARE
// =======================
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.replace("Bearer ", "")
        : req.headers["x-auth-token"];

    if (!token) {
      return res
        .status(401)
        .json({ status: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.sub || decoded.id).exec();

    if (!user) {
      return res
        .status(401)
        .json({ status: false, message: "User not found" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ status: false, message: "Invalid or expired token" });
  }
}

// =======================
// AUTH ROUTES
// =======================

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: false, message: "Email and password required" });
    }

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      return res
        .status(409)
        .json({ status: false, message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      passwordHash,
      settings: { theme: "system" },
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

    if (!password) {
      return res
        .status(400)
        .json({ status: false, message: "Password required" });
    }

    const user = await User.findOne({
      $or: [username ? { username } : null, email ? { email } : null].filter(
        Boolean
      ),
    });

    if (!user) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials" });
    }

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

// LOGOUT
app.delete("/api/efile/remove", requireAuth, async (req, res) => {
  try {
    await Efile.deleteOne({ token: req.token });
    res.json({ status: true, message: "Token removed" });
  } catch {
    res.status(500).json({ status: false, message: "Error removing token" });
  }
});

// =======================
// DASHBOARD
// =======================
app.get("/api/dash", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const routers = await Router.find().lean();

    let router = routers.find(
      (r) =>
        (r.userName || "").toLowerCase() ===
        (user.username || "").toLowerCase()
    );

    if (!router && routers.length > 0) router = routers[0];

    res.json({
      status: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        settings: user.settings || { theme: "system" },
        permissions: {
          canMonitor: user.permissions?.canMonitor ?? false,
          canConfigure: user.permissions?.canConfigure ?? false,
        },
      },
      router: router ? normalizeRouter(router) : null,
    });
  } catch (err) {
    console.error("/api/dash error:", err);
    res.status(500).json({ status: false, message: "Internal error" });
  }
});

const adminRoutes = require("./routes/admin");
app.use("/api/admin", requireAuth, adminRoutes);

// =======================
// USER SETTINGS
// =======================
app.get("/api/user/settings", requireAuth, async (req, res) => {
  res.json({
    status: true,
    settings: req.user.settings || { theme: "system" },
  });
});

app.post("/api/user/settings", requireAuth, async (req, res) => {
  const { theme } = req.body || {};

  if (!["system", "light", "dark"].includes(theme)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid theme" });
  }

  req.user.settings.theme = theme;
  await req.user.save();

  res.json({ status: true, settings: req.user.settings });
});

// =======================
// ROUTERS & DEVICES
// =======================
app.get("/api/routers", requireAuth, async (req, res) => {
  const routers = await Router.find().lean();
  res.json({ status: true, routers: routers.map(normalizeRouter) });
});

app.get("/api/router/:id", requireAuth, async (req, res) => {
  const router = await Router.findById(req.params.id).lean();
  res.json({ status: true, router: normalizeRouter(router) });
});

app.get("/api/devices", requireAuth, async (req, res) => {
  const devices = await Device.find().lean();
  res.json({ status: true, devices });
});

// =======================
// HELPERS
// =======================
function normalizeRouter(raw) {
  if (!raw) return null;
  const r = JSON.parse(JSON.stringify(raw));

  r.connectivity ||= {};
  r.connectivity.WAN1Load ||= "0%";
  r.connectivity.WAN2Load ||= "0%";
  r.connectivity.attachedDevices ||= 0;

  r.systemInfo ||= {};
  r.systemInfo.model ||= "PR60X";
  r.systemInfo.region ||= "Worldwide";
  r.systemInfo.currentTime ||= new Date().toString();

  return r;
}

// =======================
// START SERVER
// =======================
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
