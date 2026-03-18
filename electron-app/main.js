const { app, BrowserWindow, ipcMain, net, clipboard, session, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

let win;
let widgetWin;

const DASHBOARD_URL = "https://cto.hxrra.com/api/public/dashboard";
const STATION_TWO_BASE_URL = "https://api.yescode.cloud";
const STATION_TWO_LOGIN_URL = `${STATION_TWO_BASE_URL}/api/v1/auth/login`;
const STATION_TWO_REFRESH_URL = `${STATION_TWO_BASE_URL}/api/v1/auth/refresh`;
const STATION_TWO_ACTIVE_URL = `${STATION_TWO_BASE_URL}/api/v1/subscriptions/active`;
const STATION_TWO_MODELS_URL = `${STATION_TWO_BASE_URL}/api/v1/usage/dashboard/models`;
const STATION_TWO_USAGE_URL = `${STATION_TWO_BASE_URL}/api/v1/usage`;
const STATION_TWO_USAGE_STATS_URL = `${STATION_TWO_BASE_URL}/api/v1/usage/stats`;
const STATION_TWO_KEYS_URL = `${STATION_TWO_BASE_URL}/api/v1/keys`;
const STATION_THREE_BASE_URL = "https://9985678.xyz";
const STATION_THREE_LOGIN_URL = `${STATION_THREE_BASE_URL}/api/user/login?turnstile=`;
const STATION_THREE_SELF_URL = `${STATION_THREE_BASE_URL}/api/user/self`;
const STATION_THREE_USER_TOKEN_URL = `${STATION_THREE_BASE_URL}/api/user/token`;
const STATION_THREE_STATUS_URL = `${STATION_THREE_BASE_URL}/api/status`;
const STATION_THREE_SUBSCRIPTION_SELF_URL = `${STATION_THREE_BASE_URL}/api/subscription/self`;
const STATION_THREE_SUBSCRIPTION_PLANS_URL = `${STATION_THREE_BASE_URL}/api/subscription/plans`;
const STATION_THREE_LOG_SELF_URL = `${STATION_THREE_BASE_URL}/api/log/self/`;
const STATION_TWO_SESSION_PARTITION = "persist:key-dashboard-station-two";
const STATION_THREE_SESSION_PARTITION = "persist:key-dashboard-station-three";
const STATION_TWO_DEFAULT_PROXY = "";
const STATION_TWO_PREFS_FILENAME = "station-two-auth.json";
const STATION_THREE_PREFS_FILENAME = "station-three-auth.json";
const STATION_TWO_TIMEOUT_MS = 20000;
const STATION_TWO_USAGE_PAGE_SIZE = 10;
const STATION_THREE_TIMEOUT_MS = 20000;
const STATION_THREE_DEFAULT_QUOTA_PER_UNIT = 500000;
const STATION_THREE_LOG_FETCH_PAGE_SIZE = 100;
const STATION_THREE_LOG_FETCH_MAX_PAGES = 30;
const TOKEN_REFRESH_BUFFER_MS = 120000;
// Hot-update entry (disabled for manual update workflow):
// const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const DASHBOARD_RANGE = "day";
const DEFAULT_CONSUMPTION_PAGE = 1;
const DEFAULT_CONSUMPTION_LIMIT = 10;
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
  "ERR_CONNECTION_RESET",
  "ERR_CONNECTION_CLOSED",
  "ERR_CONNECTION_ABORTED",
  "ERR_TIMED_OUT",
  "ERR_NETWORK_CHANGED",
  "ERR_INTERNET_DISCONNECTED"
]);
const stationTwoState = {
  email: "",
  password: "",
  proxyUrl: STATION_TWO_DEFAULT_PROXY,
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  refreshSupported: null
};
const stationThreeState = {
  username: "",
  password: "",
  userId: "",
  sessionCookie: "",
  accessToken: "",
  displayName: "",
  group: "",
  quotaPerUnit: STATION_THREE_DEFAULT_QUOTA_PER_UNIT
};
let stationTwoProxyConfigured = null;
let stationTwoUsageApiKeysCache = {
  dateKey: "",
  items: [],
  records: []
};
let stationTwoKeysCache = {
  cacheKey: "",
  items: []
};

function getStationTwoPreferencesPath() {
  return path.join(app.getPath("userData"), STATION_TWO_PREFS_FILENAME);
}

function getStationThreePreferencesPath() {
  return path.join(app.getPath("userData"), STATION_THREE_PREFS_FILENAME);
}

function encodeStationTwoSecret(value) {
  const text = String(value || "");
  if (!text) return null;

  if (safeStorage.isEncryptionAvailable()) {
    return {
      type: "safeStorage",
      value: safeStorage.encryptString(text).toString("base64")
    };
  }

  return {
    type: "plain",
    value: text
  };
}

function decodeStationTwoSecret(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (payload.type === "safeStorage") {
    try {
      const buffer = Buffer.from(String(payload.value || ""), "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      return "";
    }
  }

  if (payload.type === "plain") {
    return String(payload.value || "");
  }

  return "";
}

function getDefaultStationTwoPreferences() {
  return {
    email: "",
    password: "",
    proxyUrl: STATION_TWO_DEFAULT_PROXY,
    rememberPassword: false,
    autoLogin: false
  };
}

function readStationTwoPreferences() {
  const defaults = getDefaultStationTwoPreferences();

  try {
    const filePath = getStationTwoPreferencesPath();
    if (!fs.existsSync(filePath)) {
      return defaults;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    const rememberPassword = Boolean(parsed.rememberPassword);

    return {
      email: rememberPassword ? String(parsed.email || "").trim() : "",
      password: rememberPassword ? decodeStationTwoSecret(parsed.password) : "",
      proxyUrl: typeof parsed.proxyUrl === "string" ? parsed.proxyUrl.trim() : STATION_TWO_DEFAULT_PROXY,
      rememberPassword,
      autoLogin: rememberPassword && Boolean(parsed.autoLogin)
    };
  } catch {
    return defaults;
  }
}

function writeStationTwoPreferences({ email, password, proxyUrl, rememberPassword, autoLogin } = {}) {
  const filePath = getStationTwoPreferencesPath();
  const resolvedRemember = Boolean(rememberPassword);
  const normalizedProxy = typeof proxyUrl === "string" ? proxyUrl.trim() : STATION_TWO_DEFAULT_PROXY;
  const payload = {
    email: resolvedRemember ? String(email || "").trim() : "",
    password: resolvedRemember ? encodeStationTwoSecret(password) : null,
    proxyUrl: normalizedProxy,
    rememberPassword: resolvedRemember,
    autoLogin: resolvedRemember && Boolean(autoLogin)
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

  return {
    email: payload.email,
    password: resolvedRemember ? String(password || "") : "",
    proxyUrl: payload.proxyUrl || STATION_TWO_DEFAULT_PROXY,
    rememberPassword: payload.rememberPassword,
    autoLogin: payload.autoLogin
  };
}

function getDefaultStationThreePreferences() {
  return {
    username: "",
    password: "",
    rememberPassword: false,
    autoLogin: false
  };
}

function readStationThreePreferences() {
  const defaults = getDefaultStationThreePreferences();

  try {
    const filePath = getStationThreePreferencesPath();
    if (!fs.existsSync(filePath)) {
      return defaults;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    const rememberPassword = Boolean(parsed.rememberPassword);

    return {
      username: rememberPassword ? String(parsed.username || "").trim() : "",
      password: rememberPassword ? decodeStationTwoSecret(parsed.password) : "",
      rememberPassword,
      autoLogin: rememberPassword && Boolean(parsed.autoLogin)
    };
  } catch {
    return defaults;
  }
}

function writeStationThreePreferences({ username, password, rememberPassword, autoLogin } = {}) {
  const filePath = getStationThreePreferencesPath();
  const resolvedRemember = Boolean(rememberPassword);
  const payload = {
    username: resolvedRemember ? String(username || "").trim() : "",
    password: resolvedRemember ? encodeStationTwoSecret(password) : null,
    rememberPassword: resolvedRemember,
    autoLogin: resolvedRemember && Boolean(autoLogin)
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

  return {
    username: payload.username,
    password: resolvedRemember ? String(password || "") : "",
    rememberPassword: payload.rememberPassword,
    autoLogin: payload.autoLogin
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildDashboardRequestBody({ page, limit } = {}) {
  return JSON.stringify({
    range: DASHBOARD_RANGE,
    consumption_page: normalizePositiveInt(page, DEFAULT_CONSUMPTION_PAGE),
    consumption_limit: normalizePositiveInt(limit, DEFAULT_CONSUMPTION_LIMIT)
  });
}

function isRetryableNetworkError(error) {
  const code = String(error && error.code ? error.code : "").toUpperCase();
  const message = error && error.message ? error.message : "";

  return RETRYABLE_ERROR_CODES.has(code)
    || /ECONNRESET|socket hang up|ERR_CONNECTION_RESET|timed out/i.test(message);
}

function formatErrorDetail(bodyText) {
  const text = String(bodyText || "").trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.message === "string") return parsed.message;
    if (parsed && parsed.error && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
  } catch {
    return text;
  }

  return text;
}

function toUserFacingError(error) {
  const message = error && error.message ? error.message : "请求失败";
  const code = error && error.code ? ` (${error.code})` : "";

  if (isRetryableNetworkError(error)) {
    return new Error(`网络连接被远端重置或中断${code}，请检查当前网络、代理或 VPN 设置后重试`);
  }

  if (/^HTTP 401\b|^HTTP 403\b/i.test(message)) {
    return new Error("认证失败，请检查 API Key 是否正确或是否仍然有效");
  }

  if (/响应解析失败/.test(message)) {
    return new Error("服务端返回了无法解析的数据，请稍后重试");
  }

  return new Error(message);
}

function requestDashboardOnce(authorization, options = {}, attempt = 1) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let responseData = "";
    let timeoutId = null;
    const requestBody = buildDashboardRequestBody(options);

    const clearRequestTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      clearRequestTimeout();
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      clearRequestTimeout();
      reject(error);
    };

    const request = net.request({
      method: "POST",
      url: DASHBOARD_URL,
      redirect: "follow"
    });

    request.setHeader("Content-Type", "application/json");
    request.setHeader("Accept", "application/json");
    request.setHeader("Accept-Encoding", "identity");
    request.setHeader("Authorization", authorization);
    request.setHeader("Origin", "https://cto.hxrra.com");
    request.setHeader("Referer", "https://cto.hxrra.com/user/center");
    request.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Electron");

    request.on("response", (response) => {
      response.on("data", (chunk) => {
        responseData += chunk.toString();
      });

      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            finishResolve(JSON.parse(responseData));
          } catch {
            finishReject(new Error("响应解析失败"));
          }
          return;
        }

        const detail = formatErrorDetail(responseData);
        const suffix = detail ? `: ${detail}` : "";
        finishReject(new Error(`HTTP ${response.statusCode}${suffix}`));
      });
    });

    request.on("error", (error) => finishReject(error));

    timeoutId = setTimeout(() => {
      const timeoutError = new Error("请求超时");
      timeoutError.code = "ETIMEDOUT";
      finishReject(timeoutError);
      request.abort();
    }, 15000);

    request.write(requestBody);
    request.end();
  });
}

