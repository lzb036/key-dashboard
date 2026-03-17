const STORAGE_KEY = "cto_dashboard_key";
const SOURCE_STORAGE_KEY = "cto_dashboard_source";
const STATION_TWO_EMAIL_KEY = "station_two_email";
const STATION_TWO_PROXY_KEY = "station_two_proxy";
const ATLAS_USERNAME_KEY = "atlas_username";
const STATION_TWO_DEFAULT_PROXY = "http://127.0.0.1:7890";
const PAGE_LIMIT = 10;
const STATION_TWO_USAGE_PAGE_SIZE = 10;
const SOURCE_CONFIG = {
  cto: { title: "hxrra" },
  nova: { title: "YesCode" },
  atlas: { title: "998Code" }
};
const RESOURCE_LINKS = {
  official: { title: "官网地址", url: "https://cto.hxrra.com" },
  guide: { title: "用法地址", url: "https://www.notion.so/Ai-3006eac3699e800ea1b0ffbf02419c74?source=copy_link" }
};

const els = {
  sourceSwitchText: document.getElementById("sourceSwitchText"),
  balanceAmount: document.getElementById("balanceAmount"),
  totalConsumedAmount: document.getElementById("totalConsumedAmount"),
  totalRechargedAmount: document.getElementById("totalRechargedAmount"),
  viewOfficialBtn: document.getElementById("viewOfficialBtn"),
  viewGuideBtn: document.getElementById("viewGuideBtn"),
  keyInput: document.getElementById("keyInput"),
  toggleBtn: document.getElementById("toggleBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshLabel: document.querySelector("#refreshBtn .btn-label"),
  msg: document.getElementById("msg"),
  distributionBody: document.getElementById("distributionBody"),
  tableBody: document.getElementById("tableBody"),
  tablePagination: document.getElementById("tablePagination"),
  paginationMeta: document.getElementById("paginationMeta"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  stationTwoLoginShell: document.getElementById("stationTwoLoginShell"),
  stationTwoDashboardShell: document.getElementById("stationTwoDashboardShell"),
  stationTwoLoginBtn: document.getElementById("stationTwoLoginBtn"),
  stationTwoLoginLabel: document.querySelector("#stationTwoLoginBtn .btn-label"),
  stationTwoLoginMsg: document.getElementById("stationTwoLoginMsg"),
  stationTwoPackageName: document.getElementById("stationTwoPackageName"),
  stationTwoRemainingAmount: document.getElementById("stationTwoRemainingAmount"),
  stationTwoMonthlyLimitAmount: document.getElementById("stationTwoMonthlyLimitAmount"),
  stationTwoDailyUsageAmount: document.getElementById("stationTwoDailyUsageAmount"),
  stationTwoDistributionBody: document.getElementById("stationTwoDistributionBody"),
  stationTwoUsageFilter: document.getElementById("stationTwoUsageFilter"),
  stationTwoUsageTableBody: document.getElementById("stationTwoUsageTableBody"),
  stationTwoUsagePagination: document.getElementById("stationTwoUsagePagination"),
  stationTwoUsagePaginationMeta: document.getElementById("stationTwoUsagePaginationMeta"),
  stationTwoUsagePrevBtn: document.getElementById("stationTwoUsagePrevBtn"),
  stationTwoUsageNextBtn: document.getElementById("stationTwoUsageNextBtn"),
  stationTwoEmailInput: document.getElementById("stationTwoEmailInput"),
  stationTwoPasswordInput: document.getElementById("stationTwoPasswordInput"),
  stationTwoProxyInput: document.getElementById("stationTwoProxyInput"),
  stationTwoRememberToggle: document.getElementById("stationTwoRememberToggle"),
  stationTwoAutoLoginToggle: document.getElementById("stationTwoAutoLoginToggle"),
  stationTwoToggleBtn: document.getElementById("stationTwoToggleBtn"),
  stationTwoRefreshBtn: document.getElementById("stationTwoRefreshBtn"),
  stationTwoRefreshLabel: document.querySelector("#stationTwoRefreshBtn .btn-label"),
  stationTwoDashboardMsg: document.getElementById("stationTwoDashboardMsg"),
  stationTwoReloginBtn: document.getElementById("stationTwoReloginBtn"),
  stationTwoEmailReadout: document.getElementById("stationTwoEmailReadout"),
  atlasLoginShell: document.getElementById("atlasLoginShell"),
  atlasDashboardShell: document.getElementById("atlasDashboardShell"),
  atlasUsernameInput: document.getElementById("atlasUsernameInput"),
  atlasPasswordInput: document.getElementById("atlasPasswordInput"),
  atlasToggleBtn: document.getElementById("atlasToggleBtn"),
  atlasLoginBtn: document.getElementById("atlasLoginBtn"),
  atlasLoginLabel: document.querySelector("#atlasLoginBtn .btn-label"),
  atlasLoginMsg: document.getElementById("atlasLoginMsg"),
  atlasBalanceAmount: document.getElementById("atlasBalanceAmount"),
  atlasUsedAmount: document.getElementById("atlasUsedAmount"),
  atlasRequestCount: document.getElementById("atlasRequestCount"),
  atlasUsernameReadout: document.getElementById("atlasUsernameReadout"),
  atlasRefreshBtn: document.getElementById("atlasRefreshBtn"),
  atlasRefreshLabel: document.querySelector("#atlasRefreshBtn .btn-label"),
  atlasDashboardMsg: document.getElementById("atlasDashboardMsg"),
  atlasReloginBtn: document.getElementById("atlasReloginBtn"),
  atlasSubscriptionBody: document.getElementById("atlasSubscriptionBody"),
  linkModal: document.getElementById("linkModal"),
  linkModalBackdrop: document.getElementById("linkModalBackdrop"),
  linkModalTitle: document.getElementById("linkModalTitle"),
  linkModalUrl: document.getElementById("linkModalUrl"),
  linkModalCloseBtn: document.getElementById("linkModalCloseBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  copyLinkStatus: document.getElementById("copyLinkStatus"),
  srAnnounce: document.getElementById("srAnnounce"),
  sourceTabs: Array.from(document.querySelectorAll("[data-source-tab]")),
  sourceViews: Array.from(document.querySelectorAll("[data-source-view]"))
};

let hasSnapshot = false;
let isLoading = false;
let currentPage = 1;
let totalItems = 0;
let totalPages = 1;
let currentPageSize = PAGE_LIMIT;
let lastSubmittedKey = "";
let activeResourceKey = "";
let copyStatusTimer = null;
let currentSource = "cto";
let stationTwoHasSnapshot = false;
let stationTwoLoading = false;
let stationTwoUsageLoading = false;
let stationTwoSession = null;
let stationTwoView = "login";
let stationTwoAutoLoginAttempted = false;
let stationTwoUsageRecords = [];
let stationTwoUsageApiKeys = [];
let stationTwoSelectedApiKeyId = "";
let stationTwoUsagePage = 1;
let stationTwoUsageTotalItems = 0;
let stationTwoUsagePageSize = STATION_TWO_USAGE_PAGE_SIZE;
let stationTwoUsageTotalPages = 1;
let atlasHasSnapshot = false;
let atlasLoading = false;
let atlasView = "login";
let atlasSession = null;

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(value) {
  const n = numberOrNull(value);
  if (n === null) return "—";
  if (Math.abs(n) >= 1) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtCount(value) {
  const n = numberOrNull(value);
  return n === null ? "—" : n.toLocaleString("zh-CN");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d).replace(/\//g, "-");
}

function fmtUnixDate(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "—";
  return fmtDate(numericValue * 1000);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function announce(text) {
  if (!text) return;
  els.srAnnounce.textContent = "";
  requestAnimationFrame(() => {
    els.srAnnounce.textContent = text;
  });
}

function setMsg(text, tone = "") {
  els.msg.textContent = text;
  els.msg.className = "msg" + (tone ? ` ${tone}` : "");
  if (text) announce(text);
}

function setStationTwoMessage(text, tone = "") {
  [els.stationTwoLoginMsg, els.stationTwoDashboardMsg].forEach((node) => {
    node.textContent = text;
    node.className = "msg" + (tone ? ` ${tone}` : "");
  });
  if (text) announce(text);
}

function setAtlasMessage(text, tone = "") {
  [els.atlasLoginMsg, els.atlasDashboardMsg].forEach((node) => {
    node.textContent = text;
    node.className = "msg" + (tone ? ` ${tone}` : "");
  });
  if (text) announce(text);
}

function setButtonLoading(loading) {
  isLoading = Boolean(loading);
  els.refreshBtn.disabled = isLoading;
  els.refreshBtn.classList.toggle("is-loading", isLoading);
  els.refreshLabel.textContent = isLoading ? "同步中..." : "刷新数据";
  syncPagination();
}

function setStationTwoButtonLoading(loading) {
  stationTwoLoading = Boolean(loading);
  els.stationTwoLoginBtn.disabled = stationTwoLoading;
  els.stationTwoRefreshBtn.disabled = stationTwoLoading;
  els.stationTwoLoginBtn.classList.toggle("is-loading", stationTwoLoading && stationTwoView === "login");
  els.stationTwoRefreshBtn.classList.toggle("is-loading", stationTwoLoading && stationTwoView === "dashboard");
  els.stationTwoLoginLabel.textContent = stationTwoLoading && stationTwoView === "login" ? "登录中..." : "登录";
  els.stationTwoRefreshLabel.textContent = stationTwoLoading && stationTwoView === "dashboard" ? "刷新中..." : "刷新数据";
}

function setAtlasButtonLoading(loading) {
  atlasLoading = Boolean(loading);
  els.atlasLoginBtn.disabled = atlasLoading;
  els.atlasRefreshBtn.disabled = atlasLoading;
  els.atlasLoginBtn.classList.toggle("is-loading", atlasLoading && atlasView === "login");
  els.atlasRefreshBtn.classList.toggle("is-loading", atlasLoading && atlasView === "dashboard");
  els.atlasLoginLabel.textContent = atlasLoading && atlasView === "login" ? "登录中..." : "登录";
  els.atlasRefreshLabel.textContent = atlasLoading && atlasView === "dashboard" ? "刷新中..." : "刷新数据";
}

function getStationTwoPreferencePayload({ passwordOverride } = {}) {
  const rememberPassword = els.stationTwoRememberToggle.checked;
  const autoLogin = rememberPassword && els.stationTwoAutoLoginToggle.checked;

  return {
    email: rememberPassword ? els.stationTwoEmailInput.value.trim() : "",
    password: rememberPassword ? String((passwordOverride ?? els.stationTwoPasswordInput.value) || "") : "",
    proxyUrl: els.stationTwoProxyInput.value.trim() || STATION_TWO_DEFAULT_PROXY,
    rememberPassword,
    autoLogin
  };
}

async function persistStationTwoPreferences(options = {}) {
  if (!window.api || typeof window.api.saveStationTwoPreferences !== "function") {
    return null;
  }

  return window.api.saveStationTwoPreferences(getStationTwoPreferencePayload(options));
}

function emptyStateMarkup(title, text) {
  return `<div class="empty-state"><div class="empty-orb" aria-hidden="true"></div><p class="empty-title">${esc(title)}</p><p class="empty-text">${esc(text)}</p></div>`;
}

function skeletonRowMarkup(index) {
  return `<div class="table-grid table-row" role="row" style="--delay:${index * 40}ms;animation:none;opacity:1;transform:none;"><div class="row-time skeleton" role="cell">03-15 14:20:00</div><div role="cell"><span class="row-model skeleton">gpt-5</span></div><div class="row-requests skeleton" role="cell">18</div><div class="row-cost skeleton" role="cell">$0.12</div></div>`;
}

function distributionSkeletonMarkup(index) {
  return `<article class="distribution-card" style="--delay:${index * 36}ms;animation:none;opacity:1;transform:none;"><div class="distribution-card-head"><span class="distribution-model skeleton">claude-sonnet-4-6</span></div><div class="distribution-metrics"><div class="distribution-metric"><span class="distribution-metric-label">调用次数</span><strong class="distribution-metric-value skeleton">128</strong></div><div class="distribution-metric"><span class="distribution-metric-label">花费</span><strong class="distribution-metric-value distribution-metric-value--cost skeleton">$12.60</strong></div></div></article>`;
}

function stationTwoUsageSkeletonRowMarkup(index) {
  return `<div class="table-grid table-grid--yescode table-row table-row--yescode" role="row" style="--delay:${index * 40}ms;animation:none;opacity:1;transform:none;"><div class="row-time skeleton" role="cell">03-16 22:25:31</div><div class="row-key skeleton" role="cell">codex</div><div role="cell"><span class="row-model skeleton">gpt-5.4-xhigh</span></div><div class="row-cost skeleton" role="cell">$0.04</div></div>`;
}

function renderDistributionInto(node, items, { emptyTitle, emptyText } = {}) {
  if (!node) return;
  if (!Array.isArray(items) || !items.length) {
    node.innerHTML = emptyStateMarkup(emptyTitle, emptyText);
    return;
  }
  node.innerHTML = items.map((item, index) => `
    <article class="distribution-card" style="--delay:${index * 46}ms">
      <div class="distribution-card-head"><span class="distribution-model">${esc(item.model || "—")}</span></div>
      <div class="distribution-metrics">
        <div class="distribution-metric"><span class="distribution-metric-label">调用次数</span><strong class="distribution-metric-value">${esc(fmtCount(item.requests ?? item.request_count ?? 0))}</strong></div>
        <div class="distribution-metric"><span class="distribution-metric-label">花费</span><strong class="distribution-metric-value distribution-metric-value--cost">${esc(fmtMoney(item.cost ?? item.total_cost))}</strong></div>
      </div>
    </article>
  `).join("");
}

function renderDistributionLoadingInto(node) {
  if (!node) return;
  node.innerHTML = [0, 1, 2].map(distributionSkeletonMarkup).join("");
}

function setCreditValues({ balance, totalConsumed, totalRecharged }) {
  const balanceValue = numberOrNull(balance);
  els.balanceAmount.textContent = balanceValue !== null ? fmtMoney(balanceValue) : "暂无数据";
  els.balanceAmount.className = `balance-amount${balanceValue !== null ? "" : " empty"}`;
  els.totalConsumedAmount.textContent = numberOrNull(totalConsumed) !== null ? fmtMoney(totalConsumed) : "—";
  els.totalRechargedAmount.textContent = numberOrNull(totalRecharged) !== null ? fmtMoney(totalRecharged) : "—";
}

function normalizePage(value, fallback = 1) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTotalPages(total, limit) {
  const safeTotal = Math.max(0, numberOrNull(total) ?? 0);
  const safeLimit = Math.max(1, numberOrNull(limit) ?? PAGE_LIMIT);
  return safeTotal > 0 ? Math.max(1, Math.ceil(safeTotal / safeLimit)) : 1;
}

function syncPagination() {
  const shouldShow = hasSnapshot && totalItems > 0;
  els.tablePagination.hidden = !shouldShow;
  if (!shouldShow) {
    els.paginationMeta.textContent = "";
    els.prevPageBtn.disabled = true;
    els.nextPageBtn.disabled = true;
    return;
  }
  els.paginationMeta.textContent = isLoading ? `正在加载第 ${currentPage} 页...` : `第 ${fmtCount(currentPage)} / ${fmtCount(totalPages)} 页 · 共 ${fmtCount(totalItems)} 条`;
  els.prevPageBtn.disabled = isLoading || currentPage <= 1;
  els.nextPageBtn.disabled = isLoading || currentPage >= totalPages;
}

function setCopyStatus(text = "") {
  if (copyStatusTimer) {
    clearTimeout(copyStatusTimer);
    copyStatusTimer = null;
  }
  els.copyLinkStatus.textContent = text;
  if (!text) return;
  copyStatusTimer = setTimeout(() => {
    els.copyLinkStatus.textContent = "";
    copyStatusTimer = null;
  }, 1800);
}

function setActiveSource(sourceKey, { persist = true } = {}) {
  const source = SOURCE_CONFIG[sourceKey] ? sourceKey : "cto";
  currentSource = source;
  els.sourceTabs.forEach((tab) => {
    const isActive = tab.dataset.sourceTab === source;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });
  els.sourceViews.forEach((view) => {
    const isActive = view.dataset.sourceView === source;
    view.hidden = !isActive;
    view.classList.toggle("is-active", isActive);
  });
  if (els.sourceSwitchText) {
    els.sourceSwitchText.textContent = SOURCE_CONFIG[source].title;
  }
  if (persist) {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  }
  if (!els.linkModal.hidden) closeLinkModal();
  announce(`已切换到${SOURCE_CONFIG[source].title}`);

  if (source === "nova") {
    void maybeAutoLoginStationTwo({ force: true });
  }
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  if (window.api && typeof window.api.copyText === "function") {
    const copied = await window.api.copyText(value);
    return copied !== false;
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  helper.style.pointerEvents = "none";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  helper.setSelectionRange(0, helper.value.length);
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(helper);
  }
}

function resetCopyButton() {
  els.copyLinkBtn.textContent = "复制链接";
  els.copyLinkBtn.classList.remove("is-copied");
  els.copyLinkBtn.classList.remove("is-copy-failed");
}

function closeLinkModal() {
  activeResourceKey = "";
  els.linkModal.hidden = true;
  document.body.classList.remove("modal-open");
  resetCopyButton();
  setCopyStatus("");
}

function openLinkModal(resourceKey) {
  const resource = RESOURCE_LINKS[resourceKey];
  if (!resource) return;
  activeResourceKey = resourceKey;
  els.linkModalTitle.textContent = resource.title;
  els.linkModalUrl.textContent = resource.url;
  resetCopyButton();
  els.linkModal.hidden = false;
  document.body.classList.add("modal-open");
  setCopyStatus("");
}

async function copyActiveLink() {
  const resource = RESOURCE_LINKS[activeResourceKey];
  if (!resource) return;
  try {
    const copied = await copyTextToClipboard(resource.url);
    if (!copied) throw new Error("Clipboard unavailable");
    els.copyLinkBtn.textContent = "复制成功";
    els.copyLinkBtn.classList.add("is-copied");
    setCopyStatus("链接已复制到剪贴板");
    announce(`${resource.title}已复制`);
    setTimeout(() => {
      if (!els.linkModal.hidden) resetCopyButton();
    }, 1600);
  } catch {
    els.copyLinkBtn.textContent = "复制失败";
    els.copyLinkBtn.classList.add("is-copy-failed");
    setCopyStatus("复制失败，请手动选中链接");
    announce(`${resource.title}复制失败`);
  }
}

function getRequestFailureHint(message) {
  if (/401|403|认证失败|Unauthorized|Forbidden/i.test(message)) return "认证失败，请检查 API Key 是否正确或是否仍然有效";
  if (/ECONNRESET|超时|网络连接|代理|VPN|timed out|ERR_CONNECTION/i.test(message)) return "网络请求失败，请检查当前网络、代理或 VPN 设置";
  return "请求失败，请稍后重试";
}

function renderDistribution(items) {
  renderDistributionInto(els.distributionBody, items, {
    emptyTitle: "暂无模型分布",
    emptyText: "当前时间范围内还没有模型使用统计，稍后刷新可再次获取最新数据。"
  });
}

function renderStationTwoDistribution(items) {
  renderDistributionInto(els.stationTwoDistributionBody, items, {
    emptyTitle: "暂无模型分布",
    emptyText: "同步成功后，这里会展示 YesCode 当日各模型的调用次数和花费。"
  });
}

function renderStationTwoUsageFilter(options) {
  if (!els.stationTwoUsageFilter) return;

  const resolvedOptions = Array.isArray(options) ? options : [];
  const hasSelected = resolvedOptions.some((option) => String(option.id || "") === stationTwoSelectedApiKeyId);
  if (!hasSelected) {
    stationTwoSelectedApiKeyId = "";
  }

  els.stationTwoUsageFilter.innerHTML = [
    '<option value="">全部密钥</option>',
    ...resolvedOptions.map((option) => `<option value="${esc(String(option.id || ""))}">${esc(option.name || "未命名密钥")}</option>`)
  ].join("");
  els.stationTwoUsageFilter.value = stationTwoSelectedApiKeyId;
  els.stationTwoUsageFilter.disabled = stationTwoUsageLoading || resolvedOptions.length === 0;
}

function getStationTwoUsageModelLabel(item) {
  const model = String(item?.model || "").trim() || "—";
  const reasoningEffort = String(item?.reasoningEffort || "").trim();
  if (!reasoningEffort || reasoningEffort === "—") return model;
  return `${model}-${reasoningEffort}`;
}

function syncStationTwoUsagePagination(totalItems, { forceShow = false } = {}) {
  if (!els.stationTwoUsagePagination || !els.stationTwoUsagePaginationMeta || !els.stationTwoUsagePrevBtn || !els.stationTwoUsageNextBtn) {
    return;
  }

  const total = Math.max(0, numberOrNull(totalItems) ?? 0);
  const resolvedPageSize = Math.max(1, numberOrNull(stationTwoUsagePageSize) ?? STATION_TWO_USAGE_PAGE_SIZE);
  stationTwoUsageTotalItems = total;
  stationTwoUsageTotalPages = getTotalPages(total, resolvedPageSize);
  const shouldShow = forceShow || total > 0;
  els.stationTwoUsagePagination.hidden = !shouldShow;

  if (!shouldShow) {
    els.stationTwoUsagePaginationMeta.textContent = "";
    els.stationTwoUsagePrevBtn.disabled = true;
    els.stationTwoUsageNextBtn.disabled = true;
    return;
  }

  stationTwoUsagePage = Math.min(Math.max(1, stationTwoUsagePage), stationTwoUsageTotalPages);
  els.stationTwoUsagePaginationMeta.textContent = stationTwoUsageLoading
    ? `正在加载第 ${stationTwoUsagePage} 页...`
    : `第 ${fmtCount(stationTwoUsagePage)} / ${fmtCount(stationTwoUsageTotalPages)} 页 · 共 ${fmtCount(total)} 条`;
  els.stationTwoUsagePrevBtn.disabled = stationTwoUsageLoading || stationTwoUsagePage <= 1;
  els.stationTwoUsageNextBtn.disabled = stationTwoUsageLoading || stationTwoUsagePage >= stationTwoUsageTotalPages;
}

function renderStationTwoUsageTable() {
  if (!els.stationTwoUsageTableBody) return;

  const records = Array.isArray(stationTwoUsageRecords) ? stationTwoUsageRecords : [];

  if (!stationTwoUsageTotalItems) {
    const title = stationTwoSelectedApiKeyId ? "该密钥今日暂无消费" : "暂无消费记录";
    const text = stationTwoSelectedApiKeyId
      ? "切换到其他 API Key，或选择“全部密钥”查看当天消费记录。"
      : "今天还没有可展示的 YesCode 消费记录。";
    els.stationTwoUsageTableBody.innerHTML = emptyStateMarkup(title, text);
    syncStationTwoUsagePagination(0);
    return;
  }

  if (!records.length) {
    els.stationTwoUsageTableBody.innerHTML = emptyStateMarkup("当前页暂无记录", "这页暂时没有可展示的数据，返回上一页或刷新后再试。");
    syncStationTwoUsagePagination(stationTwoUsageTotalItems, { forceShow: true });
    return;
  }

  els.stationTwoUsageTableBody.innerHTML = records.map((item, index) => `
    <div class="table-grid table-grid--yescode table-row table-row--yescode" role="row" style="--delay:${index * 42}ms">
      <div class="row-time" role="cell">${esc(fmtDate(item.createdAt))}</div>
      <div class="row-key" role="cell">${esc(item.apiKeyName || "未命名密钥")}</div>
      <div role="cell"><span class="row-model">${esc(getStationTwoUsageModelLabel(item))}</span></div>
      <div class="row-cost" role="cell">${esc(fmtMoney(item.totalCost))}</div>
    </div>
  `).join("");
  syncStationTwoUsagePagination(stationTwoUsageTotalItems, { forceShow: true });
}

function renderStationTwoUsageLoadingState({ keepPagination = false } = {}) {
  if (!els.stationTwoUsageTableBody) return;
  if (els.stationTwoUsageFilter) {
    els.stationTwoUsageFilter.disabled = true;
  }
  els.stationTwoUsageTableBody.innerHTML = [0, 1, 2, 3].map(stationTwoUsageSkeletonRowMarkup).join("");
  syncStationTwoUsagePagination(stationTwoUsageTotalItems, { forceShow: keepPagination || stationTwoUsageTotalItems > 0 });
}

function renderIdleState() {
  setCreditValues({});
  totalItems = 0;
  totalPages = 1;
  currentPage = 1;
  currentPageSize = PAGE_LIMIT;
  if (!hasSnapshot) {
    els.distributionBody.innerHTML = emptyStateMarkup("刷新后查看分布", "同步成功后，这里会按模型展示调用次数和花费，方便你快速判断主要消耗来自哪里。");
    els.tableBody.innerHTML = emptyStateMarkup("输入 API Key 后点击刷新", "这里只保留消费记录本身，刷新后会展示最近 10 条明细。");
  }
  setMsg("");
  syncPagination();
}

function renderLoadingState() {
  els.balanceAmount.textContent = "同步中...";
  els.balanceAmount.className = "balance-amount empty";
  els.totalConsumedAmount.textContent = "—";
  els.totalRechargedAmount.textContent = "—";
  renderDistributionLoadingInto(els.distributionBody);
  els.tableBody.innerHTML = [0, 1, 2, 3].map(skeletonRowMarkup).join("");
  syncPagination();
}

function renderData(data) {
  const balance = data?.balance || {};
  const consumption = data?.consumption || {};
  const items = Array.isArray(consumption.items) ? consumption.items : [];
  const modelDistribution = Array.isArray(data?.stats?.model_distribution) ? data.stats.model_distribution : [];
  const resolvedLimit = normalizePage(consumption.limit, currentPageSize);
  const resolvedTotal = Math.max(0, numberOrNull(consumption.total) ?? items.length);
  const resolvedPage = normalizePage(consumption.page, currentPage);
  setCreditValues({
    balance: balance.balance,
    totalConsumed: data?.stats?.total_cost,
    totalRecharged: balance.total_recharged
  });
  currentPageSize = resolvedLimit;
  totalItems = resolvedTotal;
  totalPages = getTotalPages(resolvedTotal, resolvedLimit);
  currentPage = Math.min(resolvedPage, totalPages);
  renderDistribution(modelDistribution);
  if (!items.length) {
    els.tableBody.innerHTML = emptyStateMarkup("暂无消费记录", "当前时间范围内没有消费明细，稍后刷新可再次获取最新数据。");
    hasSnapshot = true;
    syncPagination();
    return;
  }
  els.tableBody.innerHTML = items.map((item, index) => `
    <div class="table-grid table-row" role="row" style="--delay:${index * 46}ms">
      <div class="row-time" role="cell">${esc(fmtDate(item.created_at || item.minute_timestamp))}</div>
      <div role="cell"><span class="row-model">${esc(item.model || "—")}</span></div>
      <div class="row-requests" role="cell">${esc(fmtCount(item.request_count ?? item.requests ?? 0))}</div>
      <div class="row-cost" role="cell">${esc(fmtMoney(item.total_cost))}</div>
    </div>
  `).join("");
  hasSnapshot = true;
  syncPagination();
}

function renderErrorState(hint) {
  if (!hasSnapshot) {
    setCreditValues({});
    els.distributionBody.innerHTML = emptyStateMarkup("暂时无法获取分布", hint);
    els.tableBody.innerHTML = emptyStateMarkup("暂时无法获取数据", hint);
  }
  setMsg(hint, "error");
  syncPagination();
}

async function refresh(targetPage = currentPage) {
  const key = els.keyInput.value.trim();
  if (!key) {
    setMsg("请输入 API Key", "error");
    els.keyInput.focus();
    return;
  }
  const normalizedPage = key !== lastSubmittedKey ? 1 : Math.min(normalizePage(targetPage, currentPage), totalPages);
  const authorization = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
  localStorage.setItem(STORAGE_KEY, key);
  lastSubmittedKey = key;
  currentPage = normalizedPage;
  setButtonLoading(true);
  setMsg("");
  renderLoadingState();
  try {
    const data = await window.api.fetchDashboard(authorization, { page: currentPage, limit: currentPageSize });
    renderData(data);
    setMsg(totalPages > 1 ? `数据已更新，当前第 ${fmtCount(currentPage)} 页` : "数据已更新", "success");
  } catch (error) {
    renderErrorState(getRequestFailureHint(error?.message || ""));
  } finally {
    setButtonLoading(false);
  }
}

function syncToggleState() {
  const isVisible = els.keyInput.type === "text";
  els.toggleBtn.textContent = isVisible ? "隐藏" : "显示";
  els.toggleBtn.setAttribute("aria-pressed", String(isVisible));
  els.toggleBtn.setAttribute("aria-label", `${isVisible ? "隐藏" : "显示"} API Key`);
}

function syncStationTwoToggleState() {
  const isVisible = els.stationTwoPasswordInput.type === "text";
  els.stationTwoToggleBtn.textContent = isVisible ? "隐藏" : "显示";
  els.stationTwoToggleBtn.setAttribute("aria-pressed", String(isVisible));
  els.stationTwoToggleBtn.setAttribute("aria-label", `${isVisible ? "隐藏" : "显示"} YesCode 密码`);
}

function setStationTwoView(view) {
  const resolvedView = view === "dashboard" ? "dashboard" : "login";
  stationTwoView = resolvedView;
  els.stationTwoLoginShell.hidden = resolvedView !== "login";
  els.stationTwoDashboardShell.hidden = resolvedView !== "dashboard";
  setStationTwoButtonLoading(false);
}

function isStationTwoAuthRequired(message) {
  return /登录已失效|重新登录|AUTH_REQUIRED/i.test(String(message || ""));
}

function syncStationTwoPreferenceState() {
  if (!els.stationTwoRememberToggle.checked) {
    els.stationTwoAutoLoginToggle.checked = false;
  }

  els.stationTwoAutoLoginToggle.disabled = !els.stationTwoRememberToggle.checked;
  els.stationTwoAutoLoginToggle.closest(".station-two-option-chip")?.classList.toggle(
    "is-disabled",
    els.stationTwoAutoLoginToggle.disabled
  );
}

function syncStationTwoSessionChrome({ email } = {}) {
  const resolvedEmail = String(email || els.stationTwoEmailInput.value || "").trim();
  els.stationTwoEmailReadout.textContent = resolvedEmail || "未填写";
}

function setStationTwoSummaryValues({ title, remainingUsd, monthlyLimitUsd, dailyUsageUsd }) {
  const remainingValue = numberOrNull(remainingUsd);
  els.stationTwoPackageName.textContent = title || "等待登录";
  els.stationTwoRemainingAmount.textContent = remainingValue !== null ? fmtMoney(remainingValue) : "登录后查看";
  els.stationTwoRemainingAmount.className = `balance-amount${remainingValue !== null ? "" : " empty"}`;
  els.stationTwoMonthlyLimitAmount.textContent = numberOrNull(monthlyLimitUsd) !== null ? fmtMoney(monthlyLimitUsd) : "—";
  els.stationTwoDailyUsageAmount.textContent = numberOrNull(dailyUsageUsd) !== null ? fmtMoney(dailyUsageUsd) : "—";
}

function renderStationTwoIdleState() {
  stationTwoUsageLoading = false;
  if (!stationTwoHasSnapshot) {
    setStationTwoSummaryValues({ title: "等待登录", remainingUsd: null, monthlyLimitUsd: null, dailyUsageUsd: null });
    stationTwoUsageRecords = [];
    stationTwoUsageApiKeys = [];
    stationTwoSelectedApiKeyId = "";
    stationTwoUsagePage = 1;
    stationTwoUsageTotalItems = 0;
    stationTwoUsagePageSize = STATION_TWO_USAGE_PAGE_SIZE;
    renderStationTwoDistribution([]);
    renderStationTwoUsageFilter([]);
    renderStationTwoUsageTable();
    setStationTwoView("login");
  } else {
    setStationTwoView("dashboard");
  }
  syncStationTwoSessionChrome({
    email: els.stationTwoEmailInput.value.trim() || stationTwoSession?.email || ""
  });
  setStationTwoMessage("");
  setStationTwoButtonLoading(false);
}

function renderStationTwoLoadingState() {
  stationTwoUsageLoading = true;
  els.stationTwoPackageName.textContent = "同步中";
  els.stationTwoRemainingAmount.textContent = "同步中...";
  els.stationTwoRemainingAmount.className = "balance-amount empty";
  els.stationTwoMonthlyLimitAmount.textContent = "—";
  els.stationTwoDailyUsageAmount.textContent = "—";
  renderDistributionLoadingInto(els.stationTwoDistributionBody);
  renderStationTwoUsageLoadingState({ keepPagination: stationTwoHasSnapshot });
  syncStationTwoSessionChrome({
    email: els.stationTwoEmailInput.value.trim() || stationTwoSession?.email || ""
  });
}

function renderStationTwoUsageData(data) {
  const usagePagination = data?.usagePagination || {};
  stationTwoSession = data?.session || stationTwoSession;
  stationTwoUsageLoading = false;
  stationTwoUsageRecords = Array.isArray(data?.usageRecords) ? data.usageRecords : [];
  stationTwoUsageApiKeys = Array.isArray(data?.usageApiKeys) ? data.usageApiKeys : stationTwoUsageApiKeys;
  stationTwoUsagePageSize = Math.max(1, numberOrNull(usagePagination.pageSize) ?? STATION_TWO_USAGE_PAGE_SIZE);
  stationTwoUsageTotalItems = Math.max(0, numberOrNull(usagePagination.total) ?? stationTwoUsageRecords.length);
  stationTwoUsageTotalPages = getTotalPages(stationTwoUsageTotalItems, stationTwoUsagePageSize);
  stationTwoUsagePage = Math.min(
    normalizePage(usagePagination.page, stationTwoUsagePage),
    stationTwoUsageTotalPages
  );
  renderStationTwoUsageFilter(stationTwoUsageApiKeys);
  renderStationTwoUsageTable();
  syncStationTwoSessionChrome(stationTwoSession);
}

function renderStationTwoData(data) {
  const summary = data?.summary || {};
  stationTwoSession = data?.session || {};
  stationTwoHasSnapshot = true;
  setStationTwoSummaryValues({
    title: summary.title || "当前套餐",
    remainingUsd: summary.remainingUsd,
    monthlyLimitUsd: summary.monthlyLimitUsd,
    dailyUsageUsd: summary.dailyUsageUsd
  });
  renderStationTwoUsageData(data);
  renderStationTwoDistribution(data?.modelDistribution);
  setStationTwoView("dashboard");
}

function renderStationTwoError(message) {
  stationTwoUsageLoading = false;
  if (!stationTwoHasSnapshot) {
    setStationTwoSummaryValues({ title: "暂时无法同步", remainingUsd: null, monthlyLimitUsd: null, dailyUsageUsd: null });
    stationTwoUsageRecords = [];
    stationTwoUsageApiKeys = [];
    stationTwoSelectedApiKeyId = "";
    stationTwoUsagePage = 1;
    stationTwoUsageTotalItems = 0;
    stationTwoUsagePageSize = STATION_TWO_USAGE_PAGE_SIZE;
    renderStationTwoDistribution([]);
    renderStationTwoUsageFilter([]);
    renderStationTwoUsageTable();
  } else {
    renderStationTwoUsageFilter(stationTwoUsageApiKeys);
    renderStationTwoUsageTable();
  }
  setStationTwoMessage(message, "error");
}

function syncAtlasToggleState() {
  const isVisible = els.atlasPasswordInput.type === "text";
  els.atlasToggleBtn.textContent = isVisible ? "隐藏" : "显示";
  els.atlasToggleBtn.setAttribute("aria-pressed", String(isVisible));
  els.atlasToggleBtn.setAttribute("aria-label", `${isVisible ? "隐藏" : "显示"} 998Code 密码`);
}

function setAtlasView(view) {
  const resolvedView = view === "dashboard" ? "dashboard" : "login";
  atlasView = resolvedView;
  els.atlasLoginShell.hidden = resolvedView !== "login";
  els.atlasDashboardShell.hidden = resolvedView !== "dashboard";
  setAtlasButtonLoading(false);
}

function isAtlasAuthRequired(message) {
  return /登录已失效|重新登录|AUTH_REQUIRED/i.test(String(message || ""));
}

function syncAtlasSessionChrome({ displayName, username } = {}) {
  const resolvedName = String(displayName || username || els.atlasUsernameInput.value || "").trim();
  els.atlasUsernameReadout.textContent = resolvedName || "未填写";
}

function setAtlasSummaryValues({ balanceUsd, usedUsd, requestCount } = {}) {
  const balanceValue = numberOrNull(balanceUsd);
  els.atlasBalanceAmount.textContent = balanceValue !== null ? fmtMoney(balanceValue) : "登录后查看";
  els.atlasBalanceAmount.className = `balance-amount${balanceValue !== null ? "" : " empty"}`;
  els.atlasUsedAmount.textContent = numberOrNull(usedUsd) !== null ? fmtMoney(usedUsd) : "—";
  els.atlasRequestCount.textContent = numberOrNull(requestCount) !== null ? fmtCount(requestCount) : "—";
}

function renderAtlasSubscriptions(items) {
  if (!els.atlasSubscriptionBody) return;
  const subscriptions = Array.isArray(items) ? items : [];

  if (!subscriptions.length) {
    els.atlasSubscriptionBody.innerHTML = emptyStateMarkup("暂无生效订阅", "当前账号下还没有正在生效中的订阅套餐。");
    return;
  }

  els.atlasSubscriptionBody.innerHTML = subscriptions.map((item, index) => `
    <article class="atlas-subscription-card" style="--delay:${index * 42}ms">
      <div class="atlas-subscription-head">
        <div class="atlas-subscription-copy">
          <strong class="atlas-subscription-title">${esc(item.title || "未命名订阅")}</strong>
          <span class="atlas-subscription-subtitle">${esc(item.subtitle || item.source || "当前生效中")}</span>
        </div>
        <span class="atlas-subscription-status">${esc(item.status || "active")}</span>
      </div>

      <div class="atlas-subscription-metrics">
        <div class="atlas-subscription-metric">
          <span class="atlas-subscription-label">已用 / 总额</span>
          <strong class="atlas-subscription-value">${esc(fmtMoney(item.usedUsd))} / ${esc(fmtMoney(item.totalUsd))}</strong>
        </div>
        <div class="atlas-subscription-metric">
          <span class="atlas-subscription-label">剩余额度</span>
          <strong class="atlas-subscription-value atlas-subscription-value--accent">${esc(fmtMoney(item.remainingUsd))}</strong>
        </div>
      </div>

      <div class="atlas-subscription-meta">
        <span>开始：${esc(fmtUnixDate(item.startAt))}</span>
        <span>到期：${esc(fmtUnixDate(item.endAt))}</span>
        <span>下次重置：${esc(fmtUnixDate(item.nextResetAt))}</span>
      </div>
    </article>
  `).join("");
}

function renderAtlasIdleState() {
  if (!atlasHasSnapshot) {
    setAtlasSummaryValues({ balanceUsd: null, usedUsd: null, requestCount: null });
    renderAtlasSubscriptions([]);
    setAtlasView("login");
  } else {
    setAtlasView("dashboard");
  }
  syncAtlasSessionChrome({
    username: els.atlasUsernameInput.value.trim() || atlasSession?.username || "",
    displayName: atlasSession?.displayName || ""
  });
  setAtlasMessage("");
  setAtlasButtonLoading(false);
}

function renderAtlasLoadingState() {
  els.atlasBalanceAmount.textContent = "同步中...";
  els.atlasBalanceAmount.className = "balance-amount empty";
  els.atlasUsedAmount.textContent = "—";
  els.atlasRequestCount.textContent = "—";
  els.atlasSubscriptionBody.innerHTML = [0, 1].map((index) => `
    <article class="atlas-subscription-card" style="--delay:${index * 36}ms;animation:none;opacity:1;transform:none;">
      <div class="atlas-subscription-head">
        <div class="atlas-subscription-copy">
          <strong class="atlas-subscription-title skeleton">中杯</strong>
          <span class="atlas-subscription-subtitle skeleton">current active</span>
        </div>
        <span class="atlas-subscription-status skeleton">active</span>
      </div>
      <div class="atlas-subscription-metrics">
        <div class="atlas-subscription-metric">
          <span class="atlas-subscription-label">已用 / 总额</span>
          <strong class="atlas-subscription-value skeleton">$20.02 / $60.00</strong>
        </div>
        <div class="atlas-subscription-metric">
          <span class="atlas-subscription-label">剩余额度</span>
          <strong class="atlas-subscription-value atlas-subscription-value--accent skeleton">$39.98</strong>
        </div>
      </div>
      <div class="atlas-subscription-meta">
        <span class="skeleton">开始：03-12 20:20:20</span>
        <span class="skeleton">到期：04-12 20:20:20</span>
        <span class="skeleton">下次重置：03-18 00:00:00</span>
      </div>
    </article>
  `).join("");
  syncAtlasSessionChrome({
    username: els.atlasUsernameInput.value.trim() || atlasSession?.username || "",
    displayName: atlasSession?.displayName || ""
  });
}

function renderAtlasData(data) {
  const summary = data?.summary || {};
  atlasSession = data?.session || {};
  atlasHasSnapshot = true;
  setAtlasSummaryValues({
    balanceUsd: summary.balanceUsd,
    usedUsd: summary.usedUsd,
    requestCount: summary.requestCount
  });
  renderAtlasSubscriptions(data?.subscriptions);
  syncAtlasSessionChrome({
    username: summary.username || atlasSession?.username || "",
    displayName: summary.displayName || atlasSession?.displayName || ""
  });
  setAtlasView("dashboard");
}

function renderAtlasError(message) {
  if (!atlasHasSnapshot) {
    setAtlasSummaryValues({ balanceUsd: null, usedUsd: null, requestCount: null });
    renderAtlasSubscriptions([]);
  }
  setAtlasMessage(message, "error");
}

async function loginStationTwo() {
  const payload = {
    email: els.stationTwoEmailInput.value.trim(),
    password: els.stationTwoPasswordInput.value,
    proxyUrl: els.stationTwoProxyInput.value.trim()
  };
  if (!payload.email || !payload.password) {
    setStationTwoMessage("请输入邮箱和密码", "error");
    if (!payload.email) {
      els.stationTwoEmailInput.focus();
    } else {
      els.stationTwoPasswordInput.focus();
    }
    return;
  }
  setStationTwoView("login");
  setStationTwoButtonLoading(true);
  setStationTwoMessage("");
  try {
    const data = await window.api.fetchStationTwoDashboard({
      ...payload,
      allowLogin: true,
      usagePage: 1,
      usagePageSize: stationTwoUsagePageSize,
      usageApiKeyId: stationTwoSelectedApiKeyId
    });
    const emailToStore = String(data?.session?.email || payload.email || "").trim();
    if (emailToStore) {
      localStorage.setItem(STATION_TWO_EMAIL_KEY, emailToStore);
      if (!els.stationTwoEmailInput.value.trim()) els.stationTwoEmailInput.value = emailToStore;
    }
    localStorage.setItem(STATION_TWO_PROXY_KEY, payload.proxyUrl);
    await persistStationTwoPreferences({
      passwordOverride: payload.password
    });
    renderStationTwoData(data);
    setStationTwoMessage("登录成功，已进入 YesCode", "success");
  } catch (error) {
    renderStationTwoError(error?.message || "YesCode 同步失败，请稍后重试");
  } finally {
    setStationTwoButtonLoading(false);
  }
}

async function refreshStationTwoDashboard() {
  setStationTwoView("dashboard");
  setStationTwoButtonLoading(true);
  setStationTwoMessage("");
  renderStationTwoLoadingState();
  try {
    const data = await window.api.fetchStationTwoDashboard({
      email: els.stationTwoEmailInput.value.trim(),
      proxyUrl: els.stationTwoProxyInput.value.trim(),
      allowLogin: false,
      usagePage: stationTwoUsagePage,
      usagePageSize: stationTwoUsagePageSize,
      usageApiKeyId: stationTwoSelectedApiKeyId
    });
    renderStationTwoData(data);
    setStationTwoMessage("YesCode 数据已更新", "success");
  } catch (error) {
    const message = error?.message || "YesCode 同步失败，请稍后重试";
    if (isStationTwoAuthRequired(message)) {
      stationTwoHasSnapshot = false;
      stationTwoSession = null;
      els.stationTwoPasswordInput.value = "";
      setStationTwoView("login");
      setStationTwoMessage("登录已过期，请重新登录", "error");
      return;
    }
    renderStationTwoError(message);
  } finally {
    setStationTwoButtonLoading(false);
  }
}

async function refreshStationTwoUsagePage(targetPage = stationTwoUsagePage) {
  if (!window.api || typeof window.api.fetchStationTwoUsage !== "function") {
    return;
  }

  stationTwoUsagePage = Math.max(1, normalizePage(targetPage, stationTwoUsagePage));
  stationTwoUsageLoading = true;
  setStationTwoMessage("");
  renderStationTwoUsageFilter(stationTwoUsageApiKeys);
  renderStationTwoUsageLoadingState({ keepPagination: stationTwoHasSnapshot });

  try {
    const data = await window.api.fetchStationTwoUsage({
      email: els.stationTwoEmailInput.value.trim(),
      proxyUrl: els.stationTwoProxyInput.value.trim(),
      allowLogin: false,
      page: stationTwoUsagePage,
      pageSize: stationTwoUsagePageSize,
      apiKeyId: stationTwoSelectedApiKeyId
    });
    renderStationTwoUsageData(data);
    setStationTwoMessage(
      stationTwoUsageTotalPages > 1
        ? `消费记录已更新，当前第 ${fmtCount(stationTwoUsagePage)} 页`
        : "消费记录已更新",
      "success"
    );
  } catch (error) {
    stationTwoUsageLoading = false;
    const message = error?.message || "YesCode 消费记录同步失败，请稍后重试";
    if (isStationTwoAuthRequired(message)) {
      stationTwoHasSnapshot = false;
      stationTwoSession = null;
      els.stationTwoPasswordInput.value = "";
      setStationTwoView("login");
      setStationTwoMessage("登录已过期，请重新登录", "error");
      return;
    }
    renderStationTwoUsageFilter(stationTwoUsageApiKeys);
    renderStationTwoUsageTable();
    setStationTwoMessage(message, "error");
  }
}

async function loginAtlas() {
  const payload = {
    username: els.atlasUsernameInput.value.trim(),
    password: els.atlasPasswordInput.value
  };
  if (!payload.username || !payload.password) {
    setAtlasMessage("请输入 998Code 用户名和密码", "error");
    if (!payload.username) {
      els.atlasUsernameInput.focus();
    } else {
      els.atlasPasswordInput.focus();
    }
    return;
  }

  setAtlasView("login");
  setAtlasButtonLoading(true);
  setAtlasMessage("");
  try {
    const data = await window.api.fetchStationThreeDashboard({
      ...payload,
      allowLogin: true
    });
    localStorage.setItem(ATLAS_USERNAME_KEY, payload.username);
    renderAtlasData(data);
    setAtlasMessage("登录成功，已进入 998Code", "success");
  } catch (error) {
    renderAtlasError(error?.message || "998Code 同步失败，请稍后重试");
  } finally {
    setAtlasButtonLoading(false);
  }
}

async function refreshAtlasDashboard() {
  setAtlasView("dashboard");
  setAtlasButtonLoading(true);
  setAtlasMessage("");
  renderAtlasLoadingState();
  try {
    const data = await window.api.fetchStationThreeDashboard({
      username: els.atlasUsernameInput.value.trim(),
      password: els.atlasPasswordInput.value,
      allowLogin: Boolean(els.atlasPasswordInput.value)
    });
    renderAtlasData(data);
    setAtlasMessage("998Code 数据已更新", "success");
  } catch (error) {
    const message = error?.message || "998Code 同步失败，请稍后重试";
    if (isAtlasAuthRequired(message)) {
      atlasHasSnapshot = false;
      atlasSession = null;
      els.atlasPasswordInput.value = "";
      setAtlasView("login");
      setAtlasMessage("登录已过期，请重新登录", "error");
      return;
    }
    renderAtlasError(message);
  } finally {
    setAtlasButtonLoading(false);
  }
}

function reloginAtlas() {
  atlasHasSnapshot = false;
  atlasSession = null;
  els.atlasPasswordInput.value = "";
  renderAtlasIdleState();
  announce("已退出 998Code 会话");
}

async function reloginStationTwo() {
  if (window.api && typeof window.api.clearStationTwoSession === "function") {
    await window.api.clearStationTwoSession();
  }
  stationTwoHasSnapshot = false;
  stationTwoSession = null;
  stationTwoAutoLoginAttempted = true;
  els.stationTwoPasswordInput.value = "";
  setStationTwoView("login");
  setStationTwoMessage("");
  announce("已退出 YesCode 会话");
}

async function maybeAutoLoginStationTwo({ force = false } = {}) {
  if (stationTwoAutoLoginAttempted) return;
  if (!els.stationTwoAutoLoginToggle.checked) return;
  if (!els.stationTwoEmailInput.value.trim() || !els.stationTwoPasswordInput.value) return;
  if (!force && currentSource !== "nova") return;

  stationTwoAutoLoginAttempted = true;
  await loginStationTwo();
}

async function initializeStationTwoPreferences() {
  let preferences = null;

  if (window.api && typeof window.api.getStationTwoPreferences === "function") {
    try {
      preferences = await window.api.getStationTwoPreferences();
    } catch {
      preferences = null;
    }
  }

  const legacyEmail = localStorage.getItem(STATION_TWO_EMAIL_KEY) || "";
  const legacyProxy = localStorage.getItem(STATION_TWO_PROXY_KEY);
  const resolvedEmail = String(preferences?.email || legacyEmail || "").trim();
  const resolvedPassword = String(preferences?.password || "");
  const resolvedProxy = typeof preferences?.proxyUrl === "string"
    ? preferences.proxyUrl.trim() || STATION_TWO_DEFAULT_PROXY
    : legacyProxy !== null
      ? legacyProxy
      : STATION_TWO_DEFAULT_PROXY;

  els.stationTwoEmailInput.value = resolvedEmail;
  els.stationTwoPasswordInput.value = resolvedPassword;
  els.stationTwoProxyInput.value = resolvedProxy;
  els.stationTwoRememberToggle.checked = Boolean(preferences?.rememberPassword);
  els.stationTwoAutoLoginToggle.checked = Boolean(preferences?.autoLogin && preferences?.rememberPassword);
  syncStationTwoPreferenceState();

  if (currentSource === "nova") {
    await maybeAutoLoginStationTwo({ force: true });
  }
}

function attachPointerGlow(panel) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  panel.addEventListener("pointermove", (event) => {
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    panel.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  });
  panel.addEventListener("pointerleave", () => {
    panel.style.removeProperty("--pointer-x");
    panel.style.removeProperty("--pointer-y");
  });
}

els.toggleBtn.addEventListener("click", () => {
  els.keyInput.type = els.keyInput.type === "password" ? "text" : "password";
  syncToggleState();
  announce(els.keyInput.type === "text" ? "已显示 API Key" : "已隐藏 API Key");
});

els.stationTwoToggleBtn.addEventListener("click", () => {
  els.stationTwoPasswordInput.type = els.stationTwoPasswordInput.type === "password" ? "text" : "password";
  syncStationTwoToggleState();
  announce(els.stationTwoPasswordInput.type === "text" ? "已显示 YesCode 密码" : "已隐藏 YesCode 密码");
});

els.atlasToggleBtn.addEventListener("click", () => {
  els.atlasPasswordInput.type = els.atlasPasswordInput.type === "password" ? "text" : "password";
  syncAtlasToggleState();
  announce(els.atlasPasswordInput.type === "text" ? "已显示 998Code 密码" : "已隐藏 998Code 密码");
});

els.stationTwoRememberToggle.addEventListener("change", async () => {
  if (!els.stationTwoRememberToggle.checked) {
    stationTwoAutoLoginAttempted = false;
  }
  syncStationTwoPreferenceState();
  await persistStationTwoPreferences();
});

els.stationTwoAutoLoginToggle.addEventListener("change", async () => {
  if (els.stationTwoAutoLoginToggle.checked) {
    els.stationTwoRememberToggle.checked = true;
    stationTwoAutoLoginAttempted = false;
  }
  syncStationTwoPreferenceState();
  await persistStationTwoPreferences();
});

els.stationTwoUsageFilter?.addEventListener("change", (event) => {
  stationTwoSelectedApiKeyId = String(event.target.value || "");
  stationTwoUsagePage = 1;
  void refreshStationTwoUsagePage(1);
});

els.stationTwoUsagePrevBtn?.addEventListener("click", () => {
  if (els.stationTwoUsagePrevBtn.disabled) return;
  void refreshStationTwoUsagePage(stationTwoUsagePage - 1);
});

els.stationTwoUsageNextBtn?.addEventListener("click", () => {
  if (els.stationTwoUsageNextBtn.disabled) return;
  void refreshStationTwoUsagePage(stationTwoUsagePage + 1);
});

els.refreshBtn.addEventListener("click", refresh);
els.keyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") refresh();
});
els.prevPageBtn.addEventListener("click", () => {
  if (!els.prevPageBtn.disabled) refresh(currentPage - 1);
});
els.nextPageBtn.addEventListener("click", () => {
  if (!els.nextPageBtn.disabled) refresh(currentPage + 1);
});

els.stationTwoLoginBtn.addEventListener("click", loginStationTwo);
els.stationTwoRefreshBtn.addEventListener("click", refreshStationTwoDashboard);
els.stationTwoReloginBtn.addEventListener("click", reloginStationTwo);
els.stationTwoEmailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginStationTwo();
});
els.stationTwoPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginStationTwo();
});
els.stationTwoProxyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginStationTwo();
});

