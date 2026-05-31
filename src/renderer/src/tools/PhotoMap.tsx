// leaflet/dist/leaflet.css is imported globally in main.tsx
import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { GeoPhoto } from '../../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const toLocalUrl = (fp: string) =>
  `localfile:///${fp.replace(/\\/g, '/').replace(/^\/+/, '')}`

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch { return '' }
}

// ── Map sub-components (must be inside <MapContainer>) ────────────────────────

function FitBoundsOnLoad({ photos, isScanning }: { photos: GeoPhoto[]; isScanning: boolean }): null {
  const map = useMap()
  const hasInitialFit = useRef(false)
  const prevIsScanning = useRef(false)

  useEffect(() => {
    const scanJustStarted = isScanning && !prevIsScanning.current
    const scanJustEnded = !isScanning && prevIsScanning.current
    prevIsScanning.current = isScanning

    if (scanJustStarted) hasInitialFit.current = false
    if (photos.length === 0) return

    // Fit once when the first GPS photo is found, then again when the scan finishes
    const shouldFit = (isScanning && !hasInitialFit.current) || scanJustEnded
    if (!shouldFit) return
    if (isScanning) hasInitialFit.current = true

    try {
      const bounds = L.latLngBounds(photos.map((p) => [p.lat, p.lng] as [number, number]))
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
    } catch { /* ignore */ }
  }, [photos, isScanning, map])

  return null
}

function PanTo({ target }: { target: GeoPhoto | null }): null {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.setView([target.lat, target.lng], Math.max(map.getZoom(), 14), { animate: true })
  }, [target, map])
  return null
}

// ── Memoised marker (avoids re-creating all on every selectedPath change) ─────

interface MarkerProps {
  photo: GeoPhoto
  selected: boolean
  onSelect: (p: GeoPhoto) => void
}