async function fetchDashboardWithRetry(authorization, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestDashboardOnce(authorization, options, attempt);
    } catch (error) {
      lastError = error;

      if (attempt < 3 && isRetryableNetworkError(error)) {
        await sleep(attempt * 500);
        continue;
      }

      throw toUserFacingError(error);
    }
  }

  throw toUserFacingError(lastError);
}

function normalizeStationTwoProxy(proxyUrl) {
  if (typeof proxyUrl !== "string") {
    return stationTwoState.proxyUrl || STATION_TWO_DEFAULT_PROXY;
  }

  const trimmed = proxyUrl.trim();
  return trimmed || "";
}

function getStationTwoSessionPartition() {
  return session.fromPartition(STATION_TWO_SESSION_PARTITION, { cache: true });
}

function getStationThreeSessionPartition() {
  return session.fromPartition(STATION_THREE_SESSION_PARTITION, { cache: true });
}

async function clearStationThreeSessionStorage() {
  const targetSession = getStationThreeSessionPartition();

  try {
    await targetSession.clearStorageData({
      storages: ["cookies"]
    });
  } catch {
    // Ignore cookie cleanup failures and continue with credential reset.
  }

  try {
    await targetSession.clearAuthCache();
  } catch {
    // Ignore auth cache cleanup failures.
  }

  try {
    await targetSession.closeAllConnections();
  } catch {
    // Ignore stale pooled connections after clearing cookies.
  }
}

async function ensureStationTwoProxy(proxyUrl) {
  const normalizedProxy = normalizeStationTwoProxy(proxyUrl);
  const targetSession = getStationTwoSessionPartition();

  if (stationTwoProxyConfigured === normalizedProxy) {
    return targetSession;
  }

  if (normalizedProxy) {
    await targetSession.setProxy({
      proxyRules: normalizedProxy
    });
  } else {
    await targetSession.setProxy({
      mode: "direct"
    });
  }

  stationTwoProxyConfigured = normalizedProxy;

  try {
    await targetSession.closeAllConnections();
  } catch {
    // Ignore stale pooled connections after proxy changes.
  }

  return targetSession;
}

function buildStationTwoAuthRequiredError(message = "站点二登录已失效，请重新登录") {
  const error = new Error(message);
  error.code = "STATION_TWO_AUTH_REQUIRED";
  return error;
}

function clearStationTwoTokens({ clearPassword = false } = {}) {
  stationTwoState.accessToken = "";
  stationTwoState.refreshToken = "";
  stationTwoState.expiresAt = 0;
  if (clearPassword) {
    stationTwoState.password = "";
  }
}

function clearStationTwoSession({ clearCredentials = false } = {}) {
  clearStationTwoTokens({
    clearPassword: clearCredentials
  });
  stationTwoState.refreshSupported = null;
  stationTwoUsageApiKeysCache = {
    dateKey: "",
    items: [],
    records: []
  };
  stationTwoKeysCache = {
    cacheKey: "",
    items: []
  };
  if (clearCredentials) {
    stationTwoState.email = "";
    stationTwoState.proxyUrl = STATION_TWO_DEFAULT_PROXY;
  }
}

function buildStationThreeAuthRequiredError(message = "998Code 登录已失效，请重新登录") {
  const error = new Error(message);
  error.code = "STATION_THREE_AUTH_REQUIRED";
  return error;
}

function setStationThreeCredentials({
  username,
  password,
  userId,
  sessionCookie,
  accessToken,
  displayName,
  group,
  quotaPerUnit
} = {}) {
  if (typeof username === "string" && username.trim()) {
    stationThreeState.username = username.trim();
  }

  if (typeof password === "string" && password) {
    stationThreeState.password = password;
  }

  if (typeof userId === "string" || typeof userId === "number") {
    stationThreeState.userId = String(userId || "").trim();
  }

  if (typeof sessionCookie === "string") {
    stationThreeState.sessionCookie = sessionCookie.trim();
  }

  if (typeof accessToken === "string") {
    stationThreeState.accessToken = accessToken.trim();
  }

  if (typeof displayName === "string" && displayName.trim()) {
    stationThreeState.displayName = displayName.trim();
  }

  if (typeof group === "string" && group.trim()) {
    stationThreeState.group = group.trim();
  }

  const numericQuotaPerUnit = Number(quotaPerUnit);
  if (Number.isFinite(numericQuotaPerUnit) && numericQuotaPerUnit > 0) {
    stationThreeState.quotaPerUnit = numericQuotaPerUnit;
  }
}

function clearStationThreeSession({ clearCredentials = false } = {}) {
  stationThreeState.userId = "";
  stationThreeState.sessionCookie = "";
  stationThreeState.accessToken = "";
  stationThreeState.displayName = "";
  stationThreeState.group = "";
  stationThreeState.quotaPerUnit = STATION_THREE_DEFAULT_QUOTA_PER_UNIT;

  if (clearCredentials) {
    stationThreeState.username = "";
    stationThreeState.password = "";
  }
}

function getStationTwoTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getDateStringInTimeZone(date = new Date(), timeZone = "UTC") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

function getLocalDayBoundsUnix(date = new Date()) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const start = Math.floor(startDate.getTime() / 1000);
  return {
    start,
    end: start + 86400
  };
}

function normalizeUnixSeconds(value) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e9) return Math.floor(value);
    return 0;
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  if (/^\d+$/.test(raw)) {
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric > 1e12) return Math.floor(numeric / 1000);
    if (numeric > 1e9) return Math.floor(numeric);
    return 0;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) {
    return Math.floor(parsed / 1000);
  }

  const fallbackParsed = Date.parse(raw.replace(/-/g, "/"));
  return Number.isFinite(fallbackParsed) ? Math.floor(fallbackParsed / 1000) : 0;
}

function normalizeQuotaPerUnit(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : STATION_THREE_DEFAULT_QUOTA_PER_UNIT;
}

function quotaToUsd(quota, quotaPerUnit = STATION_THREE_DEFAULT_QUOTA_PER_UNIT) {
  const numericQuota = Number(quota);
  const numericQuotaPerUnit = normalizeQuotaPerUnit(quotaPerUnit);

  if (!Number.isFinite(numericQuota)) {
    return null;
  }

  return numericQuota / numericQuotaPerUnit;
}

function setStationTwoCredentials({ email, password, proxyUrl } = {}) {
  if (typeof email === "string" && email.trim()) {
    stationTwoState.email = email.trim();
  }

  if (typeof password === "string" && password) {
    stationTwoState.password = password;
  }

  if (proxyUrl !== undefined) {
    stationTwoState.proxyUrl = normalizeStationTwoProxy(proxyUrl);
  }
}

