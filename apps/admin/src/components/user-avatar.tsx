import type { Role } from '@plantify/contracts';
import { cn } from '@/lib/utils';

// One colour per role, so the three staff accounts are easy to tell apart.
const ROLE_COLOR: Record<Role, string> = {
	owner: 'bg-emerald-600',
	catalog_manager: 'bg-violet-600',
	order_manager: 'bg-orange-500',
	customer: 'bg-slate-500',
};

export function initials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean);
	return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export function UserAvatar({ name, role, className }: { name: string; role: Role; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white select-none',
				ROLE_COLOR[role],
				className,
			)}
		>
			{initials(name)}
		</span>
	);
}
