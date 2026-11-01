'use client';

import {
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
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { api, errorMessage } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import type { AdminCategory } from '@plantify/contracts';
import { Info, Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { toast } from 'sonner';

const PAGE_SIZE = 15;

function Row({ category, reload }: { category: AdminCategory; reload: () => void }) {
	const [name, setName] = useState(category.name);
	const [description, setDescription] = useState(category.description ?? '');
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const dirty =
		name.trim() !== category.name || description.trim() !== (category.description ?? '');

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

	return (
		<tr>
			<Td>
				<Input
					value={name}
					onChange={e => setName(e.target.value)}
					aria-label="Name"
					className="h-8 min-w-40"
				/>
			</Td>
			<Td>
				<Input
					value={description}
					onChange={e => setDescription(e.target.value)}
					aria-label="Description"
					className="h-8 min-w-72"
				/>
			</Td>
			<Td right>{category.productCount}</Td>
			<Td right className="whitespace-nowrap">
				<div className="flex items-center justify-end gap-2">
					<Button
						disabled={busy || !dirty}
						onClick={() =>
							act(
								() =>
									api(`/admin/categories/${category.id}`, {
										method: 'PATCH',
										json: { name: name.trim(), description: description.trim() },
									}),
								'Category saved',
							)
						}
					>
						Save
					</Button>
					{/* A disabled button swallows hover, so the tooltip lives on the wrapper. */}
					<span
						title={
							category.productCount > 0 ? 'Move its products to another category first' : undefined
						}
					>
						<Button
							variant="destructive"
							size="icon"
							aria-label={`Delete ${category.name}`}
							disabled={busy || category.productCount > 0}
							onClick={() => setConfirming(true)}
						>
							<Trash2 />
						</Button>
					</span>
				</div>
				<ConfirmDialog
					open={confirming}
					onOpenChange={setConfirming}
					title={`Delete "${category.name}"?`}
					description="This permanently removes the category. It cannot be undone."
					confirmLabel="Delete category"
					destructive
					busy={busy}
					onConfirm={async () => {
						await act(
							() => api(`/admin/categories/${category.id}`, { method: 'DELETE' }),
							'Category deleted',
						);
						setConfirming(false);
					}}
				/>
			</Td>
		</tr>
	);
}

export default function CategoriesPage() {
	const { data, loading, error, reload } = useApi<AdminCategory[]>('/admin/categories');
	const [q, setQ] = useState('');
	const [page, setPage] = useState(1);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [busy, setBusy] = useState(false);

	const needle = q.trim().toLowerCase();
	const filtered = (data ?? []).filter(
		c =>
			!needle ||
			c.name.toLowerCase().includes(needle) ||
			(c.description ?? '').toLowerCase().includes(needle),
	);
	const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const current = Math.min(page, pages);
	const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			await api('/admin/categories', {
				method: 'POST',
				json: {
					name: name.trim(),
					...(description.trim() ? { description: description.trim() } : {}),
				},
			});
			toast.success('Category added');
			setName('');
			setDescription('');
			// New categories sort last; the page number is clamped to the real last page.
			setQ('');
			setPage(Number.MAX_SAFE_INTEGER);
			reload();
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<RequirePermission permission="catalog:manage">
			<PageHeader title="Categories" description="Group products so shoppers can browse them." />
			<TableToolbar total={data ? filtered.length : undefined}>
				<SearchInput
					placeholder="Search by name or description…"
					value={q}
					onValueChange={value => {
						setQ(value);
						setPage(1);
					}}
					className="max-w-sm"
					aria-label="Search categories"
				/>
				<p className="flex items-center gap-1.5 px-2 pb-2 text-xs text-muted-foreground">
					<Info aria-hidden className="size-3.5 shrink-0" />
					Categories with products can&apos;t be deleted until those products are moved or removed.
				</p>
			</TableToolbar>
			{loading && !data ? (
				<Skeleton />
			) : error ? (
				<ErrorState onRetry={reload} />
			) : (
				<>
					{/* The new-category row sits inside the table, so its fields point at this form by id. */}
					<form id="new-category" onSubmit={add} />
					<TableShell>
						<thead>
							<tr>
								<Th>Name</Th>
								<Th>Description</Th>
								<Th right>Products</Th>
								<Th />
							</tr>
						</thead>
						<tbody className="divide-y">
							{visible.map(c => (
								<Row key={`${c.id}:${c.name}:${c.description}`} category={c} reload={reload} />
							))}
							{visible.length === 0 && (
								<tr>
									<td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
										{needle ? 'No categories match.' : 'No categories yet.'}
									</td>
								</tr>
							)}
							<tr className="bg-muted/30">
								<Td>
									<Input
										form="new-category"
										value={name}
										onChange={e => setName(e.target.value)}
										placeholder="New category name"
										aria-label="New category name"
										required
										minLength={2}
										maxLength={60}
										className="h-8 min-w-40"
									/>
								</Td>
								<Td>
									<Input
										form="new-category"
										value={description}
										onChange={e => setDescription(e.target.value)}
										placeholder="Description (optional)"
										aria-label="New category description"
										maxLength={300}
										className="h-8 min-w-72"
									/>
								</Td>
								<Td right className="text-muted-foreground">
									0
								</Td>
								<Td right className="whitespace-nowrap">
									<Button type="submit" form="new-category" disabled={busy}>
										<Plus /> Add category
									</Button>
								</Td>
							</tr>
						</tbody>
					</TableShell>
					<Pager page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
				</>
			)}
		</RequirePermission>
	);
}
