'use client';

import { ImagePicker, type PickerImage } from '@/components/image-picker';
import { PageHeader, RequirePermission, TableShell, Td, Th } from '@/components/page-bits';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api-client';
import { capitalize, dollarsToCents } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import type { AdminCategory, ProductStatus } from '@plantify/contracts';
import { MAX_IMAGES_PER_PRODUCT, PRODUCT_STATUSES } from '@plantify/contracts';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

type VariantRow = { label: string; price: string; threshold: string; stock: string };
/** An image picked for the new product: either a local file (uploaded on Create) or an https URL. */
type PendingImage = PickerImage & { file?: File; url?: string };

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 1024 * 1024;

const newRow = (label = ''): VariantRow => ({ label, price: '', threshold: '5', stock: '0' });

export default function NewProductPage() {
	const router = useRouter();
	const { data: categories } = useApi<AdminCategory[]>('/admin/categories');
	const [busy, setBusy] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [categoryId, setCategoryId] = useState('');
	const [status, setStatus] = useState<ProductStatus>('draft');
	const [featured, setFeatured] = useState(false);
	const [variants, setVariants] = useState<VariantRow[]>([newRow('Standard')]);
	const [images, setImages] = useState<PendingImage[]>([]);

	// Next keeps this page's state while another route (the new product's edit page) is shown, so the form
	// would come back filled and stuck on "Creating…". Clear it, and free the previews, whenever the page is left.
	const previews = useRef<string[]>([]);
	useEffect(
		() => () => {
			previews.current.forEach(u => URL.revokeObjectURL(u));
			previews.current = [];
			setBusy(false);
			setName('');
			setDescription('');
			setCategoryId('');
			setStatus('draft');
			setFeatured(false);
			setVariants([newRow('Standard')]);
			setImages([]);
		},
		[],
	);

	function addFile(file: File) {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			toast.error('Use a JPEG, PNG or WebP image.');
			return;
		}
		if (file.size > MAX_UPLOAD_BYTES) {
			toast.error('Images can be up to 1 MB.');
			return;
		}
		const src = URL.createObjectURL(file);
		previews.current.push(src);
		setImages(list => [...list, { id: crypto.randomUUID(), src, alt: file.name, file }]);
	}

	function addUrl(url: string) {
		if (!/^https:\/\/[^\s]+$/.test(url)) {
			toast.error('Enter an https:// image URL.');
			return false;
		}
		setImages(list => [...list, { id: crypto.randomUUID(), src: url, alt: '', url }]);
		return true;
	}

	const makeCover = (id: string) =>
		setImages(list => {
			const picked = list.find(i => i.id === id);
			return picked ? [picked, ...list.filter(i => i.id !== id)] : list;
		});

	const removeImage = (id: string) => setImages(list => list.filter(i => i.id !== id));

	const patchVariant = (i: number, patch: Partial<VariantRow>) =>
		setVariants(vs => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		const parsed = variants.map(v => ({
			label: v.label.trim(),
			priceCents: dollarsToCents(v.price),
			lowStockThreshold: Number(v.threshold),
			initialStock: Number(v.stock),
		}));
		if (
			parsed.some(
				v =>
					v.priceCents === null ||
					!Number.isInteger(v.initialStock) ||
					v.initialStock < 0 ||
					!Number.isInteger(v.lowStockThreshold) ||
					v.lowStockThreshold < 0,
			)
		) {
			toast.error('Every variant needs a price above $0 and whole-number stock and low-stock levels.');
			return;
		}
		setBusy(true);
		try {
			// Local files are uploaded now, in order, so the cover stays first.
			const uploaded: { url: string; alt: string }[] = [];
			for (const img of images) {
				if (img.url) {
					uploaded.push({ url: img.url, alt: name.trim() });
					continue;
				}
				const body = new FormData();
				body.append('file', img.file!);
				const { url } = await api<{ url: string }>('/admin/uploads', { method: 'POST', body });
				uploaded.push({ url, alt: name.trim() });
			}
			await api('/admin/products', {
				method: 'POST',
				json: {
					name: name.trim(),
					description: description.trim(),
					categoryId: categoryId || categories?.[0]?.id,
					status,
					featured,
					variants: parsed,
					images: uploaded,
				},
			});
			toast.success('Product created');
			router.push('/products');
		} catch (err) {
			toast.error(errorMessage(err));
			setBusy(false);
		}
	}

	return (
		<RequirePermission permission="catalog:manage">
			<PageHeader title="New product" description="Fill in the details, add images and variants, then create the product." />
			<form onSubmit={onSubmit} className="space-y-6">
				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
				<section className="@container space-y-4 rounded-xl border p-4">
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
						<Textarea
							id="description"
							value={description}
							onChange={e => setDescription(e.target.value)}
							maxLength={2000}
							rows={4}
						/>
					</div>
					<div className="grid grid-cols-2 items-end gap-4 @lg:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="category">Category</Label>
							<Select
								id="category"
								value={categoryId || categories?.[0]?.id || ''}
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
								options={PRODUCT_STATUSES.map(s => ({ value: s, label: capitalize(s) }))}
								className="w-full min-w-0"
							/>
						</div>
						<Label htmlFor="featured" className="col-span-2 h-8 @lg:col-span-1">
							<Checkbox
								id="featured"
								checked={featured}
								onCheckedChange={checked => setFeatured(checked)}
							/>{' '}
							Featured on the home page
						</Label>
					</div>
				</section>
				<ImagePicker
					images={images}
					max={MAX_IMAGES_PER_PRODUCT}
					busy={busy}
					onAddFile={addFile}
					onAddUrl={addUrl}
					onMakeCover={makeCover}
					onRemove={removeImage}
				/>
				</div>

				<section className="space-y-3">
					<h2 className="font-semibold">Variants</h2>
					<TableShell>
						<thead>
							<tr>
								<Th>Label</Th>
								<Th>Price ($)</Th>
								<Th>Low-stock at</Th>
								<Th right>Stock</Th>
								<Th />
							</tr>
						</thead>
						<tbody className="divide-y">
							{variants.map((v, i) => (
								<tr key={i}>
									<Td>
										<Input
											value={v.label}
											onChange={e => patchVariant(i, { label: e.target.value })}
											required
											maxLength={60}
											aria-label={`Variant ${i + 1} label`}
											className="h-8 min-w-36"
										/>
									</Td>
									<Td>
										<Input
											inputMode="decimal"
											value={v.price}
											onChange={e => patchVariant(i, { price: e.target.value })}
											required
											aria-label={`Variant ${i + 1} price`}
											className="h-8 w-24"
										/>
									</Td>
									<Td>
										<Input
											inputMode="numeric"
											value={v.threshold}
											onChange={e => patchVariant(i, { threshold: e.target.value })}
											required
											aria-label={`Variant ${i + 1} low-stock level`}
											className="h-8 w-20"
										/>
									</Td>
									<Td right>
										<Input
											inputMode="numeric"
											value={v.stock}
											onChange={e => patchVariant(i, { stock: e.target.value })}
											required
											aria-label={`Variant ${i + 1} stock`}
											className="ml-auto h-8 w-20 text-right"
										/>
									</Td>
									<Td right className="whitespace-nowrap">
										<Button
											type="button"
											variant="destructive"
											size="icon"
											aria-label={`Remove variant ${i + 1}`}
											disabled={variants.length === 1}
											onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))}
										>
											<Trash2 />
										</Button>
									</Td>
								</tr>
							))}
							<tr className="bg-muted/30">
								<td colSpan={5} className="px-3 py-2 text-right">
									<Button
										type="button"
										disabled={variants.length >= 10}
										title={variants.length >= 10 ? 'A product can have up to 10 variants' : undefined}
										onClick={() => setVariants(vs => [...vs, newRow()])}
									>
										<Plus /> Add variant
									</Button>
								</td>
							</tr>
						</tbody>
					</TableShell>
				</section>

				<div className="flex justify-end gap-2">
					<Link href="/products" className={cn(buttonVariants({ variant: 'outline' }))}>
						Cancel
					</Link>
					<Button type="submit" disabled={busy || !categories}>
						{busy ? 'Creating…' : 'Create product'}
					</Button>
				</div>
			</form>
		</RequirePermission>
	);
}
