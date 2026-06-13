# Inventory

Capturing household items that Matt and his wife want out of the house, and tracking how each one leaves. The capture step is deliberately near-trivial (do it while walking around on a phone); the decisions happen later. The implementation is intended to stay minimal — a capture automation feeding a store, with a viewer as an optional read layer.

## Language

**Item**:
A single physical thing being decluttered, captured as a photo plus a name. The unit everything else hangs off.
_Avoid_: Thing, product, listing, entry

**Capture**:
The act of recording an Item while walking around — a photo, a name, and optionally a Disposition if already known. Intentionally minimal.
_Avoid_: Add, create, log

**Disposition**:
The decision about how an Item leaves the house. One of **Sell**, **Give away**, **Donate**, or **Junk**. May be set at Capture time if known, otherwise assigned at Review.
_Avoid_: Category, type, action, outcome

- **Sell**: Listed for money (e.g. Facebook Marketplace). The only Disposition the AI experimentation ever touches.
- **Give away**: Handed to a specific recipient for free, via a Facebook Buy Nothing group.
- **Donate**: Dropped at a local thrift shop. No specific recipient.
- **Junk**: Thrown away — binned, recycled, or taken to the dump. Leaves the house as waste; no recipient, no money.

**Viewer**:
The read-only tab in the PWA that lists all Items with their lifecycle badges, Dispositions, and thumbnails. Does not write anything — Review stays in the Sheet.
_Avoid_: List, dashboard, browse

**Review**:
Matt and his wife looking at Captured Items and assigning each a Disposition (and any notes).
_Avoid_: Triage, sort

**Listing draft**:
For a **Sell** Item, the generated copy-paste-ready Marketplace post (title + description) plus a suggested price range and a one-line rationale. Always reviewed and posted by a human — never published automatically.
_Avoid_: Listing, post, ad (when referring to the live Marketplace listing, which is a separate, manual thing)

## Lifecycle

An Item moves through three states:

- **Captured** — photo + name recorded. May already have a Disposition, but no decision is required yet.
- **Reviewed** — a Disposition has been assigned.
- **Handled** — the Item has left the house (sold / given / donated / junked) and drops off the active list.

## Relationships

- An **Item** has exactly one **Disposition** once Reviewed; that Disposition determines how it becomes **Handled**.
- Only **Sell** Items get a **Listing draft**. Drafting is automated; posting and any buyer conversation stay manual and human-judged.

## Example dialogue

> **Matt:** "I just snapped a photo of the old blender — is that Reviewed?"
> **Claude:** "No, it's **Captured**. It only becomes **Reviewed** once you and your wife give it a **Disposition** — Sell, Give away, or Donate. If you already tagged it 'Donate' while capturing, it's still just Captured-with-a-Disposition until you've actually decided together."

## Flagged ambiguities

- "Give away" vs "Donate" are deliberately separate Dispositions: **Give away** is a free handoff to a known recipient via a Buy Nothing group; **Donate** is dropped at a thrift shop with no recipient.
- "Donate" vs "Junk" are distinct: **Donate** is a still-usable Item given to a thrift shop; **Junk** is thrown away as waste (bin / recycling / dump) because it has no further value.
