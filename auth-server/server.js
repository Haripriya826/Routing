// auth-server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_in_prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const USERS_FILE = path.join(__dirname, "users.json");
const EFILE = path.join(__dirname, "efile.json");
const ROUTERS_FILE = path.join(__dirname, "routers.json");

// --- devices file constant + helpers ---
const DEVICES_FILE = path.join(__dirname, "devices.json");
function loadDevices() { return readJSON(DEVICES_FILE, []); }
function saveDevices(arr) { writeJSON(DEVICES_FILE, arr); }
// Ensure devices.json exists (creates empty array if missing)
if (!fs.existsSync(DEVICES_FILE)) {
  writeJSON(DEVICES_FILE, []);
  console.warn("devices.json missing — created empty auth-server/devices.json. Replace with your mock file if needed.");
}

// Simple file helpers
function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8") || "";
    return raw.trim() === "" ? fallback : JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(EFILE)) writeJSON(EFILE, []);
if (!fs.existsSync(ROUTERS_FILE)) {
  // one placeholder router to get the dashboard working out-of-the-box
  const placeholder = [
    {
      id: 1,
      routerName: "PR60X-admin",
      userName: "admin",
      connectivity: { WAN1Load: "50%", WAN2Load: "50%", attachedDevices: 1 },
      systemInfo: {
        model: "PR60X",
        region: "Worldwide",
        ethernetMAC: "34:12:BC:AF:10:F1",
        serialNumber: "79W12BTCBEA12",
        systemUpTime: "1 Hour, 27 Minutes, 19 Seconds",
        currentTime: new Date().toString(),
        insightMode: "Initializing",
        saseSecurity: "Off",
        fanSpeed: "0 RPM",
        temperature: "31°C / 87°F",
        firmwareVersion: "V3.1.0.103 (BETA)",
        firmwareStatus: "Firmware is up to date"
      },
      internetPortStatus: {
        WAN1: { status: "Offline", connectionType: "DHCP" },
        WAN2: { status: "Offline", connectionType: "DHCP" }
      },
      ethernetPortStatus: { LAN1: "100 Mbps", LAN2: "100 Mbps", LAN3: "0 Mbps", LAN4: "0 Mbps", WAN1: "0 Mbps", WAN2: "0 Mbps" },
      vpnStatus: { siteToSite: { inUse: 1, connected: 0, disconnected: 1 }, clientToSite: { inUse: 1, connected: 1, disconnected: 0 }, openVPN: { inUse: 1, connected: 0, disconnected: 0 }, wireGuard: { inUse: 0, connected: 0, disconnected: 0 } },
      vlanStatus: { activeVLAN: 1, ipv4: true, ipv6: false }
    }
  ];
  writeJSON(ROUTERS_FILE, placeholder);
  console.warn("routers.json missing — created placeholder routers.json. Replace with your full mock file.");
}

function loadUsers() { return readJSON(USERS_FILE, []); }
function saveUsers(users) { writeJSON(USERS_FILE, users); }

function loadEfile() { return readJSON(EFILE, []); }
function saveEfile(entries) { writeJSON(EFILE, entries); }

function loadRoutersRaw() { return readJSON(ROUTERS_FILE, []); }
function saveRouters(arr) { writeJSON(ROUTERS_FILE, arr); }

