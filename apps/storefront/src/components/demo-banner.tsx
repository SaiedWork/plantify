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
    <div className="bg-amber-100 print:hidden px-4 py-1.5 text-center text-xs text-amber-900">
      Demo store: all data is fake and {resetText(data?.daysUntilReset)}. Please
      don&apos;t enter real information.
    </div>
  );
}
