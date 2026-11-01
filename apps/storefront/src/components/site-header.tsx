"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, ShoppingCart, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBox } from "@/components/search-box";
import { useCart } from "@/components/cart-provider";
import { DemoInboxButton } from "@/components/demo-inbox";
import { PlantifyLogo } from "@/components/plantify-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const DRAWER_LINK = "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-muted";

export function SiteHeader() {
  const { data: session, isPending } = authClient.useSession();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <header className="sticky top-7 z-30 border-b bg-background/85 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2 md:hidden" onClick={() => setMenuOpen(true)}>
          <Menu className="size-4" />
        </Button>
        <Link href="/" aria-label="Plantify home" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <PlantifyLogo size="sm" className="md:hidden" />
          <PlantifyLogo className="hidden md:inline-flex" />
        </Link>
        <Link href="/shop" className={cn(buttonVariants({ variant: "ghost" }), "ml-4 bg-background max-md:hidden")}>
          Shop
        </Link>
        <SearchBox className="hidden w-80 md:block" />
        <nav aria-label="Account and cart" className="ml-auto flex items-center gap-1">
          <DemoInboxButton />
          <Link
            href="/cart"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative bg-background")}
            aria-label={`Cart, ${itemCount} items`}
          >
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-700 px-1 text-[10px] font-medium text-white dark:bg-green-600">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
          <ThemeToggle />
          {isPending ? (
            <span aria-hidden className="size-8 animate-pulse rounded-lg bg-muted" />
          ) : (
            <UserMenu user={session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null} />
          )}
        </nav>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw]">
          <SheetHeader>
            <SheetTitle>
              <PlantifyLogo size="sm" />
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <SearchBox onSearch={close} />
            <nav aria-label="Main" className="space-y-0.5">
              <Link href="/shop" className={DRAWER_LINK} onClick={close}>
                <Store aria-hidden className="size-4" /> Shop all plants
              </Link>
              <Link href="/cart" className={DRAWER_LINK} onClick={close}>
                <ShoppingCart aria-hidden className="size-4" /> Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </Link>
            </nav>
          </div>
          {!isPending && !session && (
            <SheetFooter className="border-t">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })} onClick={close}>
                Create account
              </Link>
              <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline", size: "lg" }))} onClick={close}>
                Sign in
              </Link>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}
