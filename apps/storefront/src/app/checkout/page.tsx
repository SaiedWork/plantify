"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PayResult } from "@plantify/contracts";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/cart-provider";
import { OrderTotals } from "@/components/order-totals";
import { api, ApiError } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEMO_CARD = { number: "1234 5678 9", cvc: "123" };
const FAILURE_MESSAGES: Record<string, string> = {
  card_declined: "Your card was declined. Try another card, such as the success demo card.",
  out_of_stock: "Sorry, someone bought the last one while you were paying. Nothing was charged.",
};

type Step = { orderId: string | null; threeDS: { paymentId: string; orderId: string } | null };

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ orderId: null, threeDS: null });
  const [card, setCard] = useState({ number: "", expMonth: "", expYear: "", cvc: "", name: "" });

  function autofill() {
    const year = new Date().getFullYear();
    setCard({ number: DEMO_CARD.number, expMonth: "12", expYear: String(year + 2), cvc: DEMO_CARD.cvc, name: "Demo Shopper" });
  }

  function handleResult(result: PayResult) {
    if (result.status === "paid") {
      void refresh();
      router.push(`/checkout/success/${result.orderId}`);
    } else if (result.status === "requires_action") {
      setStep({ orderId: result.orderId, threeDS: { paymentId: result.paymentId, orderId: result.orderId } });
    } else {
      toast.error(FAILURE_MESSAGES[result.reason] ?? "Payment failed. Please try again.");
      if (result.reason === "out_of_stock") void refresh();
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      // The order is created once; a declined card can be retried against the same order.
      let orderId = step.orderId;
      if (!orderId) {
        const line2 = String(form.get("line2") ?? "").trim();
        const region = String(form.get("region") ?? "").trim();
        const created = await api<{ orderId: string }>("/checkout/orders", {
          method: "POST",
          json: {
            shippingAddress: {
              fullName: String(form.get("fullName")).trim(),
              line1: String(form.get("line1")).trim(),
              ...(line2 ? { line2 } : {}),
              city: String(form.get("city")).trim(),
              ...(region ? { region } : {}),
              postalCode: String(form.get("postalCode")).trim(),
              country: "US",
            },
          },
        });
        orderId = created.orderId;
        setStep({ orderId, threeDS: null });
      }
      handleResult(
        await api<PayResult>(`/checkout/orders/${orderId}/pay`, {
          method: "POST",
          json: { card: { ...card, expMonth: Number(card.expMonth), expYear: Number(card.expYear) } },
        }),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Checkout failed");
      if (err instanceof ApiError && err.status === 409) void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approve3DS() {
    if (!step.threeDS) return;
    setBusy(true);
    try {
      const result = await api<PayResult>(`/checkout/payments/${step.threeDS.paymentId}/confirm`, { method: "POST" });
      setStep((s) => ({ ...s, threeDS: null }));
      handleResult(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Confirmation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!cart) return <div className="mx-auto h-64 max-w-5xl animate-pulse px-4 py-10" />;
  if (cart.lines.length === 0 && !step.orderId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <Link href="/shop" className={cn(buttonVariants(), "mt-6")}>
          Browse plants
        </Link>
      </div>
    );
  }

  const locked = step.orderId !== null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      <form onSubmit={onSubmit} className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
              <CardDescription>Fake addresses are fine. Nothing will be shipped.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field name="fullName" label="Full name" className="sm:col-span-2" disabled={locked} autoComplete="name" />
              <Field name="line1" label="Address" className="sm:col-span-2" disabled={locked} autoComplete="address-line1" />
              <Field name="line2" label="Apartment, suite (optional)" className="sm:col-span-2" disabled={locked} required={false} />
              <Field name="city" label="City" disabled={locked} autoComplete="address-level2" />
              <Field name="region" label="State (optional)" disabled={locked} required={false} />
              <Field name="postalCode" label="ZIP code" disabled={locked} autoComplete="postal-code" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <CardDescription>This is a simulated payment. No real card is charged or stored.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Demo cards (CVC {DEMO_CARD.cvc}, any future expiry)</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>
                    <code>1234 5678 9</code> pays successfully
                  </li>
                  <li>
                    <code>0000 0000 0</code> is declined
                  </li>
                  <li>
                    <code>1111 1111 1</code> asks for a fake 3-D Secure approval
                  </li>
                </ul>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={autofill}>
                  Autofill demo card
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cardName">Name on card</Label>
                  <Input id="cardName" required maxLength={80} value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} autoComplete="cc-name" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cardNumber">Card number</Label>
                  <Input id="cardNumber" required inputMode="numeric" maxLength={30} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} autoComplete="cc-number" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="expMonth">Month</Label>
                    <Input id="expMonth" required inputMode="numeric" placeholder="MM" maxLength={2} value={card.expMonth} onChange={(e) => setCard({ ...card, expMonth: e.target.value })} autoComplete="cc-exp-month" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expYear">Year</Label>
                    <Input id="expYear" required inputMode="numeric" placeholder="YYYY" maxLength={4} value={card.expYear} onChange={(e) => setCard({ ...card, expYear: e.target.value })} autoComplete="cc-exp-year" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" required inputMode="numeric" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} autoComplete="cc-csc" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border p-4">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="space-y-1 text-sm">
            {cart.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-2">
                <span>
                  {l.productName} <span className="text-muted-foreground">({l.variantLabel}) × {l.quantity}</span>
                </span>
                <span>{formatPrice(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals totals={cart} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Processing…" : `Pay ${formatPrice(cart.totalCents)}`}
          </Button>
        </aside>
      </form>

      {step.threeDS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="3-D Secure">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Approve this payment</CardTitle>
              <CardDescription>
                Your (fake) bank is asking you to confirm. In a real store this would be a code or app prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" disabled={busy} onClick={approve3DS}>
                {busy ? "Approving…" : "Approve payment"}
              </Button>
              <Button variant="ghost" className="w-full" disabled={busy} onClick={() => setStep((s) => ({ ...s, threeDS: null }))}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  className,
  required = true,
  ...rest
}: { name: string; label: string; className?: string; required?: boolean } & React.ComponentProps<"input">) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} maxLength={120} {...rest} />
    </div>
  );
}
