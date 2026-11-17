const express = require("express");
const router = express.Router();
const analyticsController = require("../controller/analytics");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");

router.get(
  "/overview",
  requireAuth,
  loadActiveXAccount,
  analyticsController.getOverviewAnalytics
);

module.exports = router;

