import Link from "next/link";
import { PlantifyLogo } from "@/components/plantify-logo";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account", label: "Account" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-muted/40 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs space-y-2">
          <PlantifyLogo size="sm" />
          <p className="text-sm text-muted-foreground">
            A demo plant store. Products, orders and payments are all fake, and nothing is ever shipped.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted-foreground hover:text-foreground hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
