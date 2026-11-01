"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Suspense, useState, type SubmitEvent } from "react";
import { AuthShell, FormError, OrDivider } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { useDemoInbox } from "@/components/demo-inbox";
import { safeNext } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Mode = "password" | "code";

function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const inbox = useDemoInbox();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    router.push(next);
    router.refresh();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function signInWithPassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (!error) return done();
    setBusy(false);
    if (error.status === 403) {
      // Account exists but the email is not verified yet: send a fresh code and continue there.
      await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      inbox.open();
      router.push(`/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
      return;
    }
    setError(error.message ?? "Sign in failed");
  }

  async function requestCode(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (error) return setError(error.message ?? "Could not send a code");
    setCodeSent(true);
    inbox.open();
  }

  async function signInWithCode(otp: string) {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (!error) return done();
    setBusy(false);
    setCode("");
    setError(error.message ?? "That code did not work");
  }

  return (
    <AuthShell title="Welcome back" description="Sign in with your password, or get a one-time code in the demo inbox.">
      <div role="group" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["password", "code"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              mode === m && "bg-background text-foreground shadow-sm",
            )}
          >
            {m === "password" ? "Password" : "Email code"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
          disabled={codeSent}
        />
      </div>

      {mode === "password" ? (
        <form onSubmit={signInWithPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" required autoComplete="current-password" />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : codeSent ? (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <strong className="font-medium text-foreground">{email}</strong>.
          </p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={signInWithCode} disabled={busy} inputMode="numeric" autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="size-10 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <FormError message={error} />
          <Button variant="outline" size="lg" className="w-full" onClick={inbox.open}>
            <Mail aria-hidden /> Open demo inbox
          </Button>
        </div>
      ) : (
        <form onSubmit={requestCode} className="space-y-4">
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
            {busy ? "Sending…" : "Send me a code"}
          </Button>
        </form>
      )}

      {next.startsWith("/checkout") && (
        <>
          <OrDivider>No account? No problem.</OrDivider>
          <Link href="/checkout" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            Checkout as a guest
          </Link>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
