const STORAGE_KEY = "cto_dashboard_key";
const PAGE_LIMIT = 10;

const els = {
  balanceAmount: document.getElementById("balanceAmount"),
  totalConsumedAmount: document.getElementById("totalConsumedAmount"),
  totalRechargedAmount: document.getElementById("totalRechargedAmount"),
  keyInput: document.getElementById("keyInput"),
  toggleBtn: document.getElementById("toggleBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshLabel: document.querySelector("#refreshBtn .btn-label"),
  msg: document.getElementById("msg"),
  tableBody: document.getElementById("tableBody"),
  tablePagination: document.getElementById("tablePagination"),
  paginationMeta: document.getElementById("paginationMeta"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  srAnnounce: document.getElementById("srAnnounce")
};

let hasSnapshot = false;
let isLoading = false;
let currentPage = 1;
let totalItems = 0;
let totalPages = 1;
let currentPageSize = PAGE_LIMIT;
let lastSubmittedKey = "";

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(value) {
  const n = numberOrNull(value);
  if (n === null) return "—";

  const abs = Math.abs(n);
  if (abs >= 1) {
    return "$" + n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return "$" + n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtCount(value) {
  const n = numberOrNull(value);
  if (n === null) return "—";
  return n.toLocaleString("zh-CN");
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
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function setButtonLoading(loading) {
  isLoading = Boolean(loading);
  els.refreshBtn.disabled = isLoading;
  els.refreshBtn.classList.toggle("is-loading", isLoading);
  els.refreshLabel.textContent = isLoading ? "同步中..." : "刷新数据";
  syncPagination();
}

function getRequestFailureHint(message) {
  if (/401|403|认证失败|Unauthorized|Forbidden/i.test(message)) {
    return "认证失败，请检查 API Key 是否正确或是否仍然有效";
  }

  if (/ECONNRESET|超时|网络连接|代理|VPN|timed out|ERR_CONNECTION/i.test(message)) {
    return "网络请求失败，请检查当前网络、代理或 VPN 设置";
  }

  return "请求失败，请稍后重试";
}

function emptyStateMarkup(title, text) {
  return `
    <div class="empty-state">
      <div class="empty-orb" aria-hidden="true"></div>
      <p class="empty-title">${esc(title)}</p>
      <p class="empty-text">${esc(text)}</p>
    </div>
  `;
}

function skeletonRowMarkup(index) {
  return `
    <div class="table-grid table-row" role="row" style="--delay: ${index * 40}ms; animation: none; opacity: 1; transform: none;">
      <div class="row-time skeleton" role="cell">03-15 14:20:00</div>
      <div role="cell"><span class="row-model skeleton">gpt-5</span></div>
      <div class="row-requests skeleton" role="cell">18</div>
      <div class="row-cost skeleton" role="cell">$0.12</div>
    </div>
  `;
}

function setCreditValues({ balance, totalConsumed, totalRecharged }) {
  const balanceValue = numberOrNull(balance);
  const consumedValue = numberOrNull(totalConsumed);
  const rechargedValue = numberOrNull(totalRecharged);

  els.balanceAmount.textContent = balanceValue !== null ? fmtMoney(balanceValue) : "暂无数据";
  els.balanceAmount.className = `balance-amount${balanceValue !== null ? "" : " empty"}`;
  els.totalConsumedAmount.textContent = consumedValue !== null ? fmtMoney(consumedValue) : "—";
  els.totalRechargedAmount.textContent = rechargedValue !== null ? fmtMoney(rechargedValue) : "—";
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

  const metaText = isLoading
    ? `正在加载第 ${currentPage} 页...`
    : `第 ${fmtCount(currentPage)} / ${fmtCount(totalPages)} 页 · 共 ${fmtCount(totalItems)} 条`;

  els.paginationMeta.textContent = metaText;
  els.prevPageBtn.disabled = isLoading || currentPage <= 1;
  els.nextPageBtn.disabled = isLoading || currentPage >= totalPages;
}

function renderIdleState() {
  setCreditValues({});
  totalItems = 0;
  totalPages = 1;
  currentPage = 1;
  currentPageSize = PAGE_LIMIT;

  if (!hasSnapshot) {
    els.tableBody.innerHTML = emptyStateMarkup(
      "输入 API Key 后点击刷新",
      "这里只保留消费记录本身，刷新后会展示最近 10 条明细。"
    );
  }

  setMsg("");
  syncPagination();
}

function renderLoadingState() {
  els.balanceAmount.textContent = "同步中...";
  els.balanceAmount.className = "balance-amount empty";
  els.totalConsumedAmount.textContent = "—";
  els.totalRechargedAmount.textContent = "—";
  els.tableBody.innerHTML = [0, 1, 2, 3].map(skeletonRowMarkup).join("");
  syncPagination();
}

function renderData(data) {
  const balance = data?.balance || {};
  const consumption = data?.consumption || {};
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

  if (!items.length) {
    els.tableBody.innerHTML = emptyStateMarkup("暂无消费记录", "当前时间范围内没有消费明细，稍后刷新可再次获取最新数据。");
    hasSnapshot = true;
    syncPagination();
    return;
  }

  els.tableBody.innerHTML = items.map((item, index) => `
    <div class="table-grid table-row" role="row" style="--delay: ${index * 46}ms">
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

  const normalizedPage = key !== lastSubmittedKey
    ? 1
    : Math.min(normalizePage(targetPage, currentPage), totalPages);
  const authorization = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
  localStorage.setItem(STORAGE_KEY, key);
  lastSubmittedKey = key;
  currentPage = normalizedPage;

  setButtonLoading(true);
  setMsg("");
  renderLoadingState();

  try {
    const data = await window.api.fetchDashboard(authorization, {
      page: currentPage,
      limit: currentPageSize
    });
    renderData(data);
    const suffix = totalPages > 1 ? `，当前第 ${fmtCount(currentPage)} 页` : "";
    setMsg(`数据已更新${suffix}`, "success");
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

els.refreshBtn.addEventListener("click", refresh);
els.keyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") refresh();
});
els.prevPageBtn.addEventListener("click", () => {
  if (els.prevPageBtn.disabled) return;
  refresh(currentPage - 1);
});
els.nextPageBtn.addEventListener("click", () => {
  if (els.nextPageBtn.disabled) return;
  refresh(currentPage + 1);
});

document.querySelectorAll(".interactive-panel").forEach(attachPointerGlow);

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  els.keyInput.value = saved;
}

syncToggleState();
requestAnimationFrame(() => {
  document.body.classList.add("ready");
  renderIdleState();
});
