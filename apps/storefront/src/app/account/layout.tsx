import { Suspense } from "react";
import { AccountNav } from "@/components/account-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[180px_1fr] print:block print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="mb-3 text-lg font-semibold">My account</h1>
        <Suspense fallback={<div className="h-24" />}>
          <AccountNav />
        </Suspense>
      </div>
      <div>{children}</div>
    </div>
  );
}
