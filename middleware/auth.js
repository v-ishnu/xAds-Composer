const User = require("../models/user");
const ConnectedXAccount = require("../models/connectedXAccount");

/**
 * Ensures user is authenticated via session.
 */
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.xhr || req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHENTICATED",
      });
    }
    return res.redirect("/login");
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    if (user.status === "suspended") {
      req.session.destroy(() => {});
      return res.status(403).json({
        success: false,
        error: "Your account has been suspended. Please contact the administrator.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("[Auth Middleware] Error loading user:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authentication",
    });
  }
}

/**
 * Ensures authenticated user has super_admin role.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied: Super Admin privileges required",
      code: "FORBIDDEN",
    });
  }
  next();
}

/**
 * Resolves active connected X account for the workspace
 */
async function loadActiveXAccount(req, res, next) {
  if (!req.user) return next();

  try {
    const requestedId =
      req.headers["x-account-id"] ||
      req.query.xAccountId ||
      req.body?.connectedXAccountId ||
      req.user.activeConnectedXAccountId;

    let account = null;
    if (requestedId) {
      account = await ConnectedXAccount.findOne({
        _id: requestedId,
        userId: req.user._id,
      });
    }

    if (!account) {
      // Default to first connected account
      account = await ConnectedXAccount.findOne({
        userId: req.user._id,
        connectionStatus: "connected",
      }).sort({ updatedAt: -1 });
    }

    req.activeXAccount = account;
    next();
  } catch (err) {
    console.error("[Auth Middleware] Error loading active X account:", err.message);
    next();
  }
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  loadActiveXAccount,
};

