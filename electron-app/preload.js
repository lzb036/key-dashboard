const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fetchDashboard: (authorization, options = {}) =>
    ipcRenderer.invoke("fetch-dashboard", { authorization, ...options }),
  fetchStationTwoDashboard: (options = {}) =>
    ipcRenderer.invoke("fetch-station-two-dashboard", options),
  clearStationTwoSession: () =>
    ipcRenderer.invoke("clear-station-two-session"),
  copyText: (text) => ipcRenderer.invoke("copy-text", { text })
});