function applyStationTwoTokenPayload(payload = {}) {
  stationTwoState.accessToken = String(payload.access_token || "").trim();
  stationTwoState.refreshToken = String(payload.refresh_token || stationTwoState.refreshToken || "").trim();

  const expiresIn = Number.parseInt(String(payload.expires_in || 0), 10);
  stationTwoState.expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? Date.now() + expiresIn * 1000
    : 0;
}

function hasValidStationTwoAccessToken() {
  return Boolean(
    stationTwoState.accessToken
    && stationTwoState.expiresAt
    && Date.now() < stationTwoState.expiresAt - TOKEN_REFRESH_BUFFER_MS
  );
}

function normalizeStationTwoItems(items) {
  const list = Array.isArray(items) ? items : [];

  return list.map((item) => {
    const group = item && item.group ? item.group : {};
    const monthlyLimitUsd = Number.isFinite(Number(group.monthly_limit_usd)) ? Number(group.monthly_limit_usd) : null;
    const monthlyUsageUsd = Number.isFinite(Number(item.monthly_usage_usd)) ? Number(item.monthly_usage_usd) : null;
    const dailyUsageUsd = Number.isFinite(Number(item.daily_usage_usd)) ? Number(item.daily_usage_usd) : null;
    const remainingUsd = monthlyLimitUsd !== null && monthlyUsageUsd !== null
      ? Math.max(0, monthlyLimitUsd - monthlyUsageUsd)
      : null;

    return {
      id: item.id ?? null,
      name: String(group.name || "").trim() || "未命名套餐",
      monthlyLimitUsd,
      dailyUsageUsd,
      monthlyUsageUsd,
      remainingUsd,
      status: String(item.status || "").trim(),
      expiresAt: item.expires_at || null
    };
  });
}

function summarizeStationTwoItems(items) {
  const normalizedItems = normalizeStationTwoItems(items);
  const totals = normalizedItems.reduce((acc, item) => {
    acc.monthlyLimitUsd += item.monthlyLimitUsd ?? 0;
    acc.dailyUsageUsd += item.dailyUsageUsd ?? 0;
    acc.remainingUsd += item.remainingUsd ?? 0;
    return acc;
  }, {
    monthlyLimitUsd: 0,
    dailyUsageUsd: 0,
    remainingUsd: 0
  });

  return {
    title: normalizedItems.length === 1 ? normalizedItems[0].name : `活跃套餐 ${normalizedItems.length}`,
    items: normalizedItems,
    monthlyLimitUsd: normalizedItems.length ? totals.monthlyLimitUsd : null,
    dailyUsageUsd: normalizedItems.length ? totals.dailyUsageUsd : null,
    remainingUsd: normalizedItems.length ? totals.remainingUsd : null
  };
}

function normalizeStationTwoModelDistribution(items) {
  const list = Array.isArray(items)
    ? items
    : items && typeof items === "object"
      ? Object.entries(items).map(([model, value]) => {
        if (value && typeof value === "object") {
          return {
            ...value,
            model: value.model ?? model
          };
        }
        return {
          model,
          requests: value
        };
      })
      : [];
  const modelMap = new Map();

  for (const item of list) {
    const model = String(item?.model ?? item?.model_name ?? item?.name ?? "").trim() || "—";
    const requests = Math.max(
      0,
      Number.isFinite(Number(item?.requests))
        ? Number(item.requests)
        : Number.isFinite(Number(item?.request_count))
          ? Number(item.request_count)
          : Number.isFinite(Number(item?.total_requests))
            ? Number(item.total_requests)
            : 0
    );
    const rawCost = [item?.actual_cost, item?.total_actual_cost, item?.cost, item?.total_cost]
      .find((value) => Number.isFinite(Number(value)));
    const cost = Number.isFinite(Number(rawCost)) ? Number(rawCost) : 0;
    const current = modelMap.get(model) || {
      model,
      requests: 0,
      cost: 0
    };

    current.requests += requests;
    current.cost += cost;
    modelMap.set(model, current);
  }

  return Array.from(modelMap.values())
    .sort((left, right) => {
      if (right.requests !== left.requests) return right.requests - left.requests;
      if (right.cost !== left.cost) return right.cost - left.cost;
      return left.model.localeCompare(right.model, "zh-CN");
    });
}

function normalizeStationTwoUsageRecord(item) {
  return {
    id: item?.id ?? null,
    createdAt: item?.created_at || null,
    apiKeyId: item?.api_key_id ?? item?.api_key?.id ?? null,
    apiKeyName: String(item?.api_key?.name || "").trim() || "未命名密钥",
    model: String(item?.model || "").trim() || "—",
    reasoningEffort: String(item?.reasoning_effort || "").trim() || "—",
    totalCost: item?.total_cost ?? null
  };
}

function buildStationTwoModelDistributionFromUsageRecords(records) {
  const modelMap = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const model = String(record?.model || "").trim() || "—";
    const cost = Number(record?.totalCost);
    const current = modelMap.get(model) || {
      model,
      requests: 0,
      cost: 0
    };

    current.requests += 1;
    if (Number.isFinite(cost)) {
      current.cost += cost;
    }
    modelMap.set(model, current);
  }

  return Array.from(modelMap.values())
    .sort((left, right) => {
      if (right.requests !== left.requests) return right.requests - left.requests;
      if (right.cost !== left.cost) return right.cost - left.cost;
      return left.model.localeCompare(right.model, "zh-CN");
    });
}

function normalizeStationTwoApiKeyItem(item) {
  const rawId = item?.apiKeyId
    ?? item?.api_key_id
    ?? item?.api_key?.id
    ?? item?.id
    ?? null;
  const id = rawId !== null && rawId !== undefined ? String(rawId).trim() : "";
  if (!id) return null;

  return {
    id,
    name: String(item?.name || item?.api_key?.name || item?.apiKeyName || "").trim() || `API Key ${id}`
  };
}

