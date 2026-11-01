'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ImagePlus, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';

export type PickerImage = { id: string; src: string; alt: string };

/**
 * Drop zone, thumbnails and an https URL field for product images. It only renders and reports intent;
 * the product edit page saves each change straight away, while the new product page keeps them until "Create".
 */
export function ImagePicker({
	images,
	max,
	busy = false,
	onAddFile,
	onAddUrl,
	onMakeCover,
	onRemove,
}: {
	images: PickerImage[];
	max: number;
	busy?: boolean;
	onAddFile: (file: File) => void;
	/** Return false to keep the typed URL in the field (for example when it was rejected). */
	onAddUrl: (url: string) => Promise<boolean | void> | boolean | void;
	onMakeCover: (id: string) => void;
	onRemove: (id: string) => void;
}) {
	const [url, setUrl] = useState('');
	const [dragging, setDragging] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const urlId = useId();
	const full = images.length >= max;

	return (
		<section className="flex flex-col gap-4 rounded-xl border p-4">
			<h2 className="font-semibold">
				Images{' '}
				<span className="text-sm font-normal text-muted-foreground">
					({images.length}/{max}, first is the cover)
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
						if (file && !busy) onAddFile(file);
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
							if (file) onAddFile(file);
						}}
					/>
				</div>
			)}
			{images.length > 0 && (
				<ul className="grid grid-cols-4 gap-2">
					{images.map((img, i) => (
						<li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
							<Image src={img.src} alt={img.alt} fill unoptimized className="object-cover" />
							{i === 0 ? (
								<span className="absolute bottom-1 left-1 rounded-full border border-foreground/30 bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground">
									Cover
								</span>
							) : (
								<Button
									type="button"
									size="icon-xs"
									variant="secondary"
									aria-label="Make cover image"
									title="Make cover image"
									disabled={busy}
									className="absolute top-1 left-1"
									onClick={() => onMakeCover(img.id)}
								>
									<Star />
								</Button>
							)}
							<Button
								type="button"
								size="icon-xs"
								variant="secondary"
								aria-label="Remove image"
								title="Remove image"
								disabled={busy}
								className="absolute top-1 right-1"
								onClick={() => onRemove(img.id)}
							>
								<X />
							</Button>
						</li>
					))}
				</ul>
			)}
			{!full && (
				<div className="mt-auto space-y-1.5">
					<Label htmlFor={urlId} className="text-xs">
						…or add an https:// image URL
					</Label>
					<div className="flex gap-2">
						<Input
							id={urlId}
							value={url}
							onChange={e => setUrl(e.target.value)}
							onKeyDown={async e => {
								// This control sits inside the product form on the new product page, so Enter must not submit it.
								if (e.key !== 'Enter') return;
								e.preventDefault();
								if (!url.trim() || busy) return;
								if ((await onAddUrl(url.trim())) !== false) setUrl('');
							}}
							placeholder="https://…"
						/>
						<Button
							type="button"
							disabled={busy || !url.trim()}
							onClick={async () => {
								if ((await onAddUrl(url.trim())) !== false) setUrl('');
							}}
						>
							Add
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
