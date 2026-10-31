'use client';

import { useBreadcrumbLabel } from '@/components/app-header';
import {
	PageHeader,
	RequirePermission,
	Skeleton,
	TableShell,
	Td,
	Th,
} from '@/components/page-bits';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api-client';
import { centsToDollars, dollarsToCents } from '@/lib/format';
import { imageSrc } from '@/lib/images';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import type {
	AdminCategory,
	AdminProductDetail,
	AdminVariant,
	ProductStatus,
} from '@plantify/contracts';
import { MAX_IMAGES_PER_PRODUCT, PRODUCT_STATUSES } from '@plantify/contracts';
import { ImagePlus, Plus, Star, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

/** Runs a mutation with a busy flag and toast feedback; returns whether it succeeded. */
function useAction(reload: () => void) {
	const [busy, setBusy] = useState(false);
	const run = async (action: () => Promise<unknown>, success: string) => {
		setBusy(true);
		try {
			await action();
			toast.success(success);
			reload();
			return true;
		} catch (err) {
			toast.error(errorMessage(err));
			return false;
		} finally {
			setBusy(false);
		}
	};
	return { busy, run };
}

function Details({
	product,
	categories,
	reload,
}: {
	product: AdminProductDetail;
	categories: AdminCategory[];
	reload: () => void;
}) {
	const { busy, run } = useAction(reload);
	const [name, setName] = useState(product.name);
	const [description, setDescription] = useState(product.description);
	const [categoryId, setCategoryId] = useState(product.categoryId);
	const [status, setStatus] = useState<ProductStatus>(product.status);
	const [featured, setFeatured] = useState(product.featured);

	const dirty =
		name !== product.name ||
		description !== product.description ||
		categoryId !== product.categoryId ||
		status !== product.status ||
		featured !== product.featured;

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		void run(
			() =>
				api(`/admin/products/${product.id}`, {
					method: 'PATCH',
					json: {
						name: name.trim(),
						description: description.trim(),
						categoryId,
						status,
						featured,
					},
				}),
			'Product saved',
		);
	}

	return (
		<form onSubmit={onSubmit} className="@container space-y-4 rounded-xl border p-4">
			<h2 className="font-semibold">Details</h2>
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
			<div className="grid grid-cols-2 items-end gap-4 @lg:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="category">Category</Label>
					<Select
						id="category"
						value={categoryId}
						onValueChange={setCategoryId}
						options={(categories ?? []).map(c => ({ value: c.id, label: c.name }))}
						className="w-full min-w-0"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="status">Status</Label>
					<Select
						id="status"
						value={status}
						onValueChange={v => setStatus(v as ProductStatus)}
						options={PRODUCT_STATUSES.map(s => ({ value: s, label: s }))}
						className="w-full min-w-0"
					/>
				</div>
				<Label htmlFor="featured" className="col-span-2 h-8 cursor-pointer @lg:col-span-1">
					<Checkbox
						id="featured"
						checked={featured}
						onCheckedChange={checked => setFeatured(checked)}
					/>{' '}
					Featured
				</Label>
			</div>
			<p className="text-xs text-muted-foreground">
				Only <strong>active</strong> products appear in the store. Public URL:{' '}
				<code>/products/{product.slug}</code>
			</p>
			<div className="flex justify-end">
				<Button type="submit" disabled={busy || !dirty}>
					Save details
				</Button>
			</div>
		</form>
	);
}

