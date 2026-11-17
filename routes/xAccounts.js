const express = require("express");
const router = express.Router();
const xAccountsController = require("../controller/xAccounts");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");

// Step 1: Start OAuth 2.0 PKCE connection (requires authenticated platform user)
router.get("/connect", requireAuth, xAccountsController.startOAuth);

// Step 3: OAuth callback from X (handled with cryptographic state validation & clean user redirect)
router.get("/callback", xAccountsController.oauthCallback);

// Account management routes
router.get("/", requireAuth, xAccountsController.listAccounts);
router.post("/:id/select", requireAuth, xAccountsController.setActiveAccount);
router.post("/:id/sync", requireAuth, xAccountsController.syncAccount);
router.delete("/:id", requireAuth, xAccountsController.disconnectAccount);
router.get(
  "/diagnostics",
  requireAuth,
  loadActiveXAccount,
  xAccountsController.getIntegrationDiagnostics
);

module.exports = router;
