"use client";

import { Popover } from "@base-ui/react/popover";
import { LogOut, Package, Settings, UserPlus, UserRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const ITEM =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:bg-muted";

/** Header avatar that opens the account menu: sign in / create account for guests, account links once signed in. */
export function UserMenu({ user }: { user: { id: string; name: string; email: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={user ? `Account menu for ${user.name}` : "Account menu"}
        className={cn(
          "flex size-8 items-center justify-center rounded-full outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:ring-2 data-popup-open:ring-ring/60",
          !user && "bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600",
        )}
      >
        {user ? <UserAvatar name={user.name} seed={user.id} /> : <UserRound aria-hidden className="size-4" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[60]">
          <Popover.Popup className="w-60 origin-(--transform-origin) rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-md outline-none transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            {user ? (
              <>
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <UserAvatar name={user.name} seed={user.id} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="my-1 border-t" />
                <Link href="/account/orders" className={ITEM} onClick={close}>
                  <Package aria-hidden className="size-4" /> Orders
                </Link>
                <Link href="/account/settings" className={ITEM} onClick={close}>
                  <Settings aria-hidden className="size-4" /> Settings
                </Link>
                <div className="my-1 border-t" />
                <button
                  type="button"
                  className={ITEM + " text-destructive"}
                  onClick={async () => {
                    // Next keeps the previous page's state while another route is shown, so close the menu first.
                    close();
                    await authClient.signOut();
                    router.push("/");
                    router.refresh();
                  }}
                >
                  <LogOut aria-hidden className="size-4" /> Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in" className={ITEM} onClick={close}>
                  <LogIn aria-hidden className="size-4" /> Sign in
                </Link>
                <Link href="/sign-up" className={ITEM} onClick={close}>
                  <UserPlus aria-hidden className="size-4" /> Create account
                </Link>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
