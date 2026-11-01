"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SubmitEvent } from "react";
import { Input } from "@/components/ui/input";

export function SearchBox() {
  const router = useRouter();

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative hidden w-64 sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input name="q" type="search" placeholder="Search plants…" maxLength={80} className="pl-8" aria-label="Search products" />
    </form>
  );
}
