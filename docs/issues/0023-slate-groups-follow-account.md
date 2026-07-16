# Slate: groups follow the account across devices

**Type**: AFK
**Status**: complete
**Blocked by**: 0022

## What to build

Signed in, your Groups appear on every device (ADR-0005). "Your groups" is **derived from Claims** — no new synced-list collection: an auth-gated server route returns the id, name, and share token of every group where the account holds a Claim. Revealing the token to a claimant is safe — they necessarily held it to claim, PIN-gated groups included.

The Home list becomes local ∪ claimed when signed in: locally-remembered groups as today, plus claimed groups this device has never opened. Opening a derived group works exactly like opening a shared link (it gets remembered locally), and since the account holds a claim there, identity resolves automatically — no picker. Groups opened but never identified-in don't follow you; that's accepted (being someone there is what membership means). Signing out keeps locally-remembered groups and drops only the derived ones; claims persist server-side untouched.

## Acceptance criteria

- [x] An auth-gated route lists the signed-in account's claimed groups (id, name, token); unauthenticated requests get nothing
- [x] Signing in on a fresh device shows all claimed groups on Home; opening one lands in the group already identified as the claimed member
- [x] Locally-remembered groups and claimed groups merge without duplicates when a group is both
- [x] A group where the account holds no claim does not sync
- [x] Sign-out removes derived-only groups from Home, keeps locally-remembered ones, and changes nothing server-side
- [x] A released claim (or removed member) drops the group from other devices' derived lists

## Blocked by

- 0022 (Claims are what sync derives from)

## Comments

**2026-07-15 (agent)** — Implemented:

- `GET /api/divvy/account/groups` (`server/pb_hooks/accounts.pb.js`): 401 signed out; otherwise `{groups: [{id, name, t}]}` for every group where the account holds a claim on a non-`removed` member. Derived per request from `members.user`, so a released claim or removed member drops out by construction; a group deleted under a dangling claim is skipped.
- `DivvyApi.listClaimedGroups()` (`web/src/api.ts`) and `mergeGroups(local, claimed)` (`web/src/identity.ts`): Home renders local ∪ claimed — local entries first with their order and picked identities intact, derived-only groups appended. A group in both stays one row, adopting the server's token and name (authoritative — a PIN toggle elsewhere rotates the token, a rename elsewhere changes the name). Derived rows are never written to localStorage; opening one goes through the normal shared-link path (`Group.tsx` remembers it and the existing claim auto-identify resolves who you are, no picker).
- Sign-out already only clears the auth store, so the derived rows vanish with the session (`useClaimedGroups` empties on `user == null`) while `divvy.groups` and the server are untouched.

Verification: `npm run typecheck` and `npm test` pass (98 tests, incl. new `claimed-groups.test.ts` covering the merge semantics and the authed route call); signed-out Home exercised in the browser against the dev server — local list unchanged, no derived fetch, no console errors. The server route itself was not exercised against a live PocketBase — no binary available in this environment — so the signed-in fresh-device flow should get a once-over after the next deploy.
