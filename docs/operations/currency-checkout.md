# Currency display and NAD checkout

Customers can select USD, NAD, ZAR, EUR or GBP. The application uses each package's
`pricesRecommendedRetailPrice` map: the ZAR retail amount is the NAD payment
amount, and the other entries supply the displayed estimates. No FX API or
additional conversion margin is used. Airalo supplier billing remains in USD.

## Deploy

1. Back up the database through the deployment platform's normal process.
2. Apply `npx prisma migrate deploy` before deploying this application version.
   Migration `20261021160000_add_currency_quotes` adds the optional account
   preference, private checkout quotes and the optional checkout relationship.
   Existing order/payment amounts and currencies are not converted.
3. Deploy the application and run the existing catalog sync. Check that sellable
   eSIMs and top-ups have positive ZAR retail values and fresh sync timestamps.
   `CATALOG_MAX_AGE_HOURS` continues to default to 48.
4. Confirm with the DPO merchant configuration that hosted payments stay in NAD.
   Hosted currency conversion must not change the amount/currency that the
   verification endpoint reports. The application intentionally rejects an
   unexpected verification currency or amount.
5. Test preference persistence as a guest and a signed-in customer. For one plan,
   changing between all five currencies must leave the reviewed NAD amount equal
   to its ZAR retail price.
6. Validate a controlled live purchase and top-up. Check the quote, DPO request,
   callback, verification, single supplier fulfilment, receipt and commission.
   A local provider mock is not evidence of a successful live transaction.

## Quote and retry behavior

`POST /api/checkout-quotes` creates a 15-minute quote without contacting DPO.
`POST /api/checkouts` requires its ID and the same account or guest session.
Expired quotes and changed catalog prices require another review. Each quote
can create only one checkout. Once a payment exists its amounts remain frozen,
even if catalog prices change or the original quote expires.

If the DPO create request fails without a known outcome, the checkout is marked
`payment_creation_unknown`. Retrying the same quote does not submit another DPO
request. Reconcile the original checkout reference with DPO before advising a
customer to start another purchase; there may already be an outstanding token.

Quotes use the same-origin application routes and a private guest-session cookie.
Their database table has row-level security enabled and no direct access for
the standard `anon`/`authenticated` roles. Normal backend access is required.

## Accounting

New checkout, payment, order and affiliate records use NAD. Receipts and order
history retain the original displayed estimate alongside the amount paid.
Refunds and chargebacks are recorded in the original sale currency; never use
today's package price to calculate a refund. Historical currencies remain intact.
Dashboard totals are filtered/grouped by currency. Supplier margin previews use
ZAR net prices for NAD estimates and exclude payment/transfer fees; they are
not historical settled profit.

## Monitoring and rollback

Watch `payments.quote.price_unavailable`, catalog-sync failures,
`payments.checkout.dpo_error`, and verification mismatches. An invalid/missing
ZAR retail value or stale catalog prevents new checkout for the package.

Set `CHECKOUT_CREATION_ENABLED=false` and redeploy to stop new quotes and payments.
Existing payment verification, callbacks, recovery, fulfilment and order access
continue. Retain the additive migration during rollback; do not remove paid
quotes or rewrite historical payment currencies. Re-enable new checkout by
removing the override or setting it to `true` after resolving the incident.

Expired unused quotes can be removed by a database maintenance job, restricting
deletion to rows without a related checkout. Retain quotes attached to financial
records.

## Local verification

Use Node 22. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
`node --import tsx scripts/qa-currency-checkout.ts` additionally starts a disposable
database and development server for browser checks. It intercepts payment
initiation and never uses the configured production database. Install the
Playwright Chromium browser first, or set `QA_BROWSER_CHANNEL=chrome` to use an
installed Chrome browser. The script checks currency choices, the fixed NAD
charge, cookie/account persistence, account isolation, cart refresh and mobile
layout, and saves screenshots in the system temporary directory.
