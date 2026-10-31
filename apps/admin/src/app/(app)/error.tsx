"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed p-10 text-center" role="alert">
      <p className="font-medium">Something went wrong on this page.</p>
      <p className="mt-1 text-sm text-muted-foreground">The rest of the admin still works.</p>
      <Button className="mt-3" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
