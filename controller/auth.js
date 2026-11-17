const User = require("../models/user");
const Invitation = require("../models/invitation");
const { logAudit } = require("../services/auditService");

async function login(req, res) {
  const { email, password } = req.validatedBody;

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      await logAudit({
        userEmail: email,
        action: "LOGIN_FAILED",
        category: "AUTH",
        details: { reason: "User not found" },
        req,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    if (user.status === "suspended") {
      await logAudit({
        userId: user._id,
        userEmail: user.email,
        action: "LOGIN_BLOCKED_SUSPENDED",
        category: "AUTH",
        details: { status: user.status },
        req,
      });
      return res.status(403).json({
        success: false,
        error: "Your account has been suspended. Please contact the administrator.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAudit({
        userId: user._id,
        userEmail: user.email,
        action: "LOGIN_FAILED",
        category: "AUTH",
        details: { reason: "Incorrect password" },
        req,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Initialize session
    req.session.userId = user._id;
    req.session.role = user.role;

    user.lastLoginAt = new Date();
    await user.save();

    await logAudit({
      userId: user._id,
      userEmail: user.email,
      action: "LOGIN_SUCCESS",
      category: "AUTH",
      req,
    });

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[Auth Controller] Login error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during login",
    });
  }
}

async function logout(req, res) {
  if (req.user) {
    await logAudit({
      userId: req.user._id,
      userEmail: req.user.email,
      action: "LOGOUT",
      category: "AUTH",
      req,
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("[Auth Controller] Session destruction error:", err);
    }
    res.clearCookie("connect.sid");
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  });
}

async function me(req, res) {
  return res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      activeConnectedXAccountId: req.user.activeConnectedXAccountId,
      activeAdvertisingAccountId: req.user.activeAdvertisingAccountId,
    },
  });
}

async function verifyInvite(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({
      success: false,
      error: "Invitation token is required",
    });
  }

  try {
    const tokenHash = Invitation.hashToken(token);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation || !invitation.isValid()) {
      return res.status(400).json({
        success: false,
        error: "This invitation link is invalid, expired, or has already been used.",
        code: "INVALID_INVITATION",
      });
    }

    return res.json({
      success: true,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    });
  } catch (err) {
    console.error("[Auth Controller] verifyInvite error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to verify invitation",
    });
  }
}

async function acceptInvite(req, res) {
  const { token, name, password } = req.validatedBody;

  try {
    const tokenHash = Invitation.hashToken(token);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation || !invitation.isValid()) {
      return res.status(400).json({
        success: false,
        error: "This invitation is invalid, expired, or has already been used.",
      });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      invitation.status = "revoked";
      await invitation.save();
      return res.status(409).json({
        success: false,
        error: "An account with this email address already exists.",
      });
    }

    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({
      name,
      email: invitation.email,
      passwordHash,
      role: "user",
      status: "active",
      emailVerified: true,
    });

    invitation.status = "accepted";
    invitation.usedAt = new Date();
    await invitation.save();

    // Start session immediately
    req.session.userId = newUser._id;
    req.session.role = newUser.role;

    await logAudit({
      userId: newUser._id,
      userEmail: newUser.email,
      action: "USER_REGISTERED_VIA_INVITE",
      category: "AUTH",
      details: { invitationId: invitation._id },
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("[Auth Controller] acceptInvite error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to register account via invitation",
    });
  }
}

module.exports = {
  login,
  logout,
  me,
  verifyInvite,
  acceptInvite,
};

