import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestLinkForm } from "@/components/request-link-form";

export const metadata = { title: "Track an order · Plantify" };

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Track an order
          </CardTitle>
          <CardDescription>
            No account needed. Enter your order number and the email you used at checkout and we will send a fresh link to the demo
            inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestLinkForm />
        </CardContent>
      </Card>
    </div>
  );
}