function buildStationTwoUsageApiKeys(records) {
  const map = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const normalized = normalizeStationTwoApiKeyItem(record);
    if (!normalized) continue;
    const key = normalized.id;
    if (map.has(key)) continue;

    map.set(key, normalized);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function buildStationTwoUsageQuery({
  date,
  timeZone,
  page,
  pageSize,
  apiKeyId,
  includePage = true
} = {}) {
  const params = [
    `start_date=${encodeURIComponent(date)}`,
    `end_date=${encodeURIComponent(date)}`,
    `timezone=${encodeURIComponent(timeZone)}`
  ];
  const normalizedApiKeyId = String(apiKeyId || "").trim();

  if (includePage) {
    params.unshift(`page_size=${normalizePositiveInt(pageSize, STATION_TWO_USAGE_PAGE_SIZE)}`);
    params.unshift(`page=${normalizePositiveInt(page, 1)}`);
  }

  if (normalizedApiKeyId) {
    params.push(`api_key_id=${encodeURIComponent(normalizedApiKeyId)}`);
  }

  return params.join("&");
}

function buildStationTwoSessionSnapshot() {
  return {
    strategy: stationTwoState.refreshSupported === false ? "relogin" : "refresh",
    expiresAt: stationTwoState.expiresAt || null,
    proxyUrl: stationTwoState.proxyUrl || "",
    email: stationTwoState.email || ""
  };
}

function getDefaultStationTwoUsagePagination({ page = 1, pageSize = STATION_TWO_USAGE_PAGE_SIZE } = {}) {
  return {
    total: 0,
    page: normalizePositiveInt(page, 1),
    pageSize: normalizePositiveInt(pageSize, STATION_TWO_USAGE_PAGE_SIZE),
    totalPages: 1
  };
}

function normalizeStationThreePlans(items) {
  const plans = Array.isArray(items) ? items : [];
  const planMap = new Map();

  for (const item of plans) {
    const plan = item?.plan || item;
    const id = Number(plan?.id);
    if (!Number.isFinite(id)) continue;
    planMap.set(id, plan);
  }

  return planMap;
}

function normalizeStationThreeSubscriptions(items, plansById, quotaPerUnit) {
  const subscriptions = Array.isArray(items) ? items : [];

  return subscriptions.map((item) => {
    const subscription = item?.subscription || item || {};
    const planId = Number(subscription?.plan_id);
    const plan = Number.isFinite(planId) ? plansById.get(planId) : null;
    const totalQuota = Number(subscription?.amount_total);
    const usedQuota = Number(subscription?.amount_used);
    const remainingQuota = Number.isFinite(totalQuota) && Number.isFinite(usedQuota)
      ? Math.max(0, totalQuota - usedQuota)
      : null;

    return {
      id: subscription?.id ?? null,
      planId: Number.isFinite(planId) ? planId : null,
      title: String(plan?.title || "").trim() || (Number.isFinite(planId) ? `套餐 #${planId}` : "未命名订阅"),
      subtitle: String(plan?.subtitle || "").trim() || "",
      status: String(subscription?.status || "").trim() || "unknown",
      source: String(subscription?.source || "").trim() || "—",
      startAt: subscription?.start_time ?? null,
      endAt: subscription?.end_time ?? null,
      nextResetAt: subscription?.next_reset_time ?? null,
      totalUsd: quotaToUsd(totalQuota, quotaPerUnit),
      usedUsd: quotaToUsd(usedQuota, quotaPerUnit),
      remainingUsd: quotaToUsd(remainingQuota, quotaPerUnit),
      totalQuota: Number.isFinite(totalQuota) ? totalQuota : null,
      usedQuota: Number.isFinite(usedQuota) ? usedQuota : null,
      remainingQuota: Number.isFinite(remainingQuota) ? remainingQuota : null,
      priceAmount: Number(plan?.price_amount),
      currency: String(plan?.currency || "").trim() || "USD",
      durationUnit: String(plan?.duration_unit || "").trim() || "",
      durationValue: Number(plan?.duration_value),
      quotaResetPeriod: String(plan?.quota_reset_period || "").trim() || ""
    };
  });
}

function summarizeStationThreeUser(user, quotaPerUnit) {
  const normalizedUser = user && typeof user === "object" ? user : {};

  return {
    username: String(normalizedUser.username || "").trim() || stationThreeState.username || "未登录",
    displayName: String(normalizedUser.display_name || "").trim() || String(normalizedUser.username || "").trim() || "未登录",
    group: String(normalizedUser.group || "").trim() || "—",
    balanceUsd: quotaToUsd(normalizedUser.quota, quotaPerUnit),
    usedUsd: quotaToUsd(normalizedUser.used_quota, quotaPerUnit),
    requestCount: Number.isFinite(Number(normalizedUser.request_count)) ? Number(normalizedUser.request_count) : 0
  };
}

function parseStationThreeOtherPayload(other) {
  if (!other || typeof other !== "string") return null;
  const raw = other.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeStationThreeLogType(rawType, quota) {
  const numericType = Number(rawType);
  if (numericType === 5) {
    return {
      typeCode: 5,
      typeKey: "error",
      typeLabel: "错误"
    };
  }

  if (numericType === 2 || Number(quota) > 0) {
    return {
      typeCode: Number.isFinite(numericType) ? numericType : 2,
      typeKey: "consume",
      typeLabel: "消费"
    };
  }

  return {
    typeCode: Number.isFinite(numericType) ? numericType : null,
    typeKey: "other",
    typeLabel: "其他"
  };
}

function buildStationThreeLogDetail(item, parsedOther) {
  const content = String(item?.content || "").trim();
  if (content) return content;

  const detailSegments = [];
  const requestPath = String(parsedOther?.request_path || "").trim();
  const errorType = String(parsedOther?.error_type || "").trim();
  const errorCode = String(parsedOther?.error_code || "").trim();
  const statusCode = Number(parsedOther?.status_code);
  const reasoningEffort = String(parsedOther?.reasoning_effort || "").trim();

  if (requestPath) detailSegments.push(`接口 ${requestPath}`);
  if (reasoningEffort) detailSegments.push(`推理 ${reasoningEffort}`);
  if (errorType || errorCode) {
    detailSegments.push([errorType, errorCode].filter(Boolean).join("/"));
  }
  if (Number.isFinite(statusCode) && statusCode > 0) {
    detailSegments.push(`状态 ${statusCode}`);
  }

  const requestId = String(item?.request_id || "").trim();
  if (!detailSegments.length && requestId) {
    return `request_id=${requestId}`;
  }

  return detailSegments.join(" · ");
}

function normalizeStationThreeLogRecord(item, quotaPerUnit) {
  const createdAtUnix = normalizeUnixSeconds(item?.created_at ?? item?.createdAt ?? item?.created_at_unix);
  if (!Number.isFinite(createdAtUnix) || createdAtUnix <= 0) {
    return null;
  }

  const quota = Number(item?.quota);
  const typeInfo = normalizeStationThreeLogType(item?.type, quota);
  const parsedOther = parseStationThreeOtherPayload(item?.other);
  const detail = buildStationThreeLogDetail(item, parsedOther);
  const costUsd = typeInfo.typeKey === "consume" && Number.isFinite(quota)
    ? quotaToUsd(quota, quotaPerUnit)
    : null;

  return {
    id: item?.id ?? null,
    createdAt: createdAtUnix * 1000,
    createdAtUnix,
    tokenName: String(item?.token_name || "").trim() || "未命名令牌",
    typeCode: typeInfo.typeCode,
    typeKey: typeInfo.typeKey,
    typeLabel: typeInfo.typeLabel,
    model: String(item?.model_name || "").trim() || "—",
    costUsd,
    detail,
    requestId: String(item?.request_id || "").trim() || ""
  };
}

function unwrapStationTwoPayload(bodyText) {
  let parsed;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error("响应解析失败");
  }

  if (parsed && typeof parsed === "object" && parsed.code === 0) {
    return parsed.data;
  }

  const detail = parsed && typeof parsed.message === "string"
    ? parsed.message
    : formatErrorDetail(bodyText);

  throw new Error(detail || "站点二接口返回异常");
}

function toStationTwoUserFacingError(error) {
  const message = error && error.message ? error.message : "站点二请求失败";
  const statusCode = error && error.statusCode ? Number(error.statusCode) : 0;
  const code = error && error.code ? String(error.code) : "";

  if (isRetryableNetworkError(error)) {
    return new Error("站点二网络请求失败，请检查代理、VPN 或本地网络设置");
  }

  if (code === "STATION_TWO_AUTH_REQUIRED") {
    return buildStationTwoAuthRequiredError(message);
  }

  if (statusCode === 401 || statusCode === 403 || /^HTTP 401\b|^HTTP 403\b/i.test(message)) {
    return buildStationTwoAuthRequiredError();
  }

  if (statusCode === 404 || /^HTTP 404\b/i.test(message)) {
    return new Error("站点二当前部署缺少所需接口，请确认服务端版本是否兼容");
  }

  if (/响应解析失败/.test(message)) {
    return new Error("站点二返回了无法解析的数据，请稍后重试");
  }

  return new Error(message);
}

function requestStationThree(url, { method = "GET", headers = {}, body = "" } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let responseData = "";
    let timeoutId = null;
    let request;

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      reject(error);
    };

    try {
      request = net.request({
        method,
        url,
        redirect: "follow",
        session: getStationThreeSessionPartition()
      });

      request.setHeader("Accept", "application/json, text/plain, */*");
      request.setHeader("Accept-Encoding", "identity");
      request.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Electron");

      Object.entries(headers).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        request.setHeader(key, value);
      });

      request.on("response", (response) => {
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        response.on("end", () => {
          const setCookieHeader = response?.headers?.["set-cookie"];
          const setCookieItems = Array.isArray(setCookieHeader)
            ? setCookieHeader
            : setCookieHeader
              ? [setCookieHeader]
              : [];
          const sessionCookie = setCookieItems
            .map((item) => String(item || "").split(";")[0].trim())
            .find((item) => /^session=/i.test(item));

          if (sessionCookie) {
            stationThreeState.sessionCookie = sessionCookie;
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            finishResolve({
              statusCode: response.statusCode,
              bodyText: responseData,
              headers: response.headers
            });
            return;
          }

          const detail = formatErrorDetail(responseData);
          const suffix = detail ? `: ${detail}` : "";
          const error = new Error(`HTTP ${response.statusCode}${suffix}`);
          error.statusCode = response.statusCode;
          finishReject(error);
        });
      });

      request.on("error", (error) => {
        finishReject(error);
      });

      timeoutId = setTimeout(() => {
        const timeoutError = new Error("请求超时");
        timeoutError.code = "ETIMEDOUT";
        finishReject(timeoutError);
        request.abort();
      }, STATION_THREE_TIMEOUT_MS);

      if (body) {
        request.write(body);
      }

      request.end();
    } catch (error) {
      finishReject(error);
    }
  });
}

function unwrapStationThreePayload(bodyText) {
  let parsed;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error("响应解析失败");
  }

  if (parsed && typeof parsed === "object" && parsed.success === true) {
    return parsed.data;
  }

  const detail = parsed && typeof parsed.message === "string"
    ? parsed.message
    : formatErrorDetail(bodyText);

  throw new Error(detail || "998Code 接口返回异常");
}

