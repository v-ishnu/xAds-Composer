const ConnectedXAccount = require("../models/connectedXAccount");
const AdvertisingAccount = require("../models/advertisingAccount");
const OAuthState = require("../models/oauthState");
const User = require("../models/user");
const xApiV2 = require("../services/xApiV2");
const {
  checkIntegrationStatus,
  getAdvertisingAccounts,
} = require("../services/xAdsApi");
const { logAudit } = require("../services/auditService");

/**
 * Step 1: Initiate OAuth 2.0 PKCE Connection
 * Endpoint: GET /api/x-accounts/connect
 */
async function startOAuth(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required to connect an X account.",
      });
    }

    const { verifier, challenge } = xApiV2.generatePkcePair();
    const state = xApiV2.generateState();
    const redirectUri = xApiV2.getRedirectUri();

    // 1. Persist state and verifier in MongoDB with a 10-minute TTL
    await OAuthState.create({
      state,
      codeVerifier: verifier,
      userId: req.user._id,
      redirectUri,
      scopes: xApiV2.DEFAULT_SCOPES,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      used: false,
    });

    // 2. Also record in session for session-based verification
    req.session.oauthState = state;
    req.session.oauthCodeVerifier = verifier;

    // Explicitly persist session before returning JSON
    await new Promise((resolve) => req.session.save(resolve));

    // 3. Construct official X authorization URL
    const authUrl = xApiV2.getAuthorizationUrl(state, challenge, redirectUri, xApiV2.DEFAULT_SCOPES);

    console.log(
      `[OAuth Diagnostics] OAuth flow initiated for user ${req.user.email}. State: ${state.substring(0, 8)}...`
    );

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "OAUTH_INITIATED",
      category: "X_ACCOUNT",
      details: { redirectUri, scopes: xApiV2.DEFAULT_SCOPES },
      req,
    });

    return res.json({
      success: true,
      authUrl,
    });
  } catch (err) {
    console.error("[OAuth Diagnostics] startOAuth error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to initialize X OAuth authorization",
    });
  }
}

/**
 * Step 3 & 4 & 5: Handle OAuth Callback, Exchange Code, Verify Identity & Save
 * Endpoint: GET /api/x-accounts/callback
 */
