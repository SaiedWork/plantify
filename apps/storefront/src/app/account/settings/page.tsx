"use client";

import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { authClient } from "@/lib/auth-client";

function ProfileForm({ name, email, verified }: { name: string; email: string; verified: boolean }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.updateUser({ name: value.trim() });
    setBusy(false);
    if (error) toast.error(error.message ?? "Could not update your profile");
    else toast.success("Profile updated");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-semibold">Profile</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={80} autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
        <p className="text-xs text-muted-foreground">{verified ? "Verified" : "Not verified"}. Email can&apos;t be changed in this demo.</p>
      </div>
      <Button type="submit" disabled={busy || value.trim() === name}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirm"))) {
      toast.error("The new passwords don't match");
      return;
    }
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(data.get("currentPassword")),
      newPassword,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Could not change your password");
      return;
    }
    form.reset();
    toast.success("Password changed. Other devices were signed out.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-semibold">Change password</h3>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput id="newPassword" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput id="confirm" name="confirm" required minLength={8} maxLength={128} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      {isPending || !session ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        // Keyed by user so the form state resets if the session identity changes.
        <ProfileForm key={session.user.id} name={session.user.name} email={session.user.email} verified={session.user.emailVerified} />
      )}
      <PasswordForm />
    </div>
  );
}
