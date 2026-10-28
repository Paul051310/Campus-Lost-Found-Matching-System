require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const UploadedImage = require("./models/UploadedImage");
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
  "https://campusfind-liard.vercel.app",
];

// ------------------------------------
// SECURITY AND MIDDLEWARE
// ------------------------------------

// Allow images to be displayed by the frontend on another website.
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
      // Permit requests without an Origin header, such as health checks.
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
// IMAGE STORAGE
// Photos are kept in memory while uploading,
// then saved in the database so they survive restarts.
// ------------------------------------

const storage = multer.memoryStorage();

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// ------------------------------------
// IMAGE UPLOAD RESTRICTIONS
// ------------------------------------

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) {
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

//

// Only authenticated, approved campus users can view uploaded images.
app.get("/uploads/:filename", requireAuth, async (req, res, next) => {
  try {
    const { filename } = req.params;

    if (!/^[0-9]+-[0-9]+\.(jpg|png|webp)$/.test(filename)) {
      return res.status(404).json({
        message: "The requested image file was not found.",
      });
    }

    const image = await UploadedImage.findOne({ filename });

    if (!image) {
      return res.status(404).json({
        message: "The requested image file was not found.",
      });
    }

    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "private, no-cache");

    return res.send(image.data);
  } catch (error) {
    return next(error);
  }
});

// ------------------------------------
// PROTECTED IMAGE UPLOAD
// ------------------------------------

app.post("/api/items/upload", requireAuth, (req, res, next) => {
  upload.single("image")(req, res, async (error) => {
    if (error) {
      return next(error);
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image.",
      });
    }

    try {
      const filename = `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${EXTENSIONS[req.file.mimetype]}`;

      await UploadedImage.create({
        filename,
        contentType: req.file.mimetype,
        data: req.file.buffer,
      });

      return res.status(201).json({
        message: "Image uploaded successfully!",
        imageUrl: `/uploads/${filename}`,
      });
    } catch (saveError) {
      return next(saveError);
    }
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