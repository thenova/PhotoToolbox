import { useState } from 'react'
import Sidebar from './components/Sidebar'
import PhotoSorter from './tools/PhotoSorter'
import ExifEditor from './tools/ExifEditor'
import PhotoMap from './tools/PhotoMap'
import type { ToolId } from '../../shared/types'

export default function App(): JSX.Element {
  const [activeTool, setActiveTool] = useState<ToolId>('photo-sorter')

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
      <main className="flex-1 overflow-hidden">
        {activeTool === 'photo-sorter' && <PhotoSorter />}
        {activeTool === 'exif-editor'  && <ExifEditor />}
        {activeTool === 'photo-map'    && <PhotoMap />}
      </main>
    </div>
  )
}
