const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../util/encryption");

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Method to get decrypted value if marked encrypted
platformSettingSchema.methods.getPlainValue = function () {
  if (this.isEncrypted && typeof this.value === "object" && this.value.iv) {
    return decrypt(this.value);
  }
  return this.value;
};

// Static helper to set a setting
platformSettingSchema.statics.setSetting = async function (
  key,
  val,
  isEncrypted = false,
  userId = null,
  description = ""
) {
  let finalValue = val;
  if (isEncrypted && val) {
    finalValue = encrypt(String(val));
  }
  return this.findOneAndUpdate(
    { key },
    {
      value: finalValue,
      isEncrypted,
      updatedBy: userId,
      description,
    },
    { upsert: true, new: true }
  );
};

// Static helper to get setting plain value
platformSettingSchema.statics.getSetting = async function (key, defaultValue = null) {
  const doc = await this.findOne({ key });
  if (!doc) return defaultValue;
  return doc.getPlainValue();
};

const PlatformSetting = mongoose.model("PlatformSetting", platformSettingSchema);

module.exports = PlatformSetting;

