const STORAGE_KEY = "cto_dashboard_key";
const SOURCE_STORAGE_KEY = "cto_dashboard_source";
const STATION_TWO_EMAIL_KEY = "station_two_email";
const STATION_TWO_PROXY_KEY = "station_two_proxy";
const STATION_TWO_DEFAULT_PROXY = "http://127.0.0.1:7890";
const PAGE_LIMIT = 10;
const SOURCE_CONFIG = {
  cto: { title: "CTO 面板" },
  nova: { title: "站点二" },
  atlas: { title: "站点三" }
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
  stationTwoSessionMeta: document.getElementById("stationTwoSessionMeta"),
  stationTwoStrategyBadge: document.getElementById("stationTwoStrategyBadge"),
  stationTwoProxyBadge: document.getElementById("stationTwoProxyBadge"),
  stationTwoEmailInput: document.getElementById("stationTwoEmailInput"),
  stationTwoPasswordInput: document.getElementById("stationTwoPasswordInput"),
  stationTwoProxyInput: document.getElementById("stationTwoProxyInput"),
  stationTwoToggleBtn: document.getElementById("stationTwoToggleBtn"),
  stationTwoRefreshBtn: document.getElementById("stationTwoRefreshBtn"),
  stationTwoRefreshLabel: document.querySelector("#stationTwoRefreshBtn .btn-label"),
  stationTwoDashboardMsg: document.getElementById("stationTwoDashboardMsg"),
  stationTwoReloginBtn: document.getElementById("stationTwoReloginBtn"),
  stationTwoEmailReadout: document.getElementById("stationTwoEmailReadout"),
  stationTwoProxyReadout: document.getElementById("stationTwoProxyReadout"),
  stationTwoStrategyReadout: document.getElementById("stationTwoStrategyReadout"),
  stationTwoPackageList: document.getElementById("stationTwoPackageList"),
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
let stationTwoSession = null;
let stationTwoView = "login";

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
  els.stationTwoLoginLabel.textContent = stationTwoLoading && stationTwoView === "login" ? "登录中..." : "登录并进入";
  els.stationTwoRefreshLabel.textContent = stationTwoLoading && stationTwoView === "dashboard" ? "刷新中..." : "刷新站点二";
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

function stationTwoSkeletonMarkup(index) {
  return `<article class="station-two-package-card" style="--delay:${index * 42}ms;animation:none;opacity:1;transform:none;"><div class="station-two-card-head"><div><span class="station-two-card-kicker skeleton">活跃套餐</span><h3 class="station-two-card-title skeleton">卡特尔套餐</h3></div><span class="status-badge pending">同步中</span></div><div class="station-two-card-grid"><div class="station-two-kpi"><span class="distribution-metric-label">剩余额度</span><strong class="station-two-kpi-value skeleton">$34.17</strong></div><div class="station-two-kpi"><span class="distribution-metric-label">总额度</span><strong class="station-two-kpi-value skeleton">$300.00</strong></div><div class="station-two-kpi"><span class="distribution-metric-label">今日消费</span><strong class="station-two-kpi-value skeleton">$11.38</strong></div></div></article>`;
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
  if (!Array.isArray(items) || !items.length) {
    els.distributionBody.innerHTML = emptyStateMarkup("暂无模型分布", "当前时间范围内还没有模型使用统计，稍后刷新可再次获取最新数据。");
    return;
  }
  els.distributionBody.innerHTML = items.map((item, index) => `
    <article class="distribution-card" style="--delay:${index * 46}ms">
      <div class="distribution-card-head"><span class="distribution-model">${esc(item.model || "—")}</span></div>
      <div class="distribution-metrics">
        <div class="distribution-metric"><span class="distribution-metric-label">调用次数</span><strong class="distribution-metric-value">${esc(fmtCount(item.requests ?? item.request_count ?? 0))}</strong></div>
        <div class="distribution-metric"><span class="distribution-metric-label">花费</span><strong class="distribution-metric-value distribution-metric-value--cost">${esc(fmtMoney(item.cost ?? item.total_cost))}</strong></div>
      </div>
    </article>
  `).join("");
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
  els.distributionBody.innerHTML = [0, 1, 2].map(distributionSkeletonMarkup).join("");
  els.tableBody.innerHTML = [0, 1, 2, 3].map(skeletonRowMarkup).join("");
  syncPagination();
}

function renderData(data) {
  const balance = data?.balance || {};
  const consumption = data?.consumption || {};
  const modelDistribution = Array.isArray(data?.stats?.model_distribution) ? data.stats.model_distribution : [];
  const items = Array.isArray(consumption.items) ? consumption.items : [];
  const resolvedLimit = normalizePage(consumption.limit, currentPageSize);
  const resolvedTotal = Math.max(0, numberOrNull(consumption.total) ?? items.length);
  const resolvedPage = normalizePage(consumption.page, currentPage);
  setCreditValues({
    balance: balance.balance,
    totalConsumed: balance.total_consumed,
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
  els.stationTwoToggleBtn.setAttribute("aria-label", `${isVisible ? "隐藏" : "显示"}站点二密码`);
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

function getStationTwoStrategyInfo(strategy, expiresAt = null) {
  const suffix = expiresAt ? `，令牌预计于 ${fmtDate(expiresAt)} 到期` : "";
  if (strategy === "refresh") {
    return {
      badge: "Refresh 续期",
      readout: "Refresh Token",
      meta: `检测到标准双令牌流程，优先使用 Refresh Token 自动续期${suffix}`,
      emphasized: true
    };
  }
  if (strategy === "relogin") {
    return {
      badge: "自动重登",
      readout: "重新登录",
      meta: `当前部署未开放刷新接口，令牌失效后会静默重新登录${suffix}`,
      emphasized: false
    };
  }
  return {
    badge: "自动续期待激活",
    readout: "待连接",
    meta: "主进程会托管登录态，当前部署会在需要时自动重新登录。",
    emphasized: false
  };
}

function getStationTwoProxyText(proxyUrl) {
  const proxy = String(proxyUrl || "").trim();
  return proxy || "直连";
}

function syncStationTwoSessionChrome({ email, proxyUrl, strategy, expiresAt } = {}) {
  const strategyInfo = getStationTwoStrategyInfo(strategy, expiresAt);
  const resolvedEmail = String(email || els.stationTwoEmailInput.value || "").trim();
  const resolvedProxy = getStationTwoProxyText(proxyUrl !== undefined ? proxyUrl : els.stationTwoProxyInput.value);
  els.stationTwoSessionMeta.textContent = strategyInfo.meta;
  els.stationTwoStrategyBadge.textContent = strategyInfo.badge;
  els.stationTwoStrategyBadge.className = `soft-pill${strategyInfo.emphasized ? " emphasis" : ""}`;
  els.stationTwoProxyBadge.textContent = resolvedProxy === "直连" ? "直连模式" : `代理 ${resolvedProxy.replace(/^https?:\/\//i, "")}`;
  els.stationTwoProxyBadge.className = `soft-pill${resolvedProxy === "直连" ? " emphasis" : ""}`;
  els.stationTwoEmailReadout.textContent = resolvedEmail || "未填写";
  els.stationTwoProxyReadout.textContent = resolvedProxy === STATION_TWO_DEFAULT_PROXY ? "本机 7890" : resolvedProxy;
  els.stationTwoStrategyReadout.textContent = strategyInfo.readout;
}

function setStationTwoSummaryValues({ title, remainingUsd, monthlyLimitUsd, dailyUsageUsd }) {
  const remainingValue = numberOrNull(remainingUsd);
  els.stationTwoPackageName.textContent = title || "等待登录";
  els.stationTwoRemainingAmount.textContent = remainingValue !== null ? fmtMoney(remainingValue) : "登录后查看";
  els.stationTwoRemainingAmount.className = `balance-amount${remainingValue !== null ? "" : " empty"}`;
  els.stationTwoMonthlyLimitAmount.textContent = numberOrNull(monthlyLimitUsd) !== null ? fmtMoney(monthlyLimitUsd) : "—";
  els.stationTwoDailyUsageAmount.textContent = numberOrNull(dailyUsageUsd) !== null ? fmtMoney(dailyUsageUsd) : "—";
}

function getStationTwoStatusInfo(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "active") return { label: "活跃", tone: "active" };
  if (value === "expired" || value === "inactive" || value === "disabled") return { label: "不可用", tone: "inactive" };
  return { label: value ? value.toUpperCase() : "待确认", tone: "pending" };
}

function renderStationTwoPackageList(items) {
  if (!Array.isArray(items) || !items.length) {
    els.stationTwoPackageList.innerHTML = emptyStateMarkup("暂无活跃套餐", "接口已经连通，但当前账号下没有可展示的活跃套餐。");
    return;
  }
  els.stationTwoPackageList.innerHTML = items.map((item, index) => {
    const status = getStationTwoStatusInfo(item.status);
    return `
      <article class="station-two-package-card" style="--delay:${index * 52}ms">
        <div class="station-two-card-head">
          <div class="station-two-card-title-wrap">
            <span class="station-two-card-kicker">活跃套餐 ${index + 1}</span>
            <h3 class="station-two-card-title">${esc(item.name || "未命名套餐")}</h3>
          </div>
          <span class="status-badge ${status.tone}">${esc(status.label)}</span>
        </div>
        <div class="station-two-card-grid">
          <div class="station-two-kpi station-two-kpi--remaining"><span class="distribution-metric-label">剩余额度</span><strong class="station-two-kpi-value">${esc(fmtMoney(item.remainingUsd))}</strong></div>
          <div class="station-two-kpi"><span class="distribution-metric-label">总额度</span><strong class="station-two-kpi-value">${esc(fmtMoney(item.monthlyLimitUsd))}</strong></div>
          <div class="station-two-kpi"><span class="distribution-metric-label">今日消费</span><strong class="station-two-kpi-value">${esc(fmtMoney(item.dailyUsageUsd))}</strong></div>
        </div>
        <div class="station-two-card-footer"><span class="station-two-card-footer-label">到期时间</span><strong class="station-two-card-footer-value">${esc(fmtDate(item.expiresAt))}</strong></div>
      </article>
    `;
  }).join("");
}

function renderStationTwoIdleState() {
  if (!stationTwoHasSnapshot) {
    setStationTwoSummaryValues({ title: "等待登录", remainingUsd: null, monthlyLimitUsd: null, dailyUsageUsd: null });
    els.stationTwoPackageList.innerHTML = emptyStateMarkup("登录后查看套餐", "同步成功后，这里会列出活跃套餐的名称、剩余额度、总额度和今日消费。");
    setStationTwoView("login");
  } else {
    setStationTwoView("dashboard");
  }
  syncStationTwoSessionChrome({
    email: els.stationTwoEmailInput.value.trim(),
    proxyUrl: els.stationTwoProxyInput.value.trim(),
    strategy: stationTwoSession?.strategy || "",
    expiresAt: stationTwoSession?.expiresAt || null
  });
  setStationTwoMessage("");
  setStationTwoButtonLoading(false);
}

function renderStationTwoLoadingState() {
  els.stationTwoPackageName.textContent = "同步中";
  els.stationTwoRemainingAmount.textContent = "同步中...";
  els.stationTwoRemainingAmount.className = "balance-amount empty";
  els.stationTwoMonthlyLimitAmount.textContent = "—";
  els.stationTwoDailyUsageAmount.textContent = "—";
  els.stationTwoPackageList.innerHTML = [0, 1].map(stationTwoSkeletonMarkup).join("");
  syncStationTwoSessionChrome({
    email: els.stationTwoEmailInput.value.trim() || stationTwoSession?.email || "",
    proxyUrl: els.stationTwoProxyInput.value.trim(),
    strategy: stationTwoSession?.strategy || "",
    expiresAt: stationTwoSession?.expiresAt || null
  });
}

function renderStationTwoData(data) {
  const summary = data?.summary || {};
  stationTwoSession = data?.session || {};
  stationTwoHasSnapshot = true;
  setStationTwoSummaryValues({
    title: summary.title || "活跃套餐",
    remainingUsd: summary.remainingUsd,
    monthlyLimitUsd: summary.monthlyLimitUsd,
    dailyUsageUsd: summary.dailyUsageUsd
  });
  renderStationTwoPackageList(summary.items);
  syncStationTwoSessionChrome(stationTwoSession);
  setStationTwoView("dashboard");
}

function renderStationTwoError(message) {
  if (!stationTwoHasSnapshot) {
    setStationTwoSummaryValues({ title: "暂时无法同步", remainingUsd: null, monthlyLimitUsd: null, dailyUsageUsd: null });
    els.stationTwoPackageList.innerHTML = emptyStateMarkup("站点二暂时不可用", message);
  }
  setStationTwoMessage(message, "error");
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
      allowLogin: true
    });
    const emailToStore = String(data?.session?.email || payload.email || "").trim();
    if (emailToStore) {
      localStorage.setItem(STATION_TWO_EMAIL_KEY, emailToStore);
      if (!els.stationTwoEmailInput.value.trim()) els.stationTwoEmailInput.value = emailToStore;
    }
    localStorage.setItem(STATION_TWO_PROXY_KEY, payload.proxyUrl);
    renderStationTwoData(data);
    setStationTwoMessage("登录成功，已进入站点二", "success");
  } catch (error) {
    renderStationTwoError(error?.message || "站点二同步失败，请稍后重试");
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
      allowLogin: false
    });
    renderStationTwoData(data);
    setStationTwoMessage("站点二数据已更新", "success");
  } catch (error) {
    const message = error?.message || "站点二同步失败，请稍后重试";
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

async function reloginStationTwo() {
  if (window.api && typeof window.api.clearStationTwoSession === "function") {
    await window.api.clearStationTwoSession();
  }
  stationTwoHasSnapshot = false;
  stationTwoSession = null;
  els.stationTwoPasswordInput.value = "";
  setStationTwoView("login");
  setStationTwoMessage("");
  announce("已退出站点二会话");
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
  announce(els.stationTwoPasswordInput.type === "text" ? "已显示站点二密码" : "已隐藏站点二密码");
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

const savedStationTwoEmail = localStorage.getItem(STATION_TWO_EMAIL_KEY);
if (savedStationTwoEmail) els.stationTwoEmailInput.value = savedStationTwoEmail;

const savedStationTwoProxy = localStorage.getItem(STATION_TWO_PROXY_KEY);
els.stationTwoProxyInput.value = savedStationTwoProxy !== null ? savedStationTwoProxy : STATION_TWO_DEFAULT_PROXY;

const savedSource = localStorage.getItem(SOURCE_STORAGE_KEY);
if (savedSource && SOURCE_CONFIG[savedSource]) currentSource = savedSource;

syncToggleState();
syncStationTwoToggleState();
requestAnimationFrame(() => {
  document.body.classList.add("ready");
  renderIdleState();
  renderStationTwoIdleState();
  setActiveSource(currentSource, { persist: false });
});
