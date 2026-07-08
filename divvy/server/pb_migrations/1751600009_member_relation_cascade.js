/// <reference path="../pb_data/types.d.ts" />

// Group deletion cascades via each collection's `group` relation
// (cascadeDelete: true), but PocketBase visits those cascaded collections in
// no guaranteed order. When it deletes a `members` record before the
// `expenses`/`payments` records that still point at it — via the required,
// non-cascading `paid_by`/`from_member`/`to_member` relations — the member
// delete is rejected with "part of a required relation reference" and the
// whole group delete 400s. Marking those relations cascadeDelete too closes
// the gap: whichever branch PocketBase visits first, deleting a member also
// takes its expenses/payments with it, same as deleting the group directly
// would. There's no standalone "remove member" feature yet, so this can't
// yet fire outside of a full group deletion.

migrate(
  (app) => {
    const expenses = app.findCollectionByNameOrId('expenses');
    expenses.fields.getByName('paid_by').cascadeDelete = true;
    app.save(expenses);

    const payments = app.findCollectionByNameOrId('payments');
    payments.fields.getByName('from_member').cascadeDelete = true;
    payments.fields.getByName('to_member').cascadeDelete = true;
    app.save(payments);
  },
  (app) => {
    const expenses = app.findCollectionByNameOrId('expenses');
    expenses.fields.getByName('paid_by').cascadeDelete = false;
    app.save(expenses);

    const payments = app.findCollectionByNameOrId('payments');
    payments.fields.getByName('from_member').cascadeDelete = false;
    payments.fields.getByName('to_member').cascadeDelete = false;
    app.save(payments);
  },
);
