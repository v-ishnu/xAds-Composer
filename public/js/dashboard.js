/**
 * 𝕏 COMPOSER SAAS PLATFORM CLIENT CONTROLLER
 */

// Application State
const appState = {
  currentUser: null,
  activeAccount: null,
  accounts: [],
  adAccounts: [],
  campaigns: [],
  activeTab: "tab-overview",
  wizard: {
    step: 1,
    data: {},
  },
};

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupAccountSwitcher();
  setupModals();
  setupComposerIntegration();

  await loadCurrentUser();
  await loadAccounts();
  await loadDiagnostics();
  await loadOverviewData();

  // Handle URL hash navigation or connection return
  handleUrlParams();
});

function showNotification(type, message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "✓" : "⚠️";

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-weight: bold; font-size: 15px;">${icon}</span>
      <span>${message}</span>
    </div>
    <button class="toast-close" title="Dismiss">✕</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 6000);
}

function handleUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const connectedHandle = urlParams.get("connected");
  const errorMsg = urlParams.get("error");

  if (connectedHandle) {
    showNotification("success", `Successfully linked @${connectedHandle}!`);
    switchTab("tab-accounts");
    loadAccounts();
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  } else if (errorMsg) {
    showNotification("error", `Authorization Failed: ${decodeURIComponent(errorMsg)}`);
    switchTab("tab-accounts");
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
}

// =========================================================
// USER & WORKSPACE SESSION
// =========================================================

async function loadCurrentUser() {
  try {
    const res = await axios.get("/api/auth/me");
    if (res.data.success) {
      appState.currentUser = res.data.user;

      // Update sidebar snippet
      document.getElementById("userNameSnippet").textContent = appState.currentUser.name;
      document.getElementById("userAvatarSnippet").textContent = appState.currentUser.name.charAt(0).toUpperCase();
      document.getElementById("userRoleBadge").textContent =
        appState.currentUser.role === "super_admin" ? "Super Admin" : "User";

      // Settings fields
      document.getElementById("settingsUserName").value = appState.currentUser.name;
      document.getElementById("settingsUserEmail").value = appState.currentUser.email;
      document.getElementById("settingsUserRole").value = appState.currentUser.role;

      // Reveal Admin Portal if super_admin
      if (appState.currentUser.role === "super_admin") {
        document.getElementById("adminNavSection").style.display = "block";
      }
    }
  } catch (err) {
    console.error("Failed to load user session:", err);
    window.location.href = "/login";
  }
}

// =========================================================
// NAVIGATION & TABS
// =========================================================

function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-item");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        await axios.post("/api/auth/logout");
        window.location.href = "/login";
      } catch (e) {
        window.location.href = "/login";
      }
    }
  });
}

function switchTab(tabId) {
  appState.activeTab = tabId;

  // Update nav buttons
  document.querySelectorAll(".nav-item").forEach((btn) => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update tab panes
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.remove("active-tab");
  });

  const activePane = document.getElementById(tabId);
  if (activePane) {
    activePane.classList.add("active-tab");
  }

  // Update topbar headline
  const headlineMap = {
    "tab-overview": "Overview",
    "tab-accounts": "Connected 𝕏 Accounts",
    "tab-ad-accounts": "Advertising Accounts",
    "tab-campaigns": "Campaign Management",
    "tab-line-items": "Ad Groups & Line Items",
    "tab-creatives": "Creatives Gallery",
    "tab-composer": "Post & Ad Composer",
    "tab-analytics": "Campaign Analytics",
    "tab-drafts": "Saved Drafts",
    "tab-settings": "Platform Settings",
    "tab-admin": "Super Admin Control Center",
  };
  document.getElementById("pageHeadline").textContent = headlineMap[tabId] || "Dashboard";

  // Tab specific data loads
  if (tabId === "tab-accounts") loadAccounts();
  if (tabId === "tab-ad-accounts") loadAdAccounts();
  if (tabId === "tab-campaigns") loadCampaigns();
  if (tabId === "tab-line-items") loadLineItems();
  if (tabId === "tab-creatives") loadCreatives();
  if (tabId === "tab-analytics") loadAnalytics();
  if (tabId === "tab-drafts") loadDrafts();
  if (tabId === "tab-admin") loadAdminData();
}

// =========================================================
// 𝕏 ACCOUNTS MANAGEMENT & SWITCHER
// =========================================================

function setupAccountSwitcher() {
  const btn = document.getElementById("accountSwitcherBtn");
  const menu = document.getElementById("accountDropdownMenu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("show");
  });

  document.getElementById("connectNewAccountFromTop").addEventListener("click", startConnectOAuth);
  document.getElementById("addXAccountBtn").addEventListener("click", startConnectOAuth);
}

let isConnectingOAuth = false;

async function startConnectOAuth() {
  if (isConnectingOAuth) return;
  isConnectingOAuth = true;

  const buttons = [
    document.getElementById("addXAccountBtn"),
    document.getElementById("connectNewAccountFromTop"),
  ].filter(Boolean);

  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.dataset.prevHtml = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear;">⟳</span> Connecting to 𝕏...`;
  });

  try {
    const res = await axios.get("/api/x-accounts/connect");
    if (res.data.success && res.data.authUrl) {
      // Cleanly redirect browser to official X OAuth authorization URL
      window.location.href = res.data.authUrl;
    } else {
      throw new Error(res.data.error || "No authorization URL returned by server");
    }
  } catch (err) {
    console.error("OAuth start error:", err);
    const msg =
      err.response?.data?.error ||
      err.message ||
      "Failed to start X authorization. Verify credentials in Admin Settings.";
    showNotification("error", msg);

    buttons.forEach((btn) => {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.prevHtml || "Connect 𝕏 Account";
    });
    isConnectingOAuth = false;
  }
}

