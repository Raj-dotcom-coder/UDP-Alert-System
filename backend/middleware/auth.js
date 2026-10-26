const jwt = require("jsonwebtoken");
const db = require("../db");

const jwtSecret = process.env.JWT_SECRET || (
  process.env.NODE_ENV === "production" ? null : "development-only-change-this-jwt-secret"
);

if (!jwtSecret || (process.env.NODE_ENV === "production" && jwtSecret.length < 32)) {
  throw new Error("Production requires a JWT_SECRET with at least 32 characters.");
}

function createToken(user) {
  return jwt.sign({}, jwtSecret, {
    subject: user._id.toString(),
    issuer: "udp-alert-system",
    audience: "udp-alert-client",
    expiresIn: "8h"
  });
}

async function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      issuer: "udp-alert-system",
      audience: "udp-alert-client"
    });
    const userId = db.toObjectId(payload.sub);
    const users = await db.users;
    const user = userId ? await users.findOne({ _id: userId }, { projection: { username: 1, role: 1 } }) : null;

    if (!user) {
      return res.status(401).json({ success: false, message: "Session is no longer valid." });
    }

    req.user = { id: user._id.toString(), username: user.username, role: user.role };
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Invalid or expired session." });
    }
    console.error("Authentication error:", error.message);
    res.status(500).json({ success: false, message: "Authentication failed." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }
    next();
  };
}

module.exports = { createToken, requireAuth, requireRole };