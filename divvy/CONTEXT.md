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
Money one or more Members paid that others owe shares of. Has a description, an amount, Payers, a date, and exactly one Split.
_Avoid_: Transaction, bill (a bill is the paper thing a Receipt is a photo of)

**Payer**:
A Member who fronted part (or all) of an Expense. Usually one; when several people split the bill at the till, each Payer records what they put in, defaulting to an even division of the total. Payer amounts are integer cents summing exactly to the Expense amount.
_Avoid_: Sponsor, creditor

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
Two or more Members linked to settle as one wallet — typically a couple or family. Expenses and Splits stay per-Member; only Balances and settle-up aggregate by Party, so "my wife owes me" never appears at group level while the internal breakdown stays visible for the Party to square up privately. Linking and unlinking is free-form and reversible. A Party may take a custom name ("The Randells"); by default it displays as its Members' names joined ("Matt & Sarah").
_Avoid_: Household (in code), team, subgroup

**Unit**:
What settle-up operates over: a Party, or a solo Member. Every Member belongs to exactly one Unit at any moment.
_Avoid_: Entity, wallet (colloquially fine in UI copy, not in code)

**Balance**:
A Member's net position in a Group: what they've paid minus what they owe, across all Expenses and Payments. Positive means the group owes them. The Balances tab shows Balances aggregated by Unit, with the per-Member breakdown nested inside a Party.
_Avoid_: Debt, credit, tab

**Payment**:
A recorded transfer between two Members, outside the app (cash, Venmo, whatever) — either a settlement suggestion marked paid, or any arbitrary amount recorded by hand. Recording it is bookkeeping; Divvy never moves money. Always recorded in the Group currency.
_Avoid_: Settlement (the *suggestion* is a settlement; the recorded fact is a Payment), transfer

**Group currency**:
The one currency Balances, settle-up, and group-level totals are reported in. Chosen at group creation (defaulting to the creator's locale); changing it later re-converts every Expense's and Payment's stored conversion at its own date. Old groups without one are USD.
_Avoid_: Base currency, home currency

**Expense currency**:
The currency an Expense was actually paid in — its amount, Payers, and Split all live in this currency's minor units. Defaults to the Group's *default expense currency* (settable for trips where spending ≠ settling) and is switchable per Expense.
_Avoid_: Local currency, original currency (in code)

**Conversion (fx)**:
A foreign-currency Expense or Payment stores `fx_cents`: its total in Group-currency minor units, prefilled from the ECB rate at the record's date and freely editable. Balances rescale the Split and Payer amounts proportionally to `fx_cents` — the rate is a prefill, the converted amount is the stored fact.
_Avoid_: Exchange (as a noun), rate (as the stored thing — the amount is stored, not the rate)

## Invariants

- Every Split's per-Member amounts are integers in the Expense currency's minor units, summing exactly to the Expense amount — remainder pennies go to the largest fractional shares. The same holds for Payer amounts.
- Balances across a Group always sum to zero — per Member and per Unit alike; linking Members into a Party never creates or destroys money. Converting a foreign Expense for Balances rescales credits and debits to the same `fx_cents`, so conversion never creates or destroys money either.
- Balances, settle-up, and Payments are Group-currency only; an Expense's own currency never leaks into the ledger.
- A Payment between two Members of the same Party changes their internal breakdown but not the Party's group-level Balance.
- OCR output is a draft: an Itemized Split is never saved until a human has assigned every Item.

## Example dialogue

> **Matt:** "Sarah's phone doesn't have the app — can she still add the pizza night expense?"
> **Claude:** "Yes. She opens the Group link in a browser, taps her name (or adds it) as her **Identity**, and logs the **Expense**. If she can't be bothered, anyone else in the Group can add it and set *paid by* to Sarah — acting as another Member is allowed by design."

## Flagged ambiguities

- **Member vs Identity**: a Member exists in the Group's data; an Identity is one device's local claim to be that Member. Two phones can both "be" Sarah; nothing breaks.
- **Settlement vs Payment**: the Balances tab *suggests* settlements (a minimal set of transfers); only when someone taps "mark paid" does it become a recorded Payment.
- **Receipt total vs Expense amount**: the Expense amount is authoritative (editable); the Receipt's printed total merely pre-fills it. Extras are derived from the difference with the Items, not from the printed tax/tip lines.
