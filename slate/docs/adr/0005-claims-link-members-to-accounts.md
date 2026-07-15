# Claims: a member may link to an account; groups sync by claim

---
Status: accepted — amends [ADR-0001](0001-no-accounts-link-token-access.md) (claimed members leave everyone else's identity picker — the rest of "anyone can act as any member" holds) and [ADR-0004](0004-scan-credits-optional-accounts.md) (accounts now carry a profile and your groups, not credits alone; custom OTP routes are replaced by PocketBase-native auth)
---

Signing in should mean something inside a group. A **claim** is an optional link from a member to an account (`members.user`), settable only by that signed-in account. Wherever you hold a claim you *are* that member: the "who are you?" screen is skipped, your identity is durable, and "your groups" on any signed-in device is derived from your claims — an auth-gated route returns the id, name, and token of every group where you hold one. Claims are **soft**: a claimed member disappears from other people's identity picker and wears a badge, and nothing else changes — anyone can still record or fix expenses involving them, exactly as ADR-0001 intends.

## Why

- **Soft, not enforced.** Identity was always a device-local convenience, "never a security boundary" — hardening claims would break grandma-fixes-the-typo, add lockout scenarios (unreachable account, stuck group), and buy protection the threat model doesn't ask for. The picker is where mistaken identity actually happens, so the picker is what a claim fixes.
- **Sync derives from claims — no synced-groups table.** A separate per-account group list would be a second source of truth that drifts (claim released but row remains, member deleted but row points at it). "Groups where I hold a claim" cannot drift. Corollary accepted: a group you opened but never picked an identity in doesn't follow you — being someone there is what membership means.
- **Revealing the token to a claimant is safe**: they necessarily held it to claim (PIN groups included — the PIN was passed once, same as the device's own localStorage).
- **Claiming is one tap and never renames.** Signed in, tapping a placeholder on the join screen claims it; existing local identities are auto-claimed on next open (the device already asserted "this is me"; a mis-claim is released from the member screen). The group decides what it calls you: display precedence is claimed member name → account profile name → masked email. Claiming a photo-less member copies the profile photo once; after that it's group-editable like any member photo.
- **Native auth over hand-rolled.** The custom OTP routes predate us noticing PocketBase ≥0.23 ships OTP natively; we migrate to `requestOTP`/`authWithOTP` (keeping a thin hook to auto-create accounts on first contact and deliver mail via Resend) and enable Google via the native OAuth2 provider, which also gives profile name/photo and links to an existing account by verified email. Facebook is deferred — Meta's app review isn't worth it until someone asks.

## Decisions of record

- One claim per account per group; only the account itself can set or release `members.user` (server-enforced), and a member already claimed by someone else falls back to the picker.
- Creating a group signed-in pre-adds you as a claimed member named from your profile; the per-account "name shown when covering" field in the credits sheet is removed.
- Sponsoring still requires only token + auth — no claim needed to cover a group; the display-name precedence covers the claim-less sponsor.
- Signing in from "Sign in to cover" returns to the settings card with covering one explicit tap away; the top-up view appears only at zero balance.
- Sign-out keeps locally-remembered groups and drops only the derived ones; claims persist server-side untouched.
- Account management lives in a sheet off the Home footer row; the credits sheet slims back down to sign-in/top-up moments.

## Rejected alternatives

- **Hard claims** (auth-gated edits to claimed members or their expenses): breaks the trust posture for no modeled threat.
- **A synced `account_groups` collection**: drift-prone mirror of what claims already encode.
- **Profile name overriding member names**: claiming would visibly rename people and steal the group's right to call you "Dad".
- **Confirm-before-claim dialogs**: a prompt per group per device to guard against a rare mis-claim that is one tap to undo.
