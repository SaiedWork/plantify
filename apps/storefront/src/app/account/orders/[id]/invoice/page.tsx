"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { OrderDetail } from "@plantify/contracts";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoice-document";
import { authClient } from "@/lib/auth-client";
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

      <InvoiceDocument order={order} email={session?.user.email} />
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
