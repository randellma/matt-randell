# Slate: groups follow the account across devices

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: 0022

## What to build

Signed in, your Groups appear on every device (ADR-0005). "Your groups" is **derived from Claims** — no new synced-list collection: an auth-gated server route returns the id, name, and share token of every group where the account holds a Claim. Revealing the token to a claimant is safe — they necessarily held it to claim, PIN-gated groups included.

The Home list becomes local ∪ claimed when signed in: locally-remembered groups as today, plus claimed groups this device has never opened. Opening a derived group works exactly like opening a shared link (it gets remembered locally), and since the account holds a claim there, identity resolves automatically — no picker. Groups opened but never identified-in don't follow you; that's accepted (being someone there is what membership means). Signing out keeps locally-remembered groups and drops only the derived ones; claims persist server-side untouched.

## Acceptance criteria

- [ ] An auth-gated route lists the signed-in account's claimed groups (id, name, token); unauthenticated requests get nothing
- [ ] Signing in on a fresh device shows all claimed groups on Home; opening one lands in the group already identified as the claimed member
- [ ] Locally-remembered groups and claimed groups merge without duplicates when a group is both
- [ ] A group where the account holds no claim does not sync
- [ ] Sign-out removes derived-only groups from Home, keeps locally-remembered ones, and changes nothing server-side
- [ ] A released claim (or removed member) drops the group from other devices' derived lists

## Blocked by

- 0022 (Claims are what sync derives from)
