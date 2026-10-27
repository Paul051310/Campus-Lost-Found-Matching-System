const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const PasswordResetRequest = require("../models/PasswordResetRequest");

const router = express.Router();

const CAMPUS_ID = "college-of-maasin";
const COOKIE_NAME = "campusfind_token";
const SESSION_DURATION = 2 * 60 * 60 * 1000;

// Limit repeated login attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again in 15 minutes."
  }
});

// Limit repeated account-recovery attempts.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many recovery attempts. Please try again in 15 minutes."
  }
});

// Hide most of an email address, e.g. john@gmail.com -> j***@g***.com
function maskEmail(email) {
  const [local = "", domain = ""] = String(email).split("@");
  const [domainName = "", ...rest] = domain.split(".");

  const mask = (text) =>
    text.length <= 1 ? `${text}***` : `${text[0]}***`;

  return `${mask(local)}@${mask(domainName)}${
    rest.length ? `.${rest.join(".")}` : ""
  }`;
}

// Shared cookie options.
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: SESSION_DURATION,
    path: "/"
  };
}

// Create a signed session token.
function createToken(user) {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error("JWT_SECRET is missing or too short.");
  }

  return jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

// Return safe user information.
function publicUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    studentId: user.studentId,
    courseYear: user.courseYear,
    email: user.email,
    role: user.role,
    status: user.status,
    campusId: user.campusId
  };
}

// Check campus membership.
function isAllowedCampus(user) {
  return user.campusId === CAMPUS_ID;
}

// Require a valid, approved administrator.
async function requireAdmin(req, res, next) {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      return res.status(500).json({
        message: "Authentication is not configured correctly."
      });
    }

    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Please log in first."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.userId);

    if (
      !admin ||
      admin.role !== "admin" ||
      admin.status !== "approved" ||
      !isAllowedCampus(admin)
    ) {
      return res.status(403).json({
        message: "Administrator access required."
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Your session is invalid or expired."
      });
    }

    console.error("Admin authorization error:", error.message);

    return res.status(500).json({
      message: "Unable to verify administrator access."
    });
  }
}

// =========================================
// STUDENT REGISTRATION
// New student accounts always start pending.
// =========================================
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      studentId,
      courseYear,
      email,
      password
    } = req.body || {};

    if (
      typeof fullName !== "string" ||
      typeof studentId !== "string" ||
      typeof courseYear !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !fullName.trim() ||
      !studentId.trim() ||
      !courseYear.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please complete all required fields."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = studentId.trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { studentId: normalizedStudentId }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        message: "That email or student ID is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName: fullName.trim(),
      studentId: normalizedStudentId,
      courseYear: courseYear.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "student",
      status: "pending",
      campusId: CAMPUS_ID
    });

    return res.status(201).json({
      message:
        "Registration submitted successfully. Please wait for administrator approval before logging in.",
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "That email or student ID is already registered."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again."
    });
  }
});

// =========================================
// STUDENT AND ADMIN LOGIN
// =========================================
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Enter your email and password."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          user.status === "pending"
            ? "Your account is waiting for administrator approval."
            : "Your account has not been approved."
      });
    }

    if (!isAllowedCampus(user)) {
      return res.status(403).json({
        message: "Access is restricted to College Of Maasin."
      });
    }

    const token = createToken(user);

    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(200).json({
      message: "Login successful.",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again."
    });
  }
});

// =========================================
// FORGOT EMAIL
// POST /api/auth/find-email
// The student proves who they are with their student ID and
// full name, and sees a hidden version of their email.
// =========================================
router.post("/find-email", recoveryLimiter, async (req, res) => {
  try {
    const { studentId, fullName } = req.body || {};

    if (
      typeof studentId !== "string" ||
      typeof fullName !== "string" ||
      !studentId.trim() ||
      !fullName.trim()
    ) {
      return res.status(400).json({
        message: "Enter your student ID and full name."
      });
    }

    const user = await User.findOne({
      studentId: studentId.trim(),
      role: "student",
      campusId: CAMPUS_ID
    });

    const nameMatches =
      user &&
      String(user.fullName).trim().toLowerCase() ===
        fullName.trim().toLowerCase();

    if (!nameMatches) {
      return res.status(404).json({
        message:
          "No matching account was found. Check your student ID and full name."
      });
    }

    return res.status(200).json({
      message: "We found your account.",
      emailHint: maskEmail(user.email)
    });
  } catch (error) {
    console.error("Find email error:", error.message);

    return res.status(500).json({
      message: "Unable to look up your account right now."
    });
  }
});

