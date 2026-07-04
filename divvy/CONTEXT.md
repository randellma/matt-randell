# Divvy

Splitting shared expenses among friends and family with as little friction as possible. No accounts, no roles, no sign-up: a Group is a link, and holding the link is membership. The design bias is always toward fewer taps when logging an expense — trust is assumed (these are people who share dinners), accuracy is not (pennies must add up).

## Language

**Group**:
A shared ledger of Expenses and Payments among a set of Members, identified by its share link. Created in one step; joined by opening the link.
_Avoid_: Household, party, event

**Member**:
A name inside a Group. Not an account — just a label people attach expenses to. Anyone holding the link may add themselves as a Member or act as any existing Member.
_Avoid_: User, account, participant (participant means something narrower — see Split)

**Identity**:
The Member a device has picked as "you" for a Group, stored locally. Purely a convenience default for *paid by* — never a security boundary.
_Avoid_: Login, session

**Expense**:
Money one Member paid that others owe shares of. Has a description, an amount, a payer, a date, and exactly one Split.
_Avoid_: Transaction, bill (a bill is the paper thing a Receipt is a photo of)

**Split**:
How an Expense's amount divides among Members. One of four modes: **Evenly** (participants share equally), **Percent**, **Shares** (weights), or **Itemized** (from a Receipt). Whatever the mode, the stored result is the same shape: per-Member amounts in integer cents that sum exactly to the Expense amount.
_Avoid_: Breakdown, allocation, division

**Receipt**:
A photo of an itemized bill, parsed by OCR into line Items plus tax/tip/total. Exists so an Itemized Split can be assembled by tapping rather than typing.
_Avoid_: Scan, upload

**Item**:
One purchasable line on a Receipt (or added by hand). Assigned to one or more Members; an Item with several assignees is shared equally among them. Discounts are Items with negative amounts.
_Avoid_: Product, entry, line (alone)

**Extras**:
The gap between an Expense's total and the sum of its Items — tax, tip, and fees. Divided among Members in proportion to their Item subtotals: the person who ordered the steak carries more of the tip than the person who had a side.
_Avoid_: Overhead, surcharge

**Party**:
Two or more Members linked to settle as one wallet — typically a couple or family. Expenses and Splits stay per-Member; only Balances and settle-up aggregate by Party, so "my wife owes me" never appears at group level while the internal breakdown stays visible for the Party to square up privately. Linking and unlinking is free-form and reversible.
_Avoid_: Household (in code), team, subgroup

**Unit**:
What settle-up operates over: a Party, or a solo Member. Every Member belongs to exactly one Unit at any moment.
_Avoid_: Entity, wallet (colloquially fine in UI copy, not in code)

**Balance**:
A Member's net position in a Group: what they've paid minus what they owe, across all Expenses and Payments. Positive means the group owes them. The Balances tab shows Balances aggregated by Unit, with the per-Member breakdown nested inside a Party.
_Avoid_: Debt, credit, tab

**Payment**:
A recorded settle-up transfer between two Members, outside the app (cash, Venmo, whatever). Recording it is bookkeeping; Divvy never moves money.
_Avoid_: Settlement (the *suggestion* is a settlement; the recorded fact is a Payment), transfer

## Invariants

- Every Split's per-Member amounts are integer cents summing exactly to the Expense amount — remainder pennies go to the largest fractional shares.
- Balances across a Group always sum to zero — per Member and per Unit alike; linking Members into a Party never creates or destroys money.
- A Payment between two Members of the same Party changes their internal breakdown but not the Party's group-level Balance.
- OCR output is a draft: an Itemized Split is never saved until a human has assigned every Item.

## Example dialogue

> **Matt:** "Sarah's phone doesn't have the app — can she still add the pizza night expense?"
> **Claude:** "Yes. She opens the Group link in a browser, taps her name (or adds it) as her **Identity**, and logs the **Expense**. If she can't be bothered, anyone else in the Group can add it and set *paid by* to Sarah — acting as another Member is allowed by design."

## Flagged ambiguities

- **Member vs Identity**: a Member exists in the Group's data; an Identity is one device's local claim to be that Member. Two phones can both "be" Sarah; nothing breaks.
- **Settlement vs Payment**: the Balances tab *suggests* settlements (a minimal set of transfers); only when someone taps "mark paid" does it become a recorded Payment.
- **Receipt total vs Expense amount**: the Expense amount is authoritative (editable); the Receipt's printed total merely pre-fills it. Extras are derived from the difference with the Items, not from the printed tax/tip lines.
