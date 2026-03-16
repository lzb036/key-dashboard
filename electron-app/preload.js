const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fetchDashboard: (authorization, options = {}) =>
    ipcRenderer.invoke("fetch-dashboard", { authorization, ...options }),
  fetchStationTwoDashboard: (options = {}) =>
    ipcRenderer.invoke("fetch-station-two-dashboard", options),
  fetchStationTwoUsage: (options = {}) =>
    ipcRenderer.invoke("fetch-station-two-usage", options),
  getStationTwoPreferences: () =>
    ipcRenderer.invoke("get-station-two-preferences"),
  saveStationTwoPreferences: (options = {}) =>
    ipcRenderer.invoke("save-station-two-preferences", options),
  clearStationTwoSession: () =>
    ipcRenderer.invoke("clear-station-two-session"),
  copyText: (text) => ipcRenderer.invoke("copy-text", { text })
});
