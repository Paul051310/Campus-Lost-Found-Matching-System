
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["Lost", "Found"],
      required: true
    },
    category: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    imageUrl: {
      type: String,
      default: ""
    },
    contactInfo: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["Open", "Matched", "Claimed"],
      default: "Open"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);
