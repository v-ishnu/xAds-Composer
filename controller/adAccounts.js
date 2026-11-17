const AdvertisingAccount = require("../models/advertisingAccount");
const ConnectedXAccount = require("../models/connectedXAccount");
const { getAdvertisingAccounts } = require("../services/xAdsApi");
const { logAudit } = require("../services/auditService");

async function listAdAccounts(req, res) {
  try {
    const { connectedXAccountId } = req.query;
    const query = { userId: req.user._id };

    if (connectedXAccountId) {
      query.connectedXAccountId = connectedXAccountId;
    } else if (req.user.activeConnectedXAccountId) {
      query.connectedXAccountId = req.user.activeConnectedXAccountId;
    }

    const accounts = await AdvertisingAccount.find(query)
      .populate("connectedXAccountId", "username displayName profileImage")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      adAccounts: accounts,
      activeAdAccountId: req.user.activeAdvertisingAccountId,
    });
  } catch (err) {
    console.error("[Ad Accounts Controller] listAdAccounts error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list advertising accounts",
    });
  }
}

async function refreshAdAccounts(req, res) {
  try {
    const targetAccountId =
      req.query.connectedXAccountId || req.user.activeConnectedXAccountId;

    if (!targetAccountId) {
      return res.status(400).json({
        success: false,
        error: "No connected X account selected for advertising sync",
      });
    }

    const connectedAccount = await ConnectedXAccount.findOne({
      _id: targetAccountId,
      userId: req.user._id,
    });

    if (!connectedAccount) {
      return res.status(404).json({
        success: false,
        error: "Connected X account not found",
      });
    }

    const remoteAccounts = await getAdvertisingAccounts(connectedAccount);
    const updated = [];

    for (const remote of remoteAccounts) {
      const doc = await AdvertisingAccount.findOneAndUpdate(
        { userId: req.user._id, xAdsAccountId: remote.xAdsAccountId },
        {
          ...remote,
          connectedXAccountId: connectedAccount._id,
          userId: req.user._id,
          lastSyncedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      updated.push(doc);
    }

    // Set first as active if none set
    if (!req.user.activeAdvertisingAccountId && updated.length > 0) {
      req.user.activeAdvertisingAccountId = updated[0]._id;
      await req.user.save();
    }

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "REFRESHED_AD_ACCOUNTS",
      category: "X_ACCOUNT",
      details: {
        connectedXAccountId: connectedAccount._id,
        count: updated.length,
      },
      req,
    });

    return res.json({
      success: true,
      message: `Synchronized ${updated.length} advertising account(s)`,
      adAccounts: updated,
    });
  } catch (err) {
    console.error("[Ad Accounts Controller] refreshAdAccounts error:", err);
    const message =
      err.response?.data?.errors?.[0]?.message ||
      err.message ||
      "Failed to refresh advertising accounts";

    return res.status(502).json({
      success: false,
      error: message,
      details: err.response?.data || null,
    });
  }
}

async function setActiveAdAccount(req, res) {
  const { id } = req.params;

  try {
    const account = await AdvertisingAccount.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Advertising account not found",
      });
    }

    req.user.activeAdvertisingAccountId = account._id;
    await req.user.save();

    return res.json({
      success: true,
      message: `Active advertising account set to ${account.accountName}`,
      activeAdAccountId: account._id,
    });
  } catch (err) {
    console.error("[Ad Accounts Controller] setActiveAdAccount error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to set active advertising account",
    });
  }
}

module.exports = {
  listAdAccounts,
  refreshAdAccounts,
  setActiveAdAccount,
};

