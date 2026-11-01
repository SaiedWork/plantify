"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Inbox, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Message = {
  id: string;
  to: string;
  subject: string;
  html: string;
  otp: string | null;
  createdAt: string;
};

type InboxContextValue = {
  open: () => void;
  /** Fetches the inbox now, e.g. right after a purchase, so the header dot appears without waiting for the next poll. */
  refresh: () => Promise<void>;
  /** Empties the inbox for this browser, e.g. after signing in. Mail that arrives later shows up as usual. */
  clear: () => Promise<void>;
  unread: number;
};

const InboxContext = createContext<InboxContextValue>({ open: () => {}, refresh: async () => {}, clear: async () => {}, unread: 0 });
export const useDemoInbox = () => useContext(InboxContext);

const SEEN_KEY = "plantify:inbox-seen";
const CLEARED_KEY = "plantify:inbox-cleared";
const NEVER = new Date(0).toISOString();

function readKey(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: the dot just comes back after a reload
  }
}

/** Stands in for a real mailbox: this demo never sends email to the internet. */
export function DemoInboxProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Newest message this browser has opened the inbox for; anything newer counts as unread.
  const seenRef = useRef<string | null>(null);
  const latestRef = useRef<string | null>(null);
  // Mail up to this moment is hidden ("cleared"); the rows stay in the database, only this browser stops listing them.
  const clearedRef = useRef<string | null>(null);
  const newestRawRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/demo-inbox", { cache: "no-store" });
      if (!res.ok) return;
      const all: Message[] = (await res.json()).messages;
      newestRawRef.current = all[0]?.createdAt ?? null;
      const cleared = (clearedRef.current ??= readKey(CLEARED_KEY) ?? NEVER);
      const list = all.filter((m) => m.createdAt > cleared);
      setMessages(list);
      const newest = list[0]?.createdAt ?? null;
      latestRef.current = newest;
      // First visit ever: mail that already exists is not "new".
      let seen = seenRef.current ?? readKey(SEEN_KEY) ?? newest ?? NEVER;
      if (openRef.current && newest) seen = newest;
      seenRef.current = seen;
      writeKey(SEEN_KEY, seen);
      setUnread(list.filter((m) => m.createdAt > seen).length);
    } catch {
      // transient network error: the next poll retries
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    // Quick while the slide-over is open; slow (and only for a visible tab) while it is closed.
    const timer = setInterval(() => (isOpen || !document.hidden) && void load(), isOpen ? 2000 : 8000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [isOpen, load]);

  function openInbox() {
    openRef.current = true;
    if (latestRef.current) {
      seenRef.current = latestRef.current;
      writeKey(SEEN_KEY, latestRef.current);
    }
    setUnread(0);
    setOpen(true);
  }

  async function clear() {
    // Fetch first so the mail that was just sent (the sign-in code) is cleared too.
    await load();
    if (newestRawRef.current) {
      clearedRef.current = newestRawRef.current;
      writeKey(CLEARED_KEY, newestRawRef.current);
    }
    setMessages([]);
    setSelected(null);
    setUnread(0);
  }

  function onOpenChange(next: boolean) {
    openRef.current = next;
    setOpen(next);
  }

  const current = messages.find((m) => m.id === selected);

  return (
    <InboxContext.Provider value={{ open: openInbox, refresh: load, clear, unread }}>
      {children}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Demo inbox</SheetTitle>
            <SheetDescription>
              Plantify is a demo, so emails land here instead of a real mailbox.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {current ? (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <ArrowLeft aria-hidden /> Back
                </Button>
                <div className="space-y-1">
                  <h3 className="font-semibold leading-snug">{current.subject}</h3>
                  <p className="text-xs text-muted-foreground">
                    To {current.to} · {new Date(current.createdAt).toLocaleString()}
                  </p>
                </div>
                {/* Content is generated by our own server, never user-supplied HTML. Emails stay light, as in a real mail client. */}
                <div className="rounded-lg border bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: current.html }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Inbox aria-hidden className="size-8" />
                <p>No messages yet. Request a code and it will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border">
                {messages.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelected(m.id)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted">
                      <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Mail className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.subject}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.to}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </InboxContext.Provider>
  );
}

export function DemoInboxButton() {
  const { open, unread } = useDemoInbox();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative bg-background"
      onClick={open}
      aria-label={unread > 0 ? `Demo inbox, ${unread} new ${unread === 1 ? "message" : "messages"}` : "Demo inbox"}
    >
      <Mail className="size-4" />
      {unread > 0 && <span aria-hidden className="absolute top-1 right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-background" />}
    </Button>
  );
}
