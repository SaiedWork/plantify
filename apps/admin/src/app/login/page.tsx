"use client";

import { Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAFF_ROLES } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn(email: string, password: string) {
    setBusy(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(error.message ?? "Sign in failed");
        return;
      }
      // Customers share the same auth backend; keep them out of the back office.
      const me = await fetch("/api/me", { cache: "no-store" });
      const role = me.ok ? ((await me.json()) as { role: string }).role : null;
      if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) {
        await authClient.signOut();
        toast.error("This account does not have admin access.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      // The router may keep this page mounted (hidden) after navigating away, so never leave it stuck on busy.
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-1.75rem)] max-w-md flex-col items-center justify-center gap-4 px-4">
      <div className="flex items-center gap-2 text-base font-semibold text-green-800 dark:text-green-400">
        <Leaf className="size-5" /> Plantify
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>Admin sign in</CardTitle>
          <CardDescription>Internal back office. This is a demo with fake data.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