async function loadAccounts() {
  try {
    const res = await axios.get("/api/x-accounts");
    if (res.data.success) {
      appState.accounts = res.data.accounts;

      // Determine active account
      appState.activeAccount =
        appState.accounts.find((a) => a.isActive) || appState.accounts[0] || null;

      renderAccountSwitcher();
      renderAccountsGrid();
      updateComposerAccountContext();
    }
  } catch (err) {
    console.error("Failed to load connected accounts:", err);
  }
}

function renderAccountSwitcher() {
  const handleEl = document.getElementById("activeAccountHandle");
  const avatarEl = document.getElementById("activeAccountAvatar");
  const listEl = document.getElementById("accountDropdownList");

  if (appState.activeAccount) {
    handleEl.textContent = `@${appState.activeAccount.username}`;
    if (appState.activeAccount.profileImage) {
      avatarEl.src = appState.activeAccount.profileImage;
    }
  } else {
    handleEl.textContent = "Connect Account";
    avatarEl.src = "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png";
  }

  listEl.innerHTML = "";
  if (appState.accounts.length === 0) {
    listEl.innerHTML = `<div style="padding: 10px 16px; font-size: 12px; color: var(--text-secondary);">No accounts connected</div>`;
    return;
  }

  appState.accounts.forEach((acc) => {
    const item = document.createElement("div");
    item.className = `account-dropdown-item ${acc.isActive ? "active-item" : ""}`;
    item.innerHTML = `
      <img src="${acc.profileImage || "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"}" class="account-pill-avatar" alt="">
      <div>
        <div style="font-size: 13px; font-weight: 700;">@${acc.username}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${acc.displayName || ""}</div>
      </div>
      ${acc.isActive ? '<span class="check">✓</span>' : ""}
    `;
    item.addEventListener("click", () => selectAccount(acc._id));
    listEl.appendChild(item);
  });
}

async function selectAccount(accountId) {
  try {
    await axios.post(`/api/x-accounts/${accountId}/select`);
    await loadAccounts();
    await loadDiagnostics();
    await loadOverviewData();
  } catch (err) {
    alert("Failed to switch account");
  }
}

