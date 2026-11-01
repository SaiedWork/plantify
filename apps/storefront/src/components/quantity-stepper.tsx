import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

/** The − / + quantity control shared by the cart and the product page. */
export function QuantityStepper({
	value,
	min = 1,
	max,
	disabled,
	label,
	onChange,
}: {
	value: number;
	min?: number;
	max: number;
	disabled?: boolean;
	label: string;
	onChange: (next: number) => void;
}) {
	return (
		<div role="group" aria-label={label} className="inline-flex items-center rounded-lg border">
			<Button
				variant="ghost"
				size="icon"
				aria-label="Decrease quantity"
				disabled={disabled || value <= min}
				onClick={() => onChange(value - 1)}
			>
				<Minus className="size-3.5" />
			</Button>
			<span aria-live="polite" className="min-w-8 text-center text-sm tabular-nums">
				{value}
			</span>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Increase quantity"
				disabled={disabled || value >= max}
				onClick={() => onChange(value + 1)}
			>
				<Plus className="size-3.5" />
			</Button>
		</div>
	);
}
