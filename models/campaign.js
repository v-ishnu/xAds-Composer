const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    connectedXAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectedXAccount",
      required: true,
      index: true,
    },
    advertisingAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvertisingAccount",
      required: true,
      index: true,
    },
    externalCampaignId: {
      type: String,
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    objective: {
      type: String,
      enum: [
        "WEBSITE_TRAFFIC",
        "ENGAGEMENTS",
        "REACH",
        "VIDEO_VIEWS",
        "PREROLL_VIEWS",
        "APP_INSTALLS",
        "FOLLOWERS",
      ],
      default: "WEBSITE_TRAFFIC",
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED", "PARTIALLY_CREATED"],
      default: "DRAFT",
      index: true,
    },
    dailyBudgetAmountLocalMicro: {
      type: Number,
      required: true,
      min: 1000000, // 1 unit in micros (e.g. $1.00 = 1,000,000 micros)
    },
    totalBudgetAmountLocalMicro: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: "USD",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    // Guided workflow tracking and partial failure recovery
    creationStep: {
      type: Number,
      default: 1, // 1 to 6
    },
    partialError: {
      type: String,
      default: null,
    },
    rawAdsApiResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Campaign = mongoose.model("Campaign", campaignSchema);

module.exports = Campaign;

