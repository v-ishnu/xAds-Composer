const User = require("../models/user");
const Invitation = require("../models/invitation");
const ConnectedXAccount = require("../models/connectedXAccount");
const AdvertisingAccount = require("../models/advertisingAccount");
const Campaign = require("../models/campaign");
const AuditLog = require("../models/auditLog");
const PlatformSetting = require("../models/platformSetting");
const { logAudit } = require("../services/auditService");

async function getStats(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalConnectedAccounts,
      totalAdAccounts,
      totalCampaigns,
      recentAuditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ status: "suspended" }),
      ConnectedXAccount.countDocuments(),
      AdvertisingAccount.countDocuments(),
      Campaign.countDocuments(),
      AuditLog.find().sort({ createdAt: -1 }).limit(10),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalConnectedAccounts,
        totalAdAccounts,
        totalCampaigns,
      },
      recentActivity: recentAuditLogs,
    });
  } catch (err) {
    console.error("[Admin Controller] getStats error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve admin statistics",
    });
  }
}

async function listUsers(req, res) {
  try {
    const { search = "", role = "", status = "" } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    // Attach connected accounts count for each user
    const usersWithMeta = await Promise.all(
      users.map(async (u) => {
        const connectedCount = await ConnectedXAccount.countDocuments({
          userId: u._id,
        });
        const adAccountsCount = await AdvertisingAccount.countDocuments({
          userId: u._id,
        });
        return {
          ...u.toObject(),
          connectedAccountsCount: connectedCount,
          adAccountsCount,
        };
      })
    );

    return res.json({
      success: true,
      users: usersWithMeta,
    });
  } catch (err) {
    console.error("[Admin Controller] listUsers error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to list users",
    });
  }
}

async function createDirectUser(req, res) {
  const { name, email, password, role } = req.validatedBody;

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "A user with this email address already exists.",
      });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || "user",
      status: "active",
      emailVerified: true,
    });

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "ADMIN_CREATED_USER",
      category: "USER_MANAGEMENT",
      details: { createdUserId: user._id, createdUserEmail: user.email },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[Admin Controller] createDirectUser error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to create user",
    });
  }
}

async function inviteUser(req, res) {
  const { email } = req.validatedBody;
  const targetEmail = email.toLowerCase().trim();

  try {
    const existingUser = await User.findOne({ email: targetEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "A registered user with this email already exists.",
      });
    }

    // Revoke any pending invitations for this email
    await Invitation.updateMany(
      { email: targetEmail, status: "pending" },
      { status: "revoked" }
    );

    const rawToken = Invitation.generateRawToken();
    const tokenHash = Invitation.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity

    const invitation = await Invitation.create({
      email: targetEmail,
      tokenHash,
      expiresAt,
      createdBy: req.user._id,
      status: "pending",
    });

    const inviteLink = `${req.protocol}://${req.get("host")}/register?token=${rawToken}`;

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "ADMIN_INVITED_USER",
      category: "USER_MANAGEMENT",
      details: { invitedEmail: targetEmail, invitationId: invitation._id },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Invitation issued successfully",
      invitation: {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        inviteLink,
      },
    });
  } catch (err) {
    console.error("[Admin Controller] inviteUser error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to issue invitation",
    });
  }
}

async function listInvitations(req, res) {
  try {
    const invitations = await Invitation.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      invitations,
    });
  } catch (err) {
    console.error("[Admin Controller] listInvitations error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve invitations",
    });
  }
}

async function revokeInvitation(req, res) {
  const { id } = req.params;

  try {
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
      });
    }

    invitation.status = "revoked";
    await invitation.save();

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "ADMIN_REVOKED_INVITATION",
      category: "USER_MANAGEMENT",
      details: { invitationId: id, email: invitation.email },
      req,
    });

    return res.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (err) {
    console.error("[Admin Controller] revokeInvitation error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to revoke invitation",
    });
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.validatedBody;

  try {
    if (String(req.user._id) === String(id) && status === "suspended") {
      return res.status(400).json({
        success: false,
        error: "Super Admin cannot suspend their own account.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.status = status;
    await user.save();

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: status === "suspended" ? "ADMIN_SUSPENDED_USER" : "ADMIN_REACTIVATED_USER",
      category: "USER_MANAGEMENT",
      details: { targetUserId: id, status },
      req,
    });

    return res.json({
      success: true,
      message: `User status updated to ${status}`,
      user,
    });
  } catch (err) {
    console.error("[Admin Controller] updateUserStatus error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to update user status",
    });
  }
}

async function deleteUser(req, res) {
  const { id } = req.params;

  try {
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        error: "Super Admin cannot delete their own account.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Clean up connected accounts, advertising accounts, campaigns
    await Promise.all([
      ConnectedXAccount.deleteMany({ userId: id }),
      AdvertisingAccount.deleteMany({ userId: id }),
      Campaign.deleteMany({ userId: id }),
      User.findByIdAndDelete(id),
    ]);

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "ADMIN_DELETED_USER",
      category: "USER_MANAGEMENT",
      details: { deletedUserId: id, deletedEmail: user.email },
      req,
    });

    return res.json({
      success: true,
      message: "User and associated workspace data deleted successfully",
    });
  } catch (err) {
    console.error("[Admin Controller] deleteUser error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to delete user",
    });
  }
}

async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 50, category = "" } = req.query;
    const query = {};
    if (category) query.category = category;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      AuditLog.countDocuments(query),
    ]);

    return res.json({
      success: true,
      logs,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    console.error("[Admin Controller] getAuditLogs error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve audit logs",
    });
  }
}

async function getPlatformSettings(req, res) {
  try {
    const settings = {
      X_CLIENT_ID: process.env.X_CLIENT_ID ? `${process.env.X_CLIENT_ID.substring(0, 6)}...` : "",
      X_CLIENT_SECRET_SET: Boolean(process.env.X_CLIENT_SECRET),
      X_REDIRECT_URI: process.env.X_REDIRECT_URI || "",
      X_ADS_CONSUMER_KEY_SET: Boolean(process.env.X_ADS_CONSUMER_KEY),
      X_ADS_CONSUMER_SECRET_SET: Boolean(process.env.X_ADS_CONSUMER_SECRET),
      SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || "",
    };

    return res.json({
      success: true,
      settings,
    });
  } catch (err) {
    console.error("[Admin Controller] getPlatformSettings error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve platform settings",
    });
  }
}

async function updatePlatformSettings(req, res) {
  const updates = req.validatedBody;

  try {
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== "") {
        process.env[key] = val;
        await PlatformSetting.setSetting(
          key,
          val,
          key.includes("SECRET") || key.includes("KEY"),
          req.user._id,
          `Configured by ${req.user.email}`
        );
      }
    }

    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "ADMIN_UPDATED_SETTINGS",
      category: "SYSTEM",
      details: { keysUpdated: Object.keys(updates) },
      req,
    });

    return res.json({
      success: true,
      message: "Platform settings updated successfully",
    });
  } catch (err) {
    console.error("[Admin Controller] updatePlatformSettings error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to update platform settings",
    });
  }
}

module.exports = {
  getStats,
  listUsers,
  createDirectUser,
  inviteUser,
  listInvitations,
  revokeInvitation,
  updateUserStatus,
  deleteUser,
  getAuditLogs,
  getPlatformSettings,
  updatePlatformSettings,
};

