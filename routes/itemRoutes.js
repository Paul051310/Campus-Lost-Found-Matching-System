
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Item = require("../models/Item");

// GET ALL ITEMS
router.get("/", async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve items."
    });
  }
});

// SEARCH ITEMS
router.get("/search", async (req, res) => {
  try {
    const keyword = req.query.q || "";

    const items = await Item.find({
      $or: [
        { itemName: { $regex: keyword, $options: "i" } },
        { category: { $regex: keyword, $options: "i" } },
        { location: { $regex: keyword, $options: "i" } }
      ]
    }).sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Failed to search items."
    });
  }
});

// TEST ROUTE
router.get("/test-route", (req, res) => {
  res.send("ITEM ROUTES FILE IS LOADED!");
});

// CREATE AN ITEM
router.post("/", async (req, res) => {
  try {
    const newItem = await Item.create(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to create item."
    });
  }
});

// CONFIRM A MATCH
router.put("/confirm-match/:lostId/:foundId", async (req, res) => {
  try {
    const { lostId, foundId } = req.params;

    // Validate IDs
    if (
      !mongoose.isValidObjectId(lostId) ||
      !mongoose.isValidObjectId(foundId) ||
      lostId === foundId
    ) {
      return res.status(400).json({
        message: "Invalid item IDs."
      });
    }

    // Find both reports
    const lostItem = await Item.findById(lostId);
    const foundItem = await Item.findById(foundId);

    if (!lostItem || !foundItem) {
      return res.status(404).json({
        message: "One or both items were not found."
      });
    }

    // Check report types
    if (
      lostItem.type !== "Lost" ||
      foundItem.type !== "Found"
    ) {
      return res.status(400).json({
        message: "Select one Lost item and one Found item."
      });
    }

    // Check report statuses
    if (
      lostItem.status !== "Open" ||
      foundItem.status !== "Open"
    ) {
      return res.status(400).json({
        message: "Both items must have Open status."
      });
    }

    // Update the Lost report
    lostItem.status = "Matched";
    await lostItem.save();

    // Update the Found report
    foundItem.status = "Matched";
    await foundItem.save();

    res.json({
      message: "Match confirmed successfully!",
      items: [lostItem, foundItem]
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to confirm match."
    });
  }
});

// UPDATE AN ITEM
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID."
      });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedItem) {
      return res.status(404).json({
        message: "Item not found."
      });
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to update item."
    });
  }
});

// DELETE AN ITEM
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID."
      });
    }

    const deletedItem = await Item.findByIdAndDelete(
      req.params.id
    );

    if (!deletedItem) {
      return res.status(404).json({
        message: "Item not found."
      });
    }

    res.json({
      message: "Item deleted successfully.",
      item: deletedItem
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete item."
    });
  }
});

// GET ONE ITEM BY ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid item ID."
      });
    }

    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "Item not found."
      });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve item."
    });
  }
});

module.exports = router;
