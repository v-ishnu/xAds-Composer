const express = require("express");
const router = express.Router();
const adAccountsController = require("../controller/adAccounts");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");

router.use(requireAuth, loadActiveXAccount);

router.get("/", adAccountsController.listAdAccounts);
router.post("/refresh", adAccountsController.refreshAdAccounts);
router.post("/:id/select", adAccountsController.setActiveAdAccount);

module.exports = router;

