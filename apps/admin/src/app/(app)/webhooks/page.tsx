"use client";

import { Fragment, useState, type FormEvent } from "react";
import type { Page, WebhookDeliveryView, WebhookEndpointView, WebhookEventType } from "@plantify/contracts";
import { WEBHOOK_EVENTS } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, EmptyState, PageHeader, Pager, TableToolbar, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage, qs } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const STATUS_STYLE = { delivered: "bg-green-100 text-green-900", failed: "bg-rose-100 text-rose-900", pending: "bg-amber-100 text-amber-900" } as const;

function EventPicker({ value, onChange }: { value: WebhookEventType[]; onChange: (v: WebhookEventType[]) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
      <legend className="sr-only">Events</legend>
      {WEBHOOK_EVENTS.map((ev) => (
        <label key={ev} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={value.includes(ev)} onChange={(e) => onChange(e.target.checked ? [...value, ev] : value.filter((x) => x !== ev))} />
          <code className="text-xs">{ev}</code>
        </label>
      ))}
    </fieldset>
  );
}

function EndpointCard({ endpoint, onChange }: { endpoint: WebhookEndpointView; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<WebhookEventType[]>(endpoint.events);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onChange();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const d = await api<WebhookDeliveryView>(`/admin/webhooks/endpoints/${endpoint.id}/test`, { method: "POST" });
      if (d.status === "delivered") toast.success(`Test delivered (HTTP ${d.responseCode})`);
      else toast.error(`Test failed: ${d.lastError ?? "unknown error"}`);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("space-y-3 rounded-xl border p-4", !endpoint.active && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{endpoint.url}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.stats.delivered} delivered · {endpoint.stats.failed} failed · {endpoint.stats.pending} pending
          </p>
        </div>
        <Badge className={endpoint.active ? "bg-green-100 text-green-900" : "bg-gray-200 text-gray-800"}>{endpoint.active ? "active" : "paused"}</Badge>
      </div>

      {editing ? (
        <div className="space-y-2">
          <EventPicker value={events} onChange={setEvents} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || events.length === 0}
              onClick={async () => (await act(() => api(`/admin/webhooks/endpoints/${endpoint.id}`, { method: "PATCH", json: { events } }), "Events saved")) && setEditing(false)}
            >
              Save events
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEvents(endpoint.events); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {endpoint.events.map((ev) => (
            <code key={ev} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {ev}
            </code>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Signing secret:</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{showSecret ? endpoint.secret : "whsec_••••••••••••••••"}</code>
        <Button size="sm" variant="ghost" onClick={() => setShowSecret((s) => !s)}>
          {showSecret ? "Hide" : "Reveal"}
        </Button>
        {showSecret && (
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(endpoint.secret).then(() => toast.success("Copied"))}>
            Copy
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={test}>
          Send test event
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((e) => !e)}>
          Edit events
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api(`/admin/webhooks/endpoints/${endpoint.id}`, { method: "PATCH", json: { active: !endpoint.active } }), endpoint.active ? "Endpoint paused" : "Endpoint resumed")}>
          {endpoint.active ? "Pause" : "Resume"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => window.confirm("Delete this endpoint and its delivery history?") && void act(() => api(`/admin/webhooks/endpoints/${endpoint.id}`, { method: "DELETE" }), "Endpoint deleted")}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

function Endpoints({ onChange, version }: { onChange: () => void; version: number }) {
  const { data, loading, reload } = useApi<WebhookEndpointView[]>(`/admin/webhooks/endpoints?v=${version}`);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>(["order.paid"]);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/webhooks/endpoints", { method: "POST", json: { url: url.trim(), events } });
      toast.success("Endpoint added");
      setUrl("");
      reload();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const refresh = () => {
    reload();
    onChange();
  };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Endpoints</h2>
      {loading && !data ? (
        <Skeleton className="h-32" />
      ) : !data || data.length === 0 ? (
        <EmptyState>No endpoints yet. Add one below (webhook.site gives you a free test URL).</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((ep) => (
            // Keyed by server values so the card resets after a save.
            <EndpointCard key={`${ep.id}:${ep.events.join()}:${ep.active}`} endpoint={ep} onChange={refresh} />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="space-y-3 rounded-xl border border-dashed p-4">
        <div className="space-y-1">
          <Label htmlFor="hook-url">Add endpoint</Label>
          <Input id="hook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://webhook.site/your-id" required maxLength={500} className="max-w-xl" />
          <p className="text-xs text-muted-foreground">HTTPS only. Addresses on private networks are blocked. Up to 5 endpoints.</p>
        </div>
        <EventPicker value={events} onChange={setEvents} />
        <Button type="submit" disabled={busy || events.length === 0 || !url.trim()}>
          Add endpoint
        </Button>
      </form>
    </section>
  );
}

function Deliveries({ endpoints, version }: { endpoints: WebhookEndpointView[]; version: number }) {
  const [endpointId, setEndpointId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useApi<Page<WebhookDeliveryView>>(`/admin/webhooks/deliveries${qs({ endpointId, status, page, pageSize: 15, v: version })}`);

  async function resend(id: string) {
    setBusy(true);
    try {
      const d = await api<WebhookDeliveryView>(`/admin/webhooks/deliveries/${id}/retry`, { method: "POST" });
      if (d.status === "delivered") toast.success("Delivered");
      else toast.error(`Still failing: ${d.lastError ?? "unknown error"}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Delivery log</h2>
      <TableToolbar total={data?.total} className="mb-0">
        <Select
          value={endpointId}
          onValueChange={(v) => {
            setEndpointId(v);
            setPage(1);
          }}
          options={[{ value: "", label: "All endpoints" }, ...endpoints.map((ep) => ({ value: ep.id, label: ep.url.replace(/^https?:\/\//, "").slice(0, 40) }))]}
          aria-label="Filter by endpoint"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "Any status" },
            { value: "delivered", label: "Delivered" },
            { value: "failed", label: "Failed" },
            { value: "pending", label: "Pending" },
          ]}
          aria-label="Filter by status"
        />
        <Button variant="outline" onClick={reload}>
          Refresh
        </Button>
      </TableToolbar>
      {loading && !data ? (
        <Skeleton className="h-40" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No deliveries yet. Place an order in the store or send a test event.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Event</Th>
                <Th>Endpoint</Th>
                <Th>Status</Th>
                <Th right>Attempts</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((d) => (
                <Fragment key={d.id}>
                  <tr className="hover:bg-muted/40">
                    <Td className="whitespace-nowrap">{formatDateTime(d.createdAt)}</Td>
                    <Td>
                      <code className="text-xs">{d.event}</code>
                    </Td>
                    <Td className="max-w-48 truncate text-xs text-muted-foreground" >{d.endpointUrl.replace(/^https?:\/\//, "")}</Td>
                    <Td>
                      <Badge className={STATUS_STYLE[d.status]}>{d.status}</Badge>
                      {d.responseCode !== null && <span className="ml-2 text-xs text-muted-foreground">HTTP {d.responseCode}</span>}
                    </Td>
                    <Td right>{d.attempts}</Td>
                    <Td right className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setOpen(open === d.id ? null : d.id)}>
                        {open === d.id ? "Hide" : "Details"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => resend(d.id)}>
                        {d.status === "delivered" ? "Resend" : "Retry"}
                      </Button>
                    </Td>
                  </tr>
                  {open === d.id && (
                    <tr>
                      <td colSpan={6} className="space-y-2 bg-muted/30 p-3">
                        {d.lastError && <p className="text-sm text-destructive">Last error: {d.lastError}</p>}
                        {d.lastAttemptAt && <p className="text-xs text-muted-foreground">Last attempt {formatDateTime(d.lastAttemptAt)}</p>}
                        <pre className="max-h-64 overflow-auto rounded-lg border bg-background p-3 text-xs">{JSON.stringify(d.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </TableShell>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

export default function WebhooksPage() {
  const [version, setVersion] = useState(0);
  const { data: endpoints } = useApi<WebhookEndpointView[]>(`/admin/webhooks/endpoints?list=${version}`);

  return (
    <RequirePermission permission="webhooks:manage">
      <PageHeader title="Webhooks" description="Send order and stock events to another system. Each request is signed so the receiver can verify it came from Plantify." />
      <div className="max-w-4xl space-y-10">
        <Endpoints version={version} onChange={() => setVersion((v) => v + 1)} />
        <Deliveries endpoints={endpoints ?? []} version={version} />
        <section className="space-y-2 rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">Verifying a request</h2>
          <p className="text-muted-foreground">
            Every delivery carries <code>x-plantify-event</code>, <code>x-plantify-delivery</code> and <code>x-plantify-signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>. Compute{" "}
            <code>HMAC-SHA256(secret, t + &quot;.&quot; + rawBody)</code>, compare it to <code>v1</code> in constant time, and reject timestamps older than five minutes. Failed deliveries are retried with a growing
            delay up to 5 attempts, or resend them from the log.
          </p>
        </section>
      </div>
    </RequirePermission>
  );
}
