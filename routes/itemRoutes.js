const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Item = require("../models/Item");
const ClaimHistory = require("../models/ClaimHistory");

// Only allow these fields to be submitted by clients.
// "status" is NOT here: users can never set it themselves.
const editableFields = [
  "itemName",
  "type",
  "category",
  "description",
  "location",
  "date",
  "imageUrl",
  "contactInfo",
];

function getCampusId(req) {
  return req.user?.campusId;
}

function getUserId(req) {
  return String(req.user?._id || req.user?.id || req.user?.userId || "");
}

function getUserName(req) {
  return req.user?.fullName || req.user?.name || "Campus user";
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

// Admins can change any item. Everyone else only their own reports.
function canModifyItem(req, item) {
  if (isAdmin(req)) return true;

  const userId = getUserId(req);

  return Boolean(userId) && item.reporterId === userId;
}

// Prepare an item for sending to the browser.
// Students only see their own claims (other claim messages stay private).
function presentItem(req, item) {
  const data = typeof item.toObject === "function" ? item.toObject() : item;

  if (!isAdmin(req)) {
    const userId = getUserId(req);

    data.claims = (data.claims || []).filter(
      (claim) => userId && claim.claimantId === userId
    );
  }

  data.canModify = canModifyItem(req, data);

  return data;
}

function pickAllowedFields(body) {
  const result = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function ensureCampus(req, res) {
  if (!getCampusId(req)) {
    res.status(403).json({
      message: "Your account has no authorized campus.",
    });
    return false;
  }

  return true;
}

// GET ALL ITEMS FROM THE USER'S CAMPUS
router.get("/", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const items = await Item.find({
      campusId: getCampusId(req),
    }).sort({ createdAt: -1 });

    res.json(items.map((item) => presentItem(req, item)));
  } catch (error) {
    console.error("Get items error:", error.message);
    res.status(500).json({
      message: "Failed to retrieve items.",
    });
  }
});

// SEARCH ITEMS WITHIN THE USER'S CAMPUS
router.get("/search", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const keyword = String(req.query.q || "").trim().slice(0, 100);

    const filter = {
      campusId: getCampusId(req),
    };

    if (keyword) {
      const escapedKeyword = keyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { itemName: { $regex: escapedKeyword, $options: "i" } },
        { category: { $regex: escapedKeyword, $options: "i" } },
        { location: { $regex: escapedKeyword, $options: "i" } },
      ];
    }

    const items = await Item.find(filter).sort({ createdAt: -1 });

    res.json(items.map((item) => presentItem(req, item)));
  } catch (error) {
    console.error("Search items error:", error.message);
    res.status(500).json({
      message: "Failed to search items.",
    });
  }
});

// TEST ROUTE
router.get("/test-route", (req, res) => {
  res.send("PROTECTED ITEM ROUTES ARE LOADED!");
});

// VIEW CLAIM HISTORY
// Admins see every record for their campus.
// Students see only the items they claimed themselves.
router.get("/claims/history", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const filter = { campusId: getCampusId(req) };

    if (!isAdmin(req)) {
      filter["approvedClaim.claimantId"] = getUserId(req);
    }

    const history = await ClaimHistory.find(filter).sort({
      approvedAt: -1,
    });

    res.json(history);
  } catch (error) {
    console.error("Claim history error:", error.message);
    res.status(500).json({ message: "Failed to load claim history." });
  }
});

// CREATE AN ITEM
router.post("/", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const data = pickAllowedFields(req.body);

    // Never trust a campusId supplied by the frontend.
    data.campusId = getCampusId(req);

    // Remember who reported it.
    data.reporterId = getUserId(req);
    data.reporterName = getUserName(req);

    const newItem = await Item.create(data);

    res.status(201).json(presentItem(req, newItem));
  } catch (error) {
    console.error("Create item error:", error.message);
    res.status(400).json({
      message: error.message || "Failed to create item.",
    });
  }
});

