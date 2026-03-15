const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fetchDashboard: (authorization) =>
    ipcRenderer.invoke("fetch-dashboard", { authorization })
});
