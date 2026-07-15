# Scan credits on optional accounts; groups may draw from a sponsor

---
Status: accepted — amends [ADR-0001](0001-no-accounts-link-token-access.md) (accounts exist, but only for scan credits; group access is unchanged) and [ADR-0002](0002-receipt-ocr-via-claude.md) (scans are now metered); amended by [ADR-0005](0005-claims-link-members-to-accounts.md) (accounts also carry a profile and your groups; custom OTP replaced by PocketBase-native auth)
---

Receipt scanning is Slate's one costly feature (a Claude API call per scan) and its monetization path. Scans are metered by **scan credits** held on an optional **account**: a `users` auth record signed into with a 6-digit emailed code — no passwords. A scan spends one credit, resolved at upload time: the scanner's own balance first, otherwise the balance of a group **sponsor** (an account that opted to cover the group), otherwise the scan is refused with a top-up prompt. Everything else in Slate remains account-free.

## Why

- **The link stays the only credential for groups** (ADR-0001 holds). An account gates nothing but paid scanning; a member with no account loses no splitting features and can still scan on a sponsor's credits.
- **Emailed codes, not passwords**: the account guards a few dollars of scans, not money movement. A code each sign-in matches the PIN posture (lockout over cryptography) and reuses the existing Resend infrastructure — no password resets, no stored secrets worth stealing.
- **Sponsorship draws directly from the sponsor's balance — no transfers.** "Cover this group" is a flag, not a payment: reversible any time, never strands credits inside a group, and matches the social gesture ("I bought a pack for the trip"). Draw order: the scanner's own credits first (spending yours is never a surprise), then the sponsor with the largest balance (whoever topped up carries it, and the group scans for the longest).
- **Charge on success only.** The credit is deducted when parsing succeeds; a failed parse costs nothing. We eat the occasional API cost of a failure — cheaper than support conversations about burned credits.
- **Ledger + balance, not balance alone.** `users.credits` is the live number; every change writes a `credit_events` row (welcome grant, purchase, scan, admin). The ledger is what a payment provider reconciles against later.
- **Beta: purchases are free grants.** The purchase route records a `purchases` row (`status: granted`, `provider: beta`) and credits instantly. A real provider slots into the same row (`pending → paid → granted` via webhook) without schema changes. First verified sign-in grants 5 credits.

## Decisions of record

- Scan requests are receipts created with `status: pending`; plain photo attachments (`status: done`) stay free and account-less. The create hook stamps `credit_user` (whose balance the scan will charge) server-side; clients cannot set it.
- A blocked scan fails at creation with HTTP 402 — the client keys the paywall off the status code.
- Two simultaneous scans can race the last credit and briefly overdraw a balance; accepted at this scale, and the ledger stays honest.
- Sponsors are visible to the whole group (token rule) by display name — set once at first top-up, falling back to a masked email.
- OTP codes: 6 digits, 10-minute expiry, 5 attempts, 60s resend cooldown, single-use.
- PocketBase's stock `users` collection is repurposed (password auth disabled) rather than replaced.

## Rejected alternatives

- **Transferring credits into a group pool**: second balance to display, strands credits when plans change, and "whose credits paid for this?" gets murkier, not clearer.
- **Charging the group's members pro-rata**: turns a two-dollar convenience into an accounting feature inside an accounting app.
- **Anonymous device-local credits**: vanish with localStorage, can't be topped up across devices, and make purchases refund-hostile.
- **Password or OAuth sign-in**: heavier than the value protected; OAuth can layer on later without changing the token flow.
