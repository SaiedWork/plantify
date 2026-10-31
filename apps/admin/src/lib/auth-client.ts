import { createAuthClient } from "better-auth/react";

// Same-origin: requests go to /api/auth/* which next.config.ts rewrites to the Nest API.
export const authClient = createAuthClient();

export const DEMO_PASSWORD = "plantify-demo";
export const DEMO_ACCOUNTS = [
  { label: "Owner", email: "owner@plantify.test", blurb: "Full access: billing, webhooks, staff" },
  { label: "Catalog manager", email: "catalog@plantify.test", blurb: "Products and inventory only" },
  { label: "Order manager", email: "orders@plantify.test", blurb: "Orders, fulfilment and customers" },
] as const;