function toStationThreeUserFacingError(error) {
  const message = error && error.message ? error.message : "998Code 请求失败";
  const statusCode = error && error.statusCode ? Number(error.statusCode) : 0;
  const code = error && error.code ? String(error.code) : "";

  if (isRetryableNetworkError(error)) {
    return new Error("998Code 网络请求失败，请检查当前网络后重试");
  }

  if (code === "STATION_THREE_AUTH_REQUIRED") {
    return buildStationThreeAuthRequiredError(message);
  }

  if (statusCode === 401 || statusCode === 403 || /^HTTP 401\b|^HTTP 403\b/i.test(message)) {
    return buildStationThreeAuthRequiredError();
  }

  if (statusCode === 404 || /^HTTP 404\b/i.test(message)) {
    return new Error("998Code 当前部署缺少所需接口，请确认站点版本是否兼容");
  }

  if (/响应解析失败/.test(message)) {
    return new Error("998Code 返回了无法解析的数据，请稍后重试");
  }

  return new Error(message);
}

function isStationThreeAuthError(error) {
  const statusCode = Number(error && error.statusCode ? error.statusCode : 0);
  const message = error && error.message ? String(error.message) : "";
  return statusCode === 401 || statusCode === 403 || /^HTTP 401\b|^HTTP 403\b/i.test(message);
}

function requestStationTwo(url, { method = "GET", headers = {}, body = "", proxyUrl = stationTwoState.proxyUrl } = {}) {
  return new Promise(async (resolve, reject) => {
    let settled = false;
    let responseData = "";
    let timeoutId = null;
    let request;

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      reject(error);
    };

    try {
      const targetSession = await ensureStationTwoProxy(proxyUrl);
      request = net.request({
        method,
        url,
        redirect: "follow",
        session: targetSession
      });

      request.setHeader("Accept", "application/json, text/plain, */*");
      request.setHeader("Accept-Encoding", "identity");
      request.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Electron");

      Object.entries(headers).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        request.setHeader(key, value);
      });

      request.on("response", (response) => {
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            finishResolve({
              statusCode: response.statusCode,
              bodyText: responseData
            });
            return;
          }

          const detail = formatErrorDetail(responseData);
          const suffix = detail ? `: ${detail}` : "";
          const error = new Error(`HTTP ${response.statusCode}${suffix}`);
          error.statusCode = response.statusCode;
          finishReject(error);
        });
      });

      request.on("error", (error) => {
        finishReject(error);
      });

      timeoutId = setTimeout(() => {
        const timeoutError = new Error("请求超时");
        timeoutError.code = "ETIMEDOUT";
        finishReject(timeoutError);
        request.abort();
      }, STATION_TWO_TIMEOUT_MS);

      if (body) {
        request.write(body);
      }

      request.end();
    } catch (error) {
      finishReject(error);
    }
  });
}

async function loginStationTwo({ email, password, proxyUrl } = {}) {
  const resolvedEmail = typeof email === "string" && email.trim() ? email.trim() : stationTwoState.email;
  const resolvedPassword = typeof password === "string" && password ? password : stationTwoState.password;

  if (!resolvedEmail || !resolvedPassword) {
    throw new Error("请输入站点二邮箱和密码");
  }

  const requestBody = JSON.stringify({
    email: resolvedEmail,
    password: resolvedPassword
  });

  const { bodyText } = await requestStationTwo(STATION_TWO_LOGIN_URL, {
    method: "POST",
    proxyUrl,
    headers: {
      "Content-Type": "application/json",
      Origin: STATION_TWO_BASE_URL,
      Referer: `${STATION_TWO_BASE_URL}/login`
    },
    body: requestBody
  });

  const payload = unwrapStationTwoPayload(bodyText);
  setStationTwoCredentials({
    email: resolvedEmail,
    password: resolvedPassword,
    proxyUrl
  });
  applyStationTwoTokenPayload(payload);

  return payload;
}

async function refreshStationTwoToken(proxyUrl = stationTwoState.proxyUrl) {
  if (!stationTwoState.refreshToken) {
    throw new Error("No refresh token available");
  }

  const requestBody = JSON.stringify({
    refresh_token: stationTwoState.refreshToken
  });

  const { bodyText } = await requestStationTwo(STATION_TWO_REFRESH_URL, {
    method: "POST",
    proxyUrl,
    headers: {
      "Content-Type": "application/json",
      Origin: STATION_TWO_BASE_URL,
      Referer: `${STATION_TWO_BASE_URL}/login`
    },
    body: requestBody
  });

  const payload = unwrapStationTwoPayload(bodyText);
  applyStationTwoTokenPayload(payload);
  stationTwoState.refreshSupported = true;

  return payload;
}

async function ensureStationTwoSession({ email, password, proxyUrl, allowLogin = false } = {}) {
  setStationTwoCredentials({ email, password, proxyUrl });

  if (hasValidStationTwoAccessToken()) {
    return stationTwoState.accessToken;
  }

  if (stationTwoState.refreshToken && stationTwoState.refreshSupported !== false) {
    try {
      await refreshStationTwoToken(stationTwoState.proxyUrl);
      return stationTwoState.accessToken;
    } catch (error) {
      if (Number(error.statusCode) === 404) {
        stationTwoState.refreshSupported = false;
        clearStationTwoTokens();
      } else if (Number(error.statusCode) === 401 || Number(error.statusCode) === 403) {
        clearStationTwoTokens();
      } else {
        throw error;
      }
    }
  }

  if (!allowLogin) {
    clearStationTwoTokens();
    throw buildStationTwoAuthRequiredError();
  }

  await loginStationTwo({
    email: stationTwoState.email,
    password: stationTwoState.password,
    proxyUrl: stationTwoState.proxyUrl
  });

  return stationTwoState.accessToken;
}

async function fetchStationTwoModelDistribution(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const query = `start_date=${encodeURIComponent(today)}&end_date=${encodeURIComponent(today)}&timezone=${encodeURIComponent(timezone)}`;
  const { bodyText } = await requestStationTwo(`${STATION_TWO_MODELS_URL}?${query}`, {
    method: "GET",
    proxyUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Referer: `${STATION_TWO_BASE_URL}/dashboard`
    }
  });
  const payload = unwrapStationTwoPayload(bodyText);
  const modelItems = Array.isArray(payload?.models)
    ? payload.models
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : payload?.models && typeof payload.models === "object"
          ? payload.models
          : [];

  return normalizeStationTwoModelDistribution(modelItems);
}

async function fetchStationTwoUsageStats(accessToken, {
  proxyUrl = stationTwoState.proxyUrl,
  apiKeyId = ""
} = {}) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const query = buildStationTwoUsageQuery({
    date: today,
    timeZone: timezone,
    apiKeyId,
    includePage: false
  });
  const { bodyText } = await requestStationTwo(`${STATION_TWO_USAGE_STATS_URL}?${query}`, {
    method: "GET",
    proxyUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Referer: `${STATION_TWO_BASE_URL}/usage`
    }
  });
  const payload = unwrapStationTwoPayload(bodyText);

  return {
    totalRequests: normalizeNonNegativeInt(payload?.total_requests, 0)
  };
}

async function fetchStationTwoUsagePage(accessToken, {
  proxyUrl = stationTwoState.proxyUrl,
  page = 1,
  pageSize = STATION_TWO_USAGE_PAGE_SIZE,
  apiKeyId = ""
} = {}) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const resolvedPage = normalizePositiveInt(page, 1);
  const resolvedPageSize = normalizePositiveInt(pageSize, STATION_TWO_USAGE_PAGE_SIZE);
  const query = buildStationTwoUsageQuery({
    date: today,
    timeZone: timezone,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    apiKeyId
  });
  const [usageResult, statsResult] = await Promise.allSettled([
    requestStationTwo(`${STATION_TWO_USAGE_URL}?${query}`, {
      method: "GET",
      proxyUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Referer: `${STATION_TWO_BASE_URL}/usage`
      }
    }),
    fetchStationTwoUsageStats(accessToken, {
      proxyUrl,
      apiKeyId
    })
  ]);
  if (usageResult.status !== "fulfilled") {
    throw usageResult.reason;
  }

  const { bodyText } = usageResult.value;
  const payload = unwrapStationTwoPayload(bodyText);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const records = items.map(normalizeStationTwoUsageRecord).sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return right - left;
  });
  const totalFromPayload = normalizeNonNegativeInt(payload?.total, records.length);
  const totalFromStats = statsResult.status === "fulfilled"
    ? normalizeNonNegativeInt(statsResult.value?.totalRequests, totalFromPayload)
    : totalFromPayload;
  const total = Math.max(totalFromStats, totalFromPayload);
  const resolvedPayloadPage = normalizePositiveInt(payload?.page, resolvedPage);
  const resolvedPayloadPageSize = normalizePositiveInt(payload?.page_size, resolvedPageSize);
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / resolvedPayloadPageSize)) : 1;

  return {
    records,
    pagination: {
      total,
      page: resolvedPayloadPage,
      pageSize: resolvedPayloadPageSize,
      totalPages
    }
  };
}

