const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const db = require("../db");
const { createToken, requireAuth } = require("../middleware/auth");

function toUser(user) {
  return { id: user._id.toString(), username: user.username, role: user.role };
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, role = "client" } = req.body;
    if (!username || !password || username.length > 100 || password.length > 200) {
      return res.status(400).json({ success: false, message: "Username and password are required and must be within the allowed length." });
    }
    if (role !== "client") return res.status(403).json({ success: false, message: "Administrator accounts are managed by the system." });

    const users = await db.users;
    if (await users.findOne({ username }, { projection: { _id: 1 } })) {
      return res.status(409).json({ success: false, message: "Username already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await users.insertOne({ username, password: passwordHash, role, created_at: new Date() });
    res.status(201).json({ success: true, message: "User registered successfully.", user: { id: result.insertedId.toString(), username, role } });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ success: false, message: "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || username.length > 100 || password.length > 200) {
      return res.status(400).json({ success: false, message: "Username and password are required and must be within the allowed length." });
    }

    const users = await db.users;
    const user = await users.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }
    // Authenticate user by credentials and return their registered role
    res.json({ success: true, message: "Login successful.", token: createToken(user), user: toUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, message: "Login failed." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;