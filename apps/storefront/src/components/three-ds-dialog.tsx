"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fake 3-D Secure step: the (simulated) bank asks the shopper to approve the payment. */
export function ThreeDSDialog({
  open,
  busy,
  onApprove,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-xl bg-popover p-6 text-center text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[opacity,scale] duration-200 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
          <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
            <ShieldCheck className="size-6" />
          </span>
          <div className="space-y-1.5">
            <AlertDialog.Title className="text-lg font-semibold">Approve this payment</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              Your (fake) bank is asking you to confirm. In a real store this would be a code or an app prompt.
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={busy} onClick={onApprove}>
              {busy ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Approving…
                </>
              ) : (
                "Approve payment"
              )}
            </Button>
            <AlertDialog.Close render={<Button variant="outline" size="lg" disabled={busy} />}>Cancel</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
