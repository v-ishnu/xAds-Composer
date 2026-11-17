const express = require("express");
const router = express.Router();
const lineItemsController = require("../controller/lineItems");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");
const { validateBody, createAdGroupSchema } = require("../middleware/validation");

router.use(requireAuth, loadActiveXAccount);

router.get("/", lineItemsController.listLineItems);
router.post(
  "/",
  validateBody(createAdGroupSchema),
  lineItemsController.createLineItem
);
router.patch("/:id/status", lineItemsController.updateStatus);

module.exports = router;

