const AuditLog = require("../models/auditLog");

async function logAudit({
  userId = null,
  userEmail = null,
  action,
  category = "SYSTEM",
  details = {},
  req = null,
}) {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress =
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip;
      userAgent = req.headers["user-agent"];
      if (!userId && req.user) {
        userId = req.user._id;
        userEmail = req.user.email;
      }
    }

    await AuditLog.create({
      userId,
      userEmail,
      action,
      category,
      details,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error("[AuditService] Failed to record audit log:", err.message);
  }
}

module.exports = {
  logAudit,
};

