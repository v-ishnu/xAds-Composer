const mongoose = require("mongoose");

const adGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    externalLineItemId: {
      type: String,
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"],
      default: "DRAFT",
      index: true,
    },
    bidAmountLocalMicro: {
      type: Number,
      required: true,
      default: 1500000, // $1.50 default in micros
    },
    bidStrategy: {
      type: String,
      enum: ["AUTO", "MAX", "TARGET"],
      default: "AUTO",
    },
    billingEvent: {
      type: String,
      enum: ["IMPRESSIONS", "ENGAGEMENTS", "LINK_CLICKS"],
      default: "LINK_CLICKS",
    },
    placements: {
      type: [String],
      default: ["ALL_ON_TWITTER", "TWITTER_TIMELINE"],
    },
    deliverySettings: {
      type: String,
      enum: ["STANDARD", "ACCELERATED"],
      default: "STANDARD",
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    // Targeting configuration
    targeting: {
      locations: { type: [String], default: ["US"] },
      languages: { type: [String], default: ["en"] },
      genders: { type: [String], default: ["ANY"] }, // "ANY", "MALE", "FEMALE"
      ageBuckets: { type: [String], default: ["AGE_21_TO_49"] },
      interests: { type: [String], default: [] },
      keywords: { type: [String], default: [] },
      followerLookalikes: { type: [String], default: [] },
      devices: { type: [String], default: ["IOS", "ANDROID", "DESKTOP"] },
      platforms: { type: [String], default: ["MOBILE", "DESKTOP"] },
    },
  },
  {
    timestamps: true,
  }
);

const AdGroup = mongoose.model("AdGroup", adGroupSchema);

module.exports = AdGroup;

