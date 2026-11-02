import { PlantifyLogo } from '@/components/plantify-logo';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

const GITHUB_URL = 'https://github.com/SaiedWork/plantify';

/** lucide-react no longer ships brand icons, so this is the GitHub mark inline. */
function GithubIcon() {
	return (
		<svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className="size-4">
			<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
		</svg>
	);
}

const LINKS = [
	{ href: '/shop', label: 'Shop' },
	{ href: '/cart', label: 'Cart' },
	{ href: '/account/orders', label: 'Orders' },
	{ href: '/orders/lookup', label: 'Track an order' },
	{ href: '/account', label: 'Account' },
];

export function SiteFooter() {
	return (
		<footer className="mt-16 border-t bg-muted/40 print:hidden">
			<div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 items-center sm:flex-row sm:items-start sm:justify-between">
				<div className="max-w-xs space-y-2 flex flex-col items-center sm:items-start">
					<PlantifyLogo size="sm" />
					<p className="text-sm text-muted-foreground text-center sm:text-left">
						A demo plant store. Products, orders and payments are all fake, and nothing is ever
						shipped.
					</p>
				</div>
				<nav aria-label="Footer">
					<ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
						{LINKS.map(l => (
							<li key={l.href}>
								<Link
									href={l.href}
									className="text-muted-foreground hover:text-foreground hover:underline"
								>
									{l.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>
			</div>
			<div className="mx-auto flex max-w-6xl justify-center sm:justify-end px-4 pb-6">
				<a
					href={GITHUB_URL}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Plantify on GitHub"
					title="Plantify on GitHub"
					className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
				>
					<GithubIcon />
				</a>
			</div>
		</footer>
	);
}
