
require("dotenv").config();

const mongoose = require("mongoose");
const Item = require("../models/Item");

async function inspectItems() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("\n=== CAMPUSFIND ITEM INSPECTION ===\n");

    // Count all existing reports.
    const total = await Item.countDocuments();
    console.log("Total reports:", total);

    // Group reports by campusId, including missing values.
    const campusSummary = await Item.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$campusId", "(MISSING)"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log("\nReports by campusId:");
    console.log(JSON.stringify(campusSummary, null, 2));

    // Show a maximum of 10 reports without contact information.
    const samples = await Item.collection
      .find(
        {},
        {
          projection: {
            itemName: 1,
            type: 1,
            category: 1,
            location: 1,
            campusId: 1,
            createdAt: 1,
          },
        }
      )
      .limit(10)
      .toArray();

    console.log("\nSample reports (maximum 10):");
    console.log(JSON.stringify(samples, null, 2));

    console.log("\nInspection complete. No records were changed.");
  } catch (error) {
    console.error("Inspection failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

inspectItems();
