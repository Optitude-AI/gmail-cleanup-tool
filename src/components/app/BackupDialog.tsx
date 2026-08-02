'use client'

import { ArchiveRestore, Download, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface BackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemCount: number
  onConfirm: () => void
  loading: boolean
}

export function BackupDialog({ open, onOpenChange, itemCount, onConfirm, loading }: BackupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5 text-blue-500" />Backup Before Delete</DialogTitle>
          <DialogDescription>Download a ZIP backup of {itemCount} items before deleting.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
          <p className="text-xs text-blue-700 dark:text-blue-300">The selected files will be bundled into a ZIP archive and downloaded to your device. After that, you can safely delete them.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading} className="gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating ZIP...</> : <><Download className="h-4 w-4" />Download Backup ZIP</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}