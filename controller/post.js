const Creative = require("../models/creative");
const ConnectedXAccount = require("../models/connectedXAccount");
const { postTweet: apiPostTweet } = require("../services/xApiV2");
const { logAudit } = require("../services/auditService");

async function saveDraft(req, res) {
  const { name, text, destinationUrl, headline, mediaUrl, mediaType, madeWithAI, promotedOnly } =
    req.body;

  try {
    const connectedAccount = req.activeXAccount;
    if (!connectedAccount) {
      return res.status(400).json({
        success: false,
        error: "An active connected X account is required to save drafts.",
      });
    }

    const draft = await Creative.create({
      userId: req.user._id,
      connectedXAccountId: connectedAccount._id,
      advertisingAccountId: req.user.activeAdvertisingAccountId || null,
      name: name || "Untitled Draft",
      text,
      destinationUrl: destinationUrl || "",
      headline: headline || "",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "none",
      madeWithAI: Boolean(madeWithAI),
      promotedOnly: Boolean(promotedOnly),
      status: "DRAFT",
    });

    return res.status(201).json({
      success: true,
      message: "Post draft saved successfully",
      draft,
    });
  } catch (err) {
    console.error("[Post Controller] saveDraft error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to save post draft",
    });
  }
}

async function listDrafts(req, res) {
  try {
    const drafts = await Creative.find({
      userId: req.user._id,
      status: "DRAFT",
    })
      .populate("connectedXAccountId", "username displayName profileImage")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      drafts,
    });
  } catch (err) {
    console.error("[Post Controller] listDrafts error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list drafts",
    });
  }
}

async function publishOrganicTweet(req, res) {
  const { text, creativeId } = req.body;

  try {
    const connectedAccount = req.activeXAccount;
    if (!connectedAccount) {
      return res.status(400).json({
        success: false,
        error: "An active connected X account is required to publish posts.",
      });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Post text is required",
      });
    }

    const token = connectedAccount.getDecryptedAccessToken();
    const result = await apiPostTweet(token, { text: text.trim() });

    let creative = null;
    if (creativeId) {
      creative = await Creative.findOne({
        _id: creativeId,
        userId: req.user._id,
      });
      if (creative) {
        creative.externalTweetId = result.id;
        creative.status = "PUBLISHED";
        await creative.save();
      }
    }

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "PUBLISHED_ORGANIC_TWEET",
      category: "X_ACCOUNT",
      details: {
        tweetId: result.id,
        connectedXAccountId: connectedAccount._id,
        username: connectedAccount.username,
      },
      req,
    });

    return res.json({
      success: true,
      message: "Post published successfully to X!",
      tweet: result,
      creative,
    });
  } catch (err) {
    console.error("[Post Controller] publishOrganicTweet error:", err);
    const message =
      err.response?.data?.errors?.[0]?.message ||
      err.message ||
      "Failed to publish post via X API v2";

    return res.status(502).json({
      success: false,
      error: message,
      details: err.response?.data || null,
    });
  }
}

module.exports = {
  saveDraft,
  listDrafts,
  publishOrganicTweet,
};

