"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Me = { name: string; email: string; role: string; permissions: string[] };

export default function AdminHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then(async (res) => {
      if (res.ok) setMe(await res.json());
      else router.replace("/login");
    });
  }, [router]);

  if (!me) return <p className="p-8 text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plantify Admin</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
      <p className="mt-2 text-muted-foreground">
        Signed in as {me.name} ({me.role}). The dashboard, catalog and orders arrive in later milestones.
      </p>
      <h2 className="mt-6 font-medium">Your permissions</h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {me.permissions.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
