'use client';

import {
	Badge,
	EmptyState,
	ErrorState,
	PageHeader,
	Pager,
	RequirePermission,
	Skeleton,
	TableShell,
	TableToolbar,
	Td,
	Th,
} from '@/components/page-bits';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api, errorMessage, qs } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import type {
	Page,
	WebhookDeliveryView,
	WebhookEndpointView,
	WebhookEventType,
} from '@plantify/contracts';
import { WEBHOOK_ECHO_LABEL, WEBHOOK_ECHO_URL, WEBHOOK_EVENTS } from '@plantify/contracts';
import { Copy, Eye, EyeOff, Info, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Fragment, useState, type SubmitEvent } from 'react';
import { toast } from 'sonner';

const STATUS_STYLE = {
	delivered: 'bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300',
	failed: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300',
	pending: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300',
} as const;

function EventPicker({
	value,
	onChange,
	idPrefix,
}: {
	value: WebhookEventType[];
	onChange: (v: WebhookEventType[]) => void;
	idPrefix: string;
}) {
	return (
		<fieldset className="flex flex-wrap gap-x-4 gap-y-2">
			<legend className="sr-only">Events</legend>
			{WEBHOOK_EVENTS.map(ev => (
				<Label key={ev} htmlFor={`${idPrefix}-${ev}`} className="cursor-pointer">
					<Checkbox
						id={`${idPrefix}-${ev}`}
						checked={value.includes(ev)}
						onCheckedChange={checked =>
							onChange(checked ? [...value, ev] : value.filter(x => x !== ev))
						}
					/>
					<code className="text-xs">{ev}</code>
				</Label>
			))}
		</fieldset>
	);
}

/** Shows the built-in receiver by name; real endpoints by host and path. */
const endpointLabel = (url: string) =>
	url === WEBHOOK_ECHO_URL ? WEBHOOK_ECHO_LABEL : url.replace(/^https?:\/\//, '');

function EndpointCard({
	endpoint,
	onChange,
}: {
	endpoint: WebhookEndpointView;
	onChange: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [showSecret, setShowSecret] = useState(false);
	const [editing, setEditing] = useState(false);
	const [events, setEvents] = useState<WebhookEventType[]>(endpoint.events);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const builtin = endpoint.url === WEBHOOK_ECHO_URL;

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
			const d = await api<WebhookDeliveryView>(`/admin/webhooks/endpoints/${endpoint.id}/test`, {
				method: 'POST',
			});
			if (d.status === 'delivered') toast.success(`Test delivered (HTTP ${d.responseCode})`);
			else toast.error(`Test failed: ${d.lastError ?? 'unknown error'}`);
			onChange();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<li className={cn('space-y-3 rounded-xl border p-4', !endpoint.active && 'opacity-70')}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className={cn('truncate text-sm', !builtin && 'font-mono')}>{endpointLabel(endpoint.url)}</p>
					<p className="text-xs text-muted-foreground">
						{endpoint.stats.delivered} delivered · {endpoint.stats.failed} failed ·{' '}
						{endpoint.stats.pending} pending
					</p>
					{builtin && (
						<p className="mt-1 text-xs text-muted-foreground">
							Receives and verifies every signed event inside Plantify, so webhooks work without an
							external URL. Check the delivery log below.
						</p>
					)}
				</div>
				<Badge
					className={
						endpoint.active
							? 'bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300'
							: 'bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400'
					}
				>
					{endpoint.active ? 'active' : 'paused'}
				</Badge>
			</div>

			{editing ? (
				<div className="space-y-2">
					<EventPicker value={events} onChange={setEvents} idPrefix={`edit-${endpoint.id}`} />
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setEvents(endpoint.events);
								setEditing(false);
							}}
						>
							Cancel
						</Button>
						<Button
							disabled={busy || events.length === 0}
							onClick={async () =>
								(await act(
									() =>
										api(`/admin/webhooks/endpoints/${endpoint.id}`, {
											method: 'PATCH',
											json: { events },
										}),
									'Events saved',
								)) && setEditing(false)
							}
						>
							Save events
						</Button>
					</div>
				</div>
			) : (
				<div className="flex flex-wrap gap-1">
					{endpoint.events.map(ev => (
						<code key={ev} className="rounded bg-muted px-1.5 py-0.5 text-xs">
							{ev}
						</code>
					))}
				</div>
			)}

			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-muted-foreground">Signing secret:</span>
				<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
					{showSecret ? endpoint.secret : 'whsec_••••••••••••••••'}
				</code>
				<Button
					size="icon"
					variant="ghost"
					aria-label={showSecret ? 'Hide signing secret' : 'Reveal signing secret'}
					title={showSecret ? 'Hide signing secret' : 'Reveal signing secret'}
					onClick={() => setShowSecret(s => !s)}
				>
					{showSecret ? <EyeOff /> : <Eye />}
				</Button>
				{showSecret && (
					<Button
						size="icon"
						variant="ghost"
						aria-label="Copy signing secret"
						title="Copy signing secret"
						onClick={() =>
							navigator.clipboard.writeText(endpoint.secret).then(() => toast.success('Copied'))
						}
					>
						<Copy />
					</Button>
				)}
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button variant="outline" disabled={busy} onClick={test}>
					Send test event
				</Button>
				<Button variant="outline" disabled={busy} onClick={() => setEditing(e => !e)}>
					Edit events
				</Button>
				<Button
					variant="outline"
					disabled={busy}
					onClick={() =>
						act(
							() =>
								api(`/admin/webhooks/endpoints/${endpoint.id}`, {
									method: 'PATCH',
									json: { active: !endpoint.active },
								}),
							endpoint.active ? 'Endpoint paused' : 'Endpoint resumed',
						)
					}
				>
					{endpoint.active ? 'Pause' : 'Resume'}
				</Button>
				{!builtin && (
					<Button
						variant="destructive"
						size="icon"
						aria-label={`Delete ${endpoint.url}`}
						disabled={busy}
						onClick={() => setConfirmingDelete(true)}
					>
						<Trash2 />
					</Button>
				)}
			</div>
			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title="Delete this endpoint?"
				description="The endpoint and its delivery history are permanently removed. This cannot be undone."
				confirmLabel="Delete endpoint"
				destructive
				busy={busy}
				onConfirm={async () => {
					await act(
						() => api(`/admin/webhooks/endpoints/${endpoint.id}`, { method: 'DELETE' }),
						'Endpoint deleted',
					);
					setConfirmingDelete(false);
				}}
			/>
		</li>
	);
}