function VariantRow({
	variant,
	canDelete,
	reload,
}: {
	variant: AdminVariant;
	canDelete: boolean;
	reload: () => void;
}) {
	const { busy, run } = useAction(reload);
	const [label, setLabel] = useState(variant.label);
	const [sku, setSku] = useState(variant.sku);
	const [price, setPrice] = useState(centsToDollars(variant.priceCents));
	const [threshold, setThreshold] = useState(String(variant.lowStockThreshold));
	const [confirming, setConfirming] = useState(false);

	const priceCents = dollarsToCents(price);
	const dirty =
		label !== variant.label ||
		sku !== variant.sku ||
		priceCents !== variant.priceCents ||
		Number(threshold) !== variant.lowStockThreshold;

	function save() {
		if (priceCents === null || !Number.isInteger(Number(threshold)) || Number(threshold) < 0) {
			toast.error('Enter a price above $0 and a whole-number threshold.');
			return;
		}
		void run(
			() =>
				api(`/admin/variants/${variant.id}`, {
					method: 'PATCH',
					json: {
						label: label.trim(),
						sku: sku.trim(),
						priceCents,
						lowStockThreshold: Number(threshold),
					},
				}),
			'Variant saved',
		);
	}

	return (
		<tr>
			<Td>
				<Input
					value={label}
					onChange={e => setLabel(e.target.value)}
					aria-label="Label"
					className="h-8 min-w-36"
				/>
			</Td>
			<Td>
				<Input
					value={sku}
					onChange={e => setSku(e.target.value)}
					aria-label="SKU"
					className="h-8 w-36"
				/>
			</Td>
			<Td>
				<Input
					value={price}
					onChange={e => setPrice(e.target.value)}
					inputMode="decimal"
					aria-label="Price"
					className="h-8 w-24"
				/>
			</Td>
			<Td>
				<Input
					value={threshold}
					onChange={e => setThreshold(e.target.value)}
					inputMode="numeric"
					aria-label="Low stock threshold"
					className="h-8 w-20"
				/>
			</Td>
			<Td right>
				<Link href={`/inventory?q=${encodeURIComponent(variant.sku)}`} className="underline">
					{variant.stock}
				</Link>
			</Td>
			<Td right className="whitespace-nowrap">
				<div className="flex items-center justify-end gap-2">
					<Button disabled={busy || !dirty} onClick={save}>
						Save
					</Button>
					<Button
						variant="destructive"
						size="icon"
						aria-label={`Delete ${variant.label}`}
						disabled={busy || !canDelete}
						onClick={() => setConfirming(true)}
					>
						<Trash2 />
					</Button>
				</div>
				<ConfirmDialog
					open={confirming}
					onOpenChange={setConfirming}
					title={`Delete the "${variant.label}" variant?`}
					description="This permanently removes the variant. A variant that appears on past orders cannot be deleted."
					confirmLabel="Delete variant"
					destructive
					busy={busy}
					onConfirm={async () => {
						await run(
							() => api(`/admin/variants/${variant.id}`, { method: 'DELETE' }),
							'Variant deleted',
						);
						setConfirming(false);
					}}
				/>
			</Td>
		</tr>
	);
}

