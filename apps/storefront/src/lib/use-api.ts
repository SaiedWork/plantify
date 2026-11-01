"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type State<T> = { data: T | null; error: string | null; loading: boolean };

/** Fetches `/api{path}` in the browser and exposes a `reload` for after mutations. A null path skips the request. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let active = true;
    api<T>(path).then(
      (data) => active && setState({ data, error: null, loading: false }),
      (err: Error) => active && setState((s) => ({ data: s.data, error: err.message, loading: false })),
    );
    return () => {
      active = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
