'use client'

import { Copy, Share2, Brain, FileDown, Timer, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '@/lib/utils'
import type { DedupResult, SharedFile, CleanupSchedule } from '@/lib/types'

interface ToolsTabProps {
  dedupLoading: boolean
  dedupResults: DedupResult[] | null
  sharedLoading: boolean
  sharedFiles: SharedFile[] | null
  schedulesLoading: boolean
  schedules: CleanupSchedule[]
  onRunDedup: () => void
  onLoadShared: () => void
  onLoadSchedules: () => void
}

export function ToolsTab({ dedupLoading, dedupResults, sharedLoading, sharedFiles, schedulesLoading, schedules, onRunDedup, onLoadShared, onLoadSchedules }: ToolsTabProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cross-service dedup */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onRunDedup}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30"><Copy className="h-5 w-5 text-violet-500" /></div>
              <div><p className="text-sm font-semibold">Cross-Service Dedup</p><p className="text-xs text-muted-foreground">Find duplicates across Gmail, Drive & Photos</p></div>
            </div>
            {dedupLoading && <Progress className="h-1 mt-2" />}
            {dedupResults && <p className="text-xs text-muted-foreground mt-2">{dedupResults.length} duplicate groups found</p>}
          </CardContent>
        </Card>

        {/* Shared with me */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onLoadShared}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30"><Share2 className="h-5 w-5 text-cyan-500" /></div>
              <div><p className="text-sm font-semibold">Shared With Me</p><p className="text-xs text-muted-foreground">Find stale shared files you never open</p></div>
            </div>
            {sharedLoading && <Progress className="h-1 mt-2" />}
            {sharedFiles && <p className="text-xs text-muted-foreground mt-2">{sharedFiles.length} stale shared files found</p>}
          </CardContent>
        </Card>

        {/* AI Importance */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><Brain className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-sm font-semibold">AI Importance Score</p><p className="text-xs text-muted-foreground">Score emails & files by importance (0-100)</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Attachment Sync */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30"><FileDown className="h-5 w-5 text-amber-500" /></div>
              <div><p className="text-sm font-semibold">Attachment to Drive</p><p className="text-xs text-muted-foreground">Save Gmail attachments to Drive, then delete from Gmail</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Schedules */}
        <Card className="sm:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"><Timer className="h-5 w-5 text-blue-500" /></div>
                <div><p className="text-sm font-semibold">Scheduled Auto-Cleanup</p><p className="text-xs text-muted-foreground">Set rules to run cleanup automatically</p></div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onLoadSchedules}><RefreshCw className="h-3 w-3" />Load Schedules</Button>
            </div>
            {schedules.length > 0 && (
              <div className="space-y-2 mt-3">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2">
                    <div className={`h-2 w-2 rounded-full ${s.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-medium flex-1">{s.name}</span>
                    <Badge variant="outline" className="text-[10px]">{s.frequency}</Badge>
                    <Badge variant="outline" className="text-[10px]">{s.totalCleaned} cleaned</Badge>
                  </div>
                ))}
              </div>
            )}
            {schedules.length === 0 && !schedulesLoading && <p className="text-xs text-muted-foreground mt-2">No schedules configured yet.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Dedup results */}
      {dedupResults && dedupResults.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Cross-Service Duplicates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dedupResults.slice(0, 10).map((g) => (
              <div key={g.hashSignature} className="flex items-center gap-3 rounded-lg border p-3">
                <Copy className="h-4 w-4 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.fileName}</p><p className="text-xs text-muted-foreground">{g.items.length} copies &middot; {formatBytes(g.fileSize)} each &middot; Save {formatBytes(g.spaceRecoverable)}</p></div>
                <Badge variant="outline" className="text-[10px] shrink-0">{g.services.join(', ')}</Badge>
              </div>
            ))}
          </CardContent></Card>
      )}

      {/* Shared files results */}
      {sharedFiles && sharedFiles.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Stale Shared Files</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sharedFiles.slice(0, 10).map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Share2 className="h-4 w-4 text-cyan-500 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-xs text-muted-foreground">From {f.ownerEmail} &middot; {formatBytes(f.size)} &middot; Not modified in {f.lastAccessedDays}d</p></div>
              </div>
            ))}
          </CardContent></Card>
      )}
    </>
  )
}