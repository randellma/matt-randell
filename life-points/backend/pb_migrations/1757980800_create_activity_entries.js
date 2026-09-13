migrate(
  (app) => {
    const games = app.findCollectionByNameOrId('games');
    const accounts = app.findCollectionByNameOrId('accounts');
    const activities = app.findCollectionByNameOrId('activities');
    const categories = app.findCollectionByNameOrId('categories');
    const gameRule = '@request.auth.game != "" && game = @request.auth.game';

    const entries = new Collection({
      type: 'base',
      name: 'activity_entries',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'relation', name: 'account', required: true, maxSelect: 1, collectionId: accounts.id, cascadeDelete: true },
        { type: 'text', name: 'occurredOn', required: true, min: 10, max: 10, pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
        { type: 'number', name: 'points', required: true, min: 1, onlyInt: true },
      ],
      indexes: [
        'CREATE INDEX idx_activity_entries_game_date ON activity_entries (game, occurredOn)',
      ],
    });
    app.save(entries);

    const items = new Collection({
      type: 'base',
      name: 'activity_entry_items',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'relation', name: 'entry', required: true, maxSelect: 1, collectionId: entries.id, cascadeDelete: true },
        { type: 'relation', name: 'activity', required: true, maxSelect: 1, collectionId: activities.id },
        { type: 'relation', name: 'category', required: true, maxSelect: 1, collectionId: categories.id },
        { type: 'text', name: 'activityName', required: true, max: 120 },
        { type: 'text', name: 'categoryName', required: true, max: 80 },
        { type: 'number', name: 'points', required: true, min: 1, max: 10000, onlyInt: true },
        { type: 'text', name: 'categoryColor', required: true, max: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
        { type: 'text', name: 'categoryPlantFamily', required: true, max: 40 },
      ],
      indexes: ['CREATE INDEX idx_activity_entry_items_entry ON activity_entry_items (entry)'],
    });
    app.save(items);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('activity_entry_items'));
    app.delete(app.findCollectionByNameOrId('activity_entries'));
  },
);