function renderAccountsGrid() {
  const grid = document.getElementById("accountsGrid");
  grid.innerHTML = "";

  if (appState.accounts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-box content-card" style="grid-column: 1 / -1;">
        <span class="empty-icon">𝕏</span>
        <h3 class="empty-title">No 𝕏 Accounts Connected</h3>
        <p class="empty-subtitle">Connect your official X accounts to begin creating campaigns, publishing posts, and managing ads.</p>
        <button class="btn btn-accent" onclick="startConnectOAuth()" style="margin-top: 10px;">＋ Connect Your First Account</button>
      </div>
    `;
    return;
  }

  appState.accounts.forEach((acc) => {
    const card = document.createElement("div");
    card.className = `account-card ${acc.isActive ? "is-active-workspace" : ""}`;

    const lastSync = acc.lastSyncedAt ? new Date(acc.lastSyncedAt).toLocaleString() : "Never";

    card.innerHTML = `
      <div class="account-card-header">
        <img src="${acc.profileImage || "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"}" class="account-card-avatar" alt="">
        <div class="account-card-meta">
          <div class="account-card-name">
            ${acc.displayName || acc.username}
            ${acc.isActive ? '<span class="badge-status active" style="margin-left: 6px;">Active</span>' : ""}
          </div>
          <div class="account-card-handle">@${acc.username}</div>
        </div>
      </div>

      <div class="account-card-details">
        <div class="detail-row">
          <span>Status</span>
          <span class="badge-status ${acc.connectionStatus}">${acc.connectionStatus}</span>
        </div>
        <div class="detail-row">
          <span>Ad Accounts</span>
          <span>${acc.associatedAdAccountsCount} associated</span>
        </div>
        <div class="detail-row">
          <span>Last Sync</span>
          <span>${lastSync}</span>
        </div>
      </div>

      <div class="account-card-actions">
        ${
          !acc.isActive
            ? `<button class="btn btn-sm btn-outline" onclick="selectAccount('${acc._id}')">Make Active</button>`
            : ""
        }
        <button class="btn btn-sm btn-outline" onclick="syncAccount('${acc._id}')" title="Synchronize profile & ad accounts">↻ Sync</button>
        <button class="btn btn-sm btn-outline" onclick="startConnectOAuth()" title="Reconnect / Refresh authorization">⚡ Reconnect</button>
        <button class="btn btn-sm btn-danger-outline" onclick="disconnectAccount('${acc._id}', '${acc.username}')">Disconnect</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

async function syncAccount(id) {
  try {
    const res = await axios.post(`/api/x-accounts/${id}/sync`);
    showNotification("success", res.data.message || "Account synchronized successfully!");
    await loadAccounts();
  } catch (err) {
    showNotification("error", err.response?.data?.error || "Sync failed");
  }
}

async function disconnectAccount(id, username) {
  if (confirm(`Are you sure you want to disconnect @${username}? Associated ad accounts will be unlinked.`)) {
    try {
      const res = await axios.delete(`/api/x-accounts/${id}`);
      showNotification("success", res.data.message || `Disconnected @${username}`);
      await loadAccounts();
    } catch (err) {
      showNotification("error", "Failed to disconnect account");
    }
  }
}

function updateComposerAccountContext() {
  if (!appState.activeAccount) return;

  const composerAvatar = document.getElementById("composerProfileImg");
  const composerDisplayName = document.getElementById("composerDisplayName");
  const composerUsername = document.getElementById("composerUsername");

  const previewAvatar = document.getElementById("previewAvatarImg");
  const previewDisplayName = document.getElementById("previewDisplayName");
  const previewHandle = document.getElementById("previewHandle");

  const imgUrl = appState.activeAccount.profileImage || "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png";

  if (composerAvatar) composerAvatar.src = imgUrl;
  if (composerDisplayName) composerDisplayName.textContent = appState.activeAccount.displayName || appState.activeAccount.username;
  if (composerUsername) composerUsername.textContent = `@${appState.activeAccount.username}`;

  if (previewAvatar) previewAvatar.src = imgUrl;
  if (previewDisplayName) previewDisplayName.textContent = appState.activeAccount.displayName || appState.activeAccount.username;
  if (previewHandle) previewHandle.textContent = `@${appState.activeAccount.username}`;
}

// =========================================================
// DIAGNOSTICS & OVERVIEW
// =========================================================

async function loadDiagnostics() {
  const container = document.getElementById("overviewDiagnosticsContainer");
  container.innerHTML = "";

  try {
    const res = await axios.get("/api/x-accounts/diagnostics");
    const d = res.data.diagnostics;

    if (!d.hasAppCredentials) {
      container.innerHTML = `
        <div class="diagnostic-banner error">
          <span class="diagnostic-icon">⚠️</span>
          <div class="diagnostic-content">
            <div class="diagnostic-title">Official X API Credentials Required</div>
            <div class="diagnostic-msg">
              Platform X App credentials are not yet configured. Please go to the <strong>Admin Portal > Platform X API Credentials</strong> to save your Client ID and Client Secret from developer.x.com.
            </div>
          </div>
        </div>
      `;
    } else if (!d.accountConnected) {
      container.innerHTML = `
        <div class="diagnostic-banner warning">
          <span class="diagnostic-icon">ℹ️</span>
          <div class="diagnostic-content">
            <div class="diagnostic-title">Connect an 𝕏 Account</div>
            <div class="diagnostic-msg">
              Connect your X account to begin creating live campaigns, publishing organic posts, and tracking analytics.
            </div>
          </div>
        </div>
      `;
    } else if (d.error) {
      container.innerHTML = `
        <div class="diagnostic-banner warning">
          <span class="diagnostic-icon">⚡</span>
          <div class="diagnostic-content">
            <div class="diagnostic-title">X Ads API Integration Status: ${d.error}</div>
            <div class="diagnostic-msg">${d.actionableGuidance || "Please verify your X Ads privileges."}</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.warn("Diagnostics check skipped:", err);
  }
}

async function loadOverviewData() {
  try {
    const [analyticsRes, campaignsRes] = await Promise.all([
      axios.get("/api/analytics/overview"),
      axios.get("/api/campaigns"),
    ]);

    if (analyticsRes.data.success) {
      const summary = analyticsRes.data.summary;
      document.getElementById("kpiTotalSpend").textContent = summary.totalSpend;
      document.getElementById("kpiTotalImpressions").textContent = summary.totalImpressions.toLocaleString();
      document.getElementById("kpiTotalEngagements").textContent = summary.totalEngagements.toLocaleString();
      document.getElementById("kpiTotalClicks").textContent = summary.totalClicks.toLocaleString();
    }

    if (campaignsRes.data.success) {
      const tbody = document.getElementById("overviewCampaignsTbody");
      const camps = campaignsRes.data.campaigns.slice(0, 5);

      if (camps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box">No campaigns created yet. Click "New Campaign" to launch your first ad.</td></tr>`;
      } else {
        tbody.innerHTML = camps
          .map(
            (c) => `
          <tr>
            <td style="font-weight: 700;">${c.name}</td>
            <td>${c.objective}</td>
            <td>$${(c.dailyBudgetAmountLocalMicro / 1000000).toFixed(2)}</td>
            <td><span class="badge-status ${c.status.toLowerCase()}">${c.status}</span></td>
            <td><span class="badge-status active">LIVE SYNC</span></td>
          </tr>
        `
          )
          .join("");
      }
    }
  } catch (err) {
    console.error("Overview data load error:", err);
  }
}

// =========================================================
// AD ACCOUNTS
// =========================================================

async function loadAdAccounts() {
  const tbody = document.getElementById("adAccountsTbody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box">Loading advertising accounts...</td></tr>`;

  try {
    const res = await axios.get("/api/ad-accounts");
    const accounts = res.data.adAccounts;

    if (accounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-box">
            <span class="empty-icon">💼</span>
            <div class="empty-title">No Advertising Accounts Found</div>
            <div class="empty-subtitle">Click "Refresh from X Ads" to query official advertiser accounts, or ensure your developer app has approved Ads API privileges.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = accounts
      .map(
        (a) => `
      <tr>
        <td style="font-weight: 700;">${a.accountName}</td>
        <td><code>${a.xAdsAccountId}</code></td>
        <td>@${a.connectedXAccountId?.username || "unlinked"}</td>
        <td>${a.currency}</td>
        <td>${a.timezone}</td>
        <td><span class="badge-status ${a.approvalStatus.toLowerCase()}">${a.approvalStatus}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="selectAdAccount('${a._id}')">Select Active</button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box" style="color: var(--status-danger);">Failed to load advertising accounts</td></tr>`;
  }
}

async function selectAdAccount(id) {
  try {
    await axios.post(`/api/ad-accounts/${id}/select`);
    alert("Active advertising account updated!");
    loadAdAccounts();
  } catch (err) {
    alert("Failed to select advertising account");
  }
}

document.getElementById("refreshAdAccountsBtn").addEventListener("click", async () => {
  try {
    const res = await axios.post("/api/ad-accounts/refresh");
    alert(res.data.message || "Advertising accounts refreshed!");
    loadAdAccounts();
  } catch (err) {
    alert(err.response?.data?.error || "Refresh failed");
  }
});

// =========================================================
// CAMPAIGNS
// =========================================================

async function loadCampaigns() {
  const tbody = document.getElementById("campaignsTbody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box">Loading campaigns...</td></tr>`;

  try {
    const res = await axios.get("/api/campaigns");
    const campaigns = res.data.campaigns;

    if (campaigns.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-box">
            <span class="empty-icon">🚀</span>
            <div class="empty-title">No Campaigns Found</div>
            <div class="empty-subtitle">Create your first ad campaign with our guided 6-step wizard.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = campaigns
      .map((c) => {
        const isPaused = c.status === "PAUSED";
        const toggleAction = isPaused ? "ACTIVE" : "PAUSED";
        const toggleLabel = isPaused ? "Resume" : "Pause";

        return `
        <tr>
          <td style="font-weight: 700;">${c.name}</td>
          <td>${c.objective}</td>
          <td>$${(c.dailyBudgetAmountLocalMicro / 1000000).toFixed(2)}</td>
          <td><span class="badge-status ${c.status.toLowerCase()}">${c.status}</span></td>
          <td>${new Date(c.startTime).toLocaleDateString()}</td>
          <td><code>${c.externalCampaignId || "Pending / Local"}</code></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="toggleCampaignStatus('${c._id}', '${toggleAction}')">${toggleLabel}</button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box" style="color: var(--status-danger);">Failed to load campaigns</td></tr>`;
  }
}

async function toggleCampaignStatus(id, newStatus) {
  try {
    await axios.patch(`/api/campaigns/${id}/status`, { status: newStatus });
    loadCampaigns();
  } catch (err) {
    alert(err.response?.data?.error || "Failed to update campaign status");
  }
}

// =========================================================
// AD GROUPS (LINE ITEMS)
// =========================================================

async function loadLineItems() {
  const tbody = document.getElementById("lineItemsTbody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box">Loading line items...</td></tr>`;

  try {
    const res = await axios.get("/api/line-items");
    const items = res.data.lineItems;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box">No ad groups configured yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (i) => `
      <tr>
        <td style="font-weight: 700;">${i.name}</td>
        <td>${i.campaignId?.name || "Unassigned"}</td>
        <td>$${(i.bidAmountLocalMicro / 1000000).toFixed(2)}</td>
        <td>${i.bidStrategy}</td>
        <td>${i.billingEvent}</td>
        <td>${i.placements?.join(", ") || "All"}</td>
        <td><span class="badge-status ${i.status.toLowerCase()}">${i.status}</span></td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-box" style="color: var(--status-danger);">Failed to load ad groups</td></tr>`;
  }
}

// =========================================================
// CREATIVES
// =========================================================

async function loadCreatives() {
  const tbody = document.getElementById("creativesTbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">Loading creatives...</td></tr>`;

  try {
    const res = await axios.get("/api/creatives");
    const creatives = res.data.creatives;

    if (creatives.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">No creatives published yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = creatives
      .map(
        (c) => `
      <tr>
        <td style="font-weight: 700;">${c.name}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.text}</td>
        <td>${c.destinationUrl ? `<a href="${c.destinationUrl}" target="_blank" style="color: var(--accent-blue);">${c.headline || c.destinationUrl}</a>` : "None"}</td>
        <td>${c.mediaUrl ? `<img src="${c.mediaUrl}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;">` : "Text Only"}</td>
        <td>
          ${c.promotedOnly ? '<span class="badge-status" style="font-size: 10px;">Promoted</span>' : ""}
          ${c.madeWithAI ? '<span class="badge-status" style="font-size: 10px; background: rgba(147, 51, 234, 0.2); color: #c084fc;">AI</span>' : ""}
        </td>
        <td><span class="badge-status ${c.status.toLowerCase()}">${c.status}</span></td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box" style="color: var(--status-danger);">Failed to load creatives</td></tr>`;
  }
}

