const { app, BrowserWindow, ipcMain, net, clipboard, session, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

let win;

const DASHBOARD_URL = "https://cto.hxrra.com/api/public/dashboard";
const STATION_TWO_BASE_URL = "https://api.yescode.cloud";
const STATION_TWO_LOGIN_URL = `${STATION_TWO_BASE_URL}/api/v1/auth/login`;
const STATION_TWO_REFRESH_URL = `${STATION_TWO_BASE_URL}/api/v1/auth/refresh`;
const STATION_TWO_ACTIVE_URL = `${STATION_TWO_BASE_URL}/api/v1/subscriptions/active`;
const STATION_TWO_MODELS_URL = `${STATION_TWO_BASE_URL}/api/v1/usage/dashboard/models`;
const STATION_TWO_USAGE_URL = `${STATION_TWO_BASE_URL}/api/v1/usage`;
const STATION_TWO_USAGE_STATS_URL = `${STATION_TWO_BASE_URL}/api/v1/usage/stats`;
const STATION_TWO_SESSION_PARTITION = "persist:key-dashboard-station-two";
const STATION_TWO_DEFAULT_PROXY = "http://127.0.0.1:7890";
const STATION_TWO_PREFS_FILENAME = "station-two-auth.json";
const STATION_TWO_TIMEOUT_MS = 20000;
const STATION_TWO_USAGE_PAGE_SIZE = 10;
const TOKEN_REFRESH_BUFFER_MS = 120000;
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
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
let stationTwoProxyConfigured = null;
let stationTwoUsageApiKeysCache = {
  dateKey: "",
  items: []
};

function getStationTwoPreferencesPath() {
  return path.join(app.getPath("userData"), STATION_TWO_PREFS_FILENAME);
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
      proxyUrl: typeof parsed.proxyUrl === "string" ? parsed.proxyUrl.trim() || STATION_TWO_DEFAULT_PROXY : STATION_TWO_DEFAULT_PROXY,
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
  const payload = {
    email: resolvedRemember ? String(email || "").trim() : "",
    password: resolvedRemember ? encodeStationTwoSecret(password) : null,
    proxyUrl: typeof proxyUrl === "string" ? proxyUrl.trim() : STATION_TWO_DEFAULT_PROXY,
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
    items: []
  };
  if (clearCredentials) {
    stationTwoState.email = "";
    stationTwoState.proxyUrl = STATION_TWO_DEFAULT_PROXY;
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
  const list = Array.isArray(items) ? items : [];

  return list.map((item) => ({
    model: String(item?.model || "").trim() || "—",
    requests: item?.requests ?? 0,
    cost: item?.actual_cost ?? item?.cost ?? null
  }));
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

function buildStationTwoUsageApiKeys(records) {
  const map = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const id = record?.apiKeyId !== null && record?.apiKeyId !== undefined
      ? String(record.apiKeyId)
      : "";
    const key = id || record?.apiKeyName || "unknown";
    if (map.has(key)) continue;

    map.set(key, {
      id,
      name: record?.apiKeyName || "未命名密钥"
    });
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

  return normalizeStationTwoModelDistribution(payload?.models);
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

async function fetchStationTwoUsageApiKeys(accessToken, proxyUrl = stationTwoState.proxyUrl) {
  const timezone = getStationTwoTimezone();
  const today = getDateStringInTimeZone(new Date(), timezone);
  const cacheKey = `${today}::${timezone}`;

  if (stationTwoUsageApiKeysCache.dateKey === cacheKey) {
    return stationTwoUsageApiKeysCache.items;
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
    totalPages = normalizePositiveInt(payload?.pages, 1);
    page += 1;
  }

  const apiKeys = buildStationTwoUsageApiKeys(records);
  stationTwoUsageApiKeysCache = {
    dateKey: cacheKey,
    items: apiKeys
  };

  return apiKeys;
}

async function fetchStationTwoUsageBundle(accessToken, {
  proxyUrl = stationTwoState.proxyUrl,
  page = 1,
  pageSize = STATION_TWO_USAGE_PAGE_SIZE,
  apiKeyId = ""
} = {}) {
  const [usagePage, apiKeys] = await Promise.all([
    fetchStationTwoUsagePage(accessToken, {
      proxyUrl,
      page,
      pageSize,
      apiKeyId
    }),
    fetchStationTwoUsageApiKeys(accessToken, proxyUrl)
  ]);

  return {
    records: usagePage.records,
    apiKeys,
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
        modelDistribution = await fetchStationTwoModelDistribution(accessToken, stationTwoState.proxyUrl);
      } catch (error) {
        const modelStatusCode = Number(error && error.statusCode ? error.statusCode : 0);
        if (modelStatusCode === 401 || modelStatusCode === 403) {
          throw error;
        }
      }

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

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    show: true,
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

  if (DEV_SERVER_URL) {
    await win.loadURL(DEV_SERVER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "renderer/index.html"));
  }

  win.show();
  win.focus();
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
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

ipcMain.handle("fetch-station-two-dashboard", (_event, payload = {}) => {
  return fetchStationTwoDashboard(payload);
});

ipcMain.handle("fetch-station-two-usage", (_event, payload = {}) => {
  return fetchStationTwoUsage(payload);
});

ipcMain.handle("get-station-two-preferences", () => {
  return readStationTwoPreferences();
});

ipcMain.handle("save-station-two-preferences", (_event, payload = {}) => {
  return writeStationTwoPreferences(payload);
});

ipcMain.handle("clear-station-two-session", () => {
  clearStationTwoSession();
  return true;
});

ipcMain.handle("copy-text", (_event, { text } = {}) => {
  clipboard.writeText(String(text || ""));
  return true;
});
