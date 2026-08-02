'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Mail, Trash2, ScanSearch, Link2, Shield, ShieldAlert, Tag,
  ExternalLink, CheckCircle2, AlertCircle, XCircle,
  RefreshCw, Inbox, Search, BarChart3, Clock,
  Ban, LogIn, Loader2, ShieldCheck, Bell, Megaphone,
  MailCheck, Sparkles, Eye, Download, HardDrive, Image as ImageIcon,
  FolderOpen, FileText, Video, Music, Archive, File, Camera,
  AlertTriangle, Lightbulb, ArrowRight, ChevronDown,
  HardDriveDownload, PieChart, Zap, Calendar, Star,
  Trash, MoreVertical, LayoutGrid, List
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ───

interface GmailStats { total: number; subscriptions: number; promotions: number; sales: number; junk: number; totalEmails: number; withUnsubscribe: number }
interface GmailResult { id: string; category: string; senderEmail: string; senderName: string | null; subject: string | null; emailCount: number; lastReceived: string | null; unsubscribeUrl: string | null }

interface DriveStats { totalFiles: number; totalSize: number; totalSizeFormatted: string; trashedFiles: number; trashedSize: number; trashedSizeFormatted: string; largeFiles: number; largeFileSize: number; duplicatesCount: number; byType: Record<string, { count: number; size: number }> }
interface DriveFile { id: string; name: string; mimeType: string; size: number; createdTime: string; modifiedTime: string; trashed: boolean; webViewLink: string; exportName?: string }

interface SpaceSuggestion { id: string; type: string; title: string; description: string; potentialSavings: number; potentialSavingsFormatted: string; severity: string; fileIds: string[]; actionable: boolean }

interface PhotoStats { totalPhotos: number; totalSize: number; totalSizeFormatted: string; favorites: number; largePhotos: number; largePhotoSize: number }
interface PhotoItem { id: string; filename: string; mimeType: string; size: number; width: number; height: number; creationTime: string; baseUrl: string; isFavorite: boolean }

interface GmailAccount { id: string; email: string; createdAt: string }

