import { useState, useMemo, useCallback, useRef } from 'react'
import type { PhotoMeta, RenameResult } from '../../../shared/types'

// ── Template engine (runs client-side — instant preview updates) ──────────────

const pad = (n: number, w: number) => String(n).padStart(w, '0')

function applyTemplate(
  template: string,
  meta: PhotoMeta,
  seq: number,
  seqPad: number,
  dateSource: 'exif' | 'file',
  caseMode: 'original' | 'lower' | 'upper'
): string {
  const iso = dateSource === 'exif' ? (meta.date ?? meta.fileDate) : meta.fileDate
  const d = iso ? new Date(iso) : null

  let r = template

  if (d) {
    r = r
      .replace(/\{date\}/g,     `${d.getFullYear()}-${pad(d.getMonth()+1,2)}-${pad(d.getDate(),2)}`)
      .replace(/\{datetime\}/g, `${d.getFullYear()}-${pad(d.getMonth()+1,2)}-${pad(d.getDate(),2)}_${pad(d.getHours(),2)}-${pad(d.getMinutes(),2)}-${pad(d.getSeconds(),2)}`)
      .replace(/\{year\}/g,     String(d.getFullYear()))
      .replace(/\{month\}/g,    pad(d.getMonth() + 1, 2))
      .replace(/\{day\}/g,      pad(d.getDate(), 2))
      .replace(/\{hour\}/g,     pad(d.getHours(), 2))
      .replace(/\{minute\}/g,   pad(d.getMinutes(), 2))
      .replace(/\{second\}/g,   pad(d.getSeconds(), 2))
  } else {
    r = r.replace(/\{(?:date|datetime|year|month|day|hour|minute|second)\}/g, '')
  }

  r = r.replace(/\{seq:(\d+)\}/g, (_, w) => pad(seq, parseInt(w, 10)))
  r = r.replace(/\{seq\}/g, pad(seq, seqPad))
  r = r.replace(/\{original\}/g, meta.baseName)

  const cam = [meta.cameraMake, meta.cameraModel]
    .filter(Boolean).join('-').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '') || 'unknown-camera'
  r = r.replace(/\{camera\}/g, cam)

  // Drop any remaining unrecognised tokens
  r = r.replace(/\{[^}]*\}/g, '')
  // Sanitise Windows-illegal chars
  r = r.replace(/[/\\:*?"<>|]+/g, '_')
  // Collapse consecutive separators and trim
  r = r.replace(/[-_]{2,}/g, m => m[0]).replace(/^[-_]+|[-_]+$/g, '')

  if (caseMode === 'lower') r = r.toLowerCase()
  else if (caseMode === 'upper') r = r.toUpperCase()

  return (r || 'unnamed') + meta.ext
}

function buildNewPath(originalPath: string, newName: string): string {
  const i = Math.max(originalPath.lastIndexOf('/'), originalPath.lastIndexOf('\\'))
  return originalPath.slice(0, i + 1) + newName
}

// ── Preset patterns ───────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Date + Counter',    value: '{date}_{seq:3}' },
  { label: 'Full timestamp',    value: '{datetime}' },
  { label: 'Counter + Name',    value: '{seq:4}_{original}' },
  { label: 'Camera + Date',     value: '{camera}_{date}_{seq:3}' },
  { label: 'Year-Month-Day',    value: '{year}-{month}-{day}_{seq:3}' },
  { label: 'Keep original',     value: '{original}' },
]

const TOKENS = [
  { token: '{date}',     tip: '2024-01-15' },
  { token: '{datetime}', tip: '2024-01-15_14-30-00' },
  { token: '{year}',     tip: '2024' },
  { token: '{month}',    tip: '01' },
  { token: '{day}',      tip: '15' },
  { token: '{seq}',      tip: 'counter' },
  { token: '{original}', tip: 'original name' },
  { token: '{camera}',   tip: 'Make-Model' },
]

// ── Preview row types ─────────────────────────────────────────────────────────

interface PreviewItem {
  meta: PhotoMeta
  newName: string
  newPath: string
  status: 'ok' | 'conflict' | 'unchanged'
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpinnerIcon(): JSX.Element {
  return (
    <svg className="animate-spin shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotoRenamer(): JSX.Element {
  const [sourceFolder, setSourceFolder] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null)
  const [photoMetas, setPhotoMetas] = useState<PhotoMeta[]>([])

  const [template, setTemplate] = useState('{date}_{seq:3}')
  const [seqStart, setSeqStart] = useState(1)
  const [seqPad, setSeqPad] = useState(3)
  const [dateSource, setDateSource] = useState<'exif' | 'file'>('exif')
  const [caseMode, setCaseMode] = useState<'original' | 'lower' | 'upper'>('original')

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameResult, setRenameResult] = useState<RenameResult | null>(null)

  const templateInputRef = useRef<HTMLInputElement>(null)

  // ── Load folder ─────────────────────────────────────────────────────────────