function Endpoints({ onChange, version }: { onChange: () => void; version: number }) {
	const { data, loading, error, reload } = useApi<WebhookEndpointView[]>(
		`/admin/webhooks/endpoints?v=${version}`,
	);
	const [url, setUrl] = useState('');
	const [events, setEvents] = useState<WebhookEventType[]>(['order.paid']);
	const [busy, setBusy] = useState(false);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			await api('/admin/webhooks/endpoints', { method: 'POST', json: { url: url.trim(), events } });
			toast.success('Endpoint added');
			setUrl('');
			reload();
			onChange();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	const atLimit = (data?.filter(ep => ep.url !== WEBHOOK_ECHO_URL).length ?? 0) >= 5;

	const refresh = () => {
		reload();
		onChange();
	};

	return (
		<section className="space-y-3">
			<h2 className="font-semibold">Endpoints</h2>
			{loading && !data ? (
				<Skeleton className="h-32" />
			) : error ? (
				<ErrorState onRetry={reload} />
			) : !data || data.length === 0 ? (
				<EmptyState>
					No endpoints yet. Add one below (webhook.site gives you a free test URL).
				</EmptyState>
			) : (
				<ul className="space-y-3">
					{data.map(ep => (
						// Keyed by server values so the card resets after a save.
						<EndpointCard
							key={`${ep.id}:${ep.events.join()}:${ep.active}`}
							endpoint={ep}
							onChange={refresh}
						/>
					))}
				</ul>
			)}
			<form onSubmit={add} className="space-y-3 rounded-xl border border-dashed p-4">
				<div className="space-y-1">
					<Label htmlFor="hook-url">Add endpoint</Label>
					<Input
						id="hook-url"
						value={url}
						onChange={e => setUrl(e.target.value)}
						placeholder="https://webhook.site/your-id"
						required
						maxLength={500}
					/>
					<p className="text-xs text-muted-foreground">
						Optional: the built-in endpoint already works. Your own URL must be HTTPS and public (webhook.site gives you a free one). Up to 5 endpoints.
					</p>
				</div>
				<div className="my-6">
					<EventPicker value={events} onChange={setEvents} idPrefix="new" />
				</div>
				<div className="flex justify-end">
					<Button
						type="submit"
						disabled={busy || atLimit || events.length === 0 || !url.trim()}
						title={atLimit ? 'Delete an endpoint to add another' : undefined}
					>
						<Plus /> Add endpoint
					</Button>
				</div>
			</form>
		</section>
	);
}

