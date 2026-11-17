const express = require("express");
const path = require("path");
const session = require("express-session");
const connectMongo = require("connect-mongo");
const MongoStore = connectMongo.default || connectMongo.MongoStore || connectMongo;
const mongoose = require("mongoose");
require("dotenv").config();

const { connectDB } = require("./util/database");

// Route modules
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const xAccountRoutes = require("./routes/xAccounts");
const adAccountRoutes = require("./routes/adAccounts");
const campaignRoutes = require("./routes/campaigns");
const lineItemRoutes = require("./routes/lineItems");
const targetingRoutes = require("./routes/targeting");
const creativeRoutes = require("./routes/creatives");
const analyticsRoutes = require("./routes/analytics");
const postRoutes = require("./routes/post");

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Static Assets
app.use(express.static(path.join(__dirname, "public")));

// Session Configuration
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "super-secret-session-key-at-least-32-chars-long",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise: new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
          resolve(mongoose.connection.getClient());
        } else {
          mongoose.connection.once("connected", () => {
            resolve(mongoose.connection.getClient());
          });
        }
      }),
      ttl: 14 * 24 * 60 * 60, // 14 days
      autoRemove: "native",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// View Routes
app.get("/", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/dashboard");
  }
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/dashboard", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/x-accounts", xAccountRoutes);
app.use("/api/ad-accounts", adAccountRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/line-items", lineItemRoutes);
app.use("/api/targeting", targetingRoutes);
app.use("/api/creatives", creativeRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/posts", postRoutes);

// Central Error Handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || "An unexpected server error occurred",
  });
});

// Start Server
async function start(port = (process.env.PORT || 3000)) {
  try {
    await connectDB();
    const server = app.listen(port, () => {
      console.log(`=================================================`);
      console.log(`𝕏 Composer Platform running on port: ${port}`);
      console.log(`URL: http://localhost:${port}`);
      console.log(`=================================================`);
    });
    return server;
  } catch (err) {
    console.error("Failed to start application:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
