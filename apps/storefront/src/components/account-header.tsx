"use client";

import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

export function AccountHeader() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending || !session) {
    return (
      <div aria-hidden className="flex items-center gap-3">
        <div className="size-14 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-44 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={session.user.name} seed={session.user.id} size="lg" />
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold leading-tight">{session.user.name}</h1>
        <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
      </div>
    </div>
  );
}
