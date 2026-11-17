const mongoose = require("mongoose");
const crypto = require("crypto");

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash helper for secure token storage
invitationSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

// Generate raw cryptographically secure token
invitationSchema.statics.generateRawToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Check if invitation is valid
invitationSchema.methods.isValid = function () {
  if (this.status !== "pending") return false;
  if (this.expiresAt < new Date()) return false;
  if (this.usedAt) return false;
  return true;
};

const Invitation = mongoose.model("Invitation", invitationSchema);

module.exports = Invitation;

