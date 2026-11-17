const express = require("express");
const router = express.Router();
const creativesController = require("../controller/creatives");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");
const {
  validateBody,
  createCreativeSchema,
} = require("../middleware/validation");

router.use(requireAuth, loadActiveXAccount);

router.get("/", creativesController.listCreatives);
router.post(
  "/",
  validateBody(createCreativeSchema),
  creativesController.createCreative
);
router.post(
  "/upload",
  creativesController.uploadMiddleware,
  creativesController.handleMediaUpload
);

module.exports = router;

