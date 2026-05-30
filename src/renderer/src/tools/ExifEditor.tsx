import { useState, useCallback, useRef, useEffect } from 'react'
import type { ImageFile } from '../../../shared/types'

// ── Path → localfile URL ──────────────────────────────────────────────────────
const toLocalUrl = (filePath: string) => {
  const norm = filePath.replace(/\\/g, '/')
  return `localfile:///${norm.replace(/^\/+/, '')}`
}

// ── Tag group definitions ─────────────────────────────────────────────────────

interface TagDef {
  key: string
  label: string
  editable: boolean
  inputType: 'text' | 'datetime-local'
}
interface GroupDef {
  id: string
  label: string
  tags: TagDef[]
}

const TAG_GROUPS: GroupDef[] = [
  {
    id: 'datetime', label: 'Date & Time',
    tags: [
      { key: 'DateTimeOriginal', label: 'Date Taken',     editable: true,  inputType: 'datetime-local' },
      { key: 'CreateDate',       label: 'Date Created',   editable: true,  inputType: 'datetime-local' },
      { key: 'ModifyDate',       label: 'Date Modified',  editable: true,  inputType: 'datetime-local' },
    ]
  },
  {
    id: 'description', label: 'Description',
    tags: [
      { key: 'ImageDescription', label: 'Description',    editable: true,  inputType: 'text' },
      { key: 'Artist',           label: 'Artist / Author',editable: true,  inputType: 'text' },
      { key: 'Copyright',        label: 'Copyright',      editable: true,  inputType: 'text' },
      { key: 'Software',         label: 'Software',       editable: true,  inputType: 'text' },
    ]
  },
  {
    id: 'camera', label: 'Camera & Lens',
    tags: [
      { key: 'Make',                  label: 'Make',            editable: false, inputType: 'text' },
      { key: 'Model',                 label: 'Model',           editable: false, inputType: 'text' },
      { key: 'LensMake',              label: 'Lens Make',       editable: false, inputType: 'text' },
      { key: 'LensModel',             label: 'Lens Model',      editable: false, inputType: 'text' },
      { key: 'FocalLength',           label: 'Focal Length',    editable: false, inputType: 'text' },
      { key: 'FocalLengthIn35mmFilm', label: 'Focal (35mm eq.)',editable: false, inputType: 'text' },
    ]
  },
  {
    id: 'exposure', label: 'Exposure',
    tags: [
      { key: 'ExposureTime',      label: 'Shutter Speed',  editable: false, inputType: 'text' },
      { key: 'FNumber',           label: 'Aperture',       editable: false, inputType: 'text' },
      { key: 'ISO',               label: 'ISO',            editable: false, inputType: 'text' },
      { key: 'ExposureBiasValue', label: 'Exposure Bias',  editable: false, inputType: 'text' },
      { key: 'MeteringMode',      label: 'Metering Mode',  editable: false, inputType: 'text' },
      { key: 'Flash',             label: 'Flash',          editable: false, inputType: 'text' },
      { key: 'WhiteBalance',      label: 'White Balance',  editable: false, inputType: 'text' },
      { key: 'ExposureProgram',   label: 'Program',        editable: false, inputType: 'text' },
    ]
  },
  {
    id: 'image', label: 'Image',
    tags: [
      { key: 'ImageWidth',   label: 'Width',       editable: false, inputType: 'text' },
      { key: 'ImageHeight',  label: 'Height',      editable: false, inputType: 'text' },
      { key: 'Orientation',  label: 'Orientation', editable: false, inputType: 'text' },
      { key: 'ColorSpace',   label: 'Color Space', editable: false, inputType: 'text' },
      { key: 'BitsPerSample',label: 'Bit Depth',   editable: false, inputType: 'text' },
    ]
  },
  {
    id: 'gps', label: 'GPS',
    tags: [
      { key: 'GPSLatitude',  label: 'Latitude',  editable: false, inputType: 'text' },
      { key: 'GPSLongitude', label: 'Longitude', editable: false, inputType: 'text' },
      { key: 'GPSAltitude',  label: 'Altitude',  editable: false, inputType: 'text' },
    ]
  },
]

// ── Value formatting ──────────────────────────────────────────────────────────

