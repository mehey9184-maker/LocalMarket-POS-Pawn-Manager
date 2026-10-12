import { contextBridge, ipcRenderer } from 'electron';

// Expose safe POS hardware and desktop APIs to window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  cloudOrigin: 'https://local-market-nine.vercel.app',
  getVersion: () => ipcRenderer.invoke('app:version'),
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
  getPlatform: () => process.platform
});
