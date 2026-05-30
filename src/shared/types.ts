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

export type ToolId = 'photo-sorter' | 'exif-editor'

export interface ToolDefinition {
  id: ToolId
  label: string
  description: string
  icon: string
}
