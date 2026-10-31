'use client';

import { Popover } from '@base-ui/react/popover';
import { EllipsisVertical, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ROLE_LABELS } from '@plantify/contracts';
import { useMe } from '@/components/admin-shell';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

/** Sidebar footer: the signed-in user, with a sign-out menu that opens upwards at the full width of the sidebar. */
export function UserMenu() {
	const router = useRouter();
	const { me } = useMe();
	const footer = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	return (
		<div ref={footer} className="mt-auto border-t p-3">
			<Popover.Root open={open} onOpenChange={setOpen}>
				<Popover.Trigger
					aria-label={`Account menu for ${me.name}`}
					className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
				>
					<UserAvatar name={me.name} role={me.role} />
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium">{me.name}</span>
						<span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</span>
					</span>
					<EllipsisVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" />
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Positioner anchor={footer} side="top" align="start" sideOffset={8} collisionPadding={0} className="z-[60]">
						<Popover.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-xl border bg-popover p-3 text-popover-foreground shadow-md outline-none transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
							<Button
								variant="outline"
								className="w-full justify-start text-destructive hover:text-destructive"
								onClick={async () => {
									// Next keeps the previous page's state while the login page is shown, so close the menu first.
									setOpen(false);
									await authClient.signOut();
									router.push('/login');
									router.refresh();
								}}
							>
								<LogOut /> Sign out
							</Button>
						</Popover.Popup>
					</Popover.Positioner>
				</Popover.Portal>
			</Popover.Root>
		</div>
	);
}
