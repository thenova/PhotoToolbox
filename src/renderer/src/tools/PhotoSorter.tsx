import { useState, useCallback, useEffect, useRef } from 'react'
import type { OutputFolder, VerifyResult, CopyResult, ProgressData, SortTree, PreviewResult } from '../../../shared/types'

// ── Month names ───────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December'
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FolderIcon({ open = false, className = '' }: { open?: boolean; className?: string }): JSX.Element {
  return open ? (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" opacity="0.9" />
    </svg>
  ) : (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FileIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 shrink-0">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

function ChevronIcon({ collapsed }: { collapsed: boolean }): JSX.Element {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 text-slate-500 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SpinnerIcon(): JSX.Element {
  return (
    <svg className="animate-spin shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function XIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Tree view ─────────────────────────────────────────────────────────────────

interface TreeViewProps {
  tree: SortTree
  totalFiles: number
}

function buildInitialExpanded(tree: SortTree): Set<string> {
  const s = new Set<string>()
  for (const year of Object.keys(tree)) {
    s.add(year)
    for (const month of Object.keys(tree[year])) {
      s.add(`${year}/${month}`)
    }
  }
  return s
}

function countDayFiles(tree: SortTree, year: string): number {
  return Object.values(tree[year]).reduce(
    (sum, days) => sum + Object.values(days).reduce((s, files) => s + files.length, 0),
    0
  )
}

function TreeView({ tree, totalFiles }: TreeViewProps): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(() => buildInitialExpanded(tree))

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const years = Object.keys(tree).sort().reverse()

  return (
    <div className="flex flex-col text-xs">
      {/* Summary row */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-700/60 text-slate-500">
        <span>{totalFiles} photo{totalFiles !== 1 ? 's' : ''}</span>
        <span>{years.length} year{years.length !== 1 ? 's' : ''}</span>
      </div>

      {years.map((year) => {
        const yearExpanded = expanded.has(year)
        const yearCount = countDayFiles(tree, year)

        return (
          <div key={year}>
            {/* Year row */}
            <button
              onClick={() => toggle(year)}
              className="flex items-center gap-1.5 w-full text-left rounded-md px-1 py-1 hover:bg-slate-700/50 group"
            >
              <ChevronIcon collapsed={!yearExpanded} />
              <FolderIcon open={yearExpanded} className="text-amber-400 shrink-0" />
              <span className="font-semibold text-slate-200">{year}</span>
              <span className="ml-auto text-slate-500 tabular-nums">{yearCount}</span>
            </button>

            {yearExpanded && (
              <div className="ml-3 pl-2.5 border-l border-slate-700/50 mt-0.5 mb-0.5">
                {Object.keys(tree[year]).sort().map((month) => {
                  const monthKey = `${year}/${month}`
                  const monthExpanded = expanded.has(monthKey)
                  const monthDays = tree[year][month]
                  const monthCount = Object.values(monthDays).reduce((s, f) => s + f.length, 0)

                  return (
                    <div key={month}>
                      {/* Month row */}
                      <button
                        onClick={() => toggle(monthKey)}
                        className="flex items-center gap-1.5 w-full text-left rounded-md px-1 py-0.5 hover:bg-slate-700/50 group"
                      >
                        <ChevronIcon collapsed={!monthExpanded} />
                        <FolderIcon open={monthExpanded} className="text-blue-400 shrink-0" />
                        <span className="text-slate-300">{MONTH_NAMES[month] ?? month}</span>
                        <span className="ml-auto text-slate-500 tabular-nums">{monthCount}</span>
                      </button>

                      {monthExpanded && (
                        <div className="ml-3 pl-2.5 border-l border-slate-700/50 mt-0.5 mb-0.5">
                          {Object.keys(monthDays).sort().map((day) => {
                            const dayKey = `${year}/${month}/${day}`
                            const dayExpanded = expanded.has(dayKey)
                            const dayFiles = monthDays[day]

                            return (
                              <div key={day}>
                                {/* Day row */}
                                <button
                                  onClick={() => toggle(dayKey)}
                                  className="flex items-center gap-1.5 w-full text-left rounded-md px-1 py-0.5 hover:bg-slate-700/50 group"
                                >
                                  <ChevronIcon collapsed={!dayExpanded} />
                                  <FolderIcon open={dayExpanded} className="text-slate-500 shrink-0" />
                                  <span className="text-slate-400">{day}</span>
                                  <span className="ml-auto text-slate-500 tabular-nums">{dayFiles.length}</span>
                                </button>

                                {dayExpanded && (
                                  <div className="ml-3 pl-2.5 border-l border-slate-700/50 mt-0.5 mb-1">
                                    {[...dayFiles].sort().map((file, i) => (
                                      <div key={i} className="flex items-center gap-1.5 px-1 py-0.5">
                                        <FileIcon />
                                        <span className="text-slate-500 truncate" title={file}>{file}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Photo Sorter ──────────────────────────────────────────────────────────────

export default function PhotoSorter(): JSX.Element {
  const [sourceFolder, setSourceFolder] = useState('')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  // key used to remount TreeView and reset its expand state on each new preview
  const [previewKey, setPreviewKey] = useState(0)

  const [includeSubfolders, setIncludeSubfolders] = useState(false)

  const [outputFolders, setOutputFolders] = useState<OutputFolder[]>([])
  const settingsLoaded = useRef(false)

  const [isCopying, setIsCopying] = useState(false)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)

  // ── Persist output folders ───────────────────────────────────────────────────

  useEffect(() => {
    window.api.loadSettings().then((settings) => {
      const saved = settings.outputFolders
      if (Array.isArray(saved)) {
        setOutputFolders(
          (saved as string[]).map((p) => ({ id: crypto.randomUUID(), path: p }))
        )
      }
      settingsLoaded.current = true
    })
  }, [])

  useEffect(() => {
    if (!settingsLoaded.current) return
    window.api.saveSettings({ outputFolders: outputFolders.map((f) => f.path) })
  }, [outputFolders])

  // ── Source ──────────────────────────────────────────────────────────────────

  const handleBrowseSource = useCallback(async () => {
    const p = await window.api.openFolder()
    if (p) {
      setSourceFolder(p)
      setVerifyResult(null)
      setPreviewResult(null)
      setCopyResult(null)
    }
  }, [])

  const handleVerify = useCallback(async () => {
    if (!sourceFolder.trim()) return
    setIsVerifying(true)
    setVerifyResult(null)
    setPreviewResult(null)
    setCopyResult(null)

    const result = await window.api.verifyFolder(sourceFolder.trim(), includeSubfolders)
    setVerifyResult(result)
    setIsVerifying(false)

    if (result.success && result.count > 0) {
      setIsPreviewing(true)
      const preview = await window.api.previewSort(sourceFolder.trim(), includeSubfolders)
      setPreviewResult(preview)
      setPreviewKey((k) => k + 1)
      setIsPreviewing(false)
    }
  }, [sourceFolder, includeSubfolders])

  // ── Output ──────────────────────────────────────────────────────────────────

  const handleAddOutput = useCallback(async () => {
    const p = await window.api.openFolder()
    if (p) {
      setOutputFolders((prev) => {
        if (prev.some((f) => f.path === p)) return prev
        return [...prev, { id: crypto.randomUUID(), path: p }]
      })
    }
  }, [])

  const handleRemoveOutput = useCallback((id: string) => {
    setOutputFolders((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // ── Copy ────────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!sourceFolder.trim() || outputFolders.length === 0 || isCopying) return
    setIsCopying(true)
    setProgress(null)
    setCopyResult(null)

    window.api.offProgress()
    window.api.onProgress((data) => setProgress(data))

    const result = await window.api.copyPhotos(
      sourceFolder.trim(),
      outputFolders.map((f) => f.path),
      includeSubfolders
    )

    window.api.offProgress()
    setCopyResult(result)
    setIsCopying(false)
  }, [sourceFolder, outputFolders, isCopying, includeSubfolders])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  const canVerify = sourceFolder.trim().length > 0 && !isVerifying && !isPreviewing
  const canCopy =
    sourceFolder.trim().length > 0 &&
    outputFolders.length > 0 &&
    !isCopying &&
    (verifyResult?.count ?? 0) > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-6 gap-5 bg-slate-900">
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-white">Photo Sorter</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Copy photos from a source folder into year / month / day sub-folders.
        </p>
      </div>

      {/* Three panels */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* ── Source ── */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-800 rounded-xl border border-slate-700/60 p-5 gap-4">
          <SectionHeader icon="folder-in" label="Source Folder" color="text-blue-400" />

          <div className="flex gap-2">
            <input
              type="text"
              value={sourceFolder}
              onChange={(e) => {
                setSourceFolder(e.target.value)
                setVerifyResult(null)
                setPreviewResult(null)
              }}
              placeholder="Enter or browse for folder…"
              className="flex-1 min-w-0 bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
            <button
              onClick={handleBrowseSource}
              className="shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              Browse
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => {
                setIncludeSubfolders(e.target.checked)
                setVerifyResult(null)
                setPreviewResult(null)
                setCopyResult(null)
              }}
              className="w-3.5 h-3.5 rounded accent-blue-500"
            />
            <span className="text-sm text-slate-400">Include subfolders</span>
          </label>

          {verifyResult && (
            <div className={`rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 ${
              verifyResult.success
                ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300'
                : 'bg-red-900/30 border border-red-700/40 text-red-300'
            }`}>
              {verifyResult.success ? (
                <>
                  <span className="text-emerald-400 shrink-0"><CheckIcon /></span>
                  Found <strong>{verifyResult.count}</strong> photo{verifyResult.count !== 1 ? 's' : ''}
                </>
              ) : (
                <span>Error: {verifyResult.error}</span>
              )}
            </div>
          )}

          <div className="flex-1" />

          <button
            onClick={handleVerify}
            disabled={!canVerify}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {isVerifying || isPreviewing ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon />
                {isVerifying ? 'Verifying…' : 'Building preview…'}
              </span>
            ) : 'Verify'}
          </button>
        </div>

        {/* ── Output ── */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-800 rounded-xl border border-slate-700/60 p-5 gap-4">
          <SectionHeader icon="folder-out" label="Output Folders" color="text-emerald-400" />

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-1.5">
            {outputFolders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 py-4">
                <FolderIcon className="w-8 h-8 opacity-30" />
                <p className="text-sm">No output folders selected</p>
              </div>
            ) : (
              outputFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 bg-slate-700/60 border border-slate-600/40 rounded-lg px-3 py-2 group"
                >
                  <FolderIcon className="text-slate-500 shrink-0" />
                  <span className="flex-1 text-sm text-slate-300 truncate" title={folder.path}>
                    {folder.path}
                  </span>
                  <button
                    onClick={() => handleRemoveOutput(folder.id)}
                    className="shrink-0 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <XIcon />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleAddOutput}
            disabled={isCopying}
            className="w-full py-2 border border-dashed border-slate-600/60 rounded-lg text-sm text-slate-500 hover:border-blue-500/60 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            + Add Output Folder
          </button>

          <button
            onClick={handleCopy}
            disabled={!canCopy}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {isCopying ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon /> Copying…
              </span>
            ) : 'Copy'}
          </button>
        </div>

        {/* ── Sort Preview ── */}
        <div className="flex-[1.4] min-w-0 flex flex-col bg-slate-800 rounded-xl border border-slate-700/60 p-5 gap-3">
          <SectionHeader icon="tree" label="Sort Preview" color="text-violet-400" />

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {!previewResult && !isPreviewing && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-600">
                <TreePlaceholderIcon />
                <p className="text-sm text-center">
                  Click <span className="text-slate-500 font-medium">Verify</span> to see<br />
                  how photos will be sorted
                </p>
              </div>
            )}

            {isPreviewing && (
              <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm">
                <SpinnerIcon /> Reading photo dates…
              </div>
            )}

            {previewResult && !isPreviewing && (
              previewResult.success ? (
                <TreeView
                  key={previewKey}
                  tree={previewResult.tree}
                  totalFiles={previewResult.totalFiles}
                />
              ) : (
                <p className="text-sm text-red-400 p-1">Error: {previewResult.error}</p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Progress / Result bar */}
      {(isCopying || copyResult) && (
        <div className="shrink-0 bg-slate-800 rounded-xl border border-slate-700/60 p-4">
          {isCopying && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span className="truncate max-w-xs">
                  {progress ? `Copying: ${progress.file}` : 'Starting…'}
                </span>
                {progress && (
                  <span className="shrink-0 ml-2">
                    {progress.current} / {progress.total} ({progressPercent}%)
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {copyResult && !isCopying && (
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckIcon />
                <strong>{copyResult.success}</strong> copied
              </span>
              {copyResult.failed > 0 && (
                <span className="text-red-400">
                  <strong>{copyResult.failed}</strong> failed
                </span>
              )}
              {copyResult.errors.length > 0 && (
                <details className="ml-auto text-slate-400 text-xs cursor-pointer">
                  <summary>View errors ({copyResult.errors.length})</summary>
                  <ul className="mt-2 space-y-1 text-red-300 max-h-28 overflow-y-auto scrollbar-thin">
                    {copyResult.errors.map((e, i) => (
                      <li key={i} className="truncate">{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              {copyResult.failed === 0 && (
                <span className="ml-auto text-slate-500 text-xs">Done</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeader({ label, color }: { icon: string; label: string; color: string }): JSX.Element {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-widest ${color}`}>{label}</p>
  )
}

function TreePlaceholderIcon(): JSX.Element {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
