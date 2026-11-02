"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { TrackedOrder } from "@plantify/contracts";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrderOverview } from "@/components/order-overview";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { api, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error, reload } = useApi<TrackedOrder>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await api(`/orders/${id}/cancel`, { method: "POST" });
      toast.success("Order cancelled");
      setConfirming(false);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel the order");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (error || !order) {
    return (
      <p>
        We couldn&apos;t find that order.{" "}
        <Link href="/account/orders" className="underline underline-offset-4">
          Back to orders
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" /> All orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{order.number}</h2>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
      </div>

      <OrderOverview
        order={order}
        invoiceHref={`/account/orders/${order.id}/invoice`}
        actions={
          order.status === "pending_payment" && (
            <Button variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => setConfirming(true)}>
              Cancel order
            </Button>
          )
        }
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cancel this order?"
        description="Nothing has been charged. The order is cancelled and can't be paid afterwards."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        busy={busy}
        onConfirm={cancel}
      />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <OrderView />
    </Suspense>
  );
}
