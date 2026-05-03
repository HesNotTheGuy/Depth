import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Sidecar } from './sidecar';

let mainWindow: BrowserWindow | null = null;
let sidecar: Sidecar | null = null;

const isDev = !app.isPackaged;

/** Resolve the path to the bundled web/dist/index.html. */
function resolveRendererEntry(): string {
  // In dev: ../../web/dist/index.html
  // In packaged: resources/web/index.html
  const candidates = [
    path.resolve(__dirname, '../../web/dist/index.html'),
    path.resolve(process.resourcesPath || '', 'web/index.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

/** Resolve the path to the depth_sidecar binary. */
function resolveSidecarPath(): string | null {
  const exe = process.platform === 'win32' ? 'depth_sidecar.exe' : 'depth_sidecar';
  const candidates = [
    path.resolve(__dirname, `../../sdk/build/${exe}`),
    path.resolve(__dirname, `../../sdk/build/Release/${exe}`),
    path.resolve(__dirname, `../../sdk/build/Debug/${exe}`),
    path.resolve(process.resourcesPath || '', `sidecar/${exe}`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Depth',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Open external links in the OS browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const entry = resolveRendererEntry();
  mainWindow.loadFile(entry).catch((err) => {
    console.error('[main] Failed to load renderer entry:', entry, err);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startSidecar(): void {
  const binPath = resolveSidecarPath();
  if (!binPath) {
    console.warn('[main] depth_sidecar binary not found; native render IPC will report unavailable.');
    return;
  }
  sidecar = new Sidecar(binPath);
  sidecar.start();
}

function registerIpc(): void {
  ipcMain.handle('sdk:status', async () => {
    if (!sidecar || !sidecar.isAlive()) {
      return { ready: false, version: null, error: 'sidecar_unavailable' };
    }
    return sidecar.request('status', {});
  });

  ipcMain.handle('sdk:render', async (_event, scene: unknown) => {
    if (!sidecar || !sidecar.isAlive()) {
      throw new Error('sidecar_unavailable');
    }
    return sidecar.request('render', scene ?? {});
  });

  ipcMain.handle('sdk:exportLayered', async (_event, scene: unknown) => {
    if (!sidecar || !sidecar.isAlive()) {
      throw new Error('sidecar_unavailable');
    }
    return sidecar.request('exportLayered', scene ?? {});
  });
}

app.whenReady().then(() => {
  registerIpc();
  startSidecar();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (sidecar) {
    sidecar.stop();
    sidecar = null;
  }
});
