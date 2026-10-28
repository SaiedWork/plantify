import type { OrderStatus } from "@plantify/contracts";
import { cn } from "@/lib/utils";

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting payment", className: "bg-amber-100 text-amber-900" },
  paid: { label: "Paid", className: "bg-blue-100 text-blue-900" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-900" },
  shipped: { label: "Shipped", className: "bg-indigo-100 text-indigo-900" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-900" },
  cancelled: { label: "Cancelled", className: "bg-gray-200 text-gray-800" },
  refunded: { label: "Refunded", className: "bg-rose-100 text-rose-900" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", s.className)}>{s.label}</span>;
}
