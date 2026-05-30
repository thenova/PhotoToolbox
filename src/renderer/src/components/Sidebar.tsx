import type { ToolId, ToolDefinition } from '../../../shared/types'

const TOOLS: ToolDefinition[] = [
  { id: 'photo-sorter', label: 'Photo Sorter', description: 'Sort by date',    icon: 'sort' },
  { id: 'exif-editor',  label: 'EXIF Editor',  description: 'Edit metadata',   icon: 'exif' },
]

function SortIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M7 12h10M11 18h2" />
    </svg>
  )
}

function ExifIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function getIcon(icon: string): JSX.Element {
  if (icon === 'sort') return <SortIcon />
  if (icon === 'exif') return <ExifIcon />
  return <SortIcon />
}

interface SidebarProps {
  activeTool: ToolId
  onToolChange: (tool: ToolId) => void
}

export default function Sidebar({ activeTool, onToolChange }: SidebarProps): JSX.Element {
  return (
    <aside className="w-52 bg-slate-800 border-r border-slate-700/60 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Photo</p>
            <p className="text-xs text-slate-400 leading-tight">Toolbox</p>
          </div>
        </div>
      </div>

      {/* Tools nav */}
      <nav className="flex-1 p-2 pt-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 mb-2">
          Tools
        </p>
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 flex items-center gap-3 transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-700/70 hover:text-slate-200'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-500'}>
                {getIcon(tool.icon)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{tool.label}</p>
                <p className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
                  {tool.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/60">
        <p className="text-[10px] text-slate-600">v1.0.0</p>
      </div>
    </aside>
  )
}
