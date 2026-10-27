const mongoose = require("mongoose");

const claimHistorySchema = new mongoose.Schema(
  {
    campusId: { type: String, required: true },
    originalItemId: { type: String, required: true },

    itemName: { type: String, default: "" },
    type: { type: String, default: "" },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    date: { type: Date },
    imageUrl: { type: String, default: "" },
    contactInfo: { type: String, default: "" },
    reportedAt: { type: Date },

    approvedClaim: {
      claimantId: { type: String, default: "" },
      claimantName: { type: String, default: "" },
      message: { type: String, default: "" },
      createdAt: { type: Date },
    },

    approvedByName: { type: String, default: "" },
    approvedAt: { type: Date },

    allClaims: { type: Array, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClaimHistory", claimHistorySchema);