import { Suspense } from "react";
import { AccountHeader } from "@/components/account-header";
import { AccountNav } from "@/components/account-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 print:block print:max-w-none print:p-0">
      <div className="print:hidden">
        <AccountHeader />
      </div>
      <div className="grid gap-8 md:grid-cols-[200px_1fr] print:block">
        {/* Sticks below the banner and header (1.75rem + 3.5rem + border) so only the page content scrolls. */}
        <div className="print:hidden md:sticky md:top-24 md:self-start">
          <Suspense fallback={<div className="h-24" />}>
            <AccountNav />
          </Suspense>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
