"use client";

import { useEffect, useState } from "react";
import type { TrackedOrder } from "@plantify/contracts";
import { api, ApiError } from "@/lib/api-client";

type State = { order: TrackedOrder | null; problem: "expired" | "missing" | null; loading: boolean };

/** Loads the order behind an emailed link. `expired` means the 24-hour window passed. */
export function useTrackedOrder(token: string): State {
  const [state, setState] = useState<State>({ order: null, problem: null, loading: true });

  useEffect(() => {
    let active = true;
    api<TrackedOrder>(`/orders/track/${token}`).then(
      (order) => active && setState({ order, problem: null, loading: false }),
      (err: unknown) =>
        active && setState({ order: null, problem: err instanceof ApiError && err.code === "link_expired" ? "expired" : "missing", loading: false }),
    );
    return () => {
      active = false;
    };
  }, [token]);

  return state;
}

/** When the link stops working, read from the token itself (`<orderId>.<expiresAtMs>.<signature>`). */
export function linkExpiry(token: string): Date | null {
  const ms = Number(token.split(".")[1]);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
