migrate(
  (app) => {
    const games = app.findCollectionByNameOrId('games');
    const accounts = app.findCollectionByNameOrId('accounts');

    accounts.fields.getByName('playerName').required = false;
    accounts.fields.getByName('game').required = false;
    accounts.indexes.push(
      "CREATE UNIQUE INDEX idx_accounts_game_owner ON accounts (game) WHERE role = 'owner' AND game != ''",
    );
    app.save(accounts);

    const gameRule = '@request.auth.game != "" && game = @request.auth.game';
    const categories = new Collection({
      type: 'base',
      name: 'categories',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'text', name: 'name', required: true, max: 80 },
        { type: 'text', name: 'color', required: true, max: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
        { type: 'text', name: 'plantFamily', required: true, max: 40 },
        { type: 'number', name: 'sortOrder', required: true, min: 0, onlyInt: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_categories_game_order ON categories (game, sortOrder)'],
    });
    app.save(categories);

    const activities = new Collection({
      type: 'base',
      name: 'activities',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'relation', name: 'category', required: true, maxSelect: 1, collectionId: categories.id },
        { type: 'text', name: 'name', required: true, max: 120 },
        { type: 'number', name: 'points', required: true, min: 1, max: 10000, onlyInt: true },
        { type: 'number', name: 'sortOrder', required: true, min: 0, onlyInt: true },
        { type: 'bool', name: 'active' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_activities_game_order ON activities (game, sortOrder)'],
    });
    app.save(activities);

    const rewards = new Collection({
      type: 'base',
      name: 'rewards',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'text', name: 'name', required: true, max: 120 },
        { type: 'number', name: 'cost', required: true, min: 1, max: 10000, onlyInt: true },
        { type: 'number', name: 'sortOrder', required: true, min: 0, onlyInt: true },
        { type: 'bool', name: 'active' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_rewards_game_order ON rewards (game, sortOrder)'],
    });
    app.save(rewards);

    const monthlyQuests = new Collection({
      type: 'base',
      name: 'monthly_quests',
      listRule: gameRule,
      viewRule: gameRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'relation', name: 'game', required: true, maxSelect: 1, collectionId: games.id, cascadeDelete: true },
        { type: 'relation', name: 'account', required: true, maxSelect: 1, collectionId: accounts.id, cascadeDelete: true },
        { type: 'text', name: 'month', required: true, min: 7, max: 7, pattern: '^[0-9]{4}-[0-9]{2}$' },
        { type: 'number', name: 'slot', required: true, min: 1, max: 3, onlyInt: true },
        { type: 'text', name: 'title', max: 160 },
        { type: 'number', name: 'points', required: true, min: 1, max: 10000, onlyInt: true },
        { type: 'bool', name: 'completed' },
        { type: 'number', name: 'sortOrder', required: true, min: 0, onlyInt: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_monthly_quests_game_month_slot ON monthly_quests (game, month, slot)',
      ],
    });
    app.save(monthlyQuests);
  },
  (app) => {
    for (const name of ['monthly_quests', 'rewards', 'activities', 'categories']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const accounts = app.findCollectionByNameOrId('accounts');
    accounts.fields.getByName('playerName').required = true;
    accounts.fields.getByName('game').required = true;
    accounts.removeIndex('idx_accounts_game_owner');
    app.save(accounts);
  },
);
