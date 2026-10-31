'use client';

import { useMe } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import type { OrderStatus, Permission, ProductStatus } from '@plantify/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
}

/** Renders children only when the signed-in staff member holds the permission (the API enforces it regardless). */
export function RequirePermission({
	permission,
	children,
}: {
	permission: Permission;
	children: ReactNode;
}) {
	const { can } = useMe();
	if (can(permission)) return <>{children}</>;
	return (
		<div className="rounded-xl border border-dashed p-10 text-center">
			<p className="font-medium">You don&apos;t have access to this area.</p>
			<p className="mt-1 text-sm text-muted-foreground">Ask an owner if you need it.</p>
			<Link href="/" className="mt-3 inline-block text-sm underline">
				Back to the dashboard
			</Link>
		</div>
	);
}

/** Filters on the left, the result count on the right. Pass `total` once the data has loaded. */
export function TableToolbar({
	total,
	children,
	className,
}: {
	total?: number;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('mb-3 flex flex-wrap items-end gap-2', className)}>
			{children}
			{total != null && <p className="ml-auto pr-3 pb-1.5 text-sm font-medium">{total} total</p>}
		</div>
	);
}

type PageSlot = number | 'gap-start' | 'gap-end';

/** Seven slots at most, so the control keeps its width: 1 2 3 4 5 … 14, 1 … 6 7 8 … 14, 1 … 10 11 12 13 14. */
function pageList(page: number, pages: number): PageSlot[] {
	if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
	if (page <= 4) return [1, 2, 3, 4, 5, 'gap-end', pages];
	if (page >= pages - 3) return [1, 'gap-start', pages - 4, pages - 3, pages - 2, pages - 1, pages];
	return [1, 'gap-start', page - 1, page, page + 1, 'gap-end', pages];
}

/** Five slots for phones, where the page indicator shares the row: 1 2 3 … 14, 1 … 6 … 14, 1 … 12 13 14. */
function compactPageList(page: number, pages: number): PageSlot[] {
	if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
	if (page <= 3) return [1, 2, 3, 'gap-end', pages];
	if (page >= pages - 2) return [1, 'gap-start', pages - 2, pages - 1, pages];
	return [1, 'gap-start', page, 'gap-end', pages];
}

export function Pager({
	page,
	pageSize,
	total,
	onPage,
}: {
	page: number;
	pageSize: number;
	total: number;
	onPage: (p: number) => void;
}) {
	const pages = Math.max(1, Math.ceil(total / pageSize));
	if (pages <= 1) return null;

	const controls = (slots: PageSlot[], className: string) => (
		<Pagination className={cn('mx-0 w-auto', className)}>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious disabled={page <= 1} onClick={() => onPage(page - 1)} />
				</PaginationItem>
				{slots.map(p => (
					<PaginationItem key={p}>
						{typeof p === 'number' ? (
							<PaginationLink isActive={p === page} aria-label={`Go to page ${p}`} onClick={() => onPage(p)}>
								{p}
							</PaginationLink>
						) : (
							<PaginationEllipsis />
						)}
					</PaginationItem>
				))}
				<PaginationItem>
					<PaginationNext disabled={page >= pages} onClick={() => onPage(page + 1)} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);

	return (
		<div className="mt-3 flex items-center justify-between gap-3 text-sm">
			<span className="pl-3 whitespace-nowrap text-muted-foreground">
				{page} of {pages}
			</span>
			{controls(compactPageList(page, pages), 'sm:hidden')}
			{controls(pageList(page, pages), 'hidden sm:flex')}
		</div>
	);
}

const ORDER_STYLES: Record<OrderStatus, string> = {
	pending_payment: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300',
	paid: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300',
	processing: 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300',
	shipped: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300',
	delivered: 'bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300',
	cancelled: 'bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400',
	refunded: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300',
};

const PRODUCT_STYLES: Record<ProductStatus, string> = {
	draft: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300',
	active: 'bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300',
	archived: 'bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400',
};

export const orderStatusLabel = (s: OrderStatus) => s.replace('_', ' ');

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize',
				className,
			)}
		>
			{children}
		</span>
	);
}

export const OrderBadge = ({ status }: { status: OrderStatus }) => (
	<Badge className={ORDER_STYLES[status]}>{orderStatusLabel(status)}</Badge>
);
export const ProductBadge = ({ status }: { status: ProductStatus }) => (
	<Badge className={PRODUCT_STYLES[status]}>{status}</Badge>
);

export function TableShell({ children }: { children: ReactNode }) {
	return (
		<div className="overflow-x-auto rounded-xl border">
			<table className="w-full text-sm">{children}</table>
		</div>
	);
}

export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
	<th
		className={cn(
			'bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground',
			right ? 'text-right' : 'text-left',
		)}
	>
		{children}
	</th>
);

/** Plain text cells wrap to at most two lines; pass `clamp` for mixed content such as a name over an email. */
export const Td = ({
	children,
	right,
	className,
	clamp,
}: {
	children?: ReactNode;
	right?: boolean;
	className?: string;
	clamp?: boolean;
}) => {
	const text = typeof children === 'string' || typeof children === 'number';
	return (
		<td className={cn('px-3 py-2', right && 'text-right', className)}>
			{(clamp ?? text) ? <div className="line-clamp-2 break-words">{children}</div> : children}
		</td>
	);
};

export function Skeleton({ className }: { className?: string }) {
	return <div className={cn('animate-pulse rounded-xl bg-muted', className ?? 'h-40')} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
			{children}
		</p>
	);
}

/** Shown in place of a list/detail when the request failed, so an outage is not mistaken for "no results". */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
	return (
		<div role="alert" className="rounded-xl border border-dashed p-10 text-center text-sm">
			<p className="font-medium">Couldn&apos;t load this data.</p>
			{onRetry && (
				<Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	);
}
