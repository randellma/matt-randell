# AI assistance is draft-only and never touches Facebook autonomously

All AI involvement in selling stays human-in-the-loop. The agent generates **Listing drafts** (price range, rationale, post template) and, later, suggested replies to buyer messages — but a human always posts, sends, and commits. Nothing automated logs into Facebook, publishes a listing, messages a buyer, or agrees to a price or pickup.

This is a deliberate boundary, not a temporary limitation, because the obvious "just automate the posting and haggling" path is a trap:

- **There is no personal Marketplace/Messenger API.** Facebook's Commerce/Graph messaging APIs are for business Shops/Pages, not peer-to-peer Marketplace. Any "agent that posts" would have to drive the real logged-in web UI.
- **The account at risk is the owner's real Facebook account.** Automated posting/messaging is exactly what Facebook's anti-automation systems restrict or ban.
- **Autonomous negotiation with strangers is a real-world liability** — scams, lowballs, auto-committing to prices and meetups, meetup safety.
- **No autonomous financial or commitment actions**, full stop.

The Phase-2 reply helper (a Chrome-extension button that reads the visible thread and drafts a reply you paste) respects this boundary: it is user-initiated and the human still hits send.

This ADR exists so a future reader — or a future agent — doesn't "helpfully" try to make posting autonomous without re-confronting these reasons.