function Variants({ product, reload }: { product: AdminProductDetail; reload: () => void }) {
	const { busy, run } = useAction(reload);
	const [label, setLabel] = useState('');
	const [price, setPrice] = useState('');
	const [stock, setStock] = useState('0');
	const [threshold, setThreshold] = useState('5');
	const atLimit = product.variants.length >= 10;

	async function add(e: FormEvent) {
		e.preventDefault();
		const priceCents = dollarsToCents(price);
		if (
			priceCents === null ||
			!Number.isInteger(Number(stock)) ||
			Number(stock) < 0 ||
			!Number.isInteger(Number(threshold)) ||
			Number(threshold) < 0
		) {
			toast.error('Enter a price above $0 and whole-number stock and low-stock levels.');
			return;
		}
		const ok = await run(
			() =>
				api(`/admin/products/${product.id}/variants`, {
					method: 'POST',
					json: {
						label: label.trim(),
						priceCents,
						initialStock: Number(stock),
						lowStockThreshold: Number(threshold),
					},
				}),
			'Variant added',
		);
		if (ok) {
			setLabel('');
			setPrice('');
			setStock('0');
			setThreshold('5');
		}
	}

	return (
		<section className="space-y-3">
			<h2 className="font-semibold">Variants</h2>
			{/* The new-variant row sits inside the table, so its fields point at this form by id. */}
			<form id="new-variant" onSubmit={add} />
			<TableShell>
				<thead>
					<tr>
						<Th>Label</Th>
						<Th>SKU</Th>
						<Th>Price ($)</Th>
						<Th>Low-stock at</Th>
						<Th right>In stock</Th>
						<Th />
					</tr>
				</thead>
				<tbody className="divide-y">
					{product.variants.map(v => (
						// Keyed by server values so rows reset after a save/reload.
						<VariantRow
							key={`${v.id}:${v.label}:${v.sku}:${v.priceCents}:${v.lowStockThreshold}`}
							variant={v}
							canDelete={product.variants.length > 1}
							reload={reload}
						/>
					))}
					<tr className="bg-muted/30">
						<Td>
							<Input
								form="new-variant"
								value={label}
								onChange={e => setLabel(e.target.value)}
								placeholder="New variant, e.g. Jumbo (10 in)"
								aria-label="New variant label"
								required
								maxLength={60}
								className="h-8 min-w-36"
							/>
						</Td>
						<Td className="text-xs text-muted-foreground">Generated</Td>
						<Td>
							<Input
								form="new-variant"
								value={price}
								onChange={e => setPrice(e.target.value)}
								inputMode="decimal"
								aria-label="New variant price"
								required
								className="h-8 w-24"
							/>
						</Td>
						<Td>
							<Input
								form="new-variant"
								value={threshold}
								onChange={e => setThreshold(e.target.value)}
								inputMode="numeric"
								aria-label="New variant low-stock level"
								required
								className="h-8 w-20"
							/>
						</Td>
						<Td right>
							<Input
								form="new-variant"
								value={stock}
								onChange={e => setStock(e.target.value)}
								inputMode="numeric"
								aria-label="New variant starting stock"
								required
								className="ml-auto h-8 w-20 text-right"
							/>
						</Td>
						<Td right className="whitespace-nowrap">
							<Button
								type="submit"
								form="new-variant"
								disabled={busy || atLimit}
								title={atLimit ? 'A product can have up to 10 variants' : undefined}
							>
								<Plus /> Add variant
							</Button>
						</Td>
					</tr>
				</tbody>
			</TableShell>
		</section>
	);
}

