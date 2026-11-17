const mongoose = require("mongoose");

const creativeSchema = new mongoose.Schema(
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
      default: null,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    adGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdGroup",
      default: null,
    },
    name: {
      type: String,
      default: "Untitled Creative",
      trim: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 280,
    },
    destinationUrl: {
      type: String,
      default: "",
      trim: true,
    },
    headline: {
      type: String,
      default: "",
      maxlength: 70,
      trim: true,
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "none"],
      default: "none",
    },
    mediaIdString: {
      type: String,
      default: null,
    },
    cardUri: {
      type: String,
      default: null,
    },
    promotedOnly: {
      type: Boolean,
      default: false,
    },
    madeWithAI: {
      type: Boolean,
      default: false,
    },
    // X references
    externalTweetId: {
      type: String,
      default: null,
    },
    externalPromotedTweetId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "FAILED"],
      default: "DRAFT",
      index: true,
    },
    errorDetails: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Creative = mongoose.model("Creative", creativeSchema);

module.exports = Creative;

