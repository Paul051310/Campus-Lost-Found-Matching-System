
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters."]
    },

    studentId: {
      type: String,
      required: [true, "Student ID is required."],
      unique: true,
      trim: true,
      maxlength: [30, "Student ID cannot exceed 30 characters."]
    },

    courseYear: {
      type: String,
      required: [true, "Course and year are required."],
      trim: true,
      maxlength: [100, "Course and year cannot exceed 100 characters."]
    },

    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email address is too long."],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address."
      ]
    },

    passwordHash: {
      type: String,
      required: [true, "Password hash is required."],
      select: false
    },

    role: {
      type: String,
      enum: {
        values: ["student", "admin"],
        message: "Role must be student or admin."
      },
      default: "student",
      required: true
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Invalid account status."
      },
      default: "pending",
      required: true
    },

    campusId: {
      type: String,
      default: "college-of-maasin",
      required: true,
      immutable: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Normalize email addresses before saving.
userSchema.pre("save", function (next) {
  if (this.isModified("email") && this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  next();
});

module.exports = mongoose.model("User", userSchema);
