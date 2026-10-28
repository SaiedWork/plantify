"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartView } from "@plantify/contracts";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

type CartContextValue = {
  cart: CartView | null;
  itemCount: number;
  add: (variantId: string, quantity?: number) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCart(await api<CartView>("/cart"));
    } catch {
      // keep whatever we had; the next action retries
    }
  }, []);

  useEffect(() => {
    // Initial load; state is only set after the response arrives.
    api<CartView>("/cart").then(setCart, () => {});
  }, []);

  const mutate = useCallback(async (run: () => Promise<CartView>) => {
    try {
      setCart(await run());
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update your cart");
      void refresh();
      return false;
    }
  }, [refresh]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart?.itemCount ?? 0,
      refresh,
      add: (variantId, quantity = 1) => mutate(() => api<CartView>("/cart/items", { method: "POST", json: { variantId, quantity } })),
      setQuantity: async (variantId, quantity) => {
        await mutate(() => api<CartView>(`/cart/items/${variantId}`, { method: "PATCH", json: { quantity } }));
      },
      remove: async (variantId) => {
        await mutate(() => api<CartView>(`/cart/items/${variantId}`, { method: "DELETE" }));
      },
    }),
    [cart, mutate, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
