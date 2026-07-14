/// <reference path="../pb_data/types.d.ts" />

// Optional accounts + scan credits (docs/adr/0004-scan-credits-optional-accounts.md).
// Group access stays link-only (ADR-0001); an account exists solely so scan
// credits have somewhere to live. Sign-in is a 6-digit emailed code — no
// passwords (pb_hooks/accounts.pb.js is the only writer of auth state).
//
//   users         — auth collection. `credits` is the live balance (server-
//                   managed; rules block client writes), `name` is the display
//                   name shown when your credits cover a group. The otp_*
//                   fields hold the emailed-code state, hidden like pin_*.
//   credit_events — append-only ledger behind `credits`: every welcome grant,
//                   purchase, and scan spend, so the balance is auditable and
//                   a payment provider can be reconciled against it later.
//   purchases     — one row per pack purchase. In beta status jumps straight
//                   to 'granted' with provider 'beta'; the status/provider/
//                   provider_ref fields are the groundwork for real payments
//                   (pending → paid via a webhook) without a schema change.
//   sponsorships  — "this group may draw from my credits". Scans then charge
//                   the sponsor's balance directly — no transfer, so backing
//                   out never strands credits in a group.
//
// receipts.credit_user records whose balance a scan will charge; the create
// hook (credits.pb.js) sets it and the OCR hook deducts only on success.

migrate(
  (app) => {
    // ── users ───────────────────────────────────────────────────────────────
    // PocketBase ships a default `users` auth collection; repurpose it (it
    // already has `name` and `avatar` fields) rather than fight the name.
    const users = app.findCollectionByNameOrId('users');
    users.listRule = null;
    users.viewRule = 'id = @request.auth.id';
    // Created only by the request-code route; no self-service create with
    // passwords — the emailed code is the only way in.
    users.createRule = null;
    // Owners may edit their profile; the balance and auth state are
    // server-only (hidden fields are unreachable anyway, credits gets an
    // explicit :isset guard).
    users.updateRule =
      'id = @request.auth.id && @request.body.credits:isset = false && @request.body.email:isset = false && @request.body.verified:isset = false && @request.body.password:isset = false';
    users.deleteRule = null;
    // Password sign-in stays off: users get a random unknown password and
    // authenticate only through the OTP routes. No SMTP is configured either,
    // so PocketBase's own auth emails (alerts, verification) stay off too.
    users.passwordAuth.enabled = false;
    users.authAlert.enabled = false;
    users.fields.add(
      // Live scan-credit balance. No min: a lost race between two
      // simultaneous scans may briefly overdraw; the ledger stays honest.
      new Field({ name: 'credits', type: 'number', onlyInt: true }),
      // Welcome grant given? Checked on first verified sign-in.
      new Field({ name: 'welcomed', type: 'bool', hidden: true }),
      new Field({ name: 'otp_hash', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'otp_salt', type: 'text', hidden: true, max: 64 }),
      new Field({ name: 'otp_attempts', type: 'number', hidden: true, onlyInt: true }),
      // Unix seconds, same pattern as groups.recovery_sent_at.
      new Field({ name: 'otp_expires', type: 'number', hidden: true, onlyInt: true }),
      new Field({ name: 'otp_sent_at', type: 'number', hidden: true, onlyInt: true }),
    );
    app.save(users);

    const groups = app.findCollectionByNameOrId('groups');
    const receipts = app.findCollectionByNameOrId('receipts');
    const tokenRule = 'group.t = @request.query.t';

    const userRef = (name, required) => ({
      name,
      type: 'relation',
      required,
      collectionId: users.id,
      maxSelect: 1,
      // Deleting an account (admin-only) takes its ledger/purchases along.
      cascadeDelete: required,
    });

    // ── purchases ───────────────────────────────────────────────────────────
    const purchases = new Collection({
      type: 'base',
      name: 'purchases',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      // Only the purchase route writes these.
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        userRef('user', true),
        { name: 'pack', type: 'text', required: true, max: 20 },
        { name: 'credits', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'price_cents', type: 'number', onlyInt: true },
        // Beta grants are born 'granted'; a real provider will walk
        // pending → paid (webhook) → granted, or failed.
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'paid', 'granted', 'failed'] },
        { name: 'provider', type: 'text', max: 30 },
        { name: 'provider_ref', type: 'text', max: 120 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_purchases_user ON purchases (`user`)'],
    });
    app.save(purchases);

    // ── credit_events ───────────────────────────────────────────────────────
    // The group/receipt/purchase refs are optional and non-cascading, so the
    // ledger outlives whatever it points at (a deleted group must not erase
    // the record of credits it consumed).
    const creditEvents = new Collection({
      type: 'base',
      name: 'credit_events',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        userRef('user', true),
        { name: 'delta', type: 'number', required: true, onlyInt: true },
        { name: 'reason', type: 'select', required: true, maxSelect: 1, values: ['welcome', 'purchase', 'scan', 'admin'] },
        { name: 'group', type: 'relation', collectionId: groups.id, maxSelect: 1, cascadeDelete: false },
        { name: 'receipt', type: 'relation', collectionId: receipts.id, maxSelect: 1, cascadeDelete: false },
        { name: 'purchase', type: 'relation', collectionId: purchases.id, maxSelect: 1, cascadeDelete: false },
        { name: 'note', type: 'text', max: 200 },
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE INDEX idx_credit_events_user ON credit_events (`user`)'],
    });
    app.save(creditEvents);

    // ── sponsorships ────────────────────────────────────────────────────────
    // Group members can see who covers the group (token rule); only the
    // signed-in sponsor can start or stop covering.
    const sponsorships = new Collection({
      type: 'base',
      name: 'sponsorships',
      listRule: tokenRule,
      viewRule: tokenRule,
      createRule: `@request.auth.id != '' && user = @request.auth.id && ${tokenRule}`,
      updateRule: null,
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          name: 'group',
          type: 'relation',
          required: true,
          collectionId: groups.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        userRef('user', true),
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_sponsorships_group_user ON sponsorships (`group`, `user`)',
      ],
    });
    app.save(sponsorships);

    // ── receipts.credit_user ────────────────────────────────────────────────
    receipts.fields.add(
      new Field({
        name: 'credit_user',
        type: 'relation',
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    // Clients never pick whose credits to burn — the create hook does.
    receipts.createRule = `${tokenRule} && @request.body.credit_user:isset = false`;
    receipts.updateRule = `${tokenRule} && @request.body.credit_user:isset = false`;
    app.save(receipts);
  },
  (app) => {
    const receipts = app.findCollectionByNameOrId('receipts');
    receipts.fields.removeByName('credit_user');
    receipts.createRule = 'group.t = @request.query.t';
    receipts.updateRule = 'group.t = @request.query.t';
    app.save(receipts);
    for (const name of ['sponsorships', 'credit_events', 'purchases']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    // users is PocketBase's stock collection — strip our fields, keep it.
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['credits', 'welcomed', 'otp_hash', 'otp_salt', 'otp_attempts', 'otp_expires', 'otp_sent_at']) {
      users.fields.removeByName(name);
    }
    users.passwordAuth.enabled = true;
    app.save(users);
  },
);
