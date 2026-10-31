'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, Fragment, useContext, useEffect } from 'react';

const SEGMENT_LABELS: Record<string, string> = {
	products: 'Products',
	categories: 'Categories',
	inventory: 'Inventory',
	orders: 'Orders',
	customers: 'Customers',
	webhooks: 'Webhooks',
	staff: 'Staff & roles',
	audit: 'Audit log',
	new: 'New',
};

/** Lets a detail page name its own breadcrumb (e.g. the order number) instead of the generic "Details". */
export const BreadcrumbLabelContext = createContext<(label: string | null) => void>(() => {});

export function useBreadcrumbLabel(label: string | null | undefined) {
	const setLabel = useContext(BreadcrumbLabelContext);
	useEffect(() => {
		setLabel(label ?? null);
		return () => setLabel(null);
	}, [label, setLabel]);
}

function crumbs(pathname: string, lastLabel: string | null) {
	const segments = pathname.split('/').filter(Boolean);
	const items = [{ href: '/', label: 'Dashboard' }];
	segments.forEach((segment, i) => {
		items.push({
			href: '/' + segments.slice(0, i + 1).join('/'),
			label: SEGMENT_LABELS[segment] ?? 'Details',
		});
	});
	if (lastLabel && items.length > 1 && items[items.length - 1].label === 'Details') items[items.length - 1].label = lastLabel;
	return items;
}

export function AppHeader({ onOpenMenu, lastLabel }: { onOpenMenu: () => void; lastLabel: string | null }) {
	const items = crumbs(usePathname(), lastLabel);
	return (
		<header className="sticky top-7 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-8 print:hidden">
			<Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2 md:hidden" onClick={onOpenMenu}>
				<Menu className="size-4" />
			</Button>
			<nav aria-label="Breadcrumb" className="min-w-0 flex-1">
				<ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
					{items.map((item, i) => {
						const last = i === items.length - 1;
						return (
							<Fragment key={item.href}>
								{i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
								<li className="min-w-0 truncate">
									{last ? (
										<span aria-current="page" className="font-medium text-foreground">
											{item.label}
										</span>
									) : (
										<Link href={item.href} className="hover:text-foreground hover:underline">
											{item.label}
										</Link>
									)}
								</li>
							</Fragment>
						);
					})}
				</ol>
			</nav>
			<ThemeToggle />
		</header>
	);
}