// =========================================================
// ANALYTICS
// =========================================================

async function loadAnalytics() {
  const tbody = document.getElementById("analyticsTbody");
  const notice = document.getElementById("analyticsStatusNotice");
  tbody.innerHTML = `<tr><td colspan="8" class="empty-state-box">Querying official X Ads metrics...</td></tr>`;
  notice.innerHTML = "";

  try {
    const res = await axios.get("/api/analytics/overview");
    const data = res.data;

    if (data.dataStatus === "EMPTY_STATE" || data.dataStatus === "NO_ACTIVE_PUBLISHED_CAMPAIGNS") {
      notice.innerHTML = `
        <div class="diagnostic-banner warning" style="margin-bottom: 20px;">
          <span class="diagnostic-icon">ℹ️</span>
          <div class="diagnostic-content">
            <div class="diagnostic-title">Analytics Notice</div>
            <div class="diagnostic-msg">${data.message}</div>
          </div>
        </div>
      `;
    }

    if (!data.campaignMetrics || data.campaignMetrics.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state-box">No campaigns active for analytics compilation.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.campaignMetrics
      .map(
        (m) => `
      <tr>
        <td style="font-weight: 700;">${m.name}</td>
        <td>${m.spend}</td>
        <td>${m.impressions.toLocaleString()}</td>
        <td>${m.engagements ? m.engagements.toLocaleString() : "0"}</td>
        <td>${m.clicks.toLocaleString()}</td>
        <td>${m.ctr || "0.00%"}</td>
        <td><span class="badge-status ${m.status.toLowerCase()}">${m.status}</span></td>
        <td><span class="badge-status ${m.freshness === "FINALIZED" ? "finalized" : "pending"}">${m.freshness}</span></td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state-box" style="color: var(--status-danger);">Failed to query performance analytics</td></tr>`;
  }
}

document.getElementById("refreshAnalyticsBtn").addEventListener("click", loadAnalytics);

// =========================================================
// DRAFTS
// =========================================================

async function loadDrafts() {
  const tbody = document.getElementById("draftsTbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">Loading drafts...</td></tr>`;

  try {
    const res = await axios.get("/api/posts/drafts");
    const drafts = res.data.drafts;

    if (drafts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">No saved drafts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = drafts
      .map(
        (d) => `
      <tr>
        <td style="font-weight: 700;">${d.name}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.text}</td>
        <td>${d.destinationUrl || "None"}</td>
        <td>@${d.connectedXAccountId?.username || "current"}</td>
        <td>${new Date(d.updatedAt).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="loadDraftIntoComposer('${d.text.replace(/'/g, "\\'")}', '${(d.destinationUrl || "").replace(/'/g, "\\'")}', '${(d.headline || "").replace(/'/g, "\\'")}')">Edit in Composer</button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box" style="color: var(--status-danger);">Failed to load drafts</td></tr>`;
  }
}

function loadDraftIntoComposer(text, url, headline) {
  switchTab("tab-composer");
  document.getElementById("postText").value = text;
  document.getElementById("websiteUrl").value = url;
  document.getElementById("headline").value = headline;

  // Trigger input events to update counters and preview
  document.getElementById("postText").dispatchEvent(new Event("input"));
  document.getElementById("websiteUrl").dispatchEvent(new Event("input"));
  document.getElementById("headline").dispatchEvent(new Event("input"));
}

// =========================================================
// COMPOSER INTEGRATION
// =========================================================

function setupComposerIntegration() {
  const postBtn = document.getElementById("postButton");
  const saveDraftBtn = document.getElementById("saveDraftBtn");

  // Save Draft Handler
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", async () => {
      const name = document.getElementById("creativeName").value.trim();
      const text = document.getElementById("postText").value.trim();
      const url = document.getElementById("websiteUrl").value.trim();
      const headline = document.getElementById("headline").value.trim();
      const madeWithAI = document.getElementById("madeWithAI").checked;
      const promotedOnly = document.getElementById("promotedOnly").checked;

      if (!text) {
        alert("Please enter post text before saving a draft.");
        return;
      }

      try {
        await axios.post("/api/posts/drafts", {
          name,
          text,
          destinationUrl: url,
          headline,
          madeWithAI,
          promotedOnly,
        });
        alert("Draft saved successfully!");
      } catch (err) {
        alert(err.response?.data?.error || "Failed to save draft");
      }
    });
  }

  // Publish Post to X Handler
  if (postBtn) {
    postBtn.addEventListener("click", async () => {
      const text = document.getElementById("postText").value.trim();
      if (!text) {
        alert("Please enter post text before publishing.");
        return;
      }

      if (!appState.activeAccount) {
        alert("Please connect an X account before publishing.");
        return;
      }

      if (confirm(`Publish this post directly to @${appState.activeAccount.username} via official X API v2?`)) {
        postBtn.disabled = true;
        postBtn.textContent = "Publishing...";

        try {
          const res = await axios.post("/api/posts/publish", { text });
          alert(`Post successfully published to X! Post ID: ${res.data.tweet?.id}`);
          document.getElementById("postText").value = "";
          document.getElementById("postText").dispatchEvent(new Event("input"));
        } catch (err) {
          alert(`Publish Failed: ${err.response?.data?.error || err.message}`);
        } finally {
          postBtn.disabled = false;
          postBtn.textContent = "Post to 𝕏";
        }
      }
    });
  }
}

