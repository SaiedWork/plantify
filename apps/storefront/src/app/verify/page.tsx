"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(otp: string) {
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    setBusy(false);
    if (error) {
      setError(error.message ?? "That code did not work");
      setCode("");
      return;
    }
    await inbox.clear();
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
    <AuthShell
      title="Check your demo inbox"
      icon={
        <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
          <Mail className="size-6" />
        </span>
      }
      description={
        <>
          We &quot;sent&quot; a 6-digit code to <strong className="font-medium text-foreground">{email}</strong>. Because this is a demo, it arrives in the in-app inbox
          instead of a real mailbox.
        </>
      }
    >
      <Button variant="outline" size="lg" className="w-full" onClick={inbox.open}>
        <Mail aria-hidden /> Open demo inbox
      </Button>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify} disabled={busy} inputMode="numeric" autoFocus>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <FormError message={error} />
      <Button size="lg" className="w-full" disabled={busy || code.length !== 6} onClick={() => verify(code)}>
        {busy ? "Verifying…" : "Verify email"}
      </Button>
      <div className="flex flex-col items-center gap-1 text-sm">
        <Button variant="link" disabled={cooldown > 0} onClick={resend}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Wrong email? Start over
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
