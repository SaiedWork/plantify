# Five-minute demo script

A guided tour of Plantify. Everything is fake: no real payments, no real email, and the database resets every 7 days. Locally, use `storefront.localhost:3000` and `admin.localhost:3001` (see the [README](../README.md)); on the deployed demo, use the two public URLs.

**Demo data**

| What | Value |
|---|---|
| Owner login (admin) | `owner@plantify.test` / `plantify-demo` |
| Catalog manager login (admin) | `catalog@plantify.test` / `plantify-demo` |
| Order manager login (admin) | `orders@plantify.test` / `plantify-demo` |
| Card that pays | `1234 5678 9` (or `4242 4242 4242 4242`) |
| Card that is declined | `0000 0000 0` (or `4000 0000 0000 0002`) |
| Card that asks for fake 3-D Secure | `1111 1111 1` (or `4000 0025 0000 3155`) |
| Expiry / CVC | any future date / `123` |

## 1. Storefront (about 2 minutes)

1. **Browse.** Open the storefront, pick a category on the home page, then use the shop filters (price, in stock) and the search box.
2. **Add to cart.** Open a product, choose a variant (size or pot) and add it. The cart updates in the header; open `/cart` to change quantities.
3. **Sign up, or check out as a guest.** At checkout a guest can simply enter an email and pay (steps 5 and 6 work the same, and the success page links to a tracking page that works for 24 hours). To use an account instead, choose *Sign in* there, then *Create an account*, and use any address such as `you@example.com`.
4. **Read the code in the demo inbox.** The page says the code was sent to your demo inbox. Open the inbox slide-over, copy the 6-digit code and enter it. (Locally the same mail also lands in Mailpit at http://localhost:8025.)
5. **Pay.** Enter an address, click *Autofill demo card* (or type `1234 5678 9`, any future expiry, CVC `123`) and pay. You land on the success page with an invoice number (`PLT-…`).
6. **Check the receipt.** Open the demo inbox again: the order confirmation is there. Under *My account → Orders* open the order and its invoice.
7. **Failure path (optional).** Check out again with `0000 0000 0`: the payment is declined and the order stays unpaid. The `1111 1111 1` card shows the fake 3-D Secure step.

## 2. Admin as owner (about 2 minutes)

Open the admin app, choose *Owner* and press *Sign in*.

1. **Dashboard.** Revenue, orders and top products for the selected period. The order you just placed is in the numbers.
2. **Orders.** Open your order. Move it through *Start processing → Mark as shipped → Mark as delivered* (one button per step), or refund it with the *restock* option.
3. **Inventory.** The paid order wrote a *sale* row in the stock ledger. Open the variant's movements, then add a restock.
4. **Webhooks.** Open the built-in "Plantify Echo" endpoint, press Send test (or place an order) and watch the signed delivery appear in the delivery log. Optionally add your own endpoint (for example a https://webhook.site URL) from the Add endpoint button; failed deliveries can be retried.
5. **Staff & roles.** The owner is fixed; the catalog manager and order manager always hold one role each, so picking a role for one swaps it with the other. It takes effect on their next request.
6. **Audit log.** Every staff action above is recorded with who did it.

## 3. Roles (about 1 minute)

Sign out (account menu at the bottom of the sidebar), choose *Catalog manager* and press *Sign in*, then try *Order manager*.

- The catalog manager has *Products*, *Categories* and *Inventory* only. The order manager has *Orders* and *Customers* only.
- Neither sees revenue. Each dashboard shows count cards for their own area: catalog and stock counts for the catalog manager, order pipeline and customer counts for the order manager.
- The refund action is gone from orders.
- Opening a hidden URL such as `/staff` shows "You don't have access". The API enforces the same rules, so calling those endpoints directly returns 403.

## Reset

The demo is wiped and reseeded every 7 days; the banner at the top of both apps shows the countdown. Anything you create (accounts, orders, uploads) disappears at the reset.