// CONFIRM A MATCH
router.put("/confirm-match/:lostId/:foundId", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const { lostId, foundId } = req.params;
    const campusId = getCampusId(req);

    if (
      !mongoose.isValidObjectId(lostId) ||
      !mongoose.isValidObjectId(foundId) ||
      lostId === foundId
    ) {
      return res.status(400).json({
        message: "Invalid item IDs.",
      });
    }

    // Both reports must belong to the authenticated user's campus.
    const lostItem = await Item.findOne({
      _id: lostId,
      campusId,
    });

    const foundItem = await Item.findOne({
      _id: foundId,
      campusId,
    });

    if (!lostItem || !foundItem) {
      return res.status(404).json({
        message: "One or both items were not found in your campus.",
      });
    }

    if (lostItem.type !== "Lost" || foundItem.type !== "Found") {
      return res.status(400).json({
        message: "Select one Lost item and one Found item.",
      });
    }

    if (lostItem.status !== "Open" || foundItem.status !== "Open") {
      return res.status(400).json({
        message: "Both items must have Open status.",
      });
    }

    // Update only if the reports are still Open.
    const lostUpdate = await Item.updateOne(
      { _id: lostId, campusId, status: "Open", type: "Lost" },
      { $set: { status: "Matched" } }
    );

    if (lostUpdate.modifiedCount !== 1) {
      return res.status(409).json({
        message: "The Lost item has already changed. Refresh and try again.",
      });
    }

    const foundUpdate = await Item.updateOne(
      { _id: foundId, campusId, status: "Open", type: "Found" },
      { $set: { status: "Matched" } }
    );

    if (foundUpdate.modifiedCount !== 1) {
      // Roll back the first update if the second one fails.
      await Item.updateOne(
        { _id: lostId, campusId, status: "Matched" },
        { $set: { status: "Open" } }
      );

      return res.status(409).json({
        message: "The Found item has already changed. Refresh and try again.",
      });
    }

    const updatedItems = await Item.find({
      _id: { $in: [lostId, foundId] },
      campusId,
    });

    res.json({
      message: "Match confirmed successfully!",
      items: updatedItems.map((item) => presentItem(req, item)),
    });
  } catch (error) {
    console.error("Confirm match error:", error.message);
    res.status(500).json({
      message: "Failed to confirm match.",
    });
  }
});

// SUBMIT A CLAIM ON A FOUND ITEM
router.post("/:id/claims", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid item ID." });
    }

    const message = String(req.body.message || "").trim().slice(0, 500);

    if (message.length < 5) {
      return res.status(400).json({
        message: "Please describe why this item is yours (at least 5 characters).",
      });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found in your campus." });
    }

    if (item.type !== "Found") {
      return res.status(400).json({ message: "Only found items can be claimed." });
    }

    if (item.status === "Claimed") {
      return res.status(400).json({ message: "This item has already been claimed." });
    }

    const userId = getUserId(req);

    const alreadyPending = item.claims.some(
      (claim) => claim.claimantId === userId && claim.status === "Pending"
    );

    if (userId && alreadyPending) {
      return res.status(409).json({
        message: "You already have a pending claim on this item.",
      });
    }

    item.claims.push({
      claimantId: userId,
      claimantName: getUserName(req),
      message,
    });

    await item.save();

    res.status(201).json({
      message: "Claim submitted!",
      item: presentItem(req, item),
    });
  } catch (error) {
    console.error("Submit claim error:", error.message);
    res.status(500).json({ message: "Failed to submit claim." });
  }
});