// Normalize router objects to stable shape expected by Dashboard
function normalizeRouter(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = JSON.parse(JSON.stringify(raw));

  // connectivity keys
  r.connectivity = r.connectivity || {};
  if (r.connectivity.WAN1load && !r.connectivity.WAN1Load) r.connectivity.WAN1Load = r.connectivity.WAN1load;
  if (r.connectivity.WAN2load && !r.connectivity.WAN2Load) r.connectivity.WAN2Load = r.connectivity.WAN2load;
  if (r.connectivity.attachedDevices === undefined) r.connectivity.attachedDevices = r.attachedDevices ?? r.devices ?? 0;

  // system info defaults
  r.systemInfo = r.systemInfo || {};
  r.systemInfo.model = r.systemInfo.model || r.model || "PR60X";
  r.systemInfo.region = r.systemInfo.region || "Worldwide";
  r.systemInfo.ethernetMAC = r.systemInfo.ethernetMAC || r.ethernetMAC || "—";
  r.systemInfo.serialNumber = r.systemInfo.serialNumber || r.serialNumber || "—";
  r.systemInfo.systemUpTime = r.systemInfo.systemUpTime || r.systemUpTime || "—";
  r.systemInfo.currentTime = r.systemInfo.currentTime || new Date().toString();
  r.systemInfo.insightMode = r.systemInfo.insightMode || "—";
  r.systemInfo.fanSpeed = r.systemInfo.fanSpeed || "—";
  r.systemInfo.temperature = r.systemInfo.temperature || "—";
  r.systemInfo.firmwareVersion = r.systemInfo.firmwareVersion || "—";
  r.systemInfo.firmwareStatus = r.systemInfo.firmwareStatus || "—";

  // internet ports
  r.internetPortStatus = r.internetPortStatus || {};
  r.internetPortStatus.WAN1 = r.internetPortStatus.WAN1 || r.internetPortStatus.wan1 || { status: "Offline", connectionType: "DHCP" };
  r.internetPortStatus.WAN2 = r.internetPortStatus.WAN2 || r.internetPortStatus.wan2 || { status: "Offline", connectionType: "DHCP" };

  // ethernet -> ensure ports array for consistent frontend rendering
  r.ethernetPortStatus = r.ethernetPortStatus || {};
  if (!Array.isArray(r.ethernetPortStatus.ports)) {
    const ports = [];
    const keys = ["WAN1","WAN2","LAN1","LAN2","LAN3","LAN4"];
    keys.forEach((k) => {
      const val = r.ethernetPortStatus[k] ?? raw.ethernetPortStatus?.[k] ?? "0 Mbps";
      ports.push({ port: k, status: val, tx: 0, rx: 0 });
    });
    r.ethernetPortStatus.ports = ports;
  }

  // vpn defaults
  r.vpnStatus = r.vpnStatus || {};
  r.vpnStatus.siteToSite = r.vpnStatus.siteToSite || { inUse: 0, connected: 0, disconnected: 0 };
  r.vpnStatus.clientToSite = r.vpnStatus.clientToSite || { inUse: 0, connected: 0, disconnected: 0 };
  r.vpnStatus.openVPN = r.vpnStatus.openVPN || { inUse: 0, connected: 0, disconnected: 0 };
  r.vpnStatus.wireGuard = r.vpnStatus.wireGuard || { inUse: 0, connected: 0, disconnected: 0 };

  // vlan defaults
  r.vlanStatus = r.vlanStatus || { activeVLAN: 1, ipv4: true, ipv6: false };

  // router/user name normalization
  r.routerName = r.routerName || `PR60X-${r.userName || r.username || "unknown"}`;
  r.userName = r.userName || r.username || (r.routerName ? r.routerName.replace(/^PR60X-/, "") : "unknown");

  return r;
}

// If no users exist, create default admin (with settings)
(async () => {
  try {
    const users = loadUsers();
    if (!users || users.length === 0) {
      const defaultUsername = "admin";
      const defaultPassword = "password123";
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const newUser = {
        id: Date.now().toString(),
        username: defaultUsername,
        passwordHash,
        settings: {
          theme: "system" // default theme
        }
      };

      users.push(newUser);
      saveUsers(users);
      console.log(`Default user created → username: ${defaultUsername}, password: ${defaultPassword}`);
    } else {
      console.log(`Users loaded: ${users.length} user(s)`);
    }
  } catch (err) {
    console.error("Error creating default user:", err);
  }
})();

