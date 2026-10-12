// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  cloudOrigin: "https://local-market-nine.vercel.app",
  getVersion: () => import_electron.ipcRenderer.invoke("app:version"),
  toggleFullscreen: () => import_electron.ipcRenderer.invoke("app:toggle-fullscreen"),
  getPlatform: () => process.platform
});
