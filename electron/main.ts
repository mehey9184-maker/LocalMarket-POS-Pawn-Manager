import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let embeddedServer: any = null;
let serverPort: number = 3000;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function startEmbeddedBackend(): Promise<number> {
  process.env.IS_ELECTRON_MAIN = 'true';
  process.env.ELECTRON_APP = 'true';

  try {
    const candidatePaths = [
      path.join(__dirname, '../dist/server.cjs'),
      path.join(app.getAppPath(), 'dist/server.cjs'),
      path.join(process.cwd(), 'dist/server.cjs'),
      path.join(__dirname, 'server.cjs')
    ];

    let serverModule: any = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        serverModule = require(p);
        break;
      }
    }

    if (serverModule && typeof serverModule.startServer === 'function') {
      const { server, port } = await serverModule.startServer(3000);
      embeddedServer = server;
      serverPort = port;
      console.log(`[Electron Main] Embedded Express server running on http://127.0.0.1:${port}`);
      return port;
    }
  } catch (err) {
    console.error('[Electron Main] Embedded server startup error:', err);
  }
  return 3000;
}

async function createWindow() {
  if (!isDev || !process.env.VITE_DEV_SERVER_URL) {
    serverPort = await startEmbeddedBackend();
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'LocalMarket POS & Pawn Manager',
    backgroundColor: '#121212',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    }
  });

  // Handle hardware USB & Serial scanner/printer access permissions
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (['camera', 'media', 'usb', 'serial'].includes(permission)) {
      return true;
    }
    return false;
  });

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    return true;
  });

  // External links open in system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load via the embedded Express backend server so all /api/* routes work seamlessly
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (embeddedServer) {
    try {
      embeddedServer.close();
    } catch (e) {
      console.warn('Server shutdown note:', e);
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Native POS hardware & app IPC handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:is-desktop', () => true);
ipcMain.handle('app:toggle-fullscreen', () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return !isFullScreen;
  }
  return false;
});