// =========================================================
// 6-STEP GUIDED CAMPAIGN CREATION WIZARD
// =========================================================

function openCampaignWizard() {
  appState.wizard.step = 1;
  populateWizardAccountSelects();

  // Pre-fill dates
  const now = new Date();
  document.getElementById("wizardStartDate").value = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  showWizardStep(1);
  document.getElementById("campaignWizardModal").classList.add("show");
}

function closeCampaignWizard() {
  document.getElementById("campaignWizardModal").classList.remove("show");
}

document.getElementById("launchCampaignWizardBtn").addEventListener("click", openCampaignWizard);

function populateWizardAccountSelects() {
  const xSelect = document.getElementById("wizardSelectXAccount");
  const adSelect = document.getElementById("wizardSelectAdAccount");

  xSelect.innerHTML = appState.accounts
    .map((a) => `<option value="${a._id}">@${a.username} (${a.displayName || "Personal"})</option>`)
    .join("");

  // Load associated ad accounts
  loadWizardAdAccounts();
  xSelect.addEventListener("change", loadWizardAdAccounts);
}

async function loadWizardAdAccounts() {
  const xAccountId = document.getElementById("wizardSelectXAccount").value;
  const adSelect = document.getElementById("wizardSelectAdAccount");

  try {
    const res = await axios.get(`/api/ad-accounts?connectedXAccountId=${xAccountId}`);
    const accounts = res.data.adAccounts;

    if (accounts.length === 0) {
      adSelect.innerHTML = `<option value="">No Ad Account Found (Click Refresh to Sync)</option>`;
    } else {
      adSelect.innerHTML = accounts
        .map((a) => `<option value="${a._id}">${a.accountName} (${a.xAdsAccountId})</option>`)
        .join("");
    }
  } catch (err) {
    adSelect.innerHTML = `<option value="">Error loading ad accounts</option>`;
  }
}

