// server/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("./models/User");

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch user to attach settings. You can optimize by selecting needed fields.
    const user = await User.findById(payload.id).select("_id email settings");
    if (!user) return res.status(401).json({ message: "Invalid token" });

    req.user = user;
    next();
  } catch (err) {
    console.error("auth error", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
