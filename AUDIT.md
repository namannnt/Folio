# Final verification - Folio, Question 2

Reviewed on 24 November 2026. Scope: the single-library evaluation prototype and its screenshot submission, not production certification.

## Results

| Check                                   | Result                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Domain scenarios                        | 42 passed                                                                                             |
| Real API route with isolated SQLite     | 18 passed                                                                                             |
| Real React interface with isolated API  | 15 passed                                                                                             |
| Required automated suite                | 75 scenarios, 77 passing test nodes; 0 failed, 0 skipped                                              |
| TypeScript                              | Passed                                                                                                |
| Whole-repository ESLint                 | Passed, 0 errors and 0 warnings                                                                       |
| Maintained-source formatting            | Checked with Prettier                                                                                 |
| Live audience                           | Owner-private; preserved                                                                              |
| Existing evidence                       | 50 real interface captures; 56-page PDF with active links                                             |
| Final visual-browser/native print check | Unavailable in this environment; automated DOM checks are not a substitute for rendered layout checks |

## Defects corrected

- A lost HTTP response could make a client retry under a new request ID. The client now retains the same ID and revision for the same uncertain action; the API returns the original result without repeating the mutation.
- The state-based busy flag alone did not synchronously guard rapid handlers. A mutation lock now prevents duplicate submissions, navigation during a write and premature dialog dismissal.
- A session expiry could leave a modal over the new sign-in screen. Authentication failure now closes the modal and clears stale application state.
- Reprinted financial receipts could display a later account balance. Newly created receipts retain the balance immediately after their transaction. Older seeded entries explicitly show a current balance.
- Generated copy barcodes relied on truncated random IDs. Automatic copy barcodes now use a checked, increasing accession sequence and never reuse a withdrawn barcode.
- Membership changes could leave a ready reservation allocated until another read. Suspension or expiry now releases its allocation in the same transaction and considers the next member.
- Missing-record edits and malformed values could silently create or coerce records. The API and domain layer now reject wrong payload types, invalid money/flags/dates, and missing edit targets.
- An internal database error could be reported as a validation failure with implementation details. Unexpected errors now return a generic server error; domain validation and forbidden actions retain their appropriate status.
- Field labels included unrelated child content. Form controls now have explicit label associations, hint IDs and named dialogs.
- Nested display components were recreated during every render. They are stable components; returning from a member dialog also dismisses it before opening circulation.
- Some filtered tables became blank. Reservations, ledger, inventory and activity now show explicit empty states.
- Mobile navigation can now be dismissed by its backdrop or Escape. CSV exports also guard formula-like user-entered values before spreadsheet opening.

## Coverage and practical limits

Tests cover add/edit title and copy, unique barcodes, members, eligibility, issue, return, renewal, overdue boundaries and caps, closure dates, policy snapshots, reservations, pickup expiry, payment and waiver rules, reversals, loss/recovery, safe deletion, stocktaking, concurrent revisions, session cookies/expiry, role enforcement, exports and client retries.

The database is a versioned aggregate for a bounded prototype. There is no background notification service, external payment processor, password recovery or multi-branch functionality. Only explicitly configured closure dates are non-chargeable. Data and demonstration credentials are fictional.

The 50 screenshots were captured in the original real-browser walkthrough; final operational fixes were regression-tested through the real React components and server route. The PDF does not claim those earlier captures are screenshots of every later internal code change.

## Submission decision

Question 2 has the required feature evidence, reasoning, assumptions and scenario coverage. The complete written test is still incomplete until Question 1 is added and both are exported as one PDF. The private application URL is supplementary; evaluation must be possible from the screenshots alone.
