const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

// Official X OAuth 2.0 & API v2 Endpoints
const X_AUTH_BASE = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_API_BASE = "https://api.x.com/2";

// Default scopes according to official X API v2 documentation
// Do NOT include unapproved ads.read / ads.write by default for standard developer apps
const DEFAULT_SCOPES = (
  process.env.X_OAUTH_SCOPES || "users.read tweet.read tweet.write offline.access"
)
  .split(/[,\s]+/)
  .filter(Boolean);

/**
 * Base64-URL encoder for PKCE (RFC 7636)
 */
function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates cryptographically secure PKCE Code Verifier & Challenge (S256)
 * - Verifier: 43 to 128 characters from unreserved characters
 * - Challenge: Base64URL-encoded SHA-256 hash of verifier
 */
function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash("sha256").update(verifier).digest()
  );
  return { verifier, challenge };
}

/**
 * Generates cryptographically secure random state parameter for CSRF protection
 */
function generateState() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Resolves the configured callback/redirect URI from environment
 */
function getRedirectUri(customRedirectUri = null) {
  return (
    customRedirectUri ||
    process.env.X_CALLBACK_URL ||
    process.env.X_REDIRECT_URI ||
    "http://localhost:3000/api/x-accounts/callback"
  );
}

/**
 * Constructs the official X OAuth 2.0 PKCE Authorization URL
 * Endpoint: https://x.com/i/oauth2/authorize
 */
function getAuthorizationUrl(state, codeChallenge, customRedirectUri = null, customScopes = null) {
  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = getRedirectUri(customRedirectUri);
  const scopes = customScopes || DEFAULT_SCOPES;

  if (!clientId) {
    throw new Error(
      "X_CLIENT_ID is not configured. Please set X_CLIENT_ID in your environment or Admin Settings."
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${X_AUTH_BASE}?${params.toString()}`;
}

/**
 * Exchanges authorization code for Access & Refresh tokens
 * Endpoint: POST https://api.x.com/2/oauth2/token
 */
async function exchangeCodeForTokens(code, codeVerifier, customRedirectUri = null) {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirectUri = getRedirectUri(customRedirectUri);

  if (!clientId) {
    throw new Error("X_CLIENT_ID must be configured.");
  }

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const bodyParams = {
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  };

  // If clientSecret is provided (Confidential Client), use HTTP Basic Auth
  if (clientSecret) {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${authHeader}`;
  } else {
    // Public Client: Pass client_id in request body
    bodyParams.client_id = clientId;
  }

  const payload = new URLSearchParams(bodyParams);

  try {
    const response = await axios.post(X_TOKEN_URL, payload.toString(), {
      headers,
      timeout: 15000,
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      scope: response.data.scope,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorMsg =
      data?.error_description ||
      data?.error ||
      data?.message ||
      err.message ||
      "Token exchange failed";

    console.error(
      `[OAuth Diagnostics] Token exchange failed with status ${status}:`,
      data?.error || errorMsg
    );

    const error = new Error(`X OAuth Token Exchange Error (${status || "Network"}): ${errorMsg}`);
    error.status = status;
    error.oauthData = data;
    throw error;
  }
}

/**
 * Refreshes an expired OAuth 2.0 access token
 */
async function refreshAccessToken(refreshToken) {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("X_CLIENT_ID must be configured.");
  }

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const bodyParams = {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  if (clientSecret) {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${authHeader}`;
  } else {
    bodyParams.client_id = clientId;
  }

  const payload = new URLSearchParams(bodyParams);

  try {
    const response = await axios.post(X_TOKEN_URL, payload.toString(), {
      headers,
      timeout: 15000,
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in,
      scope: response.data.scope,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorMsg =
      data?.error_description ||
      data?.error ||
      data?.message ||
      err.message ||
      "Token refresh failed";

    console.error(
      `[OAuth Diagnostics] Token refresh failed with status ${status}:`,
      data?.error || errorMsg
    );

    const error = new Error(`X OAuth Token Refresh Error (${status || "Network"}): ${errorMsg}`);
    error.status = status;
    throw error;
  }
}

/**
 * Retrieves the authenticated user profile from X API v2
 * Endpoint: GET https://api.x.com/2/users/me
 */
async function getAuthenticatedUser(accessToken) {
  try {
    const response = await axios.get(`${X_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        "user.fields": "profile_image_url,verified,name,username,public_metrics",
      },
      timeout: 15000,
    });

    if (!response.data || !response.data.data) {
      throw new Error("Invalid response from X users/me endpoint");
    }

    return response.data.data;
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const errorMsg =
      data?.errors?.[0]?.message ||
      data?.detail ||
      data?.title ||
      err.message ||
      "Failed to retrieve user profile";

    console.error(
      `[OAuth Diagnostics] User profile retrieval failed with status ${status}:`,
      errorMsg
    );

    const error = new Error(`X Identity Verification Error (${status || "Network"}): ${errorMsg}`);
    error.status = status;
    throw error;
  }
}

/**
 * Publishes an organic post/tweet via X API v2
 */
async function postTweet(accessToken, { text, mediaIds = [], cardUri = null }) {
  const body = { text };

  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  if (cardUri) {
    body.card_uri = cardUri;
  }

  const response = await axios.post(`${X_API_BASE}/tweets`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  return response.data.data;
}

/**
 * Deletes a tweet via X API v2
 */
async function deleteTweet(accessToken, tweetId) {
  const response = await axios.delete(`${X_API_BASE}/tweets/${tweetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 15000,
  });

  return response.data.data;
}

module.exports = {
  DEFAULT_SCOPES,
  X_AUTH_BASE,
  X_TOKEN_URL,
  X_API_BASE,
  getRedirectUri,
  generatePkcePair,
  generateState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getAuthenticatedUser,
  postTweet,
  deleteTweet,
};
