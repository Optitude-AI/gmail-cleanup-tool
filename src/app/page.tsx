'use client'

import { useState, useMemo } from 'react'
import {
  Gauge, Mail, HardDrive, Camera, Wand2, Zap, History, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { getFileType } from '@/lib/types'
import type { GmailAccount, GmailStats, GmailResult, DriveStats, DriveFile, SpaceSuggestion, PhotoStats, PhotoItem, UnifiedStorage, StorageForecast, CleanupStep, WizardPlan, DedupResult, CleanupSchedule, CleanupReport, SharedFile } from '@/lib/types'

import { AuthScreen } from '@/components/app/AuthScreen'
import { AppHeader } from '@/components/app/AppHeader'
import { OverviewTab } from '@/components/app/OverviewTab'
import { GmailTab } from '@/components/app/GmailTab'
import { DriveTab } from '@/components/app/DriveTab'
import { PhotosTab } from '@/components/app/PhotosTab'
import { WizardTab } from '@/components/app/WizardTab'
import { ToolsTab } from '@/components/app/ToolsTab'
import { HistoryTab } from '@/components/app/HistoryTab'
import { DeleteConfirmDialog } from '@/components/app/DeleteConfirmDialog'
import { BackupDialog } from '@/components/app/BackupDialog'

// ═══════════════════════════════════════════════════════════
// MAIN PAGE — Thin Orchestrator
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
  const [wizardPlan, setWizardPlan] = useState<WizardPlan | null>(null)
  const [wizardLoading, setWizardLoading] = useState(false)

  // Dedup
  const [dedupResults, setDedupResults] = useState<DedupResult[] | null>(null)
  const [dedupLoading, setDedupLoading] = useState(false)

  // Schedules
  const [schedules, setSchedules] = useState<CleanupSchedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  // Reports
  const [reports, setReports] = useState<CleanupReport[]>([])

  // Shared
  const [sharedFiles, setSharedFiles] = useState<SharedFile[] | null>(null)
  const [sharedLoading, setSharedLoading] = useState(false)

  // Delete
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; service: string; title: string; ids: string[] }>({ open: false, service: '', title: '', ids: [] })
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Backup
  const [backupDialog, setBackupDialog] = useState(false)
  const [backupItems, setBackupItems] = useState<Array<{ fileId: string; fileName: string; service: string }>>([])
  const [backupLoading, setBackupLoading] = useState(false)

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
  const startBackup = (items: Array<{ id?: string; fileId?: string; name?: string; fileName?: string }>, service: string) => {
    setBackupItems(items.map((i) => ({ fileId: i.id || i.fileId, fileName: i.name || i.fileName, service })))
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

  // ── Computed / Helpers ──
  const gmailFiltered = useMemo(() => gmailResults.filter(r => {
    const ms = !gmailSearch || r.senderEmail.toLowerCase().includes(gmailSearch.toLowerCase()) || r.senderName?.toLowerCase().includes(gmailSearch.toLowerCase())
    const mt = gmailTab === 'all' || r.category === gmailTab
    return ms && mt
  }).sort((a, b) => b.emailCount - a.emailCount), [gmailResults, gmailSearch, gmailTab])

  const driveFiltered = useMemo(() => driveFiles.filter(f => {
    const ms = !driveSearch || f.name.toLowerCase().includes(driveSearch.toLowerCase())
    const mt = driveFilter === 'all' || driveFilter === 'trashed' ? (driveFilter === 'trashed' ? f.trashed : !f.trashed) : getFileType(f.mimeType) === driveFilter
    return ms && mt
  }).sort((a, b) => b.size - a.size), [driveFiles, driveSearch, driveFilter])

  const gmailToggle = (id: string) => setGmailSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  const driveToggle = (id: string) => setDriveSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  const photoToggle = (id: string) => setPhotoSel(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  const handleDisconnect = () => {
    setAccount(null); setGmailStats(null); setDriveStats(null); setPhotoStats(null); setUnifiedStorage(null); setForecast(null)
  }

  const handleTabChange = (v: string) => {
    setTab(v)
    if (v === 'overview' || v === 'wizard') loadStorage()
    if (v === 'history' || v === 'schedules') loadSchedules()
  }

  const handleWizardViewFiles = (fileIds: string[]) => {
    setDriveSel(new Set(fileIds)); setTab('drive')
  }

  // ═══════════════════════ RENDER ═══════════════════════

  if (!account) {
    return (
      <AuthScreen
        error={error}
        isConnecting={isConnecting}
        authUrl={authUrl}
        authCode={authCode}
        onStartOAuth={startOAuth}
        onAuthCodeChange={setAuthCode}
        onCodeSubmit={handleCallback}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <AppHeader email={account.email} onDisconnect={handleDisconnect} />

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        {deleteResult && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">{deleteResult}</AlertDescription>
            <Button variant="ghost" size="sm" className="ml-auto text-emerald-600" onClick={() => setDeleteResult(null)}><XCircle className="h-4 w-4" /></Button>
          </Alert>
        )}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <Tabs value={tab} onValueChange={handleTabChange}>
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

          <TabsContent value="overview" className="mt-6 space-y-6">
            <OverviewTab
              storage={unifiedStorage}
              forecast={forecast}
              loadingStorage={loadingStorage}
              scanGmail={scanGmail}
              scanDrive={scanDrive}
              scanPhotos={scanPhotos}
              scanningGmail={scanningGmail}
              scanningDrive={scanningDrive}
              scanningPhotos={scanningPhotos}
              loadStorage={loadStorage}
              onGoToWizard={() => setTab('wizard')}
            />
          </TabsContent>

          <TabsContent value="gmail" className="mt-6 space-y-6">
            <GmailTab
              scanning={scanningGmail}
              stats={gmailStats}
              results={gmailResults}
              filtered={gmailFiltered}
              selectedIds={gmailSel}
              activeCategory={gmailTab}
              search={gmailSearch}
              onScan={scanGmail}
              onSearchChange={setGmailSearch}
              onToggleSelect={gmailToggle}
              onDelete={(ids) => openDelete('gmail', `Delete ${ids.length} Senders`, ids)}
              onBackup={(items) => startBackup(items, 'gmail')}
              setCategory={setGmailTab}
            />
          </TabsContent>

          <TabsContent value="drive" className="mt-6 space-y-6">
            <DriveTab
              scanning={scanningDrive}
              stats={driveStats}
              filtered={driveFiltered}
              selectedIds={driveSel}
              search={driveSearch}
              filter={driveFilter}
              suggestions={driveSuggestions}
              onScan={scanDrive}
              onSearchChange={setDriveSearch}
              onFilterChange={setDriveFilter}
              onToggleSelect={driveToggle}
              onDelete={(ids) => openDelete('drive', `Delete ${ids.length} Files`, ids)}
              onBackup={(items) => startBackup(items, 'drive')}
              onDownload={(id, name) => downloadFile('drive', id, name)}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-6 space-y-6">
            <PhotosTab
              scanning={scanningPhotos}
              stats={photoStats}
              items={photoItems}
              selectedIds={photoSel}
              onScan={scanPhotos}
              onToggleSelect={photoToggle}
              onDelete={(ids) => openDelete('photos', `Delete ${ids.length}`, ids)}
              onBackup={(items) => startBackup(items, 'photos')}
              onDownload={(id, filename, baseUrl) => downloadFile('photos', id, filename, baseUrl)}
            />
          </TabsContent>

          <TabsContent value="wizard" className="mt-6 space-y-6">
            <WizardTab
              wizardTarget={wizardTarget}
              wizardPlan={wizardPlan}
              wizardLoading={wizardLoading}
              onTargetChange={setWizardTarget}
              onGenerate={runWizard}
              onViewFiles={handleWizardViewFiles}
            />
          </TabsContent>

          <TabsContent value="tools" className="mt-6 space-y-6">
            <ToolsTab
              dedupLoading={dedupLoading}
              dedupResults={dedupResults}
              sharedLoading={sharedLoading}
              sharedFiles={sharedFiles}
              schedulesLoading={schedulesLoading}
              schedules={schedules}
              onRunDedup={runDedup}
              onLoadShared={loadShared}
              onLoadSchedules={loadSchedules}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-6">
            <HistoryTab reports={reports} />
          </TabsContent>
        </Tabs>
      </main>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title={deleteDialog.title}
        itemCount={deleteDialog.ids.length}
        onConfirm={confirmDelete}
        loading={isDeleting}
      />

      <BackupDialog
        open={backupDialog}
        onOpenChange={setBackupDialog}
        itemCount={backupItems.length}
        onConfirm={executeBackup}
        loading={backupLoading}
      />
    </div>
  )
}
