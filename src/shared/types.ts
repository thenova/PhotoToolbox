export interface VerifyResult {
  success: boolean
  count: number
  files: string[]
  error?: string
}

export interface CopyResult {
  success: number
  failed: number
  errors: string[]
}

export interface ProgressData {
  current: number
  total: number
  file: string
  successCount: number
  failedCount: number
}

export interface OutputFolder {
  id: string
  path: string
}

// year -> month -> day -> filenames
export type SortTree = Record<string, Record<string, Record<string, string[]>>>

export interface PreviewResult {
  success: boolean
  tree: SortTree
  totalFiles: number
  error?: string
}

export interface ImageFile {
  name: string
  path: string
}

export interface ExifReadResult {
  success: boolean
  tags: Record<string, unknown>
  error?: string
}

export interface ExifSaveResult {
  success: boolean
  error?: string
}

export interface GeoPhoto {
  path: string
  name: string
  lat: number
  lng: number
  date: string | null
}

export interface MapScanProgress {
  current: number
  total: number
  photo: GeoPhoto | null
}

export interface PhotoMeta {
  name: string
  path: string
  ext: string        // lowercase with dot, e.g. ".jpg"
  baseName: string   // filename without extension
  date: string | null  // ISO from EXIF, null if unavailable
  fileDate: string   // ISO from file mtime (always available)
  cameraMake: string
  cameraModel: string
}

export interface RenameProgress {
  current: number
  total: number
}

export interface RenameResult {
  success: number
  failed: number
  errors: string[]
}

export interface MetaStats {
  total: number
  withExif: number
  cameras: [string, number][]
  lenses: [string, number][]
  apertures: [string, number][]
  shutterSpeeds: [string, number][]
  isos: [string, number][]
  focalLengths: [string, number][]
  years: [string, number][]
  flash: { used: number; notUsed: number; unknown: number }
}

export type ToolId = 'photo-sorter' | 'exif-editor' | 'photo-map' | 'photo-renamer' | 'meta-overview'

export interface ToolDefinition {
  id: ToolId
  label: string
  description: string
  icon: string
}
