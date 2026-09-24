var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var mainWindow = null;
var embeddedServer = null;
var serverPort = 3e3;
var isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
async function startEmbeddedBackend() {
  process.env.IS_ELECTRON_MAIN = "true";
  process.env.ELECTRON_APP = "true";
  try {
    const candidatePaths = [
      import_path.default.join(__dirname, "../dist/server.cjs"),
      import_path.default.join(import_electron.app.getAppPath(), "dist/server.cjs"),
      import_path.default.join(process.cwd(), "dist/server.cjs"),
      import_path.default.join(__dirname, "server.cjs")
    ];
    let serverModule = null;
    for (const p of candidatePaths) {
      if (import_fs.default.existsSync(p)) {
        serverModule = require(p);
        break;
      }
    }
    if (serverModule && typeof serverModule.startServer === "function") {
      const { server, port } = await serverModule.startServer(3e3);
      embeddedServer = server;
      serverPort = port;
      console.log(`[Electron Main] Embedded Express server running on http://127.0.0.1:${port}`);
      return port;
    }
  } catch (err) {
    console.error("[Electron Main] Embedded server startup error:", err);
  }
  return 3e3;
}
async function createWindow() {
  if (!isDev || !process.env.VITE_DEV_SERVER_URL) {
    serverPort = await startEmbeddedBackend();
  }
  mainWindow = new import_electron.BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: "LocalMarket POS & Pawn Manager",
    backgroundColor: "#121212",
    icon: import_path.default.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    }
  });
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (["camera", "media", "usb", "serial"].includes(permission)) {
      return true;
    }
    return false;
  });
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    return true;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      import_electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(async () => {
  await createWindow();
  import_electron.app.on("activate", async () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (embeddedServer) {
    try {
      embeddedServer.close();
    } catch (e) {
      console.warn("Server shutdown note:", e);
    }
  }
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.ipcMain.handle("app:version", () => import_electron.app.getVersion());
import_electron.ipcMain.handle("app:is-desktop", () => true);
import_electron.ipcMain.handle("app:toggle-fullscreen", () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return !isFullScreen;
  }
  return false;
});
