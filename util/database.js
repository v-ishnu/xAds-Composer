const mongoose = require("mongoose");
const User = require("../models/user");
require("dotenv").config();

let mongoMemoryServerInstance = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/x-composer";

  try {
    // Attempt standard connection
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log(`[Database] Connected successfully to MongoDB: ${uri}`);
  } catch (err) {
    console.warn(`[Database] Primary MongoDB connection failed (${err.message}).`);
    
    // In development or when local mongod is not running, spin up MongoMemoryServer
    try {
      console.log("[Database] Initializing in-memory MongoDB fallback instance...");
      const { MongoMemoryServer } = require("mongodb-memory-server");
      mongoMemoryServerInstance = await MongoMemoryServer.create();
      const inMemoryUri = mongoMemoryServerInstance.getUri();
      
      await mongoose.connect(inMemoryUri);
      console.log(`[Database] Connected to in-memory MongoDB: ${inMemoryUri}`);
    } catch (memErr) {
      console.error("[Database] Fatal: Failed to connect to both primary and fallback MongoDB:", memErr.message);
      throw memErr;
    }
  }

  // Seed default super admin
  await seedSuperAdmin();
}

async function seedSuperAdmin() {
  try {
    const adminEmail = (process.env.SUPER_ADMIN_EMAIL || "admin@xcomposer.local").toLowerCase().trim();
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "AdminPass123!";
    const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

    const existingAdmin = await User.findOne({
      $or: [{ role: "super_admin" }, { email: adminEmail }],
    });

    if (!existingAdmin) {
      const passwordHash = await User.hashPassword(adminPassword);
      await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "super_admin",
        status: "active",
        emailVerified: true,
      });
      console.log(`[Database] Default Super Admin seeded successfully: ${adminEmail}`);
    }
  } catch (err) {
    console.error("[Database] Error seeding Super Admin:", err.message);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (mongoMemoryServerInstance) {
    await mongoMemoryServerInstance.stop();
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};

