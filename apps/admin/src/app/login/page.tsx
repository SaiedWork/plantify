"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth-client";

const STAFF_ROLES = ["owner", "catalog_manager"];

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn(email: string, password: string) {
    setBusy(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setBusy(false);
      toast.error(error.message ?? "Sign in failed");
      return;
    }
    // Customers share the same auth backend; keep them out of the back office.
    const me = await fetch("/api/me", { cache: "no-store" });
    const role = me.ok ? ((await me.json()) as { role: string }).role : null;
    if (!role || !STAFF_ROLES.includes(role)) {
      await authClient.signOut();
      setBusy(false);
      toast.error("This account does not have admin access.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void signIn(String(form.get("email")).trim().toLowerCase(), String(form.get("password")));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>Plantify Admin</CardTitle>
          <CardDescription>Internal back office. This is a demo with fake data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Demo login</p>
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                variant="outline"
                className="h-auto w-full flex-col items-start py-2"
                disabled={busy}
                onClick={() => signIn(a.email, DEMO_PASSWORD)}
              >
                <span>Sign in as {a.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{a.blurb}</span>
              </Button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
