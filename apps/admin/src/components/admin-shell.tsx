'use client';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type Permission, type Role } from '@plantify/contracts';
import {
	Boxes,
	History,
	LayoutDashboard,
	Leaf,
	LogOut,
	Package,
	ShieldCheck,
	ShoppingBag,
	Tags,
	Users,
	Webhook,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type Me = { id: string; name: string; email: string; role: Role; permissions: Permission[] };

const MeContext = createContext<{ me: Me; can: (p: Permission) => boolean } | null>(null);

export function useMe() {
	const ctx = useContext(MeContext);
	if (!ctx) throw new Error('useMe must be used inside <AdminShell>');
	return ctx;
}

const NAV: {
	href: string;
	label: string;
	icon: typeof Package;
	permission?: Permission;
	exact?: boolean;
}[] = [
	{ href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
	{ href: '/products', label: 'Products', icon: Package, permission: 'catalog:manage' },
	{ href: '/categories', label: 'Categories', icon: Tags, permission: 'catalog:manage' },
	{ href: '/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory:manage' },
	{ href: '/orders', label: 'Orders', icon: ShoppingBag, permission: 'orders:view' },
	{ href: '/customers', label: 'Customers', icon: Users, permission: 'customers:view' },
	{ href: '/webhooks', label: 'Webhooks', icon: Webhook, permission: 'webhooks:manage' },
	{ href: '/staff', label: 'Staff & roles', icon: ShieldCheck, permission: 'staff:manage' },
	{ href: '/audit', label: 'Audit log', icon: History, permission: 'staff:manage' },
];

export function AdminShell({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: me, error } = useApi<Me>('/me');

	// Not signed in, or a customer session slipped through: back to the login page.
	const isStaff = me && me.role !== 'customer';
	useEffect(() => {
		if (error || (me && !isStaff)) router.replace('/login');
	}, [error, me, isStaff, router]);

	if (!me || !isStaff) return <div className="min-h-screen animate-pulse bg-muted/40" />;

	const can = (p: Permission) => me.permissions.includes(p);

	return (
		<MeContext.Provider value={{ me, can }}>
			<div className="min-h-screen md:pl-[220px]">
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
				>
					Skip to content
				</a>
				<aside className="flex min-w-0 flex-col border-b bg-muted/30 md:fixed md:bottom-0 md:left-0 md:top-7 print:top-0 md:w-[220px] md:overflow-y-auto md:border-b-0 md:border-r">
					<div className="flex items-center justify-between gap-2 px-4 py-4">
						<span className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-400">
							<Leaf className="size-5" /> Plantify Admin
						</span>
						{/* The sidebar footer is hidden on small screens, so keep a way to sign out. */}
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden"
							onClick={async () => {
								await authClient.signOut();
								router.push('/login');
								router.refresh();
							}}
						>
							<LogOut className="size-4" /> Sign out
						</Button>
					</div>
					<nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
						{NAV.filter(n => !n.permission || can(n.permission)).map(n => {
							const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
							return (
								<Link
									key={n.href}
									href={n.href}
									aria-current={active ? 'page' : undefined}
									className={cn(
										'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted',
										active && 'bg-muted font-medium',
									)}
								>
									<n.icon className="size-4" /> {n.label}
								</Link>
							);
						})}
					</nav>
					<div className="mt-auto hidden space-y-2 border-t p-3 text-sm md:block">
						<div>
							<p className="font-medium">{me.name}</p>
							<p className="text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="w-full"
							onClick={async () => {
								await authClient.signOut();
								router.push('/login');
								router.refresh();
							}}
						>
							<LogOut className="size-4" /> Sign out
						</Button>
					</div>
				</aside>
				<main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl p-4 outline-none md:p-8">{children}</main>
			</div>
		</MeContext.Provider>
	);
}
