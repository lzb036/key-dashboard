const SOURCE_CONFIG = {
  cto: {
    title: "hxrra",
    primaryLabel: "账户余额",
    metricALabel: "累计消耗",
    metricBLabel: "累计充值"
  },
  nova: {
    title: "YesCode",
    primaryLabel: "剩余额度",
    metricALabel: "今日消耗",
    metricBLabel: "月额度"
  },
  atlas: {
    title: "998Code",
    primaryLabel: "账户余额",
    metricALabel: "累计消耗",
    metricBLabel: "请求次数"
  }
};

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SOURCE_STORAGE_KEY = "widget_active_source";
const CTO_STORAGE_KEY = "cto_dashboard_key";

const els = {
  sourceTabs: Array.from(document.querySelectorAll(".source-tab")),
  heroKicker: document.getElementById("heroKicker"),
  heroValue: document.getElementById("heroValue"),
  heroSubline: document.getElementById("heroSubline"),
  metricALabel: document.getElementById("metricALabel"),
  metricAValue: document.getElementById("metricAValue"),
  metricBLabel: document.getElementById("metricBLabel"),
  metricBValue: document.getElementById("metricBValue"),
  statusText: document.getElementById("statusText"),
  updatedAt: document.getElementById("updatedAt"),
  refreshBtn: document.getElementById("refreshBtn"),
  pinBtn: document.getElementById("pinBtn"),
  openBtn: document.getElementById("openBtn")
};

let activeSource = "cto";
let loading = false;
let alwaysOnTop = true;
let autoRefreshTimer = null;

