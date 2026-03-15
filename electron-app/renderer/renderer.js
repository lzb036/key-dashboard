const STORAGE_KEY = "cto_dashboard_key";

const els = {
  balanceAmount: document.getElementById("balanceAmount"),
  statusBadge: document.getElementById("statusBadge"),
  balanceMeta: document.getElementById("balanceMeta"),
  keyInput: document.getElementById("keyInput"),
  toggleBtn: document.getElementById("toggleBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  msg: document.getElementById("msg"),
  statCost: document.getElementById("statCost"),
  statRecharged: document.getElementById("statRecharged"),
  statRequests: document.getElementById("statRequests"),
  tableCount: document.getElementById("tableCount"),
  tableBody: document.getElementById("tableBody")
};

function fmt(value, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return "$" + n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(d).replace(/\//g, "-");
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setMsg(text, tone = "") {
  els.msg.textContent = text;
  els.msg.className = "msg" + (tone ? " " + tone : "");
}

function getRequestFailureHint(message) {
  if (/401|403|认证失败|Unauthorized|Forbidden/i.test(message)) {
    return "认证失败，请检查 API Key 是否正确";
  }

  if (/ECONNRESET|超时|网络连接|代理|VPN|timed out|ERR_CONNECTION/i.test(message)) {
    return "网络请求失败，请检查当前网络、代理或 VPN 设置";
  }

  return "请求失败，请稍后重试";
}

function renderLoading() {
  els.balanceAmount.textContent = "加载中";
  els.balanceAmount.className = "balance-amount empty";
  els.statusBadge.innerHTML = "";
  els.balanceMeta.innerHTML = "";
  els.statCost.textContent = "—";
  els.statRecharged.textContent = "—";
  els.statRequests.textContent = "—";
  els.tableCount.textContent = "";
  els.tableBody.innerHTML = [1, 2, 3].map(() => `
    <div class="table-row">
      <div class="row-time skeleton">2026-03-14 11:00:00</div>
      <div><span class="row-model skeleton">claude-sonnet</span></div>
      <div class="row-requests skeleton">4</div>
      <div class="row-cost skeleton">$0.123</div>
    </div>
  `).join("");
}

function renderData(data) {
  // balance
  const bal = data.balance || {};
  const balVal = bal.balance;
  els.balanceAmount.textContent = Number.isFinite(Number(balVal)) ? fmt(balVal) : "暂无数据";
  els.balanceAmount.className = "balance-amount" + (Number.isFinite(Number(balVal)) ? "" : " empty");

  // status badge
  const isActive = data.status === "active";
  els.statusBadge.innerHTML = `
    <span class="status-badge ${isActive ? "active" : "inactive"}">
      <span class="status-dot"></span>${isActive ? "正常" : "异常"}
    </span>`;

  // meta
  els.balanceMeta.innerHTML = `
    <div class="meta-item">
      <span class="meta-label">累计充值</span>
      <span class="meta-value">${fmt(bal.total_recharged)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">累计消费</span>
      <span class="meta-value">${fmt(bal.total_consumed)}</span>
    </div>`;

  // stats
  const stats = data.stats || {};
  const totalRequests = (stats.model_distribution || []).reduce((s, m) => s + (m.requests || 0), 0);
  els.statCost.textContent = fmt(stats.total_cost);
  els.statRecharged.textContent = fmt(bal.total_recharged);
  els.statRequests.textContent = totalRequests || "—";

  // table
  const items = (data.consumption && Array.isArray(data.consumption.items))
    ? data.consumption.items : [];

  els.tableCount.textContent = `${items.length} 条`;

  if (!items.length) {
    els.tableBody.innerHTML = `<div class="empty-state">暂无消费记录</div>`;
    return;
  }

  els.tableBody.innerHTML = items.map(item => `
    <div class="table-row">
      <div class="row-time">${esc(fmtDate(item.created_at || item.minute_timestamp))}</div>
      <div><span class="row-model">${esc(item.model || "—")}</span></div>
      <div class="row-requests">${item.request_count || "—"}</div>
      <div class="row-cost">${esc(fmt(item.total_cost))}</div>
    </div>
  `).join("");
}

async function refresh() {
  const key = els.keyInput.value.trim();
  if (!key) { setMsg("请输入 API Key", "error"); return; }

  const authorization = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
  localStorage.setItem(STORAGE_KEY, key);

  els.refreshBtn.disabled = true;
  setMsg("");
  renderLoading();

  try {
    const data = await window.api.fetchDashboard(authorization);
    renderData(data);
    setMsg("已更新", "success");
  } catch (err) {
    els.balanceAmount.textContent = "暂无数据";
    els.balanceAmount.className = "balance-amount empty";
    els.tableBody.innerHTML = `<div class="empty-state">${esc(getRequestFailureHint(err.message || ""))}</div>`;
    setMsg(err.message || "请求失败", "error");
  } finally {
    els.refreshBtn.disabled = false;
  }
}

els.toggleBtn.addEventListener("click", () => {
  const isPassword = els.keyInput.type === "password";
  els.keyInput.type = isPassword ? "text" : "password";
  els.toggleBtn.textContent = isPassword ? "隐藏" : "显示";
});

els.refreshBtn.addEventListener("click", refresh);
els.keyInput.addEventListener("keydown", e => { if (e.key === "Enter") refresh(); });

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) els.keyInput.value = saved;