function showWizardStep(step) {
  appState.wizard.step = step;

  // Update step indicators
  for (let i = 1; i <= 6; i++) {
    const node = document.getElementById(`wizardNode${i}`);
    const content = document.getElementById(`wizardStep${i}`);

    if (node) {
      node.classList.remove("active", "done");
      if (i === step) node.classList.add("active");
      if (i < step) node.classList.add("done");
    }

    if (content) {
      content.style.display = i === step ? "block" : "none";
    }
  }

  // Footer buttons
  const backBtn = document.getElementById("wizardBackBtn");
  const nextBtn = document.getElementById("wizardNextBtn");

  backBtn.disabled = step === 1;

  if (step === 6) {
    nextBtn.textContent = "Confirm & Publish to 𝕏 Ads";
    populateWizardSummary();
  } else {
    nextBtn.textContent = "Next Step →";
  }
}

function wizardPrevStep() {
  if (appState.wizard.step > 1) {
    showWizardStep(appState.wizard.step - 1);
  }
}

async function wizardNextStep() {
  const step = appState.wizard.step;

  // Step 1 Validation
  if (step === 1) {
    const adAccountId = document.getElementById("wizardSelectAdAccount").value;
    if (!adAccountId) {
      alert("Please select a valid Advertising Account to proceed.");
      return;
    }
    showWizardStep(2);
    return;
  }

  // Step 2 Validation
  if (step === 2) {
    const name = document.getElementById("wizardCampaignName").value.trim();
    const budget = parseFloat(document.getElementById("wizardDailyBudget").value);

    if (!name) {
      alert("Campaign Name is required.");
      return;
    }
    if (isNaN(budget) || budget < 1) {
      alert("Daily budget must be at least $1.00 USD.");
      return;
    }
    showWizardStep(3);
    return;
  }

  // Step 3 Validation
  if (step === 3) {
    const lineItemName = document.getElementById("wizardAdGroupName").value.trim();
    if (!lineItemName) {
      document.getElementById("wizardAdGroupName").value = `${document.getElementById("wizardCampaignName").value} - Ad Group 1`;
    }
    showWizardStep(4);
    return;
  }

  // Step 4 Validation
  if (step === 4) {
    showWizardStep(5);
    return;
  }

  // Step 5 Validation
  if (step === 5) {
    const text = document.getElementById("wizardCreativeText").value.trim();
    if (!text) {
      alert("Creative post text is required.");
      return;
    }
    showWizardStep(6);
    return;
  }

  // Step 6: Confirmation & Dispatch
  if (step === 6) {
    await submitGuidedCampaign();
  }
}

function populateWizardSummary() {
  const card = document.getElementById("wizardSummaryCard");
  const campName = document.getElementById("wizardCampaignName").value;
  const objective = document.getElementById("wizardCampaignObjective").value;
  const dailyBudget = document.getElementById("wizardDailyBudget").value;
  const lineItem = document.getElementById("wizardAdGroupName").value;
  const targetLoc = document.getElementById("wizardTargetLocation").value;
  const postText = document.getElementById("wizardCreativeText").value;

  card.innerHTML = `
    <div style="font-size: 15px; font-weight: 700; color: #fff;">${campName}</div>
    <div class="detail-row"><span>Objective</span><span>${objective}</span></div>
    <div class="detail-row"><span>Daily Budget</span><span>$${parseFloat(dailyBudget).toFixed(2)} USD</span></div>
    <div class="detail-row"><span>Ad Group</span><span>${lineItem}</span></div>
    <div class="detail-row"><span>Targeting</span><span>Location: ${targetLoc}</span></div>
    <div style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
      <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Creative Copy</span>
      <div style="font-size: 13px; margin-top: 4px; color: var(--text-primary); font-style: italic;">"${postText}"</div>
    </div>
  `;
}

