// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  getVersion: () => import_electron.ipcRenderer.invoke("app:version"),
  toggleFullscreen: () => import_electron.ipcRenderer.invoke("app:toggle-fullscreen")
});
