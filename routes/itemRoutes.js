
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Item = require("../models/Item");

// Only allow these fields to be submitted by clients.
const editableFields = [
  "itemName",
  "type",
  "category",
  "description",
  "location",
  "date",
  "imageUrl",
  "contactInfo",
  "status",
];

function getCampusId(req) {
  return req.user?.campusId;
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

    res.json(items);
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

    res.json(items);
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

// CREATE AN ITEM
router.post("/", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    const data = pickAllowedFields(req.body);

    // Never trust a campusId supplied by the frontend.
    data.campusId = getCampusId(req);

    const newItem = await Item.create(data);

    res.status(201).json(newItem);
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
      items: updatedItems,
    });
  } catch (error) {
    console.error("Confirm match error:", error.message);
    res.status(500).json({
      message: "Failed to confirm match.",
    });
  }
});

// UPDATE AN ITEM IN THE USER'S CAMPUS
router.put("/:id", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID.",
      });
    }

    const data = pickAllowedFields(req.body);

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

    if (!updatedItem) {
      return res.status(404).json({
        message: "Item not found in your campus.",
      });
    }

    res.json(updatedItem);
  } catch (error) {
    console.error("Update item error:", error.message);
    res.status(400).json({
      message: error.message || "Failed to update item.",
    });
  }
});

// DELETE AN ITEM FROM THE USER'S CAMPUS
router.delete("/:id", async (req, res) => {
  try {
    if (!ensureCampus(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID.",
      });
    }

    const deletedItem = await Item.findOneAndDelete({
      _id: req.params.id,
      campusId: getCampusId(req),
    });

    if (!deletedItem) {
      return res.status(404).json({
        message: "Item not found in your campus.",
      });
    }

    res.json({
      message: "Item deleted successfully.",
      item: deletedItem,
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

    res.json(item);
  } catch (error) {
    console.error("Get item error:", error.message);
    res.status(500).json({
      message: "Failed to retrieve item.",
    });
  }
});

module.exports = router;
