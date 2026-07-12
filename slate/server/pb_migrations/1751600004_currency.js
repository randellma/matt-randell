/// <reference path="../pb_data/types.d.ts" />

// Currency support. Every group has a group currency (what Balances and
// settle-up report in) and an optional default expense currency (what new
// expenses start as — e.g. EUR expenses on a trip settled in USD). Expenses
// and payments each carry their own currency plus `fx_cents`: the amount
// converted to the group currency, captured at save time and editable.
// Empty currency on any record means "the group currency" — the pre-currency
// records keep working untouched, and settings re-materializes the field
// when the group currency ever changes.

migrate(
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.add(
      new Field({ name: 'currency', type: 'text', required: false, max: 3 }),
      new Field({ name: 'expense_currency', type: 'text', required: false, max: 3 }),
    );
    app.save(groups);

    for (const name of ['expenses', 'payments']) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.add(
        new Field({ name: 'currency', type: 'text', required: false, max: 3 }),
        // Amount in group-currency minor units when `currency` differs from
        // the group currency; 0/unset otherwise.
        new Field({ name: 'fx_cents', type: 'number', required: false, onlyInt: true }),
      );
      app.save(collection);
    }
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.removeByName('currency');
    groups.fields.removeByName('expense_currency');
    app.save(groups);

    for (const name of ['expenses', 'payments']) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.removeByName('currency');
      collection.fields.removeByName('fx_cents');
      app.save(collection);
    }
  },
);
