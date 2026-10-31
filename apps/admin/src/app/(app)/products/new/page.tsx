'use client';

import { PageHeader, RequirePermission } from '@/components/page-bits';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api-client';
import { dollarsToCents } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { AdminCategory, AdminProductDetail, ProductStatus } from '@plantify/contracts';
import { PRODUCT_STATUSES } from '@plantify/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

type VariantRow = { label: string; price: string; stock: string };

export default function NewProductPage() {
	const router = useRouter();
	const { data: categories } = useApi<AdminCategory[]>('/admin/categories');
	const [busy, setBusy] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [categoryId, setCategoryId] = useState('');
	const [status, setStatus] = useState<ProductStatus>('draft');
	const [featured, setFeatured] = useState(false);
	const [variants, setVariants] = useState<VariantRow[]>([
		{ label: 'Standard', price: '', stock: '0' },
	]);

	const patchVariant = (i: number, patch: Partial<VariantRow>) =>
		setVariants(vs => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		const parsed = variants.map(v => ({
			label: v.label.trim(),
			priceCents: dollarsToCents(v.price),
			initialStock: Number(v.stock),
		}));
		if (
			parsed.some(
				v => v.priceCents === null || !Number.isInteger(v.initialStock) || v.initialStock < 0,
			)
		) {
			toast.error('Every variant needs a price above $0 and a whole-number stock.');
			return;
		}
		setBusy(true);
		try {
			const created = await api<AdminProductDetail>('/admin/products', {
				method: 'POST',
				json: {
					name: name.trim(),
					description: description.trim(),
					categoryId: categoryId || categories?.[0]?.id,
					status,
					featured,
					variants: parsed,
				},
			});
			toast.success('Product created');
			router.push(`/products/${created.id}`);
		} catch (err) {
			toast.error(errorMessage(err));
			setBusy(false);
		}
	}

	return (
		<RequirePermission permission="catalog:manage">
			<PageHeader title="New product" description="Add images after saving." />
			<form onSubmit={onSubmit} className="max-w-2xl space-y-6">
				<div className="space-y-2">
					<Label htmlFor="name">Name</Label>
					<Input
						id="name"
						value={name}
						onChange={e => setName(e.target.value)}
						required
						minLength={2}
						maxLength={120}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="description">Description</Label>
					<textarea
						id="description"
						value={description}
						onChange={e => setDescription(e.target.value)}
						maxLength={2000}
						rows={4}
						className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
					/>
				</div>
				<div className="grid items-end gap-4 sm:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="category">Category</Label>
						<Select
							id="category"
							value={categoryId || categories?.[0]?.id || ''}
							onValueChange={setCategoryId}
							options={(categories ?? []).map(c => ({ value: c.id, label: c.name }))}
							className="w-full"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<Select
							id="status"
							value={status}
							onValueChange={v => setStatus(v as ProductStatus)}
							options={PRODUCT_STATUSES.map(s => ({ value: s, label: s }))}
							className="w-full"
						/>
					</div>
					<Label htmlFor="featured" className="h-8">
						<Checkbox
							id="featured"
							checked={featured}
							onCheckedChange={checked => setFeatured(checked)}
						/>{' '}
						Featured on the home page
					</Label>
				</div>

				<fieldset className="space-y-3">
					<legend className="text-sm font-medium">Variants (sizes / options)</legend>
					{variants.map((v, i) => (
						<div key={i} className="grid grid-cols-[1fr_110px_90px_auto] items-end gap-2">
							<div className="space-y-1">
								{i === 0 && <Label className="text-xs">Label</Label>}
								<Input
									value={v.label}
									onChange={e => patchVariant(i, { label: e.target.value })}
									required
									maxLength={60}
									aria-label={`Variant ${i + 1} label`}
								/>
							</div>
							<div className="space-y-1">
								{i === 0 && <Label className="text-xs">Price ($)</Label>}
								<Input
									inputMode="decimal"
									value={v.price}
									onChange={e => patchVariant(i, { price: e.target.value })}
									required
									aria-label={`Variant ${i + 1} price`}
								/>
							</div>
							<div className="space-y-1">
								{i === 0 && <Label className="text-xs">Stock</Label>}
								<Input
									inputMode="numeric"
									value={v.stock}
									onChange={e => patchVariant(i, { stock: e.target.value })}
									required
									aria-label={`Variant ${i + 1} stock`}
								/>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={variants.length === 1}
								onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))}
							>
								Remove
							</Button>
						</div>
					))}
					{variants.length < 10 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setVariants(vs => [...vs, { label: '', price: '', stock: '0' }])}
						>
							Add variant
						</Button>
					)}
				</fieldset>

				<div className="flex gap-2">
					<Button type="submit" disabled={busy || !categories}>
						{busy ? 'Creating…' : 'Create product'}
					</Button>
					<Link href="/products" className="inline-flex h-8 items-center px-3 text-sm underline">
						Cancel
					</Link>
				</div>
			</form>
		</RequirePermission>
	);
}
