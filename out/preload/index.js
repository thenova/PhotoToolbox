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
