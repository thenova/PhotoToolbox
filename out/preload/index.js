"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  openFolder: () => electron.ipcRenderer.invoke("dialog:openFolder"),
  verifyFolder: (folderPath) => electron.ipcRenderer.invoke("photos:verify", folderPath),
  previewSort: (folderPath) => electron.ipcRenderer.invoke("photos:preview", folderPath),
  copyPhotos: (source, destinations) => electron.ipcRenderer.invoke("photos:copy", { source, destinations }),
  onProgress: (callback) => {
    electron.ipcRenderer.on("photos:progress", (_event, data) => callback(data));
  },
  offProgress: () => {
    electron.ipcRenderer.removeAllListeners("photos:progress");
  },
  loadPhotoFolder: (folderPath) => electron.ipcRenderer.invoke("exif:loadFolder", folderPath),
  readExif: (filePath) => electron.ipcRenderer.invoke("exif:readTags", filePath),
  saveExif: (filePath, changes) => electron.ipcRenderer.invoke("exif:saveTags", filePath, changes),
  scanForGps: (folderPath) => electron.ipcRenderer.invoke("map:scan", folderPath),
  onMapProgress: (callback) => {
    electron.ipcRenderer.on("map:progress", (_event, data) => callback(data));
  },
  offMapProgress: () => {
    electron.ipcRenderer.removeAllListeners("map:progress");
  },
  loadRenameMeta: (folderPath) => electron.ipcRenderer.invoke("rename:loadMeta", folderPath),
  applyRenames: (renames) => electron.ipcRenderer.invoke("rename:apply", renames),
  onRenameProgress: (callback) => {
    electron.ipcRenderer.on("rename:progress", (_event, data) => callback(data));
  },
  offRenameProgress: () => {
    electron.ipcRenderer.removeAllListeners("rename:progress");
  },
  scanMetadata: (folderPath) => electron.ipcRenderer.invoke("meta:scan", folderPath),
  onMetaProgress: (callback) => {
    electron.ipcRenderer.on("meta:progress", (_event, data) => callback(data));
  },
  offMetaProgress: () => {
    electron.ipcRenderer.removeAllListeners("meta:progress");
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
