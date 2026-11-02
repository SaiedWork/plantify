'use client';

import {
	AddressFields,
	EMPTY_ADDRESS,
	FieldError,
	toAddressPayload,
	type AddressValues,
} from '@/components/address-fields';
import { useCart } from '@/components/cart-provider';
import { OrderTotals } from '@/components/order-totals';
import { ThreeDSDialog } from '@/components/three-ds-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import type { AddressView, PayResult } from '@plantify/contracts';
import { MAX_SAVED_ADDRESSES } from '@plantify/contracts';
import { ArrowLeft, CircleAlert, Loader2, Lock, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type SubmitEvent } from 'react';

const DEMO_CARDS = [
	{ number: '1234 5678 9', label: 'Pays successfully' },
	{ number: '0000 0000 0', label: 'Is declined' },
	{ number: '1111 1111 1', label: 'Asks for a fake 3-D Secure approval' },
];
const DEMO_CVC = '123';
const NEW_ADDRESS = 'new';
const FAILURE_MESSAGES: Record<string, string> = {
	card_declined: 'Your card was declined. Try another card, such as the success demo card.',
	out_of_stock: 'Sorry, someone bought the last one while you were paying. Nothing was charged.',
};

const toValues = (a: AddressView): AddressValues => ({
	fullName: a.fullName,
	line1: a.line1,
	line2: a.line2 ?? '',
	city: a.city,
	region: a.region ?? '',
	postalCode: a.postalCode,
});

const sameAddress = (a: AddressValues, b: AddressValues) =>
	(Object.keys(a) as (keyof AddressValues)[]).every(k => a[k].trim() === b[k].trim());

type Step = { orderId: string | null; threeDS: { paymentId: string; orderId: string } | null };
type CardValues = { number: string; expMonth: string; expYear: string; cvc: string; name: string };
type Errors = Record<string, string | undefined>;

/** Groups the digits of a card number in fours as the shopper types. */
const formatCardNumber = (v: string) =>
	v
		.replace(/\D/g, '')
		.slice(0, 19)
		.replace(/(.{4})(?=.)/g, '$1 ');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string) {
	if (!email.trim()) return 'Enter your email so we can send your receipt';
	return EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address';
}

function validateAddress(a: AddressValues): Errors {
	return {
		fullName: a.fullName.trim() ? undefined : 'Enter your full name',
		line1: a.line1.trim() ? undefined : 'Enter your street address',
		city: a.city.trim() ? undefined : 'Enter your city',
		postalCode: a.postalCode.trim() ? undefined : 'Enter your ZIP code',
	};
}

/** `thisMonth` (year * 12 + month index) is null while the page is prerendered, when the current date is not available. */
function validateCard(c: CardValues, thisMonth: number | null): Errors {
	const digits = c.number.replace(/\D/g, '');
	const month = Number(c.expMonth);
	const year = Number(c.expYear);
	const expired = thisMonth !== null && year * 12 + (month - 1) < thisMonth;
	return {
		name: c.name.trim() ? undefined : 'Enter the name on the card',
		number: digits.length >= 9 ? undefined : 'Enter a card number, or use one of the demo cards',
		expMonth: month >= 1 && month <= 12 ? undefined : 'Use 1 to 12',
		expYear: !/^\d{4}$/.test(c.expYear)
			? 'Use 4 digits'
			: expired
				? 'This card has expired'
				: undefined,
		cvc: /^\d{3,4}$/.test(c.cvc) ? undefined : 'Use 3 or 4 digits',
	};
}

const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

function SectionTitle({ n, title }: { n: number; title: string }) {
	return (
		<CardTitle className="flex items-center gap-2.5 text-base">
			<span
				aria-hidden
				className="flex size-6 items-center justify-center rounded-full bg-green-700 text-xs font-semibold text-white dark:bg-green-600"
			>
				{n}
			</span>
			{title}
		</CardTitle>
	);
}

function CheckoutSkeleton() {
	return (
		<div aria-hidden className="mx-auto max-w-5xl px-4 py-8">
			<div className="mb-6 h-8 w-40 animate-pulse rounded bg-muted" />
			<div className="grid gap-8 md:grid-cols-[1fr_340px]">
				<div className="space-y-6">
					<div className="h-80 animate-pulse rounded-xl bg-muted" />
					<div className="h-96 animate-pulse rounded-xl bg-muted" />
				</div>
				<div className="h-72 animate-pulse rounded-xl bg-muted" />
			</div>
		</div>
	);
}

