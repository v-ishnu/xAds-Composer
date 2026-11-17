const express = require("express");
const router = express.Router();
const authController = require("../controller/auth");
const { requireAuth } = require("../middleware/auth");
const {
  validateBody,
  loginSchema,
  acceptInviteSchema,
} = require("../middleware/validation");

router.post("/login", validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.get("/verify-invite", authController.verifyInvite);
router.post(
  "/accept-invite",
  validateBody(acceptInviteSchema),
  authController.acceptInvite
);

module.exports = router;

