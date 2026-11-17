const crypto = require("crypto");
require("dotenv").config();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended IV length for GCM is 96 bits (12 bytes)

function getMasterKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("ENCRYPTION_KEY environment variable is required.");
  }
  const keyBuffer = Buffer.from(keyHex, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM authenticated encryption.
 * @param {string} text - Plain text to encrypt
 * @returns {{ iv: string, content: string, tag: string } | null}
 */
function encrypt(text) {
  if (text === null || text === undefined || text === "") {
    return null;
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(String(text), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    iv: iv.toString("hex"),
    content: encrypted,
    tag: authTag,
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 * @param {{ iv: string, content: string, tag: string } | string} encryptedData
 * @returns {string | null} Decrypted plaintext string
 */
function decrypt(encryptedData) {
  if (!encryptedData) {
    return null;
  }

  try {
    let ivHex, contentHex, tagHex;

    if (typeof encryptedData === "string") {
      const parts = encryptedData.split(":");
      if (parts.length === 3) {
        [ivHex, tagHex, contentHex] = parts;
      } else {
        return null;
      }
    } else if (
      encryptedData.iv &&
      encryptedData.content &&
      encryptedData.tag
    ) {
      ivHex = encryptedData.iv;
      contentHex = encryptedData.content;
      tagHex = encryptedData.tag;
    } else {
      return null;
    }

    const key = getMasterKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(contentHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err.message);
    return null;
  }
}

/**
 * Convenience helper to serialize encrypted object to compact string
 */
function serializeEncrypted(encryptedObj) {
  if (!encryptedObj) return null;
  return `${encryptedObj.iv}:${encryptedObj.tag}:${encryptedObj.content}`;
}

module.exports = {
  encrypt,
  decrypt,
  serializeEncrypted,
};

