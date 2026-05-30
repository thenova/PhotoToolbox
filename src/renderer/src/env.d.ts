/// <reference types="vite/client" />

import type { VerifyResult, CopyResult, ProgressData, PreviewResult, ImageFile, ExifReadResult, ExifSaveResult, GeoPhoto, MapScanProgress, PhotoMeta, RenameProgress, RenameResult, MetaStats } from '../../../shared/types'

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

      // Photo Renamer
      loadRenameMeta: (folderPath: string) => Promise<{ success: boolean; metas: PhotoMeta[]; error?: string }>
      applyRenames: (renames: { from: string; to: string }[]) => Promise<RenameResult>
      onRenameProgress: (callback: (data: RenameProgress) => void) => void
      offRenameProgress: () => void

      // Metadata Overview
      scanMetadata: (folderPath: string) => Promise<MetaStats>
      onMetaProgress: (callback: (data: { current: number; total: number }) => void) => void
      offMetaProgress: () => void
    }
  }
}