async function oauthCallback(req, res) {
  const { code, state, error, error_description } = req.query;

  // 1. Handle user cancellation or OAuth error parameters from X
  if (error) {
    const isUserDenied = error === "access_denied";
    const userMessage = isUserDenied
      ? "Authorization was cancelled by user."
      : (error_description || error);

    console.warn(`[OAuth Diagnostics] OAuth callback returned error from X: ${error} (${error_description})`);

    return res.redirect(
      `/dashboard?error=${encodeURIComponent(userMessage)}#accounts`
    );
  }

  // 2. Validate presence of code and state
  if (!code || !state) {
    console.error("[OAuth Diagnostics] Callback received with missing code or state.");
    return res.redirect(
      `/dashboard?error=${encodeURIComponent("Missing authorization code or state parameter.")}#accounts`
    );
  }

  try {
    // 3. Find and validate state in the database
    const oauthRecord = await OAuthState.findOne({ state });

    if (!oauthRecord) {
      console.error(`[OAuth Diagnostics] State not found or expired. Received: ${state.substring(0, 8)}...`);
      return res.redirect(
        `/dashboard?error=${encodeURIComponent("Authorization request timed out or state is invalid. Please try connecting again.")}#accounts`
      );
    }

    if (oauthRecord.used) {
      console.warn(`[OAuth Diagnostics] Replay attack prevented: State ${state.substring(0, 8)}... was already used.`);
      return res.redirect(
        `/dashboard?error=${encodeURIComponent("This authorization link has already been used. Please initiate a new connection.")}#accounts`
      );
    }

    if (oauthRecord.expiresAt < new Date()) {
      console.warn(`[OAuth Diagnostics] State ${state.substring(0, 8)}... has expired.`);
      return res.redirect(
        `/dashboard?error=${encodeURIComponent("Authorization session has expired. Please try connecting again.")}#accounts`
      );
    }

    // Mark state as consumed immediately (Atomic replay prevention)
    oauthRecord.used = true;
    await oauthRecord.save();

    // 4. Resolve authenticated user context
    let authenticatedUser = req.user;
    if (!authenticatedUser && oauthRecord.userId) {
      authenticatedUser = await User.findById(oauthRecord.userId);
      if (authenticatedUser && authenticatedUser.status === "active") {
        req.user = authenticatedUser;
        req.session.userId = authenticatedUser._id;
        req.session.role = authenticatedUser.role;
      }
    }

    if (!authenticatedUser || authenticatedUser.status !== "active") {
      console.error("[OAuth Diagnostics] No active platform user session found for OAuth callback.");
      return res.redirect(
        `/login?error=${encodeURIComponent("Session expired during authorization. Please log in again.")}`
      );
    }

    // Clear session-level OAuth state
    req.session.oauthState = null;
    req.session.oauthCodeVerifier = null;

    // 5. Exchange authorization code for tokens using PKCE verifier
    console.log(`[OAuth Diagnostics] Exchanging code for tokens with PKCE verifier...`);
    const tokens = await xApiV2.exchangeCodeForTokens(
      code,
      oauthRecord.codeVerifier,
      oauthRecord.redirectUri
    );
    console.log(`[OAuth Diagnostics] Token exchange succeeded. Scopes granted: ${tokens.scope || "default"}`);

    // 6. Verify X Identity by calling GET /2/users/me
    console.log(`[OAuth Diagnostics] Verifying identity via X API v2 /users/me...`);
    const xUser = await xApiV2.getAuthenticatedUser(tokens.accessToken);
    console.log(`[OAuth Diagnostics] Identity verified: @${xUser.username} (ID: ${xUser.id})`);

    // 7. Store / Reconnect ConnectedXAccount in database with AES-256-GCM encrypted tokens
    let account = await ConnectedXAccount.findOne({
      userId: authenticatedUser._id,
      xUserId: xUser.id,
    });

    if (!account) {
      account = new ConnectedXAccount({
        userId: authenticatedUser._id,
        xUserId: xUser.id,
        username: xUser.username,
        displayName: xUser.name,
        profileImage: xUser.profile_image_url || "",
      });
    } else {
      // Reconnecting existing account: update profile info
      account.username = xUser.username;
      account.displayName = xUser.name;
      account.profileImage = xUser.profile_image_url || account.profileImage;
    }

    // Encrypts tokens at rest using AES-256-GCM
    account.setTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresIn,
      scopes: tokens.scope,
    });

    await account.save();

    // Set as active account if user currently has none
    if (!authenticatedUser.activeConnectedXAccountId) {
      authenticatedUser.activeConnectedXAccountId = account._id;
      await authenticatedUser.save();
    }

    // 8. Auto-sync associated advertiser accounts (non-blocking for organic connection)
    try {
      const adAccounts = await getAdvertisingAccounts(account);
      for (const adAcc of adAccounts) {
        await AdvertisingAccount.findOneAndUpdate(
          { userId: authenticatedUser._id, xAdsAccountId: adAcc.xAdsAccountId },
          {
            ...adAcc,
            connectedXAccountId: account._id,
            userId: authenticatedUser._id,
            lastSyncedAt: new Date(),
          },
          { upsert: true }
        );
      }
      console.log(`[OAuth Diagnostics] Synchronized ${adAccounts.length} advertising accounts for @${xUser.username}.`);
    } catch (adErr) {
      console.warn(
        `[OAuth Diagnostics] Ads account sync note for @${account.username}: ${adErr.message}. (Account connection is still valid for organic features).`
      );
    }

    // Record audit event
    await logAudit({
      userId: authenticatedUser._id,
      userEmail: authenticatedUser.email,
      action: "CONNECTED_X_ACCOUNT",
      category: "X_ACCOUNT",
      details: {
        xUserId: xUser.id,
        username: xUser.username,
        accountId: account._id,
      },
      req,
    });

    // Save session to ensure cookies and user state are committed
    await new Promise((resolve) => req.session.save(resolve));

    return res.redirect(
      `/dashboard?connected=${encodeURIComponent(xUser.username)}#accounts`
    );
  } catch (err) {
    console.error("[OAuth Diagnostics] oauthCallback error:", err.message);
    const clientMessage =
      err.oauthData?.error_description ||
      err.message ||
      "Failed to complete X authorization";

    return res.redirect(
      `/dashboard?error=${encodeURIComponent(clientMessage)}#accounts`
    );
  }
}

/**
 * Lists all connected X accounts for the authenticated user
 * Endpoint: GET /api/x-accounts
 */
async function listAccounts(req, res) {
  try {
    const accounts = await ConnectedXAccount.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    const accountsWithMeta = await Promise.all(
      accounts.map(async (acc) => {
        const adAccountsCount = await AdvertisingAccount.countDocuments({
          connectedXAccountId: acc._id,
        });

        const isTokenExpired =
          acc.tokenExpiresAt && acc.tokenExpiresAt < new Date();

        return {
          ...acc.toJSON(),
          associatedAdAccountsCount: adAccountsCount,
          isActive: String(req.user.activeConnectedXAccountId) === String(acc._id),
          isTokenExpired,
        };
      })
    );

    return res.json({
      success: true,
      accounts: accountsWithMeta,
      activeAccountId: req.user.activeConnectedXAccountId,
    });
  } catch (err) {
    console.error("[X Accounts Controller] listAccounts error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list connected accounts",
    });
  }
}

