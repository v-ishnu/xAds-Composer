const mongoose = require("mongoose");

const oauthStateSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    codeVerifier: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    redirectUri: {
      type: String,
      required: true,
    },
    scopes: {
      type: [String],
      default: ["users.read", "tweet.read", "tweet.write", "offline.access"],
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB automatic TTL cleanup
    },
  },
  {
    timestamps: true,
  }
);

const OAuthState = mongoose.model("OAuthState", oauthStateSchema);

module.exports = OAuthState;