function formatDisplay(key: string, value: unknown, inputType: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (inputType === 'datetime-local' && typeof value === 'string') {
    try {
      const d = new Date(value)
      if (!isNaN(d.getTime()))
        return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    } catch { /* ignore */ }
    return value
  }
  if (key === 'ExposureTime' && typeof value === 'number')
    return value < 1 ? `1/${Math.round(1 / value)} s` : `${value} s`
  if (key === 'FNumber' && typeof value === 'number') return `f/${value}`
  if ((key === 'FocalLength' || key === 'FocalLengthIn35mmFilm') && typeof value === 'number') return `${value} mm`
  if (key === 'ExposureBiasValue' && typeof value === 'number') return `${value >= 0 ? '+' : ''}${value} EV`
  if ((key === 'GPSLatitude' || key === 'GPSLongitude') && typeof value === 'number') return `${value.toFixed(6)}°`
  if (key === 'GPSAltitude' && typeof value === 'number') return `${value.toFixed(1)} m`
  if (key === 'ImageWidth' || key === 'ImageHeight') return `${value} px`
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function toInputValue(value: unknown, inputType: string): string {
  if (value === null || value === undefined) return ''
  if (inputType === 'datetime-local' && typeof value === 'string') {
    try {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
      }
    } catch { /* ignore */ }
    return ''
  }
  return String(value)
}

