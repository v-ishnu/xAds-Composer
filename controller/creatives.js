const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Creative = require("../models/creative");
const ConnectedXAccount = require("../models/connectedXAccount");
const AdvertisingAccount = require("../models/advertisingAccount");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `creative-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are supported"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

async function listCreatives(req, res) {
  try {
    const { campaignId, connectedXAccountId } = req.query;
    const query = { userId: req.user._id };

    if (campaignId) query.campaignId = campaignId;
    if (connectedXAccountId) query.connectedXAccountId = connectedXAccountId;

    const creatives = await Creative.find(query)
      .populate("connectedXAccountId", "username displayName profileImage")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      creatives,
    });
  } catch (err) {
    console.error("[Creatives Controller] listCreatives error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list creatives",
    });
  }
}

async function createCreative(req, res) {
  const data = req.validatedBody;

  try {
    const connectedAccountId =
      data.connectedXAccountId || req.user.activeConnectedXAccountId;

    if (!connectedAccountId) {
      return res.status(400).json({
        success: false,
        error: "Active connected X account required to create creative",
      });
    }

    const creative = await Creative.create({
      userId: req.user._id,
      connectedXAccountId: connectedAccountId,
      advertisingAccountId: data.advertisingAccountId || req.user.activeAdvertisingAccountId,
      campaignId: data.campaignId || null,
      adGroupId: data.adGroupId || null,
      name: data.name || "Untitled Creative",
      text: data.text,
      destinationUrl: data.destinationUrl || "",
      headline: data.headline || "",
      mediaUrl: data.mediaUrl || "",
      mediaType: data.mediaType || "none",
      promotedOnly: Boolean(data.promotedOnly),
      madeWithAI: Boolean(data.madeWithAI),
      status: "DRAFT",
    });

    return res.status(201).json({
      success: true,
      message: "Creative draft created successfully",
      creative,
    });
  } catch (err) {
    console.error("[Creatives Controller] createCreative error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to create creative",
    });
  }
}

async function handleMediaUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No media file provided",
    });
  }

  const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
  const mediaUrl = `/uploads/${req.file.filename}`;

  return res.json({
    success: true,
    file: {
      originalName: req.file.originalname,
      filename: req.file.filename,
      mediaUrl,
      mediaType,
      size: req.file.size,
    },
  });
}

module.exports = {
  uploadMiddleware: upload.single("media"),
  listCreatives,
  createCreative,
  handleMediaUpload,
};

