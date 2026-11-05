import Image from "next/image";
import type { TrackedOrder } from "@plantify/contracts";
import { formatPrice } from "@/lib/format";

export function OrderItemRow({ item }: { item: TrackedOrder["items"][number] }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5">
        {item.imageUrl && <Image src={item.imageUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.productName}</span>
        <span className="text-xs text-muted-foreground">
          {item.variantLabel} × {item.quantity}
        </span>
      </span>
      <span className="tabular-nums">{formatPrice(item.unitPriceCents * item.quantity)}</span>
    </li>
  );
}
