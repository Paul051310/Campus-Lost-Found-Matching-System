
require("dotenv").config();

const mongoose = require("mongoose");
const Item = require("../models/Item");

const CAMPUS_ID = "college-of-maasin";

const reportIds = [
  "6adb746c04d6310fd94a8e2b", // Lost phone — canteen
  "6adb81eaf885c6c01852a0c0", // Found phone — library
];

async function migratePhoneReports() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Verify that both exact records exist.
    const reports = await Item.collection
      .find({ _id: { $in: reportIds.map(id => new mongoose.Types.ObjectId(id)) } })
      .toArray();

    if (reports.length !== 2) {
      throw new Error(
        `Expected 2 reports, but found ${reports.length}. No changes made.`
      );
    }

    // Do not overwrite a campus assignment if one exists.
    const alreadyAssigned = reports.filter(
      report => Object.prototype.hasOwnProperty.call(report, "campusId")
    );

    if (alreadyAssigned.length > 0) {
      throw new Error(
        "At least one report already has a campusId. No changes made; inspect it first."
      );
    }

    // Update only these two IDs, and only while campusId is missing.
    const result = await Item.collection.updateMany(
      {
        _id: { $in: reportIds.map(id => new mongoose.Types.ObjectId(id)) },
        campusId: { $exists: false },
      },
      {
        $set: { campusId: CAMPUS_ID },
      }
    );

    console.log("Reports matched:", result.matchedCount);
    console.log("Reports updated:", result.modifiedCount);

    // Verify both records now have the intended campus.
    const verification = await Item.collection
      .find(
        { _id: { $in: reportIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { projection: { itemName: 1, type: 1, location: 1, campusId: 1 } }
      )
      .toArray();

    console.log("\nVerification:");
    console.log(JSON.stringify(verification, null, 2));

    if (
      verification.length !== 2 ||
      verification.some(report => report.campusId !== CAMPUS_ID)
    ) {
      console.error(
        "\nWarning: Verification did not confirm both campus assignments."
      );
      return;
    }

    console.log("\nMigration successful. Both reports belong to College Of Maasin.");
    console.log("No other report IDs were targeted.");
  } catch (error) {
    console.error("\nMigration stopped:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

migratePhoneReports();
