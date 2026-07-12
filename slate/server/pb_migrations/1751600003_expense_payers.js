/// <reference path="../pb_data/types.d.ts" />

// Multiple payers: an expense can be fronted by more than one member (two
// people split the bill at the till). `payers` stores [{member, cents}]
// summing to amount_cents. `paid_by` stays required and holds the largest
// payer, so existing records and balance fallbacks keep working; clients
// prefer `payers` when present.

migrate(
  (app) => {
    const expenses = app.findCollectionByNameOrId('expenses');
    expenses.fields.add(
      new Field({
        name: 'payers',
        type: 'json',
        required: false,
        maxSize: 50000,
      }),
    );
    app.save(expenses);
  },
  (app) => {
    const expenses = app.findCollectionByNameOrId('expenses');
    expenses.fields.removeByName('payers');
    app.save(expenses);
  },
);
