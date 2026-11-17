const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../util/encryption");

const encryptedTokenSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    content: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false }
);

const connectedXAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    xUserId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    encryptedAccessToken: {
      type: encryptedTokenSchema,
      required: true,
    },
    encryptedRefreshToken: {
      type: encryptedTokenSchema,
      default: null,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    scopes: {
      type: [String],
      default: [],
    },
    connectionStatus: {
      type: String,
      enum: ["connected", "expired", "revoked", "error"],
      default: "connected",
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    oauthVersion: {
      type: String,
      enum: ["2.0", "1.0a", "both"],
      default: "2.0",
    },
    // Optional OAuth 1.0a User Context tokens for legacy ads endpoints
    encryptedOauth1Token: {
      type: encryptedTokenSchema,
      default: null,
    },
    encryptedOauth1Secret: {
      type: encryptedTokenSchema,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Prevent connecting the same X identity multiple times to the same workspace user
connectedXAccountSchema.index({ userId: 1, xUserId: 1 }, { unique: true });

// Helpers to get decrypted tokens (server-side only)
connectedXAccountSchema.methods.getDecryptedAccessToken = function () {
  return decrypt(this.encryptedAccessToken);
};

connectedXAccountSchema.methods.getDecryptedRefreshToken = function () {
  return decrypt(this.encryptedRefreshToken);
};

connectedXAccountSchema.methods.getDecryptedOauth1Tokens = function () {
  return {
    oauthToken: decrypt(this.encryptedOauth1Token),
    oauthTokenSecret: decrypt(this.encryptedOauth1Secret),
  };
};

// Set token helpers
connectedXAccountSchema.methods.setTokens = function ({
  accessToken,
  refreshToken,
  expiresInSeconds,
  scopes,
}) {
  this.encryptedAccessToken = encrypt(accessToken);
  if (refreshToken) {
    this.encryptedRefreshToken = encrypt(refreshToken);
  }
  if (expiresInSeconds) {
    this.tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  }
  if (scopes) {
    this.scopes = Array.isArray(scopes) ? scopes : scopes.split(" ");
  }
  this.connectionStatus = "connected";
  this.lastSyncedAt = new Date();
};

// Security: NEVER expose encrypted or raw tokens to frontend JSON
connectedXAccountSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;
  delete obj.encryptedOauth1Token;
  delete obj.encryptedOauth1Secret;
  return obj;
};

const ConnectedXAccount = mongoose.model(
  "ConnectedXAccount",
  connectedXAccountSchema
);

module.exports = ConnectedXAccount;