els.atlasLoginBtn.addEventListener("click", loginAtlas);
els.atlasRefreshBtn.addEventListener("click", refreshAtlasDashboard);
els.atlasReloginBtn.addEventListener("click", reloginAtlas);
els.atlasUsernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginAtlas();
});
els.atlasPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginAtlas();
});

els.viewOfficialBtn.addEventListener("click", () => openLinkModal("official"));
els.viewGuideBtn.addEventListener("click", () => openLinkModal("guide"));
els.linkModalBackdrop.addEventListener("click", closeLinkModal);
els.linkModalCloseBtn.addEventListener("click", closeLinkModal);
els.copyLinkBtn.addEventListener("click", copyActiveLink);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.linkModal.hidden) closeLinkModal();
});

document.querySelectorAll(".interactive-panel").forEach(attachPointerGlow);
els.sourceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveSource(tab.dataset.sourceTab);
  });
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = els.sourceTabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + offset + els.sourceTabs.length) % els.sourceTabs.length;
    const nextTab = els.sourceTabs[nextIndex];
    nextTab.focus();
    setActiveSource(nextTab.dataset.sourceTab);
  });
});

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) els.keyInput.value = saved;

const savedAtlasUsername = localStorage.getItem(ATLAS_USERNAME_KEY);
if (savedAtlasUsername) els.atlasUsernameInput.value = savedAtlasUsername;

const savedSource = localStorage.getItem(SOURCE_STORAGE_KEY);
if (savedSource && SOURCE_CONFIG[savedSource]) currentSource = savedSource;

syncToggleState();
syncStationTwoToggleState();
syncAtlasToggleState();
requestAnimationFrame(async () => {
  document.body.classList.add("ready");
  renderIdleState();
  renderStationTwoIdleState();
  renderAtlasIdleState();
  await initializeStationTwoPreferences();
  setActiveSource(currentSource, { persist: false });
});
