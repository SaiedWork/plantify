import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted-foreground">It may have moved, or the plant has been sold out for good.</p>
      <Link href="/shop" className={buttonVariants() + " mt-6"}>
        Browse the shop
      </Link>
    </div>
  );
}
