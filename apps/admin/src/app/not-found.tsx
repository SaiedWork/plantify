import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-3 inline-block text-sm underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
