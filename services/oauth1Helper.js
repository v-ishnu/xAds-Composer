const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
require("dotenv").config();

/**
 * Creates an OAuth 1.0a signer instance using consumer key & secret.
 */
function getOAuth1Signer() {
  const consumerKey = process.env.X_ADS_CONSUMER_KEY;
  const consumerSecret = process.env.X_ADS_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return null;
  }

  return OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
      return crypto.createHmac("sha1", key).update(base_string).digest("base64");
    },
  });
}

/**
 * Builds the OAuth 1.0a Authorization header for a request.
 */
function getOAuth1Header(url, method, token, tokenSecret) {
  const oauth = getOAuth1Signer();
  if (!oauth) return null;

  const requestData = {
    url,
    method: method.toUpperCase(),
  };

  const userToken = {
    key: token,
    secret: tokenSecret,
  };

  return oauth.toHeader(oauth.authorize(requestData, userToken));
}

module.exports = {
  getOAuth1Signer,
  getOAuth1Header,
};

