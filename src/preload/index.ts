import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { VerifyResult, CopyResult, ProgressData, PreviewResult, ExifReadResult, ExifSaveResult, ImageFile, GeoPhoto, MapScanProgress, PhotoMeta, RenameProgress, RenameResult, MetaStats } from '../shared/types'

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
  },

  loadRenameMeta: (folderPath: string): Promise<{ success: boolean; metas: PhotoMeta[]; error?: string }> =>
    ipcRenderer.invoke('rename:loadMeta', folderPath),

  applyRenames: (renames: { from: string; to: string }[]): Promise<RenameResult> =>
    ipcRenderer.invoke('rename:apply', renames),

  onRenameProgress: (callback: (data: RenameProgress) => void): void => {
    ipcRenderer.on('rename:progress', (_event, data: RenameProgress) => callback(data))
  },

  offRenameProgress: (): void => {
    ipcRenderer.removeAllListeners('rename:progress')
  },

  scanMetadata: (folderPath: string): Promise<MetaStats> =>
    ipcRenderer.invoke('meta:scan', folderPath),

  onMetaProgress: (callback: (data: { current: number; total: number }) => void): void => {
    ipcRenderer.on('meta:progress', (_event, data) => callback(data))
  },

  offMetaProgress: (): void => {
    ipcRenderer.removeAllListeners('meta:progress')
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
