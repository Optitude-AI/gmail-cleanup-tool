'use client'

import { HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AppHeaderProps {
  email: string
  onDisconnect: () => void
}

export function AppHeader({ email, onDisconnect }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
      <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500"><HardDrive className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Google Cleanup</h1><p className="text-xs text-slate-500 dark:text-slate-400">{email}</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect} className="text-slate-600">Disconnect</Button>
      </div>
    </header>
  )
}
