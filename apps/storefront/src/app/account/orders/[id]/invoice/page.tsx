"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { OrderDetail } from "@plantify/contracts";
import { Leaf, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

function Invoice() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error } = useApi<OrderDetail>(`/orders/${id}`);
  const { data: session } = authClient.useSession();

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  if (error || !order) return <p>We couldn&apos;t find that invoice.</p>;
  if (!order.invoice) {
    return (
      <p>
        This order has no invoice yet because it hasn&apos;t been paid.{" "}
        <Link href={`/account/orders/${order.id}`} className="underline">
          Back to the order
        </Link>
      </p>
    );
  }

  const a = order.shippingAddress;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/account/orders/${order.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to order
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="rounded-xl border bg-white p-8 text-sm text-black print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="flex items-center gap-2 text-xl font-bold text-green-800">
              <Leaf className="size-5" /> Plantify
            </p>
            <p className="mt-1 text-xs text-gray-600">
              100 Fern Avenue, Portland, OR 97201
              <br />
              Demo store · not a real business
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-wide">INVOICE</p>
            <p className="font-medium">{order.invoice.number}</p>
            <p className="text-xs text-gray-600">Issued {formatDate(order.invoice.issuedAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Billed to</h3>
            <p className="font-medium">{a.fullName}</p>
            {session && <p>{session.user.email}</p>}
            <p>{a.line1}</p>
            {a.line2 && <p>{a.line2}</p>}
            <p>
              {a.city}
              {a.region ? `, ${a.region}` : ""} {a.postalCode}
            </p>
          </div>
          <div className="sm:text-right">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Order</h3>
            <p>
              <span className="text-gray-600">Order number:</span> {order.number}
            </p>
            <p>
              <span className="text-gray-600">Order date:</span> {formatDate(order.placedAt)}
            </p>
            {order.payment?.cardLast4 && (
              <p>
                <span className="text-gray-600">Paid with:</span> {order.payment.cardBrand} ···· {order.payment.cardLast4}
              </p>
            )}
          </div>
        </section>

        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map((i) => (
              <tr key={i.sku}>
                <td className="py-2">
                  {i.productName}
                  <span className="block text-xs text-gray-500">
                    {i.variantLabel} · SKU {i.sku}
                  </span>
                </td>
                <td className="py-2 text-right">{i.quantity}</td>
                <td className="py-2 text-right">{formatPrice(i.unitPriceCents)}</td>
                <td className="py-2 text-right">{formatPrice(i.unitPriceCents * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-6 w-full max-w-xs space-y-1">
          <div className="flex justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd>{formatPrice(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Shipping</dt>
            <dd>{order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Tax</dt>
            <dd>{formatPrice(order.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total paid ({order.currency})</dt>
            <dd>{formatPrice(order.totalCents)}</dd>
          </div>
        </dl>

        <footer className="mt-10 border-t pt-4 text-xs text-gray-500">
          This is a demonstration invoice generated by a fake store. No payment was made and it has no legal or tax value.
        </footer>
      </article>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Invoice />
    </Suspense>
  );
}
