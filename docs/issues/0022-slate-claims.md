# Slate: Claims — members link to accounts

**Type**: AFK
**Status**: complete
**Blocked by**: none

## What to build

Implement **Claims** per ADR-0005: an optional link from a Member to an Account (`members.user`). Claims are **soft** — a social marker, never a security boundary. Server rules enforce only who may hold one: an account can set or release the link solely to itself, one claim per account per group, and a member claimed by someone else can't be re-claimed. Everything else about a claimed member stays group-editable, and anyone can still record or fix expenses involving them (grandma-fixes-the-typo holds).

Where claims happen, all one-tap:

- **"Who are you?" join screen, signed in**: tapping an unclaimed member claims it as you (identity + claim together); "add yourself" prefills your profile name and creates the member already claimed. Members claimed by others render badged and disabled.
- **Already claimed here**: the join screen is skipped entirely — you're auto-identified as your claimed member.
- **Creating a group signed in**: you're pre-added as a claimed member named from your profile — no typing your own name; the join screen never appears.
- **Existing local identity**: opening a group where this device already picked an identity silently claims that member (the device already asserted "this is me"); if someone else claimed it meanwhile, fall back to the picker.
- **Release**: from the member's detail screen, the linked account (only) can release its claim — the escape hatch for a mis-tap.

Claiming never renames the member; claiming a photo-less member copies the profile photo onto it once (group-editable thereafter). Claimed members show a signed-in badge wherever members are displayed; *paid-by* and split pickers are unchanged — only the identity picker excludes them.

## Acceptance criteria

- [x] `members` gains an account link with server rules: only the signed-in account can set/release it to itself, one claim per account per group; a working down-migration
- [x] Signed in on the join screen: tapping an unclaimed member claims + identifies in one tap; others' claimed members are badged and un-tappable; "add yourself" creates an already-claimed member prefilled from the profile name
- [x] Holding a claim in a group skips the join screen and auto-identifies on any signed-in device
- [x] Creating a group while signed in pre-adds you claimed and identified, named from your profile
- [x] Opening a group with an existing local identity while signed in auto-claims that member; falls back to the picker if it's already claimed by another account
- [x] Claiming never changes the member's name; a photo-less member gets the profile photo copied once
- [x] The linked account can release its claim from the member screen; nobody else can
- [x] Paid-by/split pickers still list claimed members; signed-out behavior is unchanged everywhere

## Blocked by

None - can start immediately
