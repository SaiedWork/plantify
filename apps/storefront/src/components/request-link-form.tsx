"use client";

import { Mail } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoInbox } from "@/components/demo-inbox";
import { api, ApiError } from "@/lib/api-client";

/** "Email me a new link": needs the order number and the email used at checkout. */
export function RequestLinkForm() {
  const inbox = useDemoInbox();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/orders/track/request-link", {
        method: "POST",
        json: { orderNumber: String(form.get("orderNumber")), email: String(form.get("email")) },
      });
      setSent(true);
      inbox.open();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <p>If those details match an order, we have sent a new link to the demo inbox. It works for 24 hours.</p>
        <Button variant="outline" onClick={inbox.open}>
          <Mail aria-hidden /> Open demo inbox
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="orderNumber">Order number</Label>
        <Input id="orderNumber" name="orderNumber" required placeholder="PLT-000123" maxLength={20} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lookupEmail">Email used at checkout</Label>
        <Input id="lookupEmail" name="email" type="email" required maxLength={254} autoComplete="email" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Email me a new link"}
      </Button>
    </form>
  );
}
