# Slate: claim-aware sponsor display

**Type**: AFK
**Status**: complete
**Blocked by**: 0022

## What to build

Everywhere a Group sees an Account — sponsor names on the Receipt scans card, "Covered by …" copy, the scan card in the expense form — apply the display-name precedence from ADR-0005: **claimed Member's name in that group → Account profile name → masked email**. Wherever a sponsor holds a Claim, the group sees them by the name the group already calls them; the profile name is only the claim-less fallback. This replaces today's account-level display name logic (profile name → masked email) that ignored group membership.

Sponsoring itself is unchanged: token + auth only, no Claim required to cover a group.

## Acceptance criteria

- [x] A sponsor with a Claim in the group is shown by their claimed Member's name on the coverage card, in "Covered by …" copy, and on the expense form's scan card
- [x] A sponsor without a Claim falls back to profile name, then masked email — no behavior change for them
- [x] Renaming the claimed member updates what the group sees the sponsor as; releasing the claim falls back to the profile name
- [x] Covering a group still requires no Claim

## Blocked by

- 0022 (needs Claims to resolve the group-local name)
