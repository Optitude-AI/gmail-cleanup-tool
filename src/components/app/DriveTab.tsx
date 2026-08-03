'use client'

import { FolderOpen, ScanSearch, Search, Trash2, ArchiveRestore, Download, Lightbulb, File } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { SEVERITY_STYLES, FILE_ICONS } from '@/components/app/constants'
import { formatBytes } from '@/lib/utils'
import { getFileType } from '@/lib/types'
import type { DriveStats, DriveFile, SpaceSuggestion } from '@/lib/types'
import { LoadingSpinner } from './LoadingSpinner'

interface DriveTabProps {
  scanning: boolean
  stats: DriveStats | null
  filtered: DriveFile[]
  selectedIds: Set<string>
  search: string
  filter: string
  suggestions: SpaceSuggestion[]
  onScan: () => void
  onSearchChange: (v: string) => void
  onFilterChange: (v: string) => void
  onToggleSelect: (id: string) => void
  onDelete: (ids: string[]) => void
  onBackup: (items: DriveFile[]) => void
  onDownload: (id: string, name: string) => void
}

export function DriveTab({ scanning, stats, filtered, selectedIds, search, filter, suggestions, onScan, onSearchChange, onFilterChange, onToggleSelect, onDelete, onBackup, onDownload }: DriveTabProps) {
  if (!stats && !scanning) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <FolderOpen className="h-10 w-10 text-blue-500" />
        <h2 className="text-xl font-bold">Scan Drive</h2>
        <Button onClick={onScan} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan Drive</Button>
      </div>
    )
  }

  if (scanning) return <LoadingSpinner text="Scanning Drive..." />
  if (!stats) return null

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Storage</p><p className="text-xl font-bold">{stats.totalSizeFormatted}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Trash</p><p className="text-xl font-bold text-red-600">{stats.trashedSizeFormatted}</p></CardContent></Card>
        <Card className="border-orange-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Large Files</p><p className="text-xl font-bold text-orange-600">{stats.largeFiles}</p></CardContent></Card>
        <Card className="border-yellow-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Duplicates</p><p className="text-xl font-bold text-yellow-600">{stats.duplicatesCount}</p></CardContent></Card>
      </div>
      {suggestions.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />Smart Suggestions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {suggestions.slice(0, 3).map(s => { const st = SEVERITY_STYLES[s.severity] || SEVERITY_STYLES.low; return (
              <div key={s.id} className={`rounded-lg border p-3 ${st.bg}`}>
                <div className="flex items-start gap-2">{st.icon}<div><p className={`text-sm font-semibold ${st.text}`}>{s.title}</p><p className="text-xs text-muted-foreground mt-1">{s.description}</p></div></div>
              </div>
            )})}
          </CardContent></Card>
      )}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search files..." className="pl-9" />
        </div>
        <select value={filter} onChange={e => onFilterChange(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All</option>
          <option value="trashed">Trash</option>
          {stats.byType && Object.keys(stats.byType).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {selectedIds.size > 0 && <>
          <Badge variant="secondary">{selectedIds.size}</Badge>
          <Button variant="destructive" size="sm" className="gap-1" onClick={() => onDelete(Array.from(selectedIds))}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onBackup(filtered.filter(f => selectedIds.has(f.id)))} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button>
        </>}
      </div>
      <ScrollArea className="max-h-[500px]"><div className="space-y-2">
        {filtered.slice(0, 80).map(f => (
          <Card key={f.id} className={`${f.trashed ? 'opacity-50' : ''} ${selectedIds.has(f.id) ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => onToggleSelect(f.id)} />
                <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 shrink-0">{FILE_ICONS[getFileType(f.mimeType)] || <File className="h-4 w-4 text-slate-500" />}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-[10px] text-muted-foreground">{formatBytes(f.size)} &middot; {getFileType(f.mimeType)}</p></div>
                <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500" onClick={() => onDownload(f.id, f.name)}><Download className="h-4 w-4" /></Button></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div></ScrollArea>
    </>
  )
}
