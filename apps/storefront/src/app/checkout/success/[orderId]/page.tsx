"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { OrderDetail } from "@plantify/contracts";
import { CheckCircle2, Mail, Package } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDemoInbox } from "@/components/demo-inbox";
import { OrderTotals } from "@/components/order-totals";
import { api } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function SuccessSkeleton() {
  return (
    <div aria-hidden className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="mx-auto h-32 w-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function Success() {
  const { orderId } = useParams<{ orderId: string }>();
  const inbox = useDemoInbox();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<OrderDetail>(`/orders/${orderId}`).then(setOrder).catch(() => setFailed(true));
  }, [orderId]);

  if (failed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">We couldn&apos;t find that order</h1>
        <p className="mt-2 text-muted-foreground">It may belong to another account.</p>
        <Link href="/account/orders" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          View my orders
        </Link>
      </div>
    );
  }
  if (!order) return <SuccessSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="text-center">
        <span aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="size-9" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Thank you for your order!</h1>
        <p className="mt-1 text-muted-foreground">
          Order <strong>{order.number}</strong>
          {order.invoice && (
            <>
              {" "}
              · Invoice <strong>{order.invoice.number}</strong>
            </>
          )}
        </p>
        {order.payment?.cardLast4 && (
          <p className="text-sm text-muted-foreground">
            Paid with {order.payment.cardBrand} ending {order.payment.cardLast4} (simulated)
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <ul className="divide-y text-sm">
          {order.items.map((i) => (
            <li key={`${i.sku}`} className="flex justify-between py-2">
              <span>
                {i.productName} <span className="text-muted-foreground">({i.variantLabel}) × {i.quantity}</span>
              </span>
              <span className="tabular-nums">{formatPrice(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3">
          <OrderTotals totals={order} />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="lg" onClick={inbox.open}>
          <Mail aria-hidden /> Open receipt in demo inbox
        </Button>
        <Link href={`/account/orders/${order.id}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          <Package aria-hidden /> View order
        </Link>
        <Link href="/shop" className={cn(buttonVariants({ size: "lg" }))}>
          Keep shopping
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <Success />
    </Suspense>
  );
}