async function fetchStationTwoUsageRecordsForToday(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const cacheKey = `${today}::${timezone}`;

  if (stationTwoUsageApiKeysCache.dateKey === cacheKey && Array.isArray(stationTwoUsageApiKeysCache.records)) {
    return stationTwoUsageApiKeysCache.records;
  }

  const pageSize = 100;
  const records = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const query = buildStationTwoUsageQuery({
      date: today,
      timeZone: timezone,
      page,
      pageSize
    });

    const { bodyText } = await requestStationTwo(`${STATION_TWO_USAGE_URL}?${query}`, {
      method: "GET",
      proxyUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Referer: `${STATION_TWO_BASE_URL}/usage`
      }
    });

    const payload = unwrapStationTwoPayload(bodyText);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    records.push(...items.map(normalizeStationTwoUsageRecord));
    const payloadPageSize = normalizePositiveInt(payload?.page_size, pageSize);
    const payloadTotal = normalizeNonNegativeInt(payload?.total, records.length);
    const payloadPages = normalizePositiveInt(payload?.pages, 0);
    totalPages = payloadPages > 0
      ? payloadPages
      : Math.max(1, Math.ceil(Math.max(payloadTotal, records.length) / payloadPageSize));
    page += 1;
  }

  const sortedRecords = records.sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
  const apiKeys = buildStationTwoUsageApiKeys(sortedRecords);
  stationTwoUsageApiKeysCache = {
    dateKey: cacheKey,
    items: apiKeys,
    records: sortedRecords
  };

  return sortedRecords;
}

async function fetchStationTwoUsageApiKeys(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const cacheKey = `${today}::${timezone}`;

  if (stationTwoUsageApiKeysCache.dateKey === cacheKey && Array.isArray(stationTwoUsageApiKeysCache.items)) {
    return stationTwoUsageApiKeysCache.items;
  }

  const records = await fetchStationTwoUsageRecordsForToday(accessToken, proxyUrl);
  const apiKeys = buildStationTwoUsageApiKeys(records);
  stationTwoUsageApiKeysCache = {
    dateKey: cacheKey,
    items: apiKeys,
    records
  };

  return apiKeys;
}

async function fetchStationTwoApiKeys(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const cacheKey = `${stationTwoState.email || ""}::${proxyUrl || ""}`;
  if (stationTwoKeysCache.cacheKey === cacheKey && Array.isArray(stationTwoKeysCache.items)) {
    return stationTwoKeysCache.items;
  }

  const pageSize = 100;
  const keyMap = new Map();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const query = `page=${normalizePositiveInt(page, 1)}&page_size=${normalizePositiveInt(pageSize, 100)}`;
    const { bodyText } = await requestStationTwo(`${STATION_TWO_KEYS_URL}?${query}`, {
      method: "GET",
      proxyUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Referer: `${STATION_TWO_BASE_URL}/keys`
      }
    });
    const payload = unwrapStationTwoPayload(bodyText);
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

    for (const item of items) {
      const normalized = normalizeStationTwoApiKeyItem(item);
      if (!normalized) continue;
      keyMap.set(normalized.id, normalized);
    }

    const payloadPageSize = normalizePositiveInt(payload?.page_size, pageSize);
    const payloadTotal = normalizeNonNegativeInt(payload?.total, keyMap.size);
    const payloadPages = normalizePositiveInt(payload?.pages, 0);
    totalPages = payloadPages > 0
      ? payloadPages
      : payloadTotal > 0
        ? Math.max(1, Math.ceil(payloadTotal / payloadPageSize))
        : page;
    page += 1;
  }

  const apiKeys = Array.from(keyMap.values())
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  stationTwoKeysCache = {
    cacheKey,
    items: apiKeys
  };

  return apiKeys;
}

async function fetchStationTwoModelDistributionFromUsage(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const records = await fetchStationTwoUsageRecordsForToday(accessToken, proxyUrl);
  return buildStationTwoModelDistributionFromUsageRecords(records);
}

async function fetchStationTwoUsageBundle(accessToken, {
  proxyUrl = stationTwoState.proxyUrl,
  page = 1,
  pageSize = STATION_TWO_USAGE_PAGE_SIZE,
  apiKeyId = ""
} = {}) {
  const usagePagePromise = fetchStationTwoUsagePage(accessToken, {
    proxyUrl,
    page,
    pageSize,
    apiKeyId
  });
  const apiKeysPromise = fetchStationTwoApiKeys(accessToken, proxyUrl).catch(async (error) => {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 401 || statusCode === 403) {
      throw error;
    }

    try {
      return await fetchStationTwoUsageApiKeys(accessToken, proxyUrl);
    } catch (fallbackError) {
      const fallbackStatusCode = Number(fallbackError?.statusCode || 0);
      if (fallbackStatusCode === 401 || fallbackStatusCode === 403) {
        throw fallbackError;
      }
      return [];
    }
  });
  const [usagePage, apiKeys] = await Promise.all([usagePagePromise, apiKeysPromise]);
  const usageApiKeys = buildStationTwoUsageApiKeys(usagePage.records);
  const mergedApiKeyMap = new Map();

  for (const item of [...apiKeys, ...usageApiKeys]) {
    const normalized = normalizeStationTwoApiKeyItem(item);
    if (!normalized) continue;
    if (!mergedApiKeyMap.has(normalized.id)) {
      mergedApiKeyMap.set(normalized.id, normalized);
    }
  }

  return {
    records: usagePage.records,
    apiKeys: Array.from(mergedApiKeyMap.values())
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    pagination: usagePage.pagination
  };
}

async function fetchStationTwoDashboard({
  email,
  password,
  proxyUrl,
  allowLogin = false,
  usagePage = 1,
  usagePageSize = STATION_TWO_USAGE_PAGE_SIZE,
  usageApiKeyId = ""
} = {}) {
  setStationTwoCredentials({ email, password, proxyUrl });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const accessToken = await ensureStationTwoSession({
        email: stationTwoState.email,
        password: stationTwoState.password,
        proxyUrl: stationTwoState.proxyUrl,
        allowLogin
      });
      const timezone = encodeURIComponent(getStationTwoTimezone());
      const { bodyText } = await requestStationTwo(`${STATION_TWO_ACTIVE_URL}?timezone=${timezone}`, {
        method: "GET",
        proxyUrl: stationTwoState.proxyUrl,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Referer: `${STATION_TWO_BASE_URL}/dashboard`
        }
      });
      const payload = unwrapStationTwoPayload(bodyText);
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      const summary = summarizeStationTwoItems(items);
      let modelDistribution = [];
      let usageRecords = [];
      let usageApiKeys = [];
      let usagePagination = getDefaultStationTwoUsagePagination({
        page: usagePage,
        pageSize: usagePageSize
      });

      try {
        const usage = await fetchStationTwoUsageBundle(accessToken, {
          proxyUrl: stationTwoState.proxyUrl,
          page: usagePage,
          pageSize: usagePageSize,
          apiKeyId: usageApiKeyId
        });
        usageRecords = usage.records;
        usageApiKeys = usage.apiKeys;
        usagePagination = usage.pagination;
      } catch (error) {
        const usageStatusCode = Number(error && error.statusCode ? error.statusCode : 0);
        if (usageStatusCode === 401 || usageStatusCode === 403) {
          throw error;
        }
      }

      try {
        modelDistribution = await fetchStationTwoModelDistribution(accessToken, stationTwoState.proxyUrl);
        if (modelDistribution.length <= 1) {
          const currentPageFallback = buildStationTwoModelDistributionFromUsageRecords(usageRecords);
          if (currentPageFallback.length > modelDistribution.length) {
            modelDistribution = currentPageFallback;
          } else {
            const totalUsageCount = normalizeNonNegativeInt(usagePagination?.total, usageRecords.length);
            if (totalUsageCount > usageRecords.length) {
              const fullUsageFallback = await fetchStationTwoModelDistributionFromUsage(accessToken, stationTwoState.proxyUrl);
              if (fullUsageFallback.length > modelDistribution.length) {
                modelDistribution = fullUsageFallback;
              }
            }
          }
        }
      } catch (error) {
        const modelStatusCode = Number(error && error.statusCode ? error.statusCode : 0);
        if (modelStatusCode === 401 || modelStatusCode === 403) {
          throw error;
        }
        if (usageRecords.length) {
          modelDistribution = buildStationTwoModelDistributionFromUsageRecords(usageRecords);
        }
      }

      return {
        summary,
        modelDistribution,
        usageRecords,
        usageApiKeys,
        usagePagination,
        session: buildStationTwoSessionSnapshot()
      };
    } catch (error) {
      const statusCode = Number(error && error.statusCode ? error.statusCode : 0);
      if ((statusCode === 401 || statusCode === 403) && attempt === 1) {
        clearStationTwoSession();
        if (allowLogin) {
          continue;
        }
        throw buildStationTwoAuthRequiredError();
      }

      throw toStationTwoUserFacingError(error);
    }
  }

  throw new Error("站点二请求失败");
}