function Images({ product, reload }: { product: AdminProductDetail; reload: () => void }) {
	const { busy, run } = useAction(reload);
	const [url, setUrl] = useState('');
	const [dragging, setDragging] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const full = product.images.length >= MAX_IMAGES_PER_PRODUCT;

	async function upload(file: File) {
		const body = new FormData();
		body.append('file', file);
		await run(async () => {
			const { url } = await api<{ url: string }>('/admin/uploads', { method: 'POST', body });
			await api(`/admin/products/${product.id}/images`, {
				method: 'POST',
				json: { url, alt: product.name },
			});
		}, 'Image uploaded');
	}

	return (
		<section className="flex flex-col gap-4 rounded-xl border p-4">
			<h2 className="font-semibold">
				Images{' '}
				<span className="text-sm font-normal text-muted-foreground">
					({product.images.length}/{MAX_IMAGES_PER_PRODUCT}, first is the cover)
				</span>
			</h2>
			{full ? (
				<p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
					Image limit reached. Remove one to add another.
				</p>
			) : (
				<div
					role="button"
					tabIndex={0}
					aria-label="Upload an image: drop a file here or press Enter to browse"
					aria-disabled={busy}
					onClick={() => !busy && fileInput.current?.click()}
					onKeyDown={e => {
						if ((e.key === 'Enter' || e.key === ' ') && !busy) {
							e.preventDefault();
							fileInput.current?.click();
						}
					}}
					onDragOver={e => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={e => {
						e.preventDefault();
						setDragging(false);
						const file = e.dataTransfer.files?.[0];
						if (file && !busy) void upload(file);
					}}
					className={cn(
						'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
						dragging && 'border-primary bg-muted/50',
						busy && 'pointer-events-none opacity-50',
					)}
				>
					<ImagePlus className="size-6 text-muted-foreground" />
					<p className="font-medium">Drop an image here, or click to browse</p>
					<p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 1 MB</p>
					<input
						ref={fileInput}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						tabIndex={-1}
						className="sr-only"
						onClick={e => e.stopPropagation()}
						onChange={e => {
							const file = e.target.files?.[0];
							e.target.value = '';
							if (file) void upload(file);
						}}
					/>
				</div>
			)}
			{product.images.length > 0 && (
				<ul className="grid grid-cols-4 gap-2">
					{product.images.map((img, i) => (
						<li
							key={img.id}
							className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
						>
							<Image
								src={imageSrc(img.url)}
								alt={img.alt}
								fill
								unoptimized
								className="object-cover"
							/>
							{i === 0 ? (
								<span className="absolute bottom-1 left-1 rounded-full border border-foreground/30 bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground">
									Cover
								</span>
							) : (
								<Button
									size="icon-xs"
									variant="secondary"
									aria-label="Make cover image"
									title="Make cover image"
									disabled={busy}
									className="absolute top-1 left-1"
									onClick={() =>
										run(
											() => api(`/admin/images/${img.id}/primary`, { method: 'POST' }),
											'Cover image updated',
										)
									}
								>
									<Star />
								</Button>
							)}
							<Button
								size="icon-xs"
								variant="secondary"
								aria-label="Remove image"
								title="Remove image"
								disabled={busy}
								className="absolute top-1 right-1"
								onClick={() =>
									run(() => api(`/admin/images/${img.id}`, { method: 'DELETE' }), 'Image removed')
								}
							>
								<X />
							</Button>
						</li>
					))}
				</ul>
			)}
			{!full && (
				<form
					className="mt-auto space-y-1.5"
					onSubmit={async e => {
						e.preventDefault();
						if (
							await run(
								() =>
									api(`/admin/products/${product.id}/images`, {
										method: 'POST',
										json: { url: url.trim(), alt: product.name },
									}),
								'Image added',
							)
						)
							setUrl('');
					}}
				>
					<Label htmlFor="imageUrl" className="text-xs">
						…or add an https:// image URL
					</Label>
					<div className="flex gap-2">
						<Input
							id="imageUrl"
							value={url}
							onChange={e => setUrl(e.target.value)}
							placeholder="https://…"
						/>
						<Button type="submit" disabled={busy || !url.trim()}>
							Add
						</Button>
					</div>
				</form>
			)}
		</section>
	);
}

function ProductEditor() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const {
		data: product,
		error,
		loading,
		reload,
	} = useApi<AdminProductDetail>(`/admin/products/${id}`);
	const { data: categories } = useApi<AdminCategory[]>('/admin/categories');
	const [deleting, setDeleting] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	useBreadcrumbLabel(product?.name);

	if (loading) return <Skeleton className="h-96" />;
	if (error || !product) {
		return (
			<p>
				{error ?? 'Product not found.'}{' '}
				<Link href="/products" className="underline">
					Back to products
				</Link>
			</p>
		);
	}

	async function remove() {
		setDeleting(true);
		try {
			await api(`/admin/products/${id}`, { method: 'DELETE' });
			toast.success('Product deleted');
			router.push('/products');
		} catch (err) {
			toast.error(errorMessage(err));
			setDeleting(false);
			setConfirmingDelete(false);
		}
	}

	return (
		<div className="space-y-8">
			<PageHeader
				title={product.name}
				description={
					product.status === 'active'
						? 'Visible in the store.'
						: `Not visible in the store (${product.status}).`
				}
			/>
			{/* Keyed so the form re-initialises from the server after every save. */}
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
				{categories && (
					<Details
						key={`${product.name}:${product.description}:${product.categoryId}:${product.status}:${product.featured}`}
						product={product}
						categories={categories}
						reload={reload}
					/>
				)}
				<Images product={product} reload={reload} />
			</div>
			<Variants product={product} reload={reload} />
			<div className="flex justify-end">
				<Button variant="destructive" disabled={deleting} onClick={() => setConfirmingDelete(true)}>
					<Trash2 /> Delete product
				</Button>
			</div>
			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={`Delete "${product.name}"?`}
				description="This permanently removes the product with its variants and images. It cannot be undone."
				confirmLabel="Delete product"
				destructive
				busy={deleting}
				onConfirm={remove}
			/>
		</div>
	);
}

export default function ProductPage() {
	return (
		<RequirePermission permission="catalog:manage">
			<Suspense fallback={<Skeleton className="h-96" />}>
				<ProductEditor />
			</Suspense>
		</RequirePermission>
	);
}
