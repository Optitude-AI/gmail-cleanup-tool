'use client'

import { ShieldAlert, Trash2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  itemCount: number
  onConfirm: () => void
  loading: boolean
}

export function DeleteConfirmDialog({ open, onOpenChange, title, itemCount, onConfirm, loading }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" />Confirm Deletion</DialogTitle>
          <DialogDescription>{title} — cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4">
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
            <li>{itemCount > 0 ? `${itemCount} items` : 'Items'} permanently removed</li>
            <li>Cannot be undone</li>
          </ul>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading} className="gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Delete</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