const GMAIL_CAT: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  subscription: { label: 'Subscriptions', icon: <Bell className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  promotion:   { label: 'Promotions',   icon: <Megaphone className="h-4 w-4" />, color: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
  sales:        { label: 'Sales',         icon: <Tag className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  junk:         { label: 'Junk / Spam',  icon: <Ban className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'Images':    <ImageIcon className="h-5 w-5 text-pink-500" />,
  'Videos':    <Video className="h-5 w-5 text-red-500" />,
  'Audio':     <Music className="h-5 w-5 text-violet-500" />,
  'PDFs':      <FileText className="h-5 w-5 text-red-600" />,
  'Documents': <FileText className="h-5 w-5 text-blue-500" />,
  'Archives':  <Archive className="h-5 w-5 text-yellow-600" />,
  'Other Files': <File className="h-5 w-5 text-slate-500" />,
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200', text: 'text-red-700', icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
  high:     { bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200', text: 'text-orange-700', icon: <AlertCircle className="h-5 w-5 text-orange-500" /> },
  medium:   { bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200', text: 'text-yellow-700', icon: <Lightbulb className="h-5 w-5 text-yellow-500" /> },
  low:      { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200', text: 'text-blue-700', icon: <Lightbulb className="h-5 w-5 text-blue-400" /> },
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Images'
  if (mimeType.startsWith('video/')) return 'Videos'
  if (mimeType.startsWith('audio/')) return 'Audio'
  if (mimeType.includes('pdf')) return 'PDFs'
  if (mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) return 'Documents'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'Archives'
  return 'Other Files'
}

// ─── Main Page ───

export default function GoogleCleanupPage() {
  // Auth state
  const [connectedAccount, setConnectedAccount] = useState<GmailAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Service tab
  const [serviceTab, setServiceTab] = useState('gmail')

  // Gmail state
  const [isScanningGmail, setIsScanningGmail] = useState(false)
  const [gmailProgress, setGmailProgress] = useState(0)
  const [gmailStats, setGmailStats] = useState<GmailStats | null>(null)
  const [gmailResults, setGmailResults] = useState<GmailResult[]>([])
  const [gmailSelectedIds, setGmailSelectedIds] = useState<Set<string>>(new Set())
  const [gmailTab, setGmailTab] = useState('all')
  const [gmailSearch, setGmailSearch] = useState('')

  // Drive state
  const [isScanningDrive, setIsScanningDrive] = useState(false)
  const [driveProgress, setDriveProgress] = useState(0)
  const [driveStats, setDriveStats] = useState<DriveStats | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveSelectedIds, setDriveSelectedIds] = useState<Set<string>>(new Set())
  const [driveSearch, setDriveSearch] = useState('')
  const [driveSuggestions, setDriveSuggestions] = useState<SpaceSuggestion[]>([])
  const [driveFilter, setDriveFilter] = useState<string>('all')
  const [isDownloading, setIsDownloading] = useState(false)

  // Photos state
  const [isScanningPhotos, setIsScanningPhotos] = useState(false)
  const [photoProgress, setPhotoProgress] = useState(0)
  const [photoStats, setPhotoStats] = useState<PhotoStats | null>(null)
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([])
  const [photoSelectedIds, setPhotoSelectedIds] = useState<Set<string>>(new Set())

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; service: string; title: string; ids: string[] }>({ open: false, service: '', title: '', ids: [] })
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)

  // Check for existing accounts
  const checkExistingAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status')
      const data = await res.json()
      if (data.accounts?.length > 0) setConnectedAccount(data.accounts[0])
    } catch { /* empty */ }
  }, [])

  // ─── Auth ───
  const startOAuth = async () => {
    setIsConnecting(true); setError(null)
    try {
      const res = await fetch('/api/gmail/auth')
      const data = await res.json()
      if (data.authUrl) {
        setAuthUrl(data.authUrl)
        window.open(data.authUrl, '_blank', 'width=600,height=700')
      } else setError('Failed to generate auth URL. Check Google API credentials.')
    } catch { setError('Failed to connect to Google.') }
    setIsConnecting(false)
  }

  const handleOAuthCallback = async () => {
    if (!authCode.trim()) return
    setIsConnecting(true); setError(null)
    try {
      const res = await fetch('/api/gmail/callback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim(), userId: 'default-user' }),
      })
      const data = await res.json()
      if (data.success) {
        setConnectedAccount({ id: data.accountId, email: data.email, createdAt: new Date().toISOString() })
        setAuthCode(''); setAuthUrl('')
      } else setError(data.error || 'Authentication failed.')
    } catch { setError('Authentication failed.') }
    setIsConnecting(false)
  }

  // ─── Gmail Scan ───
  const scanGmail = async () => {
    if (!connectedAccount) return
    setIsScanningGmail(true); setError(null); setGmailProgress(0)
    const pi = setInterval(() => setGmailProgress(p => Math.min(p + Math.random() * 15, 90)), 500)
    try {
      const res = await fetch('/api/gmail/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: connectedAccount.id }) })
      const data = await res.json()
      clearInterval(pi)
      if (data.success) { setGmailProgress(100); setGmailStats(data.stats); setGmailResults(data.results) }
      else setError(data.error || 'Gmail scan failed.')
    } catch { clearInterval(pi); setError('Gmail scan failed.') }
    setIsScanningGmail(false)
  }

  // ─── Drive Scan ───
  const scanDrive = async () => {
    if (!connectedAccount) return
    setIsScanningDrive(true); setError(null); setDriveProgress(0)
    const pi = setInterval(() => setDriveProgress(p => Math.min(p + Math.random() * 10, 90)), 500)
    try {
      const res = await fetch('/api/drive/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: connectedAccount.id }) })
      const data = await res.json()
      clearInterval(pi)
      if (data.success) {
        setDriveProgress(100); setDriveStats(data.stats); setDriveFiles(data.files)
        // Also get suggestions
        const sugRes = await fetch('/api/drive/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: connectedAccount.id }) })
        const sugData = await sugRes.json()
        if (sugData.success) setDriveSuggestions(sugData.suggestions)
      } else setError(data.error || 'Drive scan failed.')
    } catch { clearInterval(pi); setError('Drive scan failed.') }
    setIsScanningDrive(false)
  }

  // ─── Photos Scan ───
  const scanPhotos = async () => {
    if (!connectedAccount) return
    setIsScanningPhotos(true); setError(null); setPhotoProgress(0)
    const pi = setInterval(() => setPhotoProgress(p => Math.min(p + Math.random() * 12, 90)), 500)
    try {
      const res = await fetch('/api/photos/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: connectedAccount.id }) })
      const data = await res.json()
      clearInterval(pi)
      if (data.success) { setPhotoProgress(100); setPhotoStats(data.stats); setPhotoItems(data.photos) }
      else setError(data.error || 'Photos scan failed.')
    } catch { clearInterval(pi); setError('Photos scan failed.') }
    setIsScanningPhotos(false)
  }

  // ─── Download ───
  const downloadFile = async (service: string, fileId: string, fileName: string, baseUrl?: string) => {
    setIsDownloading(true)
    try {
      const res = await fetch(`/api/${service}/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectedAccount?.id, fileId, baseUrl }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
      } else setError('Download failed.')
    } catch { setError('Download failed.') }
    setIsDownloading(false)
  }

  // ─── Delete ───
  const openDeleteDialog = (service: string, title: string, ids: string[]) => {
    setDeleteDialog({ open: true, service, title, ids })
  }

  const confirmDelete = async () => {
    if (!connectedAccount) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/${deleteDialog.service}/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectedAccount.id, fileIds: deleteDialog.ids }),
      })
      const data = await res.json()
      if (data.success) { setDeleteResult(data.message); setDeleteDialog({ ...deleteDialog, open: false }) }
      else setError(data.error || 'Delete failed.')
    } catch { setError('Delete failed.') }
    setIsDeleting(false)
  }

  // ─── Gmail helpers ───
  const gmailFiltered = gmailResults.filter(r => {
    const ms = !gmailSearch || r.senderEmail.toLowerCase().includes(gmailSearch.toLowerCase()) || r.senderName?.toLowerCase().includes(gmailSearch.toLowerCase())
    const mt = gmailTab === 'all' || r.category === gmailTab
    return ms && mt
  }).sort((a, b) => b.emailCount - a.emailCount)

  const gmailToggle = (id: string) => {
    setGmailSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  const gmailSelectAll = () => {
    const filtered = gmailTab === 'all' ? gmailFiltered : gmailFiltered.filter(r => r.category === gmailTab)
    const allSel = filtered.every(r => gmailSelectedIds.has(r.id))
    const n = new Set(gmailSelectedIds)
    filtered.forEach(r => allSel ? n.delete(r.id) : n.add(r.id))
    setGmailSelectedIds(n)
  }

  // ─── Drive helpers ───
  const driveFiltered = driveFiles.filter(f => {
    const ms = !driveSearch || f.name.toLowerCase().includes(driveSearch.toLowerCase())
    const mt = driveFilter === 'all' || driveFilter === 'trashed' ? (driveFilter === 'trashed' ? f.trashed : !f.trashed) : getFileType(f.mimeType) === driveFilter
    return ms && mt
  }).sort((a, b) => b.size - a.size)

  const driveToggle = (id: string) => {
    setDriveSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  // ─── Photo helpers ───
  const photoFiltered = photoItems.filter(p => !photoSelectedIds.size || true).sort((a, b) => b.size - a.size)

  const photoToggle = (id: string) => {
    setPhotoSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  // ─── Connect Screen ───
  if (!connectedAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-200 dark:shadow-red-900/30">
              <HardDrive className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Google Cleanup Tool</h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg">Clean up Gmail, Google Drive &amp; Photos. Find subscriptions, junk mail, large files, and get smart space-saving suggestions.</p>
            </div>
            <div className="grid gap-4 w-full max-w-md sm:grid-cols-3">
              {[
                { icon: <Mail className="h-5 w-5" />, t: 'Gmail', d: 'Unsubscribe & delete junk' },
                { icon: <HardDrive className="h-5 w-5" />, t: 'Drive', d: 'Find large & duplicate files' },
                { icon: <Camera className="h-5 w-5" />, t: 'Photos', d: 'Manage photo storage' },
              ].map(item => (
                <div key={item.t} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                  <div className="text-orange-500">{item.icon}</div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.t}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{item.d}</span>
                </div>
              ))}
            </div>
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" />Connect Your Google Account</CardTitle>
                <CardDescription>Secure OAuth2 access to Gmail, Drive, and Photos. Your credentials are never stored.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <Button onClick={startOAuth} disabled={isConnecting} className="w-full h-12 text-base font-semibold" size="lg">
                  {isConnecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                  {isConnecting ? 'Connecting...' : 'Connect with Google'}
                </Button>
                {authUrl && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Separator className="flex-1" /><span>or paste authorization code</span><Separator className="flex-1" /></div>
                    <div className="flex gap-2">
                      <Input value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="Paste the authorization code here..." className="flex-1" />
                      <Button onClick={handleOAuthCallback} disabled={!authCode.trim() || isConnecting}>Verify</Button>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Read-only access for scanning. Modify access only for actions you explicitly approve (delete, download).</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ─── Connected Dashboard ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
              <HardDrive className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Google Cleanup</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{connectedAccount.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setConnectedAccount(null); setGmailStats(null); setDriveStats(null); setPhotoStats(null) }} className="text-slate-600">Disconnect</Button>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Delete Result */}
        {deleteResult && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">{deleteResult}</AlertDescription>
            <Button variant="ghost" size="sm" className="ml-auto text-emerald-600" onClick={() => setDeleteResult(null)}><XCircle className="h-4 w-4" /></Button>
          </Alert>
        )}

        {/* Service Tabs */}
        <Tabs value={serviceTab} onValueChange={setServiceTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gmail" className="gap-2"><Mail className="h-4 w-4" /><span className="hidden sm:inline">Gmail</span></TabsTrigger>
            <TabsTrigger value="drive" className="gap-2"><HardDrive className="h-4 w-4" /><span className="hidden sm:inline">Drive</span></TabsTrigger>
            <TabsTrigger value="photos" className="gap-2"><Camera className="h-4 w-4" /><span className="hidden sm:inline">Photos</span></TabsTrigger>
          </TabsList>

          {/* ═══════════════════════ GMAIL TAB ═══════════════════════ */}
          <TabsContent value="gmail" className="mt-6 space-y-6">
            {!gmailStats && !isScanningGmail && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40"><Sparkles className="h-10 w-10 text-red-500" /></div>
                <div className="text-center space-y-2 max-w-md">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scan Gmail</h2>
                  <p className="text-slate-600 dark:text-slate-400">Find subscriptions, promotional emails, junk mail, and sales messages. Then unsubscribe or delete them in bulk.</p>
                </div>
                <Button onClick={scanGmail} size="lg" className="h-12 text-base font-semibold px-8 gap-2"><ScanSearch className="h-5 w-5" />Scan My Gmail</Button>
              </div>
            )}
            {isScanningGmail && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 animate-pulse"><ScanSearch className="h-10 w-10 text-red-500 animate-spin" /></div>
                <div className="text-center space-y-2"><h2 className="text-xl font-bold text-slate-900 dark:text-white">Scanning Gmail...</h2><p className="text-sm text-slate-600 dark:text-slate-400">Analyzing your emails for subscriptions and junk mail.</p></div>
                <div className="w-full max-w-md space-y-2"><Progress value={gmailProgress} className="h-2" /></div>
              </div>
            )}
            {gmailStats && !isScanningGmail && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Card className="border-slate-200 dark:border-slate-700"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Senders</p><p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{gmailStats.total}</p><p className="text-xs text-muted-foreground mt-2">{gmailStats.totalEmails} total emails</p></CardContent></Card>
                  {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => {
                    const c = GMAIL_CAT[cat]; const count = gmailStats[cat as keyof GmailStats] as number
                    return (
                      <Card key={cat} className={c.border}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</p><p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{count}</p></div>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}><span className={c.color}>{c.icon}</span></div>
                          </div>
                          <Button variant="ghost" size="sm" className={`h-7 text-xs mt-2 ${c.color} px-0`} onClick={() => { setGmailSelectedIds(new Set(gmailResults.filter(r => r.category === cat).map(r => r.id))); openDeleteDialog('gmail', `Delete All ${c.label}`, gmailResults.filter(r => r.category === cat).flatMap(r => { try { return JSON.parse((r as any).messageIds || '[]') } catch { return [] } })) }}>
                            <Trash2 className="h-3 w-3 mr-1" />Delete All
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={gmailSearch} onChange={e => setGmailSearch(e.target.value)} placeholder="Search by sender, subject..." className="pl-9" /></div>
                  {gmailSelectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{gmailSelectedIds.size} selected</Badge>
                      <Button variant="destructive" size="sm" className="gap-1" onClick={() => openDeleteDialog('gmail', `Delete ${gmailSelectedIds.size} Senders`, [])}><Trash2 className="h-4 w-4" />Delete</Button>
                      <Button variant="ghost" size="sm" onClick={() => setGmailSelectedIds(new Set())}>Clear</Button>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={scanGmail} className="gap-1"><RefreshCw className="h-4 w-4" />Re-scan</Button>
                </div>
                <Tabs value={gmailTab} onValueChange={setGmailTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all">All ({gmailStats.total})</TabsTrigger>
                    {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => (
                      <TabsTrigger key={cat} value={cat} className="text-xs">{GMAIL_CAT[cat].label} ({gmailStats[cat as keyof GmailStats] as number})</TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value={gmailTab} className="mt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Checkbox checked={gmailFiltered.length > 0 && gmailFiltered.every(r => gmailSelectedIds.has(r.id))} onCheckedChange={gmailSelectAll} />
                      <span className="text-sm text-muted-foreground">Select all ({gmailFiltered.length})</span>
                    </div>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {gmailFiltered.map(result => {
                          const c = GMAIL_CAT[result.category] || GMAIL_CAT.subscription; const sel = gmailSelectedIds.has(result.id)
                          return (
                            <Card key={result.id} className={`${c.border} transition-all hover:shadow-md ${sel ? 'ring-2 ring-primary' : ''}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Checkbox checked={sel} onCheckedChange={() => gmailToggle(result.id)} className="mt-1" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-semibold text-sm truncate ${c.color}`}>{result.senderName || result.senderEmail}</span>
                                      <Badge variant="outline" className={`${c.bg} ${c.color} border-0 text-[10px] px-1.5`}>{c.label}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{result.emailCount} email{result.emailCount !== 1 ? 's' : ''}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{result.senderEmail}</p>
                                    {result.unsubscribeUrl && (
                                      <a href={result.unsubscribeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium mt-2">
                                        <Link2 className="h-3 w-3" />Unsubscribe<ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                        {gmailFiltered.length === 0 && <div className="flex flex-col items-center py-12 text-center"><Inbox className="h-12 w-12 text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-3">No senders match your search.</p></div>}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════════ DRIVE TAB ═══════════════════════ */}
          <TabsContent value="drive" className="mt-6 space-y-6">
            {!driveStats && !isScanningDrive && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-950/40 dark:to-cyan-950/40"><FolderOpen className="h-10 w-10 text-blue-500" /></div>
                <div className="text-center space-y-2 max-w-md">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scan Google Drive</h2>
                  <p className="text-slate-600 dark:text-slate-400">Analyze your Drive for large files, duplicates, trash items, and get smart space-saving suggestions.</p>
                </div>
                <Button onClick={scanDrive} size="lg" className="h-12 text-base font-semibold px-8 gap-2"><ScanSearch className="h-5 w-5" />Scan My Drive</Button>
              </div>
            )}
            {isScanningDrive && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 animate-pulse"><ScanSearch className="h-10 w-10 text-blue-500 animate-spin" /></div>
                <div className="text-center space-y-2"><h2 className="text-xl font-bold text-slate-900 dark:text-white">Scanning Drive...</h2><p className="text-sm text-slate-600 dark:text-slate-400">Indexing your files and analyzing storage usage.</p></div>
                <div className="w-full max-w-md"><Progress value={driveProgress} className="h-2" /></div>
              </div>
            )}
            {driveStats && !isScanningDrive && (
              <>
                {/* Drive Stats Overview */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Total Storage</p><p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{driveStats.totalSizeFormatted}</p><p className="text-xs text-muted-foreground mt-2">{driveStats.totalFiles} files</p></CardContent></Card>
                  <Card className="border-red-200 dark:border-red-800"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">In Trash</p><p className="text-2xl font-bold text-red-600 mt-1">{driveStats.trashedSizeFormatted}</p><p className="text-xs text-muted-foreground mt-2">{driveStats.trashedFiles} files</p></CardContent></Card>
                  <Card className="border-orange-200 dark:border-orange-800"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Large Files</p><p className="text-2xl font-bold text-orange-600 mt-1">{driveStats.largeFiles} files</p><p className="text-xs text-muted-foreground mt-2">Over 100 MB each</p></CardContent></Card>
                  <Card className="border-yellow-200 dark:border-yellow-800"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Duplicates</p><p className="text-2xl font-bold text-yellow-600 mt-1">{driveStats.duplicatesCount} files</p><p className="text-xs text-muted-foreground mt-2">Same name &amp; size</p></CardContent></Card>
                </div>

                {/* Storage Breakdown */}
                {driveStats.byType && Object.keys(driveStats.byType).length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" />Storage Breakdown</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(driveStats.byType).sort((a, b) => b[1].size - a[1].size).map(([type, data]) => (
                          <div key={type} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">{FILE_TYPE_ICONS[type] || <File className="h-5 w-5 text-slate-500" />}</div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{type}</p><p className="text-xs text-muted-foreground">{data.count} files &middot; {formatBytes(data.size)}</p></div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Smart Suggestions */}
                {driveSuggestions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />Smart Space-Saving Suggestions</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {driveSuggestions.map(sug => {
                        const style = SEVERITY_STYLES[sug.severity] || SEVERITY_STYLES.low
                        return (
                          <div key={sug.id} className={`rounded-lg border p-4 ${style.bg}`}>
                            <div className="flex items-start gap-3">
                              {style.icon}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold text-sm ${style.text}`}>{sug.title}</span>
                                  {sug.potentialSavings > 0 && <Badge variant="outline" className="text-[10px] bg-white/50 dark:bg-black/20">Save {sug.potentialSavingsFormatted}</Badge>}
                                  <Badge variant="outline" className="text-[10px] bg-white/50 dark:bg-black/20 capitalize">{sug.severity}</Badge>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{sug.description}</p>
                                {sug.actionable && (
                                  <div className="flex gap-2 mt-3">
                                    {sug.type === 'empty_trash' && (
                                      <Button variant="destructive" size="sm" className="gap-1 text-xs" onClick={() => openDeleteDialog('drive', 'Empty Trash Permanently', sug.fileIds)}>
                                        <Trash className="h-3 w-3" />Empty Trash
                                      </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setDriveSelectedIds(new Set(sug.fileIds)); setDriveFilter('all') }}>
                                      <Eye className="h-3 w-3" />View Files
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Drive File List */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={driveSearch} onChange={e => setDriveSearch(e.target.value)} placeholder="Search files..." className="pl-9" /></div>
                  <div className="flex gap-2 overflow-x-auto">
                    <Button variant={driveFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setDriveFilter('all')}>All</Button>
                    {driveStats.byType && Object.keys(driveStats.byType).slice(0, 5).map(type => (
                      <Button key={type} variant={driveFilter === type ? 'default' : 'outline'} size="sm" onClick={() => setDriveFilter(type)} className="whitespace-nowrap">{type}</Button>
                    ))}
                    {driveStats.trashedFiles > 0 && <Button variant={driveFilter === 'trashed' ? 'destructive' : 'outline'} size="sm" onClick={() => setDriveFilter('trashed')}>Trash ({driveStats.trashedFiles})</Button>}
                  </div>
                  {driveSelectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{driveSelectedIds.size} selected</Badge>
                      <Button variant="destructive" size="sm" className="gap-1" onClick={() => openDeleteDialog('drive', `Delete ${driveSelectedIds.size} Files`, Array.from(driveSelectedIds))}><Trash2 className="h-4 w-4" />Delete</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDriveSelectedIds(new Set())}>Clear</Button>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={scanDrive} className="gap-1"><RefreshCw className="h-4 w-4" />Re-scan</Button>
                </div>

                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {driveFiltered.slice(0, 100).map(file => {
                      const sel = driveSelectedIds.has(file.id); const type = getFileType(file.mimeType)
                      return (
                        <Card key={file.id} className={`${file.trashed ? 'border-red-200 dark:border-red-800 opacity-60' : ''} ${sel ? 'ring-2 ring-primary' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox checked={sel} onCheckedChange={() => driveToggle(file.id)} className="mt-1" />
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                {FILE_TYPE_ICONS[type] || <File className="h-5 w-5 text-slate-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm truncate ${file.trashed ? 'line-through text-muted-foreground' : ''}`}>{file.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
                                  <span className="text-[10px] text-muted-foreground">&middot; {type}</span>
                                  {file.modifiedTime && <span className="text-[10px] text-muted-foreground">&middot; {new Date(file.modifiedTime).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => downloadFile('drive', file.id, file.name)} title="Download">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" title="Open in Drive"><ExternalLink className="h-4 w-4" /></Button>
                                </a>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                    {driveFiltered.length === 0 && <div className="flex flex-col items-center py-12 text-center"><FolderOpen className="h-12 w-12 text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-3">No files match your search.</p></div>}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════════ PHOTOS TAB ═══════════════════════ */}
          <TabsContent value="photos" className="mt-6 space-y-6">
            {!photoStats && !isScanningPhotos && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950/40 dark:to-purple-950/40"><Camera className="h-10 w-10 text-pink-500" /></div>
                <div className="text-center space-y-2 max-w-md">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scan Google Photos</h2>
                  <p className="text-slate-600 dark:text-slate-400">Find large photos, screenshots, and get smart storage optimization suggestions.</p>
                </div>
                <Button onClick={scanPhotos} size="lg" className="h-12 text-base font-semibold px-8 gap-2"><ScanSearch className="h-5 w-5" />Scan My Photos</Button>
              </div>
            )}
            {isScanningPhotos && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 animate-pulse"><ScanSearch className="h-10 w-10 text-pink-500 animate-spin" /></div>
                <div className="text-center space-y-2"><h2 className="text-xl font-bold text-slate-900 dark:text-white">Scanning Photos...</h2></div>
                <div className="w-full max-w-md"><Progress value={photoProgress} className="h-2" /></div>
              </div>
            )}
            {photoStats && !isScanningPhotos && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Photo Storage</p><p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{photoStats.totalSizeFormatted}</p><p className="text-xs text-muted-foreground mt-2">{photoStats.totalPhotos} photos</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Large Photos</p><p className="text-2xl font-bold text-orange-600 mt-1">{photoStats.largePhotos}</p><p className="text-xs text-muted-foreground mt-2">Over 10 MB each</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">Favorites</p><p className="text-2xl font-bold text-yellow-600 mt-1">{photoStats.favorites}</p><p className="text-xs text-muted-foreground mt-2">Starred photos</p></CardContent></Card>
                </div>

                {photoSelectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{photoSelectedIds.size} selected</Badge>
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => openDeleteDialog('photos', `Delete ${photoSelectedIds.size} Photos`, Array.from(photoSelectedIds))}><Trash2 className="h-4 w-4" />Delete</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPhotoSelectedIds(new Set())}>Clear</Button>
                  </div>
                )}

                <ScrollArea className="max-h-[500px]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {photoFiltered.slice(0, 60).map(photo => {
                      const sel = photoSelectedIds.has(photo.id)
                      return (
                        <Card key={photo.id} className={`overflow-hidden ${sel ? 'ring-2 ring-primary' : ''}`}>
                          <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                            {photo.baseUrl ? (
                              <img src={`${photo.baseUrl}=w400`} alt={photo.filename} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-12 w-12 text-muted-foreground/30" /></div>
                            )}
                            <div className="absolute top-2 left-2">
                              <Checkbox checked={sel} onCheckedChange={() => photoToggle(photo.id)} className="bg-white/80 dark:bg-black/50 border-slate-300" />
                            </div>
                            {photo.isFavorite && <div className="absolute top-2 right-2"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /></div>}
                          </div>
                          <CardContent className="p-3">
                            <p className="text-xs font-medium truncate">{photo.filename}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground">{formatBytes(photo.size)}</span>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500" onClick={() => downloadFile('photos', photo.id, photo.filename, photo.baseUrl)} title="Download"><Download className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
                {photoFiltered.length === 0 && <div className="flex flex-col items-center py-12 text-center"><Camera className="h-12 w-12 text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-3">No photos found.</p></div>}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" />Confirm Deletion</DialogTitle>
            <DialogDescription>{deleteDialog.title} — this action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200"><AlertCircle className="h-4 w-4" />Important</div>
            <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              <li>Items will be permanently removed</li>
              <li>This action cannot be undone</li>
            </ul>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ ...deleteDialog, open: false })} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="gap-2">
              {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Permanently Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
