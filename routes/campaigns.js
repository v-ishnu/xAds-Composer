const express = require("express");
const router = express.Router();
const campaignsController = require("../controller/campaigns");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");

router.use(requireAuth, loadActiveXAccount);

router.get("/", campaignsController.listCampaigns);
router.get("/:id", campaignsController.getCampaign);
router.post("/validate-draft", campaignsController.validateCampaignDraft);
router.post("/guided-create", campaignsController.createGuidedCampaign);
router.patch("/:id/status", campaignsController.updateStatus);

module.exports = router;

