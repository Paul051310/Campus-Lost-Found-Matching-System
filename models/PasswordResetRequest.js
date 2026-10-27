const mongoose = require("mongoose");

// A student's request for the administrator to set a new password.
const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: { type: String, default: "" },
    fullName: { type: String, default: "" },
    studentId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "done"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PasswordResetRequest",
  passwordResetRequestSchema
);
