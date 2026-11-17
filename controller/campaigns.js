const Campaign = require("../models/campaign");
const AdGroup = require("../models/adGroup");
const Creative = require("../models/creative");
const ConnectedXAccount = require("../models/connectedXAccount");
const AdvertisingAccount = require("../models/advertisingAccount");
const {
  createCampaign: apiCreateCampaign,
  createLineItem: apiCreateLineItem,
  updateCampaign: apiUpdateCampaign,
  createPromotedTweet: apiCreatePromotedTweet,
  listCampaigns: apiListCampaigns,
} = require("../services/xAdsApi");
const { postTweet: apiPostTweet } = require("../services/xApiV2");
const { logAudit } = require("../services/auditService");

async function listCampaigns(req, res) {
  try {
    const { advertisingAccountId, status } = req.query;
    const query = { userId: req.user._id };

    if (advertisingAccountId) {
      query.advertisingAccountId = advertisingAccountId;
    }
    if (status) {
      query.status = status;
    }

    const campaigns = await Campaign.find(query)
      .populate("connectedXAccountId", "username displayName profileImage")
      .populate("advertisingAccountId", "accountName currency timezone")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      campaigns,
    });
  } catch (err) {
    console.error("[Campaigns Controller] listCampaigns error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list campaigns",
    });
  }
}

async function getCampaign(req, res) {
  const { id } = req.params;

  try {
    const campaign = await Campaign.findOne({
      _id: id,
      userId: req.user._id,
    })
      .populate("connectedXAccountId", "username displayName profileImage")
      .populate("advertisingAccountId", "accountName currency timezone");

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
    }

    const [adGroups, creatives] = await Promise.all([
      AdGroup.find({ campaignId: campaign._id }),
      Creative.find({ campaignId: campaign._id }),
    ]);

    return res.json({
      success: true,
      campaign,
      adGroups,
      creatives,
    });
  } catch (err) {
    console.error("[Campaigns Controller] getCampaign error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve campaign details",
    });
  }
}

/**
 * Validates and previews a campaign configuration before publication
 */
async function validateCampaignDraft(req, res) {
  const body = req.body;

  const errors = [];
  if (!body.campaign?.name) errors.push("Campaign name is required");
  if (!body.campaign?.dailyBudgetAmountLocalMicro || body.campaign.dailyBudgetAmountLocalMicro < 1000000) {
    errors.push("Daily budget must be at least 1.00 currency unit");
  }
  if (!body.campaign?.connectedXAccountId) errors.push("Connected X Account is required");
  if (!body.campaign?.advertisingAccountId) errors.push("Advertising Account is required");
  if (!body.creative?.text) errors.push("Creative post text is required");
  if (body.creative?.text && body.creative.text.length > 280) {
    errors.push("Post text cannot exceed 280 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      canPublish: false,
    });
  }

  return res.json({
    success: true,
    canPublish: true,
    summary: {
      account: body.campaign.advertisingAccountId,
      name: body.campaign.name,
      objective: body.campaign.objective || "WEBSITE_TRAFFIC",
      dailyBudget: `$${(body.campaign.dailyBudgetAmountLocalMicro / 1000000).toFixed(2)}`,
      totalBudget: body.campaign.totalBudgetAmountLocalMicro
        ? `$${(body.campaign.totalBudgetAmountLocalMicro / 1000000).toFixed(2)}`
        : "Unlimited",
      startTime: body.campaign.startTime,
      lineItemName: body.lineItem?.name || `${body.campaign.name} - Ad Group 1`,
      targeting: body.lineItem?.targeting || {},
      creative: {
        text: body.creative.text,
        destinationUrl: body.creative.destinationUrl,
        headline: body.creative.headline,
      },
    },
  });
}

/**
 * 6-Step Guided Campaign Creation with explicit user confirmation and partial failure recovery
 */