  const handleBrowse = useCallback(async () => {
    const p = await window.api.openFolder()
    if (!p) return
    setSourceFolder(p)
    setPhotoMetas([])
    setRenameResult(null)
    setLoadProgress(null)
    setIsLoading(true)

    window.api.offRenameProgress()
    window.api.onRenameProgress((data) => setLoadProgress({ current: data.current, total: data.total }))

    const result = await window.api.loadRenameMeta(p)

    window.api.offRenameProgress()
    setPhotoMetas(result.metas ?? [])
    setIsLoading(false)
    setLoadProgress(null)
  }, [])

  // ── Insert token at cursor ───────────────────────────────────────────────────

  const insertToken = useCallback((token: string) => {
    const el = templateInputRef.current
    if (!el) { setTemplate(t => t + token); return }
    const start = el.selectionStart ?? template.length
    const end = el.selectionEnd ?? template.length
    const next = template.slice(0, start) + token + template.slice(end)
    setTemplate(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }, [template])

  // ── Computed preview ─────────────────────────────────────────────────────────

  const preview = useMemo((): PreviewItem[] => {
    if (!photoMetas.length || !template.trim()) return []

    const items: PreviewItem[] = photoMetas.map((meta, i) => {
      const newName = applyTemplate(template, meta, seqStart + i, seqPad, dateSource, caseMode)
      const newPath = buildNewPath(meta.path, newName)
      const unchanged = newName.toLowerCase() === meta.name.toLowerCase()
      return { meta, newName, newPath, status: unchanged ? 'unchanged' : 'ok' }
    })

    // Mark conflicts
    const counts = new Map<string, number>()
    items.forEach(item => {
      const key = item.newName.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    items.forEach(item => {
      if (item.status === 'ok' && (counts.get(item.newName.toLowerCase()) ?? 0) > 1)
        item.status = 'conflict'
    })

    return items
  }, [photoMetas, template, seqStart, seqPad, dateSource, caseMode])

  const toRename    = useMemo(() => preview.filter(p => p.status === 'ok'), [preview])
  const conflicts   = useMemo(() => preview.filter(p => p.status === 'conflict'), [preview])
  const unchanged   = useMemo(() => preview.filter(p => p.status === 'unchanged'), [preview])

  // ── Apply renames ────────────────────────────────────────────────────────────

  const handleRename = useCallback(async () => {
    if (!toRename.length || isRenaming) return
    setIsRenaming(true)
    setRenameResult(null)

    const result = await window.api.applyRenames(
      toRename.map(item => ({ from: item.meta.path, to: item.newPath }))
    )

    // Update in-memory metas so the preview reflects new names immediately
    if (result.success > 0) {
      const renamed = new Map(toRename.map(item => [item.meta.path, item]))
      setPhotoMetas(prev => prev.map(meta => {
        const r = renamed.get(meta.path)
        if (!r) return meta
        return {
          ...meta,
          name: r.newName,
          path: r.newPath,
          ext: r.newName.slice(r.newName.lastIndexOf('.')).toLowerCase(),
          baseName: r.newName.slice(0, r.newName.lastIndexOf('.'))
        }
      }))
    }

    setRenameResult(result)
    setIsRenaming(false)
  }, [toRename, isRenaming])

  const loadPct = loadProgress && loadProgress.total > 0
    ? Math.round(loadProgress.current / loadProgress.total * 100)
    : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">

      {/* ── Left: controls ── */}
      <div className="w-72 shrink-0 bg-slate-800 border-r border-slate-700/60 flex flex-col overflow-y-auto scrollbar-thin">
        <div className="p-4 flex flex-col gap-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Photo Renamer</p>

          {/* Folder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-500">Source folder</label>
            <button
              onClick={handleBrowse}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded-lg text-left transition-colors disabled:opacity-50"
            >
              {sourceFolder
                ? <span className="text-xs text-slate-300 block truncate" title={sourceFolder}>{sourceFolder}</span>
                : <span className="text-sm text-slate-500">Browse folder…</span>
              }
            </button>
            {isLoading && loadProgress && (
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span className="flex items-center gap-1"><SpinnerIcon /> Reading EXIF…</span>
                  <span>{loadProgress.current}/{loadProgress.total}</span>
                </div>
                <div className="bg-slate-700 rounded-full h-1"><div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${loadPct}%` }} /></div>
              </div>
            )}
          </div>

          {photoMetas.length > 0 && (
            <>
              {/* Template */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Rename template</label>
                <input
                  ref={templateInputRef}
                  type="text"
                  value={template}
                  onChange={e => { setTemplate(e.target.value); setRenameResult(null) }}
                  placeholder="{date}_{seq:3}"
                  spellCheck={false}
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                />
                <p className="text-[10px] text-slate-600">Extension is always preserved from the original file.</p>
              </div>

              {/* Tokens */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Insert token</label>
                <div className="flex flex-wrap gap-1.5">
                  {TOKENS.map(({ token, tip }) => (
                    <button
                      key={token}
                      onClick={() => insertToken(token)}
                      title={tip}
                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Presets</label>
                <div className="flex flex-col gap-1">
                  {PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => { setTemplate(p.value); setRenameResult(null) }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors border ${
                        template === p.value
                          ? 'bg-blue-600/20 border-blue-500/50 text-white'
                          : 'bg-slate-700/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/80'
                      }`}
                    >
                      <span className="text-xs">{p.label}</span>
                      <span className="text-[10px] font-mono text-slate-500 ml-2 truncate">{p.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-500">Settings</label>

                {/* Sequence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Seq. start</span>
                  <input
                    type="number" min={0} value={seqStart}
                    onChange={e => setSeqStart(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400 w-16 shrink-0 ml-1">Padding</span>
                  <input
                    type="number" min={1} max={9} value={seqPad}
                    onChange={e => setSeqPad(Math.min(9, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-16 bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Date source */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Date from</span>
                  <select
                    value={dateSource}
                    onChange={e => setDateSource(e.target.value as 'exif' | 'file')}
                    className="flex-1 bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="exif">EXIF (falls back to file date)</option>
                    <option value="file">File modified date</option>
                  </select>
                </div>

                {/* Case */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">Case</span>
                  <select
                    value={caseMode}
                    onChange={e => setCaseMode(e.target.value as 'original' | 'lower' | 'upper')}
                    className="flex-1 bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="original">Original</option>
                    <option value="lower">lowercase</option>
                    <option value="upper">UPPERCASE</option>
                  </select>
                </div>
              </div>

              {/* Rename button */}
              <div className="flex flex-col gap-2 pt-1">
                {conflicts.length > 0 && (
                  <p className="text-[11px] text-amber-500">
                    ⚠ {conflicts.length} naming conflict{conflicts.length !== 1 ? 's' : ''} — these files will be skipped.
                  </p>
                )}
                {unchanged.length === preview.length && preview.length > 0 && (
                  <p className="text-[11px] text-slate-500">All files already match this template.</p>
                )}

                <button
                  onClick={handleRename}
                  disabled={toRename.length === 0 || isRenaming}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {isRenaming
                    ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> Renaming…</span>
                    : `Rename ${toRename.length} File${toRename.length !== 1 ? 's' : ''}`
                  }
                </button>

                {!isRenaming && toRename.length > 0 && !renameResult && (
                  <p className="text-[10px] text-slate-600 text-center">Permanently renames the original files.</p>
                )}

                {renameResult && (
                  <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
                    renameResult.failed === 0
                      ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300'
                      : 'bg-amber-900/30 border border-amber-700/40 text-amber-300'
                  }`}>
                    <CheckIcon />
                    <span>{renameResult.success} renamed{renameResult.failed > 0 ? `, ${renameResult.failed} failed` : ''}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right: preview table ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        {photoMetas.length > 0 && (
          <div className="shrink-0 px-6 py-3 border-b border-slate-700/60 flex items-center gap-4">
            <span className="text-sm font-medium text-white">{photoMetas.length} photos</span>
            {toRename.length > 0 && (
              <span className="text-xs text-emerald-400">{toRename.length} will be renamed</span>
            )}
            {unchanged.length > 0 && (
              <span className="text-xs text-slate-500">{unchanged.length} unchanged</span>
            )}
            {conflicts.length > 0 && (
              <span className="text-xs text-amber-400">{conflicts.length} conflicts</span>
            )}
          </div>
        )}

        {/* Column headers */}
        {photoMetas.length > 0 && (
          <div className="shrink-0 grid grid-cols-[1fr_24px_1fr_56px] gap-2 px-4 py-2 border-b border-slate-700/40 bg-slate-800/40">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Original</span>
            <span />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">New Name</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Status</span>
          </div>
        )}

        {/* Rows */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Empty states */}
          {!isLoading && !sourceFolder && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 mx-auto mb-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p className="text-slate-500 text-sm">Browse a folder to start renaming</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm">
              <SpinnerIcon /> Reading photo metadata…
            </div>
          )}

          {!isLoading && photoMetas.length > 0 && preview.map((item) => {
            const isConflict = item.status === 'conflict'
            const isUnchanged = item.status === 'unchanged'
            return (
              <div
                key={item.meta.path}
                className={`grid grid-cols-[1fr_24px_1fr_56px] gap-2 items-center px-4 py-1.5 border-b border-slate-700/20 ${
                  isConflict ? 'bg-amber-900/10' : isUnchanged ? 'opacity-40' : 'hover:bg-slate-800/50'
                }`}
              >
                {/* Original */}
                <span className="text-xs text-slate-400 truncate font-mono" title={item.meta.name}>
                  {item.meta.name}
                </span>

                {/* Arrow */}
                <span className="text-slate-600 text-xs text-center">→</span>

                {/* New name */}
                <span
                  className={`text-xs truncate font-mono ${
                    isConflict ? 'text-amber-400' : isUnchanged ? 'text-slate-500' : 'text-white'
                  }`}
                  title={item.newName}
                >
                  {item.newName}
                </span>

                {/* Status badge */}
                <div className="flex justify-end">
                  {isConflict && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 border border-amber-700/50 text-amber-400 rounded">conflict</span>
                  )}
                  {isUnchanged && (
                    <span className="text-[10px] text-slate-600">same</span>
                  )}
                  {item.status === 'ok' && (
                    <span className="text-emerald-500"><CheckIcon /></span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
