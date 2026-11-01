"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useDemoInbox } from "@/components/demo-inbox";
import { safeNext } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

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

  function done() {
    router.push(next);
    router.refresh();
  }

  async function signInWithPassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
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
    toast.error(error.message ?? "Sign in failed");
  }

  async function requestCode(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (error) return toast.error(error.message ?? "Could not send a code");
    setCodeSent(true);
    inbox.open();
  }

  async function signInWithCode(otp: string) {
    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (!error) return done();
    setBusy(false);
    setCode("");
    toast.error(error.message ?? "That code did not work");
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>Sign in</CardTitle>
          <CardDescription>Use your password, or get a one-time code in the demo inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === "password" ? "default" : "outline"} onClick={() => setMode("password")}>
              Password
            </Button>
            <Button variant={mode === "code" ? "default" : "outline"} onClick={() => setMode("code")}>
              Email me a code
            </Button>
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
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !email}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : codeSent ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={signInWithCode} disabled={busy} inputMode="numeric">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button variant="outline" className="w-full" onClick={inbox.open}>
                Open demo inbox
              </Button>
            </div>
          ) : (
            <form onSubmit={requestCode}>
              <Button type="submit" className="w-full" disabled={busy || !email}>
                {busy ? "Sending…" : "Send me a code"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
