
require("dotenv").config();

const mongoose = require("mongoose");
const Item = require("./models/Item1");

const sampleItems = [
  {
    itemName: "Black Leather Wallet",
    type: "Lost",
    category: "Personal Belongings",
    description: "Black wallet containing a student ID and cash",
    location: "College Library",
    date: new Date("2026-10-10"),
    contactInfo: "student1@example.com",
    status: "Open"
  },
  {
    itemName: "Samsung Phone",
    type: "Found",
    category: "Electronics",
    description: "Black Samsung phone found near the library entrance",
    location: "College Library",
    date: new Date("2026-10-11"),
    contactInfo: "student2@example.com",
    status: "Open"
  },
  {
    itemName: "House Keys",
    type: "Lost",
    category: "Personal Belongings",
    description: "Three silver keys attached to a blue keychain",
    location: "Campus Canteen",
    date: new Date("2026-10-12"),
    contactInfo: "student3@example.com",
    status: "Open"
  },
  {
    itemName: "Blue Water Bottle",
    type: "Found",
    category: "Accessories",
    description: "Blue reusable water bottle left on a classroom desk",
    location: "Room 204",
    date: new Date("2026-10-13"),
    contactInfo: "student4@example.com",
    status: "Open"
  },
  {
    itemName: "Student ID Card",
    type: "Found",
    category: "Identification",
    description: "College student ID card found beside the main gate",
    location: "Main Gate",
    date: new Date("2026-10-14"),
    contactInfo: "student5@example.com",
    status: "Open"
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Add only sample records that do not already exist.
    let added = 0;

    for (const item of sampleItems) {
      const exists = await Item.findOne({
        itemName: item.itemName,
        type: item.type,
        location: item.location
      });

      if (!exists) {
        await Item.create(item);
        added++;
      }
    }

    const total = await Item.countDocuments();

    console.log(`Sample data added: ${added}`);
    console.log(`Total items in database: ${total}`);
  } catch (error) {
    console.error("Seeding error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase();
