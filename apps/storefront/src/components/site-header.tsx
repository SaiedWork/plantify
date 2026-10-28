"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, ShoppingCart } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { useCart } from "@/components/cart-provider";
import { DemoInboxButton } from "@/components/demo-inbox";
import { authClient } from "@/lib/auth-client";

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { itemCount } = useCart();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-green-800">
            <Leaf className="size-5" /> Plantify
          </Link>
          <Link href="/shop" className="text-sm hover:underline">
            Shop
          </Link>
        </div>
        <SearchBox />
        <nav className="flex items-center gap-2">
          <DemoInboxButton />
          <Link href="/cart" className={buttonVariants({ variant: "ghost", size: "sm" }) + " relative"} aria-label={`Cart, ${itemCount} items`}>
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-green-800 text-[10px] text-white">
                {itemCount}
              </span>
            )}
          </Link>
          {isPending ? null : session ? (
            <>
              <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {session.user.name}
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/");
                  router.refresh();
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