function formatDraftDisplay(draft: string, inputType: string): string {
  if (!draft) return '—'
  if (inputType === 'datetime-local') {
    try {
      const d = new Date(draft)
      if (!isNaN(d.getTime()))
        return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    } catch { /* ignore */ }
  }
  return draft
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PencilIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function XIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function SpinnerIcon(): JSX.Element {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

// ── Tag row ───────────────────────────────────────────────────────────────────

interface TagRowProps {
  tag: TagDef
  rawValue: unknown
  draftValue: string | undefined
  isEditing: boolean
  isJpeg: boolean
  onStartEdit: (key: string, currentInput: string) => void
  onCommit: (key: string, value: string) => void
  onCancel: () => void
}

function TagRow({ tag, rawValue, draftValue, isEditing, isJpeg, onStartEdit, onCommit, onCancel }: TagRowProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localVal, setLocalVal] = useState('')

  useEffect(() => {
    if (isEditing) {
      const initial = draftValue !== undefined
        ? toInputValue(draftValue, tag.inputType)
        : toInputValue(rawValue, tag.inputType)
      setLocalVal(initial)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isEditing])

  const hasDraft = draftValue !== undefined

  const displayValue = hasDraft
    ? formatDraftDisplay(draftValue, tag.inputType)
    : formatDisplay(tag.key, rawValue, tag.inputType)

  const canEdit = tag.editable && isJpeg

  return (
    <div className="group flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-slate-700/30 min-h-[32px]">
      {/* Label */}
      <span className="w-36 shrink-0 text-xs text-slate-500 select-none">{tag.label}</span>

      {isEditing ? (
        /* Edit mode */
        <div className="flex-1 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={tag.inputType}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommit(tag.key, localVal) }
              if (e.key === 'Escape') onCancel()
            }}
            className="flex-1 min-w-0 bg-slate-700 border border-blue-500/60 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
          />
          <button
            onClick={() => onCommit(tag.key, localVal)}
            className="shrink-0 text-emerald-400 hover:text-emerald-300 p-0.5"
            title="Confirm (Enter)"
          >
            <CheckIcon />
          </button>
          <button
            onClick={onCancel}
            className="shrink-0 text-slate-500 hover:text-slate-300 p-0.5"
            title="Cancel (Escape)"
          >
            <XIcon />
          </button>
        </div>
      ) : (
        /* Display mode */
        <>
          <span className={`flex-1 text-sm truncate ${
            hasDraft ? 'text-amber-300' : rawValue !== null && rawValue !== undefined ? 'text-slate-200' : 'text-slate-600'
          }`}>
            {displayValue}
            {hasDraft && <span className="ml-1 text-amber-500 text-[10px] align-super">●</span>}
          </span>
          {canEdit && (
            <button
              onClick={() => onStartEdit(tag.key, toInputValue(draftValue ?? rawValue, tag.inputType))}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity p-0.5"
              title="Edit"
            >
              <PencilIcon />
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: GroupDef
  rawTags: Record<string, unknown>
  draftValues: Record<string, string>
  editingKey: string | null
  isJpeg: boolean
  onStartEdit: (key: string, initial: string) => void
  onCommit: (key: string, value: string) => void
  onCancel: () => void
}

function GroupSection({ group, rawTags, draftValues, editingKey, isJpeg, onStartEdit, onCommit, onCancel }: GroupSectionProps): JSX.Element {
  const [open, setOpen] = useState(true)

  const hasAnyData = group.tags.some(t => rawTags[t.key] !== undefined && rawTags[t.key] !== null)
  const hasEditable = group.tags.some(t => t.editable)

  // Always show editable groups; only show read-only groups when they have data
  if (!hasEditable && !hasAnyData) return <></>

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/20 rounded-lg"
      >
        <ChevronIcon open={open} />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-1">{group.label}</span>
        {hasEditable && isJpeg && (
          <span className="text-[10px] text-slate-600 font-normal normal-case tracking-normal">editable</span>
        )}
      </button>

      {open && (
        <div className="mt-0.5 mb-2">
          {group.tags.map((tag) => (
            <TagRow
              key={tag.key}
              tag={tag}
              rawValue={rawTags[tag.key] ?? null}
              draftValue={draftValues[tag.key]}
              isEditing={editingKey === tag.key}
              isJpeg={isJpeg}
              onStartEdit={onStartEdit}
              onCommit={onCommit}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExifEditor(): JSX.Element {
  const [sourceFolder, setSourceFolder] = useState('')
  const [images, setImages] = useState<ImageFile[]>([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isLoadingExif, setIsLoadingExif] = useState(false)
  const [rawTags, setRawTags] = useState<Record<string, unknown> | null>(null)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const isJpeg = selectedPath ? /\.jpe?g$/i.test(selectedPath) : false
  const hasDraft = Object.keys(draftValues).length > 0
  const selectedName = selectedPath ? selectedPath.replace(/\\/g, '/').split('/').pop() ?? '' : ''

  // ── Image picker handlers ───────────────────────────────────────────────────

  const handleBrowse = useCallback(async () => {
    const p = await window.api.openFolder()
    if (!p) return
    setSourceFolder(p)
    setIsLoadingImages(true)
    setImages([])
    setSelectedPath(null)
    setRawTags(null)
    setDraftValues({})
    setSaveStatus(null)
    const result = await window.api.loadPhotoFolder(p)
    setImages(result.files ?? [])
    setIsLoadingImages(false)
  }, [])

  const handleSelectImage = useCallback(async (filePath: string) => {
    if (filePath === selectedPath) return
    setSelectedPath(filePath)
    setRawTags(null)
    setDraftValues({})
    setEditingKey(null)
    setSaveStatus(null)
    setIsLoadingExif(true)
    const result = await window.api.readExif(filePath)
    setRawTags(result.success ? result.tags : {})
    setIsLoadingExif(false)
  }, [selectedPath])

  // ── Editing handlers ────────────────────────────────────────────────────────

  const handleStartEdit = useCallback((key: string, _initial: string) => {
    setEditingKey(key)
    setSaveStatus(null)
  }, [])

  const handleCommit = useCallback((key: string, value: string) => {
    setDraftValues((prev) => ({ ...prev, [key]: value }))
    setEditingKey(null)
  }, [])

  const handleCancel = useCallback(() => {
    setEditingKey(null)
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedPath || !hasDraft || isSaving) return
    setIsSaving(true)
    setSaveStatus(null)
    const result = await window.api.saveExif(selectedPath, draftValues)
    if (result.success) {
      // Reload EXIF to confirm
      const fresh = await window.api.readExif(selectedPath)
      setRawTags(fresh.success ? fresh.tags : rawTags)
      setDraftValues({})
      setSaveStatus({ ok: true, msg: 'Changes saved.' })
    } else {
      setSaveStatus({ ok: false, msg: result.error ?? 'Save failed.' })
    }
    setIsSaving(false)
  }, [selectedPath, hasDraft, isSaving, draftValues, rawTags])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">

      {/* ── Left: image picker ── */}
      <div className="w-64 shrink-0 bg-slate-800 border-r border-slate-700/60 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Photos</p>
          <button
            onClick={handleBrowse}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600/60 rounded-lg text-sm text-slate-300 hover:text-white transition-colors text-left truncate"
          >
            {sourceFolder
              ? <span className="text-xs text-slate-400 block truncate" title={sourceFolder}>{sourceFolder}</span>
              : <span className="text-slate-500">Browse folder…</span>
            }
          </button>
        </div>

        <div className="h-px bg-slate-700/60 mx-4 shrink-0" />

        {/* Image list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {isLoadingImages && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
              <SpinnerIcon /> Loading…
            </div>
          )}

          {!isLoadingImages && images.length === 0 && sourceFolder && (
            <p className="text-center text-slate-600 text-xs py-8 px-3">No photos found in this folder.</p>
          )}

          {!isLoadingImages && !sourceFolder && (
            <p className="text-center text-slate-700 text-xs py-8 px-3">Select a folder to browse photos.</p>
          )}

          {images.map((img) => {
            const isSelected = selectedPath === img.path
            return (
              <button
                key={img.path}
                onClick={() => handleSelectImage(img.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'hover:bg-slate-700/40 border-l-2 border-transparent'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-14 h-10 rounded shrink-0 bg-slate-700 overflow-hidden flex items-center justify-center">
                  <img
                    src={toLocalUrl(img.path)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                {/* Name */}
                <span className={`text-xs truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                  {img.name}
                </span>
              </button>
            )
          })}
        </div>

        {images.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-700/60 shrink-0">
            <p className="text-[10px] text-slate-600">{images.length} photo{images.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* ── Right: EXIF data ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Empty state */}
        {!selectedPath && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600">
            <EmptyPhotoIcon />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">No photo selected</p>
              <p className="text-xs mt-1 text-slate-600">Browse a folder and click a photo to view its EXIF data</p>
            </div>
          </div>
        )}

        {/* Loading EXIF */}
        {selectedPath && isLoadingExif && (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <SpinnerIcon /> Reading EXIF data…
          </div>
        )}

        {/* EXIF data loaded */}
        {selectedPath && !isLoadingExif && rawTags !== null && (
          <>
            {/* Header + preview */}
            <div className="shrink-0 border-b border-slate-700/60 px-6 py-4 flex items-start gap-4">
              <img
                src={toLocalUrl(selectedPath)}
                alt={selectedName}
                className="w-24 h-16 object-cover rounded-lg bg-slate-700 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-white truncate" title={selectedPath}>{selectedName}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${
                    isJpeg ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'bg-slate-700 text-slate-400 border border-slate-600/50'
                  }`}>
                    {selectedName.split('.').pop()?.toUpperCase()}
                  </span>
                  {rawTags.ImageWidth != null && rawTags.ImageHeight != null && (
                    <span className="text-xs text-slate-500">{String(rawTags.ImageWidth)} × {String(rawTags.ImageHeight)}</span>
                  )}
                  {!isJpeg && (
                    <span className="text-[10px] text-amber-600">Editing requires JPEG</span>
                  )}
                </div>
              </div>
            </div>

            {/* EXIF groups */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
              {TAG_GROUPS.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  rawTags={rawTags}
                  draftValues={draftValues}
                  editingKey={editingKey}
                  isJpeg={isJpeg}
                  onStartEdit={handleStartEdit}
                  onCommit={handleCommit}
                  onCancel={handleCancel}
                />
              ))}
            </div>

            {/* Save footer */}
            <div className="shrink-0 border-t border-slate-700/60 px-6 py-3 flex items-center gap-4">
              {saveStatus && (
                <span className={`text-xs ${saveStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveStatus.msg}
                </span>
              )}
              {!saveStatus && hasDraft && (
                <span className="text-xs text-amber-500">
                  {Object.keys(draftValues).length} unsaved change{Object.keys(draftValues).length !== 1 ? 's' : ''}
                </span>
              )}
              <div className="flex-1" />
              {isJpeg && hasDraft && (
                <p className="text-[10px] text-slate-600">Changes are written to the original file.</p>
              )}
              <button
                onClick={handleSave}
                disabled={!hasDraft || !isJpeg || isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2"><SpinnerIcon /> Saving…</span>
                ) : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptyPhotoIcon(): JSX.Element {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
    </svg>
  )
}