const PhotoMarker = memo(function PhotoMarker({ photo, selected, onSelect }: MarkerProps) {
  return (
    <CircleMarker
      center={[photo.lat, photo.lng]}
      radius={selected ? 10 : 7}
      pathOptions={{
        color: '#fff',
        weight: selected ? 2 : 1.5,
        fillColor: selected ? '#f97316' : '#3b82f6',
        fillOpacity: selected ? 1 : 0.85,
      }}
      eventHandlers={{ click: () => onSelect(photo) }}
    >
      <Popup minWidth={220} maxWidth={220} className="photo-map-popup">
        {/* Popup content styled with inline styles to avoid Leaflet CSS conflicts */}
        <div style={{ margin: '-13px -20px -17px', overflow: 'hidden', borderRadius: 6, minWidth: 220 }}>
          <img
            src={toLocalUrl(photo.path)}
            style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ padding: '8px 12px 10px', background: '#1e293b', color: '#e2e8f0' }}>
            <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {photo.name}
            </p>
            {photo.date && (
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>{formatDate(photo.date)}</p>
            )}
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
              {photo.lat.toFixed(5)}°, {photo.lng.toFixed(5)}°
            </p>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
})

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpinnerIcon(): JSX.Element {
  return (
    <svg className="animate-spin shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotoMap(): JSX.Element {
  const [sourceFolder, setSourceFolder] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [photos, setPhotos] = useState<GeoPhoto[]>([])
  const [scannedCount, setScannedCount] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [panTarget, setPanTarget] = useState<GeoPhoto | null>(null)

  const photoBatch = useRef<GeoPhoto[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // Flush batched GPS photos to React state every 150 ms while scanning
  useEffect(() => {
    if (!isScanning) return
    const id = setInterval(() => {
      if (photoBatch.current.length === 0) return
      const batch = photoBatch.current.splice(0)
      setPhotos((prev) => [...prev, ...batch])
    }, 150)
    return () => clearInterval(id)
  }, [isScanning])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleBrowse = useCallback(async () => {
    const p = await window.api.openFolder()
    if (!p) return
    setSourceFolder(p)
    setPhotos([])
    photoBatch.current = []
    setScannedCount(0)
    setSelectedPath(null)
    setProgress(null)
  }, [])

  const handleScan = useCallback(async () => {
    if (!sourceFolder || isScanning) return
    setIsScanning(true)
    setPhotos([])
    photoBatch.current = []
    setScannedCount(0)
    setSelectedPath(null)
    setProgress(null)

    window.api.offMapProgress()
    window.api.onMapProgress((data) => {
      setProgress({ current: data.current, total: data.total })
      setScannedCount(data.current)
      if (data.photo) photoBatch.current.push(data.photo)
    })

    try {
      const finalPhotos = await window.api.scanForGps(sourceFolder)
      window.api.offMapProgress()
      setPhotos(finalPhotos)
    } catch {
      window.api.offMapProgress()
      setPhotos([])
    } finally {
      photoBatch.current = []
      setIsScanning(false)
      setProgress(null)
    }
  }, [sourceFolder, isScanning])

  const handleSelectFromList = useCallback((photo: GeoPhoto) => {
    setSelectedPath(photo.path)
    setPanTarget(photo)
  }, [])

  const handleMarkerSelect = useCallback((photo: GeoPhoto) => {
    setSelectedPath(photo.path)
    try {
      listRef.current
        ?.querySelector(`[data-path="${CSS.escape(photo.path)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } catch { /* ignore */ }
  }, [])

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-72 shrink-0 bg-slate-800 border-r border-slate-700/60 flex flex-col">
        <div className="px-4 pt-5 pb-3 shrink-0 flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Photo Map</p>

          <button
            onClick={handleBrowse}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded-lg text-left transition-colors"
          >
            {sourceFolder
              ? <span className="text-xs text-slate-400 block truncate" title={sourceFolder}>{sourceFolder}</span>
              : <span className="text-sm text-slate-500">Browse folder…</span>
            }
          </button>

          <button
            onClick={handleScan}
            disabled={!sourceFolder || isScanning}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {isScanning
              ? <span className="flex items-center justify-center gap-2"><SpinnerIcon />Scanning…</span>
              : 'Scan Folder & Subfolders'
            }
          </button>

          {isScanning && progress && progress.total > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} files</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {!isScanning && scannedCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{scannedCount.toLocaleString()} scanned</span>
              <span className={photos.length > 0 ? 'text-blue-400 font-medium' : 'text-slate-600'}>
                {photos.length.toLocaleString()} with GPS
              </span>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-700/60 mx-4 shrink-0" />

        <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {!isScanning && scannedCount > 0 && photos.length === 0 && (
            <p className="text-center text-slate-600 text-xs py-10 px-4">
              No photos with GPS data found.
            </p>
          )}

          {!isScanning && scannedCount === 0 && (
            <p className="text-center text-slate-700 text-xs py-10 px-4">
              Select a folder and press Scan.
            </p>
          )}

          {photos.map((photo) => {
            const sel = selectedPath === photo.path
            return (
              <button
                key={photo.path}
                data-path={photo.path}
                onClick={() => handleSelectFromList(photo)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-l-2 transition-colors ${
                  sel ? 'bg-blue-600/20 border-blue-500' : 'border-transparent hover:bg-slate-700/40'
                }`}
              >
                <div className="w-12 h-9 rounded shrink-0 bg-slate-700 overflow-hidden">
                  <img
                    src={toLocalUrl(photo.path)}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate leading-tight ${sel ? 'text-white' : 'text-slate-300'}`}>
                    {photo.name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    {photo.lat.toFixed(3)}, {photo.lng.toFixed(3)}
                  </p>
                  {photo.date && (
                    <p className="text-[10px] text-slate-600">{formatDate(photo.date)}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Map ── */}
      {/* The outer div must be position:relative with a real height.        */}
      {/* MapContainer uses position:absolute inset-0 inside it so Leaflet   */}
      {/* can always measure a non-zero pixel height from the DOM.           */}
      <div className="flex-1 relative min-h-0">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          // Absolute fill is the only 100%-reliable pattern with Leaflet
          style={{ position: 'absolute', inset: 0 }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />

          <FitBoundsOnLoad photos={photos} isScanning={isScanning} />
          <PanTo target={panTarget} />

          {photos.map((photo) => (
            <PhotoMarker
              key={photo.path}
              photo={photo}
              selected={selectedPath === photo.path}
              onSelect={handleMarkerSelect}
            />
          ))}
        </MapContainer>

        {/* Empty-state overlay — pointer-events-none so it doesn't block map */}
        {!isScanning && photos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="text-center flex flex-col items-center gap-3">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <p className="text-slate-500 text-sm bg-slate-900/70 px-4 py-2 rounded-lg">
                {scannedCount > 0
                  ? 'No GPS data found in these photos.'
                  : 'Browse a folder and click Scan\nto plot photo locations on the map.'}
              </p>
            </div>
          </div>
        )}

        {/* Live badge while scanning */}
        {isScanning && photos.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-slate-800/90 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 pointer-events-none">
            <SpinnerIcon />
            <span>{photos.length} GPS found so far</span>
          </div>
        )}
      </div>
    </div>
  )
}