// APPROVE OR REJECT A CLAIM (ADMIN ONLY)
router.put("/:id/claims/:claimId", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!isAdmin(req)) {
      return res.status(403).json({ message: "Only an administrator can review claims." });
    }

    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.claimId)
    ) {
      return res.status(400).json({ message: "Invalid ID." });
    }

    const decision = req.body.decision;

    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be Approved or Rejected." });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found in your campus." });
    }

    const claim = item.claims.id(req.params.claimId);

    if (!claim) {
      return res.status(404).json({ message: "Claim not found." });
    }

    if (claim.status !== "Pending") {
      return res.status(409).json({ message: "This claim was already reviewed." });
    }

    claim.status = decision;
    claim.reviewedByName = getUserName(req);
    claim.reviewedAt = new Date();

    if (decision === "Approved") {
      item.status = "Claimed";

      // Any other waiting claims are rejected automatically.
      item.claims.forEach((other) => {
        if (String(other._id) !== String(claim._id) && other.status === "Pending") {
          other.status = "Rejected";
          other.reviewedByName = getUserName(req);
          other.reviewedAt = new Date();
        }
      });
    }

    await item.save();

    if (decision === "Approved") {
      // Save a permanent record, then remove the item from the main list.
      await ClaimHistory.create({
        campusId: item.campusId,
        originalItemId: String(item._id),
        itemName: item.itemName,
        type: item.type,
        category: item.category,
        description: item.description,
        location: item.location,
        date: item.date,
        imageUrl: item.imageUrl,
        contactInfo: item.contactInfo,
        reportedAt: item.createdAt,
        approvedClaim: {
          claimantId: claim.claimantId,
          claimantName: claim.claimantName,
          message: claim.message,
          createdAt: claim.createdAt,
        },
        approvedByName: getUserName(req),
        approvedAt: new Date(),
        allClaims: item.claims.map((c) => ({
          claimantName: c.claimantName,
          message: c.message,
          status: c.status,
          createdAt: c.createdAt,
          reviewedByName: c.reviewedByName,
          reviewedAt: c.reviewedAt,
        })),
      });

      await Item.deleteOne({
        _id: item._id,
        campusId: getCampusId(req),
      });

      return res.json({
        message: "Claim approved. The item was moved to history.",
        removedItemId: String(item._id),
      });
    }

    res.json({
      message: `Claim ${decision.toLowerCase()}.`,
      item: presentItem(req, item),
    });
  } catch (error) {
    console.error("Review claim error:", error.message);
    res.status(500).json({ message: "Failed to review claim." });
  }
});

// UPDATE AN ITEM (OWNER OR ADMIN ONLY)
router.put("/:id", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID.",
      });
    }

    const existing = await Item.findOne({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!existing) {
      return res.status(404).json({
        message: "Item not found in your campus.",
      });
    }

    if (!canModifyItem(req, existing)) {
      return res.status(403).json({
        message: "You can only edit items that you reported.",
      });
    }

    const data = pickAllowedFields(req.body);

    // Only an admin may change the status, and never to "Claimed".
    // "Claimed" is set only when an admin approves a claim.
    if (isAdmin(req) && ["Open", "Matched"].includes(req.body.status)) {
      data.status = req.body.status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: "No valid item fields were provided.",
      });
    }

    const updatedItem = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        campusId: getCampusId(req),
      },
      { $set: data },
      {
        new: true,
        runValidators: true,
      }
    );

    res.json(presentItem(req, updatedItem));
  } catch (error) {
    console.error("Update item error:", error.message);
    res.status(400).json({
      message: error.message || "Failed to update item.",
    });
  }
});

// DELETE AN ITEM (OWNER OR ADMIN ONLY)
router.delete("/:id", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID.",
      });
    }

    const existing = await Item.findOne({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!existing) {
      return res.status(404).json({
        message: "Item not found in your campus.",
      });
    }

    if (!canModifyItem(req, existing)) {
      return res.status(403).json({
        message: "You can only delete items that you reported.",
      });
    }

    await Item.deleteOne({
      _id: existing._id,
      campusId: getCampusId(req),
    });

    res.json({
      message: "Item deleted successfully.",
      item: presentItem(req, existing),
    });
  } catch (error) {
    console.error("Delete item error:", error.message);
    res.status(500).json({
      message: "Failed to delete item.",
    });
  }
});

// GET ONE ITEM BY ID, RESTRICTED TO THE USER'S CAMPUS
router.get("/:id", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID.",
      });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!item) {
      return res.status(404).json({
        message: "Item not found in your campus.",
      });
    }

    res.json(presentItem(req, item));
  } catch (error) {
    console.error("Get item error:", error.message);
    res.status(500).json({
      message: "Failed to retrieve item.",
    });
  }
});

module.exports = router;
