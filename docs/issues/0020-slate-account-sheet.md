# Slate: account sheet off the Home footer

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: none

## What to build

Give the Account a home (ADR-0005). The Home footer row that today reads "Receipt scans · N left" / "Receipt scans · sign in" becomes the account entry point: signed in it shows your avatar, profile name (or email if nameless), and scan balance; signed out it invites sign-in. Tapping it opens a new **Account sheet** (same bottom-drawer idiom as the existing sheets, receipt-themed):

- **Profile**: editable display name and photo. This is where the profile name now lives — remove the "Your name — shown when your scans cover a group" field from the credits sheet.
- **Scan Credits**: current balance, a top-up action (reusing the existing pack-purchase flow), and purchase/scan history from the credit ledger.
- **Sign out**: works, verifiably — there's a suspected bug where signing out from the credits sheet doesn't take; reproduce or rule it out, and fix it if real.
- **Signed out**: the sheet is the sign-in flow plus a line on what an account is for.

The credits sheet slims back down to its paywall/top-up moments inside groups. Also soften the Home masthead's "No accounts · No sign-ups" line — still true for Groups, no longer true globally — to something group-scoped.

## Acceptance criteria

- [ ] Home footer row shows avatar + name + balance when signed in, a sign-in invitation when not; both open the Account sheet
- [ ] Profile name and photo are editable in the sheet and persist; the credits sheet no longer asks for a name
- [ ] The sheet shows the live balance, a working top-up, and a readable history of credit events (grants, purchases, scans)
- [ ] Sign out from the sheet returns the whole app to a signed-out state (footer row, group settings, scan cards all reflect it); the suspected sign-out bug is confirmed fixed or ruled out
- [ ] Signed out, the sheet offers the sign-in flow
- [ ] The Home masthead no longer claims "No accounts" app-wide; the group-scoped promise stays

## Blocked by

None - can start immediately