async function submitGuidedCampaign() {
  const confirmed = document.getElementById("wizardExplicitConfirmation").checked;
  const errorBox = document.getElementById("wizardErrorMessage");
  const nextBtn = document.getElementById("wizardNextBtn");

  errorBox.style.display = "none";

  if (!confirmed) {
    alert("You must check the confirmation box to authorize dispatching this campaign to X Ads.");
    return;
  }

  nextBtn.disabled = true;
  nextBtn.textContent = "Publishing to X Ads...";

  const payload = {
    confirmationRequired: true,
    confirmedByUser: true,
    campaign: {
      name: document.getElementById("wizardCampaignName").value.trim(),
      objective: document.getElementById("wizardCampaignObjective").value,
      dailyBudgetAmountLocalMicro: Math.round(parseFloat(document.getElementById("wizardDailyBudget").value) * 1000000),
      totalBudgetAmountLocalMicro: document.getElementById("wizardTotalBudget").value
        ? Math.round(parseFloat(document.getElementById("wizardTotalBudget").value) * 1000000)
        : null,
      startTime: document.getElementById("wizardStartDate").value,
      endTime: document.getElementById("wizardEndDate").value || null,
      connectedXAccountId: document.getElementById("wizardSelectXAccount").value,
      advertisingAccountId: document.getElementById("wizardSelectAdAccount").value,
    },
    lineItem: {
      name: document.getElementById("wizardAdGroupName").value.trim(),
      bidStrategy: document.getElementById("wizardBidStrategy").value,
      bidAmountLocalMicro: Math.round(parseFloat(document.getElementById("wizardBidAmount").value) * 1000000),
      placements: [document.getElementById("wizardPlacements").value],
      targeting: {
        locations: [document.getElementById("wizardTargetLocation").value],
        languages: [document.getElementById("wizardTargetLanguage").value],
        genders: [document.getElementById("wizardTargetGender").value],
        ageBuckets: [document.getElementById("wizardTargetAge").value],
        interests: [document.getElementById("wizardTargetInterest").value],
      },
    },
    creative: {
      text: document.getElementById("wizardCreativeText").value.trim(),
      destinationUrl: document.getElementById("wizardCreativeUrl").value.trim(),
      headline: document.getElementById("wizardCreativeHeadline").value.trim(),
      promotedOnly: document.getElementById("wizardCreativePromotedOnly").checked,
      madeWithAI: document.getElementById("wizardCreativeMadeWithAI").checked,
    },
  };

  try {
    const res = await axios.post("/api/campaigns/guided-create", payload);
    alert("Campaign successfully dispatched and published to X Ads!");
    closeCampaignWizard();
    switchTab("tab-campaigns");
  } catch (err) {
    errorBox.style.display = "block";
    errorBox.textContent =
      err.response?.data?.error || err.response?.data?.recoveryOption || "Failed to publish campaign to X Ads.";
  } finally {
    nextBtn.disabled = false;
    nextBtn.textContent = "Confirm & Publish to 𝕏 Ads";
  }
}

// =========================================================
// SUPER ADMIN PORTAL
// =========================================================

async function loadAdminData() {
  await Promise.all([loadAdminStats(), loadAdminUsers(), loadAdminInvitations(), loadAdminSettings(), loadAdminAuditLogs()]);
}

