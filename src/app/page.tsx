'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Mail, Trash2, ScanSearch, Link2, Shield, ShieldAlert, Tag,
  ChevronRight, ExternalLink, CheckCircle2, AlertCircle, XCircle,
  RefreshCw, Inbox, Zap, Search, Filter, BarChart3, Clock,
  Ban, TrendingDown, ArrowDownToLine, Settings2, LogIn,
  ChevronDown, Loader2, ShieldCheck, Bell, Megaphone,
  MailCheck, Sparkles, Eye
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ScanStats {
  total: number
  subscriptions: number
  promotions: number
  sales: number
  junk: number
  totalEmails: number
  withUnsubscribe: number
}

interface ScanResult {
  id: string
  accountId: string
  category: string
  senderEmail: string
  senderName: string | null
  subject: string | null
  threadId: string
  messageIds: string[]
  emailCount: number
  lastReceived: string | null
  unsubscribeUrl: string | null
  scannedAt: string
}

interface GmailAccount {
  id: string
  email: string
  createdAt: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  subscription: {
    label: 'Subscriptions',
    icon: <Bell className="h-4 w-4" />,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  promotion: {
    label: 'Promotions',
    icon: <Megaphone className="h-4 w-4" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  sales: {
    label: 'Sales',
    icon: <Tag className="h-4 w-4" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  junk: {
    label: 'Junk / Spam',
    icon: <Ban className="h-4 w-4" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
}

export default function GmailCleanupPage() {
  const [connectedAccount, setConnectedAccount] = useState<GmailAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('all')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'selected' | 'category'>('selected')
  const [deleteCategory, setDeleteCategory] = useState<string>('')
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; failed: number; message: string } | null>(null)
  const [authUrl, setAuthUrl] = useState<string>('')
  const [authCode, setAuthCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'count' | 'date' | 'sender'>('count')

  const checkExistingAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status')
      const data = await res.json()
      if (data.accounts && data.accounts.length > 0) {
        setConnectedAccount(data.accounts[0])
      }
    } catch {
      // No accounts found
    }
  }, [])

  // Check for existing connected accounts on mount
  useEffect(() => {
    checkExistingAccounts()
  }, [checkExistingAccounts])

  const startOAuth = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/gmail/auth')
      const data = await res.json()
      if (data.authUrl) {
        setAuthUrl(data.authUrl)
        // Open the auth URL in a new window
        window.open(data.authUrl, '_blank', 'width=600,height=700')
      } else {
        setError('Failed to generate authorization URL. Please check Google API credentials.')
      }
    } catch {
      setError('Failed to connect to Google. Please try again.')
    }
    setIsConnecting(false)
  }

  const handleOAuthCallback = async () => {
    if (!authCode.trim()) return
    setIsConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/gmail/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim(), userId: 'default-user' }),
      })
      const data = await res.json()
      if (data.success) {
        setConnectedAccount({ id: data.accountId, email: data.email, createdAt: new Date().toISOString() })
        setAuthCode('')
        setAuthUrl('')
      } else {
        setError(data.error || 'Failed to authenticate with Google.')
      }
    } catch {
      setError('Failed to complete authentication. Please try again.')
    }
    setIsConnecting(false)
  }

  const startScan = async () => {
    if (!connectedAccount) return
    setIsScanning(true)
    setError(null)
    setScanProgress(0)
    setResults([])
    setStats(null)
    setSelectedIds(new Set())

    // Simulate progress
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + Math.random() * 15, 90))
    }, 500)

    try {
      const res = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectedAccount.id }),
      })
      const data = await res.json()
      clearInterval(progressInterval)

      if (data.success) {
        setScanProgress(100)
        setStats(data.stats)
        setResults(data.results)
      } else {
        setError(data.error || 'Failed to scan emails.')
      }
    } catch {
      clearInterval(progressInterval)
      setError('Failed to scan emails. Please check your connection and try again.')
    }
    setIsScanning(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = (category: string) => {
    const filtered = category === 'all'
      ? results
      : results.filter(r => r.category === category)
    
    const allSelected = filtered.every(r => selectedIds.has(r.id))
    const newSelected = new Set(selectedIds)
    
    if (allSelected) {
      filtered.forEach(r => newSelected.delete(r.id))
    } else {
      filtered.forEach(r => newSelected.add(r.id))
    }
    setSelectedIds(newSelected)
  }

  const openDeleteConfirm = (mode: 'selected' | 'category', category?: string) => {
    setDeleteMode(mode)
    setDeleteCategory(category || '')
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    setError(null)
    setDeleteResult(null)
    try {
      const body: any = { accountId: connectedAccount?.id }
      if (deleteMode === 'selected') {
        body.scanResultIds = Array.from(selectedIds)
      } else {
        body.allInCategory = true
        body.category = deleteCategory
      }

      const res = await fetch('/api/gmail/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        setDeleteResult(data)
        setDeleteConfirmOpen(false)
        setSelectedIds(new Set())
        // Refresh scan
        if (connectedAccount) {
          const scanRes = await fetch('/api/gmail/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: connectedAccount.id }),
          })
          const scanData = await scanRes.json()
          if (scanData.success) {
            setStats(scanData.stats)
            setResults(scanData.results)
          }
        }
      } else {
        setError(data.error || 'Failed to delete emails.')
      }
    } catch {
      setError('Failed to delete emails. Please try again.')
    }
    setIsDeleting(false)
  }

  const filteredResults = results.filter(r => {
    const matchesSearch = !searchQuery ||
      r.senderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || r.category === activeTab
    return matchesSearch && matchesTab
  }).sort((a, b) => {
    if (sortOrder === 'count') return b.emailCount - a.emailCount
    if (sortOrder === 'date') return (b.lastReceived || '').localeCompare(a.lastReceived || '')
    return a.senderEmail.localeCompare(b.senderEmail)
  })

  // ---- RENDER ----

  // Step 1: Not connected
  if (!connectedAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <div className="flex flex-col items-center gap-8 text-center">
            {/* Logo / Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-200 dark:shadow-red-900/30">
              <Mail className="h-10 w-10 text-white" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Gmail Cleanup Tool
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg">
                Find subscriptions, junk mail, and promotional emails in your Gmail.
                Unsubscribe instantly or bulk delete unwanted messages.
              </p>
            </div>

            <div className="grid gap-4 w-full max-w-md sm:grid-cols-3">
              {[
                { icon: <ScanSearch className="h-5 w-5" />, title: 'Scan', desc: 'Find subscriptions & junk' },
                { icon: <Link2 className="h-5 w-5" />, title: 'Unsubscribe', desc: 'One-click unsubscribe' },
                { icon: <Trash2 className="h-5 w-5" />, title: 'Bulk Delete', desc: 'Remove thousands at once' },
              ].map(item => (
                <div key={item.title} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                  <div className="text-orange-500">{item.icon}</div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                </div>
              ))}
            </div>

            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Connect Your Gmail
                </CardTitle>
                <CardDescription>
                  We use Google OAuth2 to securely access your Gmail. Your credentials are never stored — only access tokens.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={startOAuth}
                  disabled={isConnecting}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect with Google'}
                </Button>

                {authUrl && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Separator className="flex-1" />
                      <span>or paste authorization code</span>
                      <Separator className="flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={authCode}
                        onChange={e => setAuthCode(e.target.value)}
                        placeholder="Paste the authorization code here..."
                        className="flex-1"
                      />
                      <Button onClick={handleOAuthCallback} disabled={!authCode.trim() || isConnecting}>
                        Verify
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After authorizing, Google will show a code. Copy and paste it above.
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Read-only access to scan emails. Modify access only for actions you approve.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Connected — Main Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Gmail Cleanup</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{connectedAccount.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                <MailCheck className="h-3 w-3" />
                {stats.totalEmails} emails scanned
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConnectedAccount(null)
                setStats(null)
                setResults([])
                setSelectedIds(new Set())
              }}
              className="text-slate-600"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Delete Result Banner */}
        {deleteResult && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
              {deleteResult.message}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-emerald-600 hover:text-emerald-800"
              onClick={() => setDeleteResult(null)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {error && !connectedAccount && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pre-Scan State */}
        {!stats && !isScanning && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40">
              <Sparkles className="h-12 w-12 text-red-500" />
            </div>
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to Clean Up</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Scan your Gmail for subscriptions, promotional emails, junk mail, and sales messages. Then unsubscribe or delete them in bulk.
              </p>
            </div>
            <Button onClick={startScan} size="lg" className="h-12 text-base font-semibold px-8 gap-2">
              <ScanSearch className="h-5 w-5" />
              Start Scanning My Gmail
            </Button>
            <div className="grid gap-3 sm:grid-cols-4 text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
              <div className="flex flex-col items-center gap-1">
                <Bell className="h-4 w-4 text-orange-500" />
                <span>Subscriptions</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Megaphone className="h-4 w-4 text-purple-500" />
                <span>Promotions</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Tag className="h-4 w-4 text-emerald-500" />
                <span>Sales</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Ban className="h-4 w-4 text-red-500" />
                <span>Junk / Spam</span>
              </div>
            </div>
          </div>
        )}

        {/* Scanning State */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 animate-pulse">
              <ScanSearch className="h-10 w-10 text-red-500 animate-spin" />
            </div>
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Scanning Your Gmail...</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We're analyzing your emails for subscriptions, promotions, and junk mail. This may take a moment.
              </p>
            </div>
            <div className="w-full max-w-md space-y-2">
              <Progress value={scanProgress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {scanProgress < 30 ? 'Connecting to Gmail...' :
                 scanProgress < 60 ? 'Fetching email data...' :
                 scanProgress < 90 ? 'Analyzing senders...' : 'Finalizing results...'}
              </p>
            </div>
          </div>
        )}

        {/* Scan Results */}
        {stats && !isScanning && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Senders</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{stats.totalEmails} total emails</p>
                </CardContent>
              </Card>

              {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => {
                const config = CATEGORY_CONFIG[cat]
                const count = stats[cat as keyof ScanStats] as number
                return (
                  <Card key={cat} className={`${config.borderColor}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{config.label}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{count}</p>
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                          <span className={config.color}>{config.icon}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs ${config.color} hover:${config.bgColor} px-0`}
                          onClick={() => openDeleteConfirm('category', cat)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete All
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Unsubscribe Stats */}
            {stats.withUnsubscribe > 0 && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                <Link2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">{stats.withUnsubscribe}</span> senders have unsubscribe links available. You can unsubscribe before deleting.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by sender, subject..."
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort:</Label>
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as 'count' | 'date' | 'sender')}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="count">Email Count</option>
                  <option value="date">Most Recent</option>
                  <option value="sender">Sender Name</option>
                </select>
              </div>

              <Separator orientation="vertical" className="hidden sm:block h-9" />

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteConfirm('selected')}
                    className="gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={startScan} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Re-scan
              </Button>
            </div>

            {/* Category Tabs + Results */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" className="gap-1">
                  All ({stats.total})
                </TabsTrigger>
                {(['subscription', 'promotion', 'sales', 'junk'] as const).map(cat => (
                  <TabsTrigger key={cat} value={cat} className="gap-1 text-xs sm:text-sm">
                    <span className="hidden sm:inline">{CATEGORY_CONFIG[cat].label}</span>
                    <span className="sm:hidden">{cat.slice(0, 4)}</span>
                    ({stats[cat as keyof ScanStats] as number})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {/* Select all */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={filteredResults.length > 0 && filteredResults.every(r => selectedIds.has(r.id))}
                    onCheckedChange={() => selectAll(activeTab)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all {activeTab === 'all' ? '' : CATEGORY_CONFIG[activeTab]?.label + ' ' }({filteredResults.length})
                  </span>
                </div>

                {/* Results List */}
                {filteredResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground mt-3">
                      {searchQuery ? 'No senders match your search.' : 'No emails found in this category.'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <div className="space-y-2">
                      {filteredResults.map(result => {
                        const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.subscription
                        const isSelected = selectedIds.has(result.id)

                        return (
                          <Card
                            key={result.id}
                            className={`${config.borderColor} transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(result.id)}
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm truncate ${config.color}`}>
                                      {result.senderName || result.senderEmail}
                                    </span>
                                    <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 text-[10px] font-medium px-1.5 py-0`}>
                                      {config.label}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {result.emailCount} email{result.emailCount !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {result.senderEmail}
                                  </p>
                                  {result.subject && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                                      {result.subject}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    {result.lastReceived && (
                                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {new Date(result.lastReceived).toLocaleDateString()}
                                      </span>
                                    )}
                                    {result.unsubscribeUrl && (
                                      <a
                                        href={result.unsubscribeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <Link2 className="h-3 w-3" />
                                        Unsubscribe
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => {
                                      setSelectedIds(new Set([result.id]))
                                      openDeleteConfirm('selected')
                                    }}
                                    title="Delete emails from this sender"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  {result.unsubscribeUrl && (
                                    <a
                                      href={result.unsubscribeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Unsubscribe"
                                    >
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                      >
                                        <Link2 className="h-4 w-4" />
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>

            {/* Summary Stats */}
            <Card className="border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowDownToLine className="h-4 w-4" />
                      Showing {filteredResults.length} of {results.length} senders
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>{results.reduce((s, r) => s + r.emailCount, 0)} total emails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      Quick Cleanup
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirm('category', 'junk')}
                      className="gap-1 text-xs"
                    >
                      <Ban className="h-3 w-3" />
                      Delete All Junk
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openDeleteConfirm('category', 'subscription')}
                      className="gap-1 text-xs"
                    >
                      <Bell className="h-3 w-3" />
                      Delete All Subscriptions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              {deleteMode === 'selected'
                ? `You are about to permanently delete emails from ${selectedIds.size} sender${selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.`
                : `You are about to permanently delete ALL emails in the "${CATEGORY_CONFIG[deleteCategory]?.label || deleteCategory}" category. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              Important
            </div>
            <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              <li>Emails will be permanently removed from your Gmail</li>
              <li>This action cannot be undone</li>
              <li>Deleted emails cannot be recovered from trash</li>
            </ul>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Permanently Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