/**
 * Switches the active workspace X account
 * Endpoint: POST /api/x-accounts/:id/select
 */
async function setActiveAccount(req, res) {
  const { id } = req.params;

  try {
    const account = await ConnectedXAccount.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Connected account not found",
      });
    }

    req.user.activeConnectedXAccountId = account._id;

    // Pick first available ad account for this connected account
    const adAccount = await AdvertisingAccount.findOne({
      connectedXAccountId: account._id,
    });
    if (adAccount) {
      req.user.activeAdvertisingAccountId = adAccount._id;
    }

    await req.user.save();

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "SWITCHED_ACTIVE_X_ACCOUNT",
      category: "X_ACCOUNT",
      details: { accountId: id, username: account.username },
      req,
    });

    return res.json({
      success: true,
      message: `Active account switched to @${account.username}`,
      activeAccountId: account._id,
      activeAdAccountId: req.user.activeAdvertisingAccountId,
    });
  } catch (err) {
    console.error("[X Accounts Controller] setActiveAccount error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to switch active account",
    });
  }
}

/**
 * Disconnects an X account from the workspace
 * Endpoint: DELETE /api/x-accounts/:id
 */
async function disconnectAccount(req, res) {
  const { id } = req.params;

  try {
    const account = await ConnectedXAccount.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Connected account not found",
      });
    }

    // Delete associated ad accounts
    await AdvertisingAccount.deleteMany({ connectedXAccountId: account._id });
    await ConnectedXAccount.findByIdAndDelete(account._id);

    // If active account was deleted, switch to another or null
    if (String(req.user.activeConnectedXAccountId) === String(account._id)) {
      const remaining = await ConnectedXAccount.findOne({
        userId: req.user._id,
      });
      req.user.activeConnectedXAccountId = remaining ? remaining._id : null;
      req.user.activeAdvertisingAccountId = null;
      await req.user.save();
    }

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "DISCONNECTED_X_ACCOUNT",
      category: "X_ACCOUNT",
      details: { accountId: id, username: account.username },
      req,
    });

    return res.json({
      success: true,
      message: `Disconnected @${account.username}`,
    });
  } catch (err) {
    console.error("[X Accounts Controller] disconnectAccount error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to disconnect account",
    });
  }
}

/**
 * Re-synchronizes profile and advertising accounts from X
 * Endpoint: POST /api/x-accounts/:id/sync
 */
async function syncAccount(req, res) {
  const { id } = req.params;

  try {
    const account = await ConnectedXAccount.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Connected account not found",
      });
    }

    const token = account.getDecryptedAccessToken();
    const xUser = await getAuthenticatedUser(token);

    account.username = xUser.username;
    account.displayName = xUser.name;
    account.profileImage = xUser.profile_image_url || account.profileImage;
    account.lastSyncedAt = new Date();
    account.connectionStatus = "connected";
    await account.save();

    // Sync advertising accounts
    let syncedAdAccounts = 0;
    try {
      const adAccounts = await getAdvertisingAccounts(account);
      for (const adAcc of adAccounts) {
        await AdvertisingAccount.findOneAndUpdate(
          { userId: req.user._id, xAdsAccountId: adAcc.xAdsAccountId },
          {
            ...adAcc,
            connectedXAccountId: account._id,
            userId: req.user._id,
            lastSyncedAt: new Date(),
          },
          { upsert: true }
        );
      }
      syncedAdAccounts = adAccounts.length;
    } catch (adErr) {
      console.warn(
        `[X Accounts Controller] Ads API sync skipped for ${account.username}:`,
        adErr.message
      );
    }

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "SYNCED_X_ACCOUNT",
      category: "X_ACCOUNT",
      details: { accountId: id, syncedAdAccounts },
      req,
    });

    return res.json({
      success: true,
      message: `Account @${account.username} successfully synchronized`,
      account: account.toJSON(),
      syncedAdAccounts,
    });
  } catch (err) {
    console.error("[X Accounts Controller] syncAccount error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to synchronize X account",
    });
  }
}

/**
 * Evaluates integration readiness and developer portal diagnostic status
 * Endpoint: GET /api/x-accounts/diagnostics
 */
async function getIntegrationDiagnostics(req, res) {
  try {
    const activeAccount = req.activeXAccount;
    const diagnostics = await checkIntegrationStatus(activeAccount);

    return res.json({
      success: true,
      diagnostics,
    });
  } catch (err) {
    console.error("[X Accounts Controller] getIntegrationDiagnostics error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to evaluate integration diagnostics",
    });
  }
}

module.exports = {
  startOAuth,
  oauthCallback,
  listAccounts,
  setActiveAccount,
  disconnectAccount,
  syncAccount,
  getIntegrationDiagnostics,
};
