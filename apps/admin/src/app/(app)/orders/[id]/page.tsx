'use client';

import { useMe } from '@/components/admin-shell';
import { useBreadcrumbLabel } from '@/components/app-header';
import { Badge, OrderBadge, PageHeader, RequirePermission, Skeleton } from '@/components/page-bits';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorMessage } from '@/lib/api-client';
import { formatDateTime, formatPrice } from '@/lib/format';
import { imageSrc } from '@/lib/images';
import { useApi } from '@/lib/use-api';
import type { AdminOrderDetail } from '@plantify/contracts';
import { canTransition } from '@plantify/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

const NEXT_STEP = { paid: 'processing', processing: 'shipped', shipped: 'delivered' } as const;
const NEXT_LABEL = {
	processing: 'Start processing',
	shipped: 'Mark as shipped',
	delivered: 'Mark as delivered',
} as const;

function OrderView() {
	const { id } = useParams<{ id: string }>();
	const { can } = useMe();
	const { data: order, loading, error, reload } = useApi<AdminOrderDetail>(`/admin/orders/${id}`);
	const [busy, setBusy] = useState(false);
	const [restock, setRestock] = useState(true);
	const [reason, setReason] = useState('');
	const [confirming, setConfirming] = useState<'refund' | 'cancel' | null>(null);
	useBreadcrumbLabel(order?.number);

	async function act(action: () => Promise<unknown>, success: string) {
		setBusy(true);
		try {
			await action();
			toast.success(success);
			reload();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <Skeleton className="h-96" />;
	if (error || !order) {
		return (
			<p>
				{error ?? 'Order not found.'}{' '}
				<Link href="/orders" className="underline">
					Back to orders
				</Link>
			</p>
		);
	}

	const next = order.status in NEXT_STEP ? NEXT_STEP[order.status as keyof typeof NEXT_STEP] : null;
	const a = order.shippingAddress;
	const refundable = canTransition(order.status, 'refunded');

	return (
		<div className="max-w-4xl space-y-6">
			<PageHeader
				title={order.number}
				description={`Placed ${formatDateTime(order.placedAt)}`}
				actions={<OrderBadge status={order.status} />}
			/>

			<div className="grid gap-4 md:grid-cols-3">
				<section className="rounded-xl border p-4 text-sm">
					<h2 className="mb-1 font-semibold">Customer</h2>
					<p>{order.customer.name}</p>
					<p className="text-muted-foreground">{order.customer.email}</p>
					{order.customer.guest && <p className="mt-1 text-xs text-muted-foreground">Guest checkout, no account</p>}
					{order.customer.id && can('customers:view') && (
						<Link href={`/customers/${order.customer.id}`} className="mt-1 inline-block underline">
							View customer
						</Link>
					)}
				</section>
				<section className="rounded-xl border p-4 text-sm">
					<h2 className="mb-1 font-semibold">Ship to</h2>
					<p>{a.fullName}</p>
					<p>{a.line1}</p>
					{a.line2 && <p>{a.line2}</p>}
					<p>
						{a.city}
						{a.region ? `, ${a.region}` : ''} {a.postalCode}
					</p>
				</section>
				<section className="rounded-xl border p-4 text-sm">
					<h2 className="mb-1 font-semibold">Billing</h2>
					{can('billing:manage') ? (
						<>
							{order.invoice ? (
								<p>Invoice {order.invoice.number}</p>
							) : (
								<p className="text-muted-foreground">No invoice (unpaid)</p>
							)}
							{order.payments.map(p => (
								<p key={p.id} className="text-muted-foreground">
									<span className="capitalize">{p.status.replace('_', ' ')}</span>
									{p.cardLast4 && ` · ${p.cardBrand} ${p.cardLast4}`}
									{p.failureReason && ` · ${p.failureReason.replace(/_/g, ' ')}`}
								</p>
							))}
						</>
					) : (
						<p className="text-muted-foreground">Billing details are visible to owners only.</p>
					)}
				</section>
			</div>

			<section className="overflow-hidden rounded-xl border md:grid md:grid-cols-[1fr_16rem]">
				<ul className="divide-y text-sm">
					{order.items.map(i => (
						<li key={i.sku} className="flex items-center gap-3 px-4 py-3">
							<span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
								{i.imageUrl && (
									<Image
										src={imageSrc(i.imageUrl)}
										alt=""
										fill
										unoptimized
										className="object-cover"
									/>
								)}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-medium">{i.productName}</span>
								<span className="block text-muted-foreground">
									{i.variantLabel} · {i.sku}
								</span>
							</span>
							<span className="shrink-0 text-right">
								{i.quantity} × {formatPrice(i.unitPriceCents)}
								<strong className="block">{formatPrice(i.unitPriceCents * i.quantity)}</strong>
							</span>
						</li>
					))}
				</ul>
				<dl className="space-y-1 border-t p-4 text-sm md:border-l md:border-t-0">
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Subtotal</dt>
						<dd>{formatPrice(order.subtotalCents)}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Shipping</dt>
						<dd>{formatPrice(order.shippingCents)}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Tax</dt>
						<dd>{formatPrice(order.taxCents)}</dd>
					</div>
					<div className="flex justify-between border-t pt-1 font-semibold">
						<dt>Total</dt>
						<dd>{formatPrice(order.totalCents)}</dd>
					</div>
				</dl>
			</section>

			{order.refunds.length > 0 && (
				<section className="space-y-1 rounded-xl border p-4 text-sm">
					<h2 className="font-semibold">Refunds</h2>
					{order.refunds.map(r => (
						<p key={r.id}>
							{formatPrice(r.amountCents)} on {formatDateTime(r.createdAt)}{' '}
							<Badge className="bg-muted">{r.restock ? 'restocked' : 'not restocked'}</Badge>
							{r.reason && <span className="text-muted-foreground"> · {r.reason}</span>}
						</p>
					))}
				</section>
			)}

			{refundable && can('orders:refund') && (
				<section className="space-y-3 rounded-xl border border-rose-200 p-4">
					<h2 className="font-semibold">Refund this order</h2>
					<p className="text-sm text-muted-foreground">
						Refunds the full amount (simulated). Owners only.
					</p>
					<div className="flex flex-wrap items-center gap-3 text-sm">
						<Input
							value={reason}
							onChange={e => setReason(e.target.value)}
							placeholder="Reason (optional)"
							maxLength={200}
							className="w-full"
							aria-label="Refund reason"
						/>
					</div>
					<div className="flex justify-between">
						<Label htmlFor="restock">
							<Checkbox
								id="restock"
								checked={restock}
								onCheckedChange={checked => setRestock(checked)}
							/>{' '}
							Put items back in stock
						</Label>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setConfirming('refund')}
						>
							Refund {formatPrice(order.totalCents)}
						</Button>
					</div>
				</section>
			)}

			<div className="flex flex-wrap items-center justify-end gap-2">
				{next && can('orders:fulfil') && (
					<Button
						disabled={busy}
						onClick={() =>
							act(
								() => api(`/admin/orders/${id}/status`, { method: 'POST', json: { status: next } }),
								'Order updated',
							)
						}
					>
						{NEXT_LABEL[next]}
					</Button>
				)}
				{order.status === 'pending_payment' && can('orders:fulfil') && (
					<Button
						disabled={busy}
						onClick={() => setConfirming('cancel')}
					>
						Cancel order
					</Button>
				)}
				{!can('orders:fulfil') && (
					<p className="text-sm text-muted-foreground">You can view orders but not change them.</p>
				)}
			</div>

			<ConfirmDialog
				open={confirming === 'refund'}
				onOpenChange={open => !open && setConfirming(null)}
				title={`Refund ${formatPrice(order.totalCents)}?`}
				description={`The full amount goes back to ${order.customer.name} (simulated).${restock ? ' The items are put back in stock.' : ''}`}
				confirmLabel={`Refund ${formatPrice(order.totalCents)}`}
				destructive
				busy={busy}
				onConfirm={async () => {
					await act(
						() =>
							api(`/admin/orders/${id}/refund`, {
								method: 'POST',
								json: { restock, ...(reason.trim() ? { reason: reason.trim() } : {}) },
							}),
						'Order refunded',
					);
					setConfirming(null);
				}}
			/>
			<ConfirmDialog
				open={confirming === 'cancel'}
				onOpenChange={open => !open && setConfirming(null)}
				title="Cancel this unpaid order?"
				description="The order is marked as cancelled and can no longer be paid."
				confirmLabel="Cancel order"
				cancelLabel="Keep order"
				destructive
				busy={busy}
				onConfirm={async () => {
					await act(
						() =>
							api(`/admin/orders/${id}/status`, { method: 'POST', json: { status: 'cancelled' } }),
						'Order cancelled',
					);
					setConfirming(null);
				}}
			/>
		</div>
	);
}

export default function OrderPage() {
	return (
		<RequirePermission permission="orders:view">
			<Suspense fallback={<Skeleton className="h-96" />}>
				<OrderView />
			</Suspense>
		</RequirePermission>
	);
}
