
const mongoose = require("mongoose");

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

    status: {
      type: String,
      enum: ["Open", "Matched", "Claimed"],
      default: "Open",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Item", itemSchema);