function Deliveries({ endpoints, version }: { endpoints: WebhookEndpointView[]; version: number }) {
	const [endpointId, setEndpointId] = useState('');
	const [status, setStatus] = useState('');
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const { data, loading, error, reload } = useApi<Page<WebhookDeliveryView>>(
		`/admin/webhooks/deliveries${qs({ endpointId, status, page, pageSize: 15, v: version })}`,
	);

	async function resend(id: string) {
		setBusy(true);
		try {
			const d = await api<WebhookDeliveryView>(`/admin/webhooks/deliveries/${id}/retry`, {
				method: 'POST',
			});
			if (d.status === 'delivered') toast.success('Delivered');
			else toast.error(`Still failing: ${d.lastError ?? 'unknown error'}`);
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
			<TableToolbar total={data?.total}>
				<Select
					value={endpointId}
					onValueChange={v => {
						setEndpointId(v);
						setPage(1);
					}}
					options={[
						{ value: '', label: 'All endpoints' },
						...endpoints.map(ep => ({
							value: ep.id,
							label: endpointLabel(ep.url).slice(0, 40),
						})),
					]}
					aria-label="Filter by endpoint"
				/>
				<Select
					value={status}
					onValueChange={v => {
						setStatus(v);
						setPage(1);
					}}
					options={[
						{ value: '', label: 'Any status' },
						{ value: 'delivered', label: 'Delivered' },
						{ value: 'failed', label: 'Failed' },
						{ value: 'pending', label: 'Pending' },
					]}
					aria-label="Filter by status"
				/>
				<Button variant="outline" onClick={reload}>
					<RefreshCw />
					Refresh
				</Button>
			</TableToolbar>
			{loading && !data ? (
				<Skeleton className="h-40" />
			) : error ? (
				<ErrorState onRetry={reload} />
			) : !data || data.items.length === 0 ? (
				<EmptyState>
					No deliveries yet. Place an order in the store or send a test event.
				</EmptyState>
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
							{data.items.map(d => (
								<Fragment key={d.id}>
									<tr className="hover:bg-muted/40">
										<Td className="whitespace-nowrap">{formatDateTime(d.createdAt)}</Td>
										<Td>
											<code className="text-xs">{d.event}</code>
										</Td>
										<Td clamp className="min-w-48 max-w-64 text-xs break-all text-muted-foreground">
											{endpointLabel(d.endpointUrl)}
										</Td>
										<Td className="whitespace-nowrap">
											<Badge className={STATUS_STYLE[d.status]}>{d.status}</Badge>
											{d.responseCode !== null && (
												<span className="ml-2 text-xs text-muted-foreground">
													HTTP {d.responseCode}
												</span>
											)}
										</Td>
										<Td right>{d.attempts}</Td>
										<Td right className="whitespace-nowrap">
											<div className="flex items-center justify-end gap-2">
												<Button
													variant="outline"
													onClick={() => setOpen(open === d.id ? null : d.id)}
												>
													{open === d.id ? 'Hide' : 'Details'}
												</Button>
												<Button
													variant="outline"
													className="min-w-20"
													disabled={busy}
													onClick={() => resend(d.id)}
												>
													{d.status === 'delivered' ? 'Resend' : 'Retry'}
												</Button>
											</div>
										</Td>
									</tr>
									{open === d.id && (
										<tr>
											<td colSpan={6} className="space-y-2 bg-muted/30 p-3">
												{d.lastError && (
													<p className="text-sm text-destructive">Last error: {d.lastError}</p>
												)}
												{d.lastAttemptAt && (
													<p className="text-xs text-muted-foreground">
														Last attempt {formatDateTime(d.lastAttemptAt)}
													</p>
												)}
												<pre className="max-h-64 overflow-auto rounded-lg border bg-background p-3 text-xs">
													{JSON.stringify(d.payload, null, 2)}
												</pre>
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
	const { data: endpoints } = useApi<WebhookEndpointView[]>(
		`/admin/webhooks/endpoints?list=${version}`,
	);

	return (
		<RequirePermission permission="webhooks:manage">
			<PageHeader
				title="Webhooks"
				description="Send order and stock events to another system. Each request is signed so the receiver can verify it came from Plantify."
			/>
			<div className="space-y-10">
				<Endpoints version={version} onChange={() => setVersion(v => v + 1)} />
				<Deliveries endpoints={endpoints ?? []} version={version} />
				<Alert>
					<Info />
					<AlertTitle>Verifying a request</AlertTitle>
					<AlertDescription>
						<ul className="list-disc space-y-1 pl-4">
							<li>
								Every delivery carries <code>x-plantify-event</code>,{' '}
								<code>x-plantify-delivery</code> and{' '}
								<code>x-plantify-signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>.
							</li>
							<li>
								Compute <code>HMAC-SHA256(secret, t + &quot;.&quot; + rawBody)</code> and compare it
								to <code>v1</code> in constant time.
							</li>
							<li>Reject timestamps older than five minutes.</li>
							<li>
								Failed deliveries are retried with a growing delay up to 5 attempts, or you can
								resend them from the log.
							</li>
						</ul>
					</AlertDescription>
				</Alert>
			</div>
		</RequirePermission>
	);
}
