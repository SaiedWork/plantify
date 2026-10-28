"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { OrderDetail } from "@plantify/contracts";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDemoInbox } from "@/components/demo-inbox";
import { OrderTotals } from "@/components/order-totals";
import { api } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function Success() {
  const { orderId } = useParams<{ orderId: string }>();
  const inbox = useDemoInbox();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<OrderDetail>(`/orders/${orderId}`).then(setOrder).catch(() => setFailed(true));
  }, [orderId]);

  if (failed) return <p className="p-8 text-center">We couldn&apos;t find that order.</p>;
  if (!order) return <div className="mx-auto h-64 max-w-2xl animate-pulse px-4 py-10" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-green-700" />
        <h1 className="mt-3 text-2xl font-bold">Thank you for your order!</h1>
        <p className="text-muted-foreground">
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

      <div className="rounded-xl border p-4">
        <ul className="divide-y text-sm">
          {order.items.map((i) => (
            <li key={`${i.sku}`} className="flex justify-between py-2">
              <span>
                {i.productName} <span className="text-muted-foreground">({i.variantLabel}) × {i.quantity}</span>
              </span>
              <span>{formatPrice(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3">
          <OrderTotals totals={order} />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={inbox.open}>
          Open receipt in demo inbox
        </Button>
        <Link href="/shop" className={cn(buttonVariants())}>
          Keep shopping
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-2xl animate-pulse px-4 py-10" />}>
      <Success />
    </Suspense>
  );
}
