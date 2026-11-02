'use client';

import { useCart } from '@/components/cart-provider';
import { useDemoInbox } from '@/components/demo-inbox';
import { GuestAccountOffer } from '@/components/guest-account-offer';
import { OrderItemRow } from '@/components/order-item-row';
import { OrderTotals } from '@/components/order-totals';
import { Button, buttonVariants } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { TrackedOrder } from '@plantify/contracts';
import { CheckCircle2, Mail, Package, Store } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function SuccessSkeleton() {
	return (
		<div aria-hidden className="mx-auto max-w-2xl space-y-6 px-4 py-10">
			<div className="mx-auto h-32 w-64 animate-pulse rounded-xl bg-muted" />
			<div className="h-48 animate-pulse rounded-xl bg-muted" />
		</div>
	);
}

function Success() {
	const { orderId } = useParams<{ orderId: string }>();
	const inbox = useDemoInbox();
	const [order, setOrder] = useState<TrackedOrder | null>(null);
	const [failed, setFailed] = useState(false);

	const { refresh: refreshInbox } = inbox;
	const { refresh: refreshCart } = useCart();
	useEffect(() => {
		// The receipt was just emailed: show the new-mail dot in the header right away, and the paid cart is now empty.
		void refreshInbox();
		void refreshCart();
	}, [refreshInbox, refreshCart]);

	useEffect(() => {
		api<TrackedOrder>(`/orders/${orderId}`)
			.then(setOrder)
			.catch(() => setFailed(true));
	}, [orderId]);

	if (failed) {
		return (
			<div className="mx-auto max-w-md px-4 py-16 text-center">
				<h1 className="text-2xl font-bold tracking-tight">We couldn&apos;t find that order</h1>
				<p className="mt-2 text-muted-foreground">It may belong to another account.</p>
				<Link href="/account/orders" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
					View my orders
				</Link>
			</div>
		);
	}
	if (!order) return <SuccessSkeleton />;

	return (
		<div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
			<div className="text-center">
				<span
					aria-hidden
					className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
				>
					<CheckCircle2 className="size-9" />
				</span>
				<h1 className="mt-4 text-2xl font-bold tracking-tight">Thank you for your order!</h1>
				<p className="mt-1 text-muted-foreground">
					Order <strong>{order.number}</strong>
					{order.invoice && (
						<>
							{' '}
							· Invoice <strong>{order.invoice.number}</strong>
						</>
					)}
				</p>
				{order.payment?.cardLast4 && (
					<p className="text-sm text-muted-foreground">
						Paid with {order.payment.cardBrand} ending {order.payment.cardLast4} (simulated)
					</p>
				)}
				<p className="mt-3 text-sm text-muted-foreground">
					We emailed your receipt to{' '}
					<strong className="font-medium text-foreground">{order.contactEmail}</strong>
					{order.guest ? ', with a link to follow this order.' : '.'}
					<br />
					{order.guest ? 'The link works for 24 hours.' : '.'}
				</p>
			</div>

			<div className="rounded-xl border bg-card p-5">
				<ul className="divide-y text-sm">
					{order.items.map(i => (
						<OrderItemRow key={i.sku} item={i} />
					))}
				</ul>
				<div className="mt-3 border-t pt-3">
					<OrderTotals totals={order} />
				</div>
			</div>

			<div className="flex items-center flex-col sm:flex-row justify-center gap-2">
				<Button variant="outline" size="lg" onClick={inbox.open} className="w-full sm:w-fit">
					<Mail aria-hidden /> Open demo inbox
				</Button>
				<Link
					href={
						order.guest && order.trackToken
							? `/orders/track/${order.trackToken}`
							: `/account/orders/${order.id}`
					}
					className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-fit')}
				>
					<Package aria-hidden /> {order.guest ? 'Track this order' : 'View order'}
				</Link>
				<Link
					href="/shop"
					className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'w-full sm:w-fit')}
				>
					<Store aria-hidden /> Keep shopping
				</Link>
			</div>
			{order.guest && <GuestAccountOffer email={order.contactEmail} />}
		</div>
	);
}

export default function SuccessPage() {
	return (
		<Suspense fallback={<SuccessSkeleton />}>
			<Success />
		</Suspense>
	);
}
