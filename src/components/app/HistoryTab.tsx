'use client'

import { History, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface HistoryTabProps {
  reports: any[]
}

export function HistoryTab({ reports }: HistoryTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Cleanup History & Reports</CardTitle>
      </CardHeader>
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
  )
}
