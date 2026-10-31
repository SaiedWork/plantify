'use client';

import { Dialog } from '@base-ui/react/dialog';
import { AppHeader } from '@/components/app-header';
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
	X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
	const router = useRouter();
	const pathname = usePathname();
	const { me, can } = useMe();
	return (
		<>
			<div className="flex items-center gap-2 px-4 py-4 font-semibold text-green-800 dark:text-green-400">
				<Leaf className="size-5" /> Plantify Admin
			</div>
			<nav aria-label="Main" className="flex flex-col gap-1 px-2 pb-2">
				{NAV.filter(n => !n.permission || can(n.permission)).map(n => {
					const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
					return (
						<Link
							key={n.href}
							href={n.href}
							onClick={onNavigate}
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
			<div className="mt-auto space-y-2 border-t p-3 text-sm">
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
		</>
	);
}

export function AdminShell({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const { data: me, error } = useApi<Me>('/me');

	// Not signed in, or a customer session slipped through: back to the login page.
	const isStaff = me && me.role !== 'customer';
	useEffect(() => {
		if (error || (me && !isStaff)) router.replace('/login');
	}, [error, me, isStaff, router]);

	if (!me || !isStaff) return <div className="min-h-[calc(100vh-1.75rem)] animate-pulse bg-muted/40" />;

	const can = (p: Permission) => me.permissions.includes(p);

	return (
		<MeContext.Provider value={{ me, can }}>
			<div className="min-h-[calc(100vh-1.75rem)] md:pl-[220px] print:min-h-0">
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
				>
					Skip to content
				</a>
				<AppHeader onOpenMenu={() => setMenuOpen(true)} />
				<aside className="fixed bottom-0 left-0 top-7 hidden w-[220px] flex-col overflow-y-auto border-r bg-muted/30 md:flex print:top-0">
					<SidebarContent />
				</aside>
				<Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
					<Dialog.Portal>
						<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none md:hidden" />
						<Dialog.Popup
							aria-label="Navigation menu"
							className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r bg-background shadow-lg outline-none transition-transform duration-200 ease-out data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full motion-reduce:transition-none md:hidden"
						>
							<Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
							<Dialog.Close
								aria-label="Close menu"
								className="absolute right-2 top-3 rounded-md p-2 hover:bg-muted"
							>
								<X className="size-4" />
							</Dialog.Close>
							<SidebarContent onNavigate={() => setMenuOpen(false)} />
						</Dialog.Popup>
					</Dialog.Portal>
				</Dialog.Root>
				<main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl p-4 outline-none md:p-8">{children}</main>
			</div>
		</MeContext.Provider>
	);
}
