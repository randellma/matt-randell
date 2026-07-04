/// <reference path="../pb_data/types.d.ts" />

// Divvy schema. Access model: no accounts. Every group has a `token`; the
// share link carries it and the PWA sends it as `?t=` on every request.
// Collection rules check the token against the record's group — same pattern
// as inventory's shared secret, but scoped per group.

migrate(
  (app) => {
    // ── groups ──────────────────────────────────────────────────────────────
    const groups = new Collection({
      type: 'base',
      name: 'groups',
      // No listing: you can only fetch a group you hold the token for.
      listRule: null,
      viewRule: 't = @request.query.t',
      // Anyone can create a group; that's the zero-friction entry point.
      createRule: '',
      updateRule: 't = @request.query.t',
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, max: 120 },
        // "t" not "token": PocketBase reserves ergonomic names nowhere, but the
        // rule `t = @request.query.t` keeps field and param visibly paired.
        { name: 't', type: 'text', required: true, min: 20, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(groups);

    const groupRef = () => ({
      name: 'group',
      type: 'relation',
      required: true,
      collectionId: groups.id,
      maxSelect: 1,
      cascadeDelete: true,
    });
    const tokenRule = 'group.t = @request.query.t';

    // ── members ─────────────────────────────────────────────────────────────
    const members = new Collection({
      type: 'base',
      name: 'members',
      listRule: tokenRule,
      viewRule: tokenRule,
      createRule: tokenRule,
      updateRule: tokenRule,
      deleteRule: tokenRule,
      fields: [
        groupRef(),
        { name: 'name', type: 'text', required: true, max: 60 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_members_group ON members (`group`)'],
    });
    app.save(members);

    const memberRef = (name, required) => ({
      name,
      type: 'relation',
      required,
      collectionId: members.id,
      maxSelect: 1,
      cascadeDelete: false,
    });

    // ── receipts ────────────────────────────────────────────────────────────
    // A receipt is uploaded first, parsed by the OCR hook, then an itemized
    // expense is built from it. Kept separate from expenses so parsing can
    // happen while the user is still assigning items.
    const receipts = new Collection({
      type: 'base',
      name: 'receipts',
      listRule: tokenRule,
      viewRule: tokenRule,
      createRule: tokenRule,
      updateRule: tokenRule,
      deleteRule: tokenRule,
      fields: [
        groupRef(),
        {
          name: 'image',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 15728640,
          // Claude's vision API accepts exactly these; the PWA re-encodes
          // photos (incl. HEIC) to JPEG before upload.
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'done', 'failed'] },
        { name: 'parsed', type: 'json', maxSize: 200000 },
        { name: 'error', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_receipts_group ON receipts (`group`)'],
    });
    app.save(receipts);

    // ── expenses ────────────────────────────────────────────────────────────
    const expenses = new Collection({
      type: 'base',
      name: 'expenses',
      listRule: tokenRule,
      viewRule: tokenRule,
      createRule: tokenRule,
      updateRule: tokenRule,
      deleteRule: tokenRule,
      fields: [
        groupRef(),
        { name: 'description', type: 'text', required: true, max: 200 },
        { name: 'amount_cents', type: 'number', required: true, onlyInt: true, min: 1 },
        memberRef('paid_by', true),
        { name: 'date', type: 'date', required: true },
        { name: 'split_mode', type: 'select', required: true, maxSelect: 1, values: ['even', 'percent', 'shares', 'items'] },
        // { entries: [{member, cents}], plus mode-specific editing state:
        //   parts (percent/shares) or items ([{label, cents, assignees}]) }
        { name: 'split', type: 'json', required: true, maxSize: 200000 },
        {
          name: 'receipt',
          type: 'relation',
          required: false,
          collectionId: receipts.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'notes', type: 'text', max: 1000 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_expenses_group ON expenses (`group`)'],
    });
    app.save(expenses);

    // ── payments ────────────────────────────────────────────────────────────
    const payments = new Collection({
      type: 'base',
      name: 'payments',
      listRule: tokenRule,
      viewRule: tokenRule,
      createRule: tokenRule,
      updateRule: tokenRule,
      deleteRule: tokenRule,
      fields: [
        groupRef(),
        memberRef('from_member', true),
        memberRef('to_member', true),
        { name: 'amount_cents', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'date', type: 'date', required: true },
        { name: 'note', type: 'text', max: 200 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_payments_group ON payments (`group`)'],
    });
    app.save(payments);
  },
  (app) => {
    for (const name of ['payments', 'expenses', 'receipts', 'members', 'groups']) {
      const collection = app.findCollectionByNameOrId(name);
      app.delete(collection);
    }
  },
);
