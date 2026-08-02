'use client'

import { Gauge, ScanSearch, FolderOpen, Camera, Wand2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { UnifiedStorage, StorageForecast } from '@/lib/types'
import { SEVERITY_STYLES } from '@/components/app/constants'
import { LoadingSpinner } from './LoadingSpinner'

interface OverviewTabProps {
  storage: UnifiedStorage | null
  forecast: StorageForecast | null
  loadingStorage: boolean
  scanGmail: () => void
  scanDrive: () => void
  scanPhotos: () => void
  scanningGmail: boolean
  scanningDrive: boolean
  scanningPhotos: boolean
  loadStorage: () => void
  onGoToWizard: () => void
}

export function OverviewTab({ storage, forecast, loadingStorage, scanGmail, scanDrive, scanPhotos, scanningGmail, scanningDrive, scanningPhotos, loadStorage, onGoToWizard }: OverviewTabProps) {
  if (loadingStorage) return <LoadingSpinner text="Loading storage data..." />
  if (!storage) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <p className="text-muted-foreground">Connect your Google account and load storage data to see your unified overview.</p>
        <Button onClick={loadStorage} className="gap-2"><Gauge className="h-4 w-4" />Load Storage Data</Button>
      </div>
    )
  }

  return (
    <>
      {/* Unified Storage Gauge */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" />Unified Storage Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${storage.percentUsed * 100}, 100`} className={storage.percentUsed > 0.85 ? 'text-red-500' : storage.percentUsed > 0.7 ? 'text-orange-500' : 'text-emerald-500'} strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(storage.percentUsed * 100)}%</p>
                <p className="text-[10px] text-muted-foreground">used</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 min-w-[200px]">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Used</span><span className="text-sm font-bold text-slate-900 dark:text-white">{storage.usedFormatted}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Free Space</span><span className="text-sm text-slate-700 dark:text-slate-300">{storage.freeFormatted}</span></div>
              <Separator />
              <div className="grid gap-2">
                {[
                  { label: 'Gmail', size: storage.gmail.formatted, color: 'bg-red-400' },
                  { label: 'Drive', size: storage.drive.formatted, color: 'bg-blue-400' },
                  { label: 'Photos', size: storage.photos.formatted, color: 'bg-pink-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${s.color}`} /><span className="text-xs text-muted-foreground w-16">{s.label}</span><span className="text-xs font-medium">{s.size}</span></div>
                ))}
              </div>
            </div>
            {/* Forecast */}
            {forecast && (
              <Card className={`border ${SEVERITY_STYLES[forecast.severity]?.bg || SEVERITY_STYLES.low.bg} min-w-[220px]`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">{SEVERITY_STYLES[forecast.severity]?.icon}<span className={`text-xs font-semibold uppercase ${SEVERITY_STYLES[forecast.severity]?.text}`}>Storage Forecast</span></div>
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
          { icon: <Wand2 className="h-5 w-5" />, t: 'Smart Cleanup', d: 'AI-powered cleanup wizard', c: onGoToWizard, loading: false },
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
  )
}
