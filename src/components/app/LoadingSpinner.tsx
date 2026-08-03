'use client'

import { useState, useEffect } from 'react'
import { ScanSearch } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setProgress(p => Math.min(p + Math.random() * 12, 92)), 400)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 flex items-center justify-center animate-pulse">
        <ScanSearch className="h-8 w-8 text-red-500 animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{text}</h2>
      </div>
      <div className="w-64"><Progress value={progress} className="h-2" /></div>
    </div>
  )
}
