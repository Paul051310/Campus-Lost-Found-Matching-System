
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

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = (
      await ask("Administrator email: ")
    ).toLowerCase();

    const user = await User.findOne({
      email,
      role: "admin",
      campusId: "college-of-maasin",
    });

    if (!user) {
      throw new Error("Administrator account not found.");
    }

    const password = await ask(
      "Enter a NEW password (minimum 12 characters): "
    );

    if (password.length < 12) {
      throw new Error("Password must contain at least 12 characters.");
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    console.log("Administrator password updated successfully.");
  } catch (error) {
    console.error("Password reset failed:", error.message);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

resetPassword();
