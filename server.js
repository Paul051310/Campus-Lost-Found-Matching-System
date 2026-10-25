
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const itemRoutes = require("./routes/itemRoutes");
const chatRoutes = require("./routes/chatRoutes");
const matchRoutes = require("./routes/matchRoutes");
const authRoutes = require("./routes/authRoutes");
const { requireAuth } = require("./middleware/auth");

const app = express();

// ------------------------------------
// CONFIGURATION
// ------------------------------------

const PORT = process.env.PORT || 5000;

const ALLOWED_ORIGINS = [
  "http://localhost:5171",
  "http://localhost:5173",
  "http://localhost:5174",
];

// ------------------------------------
// SECURITY AND MIDDLEWARE
// ------------------------------------

// Allow images to be displayed by the frontend on another localhost port.
// This does NOT remove authentication from the /uploads route.
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permit requests without an Origin header, such as local health checks.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ------------------------------------
// UPLOAD DIRECTORY
// ------------------------------------

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ------------------------------------
// IMAGE STORAGE
// ------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    cb(null, uniqueName);
  },
});

// ------------------------------------
// IMAGE UPLOAD RESTRICTIONS
// ------------------------------------

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    return cb(
      new Error("Only JPG, PNG, and WebP images are allowed.")
    );
  },
});

// ------------------------------------
// PUBLIC HOME / HEALTH ROUTE
// ------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Campus Lost & Found Matching System API is running!",
  });
});

// ------------------------------------
// AUTHENTICATION ROUTES
// Registration, login, logout, and current user
// ------------------------------------

app.use("/api/auth", authRoutes);

// ------------------------------------
// PROTECTED IMAGE ACCESS
// ------------------------------------

// Only authenticated, approved campus users can access uploaded images.
app.use(
  "/uploads",
  requireAuth,
  express.static(uploadDir, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "private, no-cache");
    },
  })
);

// ------------------------------------
// PROTECTED IMAGE UPLOAD
// ------------------------------------

app.post("/api/items/upload", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return next(error);
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image.",
      });
    }

    return res.status(201).json({
      message: "Image uploaded successfully!",
      imageUrl: `/uploads/${req.file.filename}`,
    });
  });
});

// ------------------------------------
// PROTECTED APPLICATION ROUTES
// ------------------------------------

app.use("/api/items", requireAuth, itemRoutes);

app.use("/api/chat", requireAuth, chatRoutes);

app.use("/api/matches", requireAuth, matchRoutes);

// ------------------------------------
// NOT FOUND HANDLER
// ------------------------------------

app.use((req, res) => {
  res.status(404).json({
    message: "The requested API endpoint was not found.",
  });
});

// ------------------------------------
// ERROR HANDLER
// ------------------------------------

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      message: "Invalid JSON request body.",
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image size must not exceed 5 MB.",
      });
    }

    return res.status(400).json({
      message: "Image upload failed.",
    });
  }

  if (
    error.message === "Only JPG, PNG, and WebP images are allowed."
  ) {
    return res.status(400).json({
      message: error.message,
    });
  }

  if (error.message === "Origin not allowed by CORS") {
    console.warn("Blocked request from an unapproved origin.");

    return res.status(403).json({
      message: "This website origin is not allowed to access the API.",
    });
  }

  if (error.status === 404 && req.originalUrl.startsWith("/uploads/")) {
    return res.status(404).json({
      message: "The requested image file was not found.",
    });
  }

  console.error("Server error:", error.message);

  return res.status(500).json({
    message: "An unexpected server error occurred.",
  });
});

// ------------------------------------
// START SERVER
// ------------------------------------

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from your .env file.");
    }

    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32 ||
      process.env.JWT_SECRET ===
        "replace_this_with_a_long_random_secret"
    ) {
      throw new Error(
        "Set a strong, private JWT_SECRET in your .env file."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("Authentication: /api/auth");
      console.log("CampusFind AI chatbot: /api/chat");
      console.log("CampusFind hybrid matching: /api/matches");
      console.log("Protected image uploads are enabled.");
      console.log("Cross-origin image display is enabled.");
      console.log("Allowed frontend ports:", ALLOWED_ORIGINS.join(", "));
    });
  } catch (error) {
    console.error("Connection error:", error.message);
    process.exit(1);
  }
}

startServer();
