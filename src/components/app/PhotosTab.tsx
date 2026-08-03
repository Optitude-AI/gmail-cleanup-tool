'use client'

import { Camera, ScanSearch, Trash2, ArchiveRestore, Download, Star, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatBytes } from '@/lib/utils'
import type { PhotoStats, PhotoItem } from '@/lib/types'
import { LoadingSpinner } from './LoadingSpinner'

interface PhotosTabProps {
  scanning: boolean
  stats: PhotoStats | null
  items: PhotoItem[]
  selectedIds: Set<string>
  onScan: () => void
  onToggleSelect: (id: string) => void
  onDelete: (ids: string[]) => void
  onBackup: (items: PhotoItem[]) => void
  onDownload: (id: string, filename: string, baseUrl: string) => void
}

export function PhotosTab({ scanning, stats, items, selectedIds, onScan, onToggleSelect, onDelete, onBackup, onDownload }: PhotosTabProps) {
  if (!stats && !scanning) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <Camera className="h-10 w-10 text-pink-500" />
        <h2 className="text-xl font-bold">Scan Photos</h2>
        <Button onClick={onScan} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan Photos</Button>
      </div>
    )
  }

  if (scanning) return <LoadingSpinner text="Scanning Photos..." />
  if (!stats) return null

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Storage</p><p className="text-xl font-bold">{stats.totalSizeFormatted}</p><p className="text-[10px] text-muted-foreground">{stats.totalPhotos} photos</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Large</p><p className="text-xl font-bold text-orange-600">{stats.largePhotos}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Favorites</p><p className="text-xl font-bold text-yellow-600">{stats.favorites}</p></CardContent></Card>
      </div>
      {selectedIds.size > 0 && <div className="flex gap-2"><Badge variant="secondary">{selectedIds.size}</Badge><Button variant="destructive" size="sm" className="gap-1" onClick={() => onDelete(Array.from(selectedIds))}><Trash2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => onBackup(items.filter(p => selectedIds.has(p.id)))} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button></div>}
      <ScrollArea className="max-h-[500px]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.slice(0, 40).map(p => (
          <Card key={p.id} className={`overflow-hidden ${selectedIds.has(p.id) ? 'ring-2 ring-primary' : ''}`}>
            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
              {p.baseUrl ? <img src={`${p.baseUrl}=w300`} alt={p.filename} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/30" /></div>}
              <div className="absolute top-2 left-2"><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => onToggleSelect(p.id)} className="bg-white/80 border-slate-300" /></div>
              {p.isFavorite && <div className="absolute top-2 right-2"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /></div>}
            </div>
            <CardContent className="p-3"><p className="text-xs font-medium truncate">{p.filename}</p><div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">{formatBytes(p.size)}</span><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500" onClick={() => onDownload(p.id, p.filename, p.baseUrl)}><Download className="h-3 w-3" /></Button></div></CardContent>
          </Card>
        ))}
      </div></ScrollArea>
    </>
  )
}