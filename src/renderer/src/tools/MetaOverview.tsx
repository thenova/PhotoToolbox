import { useState, useCallback } from 'react'
import type { MetaStats } from '../../../shared/types'

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  icon: JSX.Element
  data: [string, number][]
  accent: string          // Tailwind bg colour class for the bar
  sortByCount?: boolean   // show "most used" badge on first item
  initialRows?: number
}

function StatCard({ title, icon, data, accent, sortByCount = false, initialRows = 10 }: StatCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? data : data.slice(0, initialRows)
  const maxCount = data[0]?.[1] ?? 1
  const total = data.reduce((s, [, n]) => s + n, 0)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/60 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <span className="text-xs text-slate-500">{data.length} unique</span>
      </div>

      {/* Rows */}
      <div className="flex flex-col px-3 py-2 gap-0.5">
        {shown.map(([label, count], i) => {
          const pct = Math.round((count / total) * 100)
          const barPct = Math.round((count / maxCount) * 100)
          return (
            <div key={label} className="flex items-center gap-2 py-1 group">
              <span
                className="text-xs text-slate-400 shrink-0 truncate"
                style={{ width: 140 }}
                title={label}
              >
                {sortByCount && i === 0 && (
                  <span className="mr-1 text-[9px] bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded px-1 py-px">top</span>
                )}
                {label}
              </span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-0">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${accent}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums w-6 text-right shrink-0">{pct}%</span>
              <span className="text-[11px] text-slate-400 tabular-nums w-10 text-right shrink-0">{count.toLocaleString()}</span>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {data.length > initialRows && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mx-3 mb-2 py-1 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-700/60 rounded-lg transition-colors"
        >
          {expanded ? 'Show less' : `+ ${data.length - initialRows} more`}
        </button>
      )}

      {data.length === 0 && (
        <p className="px-4 pb-3 text-xs text-slate-600">No data</p>
      )}
    </div>
  )
}

// ── Flash card ────────────────────────────────────────────────────────────────

function FlashCard({ flash }: { flash: MetaStats['flash'] }): JSX.Element {
  const total = flash.used + flash.notUsed
  const usedPct  = total > 0 ? Math.round((flash.used / total) * 100) : 0
  const noUsePct = total > 0 ? Math.round((flash.notUsed / total) * 100) : 0

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <span className="text-slate-400"><FlashSvg /></span>
          <span className="text-sm font-semibold text-white">Flash</span>
        </div>
        <span className="text-xs text-slate-500">{(flash.used + flash.notUsed).toLocaleString()} photos</span>
      </div>
      <div className="px-3 py-2 flex flex-col gap-0.5">
        {[
          { label: 'Did not fire', count: flash.notUsed, pct: noUsePct, color: 'bg-slate-500' },
          { label: 'Fired',        count: flash.used,    pct: usedPct,  color: 'bg-amber-500' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-2 py-1">
            <span className="text-xs text-slate-400 shrink-0" style={{ width: 140 }}>{row.label}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 tabular-nums w-6 text-right shrink-0">{row.pct}%</span>
            <span className="text-[11px] text-slate-400 tabular-nums w-10 text-right shrink-0">{row.count.toLocaleString()}</span>
          </div>
        ))}
        {flash.unknown > 0 && (
          <p className="text-[10px] text-slate-600 px-1 pt-1">{flash.unknown.toLocaleString()} with no flash data</p>
        )}
      </div>
    </div>
  )
}

// ── Summary badges ────────────────────────────────────────────────────────────

function Badge({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-5 py-3 flex flex-col gap-0.5">
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const w = { width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function CameraSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> }
function LensSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="3"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function ApertureSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/></svg> }
function ShutterSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IsoSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M8 12h8M12 8v8"/></svg> }
function FocalSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function CalendarSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function FlashSvg(): JSX.Element { return <svg {...w} viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function SpinnerSvg(): JSX.Element { return <svg className="animate-spin" {...w} viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> }

// ── Main component ────────────────────────────────────────────────────────────

export default function MetaOverview(): JSX.Element {
  const [sourceFolder, setSourceFolder] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [stats, setStats] = useState<MetaStats | null>(null)

  const handleBrowse = useCallback(async () => {
    const p = await window.api.openFolder()
    if (p) { setSourceFolder(p); setStats(null) }
  }, [])

  const handleScan = useCallback(async () => {
    if (!sourceFolder || isScanning) return
    setIsScanning(true)
    setStats(null)
    setProgress(null)

    window.api.offMetaProgress()
    window.api.onMetaProgress(data => setProgress({ current: data.current, total: data.total }))

    const result = await window.api.scanMetadata(sourceFolder)

    window.api.offMetaProgress()
    setStats(result)
    setIsScanning(false)
    setProgress(null)
  }, [sourceFolder, isScanning])

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const exifPct = stats ? Math.round((stats.withExif / stats.total) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">Metadata Overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Aggregate EXIF statistics across an entire folder tree</p>
          </div>

          <div className="flex-1" />

          {/* Folder */}
          <button
            onClick={handleBrowse}
            disabled={isScanning}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded-lg text-sm transition-colors disabled:opacity-50 max-w-xs"
          >
            {sourceFolder
              ? <span className="text-xs text-slate-300 block truncate max-w-[240px]" title={sourceFolder}>{sourceFolder}</span>
              : <span className="text-slate-400">Browse folder…</span>
            }
          </button>

          {/* Scan */}
          <button
            onClick={handleScan}
            disabled={!sourceFolder || isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {isScanning ? <><SpinnerSvg /> Scanning…</> : 'Scan'}
          </button>
        </div>

        {/* Progress */}
        {isScanning && progress && progress.total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
              <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} photos</span>
              <span>{pct}%</span>
            </div>
            <div className="bg-slate-700 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Empty state */}
        {!stats && !isScanning && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              <line x1="6" y1="8" x2="6" y2="11"/><line x1="10" y1="6" x2="10" y2="11"/><line x1="14" y1="9" x2="14" y2="11"/><line x1="18" y1="7" x2="18" y2="11"/>
            </svg>
            <div className="text-center">
              <p className="text-slate-500 text-sm font-medium">No data yet</p>
              <p className="text-slate-600 text-xs mt-1">Select a folder and press Scan to analyse your photo library</p>
            </div>
          </div>
        )}

        {/* Scanning placeholder */}
        {isScanning && !stats && (
          <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-sm">
            <SpinnerSvg /> Reading EXIF data…
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="p-6 flex flex-col gap-6">

            {/* Summary badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Badge label="Total photos" value={stats.total.toLocaleString()} />
              <Badge label="With EXIF data" value={stats.withExif.toLocaleString()} sub={`${exifPct}% of total`} />
              <Badge label="Cameras used" value={stats.cameras.length.toString()} />
              <Badge label="Lenses used"  value={stats.lenses.length.toString()} />
            </div>

            {/* Grid of stat cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

              <StatCard
                title="Cameras"
                icon={<CameraSvg />}
                data={stats.cameras}
                accent="bg-blue-500"
                sortByCount
              />

              <StatCard
                title="Lenses"
                icon={<LensSvg />}
                data={stats.lenses}
                accent="bg-violet-500"
                sortByCount
              />

              <StatCard
                title="Aperture (f-stop)"
                icon={<ApertureSvg />}
                data={stats.apertures}
                accent="bg-emerald-500"
              />

              <StatCard
                title="Shutter Speed"
                icon={<ShutterSvg />}
                data={stats.shutterSpeeds}
                accent="bg-amber-500"
              />

              <StatCard
                title="ISO"
                icon={<IsoSvg />}
                data={stats.isos}
                accent="bg-rose-500"
              />

              <StatCard
                title="Focal Length"
                icon={<FocalSvg />}
                data={stats.focalLengths}
                accent="bg-sky-500"
              />

              <StatCard
                title="Year"
                icon={<CalendarSvg />}
                data={stats.years}
                accent="bg-indigo-500"
                initialRows={20}
              />

              <FlashCard flash={stats.flash} />

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
