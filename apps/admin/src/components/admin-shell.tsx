"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Permission, Role } from "@plantify/contracts";
import { Boxes, LayoutDashboard, Leaf, LogOut, Package, ShoppingBag, Tags, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export type Me = { id: string; name: string; email: string; role: Role; permissions: Permission[] };

const MeContext = createContext<{ me: Me; can: (p: Permission) => boolean } | null>(null);

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside <AdminShell>");
  return ctx;
}

const NAV: { href: string; label: string; icon: typeof Package; permission?: Permission; exact?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/products", label: "Products", icon: Package, permission: "catalog:manage" },
  { href: "/categories", label: "Categories", icon: Tags, permission: "catalog:manage" },
  { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory:manage" },
  { href: "/orders", label: "Orders", icon: ShoppingBag, permission: "orders:view" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers:view" },
];

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", catalog_manager: "Catalog manager", customer: "Customer" };

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, error } = useApi<Me>("/me");

  // Not signed in, or a customer session slipped through: back to the login page.
  const isStaff = me && me.role !== "customer";
  useEffect(() => {
    if (error || (me && !isStaff)) router.replace("/login");
  }, [error, me, isStaff, router]);

  if (!me || !isStaff) return <div className="min-h-screen animate-pulse bg-muted/40" />;

  const can = (p: Permission) => me.permissions.includes(p);

  return (
    <MeContext.Provider value={{ me, can }}>
      <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
        <aside className="flex flex-col border-b bg-muted/30 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 px-4 py-4 font-semibold text-green-800">
            <Leaf className="size-5" /> Plantify Admin
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
            {NAV.filter((n) => !n.permission || can(n.permission)).map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted",
                    active && "bg-muted font-medium",
                  )}
                >
                  <n.icon className="size-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden space-y-2 border-t p-3 text-sm md:block">
            <div>
              <p className="font-medium">{me.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>
        <main className="min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </MeContext.Provider>
  );
}
