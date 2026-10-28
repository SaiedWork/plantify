import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen animate-pulse bg-muted/40" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
