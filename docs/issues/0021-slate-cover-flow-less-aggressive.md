# Slate: sign-in-to-cover returns to the card; paywall only at zero

**Type**: AFK
**Status**: complete
**Blocked by**: none

## What to build

Fix the group settings "Sign in to cover" flow, which today dumps a freshly signed-in user straight into the credit-purchase UI (ADR-0005). After signing in from that button, the sheet closes and the user is back on the Receipt scans card with "Cover this group" now active — covering stays one explicit, deliberate tap (decision of record: no auto-cover). The top-up/purchase view appears only when the signed-in balance is zero, framed as needing scans to cover; anyone with credits can top up voluntarily via the existing "Top up" button.

New accounts arrive with the 5-credit welcome grant, so the zero-balance paywall should be the rare path, not the default.

## Acceptance criteria

- [ ] Tapping "Sign in to cover" and completing sign-in lands back on the Receipt scans card, signed in, with "Cover this group" enabled — no purchase UI shown
- [ ] The card immediately reflects the signed-in state (balance, button labels) without a manual refresh
- [ ] If the signed-in balance is zero, the sheet shows the top-up view with copy explaining scans are needed to cover
- [ ] A brand-new account signing in from this button (5 welcome credits) sees no paywall
- [ ] "Top up" still opens the purchase flow on demand for signed-in users with any balance

## Blocked by

None - can start immediately