// =========================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// Sends a request to the administrator, who sets a new password.
// The answer is always the same, so nobody can use this
// to find out which emails are registered.
// =========================================
router.post("/forgot-password", recoveryLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "Enter your email address."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role: "student",
      campusId: CAMPUS_ID
    });

    if (user) {
      const alreadyWaiting = await PasswordResetRequest.findOne({
        userId: user._id,
        status: "pending"
      });

      if (!alreadyWaiting) {
        await PasswordResetRequest.create({
          userId: user._id,
          email: user.email,
          fullName: user.fullName,
          studentId: user.studentId
        });
      }
    }

    return res.status(200).json({
      message:
        "If that email is registered, the administrator has been notified and will set a new password for you."
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      message: "Unable to send your request right now."
    });
  }
});

// =========================================
// GET CURRENT LOGGED-IN USER
// =========================================
router.get("/me", async (req, res) => {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      return res.status(500).json({
        message: "Authentication is not configured correctly."
      });
    }

    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Please log in."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== "approved") {
      return res.status(401).json({
        message: "Your session is no longer valid. Please log in again."
      });
    }

    if (!isAllowedCampus(user)) {
      return res.status(403).json({
        message: "Access is restricted to College Of Maasin."
      });
    }

    return res.status(200).json({
      user: publicUser(user)
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Your session is invalid or expired. Please log in again."
      });
    }

    console.error("Current-user error:", error.message);

    return res.status(500).json({
      message: "Unable to verify your session."
    });
  }
});

// =========================================
// ADMIN: GET PENDING STUDENT ACCOUNTS
// GET /api/auth/pending
// =========================================
router.get("/pending", requireAdmin, async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      status: "pending",
      campusId: CAMPUS_ID
    })
      .select("-passwordHash")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      students: students.map(publicUser)
    });
  } catch (error) {
    console.error("Pending students error:", error.message);

    return res.status(500).json({
      message: "Unable to load pending student accounts."
    });
  }
});

// =========================================
// ADMIN: LIST ALL REGISTERED STUDENTS
// GET /api/auth/students
// Passwords are never returned (they are stored hashed).
// =========================================
router.get("/students", requireAdmin, async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      campusId: CAMPUS_ID
    })
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    const waitingRequests = await PasswordResetRequest.find({
      status: "pending"
    }).select("userId");

    const requested = new Set(
      waitingRequests.map((request) => String(request.userId))
    );

    return res.status(200).json({
      students: students.map((student) => ({
        ...publicUser(student),
        createdAt: student.createdAt,
        resetRequested: requested.has(String(student._id))
      }))
    });
  } catch (error) {
    console.error("List students error:", error.message);

    return res.status(500).json({
      message: "Unable to load the student list."
    });
  }
});

// =========================================
// ADMIN: SET A NEW PASSWORD FOR A STUDENT
// PATCH /api/auth/:userId/password
// =========================================
router.patch("/:userId/password", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body || {};

    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid student account ID."
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 72
    ) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters."
      });
    }

    const student = await User.findOne({
      _id: userId,
      role: "student",
      campusId: CAMPUS_ID
    }).select("+passwordHash");

    if (!student) {
      return res.status(404).json({
        message: "Student account not found."
      });
    }

    student.passwordHash = await bcrypt.hash(newPassword, 12);
    await student.save();

    // Any waiting "forgot password" request is now finished.
    await PasswordResetRequest.updateMany(
      { userId: student._id, status: "pending" },
      { $set: { status: "done" } }
    );

    return res.status(200).json({
      message: `Password updated for ${student.fullName}.`
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      message: "Unable to update this password."
    });
  }
});

// =========================================
// ADMIN: APPROVE A STUDENT ACCOUNT
// PATCH /api/auth/:userId/approve
// =========================================
router.patch("/:userId/approve", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(400).json({
        message: "Invalid student account ID."
      });
    }

    const student = await User.findOne({
      _id: userId,
      role: "student",
      status: "pending",
      campusId: CAMPUS_ID
    });

    if (!student) {
      return res.status(404).json({
        message: "Pending student account not found."
      });
    }

    student.status = "approved";
    await student.save();

    return res.status(200).json({
      message: "Student account approved successfully.",
      user: publicUser(student)
    });
  } catch (error) {
    console.error("Approve student error:", error.message);

    return res.status(500).json({
      message: "Unable to approve this student account."
    });
  }
});


/* =========================================
   LOGOUT
   POST /api/auth/logout
========================================= */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    path: "/",
  });

  return res.status(200).json({
    message: "Logged out successfully.",
  });
});

module.exports = router;
