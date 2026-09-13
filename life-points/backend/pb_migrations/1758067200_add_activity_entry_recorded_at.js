migrate(
  (app) => {
    const entries = app.findCollectionByNameOrId('activity_entries');
    entries.fields.add(new TextField({
      name: 'recordedAt',
      required: true,
      min: 20,
      max: 30,
      pattern: '^\\d{4}-\\d{2}-\\d{2}T.*Z$',
    }));
    app.save(entries);
  },
  (app) => {
    const entries = app.findCollectionByNameOrId('activity_entries');
    entries.fields.removeByName('recordedAt');
    app.save(entries);
  },
);
