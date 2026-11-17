const mongoose = require("mongoose");

const advertisingAccountSchema = new mongoose.Schema(
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
    xAdsAccountId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
    },
    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },
    approvalStatus: {
      type: String,
      enum: ["ACCEPTED", "PENDING", "REJECTED", "UNAPPROVED", "UNKNOWN"],
      default: "ACCEPTED",
      index: true,
    },
    industryType: {
      type: String,
      default: "",
    },
    spendingLimitMicro: {
      type: Number,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

advertisingAccountSchema.index(
  { userId: 1, xAdsAccountId: 1 },
  { unique: true }
);

const AdvertisingAccount = mongoose.model(
  "AdvertisingAccount",
  advertisingAccountSchema
);

module.exports = AdvertisingAccount;

