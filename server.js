
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const itemRoutes = require("./routes/itemRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads folder automatically
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure image storage
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
  }
});

// Configure image upload restrictions
const upload = multer({
  storage: storage,

  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed."));
    }
  }
});

// Make uploaded images accessible
app.use("/uploads", express.static(uploadDir));

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Campus Lost & Found Matching System API is running!"
  });
});

// Image upload route
app.post("/api/items/upload", (req, res) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.message || "Image upload failed."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image."
      });
    }

    res.status(201).json({
      message: "Image uploaded successfully!",
      imageUrl: `/uploads/${req.file.filename}`
    });
  });
});

// Connect item API routes
app.use("/api/items", itemRoutes);

// Server configuration
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Connection error:", error.message);
  }
}

startServer();
