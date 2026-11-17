const axios = require("axios");
const { getOAuth1Header } = require("./oauth1Helper");
const { refreshAccessToken } = require("./xApiV2");

const ADS_API_BASE = "https://ads-api.twitter.com/12";

/**
 * Helper to ensure a connected account has an active, valid access token.
 * Refreshes automatically if expired and updates DB.
 */
async function getValidTokenForAccount(connectedAccount) {
  let accessToken = connectedAccount.getDecryptedAccessToken();
  const refreshToken = connectedAccount.getDecryptedRefreshToken();

  // If token is expired and refresh token is available, refresh it
  if (
    connectedAccount.tokenExpiresAt &&
    connectedAccount.tokenExpiresAt <= new Date(Date.now() + 60000) &&
    refreshToken
  ) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      connectedAccount.setTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresInSeconds: refreshed.expiresIn,
        scopes: refreshed.scope,
      });
      await connectedAccount.save();
      accessToken = refreshed.accessToken;
    } catch (err) {
      console.warn(
        `[X Ads API] Token refresh failed for ${connectedAccount.username}:`,
        err.message
      );
      connectedAccount.connectionStatus = "expired";
      await connectedAccount.save();
    }
  }

  return accessToken;
}

/**
 * Builds request headers using OAuth 2.0 Bearer or OAuth 1.0a User Context.
 */
async function buildHeaders(connectedAccount, url, method = "GET") {
  const oauth1Tokens = connectedAccount.getDecryptedOauth1Tokens();

  // If OAuth 1.0a tokens are stored and configured, use OAuth 1.0a
  if (oauth1Tokens.oauthToken && oauth1Tokens.oauthTokenSecret) {
    const oauth1Header = getOAuth1Header(
      url,
      method,
      oauth1Tokens.oauthToken,
      oauth1Tokens.oauthTokenSecret
    );
    if (oauth1Header) {
      return {
        ...oauth1Header,
        "Content-Type": "application/json",
      };
    }
  }

  // Otherwise, use OAuth 2.0 Bearer token
  const token = await getValidTokenForAccount(connectedAccount);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Checks Ads API integration prerequisites and diagnostic status.
 * Never fakes success; provides clear, actionable diagnostics.
 */
async function checkIntegrationStatus(connectedAccount) {
  const status = {
    hasAppCredentials: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
    hasAdsConsumerKeys: Boolean(
      process.env.X_ADS_CONSUMER_KEY && process.env.X_ADS_CONSUMER_SECRET
    ),
    accountConnected: Boolean(connectedAccount),
    grantedScopes: connectedAccount ? connectedAccount.scopes : [],
    hasAdsScopes: false,
    apiAccessApproved: false,
    advertiserAccountsCount: 0,
    error: null,
    actionableGuidance: null,
  };

  if (!status.hasAppCredentials) {
    status.error = "Missing X App Credentials";
    status.actionableGuidance =
      "Set X_CLIENT_ID and X_CLIENT_SECRET in environment variables or Admin Settings.";
    return status;
  }

  if (!connectedAccount) {
    status.error = "No connected X Account";
    status.actionableGuidance = "Connect an active X account via OAuth 2.0.";
    return status;
  }

  status.hasAdsScopes =
    status.grantedScopes.includes("ads.read") ||
    status.grantedScopes.includes("ads.write");

  try {
    const accounts = await getAdvertisingAccounts(connectedAccount);
    status.apiAccessApproved = true;
    status.advertiserAccountsCount = accounts.length;
    return status;
  } catch (err) {
    const statusCode = err.response?.status;
    const responseData = err.response?.data;

    if (statusCode === 401) {
      status.error = "Unauthorized (401)";
      status.actionableGuidance =
        "Access token is expired or unauthorized for Ads API. Try reconnecting your account.";
    } else if (statusCode === 403) {
      status.error = "Ads API Access Forbidden (403)";
      status.actionableGuidance =
        "Your X Developer App requires approved access to the X Ads API. Apply for Ads API approval at https://developer.x.com and ensure your advertiser account has administrative permissions.";
    } else {
      status.error = err.message;
      status.actionableGuidance =
        "Official X Ads API returned an error: " +
        (responseData?.errors?.[0]?.message || err.message);
    }

    return status;
  }
}

/**
 * Retrieves advertising accounts associated with the authenticated X account.
 * Endpoint: GET /12/accounts
 */
async function getAdvertisingAccounts(connectedAccount) {
  const url = `${ADS_API_BASE}/accounts`;
  const headers = await buildHeaders(connectedAccount, url, "GET");

  const response = await axios.get(url, { headers });
  const rawAccounts = response.data?.data || [];

  return rawAccounts.map((acc) => ({
    xAdsAccountId: acc.id,
    accountName: acc.name || `Ads Account ${acc.id}`,
    currency: acc.currency || "USD",
    timezone: acc.timezone || "UTC",
    approvalStatus: acc.approval_status || "ACCEPTED",
    industryType: acc.industry_type || "",
    spendingLimitMicro: acc.spending_limit_absolute || null,
  }));
}

/**
 * Retrieves campaigns for an advertising account.
 * Endpoint: GET /12/accounts/:account_id/campaigns
 */
async function listCampaigns(connectedAccount, adsAccountId, params = {}) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/campaigns`;
  const headers = await buildHeaders(connectedAccount, url, "GET");

  const response = await axios.get(url, {
    headers,
    params: {
      count: 100,
      with_deleted: false,
      ...params,
    },
  });

  return response.data?.data || [];
}

/**
 * Creates an ad campaign in the official X Ads API.
 * Endpoint: POST /12/accounts/:account_id/campaigns
 */
async function createCampaign(connectedAccount, adsAccountId, campaignData) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/campaigns`;
  const headers = await buildHeaders(connectedAccount, url, "POST");

  const payload = {
    name: campaignData.name,
    funding_instrument_id: campaignData.fundingInstrumentId,
    daily_budget_amount_local_micro: campaignData.dailyBudgetAmountLocalMicro,
    total_budget_amount_local_micro: campaignData.totalBudgetAmountLocalMicro,
    start_time: new Date(campaignData.startTime).toISOString(),
    end_time: campaignData.endTime
      ? new Date(campaignData.endTime).toISOString()
      : undefined,
    entity_status: campaignData.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
  };

  const response = await axios.post(url, payload, { headers });
  return response.data?.data;
}