async function loadAdminStats() {
  try {
    const res = await axios.get("/api/admin/stats");
    const s = res.data.stats;
    document.getElementById("adminTotalUsers").textContent = s.totalUsers;
    document.getElementById("adminActiveVsSuspended").textContent = `${s.activeUsers} active / ${s.suspendedUsers} suspended`;
    document.getElementById("adminTotalConnectedX").textContent = s.totalConnectedAccounts;
    document.getElementById("adminTotalAdAccounts").textContent = s.totalAdAccounts;
    document.getElementById("adminTotalCampaigns").textContent = s.totalCampaigns;
  } catch (err) {
    console.warn("Failed to load admin stats");
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById("adminUsersTbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">Loading users...</td></tr>`;

  try {
    const res = await axios.get("/api/admin/users");
    const users = res.data.users;

    tbody.innerHTML = users
      .map((u) => {
        const isSuspended = u.status === "suspended";
        const toggleStatus = isSuspended ? "active" : "suspended";
        const toggleLabel = isSuspended ? "Reactivate" : "Suspend";

        return `
        <tr>
          <td>
            <div style="font-weight: 700;">${u.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${u.email}</div>
          </td>
          <td><span class="user-role-badge">${u.role}</span></td>
          <td><span class="badge-status ${u.status}">${u.status}</span></td>
          <td>${u.connectedAccountsCount} connected</td>
          <td>${new Date(u.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="updateUserStatus('${u._id}', '${toggleStatus}')">${toggleLabel}</button>
            <button class="btn btn-sm btn-danger-outline" onclick="deleteUser('${u._id}', '${u.name}')">Delete</button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box" style="color: var(--status-danger);">Failed to load users</td></tr>`;
  }
}

async function updateUserStatus(userId, status) {
  try {
    await axios.patch(`/api/admin/users/${userId}/status`, { status });
    loadAdminUsers();
    loadAdminStats();
  } catch (err) {
    alert(err.response?.data?.error || "Failed to update status");
  }
}

async function deleteUser(userId, name) {
  if (confirm(`Are you sure you want to delete user ${name}? This will permanently remove all associated workspace accounts and campaigns.`)) {
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      loadAdminUsers();
      loadAdminStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user");
    }
  }
}

async function loadAdminInvitations() {
  const tbody = document.getElementById("adminInvitationsTbody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box">Loading invitations...</td></tr>`;

  try {
    const res = await axios.get("/api/admin/invitations");
    const invites = res.data.invitations;

    if (invites.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box">No invitations issued yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = invites
      .map(
        (inv) => `
      <tr>
        <td style="font-weight: 700;">${inv.email}</td>
        <td><span class="badge-status ${inv.status}">${inv.status}</span></td>
        <td>${inv.createdBy?.name || "Admin"}</td>
        <td>${new Date(inv.expiresAt).toLocaleString()}</td>
        <td>
          ${
            inv.status === "pending"
              ? `<button class="btn btn-sm btn-danger-outline" onclick="revokeInvitation('${inv._id}')">Revoke</button>`
              : `<span style="font-size: 11px; color: var(--text-muted);">-</span>`
          }
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box" style="color: var(--status-danger);">Failed to load invitations</td></tr>`;
  }
}

async function revokeInvitation(id) {
  try {
    await axios.post(`/api/admin/invitations/${id}/revoke`);
    loadAdminInvitations();
  } catch (err) {
    alert("Failed to revoke invitation");
  }
}

async function loadAdminSettings() {
  try {
    const res = await axios.get("/api/admin/settings");
    const s = res.data.settings;

    if (s.X_CLIENT_ID) document.getElementById("settingClientId").value = s.X_CLIENT_ID;
    if (s.X_REDIRECT_URI) document.getElementById("settingRedirectUri").value = s.X_REDIRECT_URI;
  } catch (err) {
    console.warn("Failed to load settings");
  }
}

document.getElementById("platformSettingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("settingsSaveStatus");
  statusEl.textContent = "Saving...";
  statusEl.style.color = "var(--text-secondary)";

  const payload = {
    X_CLIENT_ID: document.getElementById("settingClientId").value.trim(),
    X_REDIRECT_URI: document.getElementById("settingRedirectUri").value.trim(),
  };

  const secret = document.getElementById("settingClientSecret").value;
  if (secret) payload.X_CLIENT_SECRET = secret;

  const adsKey = document.getElementById("settingAdsKey").value;
  if (adsKey) payload.X_ADS_CONSUMER_KEY = adsKey;

  const adsSecret = document.getElementById("settingAdsSecret").value;
  if (adsSecret) payload.X_ADS_CONSUMER_SECRET = adsSecret;

  try {
    await axios.post("/api/admin/settings", payload);
    statusEl.textContent = "Saved successfully!";
    statusEl.style.color = "var(--status-success)";
    loadDiagnostics();
  } catch (err) {
    statusEl.textContent = "Failed to save settings.";
    statusEl.style.color = "var(--status-danger)";
  }
});

async function loadAdminAuditLogs() {
  const tbody = document.getElementById("adminAuditLogsTbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box">Loading audit logs...</td></tr>`;

  try {
    const res = await axios.get("/api/admin/audit-logs?limit=25");
    const logs = res.data.logs;

    tbody.innerHTML = logs
      .map(
        (l) => `
      <tr>
        <td style="font-size: 11px;">${new Date(l.createdAt).toLocaleString()}</td>
        <td>${l.userEmail || "System"}</td>
        <td><span class="user-role-badge" style="font-size: 9px;">${l.category}</span></td>
        <td style="font-weight: 700;">${l.action}</td>
        <td><code>${l.ipAddress || "local"}</code></td>
        <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(l.details || {})}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state-box" style="color: var(--status-danger);">Failed to load audit logs</td></tr>`;
  }
}

// =========================================================
// MODALS (INVITE & DIRECT USER)
// =========================================================

function setupModals() {
  // Invite modal
  document.getElementById("openInviteModalBtn")?.addEventListener("click", () => {
    document.getElementById("inviteRecipientEmail").value = "";
    document.getElementById("inviteResultBox").style.display = "none";
    document.getElementById("inviteUserModal").classList.add("show");
  });

  document.getElementById("sendInviteBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("inviteRecipientEmail").value.trim();
    if (!email) {
      alert("Please enter a recipient email");
      return;
    }

    try {
      const res = await axios.post("/api/admin/users/invite", { email });
      document.getElementById("generatedInviteLink").value = res.data.invitation.inviteLink;
      document.getElementById("inviteResultBox").style.display = "block";
      loadAdminInvitations();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to issue invitation");
    }
  });

  // Direct create user modal
  document.getElementById("openDirectUserModalBtn")?.addEventListener("click", () => {
    document.getElementById("directUserModal").classList.add("show");
  });

  document.getElementById("submitDirectUserBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("directUserName").value.trim();
    const email = document.getElementById("directUserEmail").value.trim();
    const password = document.getElementById("directUserPassword").value;
    const role = document.getElementById("directUserRole").value;

    if (!name || !email || !password) {
      alert("All fields are required");
      return;
    }

    try {
      await axios.post("/api/admin/users/create", { name, email, password, role });
      alert("User created successfully!");
      closeDirectUserModal();
      loadAdminUsers();
      loadAdminStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create user");
    }
  });
}

function closeInviteModal() {
  document.getElementById("inviteUserModal").classList.remove("show");
}

function closeDirectUserModal() {
  document.getElementById("directUserModal").classList.remove("show");
}

