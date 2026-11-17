# 𝕏 Composer — Multi-Tenant 𝕏 Ads Management SaaS Platform

A production-grade, multi-user **𝕏 (formerly Twitter) Ads Management SaaS Platform** built with **Node.js, Express 5.x, MongoDB, and Mongoose**, featuring official **X API v2** and **X Ads API v12** integrations, AES-256-GCM token encryption at rest, secure session-based authentication, and a responsive dark-mode dashboard with the original real-time mobile feed preview preserved.

---

## 📌 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Platform Capabilities](#-key-platform-capabilities)
- [Multi-Tenant User Management & Roles](#-multi-tenant-user-management--roles)
- [Invitation-Only Registration System](#-invitation-only-registration-system)
- [Multi-Account 𝕏 Connections & OAuth 2.0 PKCE](#-multi-account-%F0%9D%95%8F-connections--oauth-20-pkce)
- [Official 𝕏 API & Ads API v12 Integration](#-official-%F0%9D%95%8F-api--ads-api-v12-integration)
- [Guided 6-Step Campaign Creation Workflow](#-guided-6-step-campaign-creation-workflow)
- [Post Composer & Mobile Phone Simulator](#-post-composer--mobile-phone-simulator)
- [Security & Token Encryption](#-security--token-encryption)
- [Project Directory Structure](#-project-directory-structure)
- [Environment Configuration](#-environment-configuration)
- [Quick Start Guide](#-quick-start-guide)
- [API Route Reference](#-api-route-reference)

---

## 🚀 Architectural Overview

```
                                  +------------------------------------+
                                  |       Client Web Dashboard         |
                                  | (Vanilla JS, HTML5, CSS3, Axios)   |
                                  +-----------------+------------------+
                                                    | HTTP (Session Auth)
                                                    v
+----------------------------------------------------------------------+
|                     Express 5.x SaaS Backend                         |
|                                                                      |
|  +--------------------+  +--------------------+  +-----------------+ |
|  |  Auth & Invitation |  | Account Switcher   |  | Super Admin     | |
|  |  (Zod Validation)  |  | (Multi-Tenant)     |  | Control Center  | |
|  +--------------------+  +--------------------+  +-----------------+ |
|  +--------------------+  +--------------------+  +-----------------+ |
|  |  Guided Campaign   |  | Post Composer &    |  | Diagnostics &   | |
|  |  6-Step Wizard     |  | Live Feed Mockup   |  | Audit Logger    | |
|  +--------------------+  +--------------------+  +-----------------+ |
+------------------+------------------------------+--------------------+
                   |                              |
         AES-256-GCM Tokens                REST / OAuth 2.0 PKCE
                   |                              |
                   v                              v
       +-----------------------+     +--------------------------+
       |   MongoDB / Mongoose  |     |   Official 𝕏 APIs        |
       | (with in-memory dev   |     | - 𝕏 API v2 (Organic/Me)  |
       |  fallback engine)     |     | - 𝕏 Ads API v12 (Paid)   |
       +-----------------------+     +--------------------------+
```

---

## ✨ Key Platform Capabilities

1. **Multi-Tenant User Isolation**:
   - Workspaces isolate campaigns, ad accounts, creative drafts, and connected 𝕏 credentials by user ID.
2. **Multiple 𝕏 Accounts Per User**:
   - Single users can connect multiple independent brand, marketing, and personal 𝕏 handles (e.g. `@business_one`, `@marketing_account`) and seamlessly switch the active workspace context with a single click.
3. **Invitation-Only Security**:
   - Public registration is strictly disabled. Only Super Admins can issue cryptographically secure, time-limited, single-use invitation tokens.
4. **Preserved Composer & Phone Simulator**:
   - The original rich composer (character counter, website destination cards, media preview, AI disclosure tags) and the interactive iPhone feed simulator are 100% preserved.
5. **Guided 6-Step Campaign Wizard**:
   - Account validation &rarr; Objective & budget &rarr; Ad group bidding & placements &rarr; Targeting &rarr; Creative copy & preview &rarr; Explicit confirmation review & partial failure recovery.
6. **No Mocked Data**:
   - Direct integration with official APIs; real-time diagnostics banners explain prerequisites and permissions without faking responses.

---

## 👥 Multi-Tenant User Management & Roles

### 1. Super Admin
- Full platform control with dedicated **Admin Portal** (`/api/admin`).
- Real-time statistics: Total users, active vs. suspended, total connected accounts, ad accounts, total campaigns.
- Issue and revoke single-use invitation links with 48-hour expiration.
- Direct account creation, user suspension/reactivation, and workspace deletion.
- Real-time platform audit log explorer (tracks authentication, user management, campaigns, settings updates).
- Runtime configuration of official 𝕏 API credentials (`X_CLIENT_ID`, `X_CLIENT_SECRET`, consumer keys).

### 2. Normal User
- Personal dashboard with campaign analytics and workspace KPIs.
- Connect, sync, and disconnect multiple 𝕏 accounts.
- Switch active account context across all platform views without logging out.
- View advertising accounts with approval status, currency, and timezone.
- Create and manage campaigns via the 6-step guided wizard.
- Compose posts and drafts in the interactive composer with live mobile preview.

---

## ✉️ Invitation-Only Registration System

Public registration is disabled by default. New accounts must be initiated by an administrator:

1. **Admin Issues Invitation**:
   - Super Admin submits recipient email via `POST /api/admin/users/invite`.
   - The backend generates a cryptographically secure 32-byte hex token (`crypto.randomBytes(32)`), stores its SHA-256 hash in MongoDB (`Invitation` model), and returns an invite link:
     ```
     http://localhost:3000/register?token=<64-char-token>
     ```
2. **Token Verification**:
   - The user opens `/register?token=...`. The frontend verifies validity and expiration with `GET /api/auth/verify-invite`.
3. **Registration Acceptance**:
   - The user provides their Full Name and a strong Password.
   - The backend validates the invitation status (`status: "pending"` and `expiresAt > now`), hashes the password using `bcryptjs` (salt rounds 12), marks the invitation `accepted`, and automatically initializes an authenticated session.

---

## 🔗 Multi-Account 𝕏 Connections & OAuth 2.0 PKCE

Each user can link multiple independent 𝕏 identities using the official **OAuth 2.0 Authorization Code Flow with PKCE (RFC 7636)**:

1. **Authorization Request (`GET /api/x-accounts/connect`)**:
   - Generates a high-entropy `code_verifier` and derives the `code_challenge` (SHA-256, base64url-encoded).
   - Generates a random `state` parameter to prevent CSRF.
   - Saves `code_verifier` and `state` in the encrypted session.
   - Redirects to official 𝕏 authorization URL with scopes:
     `tweet.read tweet.write users.read offline.access ads.read ads.write`.
2. **Callback Handling (`GET /api/x-accounts/callback`)**:
   - Validates state parameter against session state.
   - Exchanges `code` and `code_verifier` at `https://api.twitter.com/2/oauth2/token` using HTTP Basic Auth.
   - Queries `https://api.twitter.com/2/users/me` for username, display name, and avatar.
   - Encrypts access and refresh tokens using **AES-256-GCM** before saving in MongoDB.
   - Automatically synchronizes associated advertiser accounts via the 𝕏 Ads API.
3. **Account Switching**:
   - Switch active workspace handle via the topbar dropdown or `POST /api/x-accounts/:id/select`.

---

## 📡 Official 𝕏 API & Ads API v12 Integration

### A. 𝕏 API v2 (Organic Operations)
- **Profile Identification**: `GET /2/users/me`
- **Post Publishing**: `POST /2/tweets`
- **Post Deletion**: `DELETE /2/tweets/:id`

### B. 𝕏 Ads API v12 (Paid Operations)
- **Base Endpoint**: `https://ads-api.twitter.com/12`
- **Advertising Accounts**: `GET /12/accounts`
- **Campaigns**: `GET /12/accounts/:id/campaigns`, `POST /12/accounts/:id/campaigns`, `PUT /12/accounts/:id/campaigns/:camp_id`
- **Line Items / Ad Groups**: `GET /12/accounts/:id/line_items`, `POST /12/accounts/:id/line_items`
- **Promoted Tweets**: `POST /12/accounts/:id/promoted_tweets`
- **Website Cards**: `POST /12/accounts/:id/cards/website`
- **Performance Analytics**: `GET /12/stats/accounts/:id` with granularity, metrics (`billed_charge_local_micro`, `impressions`, `engagements`, `url_clicks`).
- **Integration Diagnostics**:
  - Automatically assesses whether client credentials, OAuth tokens, and Ads API developer permissions are approved.
  - Highlights clear diagnostic error messages and application links (`developer.x.com`, `ads.x.com`) without faking successful responses.

---

## 🛠️ Guided 6-Step Campaign Creation Workflow

```
[1. Select Account] ──> [2. Campaign Config] ──> [3. Ad Group & Bidding]
          │
          v
[4. Audience Targeting] ──> [5. Creative Copy] ──> [6. Review & Explicit Confirmation]
```

- **Step 1: Select Account**: Validates connected 𝕏 account and selected advertiser account permissions.
- **Step 2: Campaign Configuration**: Name, objective (`WEBSITE_TRAFFIC`, `ENGAGEMENTS`, `REACH`, `VIDEO_VIEWS`, `FOLLOWERS`), daily budget (minimum \$1.00 USD), start and end dates.
- **Step 3: Ad Group Configuration**: Line item name, bidding strategy (`AUTO`, `MAX`, `TARGET`), billing events, placements (`ALL_ON_TWITTER`, `TWITTER_TIMELINE`, `TWITTER_SEARCH`).
- **Step 4: Audience Targeting**: Locations, languages, genders, age ranges, and interest categories.
- **Step 5: Creative Configuration**: Post copy (max 280 chars), destination URL, card headline, media, AI disclosure tag, promoted-only tag.
- **Step 6: Review & Explicit Confirmation**:
  - Displays full breakdown summary.
  - Requires user to explicitly check confirmation before any network requests are dispatched to 𝕏 Ads.
  - **Partial Failure Recovery**: If campaign creation succeeds on 𝕏 Ads but line-item or creative binding encounters an API error, the campaign is flagged as `PARTIALLY_CREATED` with actionable recovery instructions rather than silently failing or duplicating records.

---

## 🔒 Security & Token Encryption

- **Token Encryption at Rest**:
  - All 𝕏 OAuth 2.0 access tokens, refresh tokens, and OAuth 1.0a secrets are encrypted using **AES-256-GCM** authenticated encryption (`util/encryption.js`).
  - Stored format: `{ iv, content, tag }`.
  - Zero token exposure: All `toJSON()` serializers on Mongoose models explicitly strip encrypted and raw token attributes before sending payloads to frontend JavaScript.
- **Session Security**:
  - HTTP-only, SameSite lax cookies stored in MongoDB via `connect-mongo`.
- **Request Validation**:
  - All incoming API mutations are strictly validated via **Zod schemas** (`middleware/validation.js`).
- **Audit Logging**:
  - Security-sensitive actions (logins, account links, invitations, status modifications, campaign dispatches) are permanently recorded in the `AuditLog` collection.

---

## 📁 Project Directory Structure

```text
X-Composer/
├── app.js                         # Express 5.x server entry point
├── package.json                   # Dependencies & start scripts
├── .env                           # Environment configuration
├── .env.example                   # Environment configuration template
├── config/                        # Platform configuration
├── controller/                    # MVC Controllers
│   ├── admin.js                   # Super Admin user & platform controls
│   ├── adAccounts.js              # Advertiser account management
│   ├── analytics.js               # Performance metrics aggregation
│   ├── auth.js                    # Session auth, login, invitation handlers
│   ├── campaigns.js               # 6-step guided campaign creation
│   ├── creatives.js               # Creative library & media upload
│   ├── lineItems.js               # Ad groups & line items
│   ├── post.js                    # Post drafts & organic posting
│   ├── targeting.js               # Supported targeting options
│   └── xAccounts.js               # Multi-account OAuth 2.0 PKCE
├── middleware/                    # Express Middleware
│   ├── auth.js                    # requireAuth, requireSuperAdmin, activeAccount
│   └── validation.js              # Zod validation schemas
├── models/                        # Mongoose Data Models
│   ├── adGroup.js                 # Line items schema
│   ├── advertisingAccount.js      # Advertiser profiles schema
│   ├── auditLog.js                # Platform audit log schema
│   ├── campaign.js                # Campaigns schema
│   ├── connectedXAccount.js       # Encrypted multi-account schema
│   ├── creative.js                # Creatives & cards schema
│   ├── invitation.js              # Cryptographic invitation tokens schema
│   ├── platformSetting.js         # Dynamic platform configuration
│   └── user.js                    # Tenant users & password hashing
├── public/                        # Static Assets
│   ├── css/
│   │   ├── dashboard.css          # SaaS platform styles & modals
│   │   ├── login.css              # Dark-mode sign-in styles
│   │   └── style.css              # Preserved composer & phone preview CSS
│   ├── js/
│   │   ├── dashboard.js           # Platform UI controller & wizard logic
│   │   ├── login.js               # Sign-in client script
│   │   └── script.js              # Preserved reactive composer engine
│   └── uploads/                   # User-uploaded media assets
├── routes/                        # Express API Routers
│   ├── admin.js                   # /api/admin/*
│   ├── adAccounts.js              # /api/ad-accounts/*
│   ├── analytics.js               # /api/analytics/*
│   ├── auth.js                    # /api/auth/*
│   ├── campaigns.js               # /api/campaigns/*
│   ├── creatives.js               # /api/creatives/*
│   ├── lineItems.js               # /api/line-items/*
│   ├── post.js                    # /api/posts/*
│   ├── targeting.js               # /api/targeting/*
│   └── xAccounts.js               # /api/x-accounts/*
├── services/                      # External Services & APIs
│   ├── auditService.js            # Structured audit logger
│   ├── oauth1Helper.js            # OAuth 1.0a HMAC-SHA1 signer
│   ├── xAdsApi.js                 # Official 𝕏 Ads API v12 Client
│   └── xApiV2.js                  # Official 𝕏 API v2 Client
├── util/                          # Utilities
│   ├── database.js                # MongoDB connection + in-memory fallback
│   └── encryption.js              # AES-256-GCM encryption & decryption
└── views/                         # HTML Templates
    ├── dashboard.html             # Multi-tenant dark-mode SaaS dashboard
    ├── login.html                 # X dark-themed sign-in view
    └── register.html              # Invitation-only registration view
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB Connection
# If no local mongod instance is running, the app automatically initializes an in-memory MongoDB instance
MONGODB_URI=mongodb://127.0.0.1:27017/x-composer

# Cryptographic Keys
SESSION_SECRET=b7cb0969ae6f1591cc9ebfdada4d8eef3d54a38e48a0be0b482346717a784cf5
# 32-byte (64 hex characters) AES-256-GCM key for encrypting OAuth tokens at rest
ENCRYPTION_KEY=25eee3e84208b83603446e620ba84409a4d756d1983330feadaeff399dcb6666

# Default Super Admin Seed Credentials
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@xcomposer.local
SUPER_ADMIN_PASSWORD=AdminPass123!

# Official X API v2 Credentials (OAuth 2.0 PKCE)
# Register your App at https://developer.x.com
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=http://localhost:3000/api/x-accounts/callback

# Official X Ads API v12 Credentials (Optional OAuth 1.0a User Context)
X_ADS_CONSUMER_KEY=
X_ADS_CONSUMER_SECRET=
```

---

## 🚦 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
*Note: If local MongoDB is not running on port 27017, the server will automatically launch an embedded in-memory MongoDB instance and seed the initial Super Admin account.*

### 4. Access the Application
Open your browser at:
```
http://localhost:3000
```

### 5. Default Super Admin Login
- **Email**: `admin@xcomposer.local`
- **Password**: `AdminPass123!`

---

## 📡 API Route Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/auth/login` | Authenticate user & start session |
| `POST` | `/api/auth/logout` | Terminate session & clear cookies |
| `GET` | `/api/auth/me` | Current authenticated session identity |
| `GET` | `/api/auth/verify-invite?token=...` | Validate invitation token status |
| `POST` | `/api/auth/accept-invite` | Complete registration via invitation |

### 𝕏 Accounts (`/api/x-accounts`)
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/x-accounts/connect` | Initialize OAuth 2.0 PKCE authorization |
| `GET` | `/api/x-accounts/callback` | OAuth 2.0 PKCE callback handler |
| `GET` | `/api/x-accounts` | List connected 𝕏 accounts |
| `POST` | `/api/x-accounts/:id/select` | Switch active workspace account |
| `POST` | `/api/x-accounts/:id/sync` | Re-sync profile and ad accounts |
| `DELETE`| `/api/x-accounts/:id` | Disconnect 𝕏 account |
| `GET` | `/api/x-accounts/diagnostics` | Official API connection status check |

### Campaigns & Ads (`/api/campaigns`)
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/campaigns` | List campaigns for workspace |
| `GET` | `/api/campaigns/:id` | Get campaign details, ad groups & creatives |
| `POST` | `/api/campaigns/validate-draft` | Validate draft prior to submission |
| `POST` | `/api/campaigns/guided-create` | 6-step guided campaign creation |
| `PATCH`| `/api/campaigns/:id/status` | Pause or resume campaign on 𝕏 Ads |

### Super Admin Control (`/api/admin`)
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/admin/stats` | Platform-wide metrics & tenant counters |
| `GET` | `/api/admin/users` | List all registered platform users |
| `POST` | `/api/admin/users/invite` | Generate cryptographically secure invite link |
| `GET` | `/api/admin/invitations` | List pending & issued invitations |
| `POST` | `/api/admin/invitations/:id/revoke` | Revoke a pending invitation |
| `PATCH`| `/api/admin/users/:id/status` | Suspend or reactivate user |
| `DELETE`| `/api/admin/users/:id` | Delete user & associated data |
| `GET` | `/api/admin/audit-logs` | Query platform audit logs |
| `GET` | `/api/admin/settings` | Read platform configuration |
| `POST` | `/api/admin/settings` | Update 𝕏 API credentials at runtime |

---

## 📄 License & Author

- **Author**: Ritikesh
- **License**: [ISC](https://opensource.org/licenses/ISC)
# xAds-Composer
