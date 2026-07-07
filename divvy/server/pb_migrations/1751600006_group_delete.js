/// <reference path="../pb_data/types.d.ts" />

// Let anyone holding the link token delete the group — same trust model as
// every other mutation. Members, expenses, payments, and receipts cascade
// via their `group` relation.

migrate(
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.deleteRule = 't = @request.query.t';
    app.save(groups);
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.deleteRule = null;
    app.save(groups);
  },
);
