const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    claimantId: { type: String, default: "" },
    claimantName: { type: String, default: "Campus user" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedByName: { type: String, default: "" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

const itemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["Lost", "Found"],
      required: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    imageUrl: {
      type: String,
      default: "",
    },

    contactInfo: {
      type: String,
      default: "",
    },

    campusId: {
      type: String,
      required: true,
      default: "college-of-maasin",
      immutable: true,
    },

    // Who reported this item. Only this person (or an admin)
    // can edit or delete it. Older items have no owner, so
    // only an admin can change them.
    reporterId: {
      type: String,
      default: "",
      immutable: true,
    },

    reporterName: {
      type: String,
      default: "",
      immutable: true,
    },

    status: {
      type: String,
      enum: ["Open", "Matched", "Claimed"],
      default: "Open",
    },

    claims: {
      type: [claimSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Item", itemSchema);
