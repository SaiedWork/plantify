"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { GuestAccountOffer } from "@/components/guest-account-offer";
import { OrderOverview } from "@/components/order-overview";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { RequestLinkForm } from "@/components/request-link-form";
import { linkExpiry, useTrackedOrder } from "@/components/use-tracked-order";
import { formatDate, formatDateTime } from "@/lib/format";

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-14">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function TrackOrder() {
  const { token } = useParams<{ token: string }>();
  const { order, problem, loading } = useTrackedOrder(token);

  if (loading) {
    return (
      <div aria-hidden className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <div className="h-16 w-64 animate-pulse rounded bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (problem === "expired") {
    return (
      <Message title="This link has expired">
        <p className="text-center text-muted-foreground">Order links work for 24 hours. Enter your details and we will send a new one.</p>
        <RequestLinkForm />
      </Message>
    );
  }

  if (problem || !order) {
    return (
      <Message title="We couldn't find that order">
        <p className="text-center text-muted-foreground">The link may be incomplete. You can ask for a new one.</p>
        <RequestLinkForm />
      </Message>
    );
  }

  const expires = linkExpiry(token);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Order {order.number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDate(order.placedAt)} · Receipt sent to {order.contactEmail}</p>
        {expires && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock aria-hidden className="size-3.5" /> This link works until {formatDateTime(expires.toISOString())}.
          </p>
        )}
      </div>

      <OrderOverview order={order} invoiceHref={`/orders/track/${token}/invoice`} />

      {order.guest && <GuestAccountOffer email={order.contactEmail} />}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div aria-hidden className="mx-auto h-96 max-w-5xl animate-pulse px-4 py-10" />}>
      <TrackOrder />
    </Suspense>
  );
}