async function fetchStationTwoUsage({
  email,
  password,
  proxyUrl,
  allowLogin = false,
  page = 1,
  pageSize = STATION_TWO_USAGE_PAGE_SIZE,
  apiKeyId = ""
} = {}) {
  setStationTwoCredentials({ email, password, proxyUrl });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const accessToken = await ensureStationTwoSession({
        email: stationTwoState.email,
        password: stationTwoState.password,
        proxyUrl: stationTwoState.proxyUrl,
        allowLogin
      });
      const usage = await fetchStationTwoUsageBundle(accessToken, {
        proxyUrl: stationTwoState.proxyUrl,
        page,
        pageSize,
        apiKeyId
      });

      return {
        usageRecords: usage.records,
        usageApiKeys: usage.apiKeys,
        usagePagination: usage.pagination,
        session: buildStationTwoSessionSnapshot()
      };
    } catch (error) {
      const statusCode = Number(error && error.statusCode ? error.statusCode : 0);
      if ((statusCode === 401 || statusCode === 403) && attempt === 1) {
        clearStationTwoSession();
        if (allowLogin) {
          continue;
        }
        throw buildStationTwoAuthRequiredError();
      }

      throw toStationTwoUserFacingError(error);
    }
  }

  throw new Error("站点二请求失败");
}

async function loginStationThree({ username, password } = {}) {
  const resolvedUsername = typeof username === "string" && username.trim() ? username.trim() : stationThreeState.username;
  const resolvedPassword = typeof password === "string" && password ? password : stationThreeState.password;

  if (!resolvedUsername || !resolvedPassword) {
    throw new Error("请输入 998Code 用户名和密码");
  }

  const requestBody = JSON.stringify({
    username: resolvedUsername,
    password: resolvedPassword
  });

  const { bodyText, headers } = await requestStationThree(STATION_THREE_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: STATION_THREE_BASE_URL,
      Referer: `${STATION_THREE_BASE_URL}/login`
    },
    body: requestBody
  });
  const payload = unwrapStationThreePayload(bodyText);
  const setCookieHeader = headers?.["set-cookie"];
  const setCookieItems = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const sessionCookie = setCookieItems
    .map((item) => String(item || "").split(";")[0].trim())
    .find((item) => /^session=/i.test(item));

  setStationThreeCredentials({
    username: resolvedUsername,
    password: resolvedPassword,
    userId: payload?.id,
    sessionCookie: sessionCookie || stationThreeState.sessionCookie,
    displayName: payload?.display_name,
    group: payload?.group
  });

  return payload;
}

function buildStationThreeUserHeaders(
  userId,
  {
    requireUserId = false,
    requireAccessToken = false
  } = {}
) {
  const resolvedUserId = String(userId || stationThreeState.userId || "").trim();
  const resolvedAccessToken = String(stationThreeState.accessToken || "").trim();
  const resolvedSessionCookie = String(stationThreeState.sessionCookie || "").trim();

  if (requireUserId && !resolvedUserId) {
    throw buildStationThreeAuthRequiredError();
  }

  if (requireAccessToken && !resolvedAccessToken) {
    throw buildStationThreeAuthRequiredError();
  }

  if (!resolvedUserId && !resolvedAccessToken && !resolvedSessionCookie) {
    throw buildStationThreeAuthRequiredError();
  }

  const headers = {
    Referer: `${STATION_THREE_BASE_URL}/`
  };

  if (resolvedUserId) {
    headers["New-Api-User"] = resolvedUserId;
  }

  if (resolvedAccessToken) {
    headers.Authorization = `Bearer ${resolvedAccessToken}`;
  }

  if (resolvedSessionCookie) {
    headers.Cookie = resolvedSessionCookie;
  }

  return headers;
}

async function ensureStationThreeSession({
  username,
  password,
  allowLogin = false,
  forceLogin = false
} = {}) {
  setStationThreeCredentials({ username, password });

  if (!forceLogin && stationThreeState.userId) {
    return stationThreeState.userId;
  }

  const hasCachedCredentials = Boolean(stationThreeState.username && stationThreeState.password);
  if (!allowLogin && !hasCachedCredentials) {
    throw buildStationThreeAuthRequiredError();
  }

  const payload = await loginStationThree({
    username: stationThreeState.username,
    password: stationThreeState.password
  });

  return String(payload?.id || stationThreeState.userId || "").trim();
}

async function fetchStationThreeStatus() {
  const { bodyText } = await requestStationThree(STATION_THREE_STATUS_URL, {
    method: "GET",
    headers: {
      Referer: `${STATION_THREE_BASE_URL}/`
    }
  });

  return unwrapStationThreePayload(bodyText);
}

async function fetchStationThreeSelf(userId) {
  const { bodyText } = await requestStationThree(STATION_THREE_SELF_URL, {
    method: "GET",
    headers: buildStationThreeUserHeaders(userId)
  });

  return unwrapStationThreePayload(bodyText);
}

async function fetchStationThreeAccessToken(userId, { forceRefresh = false } = {}) {
  const cachedToken = String(stationThreeState.accessToken || "").trim();
  if (cachedToken && !forceRefresh) {
    return cachedToken;
  }

  const { bodyText } = await requestStationThree(STATION_THREE_USER_TOKEN_URL, {
    method: "GET",
    headers: buildStationThreeUserHeaders(userId, { requireUserId: true })
  });

  const payload = unwrapStationThreePayload(bodyText);
  return String(payload || "").trim();
}

async function fetchStationThreeSubscriptionSelf(userId) {
  const { bodyText } = await requestStationThree(STATION_THREE_SUBSCRIPTION_SELF_URL, {
    method: "GET",
    headers: buildStationThreeUserHeaders(userId)
  });

  return unwrapStationThreePayload(bodyText);
}

async function fetchStationThreeSubscriptionPlans(userId) {
  const { bodyText } = await requestStationThree(STATION_THREE_SUBSCRIPTION_PLANS_URL, {
    method: "GET",
    headers: buildStationThreeUserHeaders(userId)
  });

  return unwrapStationThreePayload(bodyText);
}

