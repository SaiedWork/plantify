'use client';

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="Toggle theme"
			onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
		>
			{/* Both icons are rendered and swapped by CSS so the server and client markup match. */}
			<Moon className="size-4 dark:hidden" />
			<Sun className="hidden size-4 dark:block" />
		</Button>
	);
}
