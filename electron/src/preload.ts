import { contextBridge, ipcRenderer } from 'electron';

export interface DepthStatus {
  ready: boolean;
  version: string | null;
  error?: string;
}

export interface RenderResult {
  png: string; // base64
  width?: number;
  height?: number;
}

export interface LayeredResult {
  composite: string; // base64 PNG
  foreground: string; // base64 PNG (objects only, transparent bg)
  shadow: string; // base64 PNG (shadows only)
}

export interface DepthBridge {
  isElectron: true;
  getStatus(): Promise<DepthStatus>;
  render(scene: unknown): Promise<RenderResult>;
  exportLayered(scene: unknown): Promise<LayeredResult>;
}

const api: DepthBridge = {
  isElectron: true,
  getStatus: () => ipcRenderer.invoke('sdk:status'),
  render: (scene) => ipcRenderer.invoke('sdk:render', scene),
  exportLayered: (scene) => ipcRenderer.invoke('sdk:exportLayered', scene),
};

contextBridge.exposeInMainWorld('depth', api);