async function fetchStationThreeLogSelfPage(userId, { page = 1, pageSize = STATION_THREE_LOG_FETCH_PAGE_SIZE } = {}) {
  const resolvedPage = normalizePositiveInt(page, 1);
  const resolvedPageSize = normalizePositiveInt(pageSize, STATION_THREE_LOG_FETCH_PAGE_SIZE);
  const requestUrl = `${STATION_THREE_LOG_SELF_URL}?p=${resolvedPage}&size=${resolvedPageSize}`;
  const buildHeaders = () => {
    const headers = buildStationThreeUserHeaders(userId);
    if (stationThreeState.accessToken) {
      headers.Authorization = `Bearer ${stationThreeState.accessToken}`;
    }
    return headers;
  };

  const requestOnce = async () => {
    const { bodyText } = await requestStationThree(requestUrl, {
      method: "GET",
      headers: buildHeaders()
    });
    return unwrapStationThreePayload(bodyText);
  };

  let payload;
  try {
    payload = await requestOnce();
  } catch (error) {
    if (!stationThreeState.accessToken && isStationThreeAuthError(error)) {
      const fetchedToken = await fetchStationThreeAccessToken(userId, { forceRefresh: true }).catch(() => "");
      if (fetchedToken) {
        setStationThreeCredentials({ accessToken: fetchedToken });
        payload = await requestOnce();
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = normalizeNonNegativeInt(payload?.total, items.length);
  const totalPages = Math.max(1, Math.ceil(total / resolvedPageSize));

  return {
    items,
    page: normalizePositiveInt(payload?.page, resolvedPage),
    pageSize: normalizePositiveInt(payload?.page_size, resolvedPageSize),
    total,
    totalPages
  };
}

async function fetchStationThreeDailyLogs(userId, quotaPerUnit) {
  const normalizedQuotaPerUnit = normalizeQuotaPerUnit(quotaPerUnit);
  const dayBounds = getLocalDayBoundsUnix(new Date());
  let currentUserId = String(userId || "").trim();
  const logs = [];

  for (let page = 1; page <= STATION_THREE_LOG_FETCH_MAX_PAGES; page += 1) {
    let pageData = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        pageData = await fetchStationThreeLogSelfPage(currentUserId || userId, {
          page,
          pageSize: STATION_THREE_LOG_FETCH_PAGE_SIZE
        });
        break;
      } catch (error) {
        if (
          attempt === 1
          && isStationThreeAuthError(error)
          && stationThreeState.username
          && stationThreeState.password
        ) {
          try {
            const payload = await loginStationThree({
              username: stationThreeState.username,
              password: stationThreeState.password
            });
            currentUserId = String(payload?.id || currentUserId || userId || "").trim();
            continue;
          } catch {
            // Fall through to partial-return logic below.
          }
        }

        if (logs.length) {
          console.warn(
            `998Code logs fetch interrupted at page ${page}, returning partial daily logs:`,
            error && error.message ? error.message : error
          );
          return logs.sort((left, right) => right.createdAtUnix - left.createdAtUnix);
        }

        throw error;
      }
    }

    if (!pageData) {
      break;
    }

    const pageItems = Array.isArray(pageData.items) ? pageData.items : [];
    if (!pageItems.length) break;

    let reachedOlderDay = false;

    for (const item of pageItems) {
      const createdAtUnix = normalizeUnixSeconds(item?.created_at ?? item?.createdAt ?? item?.created_at_unix);
      if (!Number.isFinite(createdAtUnix) || createdAtUnix <= 0) continue;

      if (createdAtUnix >= dayBounds.end) {
        continue;
      }

      if (createdAtUnix < dayBounds.start) {
        reachedOlderDay = true;
        continue;
      }

      const normalized = normalizeStationThreeLogRecord(item, normalizedQuotaPerUnit);
      if (normalized) {
        logs.push(normalized);
      }
    }

    if (reachedOlderDay || page >= pageData.totalPages) {
      break;
    }
  }

  return logs.sort((left, right) => right.createdAtUnix - left.createdAtUnix);
}

function buildStationThreeSessionSnapshot(summary) {
  return {
    username: summary?.username || stationThreeState.username || "",
    displayName: summary?.displayName || stationThreeState.displayName || "",
    group: summary?.group || stationThreeState.group || "",
    userId: stationThreeState.userId || "",
    quotaPerUnit: stationThreeState.quotaPerUnit || STATION_THREE_DEFAULT_QUOTA_PER_UNIT
  };
}

async function fetchStationThreeDashboard({
  username,
  password,
  allowLogin = false,
  forceLogin = false
} = {}) {
  setStationThreeCredentials({ username, password });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let failedStep = "initialize";
    try {
      failedStep = "ensureSession";
      const userId = await ensureStationThreeSession({
        username: stationThreeState.username,
        password: stationThreeState.password,
        allowLogin,
        forceLogin
      });
      // Give Electron cookie storage a brief window to settle after login.
      await sleep(120);

      failedStep = "accessToken";
      const accessToken = await fetchStationThreeAccessToken(userId, { forceRefresh: true }).catch(() => "");
      if (accessToken) {
        setStationThreeCredentials({ accessToken });
      }

      // Fetch critical authenticated resources sequentially to reduce auth race.
      failedStep = "self";
      const user = await fetchStationThreeSelf(userId);
      failedStep = "subscriptionSelf";
      const subscriptionSelf = await fetchStationThreeSubscriptionSelf(userId);
      failedStep = "statusAndPlans";
      const [statusResult, plansResult] = await Promise.all([
        fetchStationThreeStatus().catch(() => null),
        fetchStationThreeSubscriptionPlans(userId).catch(() => [])
      ]);

      const quotaPerUnit = normalizeQuotaPerUnit(statusResult?.quota_per_unit);
      const plansById = normalizeStationThreePlans(plansResult);
      const summary = summarizeStationThreeUser(user, quotaPerUnit);
      const subscriptions = normalizeStationThreeSubscriptions(subscriptionSelf?.subscriptions, plansById, quotaPerUnit);
      const resolvedAccessToken = accessToken || stationThreeState.accessToken || "";
      failedStep = "dailyLogs";
      const dailyLogs = await fetchStationThreeDailyLogs(userId, quotaPerUnit).catch((error) => {
        console.warn("Failed to fetch 998Code daily logs:", error && error.message ? error.message : error);
        return [];
      });

      failedStep = "persistSession";
      setStationThreeCredentials({
        userId,
        username: summary.username,
        displayName: summary.displayName,
        group: summary.group,
        quotaPerUnit,
        accessToken: resolvedAccessToken
      });

      return {
        summary,
        subscriptions,
        dailyLogs,
        billingPreference: String(subscriptionSelf?.billing_preference || "").trim() || "",
        session: buildStationThreeSessionSnapshot(summary)
      };
    } catch (error) {
      console.warn("fetchStationThreeDashboard failed:", {
        step: failedStep,
        statusCode: Number(error && error.statusCode ? error.statusCode : 0),
        code: error && error.code ? String(error.code) : "",
        message: error && error.message ? String(error.message) : "unknown"
      });
      const statusCode = Number(error && error.statusCode ? error.statusCode : 0);
      if ((statusCode === 401 || statusCode === 403) && attempt === 1) {
        clearStationThreeSession();
        await clearStationThreeSessionStorage();
        if (allowLogin) {
          continue;
        }
        throw buildStationThreeAuthRequiredError();
      }

      throw toStationThreeUserFacingError(error);
    }
  }

  throw new Error("998Code 请求失败");
}

async function createMainWindow({ show = true } = {}) {
  if (win && !win.isDestroyed()) {
    if (show) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    return win;
  }

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    show: false,
    center: true,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#08111d",
      symbolColor: "#eff4ff",
      height: 64
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: "#08111d"
  });

  win.on("closed", () => {
    win = null;
    if (widgetWin && !widgetWin.isDestroyed() && !widgetWin.isVisible()) {
      widgetWin.show();
      widgetWin.focus();
    }
  });

  // Hot-update loading path is intentionally commented out.
  // To restore automatic hot update during development, uncomment below:
  // if (DEV_SERVER_URL) {
  //   await win.loadURL(DEV_SERVER_URL);
  // } else {
  //   await win.loadFile(path.join(__dirname, "renderer/index.html"));
  // }

  await win.loadFile(path.join(__dirname, "renderer/index.html"));

  if (show) {
    win.show();
    win.focus();
  }

  return win;
}

async function createWidgetWindow() {
  if (widgetWin && !widgetWin.isDestroyed()) {
    if (widgetWin.isMinimized()) widgetWin.restore();
    widgetWin.show();
    widgetWin.focus();
    return widgetWin;
  }

  widgetWin = new BrowserWindow({
    width: 360,
    height: 236,
    minWidth: 320,
    minHeight: 216,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: "#08111d"
  });

  widgetWin.on("closed", () => {
    widgetWin = null;
  });

  await widgetWin.loadFile(path.join(__dirname, "renderer/widget.html"));
  widgetWin.setAlwaysOnTop(true, "floating");
  widgetWin.show();
  widgetWin.focus();
  return widgetWin;
}

app.whenReady().then(async () => {
  await createWidgetWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWidgetWindow().catch((error) => {
        console.error("Failed to recreate window:", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("fetch-dashboard", (_event, { authorization, page, limit } = {}) => {
  return fetchDashboardWithRetry(authorization, { page, limit });
});

ipcMain.handle("open-main-dashboard", async () => {
  await createMainWindow({ show: true });
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.hide();
  }
  return true;
});

ipcMain.handle("minimize-main-to-widget", async (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  if (sourceWindow && !sourceWindow.isDestroyed()) {
    sourceWindow.hide();
  }

  await createWidgetWindow();
  return true;
});

ipcMain.handle("get-widget-settings", (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  if (!sourceWindow || sourceWindow.isDestroyed()) {
    return {
      alwaysOnTop: false
    };
  }

  return {
    alwaysOnTop: sourceWindow.isAlwaysOnTop()
  };
});

ipcMain.handle("set-widget-always-on-top", (event, { alwaysOnTop } = {}) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  const nextValue = Boolean(alwaysOnTop);

  if (!sourceWindow || sourceWindow.isDestroyed()) {
    return false;
  }

  if (nextValue) {
    sourceWindow.setAlwaysOnTop(true, "floating");
  } else {
    sourceWindow.setAlwaysOnTop(false);
  }
  return sourceWindow.isAlwaysOnTop();
});

ipcMain.handle("close-widget", (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed() && !win.isVisible()) {
    win.show();
    win.focus();
  }
  if (sourceWindow && !sourceWindow.isDestroyed()) {
    sourceWindow.close();
  }
  return true;
});

ipcMain.handle("fetch-station-two-dashboard", (_event, payload = {}) => {
  return fetchStationTwoDashboard(payload);
});

ipcMain.handle("fetch-station-two-usage", (_event, payload = {}) => {
  return fetchStationTwoUsage(payload);
});

ipcMain.handle("fetch-station-three-dashboard", (_event, payload = {}) => {
  return fetchStationThreeDashboard(payload);
});

ipcMain.handle("get-station-two-preferences", () => {
  return readStationTwoPreferences();
});

ipcMain.handle("save-station-two-preferences", (_event, payload = {}) => {
  return writeStationTwoPreferences(payload);
});

ipcMain.handle("get-station-three-preferences", () => {
  return readStationThreePreferences();
});

ipcMain.handle("save-station-three-preferences", (_event, payload = {}) => {
  return writeStationThreePreferences(payload);
});

ipcMain.handle("clear-station-two-session", () => {
  clearStationTwoSession();
  return true;
});

ipcMain.handle("clear-station-three-session", async () => {
  clearStationThreeSession();
  await clearStationThreeSessionStorage();
  return true;
});

ipcMain.handle("copy-text", (_event, { text } = {}) => {
  clipboard.writeText(String(text || ""));
  return true;
});
