const { app, BrowserWindow, ipcMain, net } = require("electron");
const path = require("path");

let win;

const DASHBOARD_URL = "https://cto.hxrra.com/api/public/dashboard";
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
      height: 46
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
