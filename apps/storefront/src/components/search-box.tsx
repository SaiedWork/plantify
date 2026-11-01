"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SubmitEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** `onSearch` lets the mobile drawer close itself once a search is submitted. */
export function SearchBox({ className, onSearch }: { className?: string; onSearch?: () => void }) {
  const router = useRouter();

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onSearch?.();
  }

  return (
    <form onSubmit={onSubmit} role="search" className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
      <Input name="q" type="search" placeholder="Search plants…" maxLength={80} className="h-8 bg-background pl-8 dark:bg-background" aria-label="Search products" />
    </form>
  );
}
