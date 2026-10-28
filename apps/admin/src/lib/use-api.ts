"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type State<T> = { data: T | null; error: string | null; loading: boolean };

/** Fetches `/api{path}` and exposes `reload` for after mutations. Pass `null` to skip fetching. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null });
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

/** Delays a fast-changing value (search boxes) so we do not query on every keystroke. */
export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
