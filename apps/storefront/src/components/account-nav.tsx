"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
