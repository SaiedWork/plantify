"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { Clock, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GuestAccountOffer } from "@/components/guest-account-offer";
import { OrderItemRow } from "@/components/order-item-row";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderTotals } from "@/components/order-totals";
import { RequestLinkForm } from "@/components/request-link-form";
import { linkExpiry, useTrackedOrder } from "@/components/use-tracked-order";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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

  const a = order.shippingAddress;
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

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <section aria-labelledby="ship" className="space-y-4 rounded-xl border bg-card p-6 text-sm">
            <h2 id="ship" className="font-semibold">
              Shipping to
            </h2>
            <div className="space-y-4">
              <p className="font-medium">{a.fullName}</p>
              <p className="leading-relaxed text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}
                {a.region ? `, ${a.region}` : ""} {a.postalCode}
              </p>
              {order.payment?.cardLast4 && (
                <p className="text-muted-foreground">
                  Paid with {order.payment.cardBrand} ending {order.payment.cardLast4} (simulated)
                </p>
              )}
            </div>
            {order.invoice && (
              <Link href={`/orders/track/${token}/invoice`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                <FileText aria-hidden /> View invoice
              </Link>
            )}
          </section>

          <section aria-labelledby="progress" className="rounded-xl border bg-card p-6">
            <h2 id="progress" className="mb-5 font-semibold">
              Delivery status
            </h2>
            <OrderTimeline status={order.status} events={order.events} />
          </section>
        </div>

        {/* On wide screens the items card is as tall as the left column (it does not add to the row's height), so a long
            order scrolls inside the card while the totals stay at its foot. */}
        <section aria-labelledby="items" className="relative">
          <div className="flex max-h-[32rem] flex-col rounded-xl border bg-card md:absolute md:inset-0 md:max-h-none">
            <h2 id="items" className="p-6 pb-3 font-semibold">
              Items
            </h2>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-6 text-sm">
              {order.items.map((i) => (
                <OrderItemRow key={i.sku} item={i} />
              ))}
            </ul>
            <div className="border-t p-6">
              <OrderTotals totals={order} />
            </div>
          </div>
        </section>
      </div>

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
