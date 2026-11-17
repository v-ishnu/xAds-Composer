const AdGroup = require("../models/adGroup");
const Campaign = require("../models/campaign");
const { createLineItem: apiCreateLineItem } = require("../services/xAdsApi");

async function listLineItems(req, res) {
  try {
    const { campaignId } = req.query;
    const query = { userId: req.user._id };
    if (campaignId) query.campaignId = campaignId;

    const lineItems = await AdGroup.find(query)
      .populate("campaignId", "name externalCampaignId status")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      lineItems,
    });
  } catch (err) {
    console.error("[LineItems Controller] listLineItems error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list line items",
    });
  }
}

async function createLineItem(req, res) {
  const data = req.validatedBody;

  try {
    const campaign = await Campaign.findOne({
      _id: data.campaignId,
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

    const lineItem = new AdGroup({
      userId: req.user._id,
      campaignId: campaign._id,
      name: data.name,
      bidAmountLocalMicro: data.bidAmountLocalMicro,
      bidStrategy: data.bidStrategy,
      billingEvent: data.billingEvent,
      placements: data.placements,
      deliverySettings: data.deliverySettings,
      targeting: data.targeting || {},
      status: "ACTIVE",
    });

    if (campaign.externalCampaignId) {
      const apiResult = await apiCreateLineItem(
        campaign.connectedXAccountId,
        campaign.advertisingAccountId.xAdsAccountId,
        {
          externalCampaignId: campaign.externalCampaignId,
          name: lineItem.name,
          bidAmountLocalMicro: lineItem.bidAmountLocalMicro,
          bidStrategy: lineItem.bidStrategy,
          billingEvent: lineItem.billingEvent,
          placements: lineItem.placements,
          status: "ACTIVE",
        }
      );
      lineItem.externalLineItemId = apiResult.id;
    }

    await lineItem.save();

    return res.status(201).json({
      success: true,
      message: "Line item created successfully",
      lineItem,
    });
  } catch (err) {
    console.error("[LineItems Controller] createLineItem error:", err);
    return res.status(502).json({
      success: false,
      error:
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        "Failed to create line item on X Ads API",
    });
  }
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const lineItem = await AdGroup.findOne({ _id: id, userId: req.user._id });
    if (!lineItem) {
      return res.status(404).json({
        success: false,
        error: "Line item not found",
      });
    }

    lineItem.status = status;
    await lineItem.save();

    return res.json({
      success: true,
      message: `Line item status updated to ${status}`,
      lineItem,
    });
  } catch (err) {
    console.error("[LineItems Controller] updateStatus error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to update line item status",
    });
  }
}

module.exports = {
  listLineItems,
  createLineItem,
  updateStatus,
};