function formatMoney(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";

  if (Math.abs(numericValue) >= 1) {
    return `$${numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  return `$${numericValue.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";
  return numericValue.toLocaleString("zh-CN");
}

function formatTime(value) {
  if (!value) return "未更新";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未更新";
  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date)}`;
}

function setStatus(text, tone = "muted") {
  els.statusText.textContent = text;
  els.statusText.className = `status-text is-${tone}`;
}

function setLoading(nextValue) {
  loading = Boolean(nextValue);
  els.refreshBtn.disabled = loading;
  els.sourceTabs.forEach((button) => {
    button.disabled = loading;
  });
  els.refreshBtn.textContent = loading ? "同步中..." : "刷新";
}

function setSource(nextSource) {
  activeSource = SOURCE_CONFIG[nextSource] ? nextSource : "nova";
  els.sourceTabs.forEach((button) => {
    const isActive = button.dataset.source === activeSource;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, activeSource);
  } catch {
    // Ignore localStorage failures in restricted environments.
  }
}

function setCardContent({
  kicker,
  primaryLabel,
  primaryValue,
  subline,
  metricALabel,
  metricAValue,
  metricBLabel,
  metricBValue
}) {
  els.heroKicker.textContent = kicker;
  els.heroValue.textContent = primaryValue;
  els.heroSubline.textContent = subline || " ";
  els.metricALabel.textContent = metricALabel;
  els.metricAValue.textContent = metricAValue;
  els.metricBLabel.textContent = metricBLabel;
  els.metricBValue.textContent = metricBValue;

  if (primaryLabel) {
    els.heroKicker.textContent = `${kicker} · ${primaryLabel}`;
  }
}

function normalizeSourceError(source, rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message) return "同步失败，请稍后重试";

  if (source === "cto" && /请输入 hxrra API Key|请先在完整面板填写 hxrra API Key/i.test(message)) {
    return "请先在完整面板填写并保存 hxrra API Key";
  }

  if (source === "nova" && /请输入站点二邮箱和密码|登录已失效|AUTH_REQUIRED/i.test(message)) {
    return "请先在完整面板登录 YesCode 并勾选记住账号密码";
  }

  if (source === "atlas" && /请输入 998Code 用户名和密码|登录已失效|AUTH_REQUIRED/i.test(message)) {
    return "请先在完整面板登录 998Code 并勾选记住账号密码";
  }

  return message;
}

async function fetchCtoData() {
  const key = String(localStorage.getItem(CTO_STORAGE_KEY) || "").trim();
  if (!key) {
    throw new Error("请先在完整面板填写 hxrra API Key");
  }

  const authorization = /^Bearer\s+/i.test(key) ? key : `Bearer ${key}`;
  return window.api.fetchDashboard(authorization, { page: 1, limit: 10 });
}

async function fetchNovaData() {
  const preferences = await window.api.getStationTwoPreferences();
  return window.api.fetchStationTwoDashboard({
    email: String(preferences?.email || "").trim(),
    password: String(preferences?.password || ""),
    proxyUrl: String(preferences?.proxyUrl || "").trim(),
    allowLogin: true,
    usagePage: 1,
    usagePageSize: 10
  });
}

async function fetchAtlasData() {
  const preferences = await window.api.getStationThreePreferences();
  return window.api.fetchStationThreeDashboard({
    username: String(preferences?.username || "").trim(),
    password: String(preferences?.password || ""),
    allowLogin: true
  });
}

function renderNova(data) {
  const summary = data?.summary || {};
  const session = data?.session || {};
  const sourceConfig = SOURCE_CONFIG.nova;
  const subtitleParts = [];

  if (session.email) subtitleParts.push(session.email);
  if (summary.title) subtitleParts.push(summary.title);

  setCardContent({
    kicker: sourceConfig.title,
    primaryLabel: sourceConfig.primaryLabel,
    primaryValue: formatMoney(summary.remainingUsd),
    subline: subtitleParts.join(" · ") || "未检测到可用会话",
    metricALabel: sourceConfig.metricALabel,
    metricAValue: formatMoney(summary.dailyUsageUsd),
    metricBLabel: sourceConfig.metricBLabel,
    metricBValue: formatMoney(summary.monthlyLimitUsd)
  });
}

function renderCto(data) {
  const sourceConfig = SOURCE_CONFIG.cto;
  const balance = data?.balance || {};
  const stats = data?.stats || {};
  const consumption = data?.consumption || {};
  const itemCount = Array.isArray(consumption.items) ? consumption.items.length : 0;

  setCardContent({
    kicker: sourceConfig.title,
    primaryLabel: sourceConfig.primaryLabel,
    primaryValue: formatMoney(balance.balance),
    subline: itemCount > 0 ? `最近拉取 ${itemCount} 条消费记录` : "暂无消费记录",
    metricALabel: sourceConfig.metricALabel,
    metricAValue: formatMoney(stats.total_cost),
    metricBLabel: sourceConfig.metricBLabel,
    metricBValue: formatMoney(balance.total_recharged)
  });
}

function renderAtlas(data) {
  const summary = data?.summary || {};
  const sourceConfig = SOURCE_CONFIG.atlas;
  const subtitleParts = [];

  if (summary.displayName) subtitleParts.push(summary.displayName);
  if (summary.group && summary.group !== "—") subtitleParts.push(summary.group);

  setCardContent({
    kicker: sourceConfig.title,
    primaryLabel: sourceConfig.primaryLabel,
    primaryValue: formatMoney(summary.balanceUsd),
    subline: subtitleParts.join(" · ") || "未检测到可用会话",
    metricALabel: sourceConfig.metricALabel,
    metricAValue: formatMoney(summary.usedUsd),
    metricBLabel: sourceConfig.metricBLabel,
    metricBValue: formatCount(summary.requestCount)
  });
}

async function refreshWidget({ silent = false } = {}) {
  if (loading) return;
  setLoading(true);
  if (!silent) {
    setStatus("正在同步数据...", "muted");
  }

  try {
    if (activeSource === "atlas") {
      const data = await fetchAtlasData();
      renderAtlas(data);
    } else if (activeSource === "cto") {
      const data = await fetchCtoData();
      renderCto(data);
    } else {
      const data = await fetchNovaData();
      renderNova(data);
    }

    setStatus("数据已同步", "success");
    els.updatedAt.textContent = formatTime(new Date());
  } catch (error) {
    setStatus(normalizeSourceError(activeSource, error?.message), "error");
  } finally {
    setLoading(false);
  }
}

async function toggleAlwaysOnTop() {
  try {
    const result = await window.api.setWidgetAlwaysOnTop(!alwaysOnTop);
    alwaysOnTop = Boolean(result);
    els.pinBtn.textContent = alwaysOnTop ? "取消置顶" : "置顶";
    els.pinBtn.setAttribute("aria-pressed", String(alwaysOnTop));
    els.pinBtn.classList.toggle("is-active", alwaysOnTop);
    setStatus(alwaysOnTop ? "已置顶" : "已取消置顶", "success");
  } catch {
    setStatus("置顶状态切换失败", "error");
  }
}

async function bootstrap() {
  if (!window.api) {
    setStatus("运行环境异常：API 通道不可用", "error");
    return;
  }

  try {
    const savedSource = localStorage.getItem(SOURCE_STORAGE_KEY);
    if (savedSource && SOURCE_CONFIG[savedSource]) {
      activeSource = savedSource;
    }
  } catch {
    // Ignore localStorage failures.
  }

  setSource(activeSource);

  try {
    const settings = await window.api.getWidgetSettings();
    alwaysOnTop = Boolean(settings?.alwaysOnTop);
  } catch {
    alwaysOnTop = true;
  }

  els.pinBtn.textContent = alwaysOnTop ? "取消置顶" : "置顶";
  els.pinBtn.setAttribute("aria-pressed", String(alwaysOnTop));
  els.pinBtn.classList.toggle("is-active", alwaysOnTop);

  await refreshWidget();

  autoRefreshTimer = setInterval(() => {
    void refreshWidget({ silent: true });
  }, AUTO_REFRESH_INTERVAL_MS);
}

els.sourceTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const source = button.dataset.source;
    if (!source || source === activeSource) return;
    setSource(source);
    void refreshWidget();
  });
});

els.refreshBtn.addEventListener("click", () => {
  void refreshWidget();
});

els.pinBtn.addEventListener("click", () => {
  void toggleAlwaysOnTop();
});

els.openBtn.addEventListener("click", async () => {
  try {
    await window.api.openMainDashboard();
  } catch {
    setStatus("打开完整面板失败", "error");
  }
});

window.addEventListener("beforeunload", () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
});

void bootstrap();
