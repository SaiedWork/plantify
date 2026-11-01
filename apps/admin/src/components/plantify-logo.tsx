import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlantifyLogoSize = 'sm' | 'md' | 'lg';

const SIZES: Record<PlantifyLogoSize, { box: string; icon: string; text: string; caption: string; gap: string }> = {
	sm: { box: 'size-6 rounded-md', icon: 'size-4', text: 'text-base', caption: 'text-[0.65rem]', gap: 'gap-2' },
	md: { box: 'size-8 rounded-lg', icon: 'size-5', text: 'text-xl', caption: 'text-xs', gap: 'gap-2.5' },
	lg: { box: 'size-12 rounded-xl', icon: 'size-7', text: 'text-3xl', caption: 'text-sm', gap: 'gap-3' },
};

/** The leaf in a green rounded box, without the wordmark. The favicon (`app/icon.svg`) is the same drawing. */
export function PlantifyMark({ size = 'md', className }: { size?: PlantifyLogoSize; className?: string }) {
	const s = SIZES[size];
	return (
		<span
			aria-hidden
			className={cn('flex shrink-0 items-center justify-center bg-green-700 text-white shadow-sm dark:bg-green-600', s.box, className)}
		>
			<Leaf className={s.icon} />
		</span>
	);
}

/** Plantify mark with the wordmark, in three sizes, and an optional small muted caption under the wordmark. */
export function PlantifyLogo({
	size = 'md',
	caption,
	className,
}: {
	size?: PlantifyLogoSize;
	caption?: string;
	className?: string;
}) {
	const s = SIZES[size];
	return (
		<span className={cn('inline-flex items-center', s.gap, className)}>
			<PlantifyMark size={size} />
			<span className="flex flex-col leading-tight">
				<span className={cn('font-semibold tracking-tight text-green-800 dark:text-green-400', s.text)}>Plantify</span>
				{caption && <span className={cn('text-muted-foreground', s.caption)}>{caption}</span>}
			</span>
		</span>
	);
}
