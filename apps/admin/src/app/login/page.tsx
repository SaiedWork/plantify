'use client';

import { PlantifyLogo } from '@/components/plantify-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireSubmit,
	QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { authClient, DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/auth-client';
import { STAFF_ROLES } from '@plantify/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

const ROLE_QUESTION = [
	{
		name: 'role',
		required: true,
		title: 'Choose a role',
		description: 'Pick the demo account to sign in as.',
		choices: DEMO_ACCOUNTS.map(a => ({ value: a.email, label: a.label, description: a.blurb })),
	},
] as const;

export default function LoginPage() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	// Next keeps this page's state while the dashboard is shown, so a later visit would come back with the old
	// selection and error. Remounting the form (new key) whenever the page is left gives a fresh one.
	const [formKey, setFormKey] = useState(0);
	useEffect(
		() => () => {
			setBusy(false);
			setFormKey(k => k + 1);
		},
		[],
	);

	async function signIn(email: string, password: string) {
		setBusy(true);
		try {
			const { error } = await authClient.signIn.email({ email, password });
			if (error) {
				toast.error(error.message ?? 'Sign in failed');
				return;
			}
			// Customers share the same auth backend; keep them out of the back office.
			const me = await fetch('/api/me', { cache: 'no-store' });
			const role = me.ok ? ((await me.json()) as { role: string }).role : null;
			if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) {
				await authClient.signOut();
				toast.error('This account does not have admin access.');
				return;
			}
			router.push('/');
			router.refresh();
		} finally {
			// The router may keep this page mounted (hidden) after navigating away, so never leave it stuck on busy.
			setBusy(false);
		}
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const email = new FormData(event.currentTarget).get('role');
		if (typeof email === 'string' && !busy) void signIn(email, DEMO_PASSWORD);
	}

	return (
		<div className="mx-auto flex min-h-[calc(100vh-1.75rem)] w-full max-w-md flex-col items-center justify-center gap-6 px-4">
			{/* Same spot as in the admin header (below the demo banner, at its right edge), without the header. */}
			<div className="fixed top-10 right-4 md:right-8">
				<ThemeToggle />
			</div>
			<PlantifyLogo size="lg" />
			<Card className="w-full gap-8">
				<CardHeader className="justify-center text-center">
					<CardTitle role="heading" aria-level={1} className="text-xl font-bold">
						Admin sign in
					</CardTitle>
					<CardDescription>Internal back office. This is a demo with fake data.</CardDescription>
				</CardHeader>
				<CardContent>
					<Questionnaire key={formKey} defaultItem="role" items={ROLE_QUESTION} onSubmit={onSubmit}>
						<QuestionnaireItem name="role" required>
							<div className="space-y-1">
								<QuestionnaireTitle>{ROLE_QUESTION[0].title}</QuestionnaireTitle>
								<QuestionnaireDescription>{ROLE_QUESTION[0].description}</QuestionnaireDescription>
							</div>
							<QuestionnaireChoices>
								{ROLE_QUESTION[0].choices.map(choice => (
									<QuestionnaireChoice key={choice.value} value={choice.value}>
										<span className="font-medium">{choice.label}</span>
										<QuestionnaireChoiceDescription>
											{choice.description}
										</QuestionnaireChoiceDescription>
									</QuestionnaireChoice>
								))}
							</QuestionnaireChoices>
							<QuestionnaireError />
						</QuestionnaireItem>
						<QuestionnaireActions>
							<QuestionnaireSubmit
								className="col-span-3 col-start-1 h-9 w-full justify-self-stretch"
								disabled={busy}
							>
								{busy ? 'Signing in…' : 'Sign in'}
							</QuestionnaireSubmit>
						</QuestionnaireActions>
					</Questionnaire>
				</CardContent>
			</Card>
		</div>
	);
}
