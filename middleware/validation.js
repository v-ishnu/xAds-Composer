const { z } = require("zod");

/**
 * Higher-order middleware function to validate request bodies against a Zod schema.
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: err.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      return res.status(400).json({
        success: false,
        error: "Malformed request payload",
      });
    }
  };
}

// Schemas
const loginSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(1, "Password is required"),
});

const inviteUserSchema = z.object({
  email: z.string().email("Valid email address is required"),
});

const acceptInviteSchema = z.object({
  token: z.string().min(10, "Invalid invitation token"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

const createDirectUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email address is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["user", "super_admin"]).optional().default("user"),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

const createCampaignSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters"),
  objective: z.enum([
    "WEBSITE_TRAFFIC",
    "ENGAGEMENTS",
    "REACH",
    "VIDEO_VIEWS",
    "PREROLL_VIEWS",
    "APP_INSTALLS",
    "FOLLOWERS",
  ]),
  dailyBudgetAmountLocalMicro: z.coerce
    .number()
    .min(1000000, "Daily budget must be at least 1.00 in currency units (1,000,000 micros)"),
  totalBudgetAmountLocalMicro: z.coerce.number().optional().nullable(),
  currency: z.string().default("USD"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
  connectedXAccountId: z.string().min(1, "Connected X Account is required"),
  advertisingAccountId: z.string().min(1, "Advertising Account is required"),
});

const createAdGroupSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  name: z.string().min(2, "Line item name must be at least 2 characters"),
  bidAmountLocalMicro: z.coerce
    .number()
    .min(100000, "Bid amount must be at least 0.10 currency units"),
  bidStrategy: z.enum(["AUTO", "MAX", "TARGET"]).default("AUTO"),
  billingEvent: z.enum(["IMPRESSIONS", "ENGAGEMENTS", "LINK_CLICKS"]).default("LINK_CLICKS"),
  placements: z.array(z.string()).default(["ALL_ON_TWITTER"]),
  deliverySettings: z.enum(["STANDARD", "ACCELERATED"]).default("STANDARD"),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  targeting: z
    .object({
      locations: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      genders: z.array(z.string()).optional(),
      ageBuckets: z.array(z.string()).optional(),
      interests: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      followerLookalikes: z.array(z.string()).optional(),
      devices: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
    })
    .optional(),
});

const createCreativeSchema = z.object({
  name: z.string().default("Untitled creative"),
  text: z.string().min(1, "Post text is required").max(280, "Max 280 characters"),
  destinationUrl: z.string().optional().default(""),
  headline: z.string().max(70, "Max 70 characters").optional().default(""),
  mediaUrl: z.string().optional().default(""),
  mediaType: z.enum(["image", "video", "none"]).default("none"),
  promotedOnly: z.boolean().optional().default(false),
  madeWithAI: z.boolean().optional().default(false),
  connectedXAccountId: z.string().optional(),
  advertisingAccountId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  adGroupId: z.string().optional().nullable(),
});

const updatePlatformSettingsSchema = z.object({
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_REDIRECT_URI: z.string().optional(),
  X_ADS_CONSUMER_KEY: z.string().optional(),
  X_ADS_CONSUMER_SECRET: z.string().optional(),
});

module.exports = {
  validateBody,
  loginSchema,
  inviteUserSchema,
  acceptInviteSchema,
  createDirectUserSchema,
  updateStatusSchema,
  createCampaignSchema,
  createAdGroupSchema,
  createCreativeSchema,
  updatePlatformSettingsSchema,
};

