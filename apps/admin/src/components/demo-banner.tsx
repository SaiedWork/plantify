"use client";

import type { DemoStatus } from "@plantify/contracts";
import { useApi } from "@/lib/use-api";

function resetText(days: number | null | undefined) {
  if (days == null) return "resets every 7 days";
  if (days === 0) return "resets today";
  return `resets in ${days} day${days === 1 ? "" : "s"}`;
}

export function DemoBanner() {
  const { data } = useApi<DemoStatus>("/demo/status");
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-7 items-center justify-center bg-amber-100 px-4 text-center text-xs text-amber-900 print:hidden">
      Demo back office: all data is fake and {resetText(data?.daysUntilReset)}.
    </div>
  );
}
