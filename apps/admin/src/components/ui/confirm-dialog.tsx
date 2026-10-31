"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  busy?: boolean
}

/** Confirmation step for irreversible actions. The positive button is filled, Cancel is the outline one. */
function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive, busy }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl bg-popover p-5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[opacity,scale] duration-200 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
          <div className="space-y-1.5">
            <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">{description}</AlertDialog.Description>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog.Close render={<Button variant="outline" disabled={busy} />}>Cancel</AlertDialog.Close>
            <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export { ConfirmDialog }
