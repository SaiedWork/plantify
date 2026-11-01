'use client';

import { useCart } from '@/components/cart-provider';
import { OrderTotals } from '@/components/order-totals';
import { QuantityStepper } from '@/components/quantity-stepper';
import { Button, buttonVariants } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CartLine } from '@plantify/contracts';
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QTY_PER_LINE } from '@plantify/contracts';
import { ArrowLeft, ShoppingCart, Trash2, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

function CartSkeleton() {
	return (
		<div aria-hidden className="mx-auto max-w-5xl px-4 py-8">
			<div className="mb-6 h-8 w-40 animate-pulse rounded bg-muted" />
			<div className="grid gap-8 md:grid-cols-[1fr_320px]">
				<div className="h-72 animate-pulse rounded-xl bg-muted" />
				<div className="h-64 animate-pulse rounded-xl bg-muted" />
			</div>
		</div>
	);
}

function CartLineItem({ line }: { line: CartLine }) {
	const { setQuantity, remove, add } = useCart();
	const [busy, setBusy] = useState(false);
	const max = Math.max(1, Math.min(line.stock, MAX_QTY_PER_LINE));
	const over = line.quantity > line.stock;
	const soldOut = line.stock === 0;

	// Removing needs no confirmation: the toast offers an undo that puts the same quantity back.
	async function removeWithUndo() {
		if (!(await remove(line.variantId))) return;
		toast(`${line.productName} (${line.variantLabel}) removed`, {
			action: { label: 'Undo', onClick: () => void add(line.variantId, line.quantity) },
		});
	}

	// One request at a time per line, so a quick double click cannot send two updates.
	async function run(action: () => Promise<void>) {
		setBusy(true);
		await action();
		setBusy(false);
	}

	return (
		<li className={cn('flex gap-4 p-4 transition-opacity', busy && 'opacity-60')} aria-busy={busy}>
			<Link
				href={`/products/${line.productSlug}`}
				aria-label={line.productName}
				className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5 sm:size-24"
			>
				{line.imageUrl && (
					<Image
						src={line.imageUrl}
						alt=""
						fill
						unoptimized
						sizes="96px"
						className="object-cover"
					/>
				)}
			</Link>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<Link href={`/products/${line.productSlug}`} className="font-medium hover:underline">
							{line.productName}
						</Link>
						<p className="text-sm text-muted-foreground">{line.variantLabel}</p>
						<p className="text-sm text-muted-foreground">{formatPrice(line.unitPriceCents)} each</p>
					</div>
					<p className="shrink-0 font-semibold tabular-nums">{formatPrice(line.lineTotalCents)}</p>
				</div>
				{over && (
					<p role="alert" className="text-sm text-destructive">
						{soldOut
							? 'Sold out. Remove it to continue.'
							: `Only ${line.stock} left. Lower the quantity to continue.`}
					</p>
				)}
				<div className="mt-auto flex items-center justify-between gap-3">
					<QuantityStepper
						label={`Quantity for ${line.productName}`}
						value={line.quantity}
						max={max}
						disabled={busy || soldOut}
						onChange={(next) => run(() => setQuantity(line.variantId, Math.min(next, max)))}
					/>
					<Button
						variant="ghost"
						size="icon-sm"
						className="text-muted-foreground hover:text-destructive"
						disabled={busy}
						onClick={() => run(removeWithUndo)}
						aria-label={`Remove ${line.productName}`}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>
		</li>
	);
}

function FreeShippingProgress({ subtotalCents }: { subtotalCents: number }) {
	const remaining = FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents;
	const reached = remaining <= 0;
	return (
		<div className="space-y-1.5 rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
			<p className="flex items-center gap-2">
				<Truck aria-hidden className="size-4 shrink-0" />
				{reached
					? 'You get free shipping.'
					: `Add ${formatPrice(remaining)} more for free shipping.`}
			</p>
			<div
				role="progressbar"
				aria-label="Progress to free shipping"
				aria-valuemin={0}
				aria-valuemax={FREE_SHIPPING_THRESHOLD_CENTS}
				aria-valuenow={Math.min(subtotalCents, FREE_SHIPPING_THRESHOLD_CENTS)}
				className="h-1.5 overflow-hidden rounded-full bg-green-200 dark:bg-green-900"
			>
				<div
					className="h-full rounded-full bg-green-700 transition-[width] dark:bg-green-500"
					style={{
						width: `${Math.min(100, (subtotalCents / FREE_SHIPPING_THRESHOLD_CENTS) * 100)}%`,
					}}
				/>
			</div>
		</div>
	);
}

export default function CartPage() {
	const { cart } = useCart();

	if (!cart) return <CartSkeleton />;

	if (cart.lines.length === 0) {
		return (
			<div className="mx-auto max-w-6xl px-4 py-16">
				<div className="mx-auto w-full rounded-2xl border border-dashed p-10 text-center">
					<span
						aria-hidden
						className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<ShoppingCart className="size-6" />
					</span>
					<h1 className="mt-4 text-2xl font-bold tracking-tight">Your cart is empty</h1>
					<p className="mt-2 text-muted-foreground">Plants are waiting for a home.</p>
					<Link href="/shop" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
						Start shopping
					</Link>
				</div>
			</div>
		);
	}

	const blocked = cart.lines.some(l => l.quantity > l.stock);

	return (
		<div className="mx-auto max-w-6xl px-4 py-8">
			<div className="mb-4 flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold tracking-tight">
					Your cart{' '}
					<span className="text-base font-normal text-muted-foreground">
						&nbsp;({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
					</span>
				</h1>
			</div>
			<div className="grid items-start gap-4 md:grid-cols-[1fr_320px]">
				<ul className="divide-y rounded-xl border bg-card">
					{cart.lines.map(line => (
						<CartLineItem key={line.variantId} line={line} />
					))}
				</ul>

				<div className="flex flex-col md:sticky md:top-30 gap-4">
					<aside className="space-y-4 rounded-xl border bg-card p-5 ">
						<h2 className="font-semibold">Order summary</h2>
						<FreeShippingProgress subtotalCents={cart.subtotalCents} />
						<OrderTotals totals={cart} />
						{blocked ? (
							<Button size="lg" className="w-full mb-0" disabled>
								Fix your cart to continue
							</Button>
						) : (
							<Link href="/checkout" className={cn(buttonVariants({ size: 'lg' }), 'w-full mb-0')}>
								Checkout
							</Link>
						)}
					</aside>
					<Link
						href="/shop"
						className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline justify-center"
					>
						<ArrowLeft aria-hidden className="size-4" /> Continue shopping
					</Link>
				</div>
			</div>
		</div>
	);
}