// Middlewares
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","x-auth-token"]
}));
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} → ${req.method} ${req.path}`);
  if (["POST","DELETE","PUT"].includes(req.method)) console.log("  Body:", req.body);
  next();
});

// ----------------- Auth endpoints -----------------

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ status: false, message: "username and password required" });

  const users = loadUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ status: false, message: "username already exists" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      passwordHash,
      settings: { theme: "system" } // default settings for new users
    };
    users.push(newUser);
    saveUsers(users);
    return res.status(201).json({ status: true, message: "user created", id: newUser.id, username: newUser.username });
  } catch (err) {
    console.error("Error creating user:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ status: false, message: "username and password required" });

  const users = loadUsers();
  const user = users.find((u) => u.username.toString().toLowerCase() === username.toString().toLowerCase());

  if (!user) {
    console.log("  Login failed: user not found:", username);
    return res.status(401).json({ status: false, message: "Invalid credentials" });
  }

  try {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      console.log("  Login failed: wrong password for", username);
      return res.status(401).json({ status: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("bcrypt error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }

  try {
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Record token+username in efile for debugging/dev
    try {
      const entries = loadEfile();
      entries.push({ token, username: user.username, loggedAt: new Date().toISOString() });
      saveEfile(entries);
    } catch (e) {
      console.error("Failed to write efile:", e);
    }

    if (process.env.NODE_ENV !== "production") {
      const masked = `${token.slice(0, 8)}...${token.slice(-8)}`;
      console.log("TOKEN (masked):", masked);
    }

    return res.json({ status: true, token });
  } catch (err) {
    console.error("JWT sign error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// Delete efile entry (used by dashboard logout)
app.delete("/api/efile/remove", (req, res) => {
  try {
    const token = req.headers["x-auth-token"] || req.headers["x-auth-token".toLowerCase()];
    if (!token) return res.status(400).json({ status: false, message: "No token provided" });

    const entries = loadEfile();
    const filtered = entries.filter((entry) => entry.token !== token);
    saveEfile(filtered);
    return res.json({ status: true, message: "Entry removed from efile" });
  } catch (err) {
    console.error("Error removing efile entry:", err);
    return res.status(500).json({ status: false, message: "Error removing entry" });
  }
});

// ----------------- Auth middleware -----------------
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ status: false, message: "No token provided" });

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // find the full user object from users.json by id (sub) or username
    const users = loadUsers();
    const user = users.find(u => String(u.id) === String(decoded.sub) || u.username === decoded.username);
    if (!user) {
      return res.status(401).json({ status: false, message: "User not found" });
    }

    // Attach full user object so handlers can read and update settings
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ status: false, message: "Invalid or expired token" });
  }
}

// ----------------- User settings endpoints -----------------
// GET /api/user/settings  -> returns { status: true, settings: { theme } }
app.get("/api/user/settings", requireAuth, (req, res) => {
  try {
    // req.user is the full user object from users.json (see requireAuth)
    const settings = req.user.settings || { theme: "system" };
    return res.json({ status: true, settings });
  } catch (err) {
    console.error("/api/user/settings GET error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// POST /api/user/settings  -> body { theme: "dark" }  (updates user.settings.theme)
app.post("/api/user/settings", requireAuth, (req, res) => {
  try {
    const { theme } = req.body || {};
    const allowed = ["system", "dark", "light"];
    if (theme !== undefined && !allowed.includes(theme)) {
      return res.status(400).json({ status: false, message: "Invalid theme" });
    }

    // Load users, find by id, update settings, persist
    const users = loadUsers();
    const idx = users.findIndex(u => String(u.id) === String(req.user.id) || u.username === req.user.username);
    if (idx === -1) return res.status(404).json({ status: false, message: "User not found" });

    users[idx].settings = users[idx].settings || {};
    if (theme !== undefined) users[idx].settings.theme = theme;

    saveUsers(users);

    return res.json({ status: true, settings: users[idx].settings });
  } catch (err) {
    console.error("/api/user/settings POST error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// ----------------- Protected test route -----------------
app.get("/api/protected", requireAuth, (req, res) => {
  res.json({ status: true, message: "Protected content", user: { id: req.user.id, username: req.user.username } });
});

// ----------------- Router endpoints -----------------

// GET /api/me => returns user + router matched by username (case-insensitive)
app.get("/api/me", requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    const user = users.find(u => String(u.id) === String(req.user.id) || u.username === req.user.username);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    let router = null;
    try {
      const rawRouters = loadRoutersRaw();
      if (Array.isArray(rawRouters) && rawRouters.length > 0) {
        const found = rawRouters.find(r => {
          const rn = (r.userName || r.username || "").toString().toLowerCase();
          return rn === (user.username || "").toString().toLowerCase();
        });
        router = found ? normalizeRouter(found) : null;
      }
    } catch (err) {
      console.error("Error loading routers.json:", err);
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      settings: user.settings || { theme: "system" }
    };
    return res.json({ status: true, user: safeUser, router });
  } catch (err) {
    console.error("/api/me error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// GET all routers
app.get("/api/routers", requireAuth, (req, res) => {
  try {
    const raw = loadRoutersRaw();
    const normalized = Array.isArray(raw) ? raw.map(normalizeRouter) : [];
    return res.json({ status: true, routers: normalized });
  } catch (err) {
    console.error("/api/routers error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// GET router by id
app.get("/api/router/:id", requireAuth, (req, res) => {
  try {
    const id = req.params.id;
    const raw = loadRoutersRaw();
    const found = Array.isArray(raw) ? raw.find(r => String(r.id) === String(id)) : null;
    return res.json({ status: true, router: found ? normalizeRouter(found) : null });
  } catch (err) {
    console.error("/api/router/:id error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// GET router by username
app.get("/api/router/by-username/:username", requireAuth, (req, res) => {
  try {
    const username = (req.params.username || "").toString().toLowerCase();
    const raw = loadRoutersRaw();
    const found = Array.isArray(raw) ? raw.find(r => ((r.userName || r.username || "")).toString().toLowerCase() === username) : null;
    return res.json({ status: true, router: found ? normalizeRouter(found) : null });
  } catch (err) {
    console.error("/api/router/by-username error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// ----------------- Devices endpoints -----------------

// Public devices list (no auth required)
app.get("/api/devices", (req, res) => {
  try {
    const devices = loadDevices();
    return res.json({ status: true, devices });
  } catch (err) {
    console.error("/api/devices error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// Protected devices list (requires valid JWT)
app.get("/api/devices/protected", requireAuth, (req, res) => {
  try {
    const devices = loadDevices();
    return res.json({ status: true, devices });
  } catch (err) {
    console.error("/api/devices/protected error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

// Protected update (replace whole devices array) — useful for dev + mocks
app.post("/api/devices", requireAuth, (req, res) => {
  try {
    const newDevices = Array.isArray(req.body) ? req.body : (req.body?.devices ?? null);
    if (!Array.isArray(newDevices)) return res.status(400).json({ status: false, message: "Expected array body" });
    saveDevices(newDevices);
    return res.json({ status: true, devices: newDevices });
  } catch (err) {
    console.error("/api/devices POST error:", err);
    return res.status(500).json({ status: false, message: "internal error" });
  }
});

app.get("/", (req, res) => res.send("Auth server OK"));

app.listen(PORT, () => console.log(`Auth server listening at http://localhost:${PORT} (JWT expiresIn=${JWT_EXPIRES_IN})`));
