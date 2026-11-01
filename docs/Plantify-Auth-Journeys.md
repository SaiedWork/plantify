# Plantify customer authentication

How a shopper moves through sign-up, sign-in and the gated pages in the storefront. Derived from `proxy.ts`, the sign-in, sign-up and verify pages, and the Better Auth setup in `auth.service.ts`.

## 1. Guest journey

Browsing is open, and so is checkout: a guest can pay with just an email. Only `/account/*` is gated, and the gate sends the guest to sign-in with a `next` path so they land back where they started.

```mermaid
flowchart TD
  A([Guest opens storefront]) --> B[Browse catalog, product pages, cart]
  B --> C{Opens /account?}
  C -- No --> B2{Goes to /checkout?}
  C -- Yes --> D{Session cookie present?}
  D -- Yes --> Z([Page loads, see journey 2])
  D -- No --> E["Redirect to /sign-in?next=path"]
  E --> F{Has an account?}
  F -- Yes --> G[Sign in: password or email code]
  F -- No --> H["Click 'Create an account'"]
  G --> I([Journey 2: returning customer])
  H --> J([Journey 3: sign-up])
  I --> K[Back to the page they wanted]
  J --> K
  B2 -- No --> B
  B2 -- Yes --> L[Checkout asks for an email, then address and card]
  L --> M([Journey 4: guest checkout])
```

- The proxy only checks that a cookie exists. The API re-validates the session on every real request, so a forged cookie gets no data.
- The sign-in page reached from checkout (`?next=/checkout`) also offers a "Checkout as a guest" button.

## 2. Returning customer

An existing account signs in with a password or a one-time code. An account that never finished verification is pushed back into verification.

```mermaid
flowchart TD
  A([Opens /sign-in]) --> S{Already has a session?}
  S -- Yes --> P[Gated pages open directly, header shows account and Sign out]
  S -- No --> M{Sign-in method}
  M -- Password --> PW[Enter email + password]
  M -- Email me a code --> C1[Enter email, 'Send me a code']
  PW --> R1{API result}
  R1 -- OK --> DONE
  R1 -- "403: email not verified" --> V1[Fresh verification code sent, demo inbox opens]
  V1 --> VER([Go to /verify, see journey 3])
  R1 -- Wrong credentials --> ERR1[Toast error, try again]
  ERR1 --> PW
  C1 --> C2[6-digit code lands in demo inbox]
  C2 --> C3[Enter code]
  C3 --> R2{Code valid?}
  R2 -- "Yes (10 min, max 5 attempts)" --> DONE
  R2 -- No --> ERR2[Toast error, field cleared]
  ERR2 --> C3
  DONE[Session cookie set] --> N["Redirect to next (default /)"]
  N --> P
  P --> O[Sign out]
  O --> G([Back to guest journey])
```

## 3. Sign-up journey

Email verification is required before the first sign-in. Completing the code step signs the new customer in automatically.

```mermaid
flowchart TD
  A([Opens /sign-up]) --> B["Enter name, email, password (min 8)"]
  B --> C{API accepts?}
  C -- "No, e.g. email taken" --> E1[Toast error]
  E1 --> B
  C -- Yes --> D["Account created with role 'customer', unverified"]
  D --> F[6-digit code sent, demo inbox opens]
  F --> G["/verify?email=...&next=..."]
  G --> H[Enter code from demo inbox]
  H --> I{Code valid?}
  I -- "No (max 5 attempts)" --> E2[Toast error, field cleared]
  E2 --> H
  G --> RS{Need a new code?}
  RS -- "Resend, after 30s cooldown" --> F
  I -- "Yes, within 10 min" --> J[Email marked verified]
  J --> K[Auto sign-in, session cookie set]
  K --> L["Toast 'Welcome to Plantify!'"]
  L --> M["Redirect to next (default /)"]
  M --> N([Signed-in customer])
```

- Codes are stored hashed and expire after 10 minutes. Sending is limited to 5 per minute per address; the API as a whole allows 60 auth requests per minute.
- Customers cannot set their own role; staff roles come from the seed only.
- This is a demo: codes arrive in the in-app inbox, not a real mailbox.

## 4. Guest checkout

A guest gives an email, then the same address and card steps as a customer. There is no account, so the order is `user_id = null` with a `contact_email`.

- **Finishing the payment.** Creating the order sets a signed `guest_orders` cookie (up to 5 order ids) that lasts until the browser closes. Pay, confirm and the success page accept either a session or that cookie, and only for orders without an account.
- **Receipt.** The confirmation email lands in the demo inbox for that address (the inbox cookie is granted for the contact email) and holds a "view your order" link, `/orders/track/<orderId>.<expiresAtMs>.<hmac>`, valid for 24 hours. The token is stateless and signed with `BETTER_AUTH_SECRET`.
- **Tracking page.** Public, read-only: status steps with timestamps (from the `order_event` table, filled by a database trigger), items, totals, address and the invoice. An expired link offers a form to request a new one (order number plus email); the answer is always the same, so it cannot be used to discover orders. "Track an order" in the footer opens the same form.
- **Joining an account later.** Signing in needs a verified email, so every new session attaches guest orders with that email to the account (`session.create.after` in `auth.service.ts`). The success and tracking pages offer "Create account" with the email prefilled.
