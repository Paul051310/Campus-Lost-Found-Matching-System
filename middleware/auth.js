
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.campusfind_token;

    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({
        message: "Please log in to continue."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== "approved") {
      return res.status(403).json({
        message: "Your account is not authorized."
      });
    }

    if (user.campusId !== "college-of-maasin") {
      return res.status(403).json({
        message: "Access is restricted to College Of Maasin."
      });
    }

    req.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      studentId: user.studentId,
      role: user.role,
      campusId: user.campusId
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Your session is invalid or expired. Please log in again."
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      message: "Authentication failed."
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Administrator access is required."
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};
