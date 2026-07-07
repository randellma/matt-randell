# Optional group PIN: joining can require more than the link

---
Status: accepted — amends [ADR-0001](0001-no-accounts-link-token-access.md)
---

A group may turn on a 4–6 digit PIN. Its share link then carries only the
group id (`/g/<id>` — no token), and a custom PocketBase route trades a
correct PIN for the group token, which the device stores exactly as before.
Ten consecutive wrong PINs lock joining; an optional recovery email can
receive the group's access link from the join screen ("forgot the PIN?").
Groups without a PIN behave exactly as ADR-0001 describes — this is opt-in
per group, and the token remains the only credential once you're in.

## Why

ADR-0001's threat model (nothing to steal but the chore of typing) still
holds for most groups, but some groups want the link to be shareable in a
big chat without everyone in that chat being *in* — the PIN moves the "who
belongs here" boundary from "holds the link" to "was told the PIN". The
friction budget stays tiny: one 4–6 digit entry per device, ever.

## Decisions of record

- **The PIN gates joining, not use.** A correct PIN returns the group token;
  from there the device is a member-holder like any other. No per-request
  PIN checks, no sessions, no roles.
- **Enabling the PIN rotates the token.** Links shared before the PIN went
  on would otherwise bypass it forever. Every other device's stored token
  dies with the rotation, so existing members re-enter through the PIN gate
  once — recoverable by design, since the group shares the PIN out-of-band
  anyway. Disabling the PIN does not rotate.
- **PIN state lives on the group in hidden fields** (`pin_hash`/`pin_salt`/
  `pin_attempts`/`recovery_email`/`recovery_sent_at`), unreadable and
  unwritable through the record API; only the custom routes in
  `pb_hooks/group_security.pb.js` touch them. The visible `pin_on` flag (for
  the PWA to pick the link form) and `t` get `:isset` guards in the
  collection rules so the open update rule can't flip them.
- **sha256(salt:pin), not bcrypt.** A 4–6 digit PIN is offline-crackable
  under any hash, so the digest only has to be non-reversible-at-a-glance;
  the real defenses are the attempt lock and the DB staying private (a DB
  leak already surrenders every group token — same stance as ADR-0001).
- **Lockout is a per-group counter**: 10 consecutive failures lock joining
  for everyone new; any member can unlock from settings, and changing the
  PIN also resets it. No IP tracking, no time-based backoff — household
  scale.
- **Recovery emails the full access link** (hash form, so the token stays
  out of request logs) to the address stored on the group, via the Resend
  HTTP API — same env-var pattern as the OCR key (`RESEND_API_KEY`). The
  route is deliberately unauthenticated (the caller is exactly the person
  without a credential), replies only with a masked address, and enforces a
  5-minute per-group cooldown. Email ≈ token custody: whoever set the
  recovery address is trusted with the group by definition.
- **PIN groups reveal name + avatar pre-join** (via the public security
  route, keyed by the unguessable group id) so the join screen and the
  link-preview card can say what you're joining. Token-only groups reveal
  nothing without the token, as before.

## Rejected alternatives

- **PIN checked on every request**: turns a shared ledger into a login
  system; the token already is the session.
- **Keeping old links valid after enabling the PIN**: silently defeats the
  feature — "PIN-protected" would mean "except for anyone who ever saw the
  link".
- **bcrypt/argon2 for the PIN**: theater at 10⁴–10⁶ combinations; adds a Go
  dependency question in the JSVM for no attacker-visible difference.
- **PocketBase SMTP mailer**: works (Resend has an SMTP relay), but the
  config would live in the PB database instead of code/env; the HTTP API
  keeps the whole setup reproducible from the repo plus one env var.
