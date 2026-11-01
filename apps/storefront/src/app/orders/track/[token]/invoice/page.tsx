'use client';

import { InvoiceDocument } from '@/components/invoice-document';
import { Button } from '@/components/ui/button';
import { useTrackedOrder } from '@/components/use-tracked-order';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

function TrackedInvoice() {
	const { token } = useParams<{ token: string }>();
	const { order, problem, loading } = useTrackedOrder(token);

	return (
		<div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
			{loading ? (
				<div aria-hidden className="h-96 animate-pulse rounded-xl bg-muted" />
			) : problem || !order?.invoice ? (
				<p>
					We couldn&apos;t find that invoice. It may have expired.{' '}
					<Link href="/orders/lookup" className="underline">
						Get a new link
					</Link>
				</p>
			) : (
				<>
					<div className="flex items-center justify-between print:hidden">
						<Link
							href={`/orders/track/${token}`}
							className="text-sm flex items-center gap-2 text-muted-foreground hover:underline hover:text-foreground"
						>
							<ArrowLeft aria-hidden className="size-4" /> Back to order
						</Link>
						<Button onClick={() => window.print()}>
							<Printer className="size-4" /> Print / Save as PDF
						</Button>
					</div>
					<InvoiceDocument order={order} email={order.contactEmail} />
				</>
			)}
		</div>
	);
}

export default function TrackedInvoicePage() {
	return (
		<Suspense
			fallback={<div aria-hidden className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />}
		>
			<TrackedInvoice />
		</Suspense>
	);
}
