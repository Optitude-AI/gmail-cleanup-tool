'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Mail, Trash2, ScanSearch, Link2, Shield, ShieldAlert, Tag,
  ExternalLink, CheckCircle2, AlertCircle, XCircle,
  RefreshCw, Inbox, Search, BarChart3, Clock,
  Ban, LogIn, Loader2, ShieldCheck, Bell, Megaphone,
  Sparkles, Eye, Download, HardDrive, Image as ImageIcon,
  FolderOpen, FileText, Video, Music, Archive, File, Camera,
  AlertTriangle, Lightbulb, Zap, Star,
  Trash, PieChart, Calendar, Copy, TrendingDown,
  Timer, Wand2, ArchiveRestore, Share2, Brain,
  FileDown, Gauge, Rocket, History, ChevronRight,
  ArrowDown, ArrowUp, CircleDot, Target, Layers
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Types ──
interface GmailStats { total: number; subscriptions: number; promotions: number; sales: number; junk: number; totalEmails: number; withUnsubscribe: number }
interface GmailResult { id: string; category: string; senderEmail: string; senderName: string | null; subject: string | null; emailCount: number; lastReceived: string | null; unsubscribeUrl: string | null }
interface DriveStats { totalFiles: number; totalSize: number; totalSizeFormatted: string; trashedFiles: number; trashedSize: number; trashedSizeFormatted: string; largeFiles: number; duplicatesCount: number; byType: Record<string, { count: number; size: number }> }
interface DriveFile { id: string; name: string; mimeType: string; size: number; createdTime: string; modifiedTime: string; trashed: boolean; webViewLink: string }
interface SpaceSuggestion { id: string; type: string; title: string; description: string; potentialSavings: number; potentialSavingsFormatted: string; severity: string; fileIds: string[]; actionable: boolean }
interface PhotoStats { totalPhotos: number; totalSize: number; totalSizeFormatted: string; favorites: number; largePhotos: number }
interface PhotoItem { id: string; filename: string; mimeType: string; size: number; width: number; height: number; creationTime: string; baseUrl: string; isFavorite: boolean }
interface GmailAccount { id: string; email: string; createdAt: string }
interface UnifiedStorage { limit: number; used: number; usedFormatted: string; free: number; freeFormatted: string; percentUsed: number; gmail: { used: number; formatted: string }; drive: { used: number; formatted: string; trashSize: number }; photos: { used: number; formatted: string } }
interface StorageForecast { currentUsage: number; dailyGrowthRate: number; projectedFullDate: string; daysRemaining: number; weeklyGrowthFormatted: string; severity: string; recommendation: string }
interface CleanupStep { id: string; order: number; action: string; service: string; description: string; filesAffected: number; spaceFreed: number; spaceFreedFormatted: string; risk: string; riskExplanation: string; fileIds: string[] }

