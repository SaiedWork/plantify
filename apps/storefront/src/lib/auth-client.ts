import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Same-origin: requests go to /api/auth/* which next.config.ts rewrites to the Nest API.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
