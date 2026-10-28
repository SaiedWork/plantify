"use client";

import { authClient } from "@/lib/auth-client";

export default function AccountPage() {
  const { data: session } = authClient.useSession();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold">My account</h1>
      <p className="mt-2 text-muted-foreground">
        {session ? `Signed in as ${session.user.email}.` : "Loading…"} Settings and order history arrive in a later milestone.
      </p>
    </div>
  );
}