async function createGuidedCampaign(req, res) {
  const { confirmationRequired, confirmedByUser, campaign, lineItem, creative } = req.body;

  if (confirmationRequired && !confirmedByUser) {
    return res.status(400).json({
      success: false,
      error: "Explicit user confirmation is required before dispatching campaign to X Ads API.",
      code: "CONFIRMATION_REQUIRED",
    });
  }

  // 1. Validate accounts
  const connectedAccount = await ConnectedXAccount.findOne({
    _id: campaign.connectedXAccountId,
    userId: req.user._id,
  });
  if (!connectedAccount) {
    return res.status(404).json({
      success: false,
      error: "Specified connected X account not found",
    });
  }

  const adAccount = await AdvertisingAccount.findOne({
    _id: campaign.advertisingAccountId,
    userId: req.user._id,
  });
  if (!adAccount) {
    return res.status(404).json({
      success: false,
      error: "Specified advertising account not found",
    });
  }

  // 2. Create local campaign record in DRAFT / PARTIALLY_CREATED status
  let localCampaign = null;
  let localLineItem = null;
  let localCreative = null;

  try {
    localCampaign = await Campaign.create({
      userId: req.user._id,
      connectedXAccountId: connectedAccount._id,
      advertisingAccountId: adAccount._id,
      name: campaign.name,
      objective: campaign.objective || "WEBSITE_TRAFFIC",
      dailyBudgetAmountLocalMicro: campaign.dailyBudgetAmountLocalMicro,
      totalBudgetAmountLocalMicro: campaign.totalBudgetAmountLocalMicro || null,
      currency: adAccount.currency || "USD",
      startTime: campaign.startTime ? new Date(campaign.startTime) : new Date(),
      endTime: campaign.endTime ? new Date(campaign.endTime) : null,
      timezone: campaign.timezone || adAccount.timezone,
      status: "DRAFT",
      creationStep: 2,
    });

    localLineItem = await AdGroup.create({
      userId: req.user._id,
      campaignId: localCampaign._id,
      name: lineItem?.name || `${campaign.name} - Line Item`,
      bidAmountLocalMicro: lineItem?.bidAmountLocalMicro || 1500000,
      bidStrategy: lineItem?.bidStrategy || "AUTO",
      billingEvent: lineItem?.billingEvent || "LINK_CLICKS",
      placements: lineItem?.placements || ["ALL_ON_TWITTER"],
      targeting: lineItem?.targeting || {},
      status: "DRAFT",
    });

    localCreative = await Creative.create({
      userId: req.user._id,
      connectedXAccountId: connectedAccount._id,
      advertisingAccountId: adAccount._id,
      campaignId: localCampaign._id,
      adGroupId: localLineItem._id,
      name: creative?.name || `${campaign.name} Creative`,
      text: creative?.text,
      destinationUrl: creative?.destinationUrl || "",
      headline: creative?.headline || "",
      mediaUrl: creative?.mediaUrl || "",
      mediaType: creative?.mediaType || "none",
      promotedOnly: Boolean(creative?.promotedOnly),
      madeWithAI: Boolean(creative?.madeWithAI),
      status: "DRAFT",
    });
  } catch (dbErr) {
    console.error("[Campaigns Controller] Local draft creation error:", dbErr);
    return res.status(500).json({
      success: false,
      error: `Failed to save local campaign draft: ${dbErr.message}`,
    });
  }

  // 3. Dispatch to Official X APIs with Partial Failure Handling
  let externalCampaignId = null;
  let externalLineItemId = null;
  let externalTweetId = null;

  try {
    // Stage A: Create Campaign in X Ads API
    localCampaign.creationStep = 3;
    await localCampaign.save();

    try {
      const apiCamp = await apiCreateCampaign(connectedAccount, adAccount.xAdsAccountId, {
        name: localCampaign.name,
        dailyBudgetAmountLocalMicro: localCampaign.dailyBudgetAmountLocalMicro,
        totalBudgetAmountLocalMicro: localCampaign.totalBudgetAmountLocalMicro,
        startTime: localCampaign.startTime,
        endTime: localCampaign.endTime,
        status: "ACTIVE",
      });
      externalCampaignId = apiCamp.id;
      localCampaign.externalCampaignId = externalCampaignId;
      localCampaign.status = "ACTIVE";
      await localCampaign.save();
    } catch (campErr) {
      localCampaign.status = "PARTIALLY_CREATED";
      localCampaign.partialError = `Failed at Step 2 (X Ads Campaign Creation): ${
        campErr.response?.data?.errors?.[0]?.message || campErr.message
      }`;
      await localCampaign.save();
      throw new Error(localCampaign.partialError);
    }

    // Stage B: Create Line Item in X Ads API
    localCampaign.creationStep = 4;
    await localCampaign.save();

    try {
      const apiLine = await apiCreateLineItem(connectedAccount, adAccount.xAdsAccountId, {
        externalCampaignId: localCampaign.externalCampaignId,
        name: localLineItem.name,
        bidAmountLocalMicro: localLineItem.bidAmountLocalMicro,
        bidStrategy: localLineItem.bidStrategy,
        billingEvent: localLineItem.billingEvent,
        placements: localLineItem.placements,
        status: "ACTIVE",
        startTime: localCampaign.startTime,
      });
      externalLineItemId = apiLine.id;
      localLineItem.externalLineItemId = externalLineItemId;
      localLineItem.status = "ACTIVE";
      await localLineItem.save();
    } catch (lineErr) {
      localCampaign.status = "PARTIALLY_CREATED";
      localCampaign.partialError = `Campaign was created on X (ID: ${externalCampaignId}), but Line Item creation failed: ${
        lineErr.response?.data?.errors?.[0]?.message || lineErr.message
      }. You can retry creating line items in Ad Groups.`;
      await localCampaign.save();
      throw new Error(localCampaign.partialError);
    }

    // Stage C: Create Creative (Tweet via X API v2 and Promoted Tweet via X Ads API)
    localCampaign.creationStep = 5;
    await localCampaign.save();

    try {
      const token = connectedAccount.getDecryptedAccessToken();
      const publishedTweet = await apiPostTweet(token, {
        text: localCreative.text,
      });
      externalTweetId = publishedTweet.id;
      localCreative.externalTweetId = externalTweetId;

      // Link promoted tweet to line item
      const promoted = await apiCreatePromotedTweet(
        connectedAccount,
        adAccount.xAdsAccountId,
        externalLineItemId,
        externalTweetId
      );
      localCreative.externalPromotedTweetId = promoted?.[0]?.id || null;
      localCreative.status = "PUBLISHED";
      await localCreative.save();
    } catch (tweetErr) {
      localCampaign.status = "PARTIALLY_CREATED";
      localCampaign.partialError = `Campaign and Line Item were created on X, but creative publishing encountered an issue: ${
        tweetErr.response?.data?.errors?.[0]?.message || tweetErr.message
      }.`;
      await localCampaign.save();
      localCreative.status = "FAILED";
      localCreative.errorDetails = localCampaign.partialError;
      await localCreative.save();
    }

    // Stage D: Completed
    localCampaign.creationStep = 6;
    localCampaign.partialError = null;
    await localCampaign.save();

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "CAMPAIGN_PUBLISHED",
      category: "CAMPAIGN",
      details: {
        campaignId: localCampaign._id,
        externalCampaignId,
        externalLineItemId,
        externalTweetId,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Campaign created and published successfully to X Ads",
      campaign: localCampaign,
      lineItem: localLineItem,
      creative: localCreative,
    });
  } catch (err) {
    console.error("[Campaigns Controller] Guided creation error:", err);
    return res.status(502).json({
      success: false,
      error: err.message,
      campaignId: localCampaign?._id,
      recoveryOption:
        "The campaign draft and any partial state have been saved. Review details in Campaigns tab to resume or retry.",
    });
  }
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // "ACTIVE" or "PAUSED"

  if (!["ACTIVE", "PAUSED"].includes(status)) {
    return res.status(400).json({
      success: false,
      error: "Status must be either 'ACTIVE' or 'PAUSED'",
    });
  }

  try {
    const campaign = await Campaign.findOne({
      _id: id,
      userId: req.user._id,
    })
      .populate("connectedXAccountId")
      .populate("advertisingAccountId");

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
    }

    if (campaign.externalCampaignId) {
      await apiUpdateCampaign(
        campaign.connectedXAccountId,
        campaign.advertisingAccountId.xAdsAccountId,
        campaign.externalCampaignId,
        { status }
      );
    }

    campaign.status = status;
    await campaign.save();

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: status === "ACTIVE" ? "CAMPAIGN_RESUMED" : "CAMPAIGN_PAUSED",
      category: "CAMPAIGN",
      details: { campaignId: id, status },
      req,
    });

    return res.json({
      success: true,
      message: `Campaign status updated to ${status}`,
      campaign,
    });
  } catch (err) {
    console.error("[Campaigns Controller] updateStatus error:", err);
    return res.status(502).json({
      success: false,
      error:
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        "Failed to update campaign status on X Ads API",
    });
  }
}

module.exports = {
  listCampaigns,
  getCampaign,
  validateCampaignDraft,
  createGuidedCampaign,
  updateStatus,
};

