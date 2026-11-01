'use client';

import { useCart } from '@/components/cart-provider';
import { QuantityStepper } from '@/components/quantity-stepper';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProductVariantDetail } from '@plantify/contracts';
import { MAX_QTY_PER_LINE } from '@plantify/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function VariantPicker({
	variants,
	productName,
}: {
	variants: ProductVariantDetail[];
	productName: string;
}) {
	const router = useRouter();
	const { add } = useCart();
	const firstAvailable = variants.find(v => v.stock > 0) ?? variants[0]!;
	const [selectedId, setSelectedId] = useState(firstAvailable.id);
	const [quantity, setQuantity] = useState(1);
	const [busy, setBusy] = useState(false);
	const selected = variants.find(v => v.id === selectedId)!;
	const maxQty = Math.max(1, Math.min(selected.stock, MAX_QTY_PER_LINE));

	const stockNote =
		selected.stock === 0
			? 'Sold out'
			: selected.stock <= selected.lowStockThreshold
				? `Only ${selected.stock} left`
				: 'In stock';

	async function addToCart() {
		setBusy(true);
		const ok = await add(selected.id, Math.min(quantity, maxQty));
		setBusy(false);
		if (ok) {
			toast.success(`${productName} (${selected.label}) added to your cart`, {
				action: { label: 'View cart', onClick: () => router.push('/cart') },
			});
		}
	}

	return (
		<div className="space-y-4">
			<p className="text-3xl font-semibold tracking-tight">{formatPrice(selected.priceCents)}</p>

			<fieldset className="space-y-2">
				<legend className="text-sm font-medium">Size</legend>
				<div className="flex flex-wrap gap-2">
					{variants.map(v => (
						<button
							key={v.id}
							type="button"
							onClick={() => {
								setSelectedId(v.id);
								setQuantity(1);
							}}
							aria-pressed={v.id === selectedId}
							className={cn(
								'rounded-lg border px-3.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
								v.id === selectedId &&
									'border-green-700 bg-green-50 ring-1 ring-green-700 hover:bg-green-50 dark:border-green-500 dark:bg-green-950 dark:ring-green-500 dark:hover:bg-green-950',
								v.stock === 0 && 'text-muted-foreground line-through',
							)}
						>
							<span className="block">{v.label}</span>
							<span className="text-xs text-muted-foreground">{formatPrice(v.priceCents)}</span>
						</button>
					))}
				</div>
			</fieldset>

			<p
				className={cn(
					'flex items-center gap-2 text-sm',
					selected.stock === 0
						? 'text-destructive'
						: selected.stock <= selected.lowStockThreshold
							? 'text-amber-700 dark:text-amber-400'
							: 'text-green-800 dark:text-green-400',
				)}
			>
				<span aria-hidden className="size-2 rounded-full bg-current" />
				{stockNote}
			</p>

			<div className="flex flex-wrap items-center gap-3 border-t pt-5">
				<QuantityStepper
					label={`Quantity for ${productName}`}
					value={Math.min(quantity, maxQty)}
					max={maxQty}
					disabled={selected.stock === 0}
					onChange={setQuantity}
				/>
				<Button size="lg" disabled={selected.stock === 0 || busy} onClick={addToCart}>
					{selected.stock === 0 ? 'Sold out' : busy ? 'Adding…' : 'Add to cart'}
				</Button>
			</div>
		</div>
	);
}
