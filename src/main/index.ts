import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'

// localfile:// serves local files to the renderer (needed since renderer
// runs on localhost in dev and can't directly use file://)
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, bypassCSP: true, stream: true, corsEnabled: true, supportFetchAPI: true } }
])

const PHOTO_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  '.tiff', '.tif', '.heic', '.heif',
  '.raw', '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
  '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw',
  '.3fr', '.fff', '.iiq', '.rwl', '.x3f', '.erf', '.mef', '.mos'
])

function isPhoto(filename: string): boolean {
  return PHOTO_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function getDateFromFile(filePath: string, exifData: Record<string, unknown> | null): Date {
  if (exifData) {
    const raw =
      (exifData['DateTimeOriginal'] as Date | string | undefined) ||
      (exifData['CreateDate'] as Date | string | undefined) ||
      (exifData['ModifyDate'] as Date | string | undefined)
    if (raw) {
      const d = new Date(raw)
      if (!isNaN(d.getTime())) return d
    }
  }
  return new Date(fs.statSync(filePath).mtime)
}

function buildDestPath(destDir: string, filename: string): string {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = path.join(destDir, filename)
  let counter = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${base}_${counter}${ext}`)
    counter++
  }
  return candidate
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.photo-toolbox')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // localfile:// → file:// (simple scheme swap)
  protocol.handle('localfile', (request) => {
    return net.fetch('file' + request.url.slice('localfile'.length))
  })

  // ── Dialog: open folder ──────────────────────────────────────────────────
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ── Photos: count photos in folder ───────────────────────────────────────
  ipcMain.handle('photos:verify', async (_event, folderPath: string) => {
    try {
      const entries = fs.readdirSync(folderPath)
      const photos = entries.filter(isPhoto)
      return { success: true, count: photos.length, files: photos }
    } catch (err) {
      return { success: false, count: 0, files: [], error: String(err) }
    }
  })

  // ── Photos: build sort-preview tree (reads EXIF) ────────────────────────
  ipcMain.handle('photos:preview', async (_event, folderPath: string) => {
    try {
      const files = fs.readdirSync(folderPath).filter(isPhoto)

      let exifr: { parse: (p: string, tags: string[]) => Promise<Record<string, unknown> | null> } | null = null
      try {
        const mod = await import('exifr')
        exifr = mod.default ?? mod
      } catch { /* ignore */ }

      const tree: Record<string, Record<string, Record<string, string[]>>> = {}

      for (const file of files) {
        const filePath = path.join(folderPath, file)

        let exifData: Record<string, unknown> | null = null
        try {
          if (exifr) exifData = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate', 'ModifyDate'])
        } catch { /* ignore */ }

        const date = getDateFromFile(filePath, exifData)
        const year = String(date.getFullYear())
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        if (!tree[year]) tree[year] = {}
        if (!tree[year][month]) tree[year][month] = {}
        if (!tree[year][month][day]) tree[year][month][day] = []
        tree[year][month][day].push(file)
      }

      return { success: true, tree, totalFiles: files.length }
    } catch (err) {
      return { success: false, tree: {}, totalFiles: 0, error: String(err) }
    }
  })

  // ── Photos: copy and sort ────────────────────────────────────────────────
  ipcMain.handle(
    'photos:copy',
    async (event, { source, destinations }: { source: string; destinations: string[] }) => {
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      // exifr is ESM-only, use dynamic import
      let exifr: { parse: (path: string, tags: string[]) => Promise<Record<string, unknown> | null> } | null = null
      try {
        const mod = await import('exifr')
        exifr = mod.default ?? mod
      } catch {
        // fall back to mtime if exifr unavailable
      }

      const files = fs.readdirSync(source).filter(isPhoto)
      const total = files.length * destinations.length
      let processed = 0

      for (const file of files) {
        const sourcePath = path.join(source, file)

        let exifData: Record<string, unknown> | null = null
        try {
          if (exifr) {
            exifData = await exifr.parse(sourcePath, [
              'DateTimeOriginal', 'CreateDate', 'ModifyDate'
            ])
          }
        } catch { /* ignore EXIF errors, fall back to mtime */ }

        const date = getDateFromFile(sourcePath, exifData)
        const year = String(date.getFullYear())
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        for (const dest of destinations) {
          processed++
          const destDir = path.join(dest, year, month, day)

          try {
            fs.mkdirSync(destDir, { recursive: true })
            const destPath = buildDestPath(destDir, file)
            fs.copyFileSync(sourcePath, destPath)
            successCount++
          } catch (err) {
            failedCount++
            errors.push(`${file} → ${dest}: ${String(err)}`)
          }

          event.sender.send('photos:progress', {
            current: processed,
            total,
            file,
            successCount,
            failedCount
          })
        }
      }

      return { success: successCount, failed: failedCount, errors }
    }
  )

  // ── EXIF: list photos in folder ──────────────────────────────────────────
  ipcMain.handle('exif:loadFolder', (_event, folderPath: string) => {
    try {
      const files = fs.readdirSync(folderPath)
        .filter(isPhoto)
        .map((name) => ({ name, path: path.join(folderPath, name) }))
      return { success: true, files }
    } catch (err) {
      return { success: false, files: [], error: String(err) }
    }
  })

  // ── EXIF: read all tags from one file ────────────────────────────────────
  ipcMain.handle('exif:readTags', async (_event, filePath: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let exifr: { parse: (p: string, opts: any) => Promise<Record<string, unknown> | null> } | null = null
      try {
        const mod = await import('exifr')
        exifr = mod.default ?? mod
      } catch { /* ignore */ }

      if (!exifr) return { success: false, tags: {}, error: 'exifr unavailable' }

      const raw = await exifr.parse(filePath, {
        all: true, translateKeys: true, translateValues: true, reviveValues: true
      })

      // Sanitise for IPC: convert Dates to ISO strings, drop unserializable values
      const tags: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw ?? {})) {
        if (v === undefined || v === null) continue
        if (v instanceof Date) { tags[k] = v.toISOString(); continue }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { tags[k] = v; continue }
        if (Array.isArray(v)) {
          tags[k] = v.map((x: unknown) => x instanceof Date ? x.toISOString() : (typeof x === 'object' ? String(x) : x))
          continue
        }
        // Plain objects (e.g. GPS rational values) — stringify them
        try { JSON.stringify(v); tags[k] = v } catch { tags[k] = String(v) }
      }

      return { success: true, tags }
    } catch (err) {
      return { success: false, tags: {}, error: String(err) }
    }
  })

  // ── EXIF: write edited tags back to a JPEG ───────────────────────────────
  ipcMain.handle('exif:saveTags', (_event, filePath: string, changes: Record<string, string>) => {
    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.jpg' && ext !== '.jpeg') {
      return { success: false, error: 'EXIF editing is only supported for JPEG files.' }
    }
    try {
      // piexifjs IFD + tag-number map for the fields we allow editing
      const WRITABLE: Record<string, { ifd: string; num: number; isDate: boolean }> = {
        ImageDescription: { ifd: '0th',  num: 270,   isDate: false },
        Software:         { ifd: '0th',  num: 305,   isDate: false },
        ModifyDate:       { ifd: '0th',  num: 306,   isDate: true  },
        Artist:           { ifd: '0th',  num: 315,   isDate: false },
        Copyright:        { ifd: '0th',  num: 33432, isDate: false },
        DateTimeOriginal: { ifd: 'Exif', num: 36867, isDate: true  },
        CreateDate:       { ifd: 'Exif', num: 36868, isDate: true  },
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const piexif = require('piexifjs') as typeof import('piexifjs')
      const data = fs.readFileSync(filePath, 'binary')
      const exifObj = piexif.load(data)

      for (const [key, value] of Object.entries(changes)) {
        const info = WRITABLE[key]
        if (!info) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exifAny = exifObj as any
        if (!exifAny[info.ifd]) exifAny[info.ifd] = {}
        const ifd = exifAny[info.ifd] as Record<number, unknown>

        if (info.isDate) {
          // datetime-local format "2024-01-15T14:30" → EXIF "2024:01:15 14:30:00"
          const [datePart = '', timePart = '00:00'] = value.split('T')
          const time = timePart.length >= 5 ? `${timePart.slice(0, 5)}:00` : '00:00:00'
          ifd[info.num] = `${datePart.replace(/-/g, ':')} ${time}`
        } else {
          ifd[info.num] = value
        }
      }

      const exifBytes = piexif.dump(exifObj)
      const newData = piexif.insert(exifBytes, data)
      fs.writeFileSync(filePath, Buffer.from(newData, 'binary'))
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // ── Photo Map: recursive GPS scan ────────────────────────────────────────
  ipcMain.handle('map:scan', async (event, folderPath: string) => {
    // Collect all photo paths recursively (max 10 levels deep)
    function collectPhotos(dir: string, depth: number): string[] {
      if (depth > 10) return []
      const results: string[] = []
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) results.push(...collectPhotos(full, depth + 1))
          else if (isPhoto(entry.name)) results.push(full)
        }
      } catch { /* skip inaccessible dirs */ }
      return results
    }

    const allFiles = collectPhotos(folderPath, 0)
    const total = allFiles.length
    const geoPhotos: Array<{ path: string; name: string; lat: number; lng: number; date: string | null }> = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exifr: any = null
    try { const m = await import('exifr'); exifr = m.default ?? m } catch { /* ignore */ }

    for (let i = 0; i < total; i++) {
      const filePath = allFiles[i]
      let photo: typeof geoPhotos[number] | null = null

      try {
        if (exifr) {
          const data = await exifr.parse(filePath, {
            gps: true,
            reviveValues: true,
            translateValues: true,
            mergeOutput: true
          })
          if (data?.latitude != null && data?.longitude != null) {
            photo = {
              path: filePath,
              name: path.basename(filePath),
              lat: data.latitude,
              lng: data.longitude,
              date: data.DateTimeOriginal instanceof Date
                ? data.DateTimeOriginal.toISOString()
                : null
            }
            geoPhotos.push(photo)
          }
        }
      } catch { /* ignore unreadable files */ }

      event.sender.send('map:progress', { current: i + 1, total, photo })
    }

    return geoPhotos
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
