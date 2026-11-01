import type { OrderEventView, OrderStatus } from "@plantify/contracts";
import { Check, CircleX } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: "paid", label: "Order confirmed", hint: "Payment received" },
  { status: "processing", label: "Packing", hint: "We are getting your plants ready" },
  { status: "shipped", label: "Shipped", hint: "On its way (this is a demo, so nothing really ships)" },
  { status: "delivered", label: "Delivered", hint: "Enjoy your plants" },
];

/** Where an order is, built from the status changes the database recorded. */
export function OrderTimeline({ status, events }: { status: OrderStatus; events: OrderEventView[] }) {
  const at = (s: OrderStatus) => events.findLast((e) => e.status === s)?.at;
  const reached = STEPS.reduce((n, step, i) => (at(step.status) ? i : n), -1);
  const ended = status === "cancelled" || status === "refunded";

  if (status === "pending_payment") {
    return <p className="text-sm text-muted-foreground">This order is waiting for payment. We start packing it as soon as it is paid.</p>;
  }

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        const current = i === reached && !ended;
        return (
          <li key={step.status} className="relative flex gap-3 pb-6 last:pb-0">
            {(i < STEPS.length - 1 || ended) && (
              <span aria-hidden className={cn("absolute top-6 left-3 h-[calc(100%-1.5rem)] w-px -translate-x-1/2", i < reached ? "bg-green-700 dark:bg-green-500" : "bg-border")} />
            )}
            <span
              aria-hidden
              className={cn(
                "z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                done ? "border-green-700 bg-green-700 text-white dark:border-green-500 dark:bg-green-500" : "bg-background text-muted-foreground",
                current && "ring-4 ring-green-700/20",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className={cn("min-w-0 flex-1", !done && "text-muted-foreground")}>
              <p className={cn("text-sm font-medium", done && "text-foreground")}>
                {step.label}
                {current && <span className="sr-only"> (current step)</span>}
              </p>
              <p className="text-xs text-muted-foreground">{done ? (at(step.status) ? formatDateTime(at(step.status)!) : step.hint) : step.hint}</p>
            </div>
          </li>
        );
      })}
      {ended && (
        <li className="relative flex gap-3">
          <span aria-hidden className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
            <CircleX className="size-3.5" />
          </span>
          <div>
            <p className="text-sm font-medium">{status === "refunded" ? "Refunded" : "Cancelled"}</p>
            <p className="text-xs text-muted-foreground">{at(status) ? formatDateTime(at(status)!) : ""}</p>
          </div>
        </li>
      )}
    </ol>
  );
}