/**
 * Updates campaign status, budget, or dates.
 * Endpoint: PUT /12/accounts/:account_id/campaigns/:campaign_id
 */
async function updateCampaign(
  connectedAccount,
  adsAccountId,
  externalCampaignId,
  updates
) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/campaigns/${externalCampaignId}`;
  const headers = await buildHeaders(connectedAccount, url, "PUT");

  const payload = {};
  if (updates.name) payload.name = updates.name;
  if (updates.status) {
    payload.entity_status = updates.status === "ACTIVE" ? "ACTIVE" : "PAUSED";
  }
  if (updates.dailyBudgetAmountLocalMicro) {
    payload.daily_budget_amount_local_micro =
      updates.dailyBudgetAmountLocalMicro;
  }
  if (updates.endTime) {
    payload.end_time = new Date(updates.endTime).toISOString();
  }

  const response = await axios.put(url, payload, { headers });
  return response.data?.data;
}

/**
 * Creates a Line Item (Ad Group) in the official X Ads API.
 * Endpoint: POST /12/accounts/:account_id/line_items
 */
async function createLineItem(connectedAccount, adsAccountId, lineItemData) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/line_items`;
  const headers = await buildHeaders(connectedAccount, url, "POST");

  const payload = {
    campaign_id: lineItemData.externalCampaignId,
    name: lineItemData.name,
    bid_amount_local_micro: lineItemData.bidAmountLocalMicro,
    bid_strategy: lineItemData.bidStrategy || "AUTO",
    billing_event: lineItemData.billingEvent || "LINK_CLICKS",
    placements: lineItemData.placements || ["ALL_ON_TWITTER"],
    entity_status: lineItemData.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
    start_time: lineItemData.startTime
      ? new Date(lineItemData.startTime).toISOString()
      : new Date().toISOString(),
  };

  const response = await axios.post(url, payload, { headers });
  return response.data?.data;
}

/**
 * Promotes a tweet for a line item.
 * Endpoint: POST /12/accounts/:account_id/promoted_tweets
 */
async function createPromotedTweet(
  connectedAccount,
  adsAccountId,
  lineItemId,
  tweetId
) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/promoted_tweets`;
  const headers = await buildHeaders(connectedAccount, url, "POST");

  const payload = {
    line_item_id: lineItemId,
    tweet_ids: [tweetId],
  };

  const response = await axios.post(url, payload, { headers });
  return response.data?.data;
}

/**
 * Creates a Website Card on X Ads.
 * Endpoint: POST /12/accounts/:account_id/cards/website
 */
async function createWebsiteCard(connectedAccount, adsAccountId, cardData) {
  const url = `${ADS_API_BASE}/accounts/${adsAccountId}/cards/website`;
  const headers = await buildHeaders(connectedAccount, url, "POST");

  const payload = {
    name: cardData.name || "Website Card",
    website_url: cardData.websiteUrl,
    website_title: cardData.headline || "",
    image_media_id: cardData.mediaIdString || undefined,
  };

  const response = await axios.post(url, payload, { headers });
  return response.data?.data;
}

/**
 * Retrieves campaign performance analytics from X Ads API.
 * Endpoint: GET /12/stats/accounts/:account_id/campaigns
 */
async function getCampaignStats(
  connectedAccount,
  adsAccountId,
  campaignIds = [],
  startTime = null,
  endTime = null
) {
  const url = `${ADS_API_BASE}/stats/accounts/${adsAccountId}`;
  const headers = await buildHeaders(connectedAccount, url, "GET");

  const now = new Date();
  const start = startTime || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const end = endTime || now;

  const params = {
    entity: "CAMPAIGN",
    entity_ids: campaignIds.join(","),
    metric_groups: "ENGAGEMENT,BILLING,WEB_CONVERSION",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    granularity: "TOTAL",
  };

  const response = await axios.get(url, { headers, params });
  return response.data?.data || [];
}

module.exports = {
  checkIntegrationStatus,
  getAdvertisingAccounts,
  listCampaigns,
  createCampaign,
  updateCampaign,
  createLineItem,
  createPromotedTweet,
  createWebsiteCard,
  getCampaignStats,
};

