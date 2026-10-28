"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useDemoInbox } from "@/components/demo-inbox";
import { safeNext } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

const RESEND_SECONDS = 30;

function VerifyForm() {
  const router = useRouter();
  const inbox = useDemoInbox();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = safeNext(params.get("next"));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(otp: string) {
    setBusy(true);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "That code did not work");
      setCode("");
      return;
    }
    toast.success("Email verified. Welcome to Plantify!");
    router.push(next);
    router.refresh();
  }

  async function resend() {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    if (error) {
      toast.error(error.message ?? "Could not resend the code");
      return;
    }
    setCooldown(RESEND_SECONDS);
    inbox.open();
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Check your demo inbox</CardTitle>
          <CardDescription>
            We &quot;sent&quot; a 6-digit code to <strong>{email}</strong>. Because this is a demo, it
            arrives in the in-app inbox instead of a real mailbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={inbox.open}>
            Open demo inbox
          </Button>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={verify}
              disabled={busy}
              inputMode="numeric"
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => verify(code)}>
            {busy ? "Verifying…" : "Verify email"}
          </Button>
          <Button variant="link" className="w-full" disabled={cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
