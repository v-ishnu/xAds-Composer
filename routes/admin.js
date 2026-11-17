const express = require("express");
const router = express.Router();
const adminController = require("../controller/admin");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const {
  validateBody,
  inviteUserSchema,
  createDirectUserSchema,
  updateStatusSchema,
  updatePlatformSettingsSchema,
} = require("../middleware/validation");

// Enforce both authentication and super admin role
router.use(requireAuth, requireSuperAdmin);

router.get("/stats", adminController.getStats);
router.get("/users", adminController.listUsers);
router.post(
  "/users/create",
  validateBody(createDirectUserSchema),
  adminController.createDirectUser
);
router.post(
  "/users/invite",
  validateBody(inviteUserSchema),
  adminController.inviteUser
);
router.get("/invitations", adminController.listInvitations);
router.post("/invitations/:id/revoke", adminController.revokeInvitation);
router.patch(
  "/users/:id/status",
  validateBody(updateStatusSchema),
  adminController.updateUserStatus
);
router.delete("/users/:id", adminController.deleteUser);
router.get("/audit-logs", adminController.getAuditLogs);
router.get("/settings", adminController.getPlatformSettings);
router.post(
  "/settings",
  validateBody(updatePlatformSettingsSchema),
  adminController.updatePlatformSettings
);

module.exports = router;

