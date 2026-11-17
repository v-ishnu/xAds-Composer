/**
 * Provides officially supported X Ads targeting categories, values, and restrictions.
 */

const SUPPORTED_TARGETING_OPTIONS = {
  locations: [
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "JP", name: "Japan" },
    { code: "IN", name: "India" },
    { code: "BR", name: "Brazil" },
    { code: "GLOBAL", name: "Worldwide" },
  ],
  languages: [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "ja", name: "Japanese" },
    { code: "pt", name: "Portuguese" },
    { code: "it", name: "Italian" },
    { code: "hi", name: "Hindi" },
    { code: "ar", name: "Arabic" },
  ],
  genders: [
    { code: "ANY", name: "Any Gender" },
    { code: "MALE", name: "Men" },
    { code: "FEMALE", name: "Women" },
  ],
  ageBuckets: [
    { code: "AGE_13_TO_24", name: "13 to 24" },
    { code: "AGE_18_TO_34", name: "18 to 34" },
    { code: "AGE_21_TO_49", name: "21 to 49" },
    { code: "AGE_25_TO_54", name: "25 to 54" },
    { code: "AGE_35_TO_64", name: "35 to 64" },
    { code: "AGE_50_PLUS", name: "50 and above" },
    { code: "AGE_ALL", name: "All Ages" },
  ],
  platforms: [
    { code: "MOBILE", name: "Mobile Devices" },
    { code: "DESKTOP", name: "Desktop / Laptops" },
  ],
  devices: [
    { code: "IOS", name: "iOS (Apple iPhone/iPad)" },
    { code: "ANDROID", name: "Android Devices" },
    { code: "DESKTOP", name: "Desktop Web" },
  ],
  interests: [
    { id: "tech", name: "Technology & Computing" },
    { id: "business", name: "Business & Finance" },
    { id: "marketing", name: "Marketing & Advertising" },
    { id: "entertainment", name: "Entertainment & Pop Culture" },
    { id: "gaming", name: "Gaming & Esports" },
    { id: "sports", name: "Sports" },
    { id: "crypto", name: "Cryptocurrency & Web3" },
    { id: "science", name: "Science & AI" },
  ],
  placements: [
    { code: "ALL_ON_TWITTER", name: "All on X (Home Timeline, Search, Profiles)" },
    { code: "TWITTER_TIMELINE", name: "Home Timeline Only" },
    { code: "TWITTER_SEARCH", name: "Search Results Only" },
    { code: "TWITTER_PROFILES", name: "User Profiles Only" },
  ],
  objectives: [
    {
      code: "WEBSITE_TRAFFIC",
      name: "Website Clicks / Conversions",
      description: "Direct traffic to your website or landing page",
      defaultBilling: "LINK_CLICKS",
    },
    {
      code: "ENGAGEMENTS",
      name: "Post Engagements",
      description: "Maximize likes, reposts, and replies on your posts",
      defaultBilling: "ENGAGEMENTS",
    },
    {
      code: "REACH",
      name: "Reach",
      description: "Maximize the number of people who see your ads",
      defaultBilling: "IMPRESSIONS",
    },
    {
      code: "VIDEO_VIEWS",
      name: "Video Views",
      description: "Get more people to watch your video content",
      defaultBilling: "IMPRESSIONS",
    },
    {
      code: "FOLLOWERS",
      name: "Followers",
      description: "Grow your official X audience",
      defaultBilling: "ENGAGEMENTS",
    },
  ],
};

async function getTargetingOptions(req, res) {
  return res.json({
    success: true,
    targetingOptions: SUPPORTED_TARGETING_OPTIONS,
  });
}

module.exports = {
  getTargetingOptions,
  SUPPORTED_TARGETING_OPTIONS,
};

