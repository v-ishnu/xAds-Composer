const express = require("express");
const router = express.Router();
const postController = require("../controller/post");
const { requireAuth, loadActiveXAccount } = require("../middleware/auth");

router.use(requireAuth, loadActiveXAccount);

router.post("/drafts", postController.saveDraft);
router.get("/drafts", postController.listDrafts);
router.post("/publish", postController.publishOrganicTweet);

module.exports = router;

