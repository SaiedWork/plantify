import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown on a guest order: create an account with the same email and the order is attached to it. */
export function GuestAccountOffer({ email }: { email: string }) {
  return (
    <aside className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-6">
      <div className="space-y-1.5">
        <h2 className="font-semibold">Want to keep track of your orders?</h2>
        <p className="text-sm text-muted-foreground">Create a free account with this email and this order is added to it.</p>
      </div>
      <Link
        href={`/sign-up?email=${encodeURIComponent(email)}&next=%2Faccount%2Forders`}
        className={cn(buttonVariants({ size: "lg" }), "self-end")}
      >
        Create account
      </Link>
    </aside>
  );
}
