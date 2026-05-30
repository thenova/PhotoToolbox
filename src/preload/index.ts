import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { VerifyResult, CopyResult, ProgressData, PreviewResult, ExifReadResult, ExifSaveResult, ImageFile, GeoPhoto, MapScanProgress } from '../shared/types'

const api = {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  verifyFolder: (folderPath: string): Promise<VerifyResult> =>
    ipcRenderer.invoke('photos:verify', folderPath),

  previewSort: (folderPath: string): Promise<PreviewResult> =>
    ipcRenderer.invoke('photos:preview', folderPath),

  copyPhotos: (source: string, destinations: string[]): Promise<CopyResult> =>
    ipcRenderer.invoke('photos:copy', { source, destinations }),

  onProgress: (callback: (data: ProgressData) => void): void => {
    ipcRenderer.on('photos:progress', (_event, data: ProgressData) => callback(data))
  },

  offProgress: (): void => {
    ipcRenderer.removeAllListeners('photos:progress')
  },

  loadPhotoFolder: (folderPath: string): Promise<{ success: boolean; files: ImageFile[]; error?: string }> =>
    ipcRenderer.invoke('exif:loadFolder', folderPath),

  readExif: (filePath: string): Promise<ExifReadResult> =>
    ipcRenderer.invoke('exif:readTags', filePath),

  saveExif: (filePath: string, changes: Record<string, string>): Promise<ExifSaveResult> =>
    ipcRenderer.invoke('exif:saveTags', filePath, changes),

  scanForGps: (folderPath: string): Promise<GeoPhoto[]> =>
    ipcRenderer.invoke('map:scan', folderPath),

  onMapProgress: (callback: (data: MapScanProgress) => void): void => {
    ipcRenderer.on('map:progress', (_event, data: MapScanProgress) => callback(data))
  },

  offMapProgress: (): void => {
    ipcRenderer.removeAllListeners('map:progress')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
