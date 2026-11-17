const express = require("express");
const router = express.Router();
const targetingController = require("../controller/targeting");
const { requireAuth } = require("../middleware/auth");

router.get("/options", requireAuth, targetingController.getTargetingOptions);

module.exports = router;

