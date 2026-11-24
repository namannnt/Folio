# Folio - Library workspace

A working, private library inventory and circulation prototype for Written Test Question 2.

## Live application

https://folio-library-naman.mittalnaman2005.chatgpt.site

The published application is owner-private. Evaluation does not depend on access to this link: the screenshot evidence PDF captures the interface and important states.

Demo administrator: `admin@folio.local` / `FolioAdmin!2026`

Demo librarian: `desk@folio.local` / `FolioDesk!2026`

These credentials and all seeded borrowers are fictional demonstration data. The private hosting gate is separate from application staff roles.

## Included workflows

- Titles/editions separate from individual physical copies, optional ISBN with checksum validation.
- Create/edit titles, add multiple copies, unique custom or generated barcodes, reference-only copies, shelf and replacement cost.
- Safe copy withdrawal and title archive, with history preserved and dependency checks.
- Member records, expiry and suspension, current and historical loans.
- Multi-copy checkout, eligibility checks, receipts, independent returns, damage charges and repair routing.
- Overdue estimates, capped assessed fines, partial/full payments, administrator waivers and compensating reversals.
- Edition-level reservation queues, allocation, cancellation, opening-day pickup deadlines, lazy expiration.
- Renewal eligibility, original policy snapshots for existing loans.
- Lost copy reporting, replacement charge, recovery/inspection, explicit financial review.
- Shelf verification with discrepancy review, CSV exports, activity log, staff accounts and policy settings.
- Optimistic revision checking and bounded request deduplication prevent conflicting or repeated mutations.

## Implementation

React 19 / TypeScript, Vinext, Cloudflare Worker routes and D1. All mutations are validated on the server. Domain functions in `lib/domain.mjs` operate on a cloned workspace; only a successful revision-checked UPDATE commits the entire mutation. Sessions use opaque tokens, server-side hashes, HttpOnly/SameSite cookies, 24-hour expiry, and PBKDF2 password hashes.

For this bounded demonstration, related entities are stored in one versioned D1 JSON aggregate. This keeps circulation, stock and balances atomic without distributed transactions. It is intentionally not a normalized production schema: every write revises the aggregate, and large libraries should migrate to normalized tables with row-level constraints, indexed queries, pagination and dedicated retention rules. The UI uses the same copy-level domain relationships either way.

Reservation expiry is evaluated whenever the library is read or mutated; this version does not send automatic emails/SMS or run background expiry jobs. Cash and external UPI/card payment entries record an already completed payment; no money is moved by the application. All days are chargeable unless explicitly listed as closed. Policy changes apply to new loans; existing loans retain snapshots. New reservations may be placed by active members with unpaid charges, but pickup is blocked until borrowing eligibility is restored.

Demo accounts are intentionally displayed for evaluation. The prototype does not implement password recovery, brute-force throttling, backups, payment gateway reconciliation or production security hardening. Keep real member and payment data out of this evaluation deployment.

## Local development

Node 22.13+ required.

1. `npm ci`
2. `npm run build`
3. Apply `drizzle/0000_short_kang.sql` once to local D1 using the generated `dist/server/wrangler.json` config and `.wrangler/state` persistence path.
4. `npm run dev`

The managed development environment uses its provided preview daemon rather than starting a second server. See the scripts and hosting manifest for deployment settings.

## Verification

- `npm test`: 75 independent scenarios (42 domain, 18 real API/SQLite, 15 React interface scenarios). Node reports 77 passing test nodes including two grouped parent cases. No skipped or failed cases in the required suite.
- `npm run typecheck`: TypeScript validation.
- `npm run lint`: all source, templates and tests; zero errors and zero warnings.
- `npm run format:check`: formatting validation for the maintained application and tests.
- `npm run build`: production Worker/client compilation.

API integration tests execute the actual `app/api/library/route.ts` against a temporary SQLite database with a D1-compatible adapter. React tests mount the actual interface in jsdom and send its requests through that same API. Test data is isolated from the published collection. They cover forms, navigation, focus, receipt actions, permissions, CSV output, lost-response retries and session expiry. This is automated DOM verification, not a rendered-browser visual test.

The original browser walkthrough and 50 interface captures remain available in the evidence PDF. Fresh browser rendering and native print-preview checks were unavailable in the final audit environment; no claim of universal device/browser coverage is made. The responsive and print styles compile, and the receipt print control is exercised by component tests.

`FOLIO_TEST_ORIGIN=<accessible-origin> npm run test:live` runs an additional HTTP smoke test. A private published origin also requires a supported service-access token in the process environment. Do not put tokens in command arguments, source files or version control. The normal test suite has no dependency on a running server or remote credentials.

See `AUDIT.md` for the exact review scope and fixes.

## Submission

The screenshot PDF is a Question 2 evidence pack, not the combined final submission. Add the independently prepared Question 1 response before submitting a single PDF. Screenshots were captured from a local working instance with fictional data; production initializes its own equivalent sample collection. Some captures show before/after changes as a sequential walkthrough.
