
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const User = require("../models/User");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function createAdmin() {
  try {
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
      throw new Error("MONGO_URI or JWT_SECRET is missing from .env.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("\nCampusFind Administrator Setup\n");

    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("An administrator account already exists. No changes made.");
      return;
    }

    const fullName = await ask("Administrator full name: ");
    const studentId = await ask("Administrator ID: ");
    const courseYear = await ask("Department / position: ");
    const email = (await ask("Administrator email: ")).toLowerCase();
    const password = await ask("Create a strong password: ");

    if (!fullName || !studentId || !courseYear || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (password.length < 12) {
      throw new Error("Use a password with at least 12 characters.");
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { studentId }],
    });

    if (existingUser) {
      throw new Error(
        "That email or ID is already registered. No account was changed."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      fullName,
      studentId,
      courseYear,
      email,
      passwordHash,
      role: "admin",
      status: "approved",
      campusId: "college-of-maasin",
    });

    console.log("\nAdministrator account created successfully.");
    console.log("Keep your login credentials private.");
  } catch (error) {
    console.error("\nAdmin setup failed:", error.message);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

createAdmin();
