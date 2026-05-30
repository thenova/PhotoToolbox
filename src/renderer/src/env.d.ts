/// <reference types="vite/client" />

import type { VerifyResult, CopyResult, ProgressData, PreviewResult, ImageFile, ExifReadResult, ExifSaveResult, GeoPhoto, MapScanProgress } from '../../../shared/types'

declare global {
  interface Window {
    api: {
      // Folder dialog
      openFolder: () => Promise<string | null>

      // Photo Sorter
      verifyFolder: (folderPath: string) => Promise<VerifyResult>
      previewSort: (folderPath: string) => Promise<PreviewResult>
      copyPhotos: (source: string, destinations: string[]) => Promise<CopyResult>
      onProgress: (callback: (data: ProgressData) => void) => void
      offProgress: () => void

      // EXIF Editor
      loadPhotoFolder: (folderPath: string) => Promise<{ success: boolean; files: ImageFile[]; error?: string }>
      readExif: (filePath: string) => Promise<ExifReadResult>
      saveExif: (filePath: string, changes: Record<string, string>) => Promise<ExifSaveResult>

      // Photo Map
      scanForGps: (folderPath: string) => Promise<GeoPhoto[]>
      onMapProgress: (callback: (data: MapScanProgress) => void) => void
      offMapProgress: () => void
    }
  }
}