const GMAIL_CAT: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  subscription: { label: 'Subscriptions', icon: <Bell className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  promotion: { label: 'Promotions', icon: <Megaphone className="h-4 w-4" />, color: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
  sales: { label: 'Sales', icon: <Tag className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  junk: { label: 'Junk / Spam', icon: <Ban className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  Images: <ImageIcon className="h-5 w-5 text-pink-500" />,
  Videos: <Video className="h-5 w-5 text-red-500" />,
  Audio: <Music className="h-5 w-5 text-violet-500" />,
  PDFs: <FileText className="h-5 w-5 text-red-600" />,
  Documents: <FileText className="h-5 w-5 text-blue-500" />,
  Archives: <Archive className="h-5 w-5 text-yellow-600" />,
  'Other Files': <File className="h-5 w-5 text-slate-500" />,
}

const SEV: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200', text: 'text-red-700', icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
  high: { bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200', text: 'text-orange-700', icon: <AlertCircle className="h-5 w-5 text-orange-500" /> },
  medium: { bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200', text: 'text-yellow-700', icon: <Lightbulb className="h-5 w-5 text-yellow-500" /> },
  low: { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200', text: 'text-blue-700', icon: <Lightbulb className="h-5 w-5 text-blue-400" /> },
  safe: { bg: 'bg-green-50 dark:bg-green-950/30 border-green-200', text: 'text-green-700', icon: <ShieldCheck className="h-5 w-5 text-green-500" /> },
}

const RISK_COLORS: Record<string, string> = {
  safe: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function fmt(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${s[i]}`
}

function getftype(m: string): string {
  if (m.startsWith('image/')) return 'Images'
  if (m.startsWith('video/')) return 'Videos'
  if (m.startsWith('audio/')) return 'Audio'
  if (m.includes('pdf')) return 'PDFs'
  if (m.includes('document') || m.includes('spreadsheet') || m.includes('presentation')) return 'Documents'
  if (m.includes('zip') || m.includes('rar') || m.includes('tar')) return 'Archives'
  return 'Other Files'
}

function LoadingSpinner({ text }: { text: string }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => { const i = setInterval(() => setProgress(p => Math.min(p + Math.random() * 12, 92)), 400); return () => clearInterval(i) }, [])
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 flex items-center justify-center animate-pulse"><ScanSearch className="h-8 w-8 text-red-500 animate-spin" /></div>
      <div className="text-center space-y-2"><h2 className="text-xl font-bold text-slate-900 dark:text-white">{text}</h2></div>
      <div className="w-64"><Progress value={progress} className="h-2" /></div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function GoogleCleanupPage() {
  // Auth
  const [account, setAccount] = useState<GmailAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Tab
  const [tab, setTab] = useState('overview')

  // Gmail
  const [scanningGmail, setScanningGmail] = useState(false)
  const [gmailStats, setGmailStats] = useState<GmailStats | null>(null)
  const [gmailResults, setGmailResults] = useState<GmailResult[]>([])
  const [gmailSel, setGmailSel] = useState<Set<string>>(new Set())
  const [gmailTab, setGmailTab] = useState('all')
  const [gmailSearch, setGmailSearch] = useState('')

  // Drive
  const [scanningDrive, setScanningDrive] = useState(false)
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveSel, setDriveSel] = useState<Set<string>>(new Set())
  const [driveSearch, setDriveSearch] = useState('')
  const [driveFilter, setDriveFilter] = useState('all')
  const [driveSuggestions, setDriveSuggestions] = useState<SpaceSuggestion[]>([])

  // Photos
  const [scanningPhotos, setScanningPhotos] = useState(false)
  const [photoStats, setPhotoStats] = useState<PhotoStats | null>(null)
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([])
  const [photoSel, setPhotoSel] = useState<Set<string>>(new Set())

  // Unified
  const [unifiedStorage, setUnifiedStorage] = useState<UnifiedStorage | null>(null)
  const [forecast, setForecast] = useState<StorageForecast | null>(null)
  const [loadingStorage, setLoadingStorage] = useState(false)

  // Wizard
  const [wizardTarget, setWizardTarget] = useState(1)
  const [wizardPlan, setWizardPlan] = useState<any>(null)
  const [wizardLoading, setWizardLoading] = useState(false)

  // Dedup
  const [dedupResults, setDedupResults] = useState<any[] | null>(null)
  const [dedupLoading, setDedupLoading] = useState(false)

  // Schedules
  const [schedules, setSchedules] = useState<any[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  // Reports
  const [reports, setReports] = useState<any[]>([])

  // Shared
  const [sharedFiles, setSharedFiles] = useState<any[] | null>(null)
  const [sharedLoading, setSharedLoading] = useState(false)

  // Delete
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; service: string; title: string; ids: string[] }>({ open: false, service: '', title: '', ids: [] })
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Backup
  const [backupDialog, setBackupDialog] = useState(false)
  const [backupItems, setBackupItems] = useState<any[]>([])
  const [backupLoading, setBackupLoading] = useState(false)

  const checkExisting = useCallback(async () => {
    try { const r = await fetch('/api/gmail/status'); const d = await r.json(); if (d.accounts?.length > 0) setAccount(d.accounts[0]) } catch { /* */ }
  }, [])

  // ── Auth ──
  const startOAuth = async () => {
    setIsConnecting(true); setError(null)
    try { const r = await fetch('/api/gmail/auth'); const d = await r.json(); if (d.authUrl) { setAuthUrl(d.authUrl); window.open(d.authUrl, '_blank', 'width=600,height=700') } else setError('Check Google API credentials.') } catch { setError('Failed.') }
    setIsConnecting(false)
  }
  const handleCallback = async () => {
    if (!authCode.trim()) return
    setIsConnecting(true); setError(null)
    try { const r = await fetch('/api/gmail/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: authCode.trim(), userId: 'default-user' }) }); const d = await r.json(); if (d.success) { setAccount({ id: d.accountId, email: d.email, createdAt: new Date().toISOString() }); setAuthCode(''); setAuthUrl('') } else setError(d.error) } catch { setError('Failed.') }
    setIsConnecting(false)
  }

  // ── Scan functions ──
  const scanGmail = async () => {
    if (!account) return; setScanningGmail(true); setError(null)
    try { const r = await fetch('/api/gmail/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const d = await r.json(); if (d.success) { setGmailStats(d.stats); setGmailResults(d.results) } else setError(d.error) } catch { setError('Gmail scan failed.') }
    setScanningGmail(false)
  }
  const scanDrive = async () => {
    if (!account) return; setScanningDrive(true); setError(null)
    try {
      const r = await fetch('/api/drive/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const d = await r.json()
      if (d.success) { setDriveStats(d.stats); setDriveFiles(d.files) } else setError(d.error)
      const sr = await fetch('/api/drive/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const sd = await sr.json(); if (sd.success) setDriveSuggestions(sd.suggestions)
    } catch { setError('Drive scan failed.') }
    setScanningDrive(false)
  }
  const scanPhotos = async () => {
    if (!account) return; setScanningPhotos(true); setError(null)
    try { const r = await fetch('/api/photos/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const d = await r.json(); if (d.success) { setPhotoStats(d.stats); setPhotoItems(d.photos) } else setError(d.error) } catch { setError('Photos scan failed.') }
    setScanningPhotos(false)
  }
  const loadStorage = async () => {
    if (!account) return; setLoadingStorage(true)
    try {
      const [sr, fr] = await Promise.all([
        fetch('/api/storage/unified', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }),
        fetch('/api/storage/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }),
      ])
      const sd = await sr.json(); const fd = await fr.json()
      if (sd.success) setUnifiedStorage(sd.storage)
      if (fd.success) setForecast(fd.forecast)
    } catch { /* */ }
    setLoadingStorage(false)
  }
  const runWizard = async () => {
    if (!account) return; setWizardLoading(true)
    try { const r = await fetch('/api/wizard/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id, targetGB: wizardTarget }) }); const d = await r.json(); if (d.success) setWizardPlan(d.plan) } catch { setError('Wizard failed.') }
    setWizardLoading(false)
  }
  const runDedup = async () => {
    if (!account) return; setDedupLoading(true)
    try { const r = await fetch('/api/dedup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const d = await r.json(); if (d.success) setDedupResults(d.duplicates) } catch { setError('Dedup failed.') }
    setDedupLoading(false)
  }
  const loadSchedules = async () => {
    if (!account) return; setSchedulesLoading(true)
    try { const r = await fetch(`/api/schedules?accountId=${account.id}`); const d = await r.json(); if (d.success) setSchedules(d.schedules) } catch { /* */ }
    setSchedulesLoading(false)
  }
  const loadShared = async () => {
    if (!account) return; setSharedLoading(true)
    try { const r = await fetch('/api/shared/find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) }); const d = await r.json(); if (d.success) setSharedFiles(d.files) } catch { setError('Shared files scan failed.') }
    setSharedLoading(false)
  }

  // ── Download ──
  const downloadFile = async (service: string, fileId: string, fileName: string, baseUrl?: string) => {
    setIsDownloading(true)
    try { const r = await fetch(`/api/${service}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account?.id, fileId, baseUrl }) }); if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = fileName; a.click(); URL.revokeObjectURL(u) } else setError('Download failed.') } catch { setError('Download failed.') }
    setIsDownloading(false)
  }

  // ── Backup ZIP ──
  const startBackup = (items: any[], service: string) => {
    setBackupItems(items.map((i: any) => ({ fileId: i.id || i.fileId, fileName: i.name || i.fileName, service })))
    setBackupDialog(true)
  }
  const executeBackup = async () => {
    if (!account) return; setBackupLoading(true)
    try { const r = await fetch('/api/backup/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id, items: backupItems }) }); if (r.ok) { const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'backup.zip'; a.click(); URL.revokeObjectURL(u); setDeleteResult('Backup downloaded successfully!') } else setError('Backup failed.') } catch { setError('Backup failed.') }
    setBackupLoading(false); setBackupDialog(false)
  }

  // ── Delete ──
  const openDelete = (service: string, title: string, ids: string[]) => setDeleteDialog({ open: true, service, title, ids })
  const confirmDelete = async () => {
    if (!account) return; setIsDeleting(true)
    try { const r = await fetch(`/api/${deleteDialog.service}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id, fileIds: deleteDialog.ids }) }); const d = await r.json(); if (d.success) { setDeleteResult(d.message); setDeleteDialog({ ...deleteDialog, open: false }) } else setError(d.error) } catch { setError('Delete failed.') }
    setIsDeleting(false)
  }

  // ── Gmail helpers ──
  const gmailFiltered = gmailResults.filter(r => { const ms = !gmailSearch || r.senderEmail.toLowerCase().includes(gmailSearch.toLowerCase()) || r.senderName?.toLowerCase().includes(gmailSearch.toLowerCase()); const mt = gmailTab === 'all' || r.category === gmailTab; return ms && mt }).sort((a, b) => b.emailCount - a.emailCount)
  const gmailToggle = (id: string) => setGmailSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  // ── Drive helpers ──
  const driveFiltered = driveFiles.filter(f => { const ms = !driveSearch || f.name.toLowerCase().includes(driveSearch.toLowerCase()); const mt = driveFilter === 'all' || driveFilter === 'trashed' ? (driveFilter === 'trashed' ? f.trashed : !f.trashed) : getftype(f.mimeType) === driveFilter; return ms && mt }).sort((a, b) => b.size - a.size)
  const driveToggle = (id: string) => setDriveSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  // ── Photo helpers ──
  const photoToggle = (id: string) => setPhotoSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  // ═══════════════════════ RENDER ═══════════════════════

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg"><HardDrive className="h-10 w-10 text-white" /></div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Google Cleanup Tool</h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg">Clean up Gmail, Drive &amp; Photos with smart suggestions, backup-before-delete, scheduled cleanup, and AI-powered insights.</p>
            </div>
            <div className="grid gap-4 w-full max-w-lg sm:grid-cols-5">
              {[
                { icon: <Gauge className="h-5 w-5" />, t: 'Unified', d: 'Cross-service storage gauge' },
                { icon: <Mail className="h-5 w-5" />, t: 'Gmail', d: 'Unsubscribe & bulk delete' },
                { icon: <HardDrive className="h-5 w-5" />, t: 'Drive', d: 'Large files & duplicates' },
                { icon: <Camera className="h-5 w-5" />, t: 'Photos', d: 'Photo storage management' },
                { icon: <Wand2 className="h-5 w-5" />, t: 'Smart', d: 'AI wizard & scheduling' },
              ].map(i => (
                <div key={i.t} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
                  <div className="text-orange-500">{i.icon}</div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{i.t}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{i.d}</span>
                </div>
              ))}
            </div>
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" />Connect Your Google Account</CardTitle>
                <CardDescription>Secure OAuth2 access to Gmail, Drive, and Photos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <Button onClick={startOAuth} disabled={isConnecting} className="w-full h-12 text-base font-semibold" size="lg">
                  {isConnecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}{isConnecting ? 'Connecting...' : 'Connect with Google'}
                </Button>
                {authUrl && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Separator className="flex-1" /><span>or paste authorization code</span><Separator className="flex-1" /></div>
                    <div className="flex gap-2"><Input value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="Paste the authorization code..." className="flex-1" /><Button onClick={handleCallback} disabled={!authCode.trim() || isConnecting}>Verify</Button></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500"><HardDrive className="h-5 w-5 text-white" /></div>
            <div><h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Google Cleanup</h1><p className="text-xs text-slate-500 dark:text-slate-400">{account.email}</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setAccount(null); setGmailStats(null); setDriveStats(null); setPhotoStats(null); setUnifiedStorage(null); setForecast(null) }} className="text-slate-600">Disconnect</Button>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        {deleteResult && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">{deleteResult}</AlertDescription><Button variant="ghost" size="sm" className="ml-auto text-emerald-600" onClick={() => setDeleteResult(null)}><XCircle className="h-4 w-4" /></Button></Alert>
        )}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        {/* ═══════════ MAIN TABS ═══════════ */}
        <Tabs value={tab} onValueChange={v => { setTab(v); if (v === 'overview' || v === 'wizard') loadStorage(); if (v === 'schedules') loadSchedules() }}>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <TabsList className="grid w-full grid-cols-7 shrink-0">
              <TabsTrigger value="overview" className="gap-1 text-xs"><Gauge className="h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="gmail" className="gap-1 text-xs"><Mail className="h-4 w-4" />Gmail</TabsTrigger>
              <TabsTrigger value="drive" className="gap-1 text-xs"><HardDrive className="h-4 w-4" />Drive</TabsTrigger>
              <TabsTrigger value="photos" className="gap-1 text-xs"><Camera className="h-4 w-4" />Photos</TabsTrigger>
              <TabsTrigger value="wizard" className="gap-1 text-xs"><Wand2 className="h-4 w-4" />Wizard</TabsTrigger>
              <TabsTrigger value="tools" className="gap-1 text-xs"><Zap className="h-4 w-4" />Tools</TabsTrigger>
              <TabsTrigger value="history" className="gap-1 text-xs"><History className="h-4 w-4" />History</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {loadingStorage && <LoadingSpinner text="Loading storage data..." />}
            {!loadingStorage && unifiedStorage && (
              <>
                {/* Unified Storage Gauge */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" />Unified Storage Overview</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="relative flex h-32 w-32 items-center justify-center">
                        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${unifiedStorage.percentUsed * 100}, 100`} className={unifiedStorage.percentUsed > 0.85 ? 'text-red-500' : unifiedStorage.percentUsed > 0.7 ? 'text-orange-500' : 'text-emerald-500'} strokeLinecap="round" /></svg>
                        <div className="absolute text-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(unifiedStorage.percentUsed * 100)}%</p><p className="text-[10px] text-muted-foreground">used</p></div>
                      </div>
                      <div className="flex-1 space-y-3 min-w-[200px]">
                        <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Used</span><span className="text-sm font-bold text-slate-900 dark:text-white">{unifiedStorage.usedFormatted}</span></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Free Space</span><span className="text-sm text-slate-700 dark:text-slate-300">{unifiedStorage.freeFormatted}</span></div>
                        <Separator />
                        <div className="grid gap-2">
                          {[
                            { label: 'Gmail', size: unifiedStorage.gmail.formatted, color: 'bg-red-400' },
                            { label: 'Drive', size: unifiedStorage.drive.formatted, color: 'bg-blue-400' },
                            { label: 'Photos', size: unifiedStorage.photos.formatted, color: 'bg-pink-400' },
                          ].map(s => (
                            <div key={s.label} className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${s.color}`} /><span className="text-xs text-muted-foreground w-16">{s.label}</span><span className="text-xs font-medium">{s.size}</span></div>
                          ))}
                        </div>
                      </div>
                      {/* Forecast */}
                      {forecast && (
                        <Card className={`border ${SEV[forecast.severity]?.bg || SEV.low.bg} min-w-[220px]`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">{SEV[forecast.severity]?.icon}<span className={`text-xs font-semibold uppercase ${SEV[forecast.severity]?.text}`}>Storage Forecast</span></div>
                            <p className="text-sm font-bold">{forecast.daysRemaining > 0 ? `${forecast.daysRemaining} days remaining` : 'Storage full!'}</p>
                            {forecast.daysRemaining > 0 && <p className="text-xs text-muted-foreground mt-1">Full by {new Date(forecast.projectedFullDate).toLocaleDateString()}</p>}
                            <p className="text-xs text-muted-foreground mt-1">Growing ~{forecast.weeklyGrowthFormatted}/week</p>
                            <p className="text-xs mt-2">{forecast.recommendation}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {/* Quick Actions */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: <ScanSearch className="h-5 w-5" />, t: 'Scan Gmail', d: 'Find junk & subscriptions', c: scanGmail, loading: scanningGmail },
                    { icon: <FolderOpen className="h-5 w-5" />, t: 'Scan Drive', d: 'Find large & duplicate files', c: scanDrive, loading: scanningDrive },
                    { icon: <Camera className="h-5 w-5" />, t: 'Scan Photos', d: 'Photo storage analysis', c: scanPhotos, loading: scanningPhotos },
                    { icon: <Wand2 className="h-5 w-5" />, t: 'Smart Cleanup', d: 'AI-powered cleanup wizard', c: () => setTab('wizard'), loading: false },
                  ].map(a => (
                    <Card key={a.t} className="cursor-pointer hover:shadow-md transition-shadow" onClick={a.loading ? undefined : a.c}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">{a.loading ? <Loader2 className="h-5 w-5 animate-spin text-orange-500" /> : a.icon}</div>
                        <div><p className="text-sm font-semibold">{a.t}</p><p className="text-xs text-muted-foreground">{a.d}</p></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
            {!loadingStorage && !unifiedStorage && (
              <div className="flex flex-col items-center py-12 gap-4">
                <p className="text-muted-foreground">Connect your Google account and load storage data to see your unified overview.</p>
                <Button onClick={loadStorage} className="gap-2"><Gauge className="h-4 w-4" />Load Storage Data</Button>
              </div>
            )}
          </TabsContent>

          {/* ═══ GMAIL TAB ═══ */}
          <TabsContent value="gmail" className="mt-6 space-y-6">
            {!gmailStats && !scanningGmail && <div className="flex flex-col items-center py-12 gap-4"><Sparkles className="h-10 w-10 text-red-500" /><h2 className="text-xl font-bold">Scan Gmail</h2><p className="text-slate-600 dark:text-slate-400 text-center max-w-md">Find subscriptions, promotional emails, junk mail. Unsubscribe or delete in bulk.</p><Button onClick={scanGmail} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan My Gmail</Button></div>}
            {scanningGmail && <LoadingSpinner text="Scanning Gmail..." />}
            {gmailStats && !scanningGmail && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Senders</p><p className="text-xl font-bold">{gmailStats.total}</p><p className="text-[10px] text-muted-foreground">{gmailStats.totalEmails} emails</p></CardContent></Card>
                  {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => { const c = GMAIL_CAT[cat]; const n = gmailStats[cat as keyof GmailStats] as number; return <Card key={cat} className={c.border}><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] font-medium text-muted-foreground uppercase">{c.label}</p><p className="text-xl font-bold">{n}</p></div><span className={c.color}>{c.icon}</span></div></CardContent></Card> })}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={gmailSearch} onChange={e => setGmailSearch(e.target.value)} placeholder="Search senders..." className="pl-9" /></div>
                  {gmailSel.size > 0 && <><Badge variant="secondary">{gmailSel.size}</Badge><Button variant="destructive" size="sm" className="gap-1" onClick={() => openDelete('gmail', `Delete ${gmailSel.size} Senders`, [])}><Trash2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => startBackup(gmailFiltered.filter(r => gmailSel.has(r.id)), 'gmail')} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button></>}
                  <Button variant="outline" size="sm" onClick={scanGmail} className="gap-1"><RefreshCw className="h-3 w-3" /></Button>
                </div>
                <Tabs value={gmailTab} onValueChange={setGmailTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all">All</TabsTrigger>
                    {(['subscription', 'promotion', 'sales', 'junk'] as const).map(c => <TabsTrigger key={c} value={c} className="text-xs">{GMAIL_CAT[c].label}</TabsTrigger>)}
                  </TabsList>
                  <TabsContent value={gmailTab} className="mt-3">
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {gmailFiltered.map(r => { const c = GMAIL_CAT[r.category] || GMAIL_CAT.subscription; return (
                          <Card key={r.id} className={`${c.border} ${gmailSel.has(r.id) ? 'ring-2 ring-primary' : ''}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Checkbox checked={gmailSel.has(r.id)} onCheckedChange={() => gmailToggle(r.id)} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap"><span className={`font-semibold text-sm ${c.color}`}>{r.senderName || r.senderEmail}</span><Badge variant="outline" className={`${c.bg} ${c.color} border-0 text-[10px] px-1`}>{c.label}</Badge><Badge variant="secondary" className="text-[10px]">{r.emailCount}</Badge></div>
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
            )}
          </TabsContent>

          {/* ═══ DRIVE TAB ═══ */}
          <TabsContent value="drive" className="mt-6 space-y-6">
            {!driveStats && !scanningDrive && <div className="flex flex-col items-center py-12 gap-4"><FolderOpen className="h-10 w-10 text-blue-500" /><h2 className="text-xl font-bold">Scan Drive</h2><Button onClick={scanDrive} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan Drive</Button></div>}
            {scanningDrive && <LoadingSpinner text="Scanning Drive..." />}
            {driveStats && !scanningDrive && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Storage</p><p className="text-xl font-bold">{driveStats.totalSizeFormatted}</p></CardContent></Card>
                  <Card className="border-red-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Trash</p><p className="text-xl font-bold text-red-600">{driveStats.trashedSizeFormatted}</p></CardContent></Card>
                  <Card className="border-orange-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Large Files</p><p className="text-xl font-bold text-orange-600">{driveStats.largeFiles}</p></CardContent></Card>
                  <Card className="border-yellow-200"><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Duplicates</p><p className="text-xl font-bold text-yellow-600">{driveStats.duplicatesCount}</p></CardContent></Card>
                </div>
                {driveSuggestions.length > 0 && (
                  <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />Smart Suggestions</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {driveSuggestions.slice(0, 3).map(s => { const st = SEV[s.severity] || SEV.low; return (
                        <div key={s.id} className={`rounded-lg border p-3 ${st.bg}`}>
                          <div className="flex items-start gap-2">{st.icon}<div><p className={`text-sm font-semibold ${st.text}`}>{s.title}</p><p className="text-xs text-muted-foreground mt-1">{s.description}</p></div></div>
                        </div>
                      )})}
                    </CardContent></Card>
                )}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={driveSearch} onChange={e => setDriveSearch(e.target.value)} placeholder="Search files..." className="pl-9" /></div>
                  <select value={driveFilter} onChange={e => setDriveFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All</option><option value="trashed">Trash</option>{driveStats.byType && Object.keys(driveStats.byType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                  {driveSel.size > 0 && <><Badge variant="secondary">{driveSel.size}</Badge><Button variant="destructive" size="sm" className="gap-1" onClick={() => openDelete('drive', `Delete ${driveSel.size} Files`, Array.from(driveSel))}><Trash2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => startBackup(driveFiltered.filter(f => driveSel.has(f.id)), 'drive')} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button></>}
                </div>
                <ScrollArea className="max-h-[500px]"><div className="space-y-2">
                  {driveFiltered.slice(0, 80).map(f => (
                    <Card key={f.id} className={`${f.trashed ? 'opacity-50' : ''} ${driveSel.has(f.id) ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={driveSel.has(f.id)} onCheckedChange={() => driveToggle(f.id)} />
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 shrink-0">{FILE_ICONS[getftype(f.mimeType)] || <File className="h-4 w-4 text-slate-500" />}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-[10px] text-muted-foreground">{fmt(f.size)} &middot; {getftype(f.mimeType)}</p></div>
                          <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500" onClick={() => downloadFile('drive', f.id, f.name)}><Download className="h-4 w-4" /></Button></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div></ScrollArea>
              </>
            )}
          </TabsContent>

          {/* ═══ PHOTOS TAB ═══ */}
          <TabsContent value="photos" className="mt-6 space-y-6">
            {!photoStats && !scanningPhotos && <div className="flex flex-col items-center py-12 gap-4"><Camera className="h-10 w-10 text-pink-500" /><h2 className="text-xl font-bold">Scan Photos</h2><Button onClick={scanPhotos} size="lg" className="gap-2"><ScanSearch className="h-5 w-5" />Scan Photos</Button></div>}
            {scanningPhotos && <LoadingSpinner text="Scanning Photos..." />}
            {photoStats && !scanningPhotos && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Storage</p><p className="text-xl font-bold">{photoStats.totalSizeFormatted}</p><p className="text-[10px] text-muted-foreground">{photoStats.totalPhotos} photos</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Large</p><p className="text-xl font-bold text-orange-600">{photoStats.largePhotos}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-[10px] font-medium text-muted-foreground uppercase">Favorites</p><p className="text-xl font-bold text-yellow-600">{photoStats.favorites}</p></CardContent></Card>
                </div>
                {photoSel.size > 0 && <div className="flex gap-2"><Badge variant="secondary">{photoSel.size}</Badge><Button variant="destructive" size="sm" className="gap-1" onClick={() => openDelete('photos', `Delete ${photoSel.size}`, Array.from(photoSel))}><Trash2 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => startBackup(photoItems.filter(p => photoSel.has(p.id)), 'photos')} className="gap-1"><ArchiveRestore className="h-4 w-4" /></Button></div>}
                <ScrollArea className="max-h-[500px]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {photoItems.slice(0, 40).map(p => (
                    <Card key={p.id} className={`overflow-hidden ${photoSel.has(p.id) ? 'ring-2 ring-primary' : ''}`}>
                      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        {p.baseUrl ? <img src={`${p.baseUrl}=w300`} alt={p.filename} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/30" /></div>}
                        <div className="absolute top-2 left-2"><Checkbox checked={photoSel.has(p.id)} onCheckedChange={() => photoToggle(p.id)} className="bg-white/80 border-slate-300" /></div>
                        {p.isFavorite && <div className="absolute top-2 right-2"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /></div>}
                      </div>
                      <CardContent className="p-3"><p className="text-xs font-medium truncate">{p.filename}</p><div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">{fmt(p.size)}</span><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500" onClick={() => downloadFile('photos', p.id, p.filename, p.baseUrl)}><Download className="h-3 w-3" /></Button></div></CardContent>
                    </Card>
                  ))}
                </div></ScrollArea>
              </>
            )}
          </TabsContent>

          {/* ═══ WIZARD TAB ═══ */}
          <TabsContent value="wizard" className="mt-6 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-purple-500" />Smart Cleanup Wizard</CardTitle><CardDescription>Choose how much space you want to free. The wizard will create the safest possible plan.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium whitespace-nowrap">Free up:</Label>
                  <div className="flex items-center gap-2">
                    <Button variant={wizardTarget === 0.5 ? 'default' : 'outline'} size="sm" onClick={() => setWizardTarget(0.5)}>500 MB</Button>
                    <Button variant={wizardTarget === 1 ? 'default' : 'outline'} size="sm" onClick={() => setWizardTarget(1)}>1 GB</Button>
                    <Button variant={wizardTarget === 2 ? 'default' : 'outline'} size="sm" onClick={() => setWizardTarget(2)}>2 GB</Button>
                    <Button variant={wizardTarget === 5 ? 'default' : 'outline'} size="sm" onClick={() => setWizardTarget(5)}>5 GB</Button>
                    <Input type="number" value={wizardTarget} onChange={e => setWizardTarget(Number(e.target.value) || 1)} className="w-20" />
                    <span className="text-sm text-muted-foreground">GB</span>
                  </div>
                  <Button onClick={runWizard} disabled={wizardLoading} className="gap-2 ml-auto"><Rocket className="h-4 w-4" />{wizardLoading ? 'Planning...' : 'Generate Plan'}</Button>
                </div>
                {wizardPlan && (
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200">
                      <Target className="h-5 w-5 text-purple-500" />
                      <div><p className="text-sm font-semibold">Can free up to {wizardPlan.totalCanBeFreedFormatted}</p><p className="text-xs text-muted-foreground">Target: {wizardPlan.targetFormatted} &middot; Estimated time: {wizardPlan.estimatedTime}</p></div>
                    </div>
                    <div className="space-y-2">
                      {wizardPlan.steps.map((step: CleanupStep) => (
                        <Card key={step.id} className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 shrink-0"><span className="text-xs font-bold">{step.order}</span></div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold">{step.action}</span>
                                  <Badge className={`text-[10px] px-1.5 ${RISK_COLORS[step.risk] || ''}`}>{step.risk}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{step.spaceFreedFormatted}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">{step.riskExplanation}</p>
                              </div>
                              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setDriveSel(new Set(step.fileIds)); setTab('drive') }}>View</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TOOLS TAB ═══ */}
          <TabsContent value="tools" className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Cross-service dedup */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={runDedup}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30"><Copy className="h-5 w-5 text-violet-500" /></div><div><p className="text-sm font-semibold">Cross-Service Dedup</p><p className="text-xs text-muted-foreground">Find duplicates across Gmail, Drive & Photos</p></div></div>
                  {dedupLoading && <Progress className="h-1 mt-2" />}
                  {dedupResults && <p className="text-xs text-muted-foreground mt-2">{dedupResults.length} duplicate groups found</p>}
                </CardContent>
              </Card>

              {/* Shared with me */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={loadShared}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30"><Share2 className="h-5 w-5 text-cyan-500" /></div><div><p className="text-sm font-semibold">Shared With Me</p><p className="text-xs text-muted-foreground">Find stale shared files you never open</p></div></div>
                  {sharedLoading && <Progress className="h-1 mt-2" />}
                  {sharedFiles && <p className="text-xs text-muted-foreground mt-2">{sharedFiles.length} stale shared files found</p>}
                </CardContent>
              </Card>

              {/* AI Importance */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { /* Would score all items */ }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><Brain className="h-5 w-5 text-emerald-500" /></div><div><p className="text-sm font-semibold">AI Importance Score</p><p className="text-xs text-muted-foreground">Score emails & files by importance (0-100)</p></div></div>
                </CardContent>
              </Card>

              {/* Attachment Sync */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30"><FileDown className="h-5 w-5 text-amber-500" /></div><div><p className="text-sm font-semibold">Attachment to Drive</p><p className="text-xs text-muted-foreground">Save Gmail attachments to Drive, then delete from Gmail</p></div></div>
                </CardContent>
              </Card>

              {/* Schedules */}
              <Card className="sm:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"><Timer className="h-5 w-5 text-blue-500" /></div><div><p className="text-sm font-semibold">Scheduled Auto-Cleanup</p><p className="text-xs text-muted-foreground">Set rules to run cleanup automatically</p></div></div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={loadSchedules}><RefreshCw className="h-3 w-3" />Load Schedules</Button>
                  </div>
                  {schedules.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {schedules.map((s: any) => (
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
                  {dedupResults.slice(0, 10).map((g: any) => (
                    <div key={g.hashSignature} className="flex items-center gap-3 rounded-lg border p-3">
                      <Copy className="h-4 w-4 text-violet-500 shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{g.fileName}</p><p className="text-xs text-muted-foreground">{g.items.length} copies &middot; {fmt(g.fileSize)} each &middot; Save {fmt(g.spaceRecoverable)}</p></div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{g.services}</Badge>
                    </div>
                  ))}
                </CardContent></Card>
            )}

            {/* Shared files results */}
            {sharedFiles && sharedFiles.length > 0 && (
              <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Stale Shared Files</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {sharedFiles.slice(0, 10).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <Share2 className="h-4 w-4 text-cyan-500 shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-xs text-muted-foreground">From {f.ownerEmail} &middot; {fmt(f.size)} &middot; Not modified in {f.lastAccessedDays}d</p></div>
                    </div>
                  ))}
                </CardContent></Card>
            )}
          </TabsContent>

          {/* ═══ HISTORY TAB ═══ */}
          <TabsContent value="history" className="mt-6 space-y-6">
            <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Cleanup History & Reports</CardTitle></CardHeader>
              <CardContent>
                {reports.length > 0 ? (
                  <div className="space-y-2">
                    {reports.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900/30"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
                        <div className="flex-1"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.summary}</p></div>
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No cleanup history yet. Start cleaning to see reports here.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" />Confirm Deletion</DialogTitle><DialogDescription>{deleteDialog.title} — cannot be undone.</DialogDescription></DialogHeader>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4"><ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside"><li>Items permanently removed</li><li>Cannot be undone</li></ul></div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ ...deleteDialog, open: false })} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="gap-2">{isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Delete</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Dialog */}
      <Dialog open={backupDialog} onOpenChange={setBackupDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5 text-blue-500" />Backup Before Delete</DialogTitle><DialogDescription>Download a ZIP backup of {backupItems.length} items before deleting.</DialogDescription></DialogHeader>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4"><p className="text-xs text-blue-700 dark:text-blue-300">The selected files will be bundled into a ZIP archive and downloaded to your device. After that, you can safely delete them.</p></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupDialog(false)}>Cancel</Button>
            <Button onClick={executeBackup} disabled={backupLoading} className="gap-2">{backupLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating ZIP...</> : <><Download className="h-4 w-4" />Download Backup ZIP</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
