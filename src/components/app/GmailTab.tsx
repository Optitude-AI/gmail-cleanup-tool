'use client'

import { Sparkles, ScanSearch, Search, RefreshCw, Link2, Trash2, ArchiveRestore } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { GMAIL_CATEGORIES } from '@/components/app/constants'
import type { GmailStats, GmailResult } from '@/lib/types'
import { LoadingSpinner } from './LoadingSpinner'

interface GmailTabProps {
  scanning: boolean
  stats: GmailStats | null
  results: GmailResult[]
  filtered: GmailResult[]
  selectedIds: Set<string>
  activeCategory: string
  search: string
  onScan: () => void
  onSearchChange: (v: string) => void
  onToggleSelect: (id: string) => void
  onDelete: (ids: string[]) => void
  onBackup: (items: GmailResult[]) => void
  setCategory: (cat: string) => void
}

export function GmailTab({ scanning, stats, filtered, selectedIds, activeCategory, search, onScan, onSearchChange, onToggleSelect, onDelete, onBackup, setCategory }: GmailTabProps) {
  if (!stats && !scanning) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <Sparkles className="h-10 w-10 text-red-500" />
        <h2 className="text-xl font-bold">Scan Gmail</h2>
        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">Find subscriptions, promotional emails, junk mail. Unsubscribe or delete in bulk.</p>
        <Button onClick={onScan} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan My Gmail</Button>
      </div>
    )
  }

  if (scanning) return <LoadingSpinner text="Scanning Gmail..." />
  if (!stats) return null

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Senders</p><p className="text-xl font-bold">{stats.total}</p><p className="text-[10px] text-muted-foreground">{stats.totalEmails} emails</p></CardContent></Card>
        {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => { const c = GMAIL_CATEGORIES[cat]; const n = stats[cat as keyof GmailStats] as number; return <Card key={cat} className={c.border}><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-medium text-muted-foreground uppercase">{c.label}</p><p className="text-xl font-bold">{n}</p></div><span className={c.color}>{c.icon}</span></div></CardContent></Card> })}
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search senders..." className="pl-9" />
        </div>
        {selectedIds.size > 0 && <>
          <Badge variant="secondary">{selectedIds.size}</Badge>
          <Button variant="destructive" size="sm" className="gap-1" onClick={() => onDelete(Array.from(selectedIds))}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onBackup(filtered.filter(r => selectedIds.has(r.id)))} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button>
        </>}
        <Button variant="outline" size="sm" onClick={onScan} className="gap-1"><RefreshCw className="h-3 w-3" /></Button>
      </div>
      <Tabs value={activeCategory} onValueChange={setCategory}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          {(['subscription', 'promotion', 'sales', 'junk'] as const).map(c => <TabsTrigger key={c} value={c} className="text-xs">{GMAIL_CATEGORIES[c].label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={activeCategory} className="mt-3">
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {filtered.map(r => { const c = GMAIL_CATEGORIES[r.category] || GMAIL_CATEGORIES.subscription; return (
                <Card key={r.id} className={`${c.border} ${selectedIds.has(r.id) ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => onToggleSelect(r.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${c.color}`}>{r.senderName || r.senderEmail}</span>
                          <Badge variant="outline" className={`${c.bg} ${c.color} border-0 text-[10px] px-1`}>{c.label}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{r.emailCount}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.senderEmail}</p>
                        {r.unsubscribeUrl && <a href={r.unsubscribeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-1"><Link2 className="h-3 w-3" />Unsubscribe</a>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </>
  )
}
