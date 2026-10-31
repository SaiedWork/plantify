"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderStatus, Permission, ProductStatus } from "@plantify/contracts";
import { Button } from "@/components/ui/button";
import { useMe } from "@/components/admin-shell";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Renders children only when the signed-in staff member holds the permission (the API enforces it regardless). */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useMe();
  if (can(permission)) return <>{children}</>;
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">You don&apos;t have access to this area.</p>
      <p className="mt-1 text-sm text-muted-foreground">Ask an owner if you need it.</p>
      <Link href="/" className="mt-3 inline-block text-sm underline">
        Back to the dashboard
      </Link>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-muted-foreground">{total} total</p>;
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {total} total · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

const ORDER_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-900",
  paid: "bg-blue-100 text-blue-900",
  processing: "bg-blue-100 text-blue-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-800",
  refunded: "bg-rose-100 text-rose-900",
};

const PRODUCT_STYLES: Record<ProductStatus, string> = {
  draft: "bg-amber-100 text-amber-900",
  active: "bg-green-100 text-green-900",
  archived: "bg-gray-200 text-gray-800",
};

export const orderStatusLabel = (s: OrderStatus) => s.replace("_", " ");

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", className)}>{children}</span>;
}

export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge className={ORDER_STYLES[status]}>{orderStatusLabel(status)}</Badge>;
export const ProductBadge = ({ status }: { status: ProductStatus }) => <Badge className={PRODUCT_STYLES[status]}>{status}</Badge>;

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm">{children}</table></div>;
}

export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
  <th className={cn("bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground", right ? "text-right" : "text-left")}>{children}</th>
);

export const Td = ({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) => (
  <td className={cn("px-3 py-2", right && "text-right", className)}>{children}</td>
);

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className ?? "h-40")} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</p>;
}

