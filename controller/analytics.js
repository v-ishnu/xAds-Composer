const Campaign = require("../models/campaign");
const AdvertisingAccount = require("../models/advertisingAccount");
const ConnectedXAccount = require("../models/connectedXAccount");
const { getCampaignStats } = require("../services/xAdsApi");

async function getOverviewAnalytics(req, res) {
  try {
    const { advertisingAccountId, range = "7d" } = req.query;

    const targetAdAccountId =
      advertisingAccountId || req.user.activeAdvertisingAccountId;

    const connectedAccount = req.activeXAccount;

    // Empty state: no connected account or ad account
    if (!connectedAccount || !targetAdAccountId) {
      return res.json({
        success: true,
        dataStatus: "EMPTY_STATE",
        message:
          "Connect an X Account with approved Advertising privileges to view live campaign analytics.",
        summary: {
          totalSpend: "$0.00",
          totalImpressions: 0,
          totalEngagements: 0,
          totalClicks: 0,
          averageCtr: "0.00%",
          averageCpc: "$0.00",
        },
        campaignMetrics: [],
        chartData: [],
      });
    }

    const adAccount = await AdvertisingAccount.findOne({
      _id: targetAdAccountId,
      userId: req.user._id,
    });

    if (!adAccount) {
      return res.status(404).json({
        success: false,
        error: "Selected advertising account not found",
      });
    }

    // Find campaigns for this account
    const campaigns = await Campaign.find({
      advertisingAccountId: adAccount._id,
      userId: req.user._id,
    });

    const externalIds = campaigns
      .map((c) => c.externalCampaignId)
      .filter(Boolean);

    // If no published external campaigns exist, return local campaign count empty state
    if (externalIds.length === 0) {
      return res.json({
        success: true,
        dataStatus: "NO_ACTIVE_PUBLISHED_CAMPAIGNS",
        message:
          "No live published campaigns found on X Ads for this account. Create and publish a campaign to view live delivery stats.",
        summary: {
          totalSpend: "$0.00",
          totalImpressions: 0,
          totalEngagements: 0,
          totalClicks: 0,
          averageCtr: "0.00%",
          averageCpc: "$0.00",
        },
        campaignMetrics: campaigns.map((c) => ({
          id: c._id,
          name: c.name,
          status: c.status,
          dailyBudget: `$${(c.dailyBudgetAmountLocalMicro / 1000000).toFixed(2)}`,
          impressions: 0,
          spend: "$0.00",
          clicks: 0,
          freshness: "PENDING_DELIVERY",
        })),
        chartData: [],
      });
    }

    // Call X Ads API for actual analytics
    try {
      const stats = await getCampaignStats(
        connectedAccount,
        adAccount.xAdsAccountId,
        externalIds
      );

      // Parse and aggregate official stats
      let totalBilledMicro = 0;
      let totalImpressions = 0;
      let totalEngagements = 0;
      let totalClicks = 0;

      const campaignMetrics = stats.map((item) => {
        const id = item.id;
        const metrics = item.metrics || {};
        const billed = metrics.billed_charge_local_micro?.[0] || 0;
        const imps = metrics.impressions?.[0] || 0;
        const engs = metrics.engagements?.[0] || 0;
        const clicks = metrics.url_clicks?.[0] || 0;

        totalBilledMicro += billed;
        totalImpressions += imps;
        totalEngagements += engs;
        totalClicks += clicks;

        const matchedCampaign = campaigns.find(
          (c) => c.externalCampaignId === id
        );

        return {
          id,
          name: matchedCampaign ? matchedCampaign.name : `Campaign ${id}`,
          status: matchedCampaign ? matchedCampaign.status : "ACTIVE",
          spend: `$${(billed / 1000000).toFixed(2)}`,
          impressions: imps,
          engagements: engs,
          clicks,
          ctr: imps > 0 ? `${((clicks / imps) * 100).toFixed(2)}%` : "0.00%",
          freshness: "FINALIZED",
        };
      });

      const totalSpend = `$${(totalBilledMicro / 1000000).toFixed(2)}`;
      const averageCtr =
        totalImpressions > 0
          ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%`
          : "0.00%";
      const averageCpc =
        totalClicks > 0
          ? `$${(totalBilledMicro / 1000000 / totalClicks).toFixed(2)}`
          : "$0.00";

      return res.json({
        success: true,
        dataStatus: "LIVE_API_DATA",
        freshness: "FINALIZED",
        summary: {
          totalSpend,
          totalImpressions,
          totalEngagements,
          totalClicks,
          averageCtr,
          averageCpc,
        },
        campaignMetrics,
      });
    } catch (apiErr) {
      console.warn(
        "[Analytics Controller] X Ads API Stats call failed:",
        apiErr.message
      );
      return res.json({
        success: true,
        dataStatus: "API_UNAVAILABLE_OR_DELAYED",
        message:
          "X Ads API stats are currently unavailable or permissions are pending approval. X Ads metrics typically have a 2-3 hour processing window for brand-new campaigns.",
        summary: {
          totalSpend: "$0.00",
          totalImpressions: 0,
          totalEngagements: 0,
          totalClicks: 0,
          averageCtr: "0.00%",
          averageCpc: "$0.00",
        },
        campaignMetrics: campaigns.map((c) => ({
          id: c._id,
          name: c.name,
          status: c.status,
          dailyBudget: `$${(c.dailyBudgetAmountLocalMicro / 1000000).toFixed(2)}`,
          impressions: 0,
          spend: "$0.00",
          clicks: 0,
          freshness: "PROCESSING_DELAYED",
        })),
      });
    }
  } catch (err) {
    console.error("[Analytics Controller] getOverviewAnalytics error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to compile campaign analytics",
    });
  }
}

module.exports = {
  getOverviewAnalytics,
};

