"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type SubmitEvent } from "react";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { useDemoInbox } from "@/components/demo-inbox";
import { safeNext } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Set by "Create an account" on a guest order, so the order is attached once the email is verified.
  const prefillEmail = params.get("email") ?? "";
  const inbox = useDemoInbox();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email,
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Could not create the account");
      return;
    }
    inbox.open();
    router.push(`/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthShell title="Create your account" description="We will send a 6-digit code to verify your email.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required maxLength={80} autoComplete="name" placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required maxLength={120} autoComplete="email" defaultValue={prefillEmail} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" required minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="password-hint" />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
