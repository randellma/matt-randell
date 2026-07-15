# Slate: account sheet off the Home footer

**Type**: AFK
**Status**: complete
**Blocked by**: none

## What to build

Give the Account a home (ADR-0005). The Home footer row that today reads "Receipt scans · N left" / "Receipt scans · sign in" becomes the account entry point: signed in it shows your avatar, profile name (or email if nameless), and scan balance; signed out it invites sign-in. Tapping it opens a new **Account sheet** (same bottom-drawer idiom as the existing sheets, receipt-themed):

- **Profile**: editable display name and photo. This is where the profile name now lives — remove the "Your name — shown when your scans cover a group" field from the credits sheet.
- **Scan Credits**: current balance, a top-up action (reusing the existing pack-purchase flow), and purchase/scan history from the credit ledger.
- **Sign out**: works, verifiably — there's a suspected bug where signing out from the credits sheet doesn't take; reproduce or rule it out, and fix it if real.
- **Signed out**: the sheet is the sign-in flow plus a line on what an account is for.

The credits sheet slims back down to its paywall/top-up moments inside groups. Also soften the Home masthead's "No accounts · No sign-ups" line — still true for Groups, no longer true globally — to something group-scoped.

## Acceptance criteria

- [x] Home footer row shows avatar + name + balance when signed in, a sign-in invitation when not; both open the Account sheet
- [x] Profile name and photo are editable in the sheet and persist; the credits sheet no longer asks for a name
- [x] The sheet shows the live balance, a working top-up, and a readable history of credit events (grants, purchases, scans)
- [x] Sign out from the sheet returns the whole app to a signed-out state (footer row, group settings, scan cards all reflect it); the suspected sign-out bug is confirmed fixed or ruled out
- [x] Signed out, the sheet offers the sign-in flow
- [x] The Home masthead no longer claims "No accounts" app-wide; the group-scoped promise stays

## Blocked by

None - can start immediately

## Comments

**Claude (2026-07-15):** Implemented and verified end-to-end against a local PocketBase.

- New `AccountSheet` off the Home footer row: editable profile name (saves on blur) and photo (tap the avatar; PocketBase's stock `users.avatar` field — no migration needed), live balance with the pack-purchase flow folded behind "Top up scans", the credit ledger as dotted-lead receipt lines, and sign-out. Signed out, the sheet is the sign-in flow plus a line on what an account is for.
- The sign-in form and pack purchase moved to shared components (`SignInForm`, `TopUp`); `CreditsSheet` now composes them and is back to its paywall/top-up role — the name field and sign-out are gone from it.
- **The sign-out bug was real.** The SDK's `authRefresh()` saves its response into the auth store whenever it lands, and the credits sheet fires `api.refreshUser()` on every open — so "open sheet → tap sign out" while that request was in flight silently re-signed the user in. `refreshUser` now refreshes via a raw send and applies the result only if the session it refreshed is still current; regression-tested in `src/api.test.ts`.
- Masthead softened to "A group is just a link · No sign-up to join".