export default function CheckoutPage() {
	const router = useRouter();
	const { cart, refresh } = useCart();
	const [busy, setBusy] = useState(false);
	const [step, setStep] = useState<Step>({ orderId: null, threeDS: null });
	const { data: session, isPending: sessionPending } = authClient.useSession();
	// Saved addresses belong to an account, so guests skip the request.
	const { data: saved } = useApi<AddressView[]>(session ? '/addresses' : null);
	const [email, setEmail] = useState('');
	const [address, setAddress] = useState<AddressValues | null>(null);
	const [saveAddress, setSaveAddress] = useState(false);
	const defaultSaved = saved?.find(a => a.isDefault) ?? saved?.[0];
	const addressValue: AddressValues =
		address ?? (defaultSaved ? toValues(defaultSaved) : EMPTY_ADDRESS);
	// Offer to save only an address that is not saved yet, and only while there is room for it.
	const alreadySaved = saved?.some(a => sameAddress(toValues(a), addressValue)) ?? false;
	const canSaveAddress =
		!!session && saved !== null && saved !== undefined && !alreadySaved && saved.length < MAX_SAVED_ADDRESSES;
	const [card, setCard] = useState<CardValues>({
		number: '',
		expMonth: '',
		expYear: '',
		cvc: '',
		name: '',
	});
	const [payError, setPayError] = useState<string | null>(null);
	// Errors only show for fields the shopper has left, or for every field once they try to pay.
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [submitted, setSubmitted] = useState(false);
	const thisMonth = useSyncExternalStore(
		() => () => {},
		() => {
			const d = new Date();
			return d.getFullYear() * 12 + d.getMonth();
		},
		() => null,
	);

	// The page can stay mounted while the shopper browses elsewhere, so a finished (or stale) checkout must not linger:
	// whenever the cart changes, the order step and everything typed for it start over.
	const cartKey = cart ? cart.lines.map(l => `${l.variantId}:${l.quantity}`).join(',') : null;
	const [seenCartKey, setSeenCartKey] = useState(cartKey);
	if (cartKey !== seenCartKey) {
		setSeenCartKey(cartKey);
		if (cartKey !== null && seenCartKey !== null) {
			setStep({ orderId: null, threeDS: null });
			setCard({ number: '', expMonth: '', expYear: '', cvc: '', name: '' });
			setAddress(null);
			setSaveAddress(false);
			setTouched({});
			setSubmitted(false);
			setPayError(null);
		}
	}

	// Signed-in customers use their account email; guests give one here.
	const emailError = session ? undefined : validateEmail(email);
	const addressErrors = validateAddress(addressValue);
	const cardErrors = validateCard(card, thisMonth);
	const addressShown = Object.fromEntries(
		Object.entries(addressErrors).map(([k, v]) => [
			k,
			submitted || touched[`ship-${k}`] ? v : undefined,
		]),
	);
	const shown = (key: string, errors: Errors) =>
		submitted || touched[key] ? errors[key] : undefined;
	const touch = (key: string) => setTouched(t => ({ ...t, [key]: true }));
	const cardField = (key: keyof CardValues) => ({
		'id': key,
		'value': card[key],
		'onBlur': () => touch(key),
		'aria-invalid': shown(key, cardErrors) ? true : undefined,
		'aria-describedby': shown(key, cardErrors) ? `${key}-error` : undefined,
	});

	function fillDemoCard(number: string) {
		const year = new Date().getFullYear();
		setCard(c => ({
			number,
			expMonth: c.expMonth || '12',
			expYear: c.expYear || String(year + 2),
			cvc: c.cvc || DEMO_CVC,
			name: c.name || 'Demo Shopper',
		}));
	}

	function handleResult(result: PayResult) {
		if (result.status === 'paid') {
			// The success page refreshes the cart; doing it here would flash "Nothing to check out" mid-navigation.
			router.push(`/checkout/success/${result.orderId}`);
		} else if (result.status === 'requires_action') {
			setStep({
				orderId: result.orderId,
				threeDS: { paymentId: result.paymentId, orderId: result.orderId },
			});
		} else {
			setPayError(FAILURE_MESSAGES[result.reason] ?? 'Payment failed. Please try again.');
			if (result.reason === 'out_of_stock') void refresh();
		}
	}

	async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		setSubmitted(true);
		setPayError(null);
		if (emailError || hasErrors(addressErrors) || hasErrors(cardErrors)) {
			// Move focus to the first field with a problem so the shopper does not have to hunt for it.
			requestAnimationFrame(() =>
				document.querySelector<HTMLElement>('[aria-invalid=true]')?.focus(),
			);
			return;
		}
		setBusy(true);
		try {
			// The order is created once; a declined card can be retried against the same order.
			let orderId = step.orderId;
			if (!orderId) {
				const created = await api<{ orderId: string }>('/checkout/orders', {
					method: 'POST',
					json: {
						shippingAddress: toAddressPayload(addressValue),
						...(session ? {} : { email: email.trim().toLowerCase() }),
					},
				});
				orderId = created.orderId;
				setStep({ orderId, threeDS: null });
				if (saveAddress && canSaveAddress)
					await api('/addresses', { method: 'POST', json: toAddressPayload(addressValue) }).catch(
						() => {},
					);
			}
			handleResult(
				await api<PayResult>(`/checkout/orders/${orderId}/pay`, {
					method: 'POST',
					json: {
						card: { ...card, expMonth: Number(card.expMonth), expYear: Number(card.expYear) },
					},
				}),
			);
		} catch (err) {
			setPayError(err instanceof ApiError ? err.message : 'Checkout failed. Please try again.');
			if (err instanceof ApiError && err.status === 409) void refresh();
		} finally {
			setBusy(false);
		}
	}

	async function approve3DS() {
		if (!step.threeDS) return;
		setBusy(true);
		try {
			const result = await api<PayResult>(`/checkout/payments/${step.threeDS.paymentId}/confirm`, {
				method: 'POST',
			});
			setStep(s => ({ ...s, threeDS: null }));
			handleResult(result);
		} catch (err) {
			setPayError(err instanceof ApiError ? err.message : 'Confirmation failed. Please try again.');
			setStep(s => ({ ...s, threeDS: null }));
		} finally {
			setBusy(false);
		}
	}

	if (!cart) return <CheckoutSkeleton />;
	if (cart.lines.length === 0 && !step.orderId) {
		return (
			<div className="mx-auto max-w-5xl px-4 py-16">
				<div className="mx-auto max-w-md rounded-2xl border border-dashed p-10 text-center">
					<span
						aria-hidden
						className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<ShoppingCart className="size-6" />
					</span>
					<h1 className="mt-4 text-2xl font-bold tracking-tight">Nothing to check out</h1>
					<p className="mt-2 text-muted-foreground">Add a plant to your cart first.</p>
					<Link href="/shop" className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>
						Browse plants
					</Link>
				</div>
			</div>
		);
	}

	const locked = step.orderId !== null;
	const showErr = (key: string) => shown(key, cardErrors);

	return (
		<div className="mx-auto max-w-5xl px-4 py-8">
			<div className="mb-4 flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
			</div>
			<form
				onSubmit={onSubmit}
				noValidate
				className="grid items-start gap-8 md:grid-cols-[1fr_340px]"
			>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<SectionTitle n={1} title="Contact" />
							<CardDescription>
								{session
									? 'Your receipt goes to your account email.'
									: 'No account needed. We send your receipt and a link to track the order here.'}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{sessionPending ? (
								<div aria-hidden className="h-8 animate-pulse rounded-lg bg-muted" />
							) : session ? (
								<p className="text-sm">
									Signed in as <span className="font-medium">{session.user.email}</span>
								</p>
							) : (
								<>
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											inputMode="email"
											autoComplete="email"
											maxLength={254}
											value={email}
											disabled={locked}
											onChange={e => setEmail(e.target.value)}
											onBlur={() => touch('email')}
											aria-invalid={shown('email', { email: emailError }) ? true : undefined}
											aria-describedby={
												shown('email', { email: emailError }) ? 'email-error' : undefined
											}
										/>
										<FieldError id="email-error" message={shown('email', { email: emailError })} />
									</div>
									{!locked && (
										<p className="text-sm text-muted-foreground">
											Already have an account?{' '}
											<Link href="/sign-in?next=%2Fcheckout" className="underline">
												Sign in
											</Link>
										</p>
									)}
								</>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<SectionTitle n={2} title="Shipping address" />
							<CardDescription>
								{locked
									? 'Your order is created, so the address is locked. Just finish paying.'
									: 'Fake addresses are fine. Nothing will be shipped.'}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{saved && saved.length > 0 && (
								<div className="space-y-2">
									<Label htmlFor="savedAddress">Use a saved address</Label>
									<Select
										disabled={locked}
										value={saved.find(a => sameAddress(toValues(a), addressValue))?.id ?? NEW_ADDRESS}
										items={[
											{ value: NEW_ADDRESS, label: 'Enter a new address' },
											...saved.map(a => ({ value: a.id, label: `${a.fullName}, ${a.line1}, ${a.city}` })),
										]}
										onValueChange={value => {
											const chosen = saved.find(a => a.id === value);
											setAddress(chosen ? toValues(chosen) : EMPTY_ADDRESS);
										}}
									>
										<SelectTrigger id="savedAddress" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent alignItemWithTrigger={false}>
											<SelectItem value={NEW_ADDRESS}>Enter a new address</SelectItem>
											{saved.map(a => (
												<SelectItem key={a.id} value={a.id}>
													{a.fullName}, {a.line1}, {a.city}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
							<AddressFields
								value={addressValue}
								onChange={setAddress}
								disabled={locked}
								idPrefix="ship"
								errors={addressShown}
								onFieldBlur={key => touch(`ship-${key}`)}
								// Saving an address needs an account, so guests never see this.
								zipAside={
									!locked && canSaveAddress ? (
										<label className="flex w-fit items-center gap-2">
											<Checkbox
												checked={saveAddress}
												onCheckedChange={checked => setSaveAddress(checked === true)}
											/>
											Save this address to my account
										</label>
									) : undefined
								}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<SectionTitle n={3} title="Payment" />
							<CardDescription>
								This is a simulated payment. No real card is charged or stored.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
								<p className="font-medium">Demo cards (CVC {DEMO_CVC}, any future expiry)</p>
								<ul className="mt-2 space-y-1.5">
									{DEMO_CARDS.map(c => (
										<li key={c.number} className="flex items-center justify-between gap-2">
											<span>
												<code className="font-semibold">{c.number}</code>{' '}
												<span className="text-xs">{c.label.toLowerCase()}</span>
											</span>
											<Button
												type="button"
												variant="outline"
												size="xs"
												onClick={() => fillDemoCard(c.number)}
											>
												Use
											</Button>
										</li>
									))}
								</ul>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="name">Name on card</Label>
									<Input
										{...cardField('name')}
										maxLength={80}
										onChange={e => setCard({ ...card, name: e.target.value })}
										autoComplete="cc-name"
									/>
									<FieldError id="name-error" message={showErr('name')} />
								</div>
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="number">Card number</Label>
									<Input
										{...cardField('number')}
										inputMode="numeric"
										placeholder="1234 5678 9"
										maxLength={23}
										onChange={e => setCard({ ...card, number: formatCardNumber(e.target.value) })}
										autoComplete="cc-number"
									/>
									<FieldError id="number-error" message={showErr('number')} />
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label htmlFor="expMonth">Month</Label>
										<Input
											{...cardField('expMonth')}
											inputMode="numeric"
											placeholder="MM"
											maxLength={2}
											onChange={e =>
												setCard({ ...card, expMonth: e.target.value.replace(/\D/g, '') })
											}
											autoComplete="cc-exp-month"
										/>
										<FieldError id="expMonth-error" message={showErr('expMonth')} />
									</div>
									<div className="space-y-2">
										<Label htmlFor="expYear">Year</Label>
										<Input
											{...cardField('expYear')}
											inputMode="numeric"
											placeholder="YYYY"
											maxLength={4}
											onChange={e =>
												setCard({ ...card, expYear: e.target.value.replace(/\D/g, '') })
											}
											autoComplete="cc-exp-year"
										/>
										<FieldError id="expYear-error" message={showErr('expYear')} />
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="cvc">CVC</Label>
									<Input
										{...cardField('cvc')}
										inputMode="numeric"
										placeholder="123"
										maxLength={4}
										onChange={e => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })}
										autoComplete="cc-csc"
									/>
									<FieldError id="cvc-error" message={showErr('cvc')} />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex flex-col md:sticky md:top-30 gap-4">
					<aside className="space-y-4 rounded-xl border bg-card p-5">
						<h2 className="font-semibold">Order summary</h2>
						<ul className="space-y-3">
							{cart.lines.map(l => (
								<li key={l.variantId} className="flex items-center gap-3 text-sm">
									<span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5">
										{l.imageUrl && (
											<Image
												src={l.imageUrl}
												alt=""
												fill
												unoptimized
												sizes="48px"
												className="object-cover"
											/>
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">{l.productName}</span>
										<span className="text-xs text-muted-foreground">
											{l.variantLabel} × {l.quantity}
										</span>
									</span>
									<span className="tabular-nums">{formatPrice(l.lineTotalCents)}</span>
								</li>
							))}
						</ul>
						<div className="border-t pt-4">
							<OrderTotals totals={cart} />
						</div>
						{payError && (
							<div
								role="alert"
								className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
							>
								<CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
								{payError}
							</div>
						)}
						<Button type="submit" size="lg" className="w-full" disabled={busy}>
							{busy ? (
								<>
									<Loader2 aria-hidden className="animate-spin" /> Processing payment…
								</>
							) : (
								<>
									<Lock aria-hidden /> Pay {formatPrice(cart.totalCents)}
								</>
							)}
						</Button>
						<p className="text-center text-xs text-muted-foreground">
							Simulated payment. No real money moves.
						</p>
					</aside>
					{!locked && (
						<Link
							href="/cart"
							className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline justify-center"
						>
							<ArrowLeft aria-hidden className="size-4" /> Back to cart
						</Link>
					)}
				</div>
			</form>

			<ThreeDSDialog
				open={step.threeDS !== null}
				busy={busy}
				onApprove={approve3DS}
				onCancel={() => setStep(s => ({ ...s, threeDS: null }))}
			/>
		</div>
	);
}
