# No accounts: a group link is the only credential

---
Status: accepted — amended by [ADR-0003](0003-optional-group-pin.md) (optional per-group PIN on joining), [ADR-0004](0004-scan-credits-optional-accounts.md) (optional accounts exist, but only to hold scan credits; group access is still link-only), and [ADR-0005](0005-claims-link-members-to-accounts.md) (a claimed member leaves everyone else's identity picker; group access is still link-only)
---

Divvy has no user accounts, no login, and no roles. Each group has a random secret token generated at creation; the share link embeds it (`/#/g/<id>/<token>`). The PWA keeps the token in localStorage and attaches it as a `?t=` query param; PocketBase collection rules (`group.t = @request.query.t`) gate every read and write. Anyone holding the link can act as any member.

## Why

The whole point of the app is that friends and family actually use it. Every sign-up screen loses users; password resets lose more. The threat model is trivial — a household ledger among people who share dinners — so the security budget goes to zero and the friction budget goes with it. "Being" someone only shortcuts data entry (defaulting *paid by*); there is nothing to steal but the chore of typing.

This extends the pattern already proven by Inventory (shared secret in the URL, [inventory ADR-0005](../../../inventory/docs/adr/0005-pocketbase-on-home-server.md)) from one global secret to a per-group token, so a link leak exposes one group, not everything.

## Decisions of record

- **Token in the URL hash**, not the path or query, so it never appears in server or CDN request logs for page loads. API requests do carry it as a query param — accepted; the API is our own PocketBase.
- **Group creation is open** (public create rule). Anyone who finds the API could create junk groups; they can't list or read anyone else's. Accepted for household scale — PocketBase rate limiting can be enabled later if abuse appears.
- **Identity is device-local**: "who you are" lives in localStorage per group and is freely switchable. It is a data-entry default, not authentication.
- **No deletes of groups via API** (admin only) — the worst a leaked link allows is messing up one group's entries, not erasing it.
- **Receipt images are public-by-URL** (unguessable PocketBase file paths). Photos of restaurant receipts are not precious; same stance as Inventory's item photos.

## Rejected alternatives

- **Magic-link email auth**: still friction (email round trip), still a database of personal data, no meaningful gain for this threat model.
- **Per-member PINs or edit locks**: turns "grandma fixes the typo in your expense" from a feature into a support call.
